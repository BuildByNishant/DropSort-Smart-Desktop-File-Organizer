const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { classifyFile, layoutSegments } = require('./categorizer');
const { friendlyError } = require('./errors');
const { hashFile } = require('./hash');

const MOVABLE = new Set(['ready', 'renamed']);
const isMovable = (item) => MOVABLE.has(item.status);

// Errors that mean "hard links are not possible here" (different volume, exFAT, ...).
const LINK_FALLBACK_CODES = new Set(['EXDEV', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EMLINK']);
const HASH_VERIFY_LIMIT = 50 * 1024 * 1024; // verify checksum of copies up to 50 MB

// ---------------------------------------------------------------- helpers

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// True if anything exists at p. Unknown errors count as "exists" (the safe answer).
async function pathExists(p) {
  try {
    await fs.promises.lstat(p);
    return true;
  } catch (err) {
    return !(err.code === 'ENOENT' || err.code === 'ENOTDIR');
  }
}

// filename.ext -> filename (1).ext -> filename (2).ext ...
async function uniqueDestination(dir, fileName, reserved = new Set()) {
  const { name, ext } = path.parse(fileName);
  let candidate = path.join(dir, fileName);
  let n = 0;
  while (reserved.has(candidate.toLowerCase()) || (await pathExists(candidate))) {
    n += 1;
    if (n > 10000) throw new Error('Could not find a free file name.');
    candidate = path.join(dir, `${name} (${n})${ext}`);
  }
  return candidate;
}

// ------------------------------------------------------------ safe moving

/**
 * Moves a file WITHOUT ever overwriting the destination.
 * Same volume: hard-link to the new name (atomic, fails with EEXIST if taken), then remove the old name.
 * Otherwise: copy to a temp file, verify it, publish it under the final name, then remove the source.
 * If anything fails, the source file is left untouched.
 */
async function moveNoOverwrite(src, dest) {
  try {
    await fs.promises.link(src, dest);
  } catch (err) {
    if (err.code === 'EEXIST') throw err;
    if (LINK_FALLBACK_CODES.has(err.code)) return copyVerifyMove(src, dest);
    throw err;
  }
  try {
    await fs.promises.unlink(src);
  } catch (err) {
    await fs.promises.unlink(dest).catch(() => {}); // roll back: keep the original in place
    throw err;
  }
}

async function copyVerifyMove(src, dest) {
  const tmp = path.join(path.dirname(dest), `.dropsort-${crypto.randomBytes(6).toString('hex')}.tmp`);
  const srcStat = await fs.promises.stat(src);
  let published = false;
  try {
    await fs.promises.copyFile(src, tmp, fs.constants.COPYFILE_EXCL);
    const tmpStat = await fs.promises.stat(tmp);
    if (tmpStat.size !== srcStat.size) throw new Error('Copy verification failed: size mismatch.');
    if (srcStat.size <= HASH_VERIFY_LIMIT) {
      const [a, b] = await Promise.all([hashFile(src), hashFile(tmp)]);
      if (a !== b) throw new Error('Copy verification failed: checksum mismatch.');
    }
    await fs.promises.utimes(tmp, srcStat.atime, srcStat.mtime);

    try {
      await fs.promises.link(tmp, dest); // atomic "create only if missing"
      published = true;
    } catch (err) {
      if (err.code === 'EEXIST') throw err;
      if (await pathExists(dest)) throw Object.assign(new Error('exists'), { code: 'EEXIST' });
      await fs.promises.rename(tmp, dest);
      published = true;
    }
  } catch (err) {
    await fs.promises.unlink(tmp).catch(() => {});
    throw err;
  }
  await fs.promises.unlink(tmp).catch(() => {}); // no-op if rename already consumed it

  try {
    await fs.promises.unlink(src);
  } catch (err) {
    if (published) await fs.promises.unlink(dest).catch(() => {});
    throw new Error(`The file was copied but the original could not be removed (${err.code || err.message}). The original was kept.`);
  }
}

// ------------------------------------------------------------------- plan

/**
 * Builds a movement plan. Never touches the file system except to look.
 * Statuses: ready | renamed | conflict-skip | in-place | in-destination
 */
async function buildPlan({
  files, sourceRoot, destinationRoot, extensionMap, rules = [], layout = 'type', conflictPolicy = 'rename', now = Date.now(),
}) {
  const reserved = new Set(); // lower-cased destinations already claimed by this plan (macOS is case-insensitive)
  const items = [];

  for (const file of files) {
    const { category, ruleName } = classifyFile(file, { extensionMap, rules, now });
    const destinationDir = path.join(destinationRoot, ...layoutSegments(layout, category, file.mtimeMs));
    const intended = path.join(destinationDir, file.name);

    const item = {
      id: file.id,
      name: file.name,
      source: file.path,
      category,
      ruleName,
      destinationDir,
      destination: intended,
      finalName: file.name,
      size: file.size,
      mtimeMs: file.mtimeMs,
      status: 'ready',
      conflict: false,
      note: '',
    };

    if (file.path.toLowerCase() === intended.toLowerCase()) {
      item.status = 'in-place';
      item.note = 'Already in the right folder';
    } else if (destinationRoot !== sourceRoot && isInside(file.path, destinationRoot)) {
      item.status = 'in-destination';
      item.note = 'Already inside the destination folder';
    } else if (reserved.has(intended.toLowerCase()) || (await pathExists(intended))) {
      item.conflict = true;
      if (conflictPolicy === 'skip') {
        item.status = 'conflict-skip';
        item.note = 'A file with this name already exists. It will be skipped.';
      } else {
        const unique = await uniqueDestination(destinationDir, file.name, reserved);
        reserved.add(unique.toLowerCase());
        item.destination = unique;
        item.finalName = path.basename(unique);
        item.status = 'renamed';
        item.note = `Name already taken. Will be saved as "${item.finalName}".`;
      }
    } else {
      reserved.add(intended.toLowerCase());
    }
    items.push(item);
  }

  const dirChecks = new Map();
  const newFolders = [];
  for (const item of items) {
    if (!isMovable(item) || dirChecks.has(item.destinationDir)) continue;
    const exists = await pathExists(item.destinationDir);
    dirChecks.set(item.destinationDir, exists);
    if (!exists) newFolders.push(item.destinationDir);
  }

  return { items, summary: summarizePlan(items, newFolders) };
}

function summarizePlan(items, newFolders = []) {
  const byCategory = {};
  let plannedMoves = 0;
  let renamed = 0;
  let skipped = 0;
  for (const item of items) {
    if (isMovable(item)) {
      plannedMoves += 1;
      byCategory[item.category] = byCategory[item.category] || { count: 0, size: 0 };
      byCategory[item.category].count += 1;
      byCategory[item.category].size += item.size;
      if (item.status === 'renamed') renamed += 1;
    } else {
      skipped += 1;
    }
  }
  return { totalFiles: items.length, plannedMoves, renamed, skipped, byCategory, newFolders };
}

// -------------------------------------------------------------- execution

/**
 * Executes the included items one at a time, re-validating each one right before moving it.
 * `onResult(result)` is awaited after each file so the caller can persist it immediately.
 */
async function executePlan({ items, conflictPolicy = 'rename', onProgress, onResult }) {
  const results = [];
  let abortReason = null;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    let result;

    if (!isMovable(item)) {
      result = makeResult(item, 'skipped', item.note || 'Not moved');
    } else if (abortReason) {
      result = makeResult(item, 'skipped', abortReason);
    } else {
      result = await moveItem(item, conflictPolicy);
      if (result.code === 'ENOSPC') abortReason = 'Stopped because the disk is full.';
    }

    if (onResult) {
      try {
        await onResult(result);
        result.recorded = true;
      } catch (err) {
        result.recorded = false;
        result.recordError = `Could not save this to history: ${err.message}`;
      }
    }
    results.push(result);
    if (onProgress) onProgress({ done: i + 1, total: items.length, currentName: item.name });
  }
  return { results, counts: tally(results) };
}

function makeResult(item, status, error = null, destination = item.destination, code = null) {
  return {
    itemId: item.id,
    name: item.name,
    category: item.category,
    source: item.source,
    destination,
    size: item.size,
    status,
    error,
    code,
  };
}

async function moveItem(item, conflictPolicy) {
  try {
    let stat;
    try {
      stat = await fs.promises.lstat(item.source);
    } catch (err) {
      if (err.code === 'ENOENT') return makeResult(item, 'skipped', 'The file is no longer available.');
      throw err;
    }
    if (!stat.isFile()) return makeResult(item, 'skipped', 'This is no longer a regular file.');
    if (stat.size !== item.size || Math.abs(stat.mtimeMs - item.mtimeMs) > 1) {
      return makeResult(item, 'skipped', 'The file changed after it was scanned. Scan again to include it.');
    }

    await fs.promises.mkdir(item.destinationDir, { recursive: true });

    let dest = item.destination;
    if (await pathExists(dest)) {
      if (conflictPolicy === 'skip') return makeResult(item, 'skipped', 'A file with this name already exists in the destination.');
      dest = await uniqueDestination(item.destinationDir, item.name);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await moveNoOverwrite(item.source, dest);
        return makeResult(item, 'moved', null, dest);
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        if (conflictPolicy === 'skip') return makeResult(item, 'skipped', 'A file with this name already exists in the destination.');
        dest = await uniqueDestination(item.destinationDir, item.name); // someone created it just now
      }
    }
    return makeResult(item, 'failed', 'Could not find a free file name.');
  } catch (err) {
    return makeResult(item, 'failed', friendlyError(err), item.destination, err.code || null);
  }
}

function tally(results) {
  const counts = { planned: results.length, moved: 0, skipped: 0, failed: 0 };
  for (const r of results) {
    if (r.status === 'moved') counts.moved += 1;
    else if (r.status === 'failed') counts.failed += 1;
    else counts.skipped += 1;
  }
  return counts;
}

function sessionStatus(counts) {
  if (counts.failed > 0 && counts.moved === 0) return 'failed';
  if (counts.failed > 0) return 'partial';
  return 'completed';
}

module.exports = {
  isMovable,
  isInside,
  pathExists,
  uniqueDestination,
  moveNoOverwrite,
  copyVerifyMove,
  buildPlan,
  summarizePlan,
  executePlan,
  tally,
  sessionStatus,
};
