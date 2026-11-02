const fs = require('fs');
const path = require('path');
const { moveNoOverwrite, pathExists } = require('./organizer');
const { friendlyError } = require('./errors');

const OCCUPIED_MESSAGE =
  'A file already exists at the original location. DropSort will not overwrite it. Move or rename that file, then try again.';

function createHistory(db) {
  const now = () => new Date().toISOString();

  const insertScan = db.prepare(
    'INSERT INTO scans (source_folder, destination_root, total_files, created_at) VALUES (?, ?, ?, ?)'
  );
  const insertSession = db.prepare(
    `INSERT INTO organization_sessions (scan_id, total_planned, status, created_at) VALUES (?, ?, 'partial', ?)`
  );
  const updateSession = db.prepare(
    `UPDATE organization_sessions
        SET total_moved = ?, total_skipped = ?, total_failed = ?, status = ? WHERE id = ?`
  );
  const insertOperation = db.prepare(
    `INSERT INTO file_operations
       (session_id, original_path, destination_path, file_name, file_size, sha256, status, error_message, category, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
  );
  const getOperationRow = db.prepare('SELECT * FROM file_operations WHERE id = ?');
  const markReversed = db.prepare(`UPDATE file_operations SET status = 'reversed', error_message = NULL WHERE id = ?`);
  const markBlocked = db.prepare('UPDATE file_operations SET error_message = ? WHERE id = ?');

  // A session starts as "partial" so a crash mid-way is never reported as a clean success.
  const createSession = db.transaction(({ sourceFolder, destinationRoot, totalFiles, totalPlanned }) => {
    const scanId = insertScan.run(sourceFolder, destinationRoot, totalFiles, now()).lastInsertRowid;
    return Number(insertSession.run(scanId, totalPlanned, now()).lastInsertRowid);
  });

  function recordOperation(sessionId, r) {
    insertOperation.run(
      sessionId, r.source, r.destination || '', r.name, r.size ?? null, r.status, r.error || null, r.category || null, now()
    );
  }

  function finishSession(sessionId, { moved, skipped, failed, status }) {
    updateSession.run(moved, skipped, failed, status, sessionId);
  }

  function getSessions({ search = '', limit = 50, offset = 0 } = {}) {
    const where = search ? 'WHERE instr(lower(sc.source_folder), lower(?)) > 0' : '';
    const params = search ? [search, limit, offset] : [limit, offset];
    return db
      .prepare(
        `SELECT s.id, s.scan_id, s.total_planned, s.total_moved, s.total_skipped, s.total_failed, s.status, s.created_at,
                sc.source_folder, sc.destination_root, sc.total_files,
                (SELECT COUNT(*) FROM file_operations o WHERE o.session_id = s.id AND o.status = 'moved')    AS restorable,
                (SELECT COUNT(*) FROM file_operations o WHERE o.session_id = s.id AND o.status = 'reversed') AS reversed
           FROM organization_sessions s JOIN scans sc ON sc.id = s.scan_id
           ${where}
          ORDER BY s.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params);
  }

  function getOperations(sessionId, { status = '', search = '', limit = 200, offset = 0 } = {}) {
    const conditions = ['session_id = ?'];
    const params = [sessionId];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('instr(lower(file_name), lower(?)) > 0');
      params.push(search);
    }
    const where = conditions.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) AS n FROM file_operations WHERE ${where}`).get(...params).n;
    const operations = db
      .prepare(`SELECT * FROM file_operations WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    return { operations, total };
  }

  // --------------------------------------------------------------- undo

  async function undoOperation(id) {
    const op = getOperationRow.get(id);
    if (!op) return { ok: false, status: 'not-found', message: 'That operation could not be found.' };
    if (op.status === 'reversed') return { ok: false, status: 'reversed', message: 'This file was already restored.' };
    if (op.status !== 'moved') return { ok: false, status: op.status, message: 'Only moved files can be restored.' };

    const blocked = (message) => {
      markBlocked.run(`Undo blocked: ${message}`, id);
      return { ok: false, status: 'blocked', message };
    };

    try {
      const stat = await fs.promises.lstat(op.destination_path);
      if (!stat.isFile()) return blocked('The item at the new location is not a regular file.');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return blocked('The file is no longer at its new location. It may have been moved, renamed or deleted.');
      }
      return blocked(friendlyError(err));
    }

    if (await pathExists(op.original_path)) return blocked(OCCUPIED_MESSAGE);

    try {
      await fs.promises.mkdir(path.dirname(op.original_path), { recursive: true });
      await moveNoOverwrite(op.destination_path, op.original_path);
    } catch (err) {
      if (err.code === 'EEXIST') return blocked(OCCUPIED_MESSAGE);
      return blocked(friendlyError(err));
    }

    // Only mark as reversed once the file is really back.
    try {
      markReversed.run(id);
    } catch (err) {
      return { ok: true, status: 'reversed', message: 'Restored, but the history record could not be updated.', warning: true };
    }
    return { ok: true, status: 'reversed', message: 'Restored to the original location.' };
  }

  async function undoSession(sessionId) {
    const ops = db
      .prepare(`SELECT id FROM file_operations WHERE session_id = ? AND status = 'moved' ORDER BY id DESC`)
      .all(sessionId);
    const results = [];
    for (const { id } of ops) results.push({ id, ...(await undoOperation(id)) });
    const restored = results.filter((r) => r.ok).length;
    return { total: results.length, restored, blocked: results.length - restored, results };
  }

  // ---------------------------------------------------------- dashboard

  function getDashboard() {
    const totals = db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM organization_sessions) AS sessions,
                (SELECT COUNT(*) FROM file_operations WHERE status = 'moved')    AS moved,
                (SELECT COUNT(*) FROM file_operations WHERE status = 'reversed') AS reversed`
      )
      .get();
    const categoryTotals = db
      .prepare(
        `SELECT COALESCE(category, 'Others') AS category, COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS bytes
           FROM file_operations WHERE status = 'moved' GROUP BY category ORDER BY count DESC`
      )
      .all();
    return { totals, categoryTotals, recentSessions: getSessions({ limit: 5 }) };
  }

  function isKnownPath(p) {
    return Boolean(db.prepare('SELECT 1 FROM file_operations WHERE original_path = ? OR destination_path = ? LIMIT 1').get(p, p));
  }

  return {
    createSession, recordOperation, finishSession, getSessions, getOperations,
    undoOperation, undoSession, getDashboard, isKnownPath,
  };
}

module.exports = { createHistory };
