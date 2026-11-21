// Tests for smart rules, sorting layouts, CSV export, quick start and dropped folders.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const c = require('../electron/services/categorizer');
const org = require('../electron/services/organizer');
const { scanFolder } = require('../electron/services/scanner');
const { cell, toCsv, planToCsv } = require('../electron/services/exporter');
const { registerIpcHandlers } = require('../electron/ipc/handlers');
const { makeTempDir, write, exists, tryOpenMemoryDb, fakeElectron } = require('./helpers');

const extensionMap = c.buildExtensionMap(c.DEFAULT_CATEGORIES);
const DAY = 86400000;
const rule = (o) => ({ id: 'r1', name: 'R', enabled: true, folder: 'Special', ...o });
const file = (o) => ({ name: 'a.pdf', size: 10, mtimeMs: Date.now(), ...o });

test('name rules match contains / startsWith / endsWith, any-of, case-insensitively', () => {
  const now = Date.now();
  const m = (r, name) => c.ruleMatches(rule(r), file({ name }), now);
  assert.ok(m({ field: 'name', op: 'contains', value: 'screenshot, screen shot' }, 'Screen Shot 2026-01-01.png'));
  assert.ok(m({ field: 'name', op: 'startsWith', value: 'INV' }, 'invoice-12.pdf'));
  assert.ok(!m({ field: 'name', op: 'startsWith', value: 'voice' }, 'invoice-12.pdf'));
  assert.ok(m({ field: 'name', op: 'endsWith', value: 'final' }, 'report final.docx'));
});

test('extension, size and age rules', () => {
  const now = Date.now();
  assert.ok(c.ruleMatches(rule({ field: 'extension', op: 'is', value: 'dmg,pkg' }), file({ name: 'x.PKG' }), now));
  assert.ok(c.ruleMatches(rule({ field: 'size', op: 'largerThan', value: 5 }), file({ size: 6e6 }), now));
  assert.ok(!c.ruleMatches(rule({ field: 'size', op: 'largerThan', value: 5 }), file({ size: 4e6 }), now));
  assert.ok(c.ruleMatches(rule({ field: 'age', op: 'olderThan', value: 30 }), file({ mtimeMs: now - 31 * DAY }), now));
  assert.ok(!c.ruleMatches(rule({ field: 'age', op: 'olderThan', value: 30 }), file({ mtimeMs: now - 5 * DAY }), now));
});

test('first enabled matching rule wins over the extension category; disabled rules are ignored', () => {
  const rules = [
    rule({ id: 'a', name: 'Off', enabled: false, field: 'name', op: 'contains', value: 'invoice', folder: 'Nope' }),
    rule({ id: 'b', name: 'Invoices', field: 'name', op: 'contains', value: 'invoice', folder: 'Invoices' }),
  ];
  const res = c.classifyFile(file({ name: 'invoice.pdf' }), { extensionMap, rules });
  assert.deepStrictEqual([res.category, res.ruleId], ['Invoices', 'b']);
  const compiledRules = c.compileRules(rules);
  assert.deepStrictEqual(c.classifyFile(file({ name: 'invoice.pdf' }), { extensionMap, compiledRules }).category, 'Invoices');
  assert.strictEqual(c.classifyFile(file({ name: 'notes.pdf' }), { extensionMap, compiledRules }).category, 'Documents');
});

test('validateRules normalizes good rules and rejects bad ones', () => {
  const ok = c.validateRules([{ id: 'x1', name: ' Dmg ', field: 'extension', op: 'is', value: '.DMG, pkg', folder: 'In/stall' }]);
  assert.deepStrictEqual(ok[0], { id: 'x1', name: 'Dmg', enabled: true, field: 'extension', op: 'is', value: 'dmg,pkg', folder: 'Install' });
  const bad = (r) => assert.throws(() => c.validateRules([{ id: 'x', name: 'n', folder: 'F', enabled: true, ...r }]));
  bad({ field: 'size', op: 'largerThan', value: -1 });
  bad({ field: 'name', op: 'is', value: 'x' });
  bad({ field: 'name', op: 'contains', value: '' });
  bad({ field: 'extension', op: 'is', value: 'bad ext' });
  bad({ field: 'name', op: 'contains', value: 'x', folder: '///' });
  assert.throws(() => c.validateRules([{ id: 'dup', name: 'a', field: 'age', op: 'olderThan', value: 1, folder: 'F' }, { id: 'dup', name: 'b', field: 'age', op: 'olderThan', value: 1, folder: 'F' }]));
  assert.throws(() => c.validateRules('nope'));
});

test('layouts build date folders below the category (local time)', () => {
  const t = new Date(2026, 10, 5, 12).getTime(); // 5 Nov 2026
  assert.deepStrictEqual(c.layoutSegments('type', 'Images', t), ['Images']);
  assert.deepStrictEqual(c.layoutSegments('type-month', 'Images', t), ['Images', '2026-11']);
  assert.deepStrictEqual(c.layoutSegments('type-year', 'Images', t), ['Images', '2026']);
  assert.deepStrictEqual(c.layoutSegments('year', 'Images', t), ['2026']);
  assert.deepStrictEqual(c.layoutSegments('month', 'Images', t), ['2026-11']);
});

test('a plan applies rules and the chosen layout, and organizing creates those folders', async () => {
  const src = makeTempDir('src-');
  const dest = makeTempDir('dest-');
  write(src, 'Screenshot 1.png', 'a', new Date(2025, 2, 10));
  write(src, 'notes.pdf', 'b', new Date(2025, 2, 11));
  const { files } = await scanFolder(src);
  const rules = c.validateRules([{ id: 's1', name: 'Shots', field: 'name', op: 'contains', value: 'screenshot', folder: 'Screenshots' }]);
  const { items } = await org.buildPlan({ files, sourceRoot: src, destinationRoot: dest, extensionMap, rules, layout: 'type-month' });
  assert.strictEqual(items.find((i) => i.name === 'Screenshot 1.png').ruleName, 'Shots');
  await org.executePlan({ items });
  assert.ok(exists(path.join(dest, 'Screenshots', '2025-03', 'Screenshot 1.png')));
  assert.ok(exists(path.join(dest, 'Documents', '2025-03', 'notes.pdf')));
});

test('CSV cells are quoted and formula-injection is neutralized', () => {
  assert.strictEqual(cell('a,b'), '"a,b"');
  assert.strictEqual(cell('say "hi"'), '"say ""hi"""');
  assert.strictEqual(cell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.strictEqual(cell('+1'), "'+1");
  assert.strictEqual(cell(null), '');
  const csv = toCsv(['A', 'B'], [[1, 'x']]);
  assert.ok(csv.startsWith('\uFEFFA,B\r\n1,x'));
  assert.ok(planToCsv([{ name: 'f', category: 'c', ruleName: null, size: 1, source: '/a', destination: '/b', status: 'ready', note: '' }]).includes('/a'));
});

const db = tryOpenMemoryDb();
const skip = db ? false : 'better-sqlite3 not loadable under plain Node';

test('settings: rules, layout and onboarded are validated and saved', { skip }, () => {
  const { saveSettings, getSettings } = require('../electron/services/settings');
  const s = saveSettings(db, {
    layout: 'type-year', onboarded: true,
    rules: [{ id: 'k1', name: 'Big', field: 'size', op: 'largerThan', value: 100, folder: 'Big', presetId: 'large' }],
  });
  assert.strictEqual(s.layout, 'type-year');
  assert.strictEqual(s.onboarded, true);
  assert.strictEqual(s.rules[0].presetId, 'large');
  assert.throws(() => saveSettings(db, { layout: 'sideways' }));
  assert.throws(() => saveSettings(db, { rules: [{ id: 'x' }] }));
  saveSettings(db, { rules: [], layout: 'type' });
  assert.strictEqual(getSettings(db).rules.length, 0);
});

test('IPC: dropped folder, quick start, rule-aware scan, layout preview and CSV export', { skip }, async () => {
  const { saveSettings } = require('../electron/services/settings');
  saveSettings(db, { rules: [{ id: 'sh', name: 'Shots', field: 'name', op: 'contains', value: 'screenshot', folder: 'Screenshots' }] });

  const src = makeTempDir('src-');
  const dest = makeTempDir('dest-');
  const csvPath = path.join(makeTempDir('csv-'), 'out.csv');
  write(src, 'Screenshot a.png', 'a', new Date(2024, 0, 15));
  write(src, 'doc.pdf', 'b', new Date(2024, 0, 16));

  const f = fakeElectron({ pickQueue: [dest, dest], saveQueue: [csvPath, null] });
  registerIpcHandlers({ electron: f.electron, db });

  // dropping a file (not a folder) is refused; dropping a folder approves it
  assert.strictEqual((await f.call('dialog:approveDropped', path.join(src, 'doc.pdf'))).ok, false);
  assert.strictEqual((await f.call('dialog:approveDropped', '/definitely/missing')).ok, false);
  assert.strictEqual((await f.call('dialog:approveDropped', src)).data.path, src);

  // quick start only accepts known locations
  assert.strictEqual((await f.call('dialog:selectFolder', 'source', 'downloads')).ok, true);
  assert.strictEqual((await f.call('dialog:selectFolder', 'source', '/etc')).ok, false);

  const scan = (await f.call('scan:start', src, { jobId: 'job-dddddddd' })).data;
  assert.strictEqual(scan.files.find((x) => x.name === 'Screenshot a.png').category, 'Screenshots');

  const plan = (await f.call('preview:build', scan.scanId, { destinationMode: 'separate', destinationRoot: dest, layout: 'type-month' })).data;
  assert.strictEqual(plan.layout, 'type-month');
  assert.ok(plan.items.find((i) => i.name === 'doc.pdf').destination.endsWith(path.join('Documents', '2024-01', 'doc.pdf')));
  assert.strictEqual((await f.call('preview:build', scan.scanId, { destinationMode: 'in-place', layout: 'bogus' })).ok, false);

  // recategorize returns rule ids
  const rec = (await f.call('scan:recategorize', scan.scanId)).data.categories;
  assert.strictEqual(rec[scan.files.find((x) => x.name === 'Screenshot a.png').id].ruleId, 'sh');

  // CSV export writes the chosen file; cancelling is not an error
  const exp = await f.call('export:csv', 'preview', plan.planId, { excludedItemIds: [] });
  assert.strictEqual(exp.data.path, csvPath);
  assert.ok(fs.readFileSync(csvPath, 'utf8').includes('doc.pdf'));
  assert.deepStrictEqual(await f.call('export:csv', 'preview', plan.planId, {}), { ok: true, data: null });
  assert.strictEqual((await f.call('export:csv', 'nonsense', 1)).ok, false);
  assert.strictEqual((await f.call('export:csv', 'preview', 'missing-plan')).ok, false);

  saveSettings(db, { rules: [] });
});

test('IPC: privacy settings opens only the fixed macOS panes', { skip }, async () => {
  const f = fakeElectron();
  registerIpcHandlers({ electron: f.electron, db });
  assert.strictEqual((await f.call('system:openPrivacySettings', 'files')).ok, true);
  assert.strictEqual((await f.call('system:openPrivacySettings', 'disk')).ok, true);
  assert.ok(f.sent.filter((s) => s.channel === 'openExternal').every((s) => s.payload.startsWith('x-apple.systempreferences:')));
  assert.strictEqual((await f.call('system:openPrivacySettings', 'https://evil.example')).ok, false);
});
