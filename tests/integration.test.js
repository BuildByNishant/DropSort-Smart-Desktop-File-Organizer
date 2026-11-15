// Drives the real IPC handlers end to end (with a fake Electron) through the whole workflow.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { registerIpcHandlers } = require('../electron/ipc/handlers');
const { makeTempDir, write, exists, tryOpenMemoryDb, fakeElectron } = require('./helpers');

const db = tryOpenMemoryDb();
const skip = db ? false : 'better-sqlite3 is built for Electron';
const JOB = 'job-aaaaaaaa';

test('full workflow: select, scan, preview, organize, history, undo, duplicates', { skip }, async () => {
  const src = makeTempDir('src-');
  const dest = makeTempDir('dest-');
  write(src, 'report.pdf', 'pdf-bytes');
  write(src, 'photo.jpg', 'jpg-bytes');
  write(src, 'copy-of-photo.jpg', 'jpg-bytes');
  write(src, 'notes.xyz', 'other');

  const f = fakeElectron({ pickQueue: [src, dest] });
  registerIpcHandlers({ electron: f.electron, db });
  const call = f.call;

  // security: an unapproved folder cannot be scanned
  let r = await call('scan:start', src, { jobId: JOB });
  assert.strictEqual(r.ok, false);

  r = await call('dialog:selectFolder', 'source');
  assert.deepStrictEqual(r.data, { path: src });

  r = await call('scan:start', src, { jobId: JOB, recursive: false });
  assert.strictEqual(r.ok, true, r.error);
  const scan = r.data;
  assert.strictEqual(scan.files.length, 4);
  assert.strictEqual(scan.files.find((x) => x.name === 'report.pdf').category, 'Documents');

  // duplicates
  r = await call('duplicates:find', scan.scanId, { jobId: 'job-bbbbbbbb' });
  assert.strictEqual(r.data.groups.length, 1);

  // preview needs an approved destination
  r = await call('preview:build', scan.scanId, { destinationMode: 'separate', destinationRoot: dest });
  assert.strictEqual(r.ok, false);
  await call('dialog:selectFolder', 'destination');
  r = await call('preview:build', scan.scanId, { destinationMode: 'separate', destinationRoot: dest });
  assert.strictEqual(r.ok, true, r.error);
  const plan = r.data;
  assert.strictEqual(plan.summary.plannedMoves, 4);
  assert.ok(exists(path.join(src, 'report.pdf')), 'preview must not move anything');

  // exclude one file, organize
  const excludedId = plan.items.find((i) => i.name === 'notes.xyz').id;
  r = await call('organize:run', plan.planId, { excludedItemIds: [excludedId], jobId: 'x' });
  assert.strictEqual(r.ok, true, r.error);
  assert.strictEqual(r.data.counts.moved, 3);
  assert.strictEqual(r.data.status, 'completed');
  assert.ok(exists(path.join(dest, 'Documents', 'report.pdf')));
  assert.ok(exists(path.join(src, 'notes.xyz')), 'excluded file stays');
  const sessionId = r.data.sessionId;

  // a plan cannot be executed twice
  r = await call('organize:run', plan.planId, {});
  assert.strictEqual(r.ok, false);

  // history
  r = await call('history:sessions', {});
  assert.strictEqual(r.data[0].id, sessionId);
  r = await call('history:operations', sessionId, {});
  assert.strictEqual(r.data.total, 3);
  const op = r.data.operations.find((o) => o.file_name === 'report.pdf');

  // reveal is limited to known paths
  r = await call('shell:reveal', op.destination_path);
  assert.strictEqual(r.ok, true);
  r = await call('shell:reveal', '/etc/passwd');
  assert.strictEqual(r.ok, false);

  // undo one operation
  r = await call('history:undoOperation', op.id);
  assert.strictEqual(r.data.ok, true);
  assert.ok(exists(path.join(src, 'report.pdf')));

  // undo the rest of the session
  r = await call('history:undoSession', sessionId);
  assert.strictEqual(r.data.restored, 2);

  r = await call('dashboard:get');
  assert.strictEqual(r.data.totals.sessions, 1);
});

test('IPC rejects malformed arguments instead of crashing', { skip }, async () => {
  const f = fakeElectron();
  registerIpcHandlers({ electron: f.electron, db });
  for (const [channel, ...args] of [
    ['scan:start', 42, {}],
    ['scan:start', '/tmp', { jobId: '../../x' }],
    ['dialog:selectFolder', 'anywhere'],
    ['preview:build', 'nope', {}],
    ['organize:run', {}, {}],
    ['history:undoOperation', 'drop table'],
    ['history:operations', -1],
    ['settings:save', { theme: 'neon' }],
    ['shell:reveal', null],
  ]) {
    const r = await f.call(channel, ...args);
    assert.strictEqual(r.ok, false, `${channel} should be rejected`);
    assert.strictEqual(typeof r.error, 'string');
  }
});

test('cancelling the folder picker is not an error', { skip }, async () => {
  const f = fakeElectron({ pickQueue: [] });
  registerIpcHandlers({ electron: f.electron, db });
  const r = await f.call('dialog:selectFolder', 'source');
  assert.deepStrictEqual(r, { ok: true, data: null });
});

test('in-place mode organizes inside the source folder', { skip }, async () => {
  const src = makeTempDir('src-');
  write(src, 'a.pdf', 'a');
  const f = fakeElectron({ pickQueue: [src] });
  registerIpcHandlers({ electron: f.electron, db });
  await f.call('dialog:selectFolder', 'source');
  const scan = (await f.call('scan:start', src, { jobId: 'job-cccccccc' })).data;
  const plan = (await f.call('preview:build', scan.scanId, { destinationMode: 'in-place' })).data;
  const res = (await f.call('organize:run', plan.planId, {})).data;
  assert.strictEqual(res.counts.moved, 1);
  assert.ok(exists(path.join(src, 'Documents', 'a.pdf')));
});
