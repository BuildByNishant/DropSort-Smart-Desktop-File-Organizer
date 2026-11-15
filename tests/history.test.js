const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createHistory } = require('../electron/services/history');
const org = require('../electron/services/organizer');
const { scanFolder } = require('../electron/services/scanner');
const { buildExtensionMap, DEFAULT_CATEGORIES } = require('../electron/services/categorizer');
const { getSettings, saveSettings } = require('../electron/services/settings');
const { makeTempDir, write, exists, tryOpenMemoryDb } = require('./helpers');

const db = tryOpenMemoryDb();
const skip = db ? false : 'better-sqlite3 is built for Electron; run these via the integration check in README';

async function organizeFixture(history, files) {
  const src = makeTempDir('src-');
  const dest = makeTempDir('dest-');
  for (const [n, c] of Object.entries(files)) write(src, n, c);
  const { files: scanned } = await scanFolder(src);
  const { items } = await org.buildPlan({
    files: scanned, sourceRoot: src, destinationRoot: dest, extensionMap: buildExtensionMap(DEFAULT_CATEGORIES),
  });
  const sessionId = history.createSession({ sourceFolder: src, destinationRoot: dest, totalFiles: scanned.length, totalPlanned: items.length });
  const { results, counts } = await org.executePlan({ items, onResult: (r) => history.recordOperation(sessionId, r) });
  history.finishSession(sessionId, { moved: counts.moved, skipped: counts.skipped, failed: counts.failed, status: org.sessionStatus(counts) });
  return { src, dest, sessionId, results };
}

test('TC-13 sessions and operations are persisted and queryable', { skip }, async () => {
  const history = createHistory(db);
  const { sessionId } = await organizeFixture(history, { 'a.pdf': 'a', 'b.png': 'b' });
  const [session] = history.getSessions();
  assert.strictEqual(session.id, sessionId);
  assert.strictEqual(session.total_moved, 2);
  assert.strictEqual(session.status, 'completed');
  assert.strictEqual(session.restorable, 2);
  const { operations, total } = history.getOperations(sessionId);
  assert.strictEqual(total, 2);
  assert.ok(operations.every((o) => o.original_path && o.destination_path && o.category));
  assert.strictEqual(history.getOperations(sessionId, { search: 'a.p' }).total, 1);
});

test('TC-14 undo returns the file when the original path is free', { skip }, async () => {
  const history = createHistory(db);
  const { src, sessionId } = await organizeFixture(history, { 'a.pdf': 'hello' });
  const op = history.getOperations(sessionId).operations[0];
  const res = await history.undoOperation(op.id);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(fs.readFileSync(path.join(src, 'a.pdf'), 'utf8'), 'hello');
  assert.ok(!exists(op.destination_path));
  assert.strictEqual(history.getOperations(sessionId).operations[0].status, 'reversed');
  // doing it twice is refused
  assert.strictEqual((await history.undoOperation(op.id)).ok, false);
});

test('TC-15 undo is blocked, and never overwrites, when the original path is occupied', { skip }, async () => {
  const history = createHistory(db);
  const { src, sessionId } = await organizeFixture(history, { 'a.pdf': 'ORIGINAL' });
  write(src, 'a.pdf', 'NEWER FILE');
  const op = history.getOperations(sessionId).operations[0];
  const res = await history.undoOperation(op.id);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.status, 'blocked');
  assert.strictEqual(fs.readFileSync(path.join(src, 'a.pdf'), 'utf8'), 'NEWER FILE');
  assert.strictEqual(fs.readFileSync(op.destination_path, 'utf8'), 'ORIGINAL');
  const after = history.getOperations(sessionId).operations[0];
  assert.strictEqual(after.status, 'moved'); // not marked reversed
  assert.match(after.error_message, /Undo blocked/);
});

test('undo is blocked when the moved file has disappeared', { skip }, async () => {
  const history = createHistory(db);
  const { sessionId } = await organizeFixture(history, { 'a.pdf': 'a' });
  const op = history.getOperations(sessionId).operations[0];
  fs.unlinkSync(op.destination_path);
  const res = await history.undoOperation(op.id);
  assert.strictEqual(res.status, 'blocked');
});

test('undoSession restores what it can and reports the rest', { skip }, async () => {
  const history = createHistory(db);
  const { src, sessionId } = await organizeFixture(history, { 'a.pdf': 'a', 'b.png': 'b', 'c.mp3': 'c' });
  write(src, 'b.png', 'blocker');
  const res = await history.undoSession(sessionId);
  assert.strictEqual(res.total, 3);
  assert.strictEqual(res.restored, 2);
  assert.strictEqual(res.blocked, 1);
});

test('dashboard summarizes sessions and categories', { skip }, async () => {
  const history = createHistory(db);
  await organizeFixture(history, { 'x.pdf': 'x' });
  const d = history.getDashboard();
  assert.ok(d.totals.sessions >= 1);
  assert.ok(d.categoryTotals.some((c) => c.category === 'Documents'));
});

test('settings validate, persist and ignore unknown keys', { skip }, () => {
  const s = saveSettings(db, { theme: 'dark', recursiveScan: true, categories: { Docs: ['pdf'] }, evil: 1, lastDestination: '/etc' });
  assert.strictEqual(s.theme, 'dark');
  assert.strictEqual(s.recursiveScan, true);
  assert.deepStrictEqual(s.categories, { Docs: ['pdf'] });
  assert.strictEqual(s.lastDestination, null); // renderer cannot set this
  assert.throws(() => saveSettings(db, { theme: 'neon' }));
  assert.throws(() => saveSettings(db, { recursiveScan: 'yes' }));
  assert.strictEqual(getSettings(db).theme, 'dark');
});
