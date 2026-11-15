const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const org = require('../electron/services/organizer');
const { scanFolder } = require('../electron/services/scanner');
const { buildExtensionMap, DEFAULT_CATEGORIES } = require('../electron/services/categorizer');
const { makeTempDir, write, exists } = require('./helpers');

const extensionMap = buildExtensionMap(DEFAULT_CATEGORIES);

async function setup(files) {
  const src = makeTempDir('src-');
  const dest = makeTempDir('dest-');
  for (const [name, content] of Object.entries(files)) write(src, name, content);
  const { files: scanned } = await scanFolder(src);
  return { src, dest, scanned };
}
const plan = (ctx, conflictPolicy = 'rename') =>
  org.buildPlan({ files: ctx.scanned, sourceRoot: ctx.src, destinationRoot: ctx.dest, extensionMap, conflictPolicy });

test('TC-07 building a plan does not touch any file or create folders', async () => {
  const ctx = await setup({ 'a.pdf': 'a', 'b.png': 'b' });
  const { items, summary } = await plan(ctx);
  assert.strictEqual(summary.plannedMoves, 2);
  assert.ok(exists(path.join(ctx.src, 'a.pdf')));
  assert.deepStrictEqual(fs.readdirSync(ctx.dest), []);
  assert.deepStrictEqual(items.map((i) => i.category).sort(), ['Documents', 'Images']);
  assert.strictEqual(summary.newFolders.length, 2);
});

test('TC-08 organizing moves files into category folders', async () => {
  const ctx = await setup({ 'a.pdf': 'a', 'b.png': 'b', 'c.weird': 'c' });
  const { items } = await plan(ctx);
  const { results, counts } = await org.executePlan({ items });
  assert.strictEqual(counts.moved, 3);
  assert.ok(exists(path.join(ctx.dest, 'Documents', 'a.pdf')));
  assert.ok(exists(path.join(ctx.dest, 'Images', 'b.png')));
  assert.ok(exists(path.join(ctx.dest, 'Others', 'c.weird')));
  assert.ok(!exists(path.join(ctx.src, 'a.pdf')));
  assert.ok(results.every((r) => r.status === 'moved'));
});

test('TC-09 an existing destination file is never overwritten (rename policy)', async () => {
  const ctx = await setup({ 'a.pdf': 'NEW' });
  write(ctx.dest, 'Documents/a.pdf', 'OLD');
  const { items } = await plan(ctx);
  assert.strictEqual(items[0].status, 'renamed');
  assert.strictEqual(items[0].finalName, 'a (1).pdf');
  await org.executePlan({ items });
  assert.strictEqual(fs.readFileSync(path.join(ctx.dest, 'Documents', 'a.pdf'), 'utf8'), 'OLD');
  assert.strictEqual(fs.readFileSync(path.join(ctx.dest, 'Documents', 'a (1).pdf'), 'utf8'), 'NEW');
});

test('skip policy leaves both files alone', async () => {
  const ctx = await setup({ 'a.pdf': 'NEW' });
  write(ctx.dest, 'Documents/a.pdf', 'OLD');
  const { items } = await plan(ctx, 'skip');
  assert.strictEqual(items[0].status, 'conflict-skip');
  const { counts } = await org.executePlan({ items, conflictPolicy: 'skip' });
  assert.strictEqual(counts.skipped, 1);
  assert.ok(exists(path.join(ctx.src, 'a.pdf')));
  assert.strictEqual(fs.readFileSync(path.join(ctx.dest, 'Documents', 'a.pdf'), 'utf8'), 'OLD');
});

test('same-named files from different subfolders never collide', async () => {
  const src = makeTempDir('src-');
  const dest = makeTempDir('dest-');
  write(src, 'one/a.pdf', '1');
  write(src, 'two/a.pdf', '2');
  const { files } = await scanFolder(src, { recursive: true });
  const { items } = await org.buildPlan({ files, sourceRoot: src, destinationRoot: dest, extensionMap });
  assert.strictEqual(new Set(items.map((i) => i.destination.toLowerCase())).size, 2);
  const { counts } = await org.executePlan({ items });
  assert.strictEqual(counts.moved, 2);
  assert.strictEqual(fs.readdirSync(path.join(dest, 'Documents')).length, 2);
});

test('TC-10 a source removed after the scan is skipped and reported', async () => {
  const ctx = await setup({ 'a.pdf': 'a', 'b.png': 'b' });
  const { items } = await plan(ctx);
  fs.unlinkSync(path.join(ctx.src, 'a.pdf'));
  const { results, counts } = await org.executePlan({ items });
  assert.strictEqual(counts.moved, 1);
  assert.strictEqual(results.find((r) => r.name === 'a.pdf').status, 'skipped');
  assert.match(results.find((r) => r.name === 'a.pdf').error, /no longer available/);
});

test('a file modified after the preview is skipped, not moved', async () => {
  const ctx = await setup({ 'a.pdf': 'a' });
  const { items } = await plan(ctx);
  fs.writeFileSync(path.join(ctx.src, 'a.pdf'), 'changed content');
  const { results } = await org.executePlan({ items });
  assert.strictEqual(results[0].status, 'skipped');
  assert.ok(exists(path.join(ctx.src, 'a.pdf')));
});

test('files already in the right place are not moved (in-place mode)', async () => {
  const src = makeTempDir('src-');
  write(src, 'Documents/a.pdf', 'a');
  write(src, 'b.pdf', 'b');
  const { files } = await scanFolder(src, { recursive: true });
  const { items } = await org.buildPlan({ files, sourceRoot: src, destinationRoot: src, extensionMap });
  assert.strictEqual(items.find((i) => i.name === 'a.pdf').status, 'in-place');
  const b = items.find((i) => i.name === 'b.pdf');
  assert.strictEqual(b.status, 'ready'); // Documents/b.pdf is free, so it moves there without a rename
});

test('files already inside a destination nested in the source are skipped', async () => {
  const src = makeTempDir('src-');
  const dest = path.join(src, 'Sorted');
  write(src, 'Sorted/Images/x.pdf', 'x');
  write(src, 'y.pdf', 'y');
  const { files } = await scanFolder(src, { recursive: true });
  const { items } = await org.buildPlan({ files, sourceRoot: src, destinationRoot: dest, extensionMap });
  assert.strictEqual(items.find((i) => i.name === 'x.pdf').status, 'in-destination');
  assert.strictEqual(items.find((i) => i.name === 'y.pdf').status, 'ready');
});

test('moveNoOverwrite throws EEXIST and keeps both files', async () => {
  const dir = makeTempDir();
  const a = write(dir, 'a.txt', 'A');
  const b = write(dir, 'b.txt', 'B');
  await assert.rejects(org.moveNoOverwrite(a, b), { code: 'EEXIST' });
  assert.strictEqual(fs.readFileSync(a, 'utf8'), 'A');
  assert.strictEqual(fs.readFileSync(b, 'utf8'), 'B');
});

test('cross-volume copy-verify-delete fallback moves the file and preserves its timestamp', async () => {
  const dir = makeTempDir();
  const old = new Date('2020-01-02T03:04:05Z');
  const a = write(dir, 'a.txt', 'hello', old);
  const dest = path.join(dir, 'out', 'a.txt');
  fs.mkdirSync(path.dirname(dest));
  await org.copyVerifyMove(a, dest);
  assert.ok(!exists(a));
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'hello');
  assert.ok(Math.abs(fs.statSync(dest).mtimeMs - old.getTime()) < 1000);
  assert.deepStrictEqual(fs.readdirSync(path.dirname(dest)), ['a.txt']); // no temp files left behind
});

test('copy-verify fallback never overwrites an existing destination and keeps the source', async () => {
  const dir = makeTempDir();
  const a = write(dir, 'a.txt', 'A');
  const dest = write(dir, 'out/a.txt', 'EXISTING');
  await assert.rejects(org.copyVerifyMove(a, dest), { code: 'EEXIST' });
  assert.ok(exists(a));
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'EXISTING');
  assert.deepStrictEqual(fs.readdirSync(path.dirname(dest)), ['a.txt']);
});

test('unicode names and names with spaces are handled', async () => {
  const ctx = await setup({ 'my résumé (final).pdf': 'a', '日本語 ファイル.png': 'b' });
  const { items } = await plan(ctx);
  const { counts } = await org.executePlan({ items });
  assert.strictEqual(counts.moved, 2);
});

test('executePlan reports the callback result and keeps going if recording fails', async () => {
  const ctx = await setup({ 'a.pdf': 'a', 'b.png': 'b' });
  const { items } = await plan(ctx);
  const { results } = await org.executePlan({
    items,
    onResult: (r) => {
      if (r.name === 'a.pdf') throw new Error('disk i/o');
    },
  });
  assert.strictEqual(results.find((r) => r.name === 'a.pdf').recorded, false);
  assert.strictEqual(results.find((r) => r.name === 'b.png').recorded, true);
  assert.ok(exists(path.join(ctx.dest, 'Documents', 'a.pdf'))); // still moved, but flagged
});

test('a file where a category folder is needed fails that file without crashing', async () => {
  const ctx = await setup({ 'a.pdf': 'a', 'b.png': 'b' });
  fs.writeFileSync(path.join(ctx.dest, 'Documents'), 'i am a file');
  const { items } = await plan(ctx);
  const { results } = await org.executePlan({ items });
  assert.strictEqual(results.find((r) => r.name === 'a.pdf').status, 'failed');
  assert.strictEqual(results.find((r) => r.name === 'b.png').status, 'moved');
  assert.ok(exists(path.join(ctx.src, 'a.pdf')));
});
