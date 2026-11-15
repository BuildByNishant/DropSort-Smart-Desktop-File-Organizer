const test = require('node:test');
const assert = require('node:assert');
const { findDuplicates } = require('../electron/services/duplicateDetector');
const { scanFolder } = require('../electron/services/scanner');
const { makeTempDir, write } = require('./helpers');

test('TC-12 only byte-identical files are grouped (same size, different content is not a duplicate)', async () => {
  const dir = makeTempDir();
  write(dir, 'a.txt', 'same content');
  write(dir, 'b.txt', 'same content');
  write(dir, 'c.txt', 'same content');
  write(dir, 'd.txt', 'diff content!'); // 13 bytes
  write(dir, 'e.txt', 'other conten!'); // 13 bytes, different
  write(dir, 'empty1.txt', '');
  write(dir, 'empty2.txt', '');
  const { files } = await scanFolder(dir);
  const res = await findDuplicates(files);
  assert.strictEqual(res.groups.length, 1);
  assert.deepStrictEqual(res.groups[0].files.map((f) => f.name).sort(), ['a.txt', 'b.txt', 'c.txt']);
  assert.strictEqual(res.stats.duplicateFiles, 2);
  assert.strictEqual(res.stats.reclaimableBytes, 24);
});

test('a file that cannot be hashed is reported as unverified, not as a duplicate', async () => {
  const dir = makeTempDir();
  write(dir, 'a.txt', 'abc');
  write(dir, 'b.txt', 'abc');
  const { files } = await scanFolder(dir);
  const broken = files.map((f) => (f.name === 'b.txt' ? { ...f, path: dir + '/gone.txt' } : f));
  const res = await findDuplicates(broken);
  assert.strictEqual(res.groups.length, 0);
  assert.strictEqual(res.unverified.length, 1);
});

test('duplicate search can be cancelled', async () => {
  const dir = makeTempDir();
  write(dir, 'a.txt', 'abc');
  write(dir, 'b.txt', 'abc');
  const { files } = await scanFolder(dir);
  const ac = new AbortController();
  ac.abort();
  assert.deepStrictEqual(await findDuplicates(files, { signal: ac.signal }), { cancelled: true });
});
