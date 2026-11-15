const test = require('node:test');
const assert = require('node:assert');
const c = require('../electron/services/categorizer');

const map = c.buildExtensionMap(c.DEFAULT_CATEGORIES);

test('TC-05 PDF, JPG and ZIP map to Documents, Images and Archives', () => {
  assert.strictEqual(c.categorize('report.pdf', map), 'Documents');
  assert.strictEqual(c.categorize('photo.jpg', map), 'Images');
  assert.strictEqual(c.categorize('bundle.zip', map), 'Archives');
});
test('extensions are case-insensitive', () => {
  assert.strictEqual(c.categorize('SCAN.PDF', map), 'Documents');
  assert.strictEqual(c.categorize('Pic.JpEg', map), 'Images');
});
test('TC-06 unknown extension and files without extension go to Others', () => {
  assert.strictEqual(c.categorize('thing.xyz123', map), 'Others');
  assert.strictEqual(c.categorize('Makefile', map), 'Others');
  assert.strictEqual(c.categorize('.gitignore', map), 'Others');
});
test('validateCategories normalizes and de-duplicates', () => {
  const out = c.validateCategories({ Docs: ['.PDF', 'txt', 'pdf'], Pics: ['pdf', 'png'] });
  assert.deepStrictEqual(out, { Docs: ['pdf', 'txt'], Pics: ['png'] });
});
test('validateCategories rejects bad input', () => {
  assert.throws(() => c.validateCategories({ A: ['bad ext!'] }));
  assert.throws(() => c.validateCategories({ A: [], a: [] }));
  assert.throws(() => c.validateCategories([]));
  assert.throws(() => c.validateCategories({ '': [] }));
});
test('category names cannot escape the destination folder', () => {
  assert.strictEqual(c.categoryFolderName('../../etc'), 'etc');
  assert.strictEqual(c.categoryFolderName('a/b\\c'), 'abc');
  assert.strictEqual(c.categoryFolderName('///'), 'Others');
});
test('"Others" cannot be redefined', () => {
  assert.deepStrictEqual(c.validateCategories({ Others: ['pdf'], Docs: ['pdf'] }), { Docs: ['pdf'] });
});
