const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { UserError, friendlyError } = require('../services/errors');
const { scanFolder } = require('../services/scanner');
const { buildExtensionMap, classifyFile, compileRules, DEFAULT_CATEGORIES, LAYOUTS } = require('../services/categorizer');
const { planToCsv, historyToCsv } = require('../services/exporter');
const { buildPlan, executePlan, isMovable, sessionStatus } = require('../services/organizer');
const { findDuplicates } = require('../services/duplicateDetector');
const { createHistory } = require('../services/history');
const { getSettings, saveSettings, setInternalSetting } = require('../services/settings');

const PROGRESS_CHANNEL = 'dropsort:progress';
const MAX_SCANS = 3;
const MAX_PLANS = 5;

// ------------------------------------------------------- argument validation
// Every argument coming from the renderer is untrusted and validated here.

function str(value, name, max = 4096) {
  if (typeof value !== 'string' || !value || value.length > max || value.includes('\0')) {
    throw new UserError(`Invalid ${name}.`);
  }
  return value;
}
function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw new UserError(`Invalid ${name}.`);
  return value;
}
function obj(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function posInt(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new UserError(`Invalid ${name}.`);
  return value;
}
function jobId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(value)) throw new UserError('Invalid job id.');
  return value;
}
function clampInt(value, dflt, min, max) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : dflt;
}
function searchText(value) {
  return typeof value === 'string' ? value.slice(0, 200) : '';
}

async function assertWritableDirectory(dir) {
  if (path.parse(dir).root === dir) throw new UserError('Please choose a folder, not the root of a disk.');
  let stat;
  try {
    stat = await fs.promises.stat(dir);
  } catch (err) {
    throw new UserError(friendlyError(err));
  }
  if (!stat.isDirectory()) throw new UserError('The destination must be a folder.');
  try {
    await fs.promises.access(dir, fs.constants.W_OK);
  } catch {
    throw new UserError('DropSort cannot write to this folder. Choose a different destination or check macOS permissions.');
  }
}

// Limits progress events to roughly 15 per second.
function throttledSender(webContents) {
  let last = 0;
  return (payload) => {
    const t = Date.now();
    if (t - last < 66 && !payload.force) return;
    last = t;
    try {
      if (!webContents.isDestroyed || !webContents.isDestroyed()) webContents.send(PROGRESS_CHANNEL, payload);
    } catch {
      /* window closed */
    }
  };
}

// ---------------------------------------------------------------- handlers

function registerIpcHandlers({ electron, db }) {
  const { ipcMain, dialog, shell, BrowserWindow, app } = electron;
  const history = createHistory(db);

  const approvedFolders = new Set(); // folders the user picked in a native dialog this session
  const scans = new Map();           // scanId -> { folder, files, skipped, options }
  const plans = new Map();           // planId -> reviewed movement plan
  const jobs = new Map();            // jobId  -> AbortController
  let organizing = false;

  const remember = (map, key, value, max) => {
    map.set(key, value);
    while (map.size > max) map.delete(map.keys().next().value);
  };
  const getScan = (scanId) => {
    const scan = scans.get(str(scanId, 'scan'));
    if (!scan) throw new UserError('This scan is no longer available. Please scan the folder again.');
    return scan;
  };

  function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return { ok: true, data: await fn(event, ...args) };
      } catch (err) {
        return { ok: false, error: friendlyError(err) };
      }
    });
  }

  handle('app:getInfo', () => ({ name: app.getName(), version: app.getVersion(), platform: process.platform }));

  // ---- native folder picker ------------------------------------------------
  const START_FOLDERS = ['downloads', 'desktop', 'documents', 'home'];
  handle('dialog:selectFolder', async (event, purpose, startIn) => {
    const kind = oneOf(purpose ?? 'source', ['source', 'destination'], 'purpose');
    const start = startIn == null ? null : oneOf(startIn, START_FOLDERS, 'start folder');
    const win = BrowserWindow.fromWebContents(event.sender);
    const settings = getSettings(db);
    const options = {
      title: kind === 'source' ? 'Choose a folder to organize' : 'Choose where organized files should go',
      buttonLabel: 'Choose',
      properties: kind === 'source' ? ['openDirectory'] : ['openDirectory', 'createDirectory'],
    };
    if (kind === 'destination' && settings.destinationMode === 'remember' && settings.lastDestination) {
      options.defaultPath = settings.lastDestination;
    }
    if (start) {
      try {
        options.defaultPath = app.getPath(start); // open the picker right at Downloads, Desktop...
      } catch {
        /* fall back to the default location */
      }
    }
    const result = await dialog.showOpenDialog(win, options);
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null; // cancel is not an error
    const chosen = path.resolve(result.filePaths[0]);
    approvedFolders.add(chosen);
    if (kind === 'destination') setInternalSetting(db, 'lastDestination', chosen);
    return { path: chosen };
  });

  // A folder dragged onto the window. The path comes from the preload script (it is read from the
  // real dropped file by Electron), and must be an existing folder.
  handle('dialog:approveDropped', async (_e, droppedPath) => {
    const folder = path.resolve(str(droppedPath, 'folder'));
    let stat;
    try {
      stat = await fs.promises.stat(folder);
    } catch (err) {
      throw new UserError(friendlyError(err));
    }
    if (!stat.isDirectory()) throw new UserError('Please drop a folder, not a file.');
    approvedFolders.add(folder);
    return { path: folder };
  });

  // ---- scanning ------------------------------------------------------------
  handle('scan:start', async (event, folderPath, options) => {
    const folder = path.resolve(str(folderPath, 'folder'));
    if (!approvedFolders.has(folder)) {
      throw new UserError('Please choose this folder with the Select Folder button first.');
    }
    const opts = obj(options);
    const id = jobId(opts.jobId);
    const settings = getSettings(db);
    const recursive = typeof opts.recursive === 'boolean' ? opts.recursive : settings.recursiveScan;
    const includeHidden = typeof opts.includeHidden === 'boolean' ? opts.includeHidden : settings.includeHidden;

    const controller = new AbortController();
    jobs.set(id, controller);
    const send = throttledSender(event.sender);
    try {
      const result = await scanFolder(folder, {
        recursive,
        includeHidden,
        signal: controller.signal,
        onProgress: (p) => send({ type: 'scan', jobId: id, ...p }),
      });
      if (result.cancelled) return { cancelled: true };

      const extensionMap = buildExtensionMap(settings.categories);
      const compiledRules = compileRules(settings.rules);
      const now = Date.now();
      const files = result.files.map((f) => {
        const { category, ruleId } = classifyFile(f, { extensionMap, compiledRules, now });
        return { ...f, category, ruleId };
      });
      const scanId = crypto.randomUUID();
      remember(scans, scanId, { folder, files, skipped: result.skipped, options: { recursive, includeHidden } }, MAX_SCANS);
      return {
        cancelled: false,
        scanId,
        folder,
        files,
        skipped: result.skipped.slice(0, 200),
        skippedCount: result.skipped.length,
        hiddenIgnored: result.hiddenIgnored,
        options: { recursive, includeHidden },
        scannedAt: new Date().toISOString(),
      };
    } finally {
      jobs.delete(id);
    }
  });

  // Cancels a running scan or duplicate search.
  handle('job:cancel', (_e, id) => {
    const controller = jobs.get(jobId(id));
    if (controller) controller.abort();
    return true;
  });

  // After category rules change, refresh categories of an existing scan.
  handle('scan:recategorize', (_e, scanId) => {
    const scan = getScan(scanId);
    const settings = getSettings(db);
    const extensionMap = buildExtensionMap(settings.categories);
    const compiledRules = compileRules(settings.rules);
    const now = Date.now();
    const categories = {};
    for (const file of scan.files) {
      const { category, ruleId } = classifyFile(file, { extensionMap, compiledRules, now });
      file.category = category;
      file.ruleId = ruleId;
      categories[file.id] = { category, ruleId };
    }
    return { categories };
  });

  // ---- preview (never changes any file) -----------------------------------
  handle('preview:build', async (_e, scanId, options) => {
    const scan = getScan(scanId);
    const o = obj(options);
    const mode = oneOf(o.destinationMode ?? 'separate', ['separate', 'in-place'], 'destination mode');
    const conflictPolicy = oneOf(o.conflictPolicy ?? 'rename', ['rename', 'skip'], 'conflict policy');
    const settings = getSettings(db);
    const layout = oneOf(o.layout ?? settings.layout, LAYOUTS, 'sorting style');

    let destinationRoot;
    if (mode === 'in-place') {
      destinationRoot = scan.folder;
    } else {
      destinationRoot = path.resolve(str(o.destinationRoot, 'destination'));
      if (!approvedFolders.has(destinationRoot)) {
        throw new UserError('Please choose the destination folder with the Select Destination button.');
      }
    }
    await assertWritableDirectory(destinationRoot);

    const { items, summary } = await buildPlan({
      files: scan.files,
      sourceRoot: scan.folder,
      destinationRoot,
      extensionMap: buildExtensionMap(settings.categories),
      rules: settings.rules,
      layout,
      conflictPolicy,
    });
    const planId = crypto.randomUUID();
    remember(
      plans,
      planId,
      { scanId, sourceRoot: scan.folder, destinationRoot, conflictPolicy, layout, items, totalFiles: scan.files.length },
      MAX_PLANS
    );
    return {
      planId, scanId, sourceRoot: scan.folder, destinationRoot, conflictPolicy, layout,
      inPlace: mode === 'in-place', recursive: scan.options.recursive, items, summary,
    };
  });

  // ---- organize ------------------------------------------------------------
  handle('organize:run', async (event, planId, options) => {
    if (organizing) throw new UserError('Another organization is already running.');
    const id = str(planId, 'plan');
    const plan = plans.get(id);
    if (!plan) throw new UserError('This preview has expired. Please generate a new preview.');

    const o = obj(options);
    const rawExcluded = Array.isArray(o.excludedItemIds) ? o.excludedItemIds : [];
    if (rawExcluded.length > plan.items.length) throw new UserError('Invalid exclusion list.');
    const excluded = new Set(rawExcluded.map((v) => posInt(v, 'file id')));

    const included = plan.items.filter((item) => !excluded.has(item.id));
    if (!included.some(isMovable)) throw new UserError('There are no files to move.');

    organizing = true;
    try {
      let sessionId;
      try {
        sessionId = history.createSession({
          sourceFolder: plan.sourceRoot,
          destinationRoot: plan.destinationRoot,
          totalFiles: plan.totalFiles,
          totalPlanned: included.length,
        });
      } catch (err) {
        // Never move files that cannot be recorded.
        throw new UserError(`DropSort could not write to its history database, so nothing was moved. (${err.message})`);
      }

      const send = throttledSender(event.sender);
      const { results, counts } = await executePlan({
        items: included,
        conflictPolicy: plan.conflictPolicy,
        onProgress: (p) => send({ type: 'organize', ...p, force: p.done === p.total }),
        onResult: (r) => history.recordOperation(sessionId, r),
      });

      const status = sessionStatus(counts);
      let sessionRecorded = true;
      try {
        history.finishSession(sessionId, { moved: counts.moved, skipped: counts.skipped, failed: counts.failed, status });
      } catch {
        sessionRecorded = false;
      }

      // The scan is now stale (files moved), so drop it and its plans.
      plans.delete(id);
      scans.delete(plan.scanId);
      for (const [pid, p] of plans) if (p.scanId === plan.scanId) plans.delete(pid);

      return {
        sessionId, status, counts, results, sessionRecorded,
        recordFailures: results.filter((r) => r.recorded === false).length,
        sourceRoot: plan.sourceRoot, destinationRoot: plan.destinationRoot,
        finishedAt: new Date().toISOString(),
      };
    } finally {
      organizing = false;
    }
  });

  // ---- duplicates ----------------------------------------------------------
  handle('duplicates:find', async (event, scanId, options) => {
    const scan = getScan(scanId);
    const id = jobId(obj(options).jobId);
    const controller = new AbortController();
    jobs.set(id, controller);
    const send = throttledSender(event.sender);
    try {
      return await findDuplicates(scan.files, {
        signal: controller.signal,
        onProgress: (p) => send({ type: 'duplicates', jobId: id, ...p, force: p.done === p.total }),
      });
    } finally {
      jobs.delete(id);
    }
  });

  // ---- history & undo ------------------------------------------------------
  handle('history:sessions', (_e, filters) => {
    const f = obj(filters);
    return history.getSessions({
      search: searchText(f.search),
      limit: clampInt(f.limit, 50, 1, 200),
      offset: clampInt(f.offset, 0, 0, 1e9),
    });
  });
  handle('history:operations', (_e, sessionId, filters) => {
    const f = obj(filters);
    return history.getOperations(posInt(sessionId, 'session'), {
      status: ['moved', 'failed', 'skipped', 'reversed'].includes(f.status) ? f.status : '',
      search: searchText(f.search),
      limit: clampInt(f.limit, 200, 1, 500),
      offset: clampInt(f.offset, 0, 0, 1e9),
    });
  });
  handle('history:undoOperation', (_e, operationId) => history.undoOperation(posInt(operationId, 'operation')));
  handle('history:undoSession', (_e, sessionId) => history.undoSession(posInt(sessionId, 'session')));
  handle('dashboard:get', () => history.getDashboard());

  // ---- settings ------------------------------------------------------------
  handle('settings:get', () => ({ settings: getSettings(db), defaultCategories: DEFAULT_CATEGORIES }));
  handle('settings:save', (_e, data) => ({ settings: saveSettings(db, obj(data)) }));

  // ---- CSV export (the save location always comes from a native Save dialog) ----
  handle('export:csv', async (event, kind, id, options) => {
    const what = oneOf(kind, ['preview', 'history'], 'export type');
    let csv;
    let defaultName;
    if (what === 'preview') {
      const plan = plans.get(str(id, 'plan'));
      if (!plan) throw new UserError('This preview has expired. Please generate a new preview.');
      const excluded = new Set((Array.isArray(obj(options).excludedItemIds) ? options.excludedItemIds : []).filter(Number.isInteger));
      csv = planToCsv(plan.items.filter((i) => !excluded.has(i.id)));
      defaultName = 'DropSort preview.csv';
    } else {
      const sid = posInt(id, 'session');
      const allOps = [];
      let offset = 0;
      while (true) {
        const { operations, total } = history.getOperations(sid, { limit: 500, offset });
        allOps.push(...operations);
        if (allOps.length >= total || operations.length === 0) break;
        offset += operations.length;
      }
      csv = historyToCsv(allOps);
      defaultName = `DropSort history ${sid}.csv`;
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      title: 'Save as spreadsheet (CSV)',
      defaultPath: defaultName,
      filters: [{ name: 'CSV spreadsheet', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(result.filePath, csv, 'utf8');
    return { path: result.filePath };
  });

  // ---- macOS privacy settings (fixed list; the renderer cannot open arbitrary URLs) ----
  const PRIVACY_PANES = {
    files: 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders',
    disk: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
  };
  handle('system:openPrivacySettings', async (_e, pane) => {
    const key = oneOf(pane ?? 'files', Object.keys(PRIVACY_PANES), 'settings pane');
    await shell.openExternal(PRIVACY_PANES[key]);
    return true;
  });

  // ---- Finder ----------------------------------------------------------------
  // Only paths DropSort already knows about (scanned or recorded) can be revealed.
  handle('shell:reveal', (_e, target) => {
    const p = path.resolve(str(target, 'path'));
    let known = approvedFolders.has(p) || history.isKnownPath(p);
    if (!known) {
      for (const scan of scans.values()) {
        if (scan.files.some((f) => f.path === p)) {
          known = true;
          break;
        }
      }
    }
    if (!known) throw new UserError('DropSort can only reveal files it has scanned or moved.');
    shell.showItemInFolder(p);
    return true;
  });
}

module.exports = { registerIpcHandlers, PROGRESS_CHANNEL };
