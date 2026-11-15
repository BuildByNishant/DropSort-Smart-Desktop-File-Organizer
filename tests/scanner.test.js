const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { scanFolder } = require('../electron/services/scanner');
const { makeTempDir, write } = require('./helpers');

test('TC-03 scans immediate files with metadata, skipping folders, links, hidden and in-progress files', async () => {
  const dir = makeTempDir();
  write(dir, 'a.pdf', '12345');
  write(dir, 'b.jpg', 'x');
  write(dir, '.hidden', 'x');
  write(dir, '.DS_Store', 'x');
  write(dir, 'movie.crdownload', 'x');
  write(dir, 'sub/inner.txt', 'x');
  fs.symlinkSync(path.join(dir, 'a.pdf'), path.join(dir, 'link.pdf'));

  const res = await scanFolder(dir);
  assert.deepStrictEqual(res.files.map((f) => f.name).sort(), ['a.pdf', 'b.jpg']);
  const a = res.files.find((f) => f.name === 'a.pdf');
  assert.strictEqual(a.size, 5);
  assert.strictEqual(a.ext, 'pdf');
  assert.ok(a.mtimeMs > 0);
  assert.strictEqual(res.hiddenIgnored, 1);
  assert.ok(res.skipped.some((s) => s.reason.includes('Symbolic')));
  assert.ok(res.skipped.some((s) => s.reason.includes('Download')));
});

test('recursive scanning is opt-in and includeHidden works', async () => {
  const dir = makeTempDir();
  write(dir, 'a.txt');
  write(dir, 'sub/deep/b.txt');
  write(dir, '.secret.txt');
  assert.strictEqual((await scanFolder(dir, { recursive: true })).files.length, 2);
  assert.strictEqual((await scanFolder(dir, { recursive: true, includeHidden: true })).files.length, 3);
});

test('TC-04 empty folder returns no files', async () => {
  const res = await scanFolder(makeTempDir());
  assert.deepStrictEqual(res.files, []);
});

test('TC-16 a scan can be cancelled', async () => {
  const dir = makeTempDir();
  for (let i = 0; i < 20; i++) write(dir, `f${i}.txt`);
  const ac = new AbortController();
  ac.abort();
  assert.deepStrictEqual(await scanFolder(dir, { signal: ac.signal }), { cancelled: true });
});

test('scanning a missing folder or a file throws', async () => {
  await assert.rejects(scanFolder('/definitely/not/here'));
  const dir = makeTempDir();
  const f = write(dir, 'x.txt');
  await assert.rejects(scanFolder(f));
});
