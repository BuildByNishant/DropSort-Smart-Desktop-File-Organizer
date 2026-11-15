// Renders every screen to HTML with realistic fixture data to catch runtime errors in the UI code.
// Run with: npm run test:ui
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.window = { dropsort: {} };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const load = (p) => server.ssrLoadModule(p);

const { AppContext } = await load('/src/hooks/AppContext.jsx');
const settings = {
  categories: { Documents: ['pdf', 'txt'], Images: ['png', 'jpg'], Archives: ['zip'] },
  recursiveScan: false, includeHidden: false, conflictPolicy: 'rename', destinationMode: 'choose', theme: 'system', lastDestination: null,
  layout: 'type', onboarded: true,
  rules: [
    { id: 'r1', name: 'Screenshots', enabled: true, field: 'name', op: 'contains', value: 'screenshot', folder: 'Screenshots', presetId: 'screenshots' },
    { id: 'r2', name: 'Big', enabled: false, field: 'size', op: 'largerThan', value: 500, folder: 'Large Files' },
  ],
};
const files = [
  { id: 1, name: 'report.pdf', ext: 'pdf', path: '/u/Downloads/report.pdf', dir: '/u/Downloads', size: 12345, mtimeMs: 1.7e12, birthtimeMs: 1.7e12, category: 'Documents' },
  { id: 2, name: 'photo.png', ext: 'png', path: '/u/Downloads/photo.png', dir: '/u/Downloads', size: 5e6, mtimeMs: 1.7e12, birthtimeMs: 1.7e12, category: 'Images', ruleId: 'r1' },
  { id: 3, name: 'mystery', ext: '', path: '/u/Downloads/mystery', dir: '/u/Downloads', size: 0, mtimeMs: 1.7e12, birthtimeMs: 1.7e12, category: 'Others' },
];
const scan = { scanId: 's1', folder: '/u/Downloads', files, skipped: [{ path: '/u/Downloads/l', reason: 'Symbolic link' }], skippedCount: 1, hiddenIgnored: 2, options: { recursive: true, includeHidden: false }, scannedAt: new Date().toISOString() };
const items = files.map((f) => ({ id: f.id, name: f.name, source: f.path, category: f.category, destinationDir: '/u/Sorted/' + f.category, destination: '/u/Sorted/' + f.category + '/' + f.name, finalName: f.name, size: f.size, mtimeMs: f.mtimeMs, status: f.id === 2 ? 'renamed' : f.id === 3 ? 'conflict-skip' : 'ready', conflict: f.id > 1, note: 'note' }));
const plan = { planId: 'p1', scanId: 's1', sourceRoot: '/u/Downloads', destinationRoot: '/u/Sorted', conflictPolicy: 'rename', inPlace: true, recursive: true, items, summary: { totalFiles: 3, plannedMoves: 2, renamed: 1, skipped: 1, byCategory: { Documents: { count: 1, size: 1 }, Images: { count: 1, size: 1 } }, newFolders: ['/u/Sorted/Documents'] } };
const lastResult = { sessionId: 1, status: 'partial', counts: { planned: 3, moved: 1, skipped: 1, failed: 1 }, results: [
  { itemId: 1, name: 'report.pdf', category: 'Documents', source: '/a', destination: '/b', status: 'moved', recorded: true },
  { itemId: 2, name: 'photo.png', category: 'Images', source: '/a', destination: '/b', status: 'failed', error: 'Disk full', recorded: false, recordError: 'x' },
  { itemId: 3, name: 'mystery', category: 'Others', source: '/a', destination: '/b', status: 'skipped', error: 'why' } ], recordFailures: 1, sessionRecorded: false, sourceRoot: '/u/Downloads', destinationRoot: '/u/Sorted' };
const dupes = { scanId: 's1', cancelled: false, groups: [{ hash: 'a'.repeat(64), size: 10, files: [files[0], files[1]] }], unverified: [{ ...files[2], error: 'nope' }], stats: { groupCount: 1, duplicateFiles: 1, reclaimableBytes: 10, candidatesHashed: 2 } };

const base = {
  page: 'dashboard', navigate() {}, settings, defaultCategories: settings.categories, loadError: null, saveSettings: async () => settings,
  layout: 'type', setLayout() {}, dropFolder() {}, addPreset() {}, tourOpen: false, setTourOpen() {}, finishTour() {}, exportCsv() {}, openPrivacy() {},
  sourceFolder: '/u/Downloads', scanOptions: { recursive: false, includeHidden: false }, setScanOptions() {}, destination: { mode: 'separate', path: '/u/Sorted' },
  setDestinationMode() {}, conflictPolicy: 'rename', setConflictPolicy() {}, pickSource: async () => null, pickDestination: async () => null,
  scan, scanning: null, scanError: null, runScan() {}, cancelJob() {}, excluded: new Set([3]), toggleExcluded() {}, setExcludedMany() {},
  plan, planLoading: false, planError: null, loadPreview() {}, organizing: false, runOrganize() {}, lastResult,
  dupes, dupeJob: null, runDuplicates() {}, categoryFilter: 'All', setCategoryFilter() {}, progress: {}, toast() {}, toasts: [{ id: 1, message: 'hi', kind: 'info' }], reveal() {},
};
const variants = [
  ['full', base],
  ['empty', { ...base, scan: null, plan: null, lastResult: null, dupes: null, destination: { mode: 'separate', path: null } }],
  ['busy', { ...base, scanning: { jobId: 'j' }, dupeJob: { jobId: 'd' }, organizing: true, progress: { scan: { filesFound: 5 }, duplicates: { done: 1, total: 4, currentName: 'x' }, organize: { done: 1, total: 3, currentName: 'x' } } }],
  ['error', { ...base, planError: 'boom', scanError: 'bad', plan: null }],
  ['denied', { ...base, planError: 'Permission denied. macOS may be blocking access.', scanError: 'Permission denied. macOS may be blocking access.', plan: null }],
  ['tour', { ...base, tourOpen: true }],
];

const names = ['Dashboard', 'Organizer', 'ScanResults', 'Preview', 'Summary', 'SmartRules', 'Categories', 'Duplicates', 'History', 'Settings'];
const { default: Sidebar } = await load('/src/components/Sidebar.jsx');
let failures = 0;
for (const name of names) {
  const { default: Page } = await load(`/src/pages/${name}.jsx`);
  for (const [vname, value] of variants) {
    try {
      const html = renderToString(React.createElement(AppContext.Provider, { value }, React.createElement(Page)));
      if (html.length < 20) throw new Error('rendered nothing');
    } catch (err) {
      failures += 1;
      console.error(`FAIL ${name} [${vname}]:`, err.message);
    }
  }
}
renderToString(React.createElement(AppContext.Provider, { value: base }, React.createElement(Sidebar)));
for (const extra of ['Stepper', 'Onboarding', 'InsightsPanel']) {
  const { default: C } = await load(`/src/components/${extra}.jsx`);
  for (const [, value] of variants) if (extra !== 'InsightsPanel' || value.scan) renderToString(React.createElement(AppContext.Provider, { value }, React.createElement(C)));
}

// ---- insights logic
const { computeInsights } = await load('/src/utils/insights.js');
const DAY = 86400000;
const now = Date.now();
const mk = (o) => ({ id: Math.random(), name: 'f.txt', ext: 'txt', size: 10, mtimeMs: now, category: 'Documents', ...o });
let bad = 0;
const check = (cond, msg) => { if (!cond) { bad += 1; console.error('FAIL insights:', msg); } };
const empty = computeInsights([], { now });
check(empty.score === 0 && empty.level === 'Tidy' && empty.tips.length === 0, 'empty folder is tidy');
const messy = computeInsights(Array.from({ length: 300 }, (_, i) => mk({ name: `x${i}`, category: 'Others', mtimeMs: now - 400 * DAY })), { now });
check(messy.score === 100 && messy.level === 'Cluttered', `messy folder scores 100 (got ${messy.score})`);
check(messy.tips.some((t) => t.presetId === 'old'), 'suggests an old-files rule');
const shots = computeInsights([mk({ name: 'Screenshot 1.png', category: 'Images' }), mk({ name: 'Screen Shot 2.png', category: 'Images' }), mk({ name: 'Invoice 3.pdf' }), mk({ name: 'a.dmg', ext: 'dmg' }), mk({ name: 'big.mov', size: 6e8 })], { now });
check(['screenshots', 'invoices', 'installers', 'large'].every((id) => shots.tips.some((t) => t.presetId === id)), 'suggests presets');
check(shots.largest[0].name === 'big.mov', 'largest first');
const covered = computeInsights([mk({ name: 'Screenshot 1.png' })], { now, existingPresets: new Set(['screenshots']) });
check(covered.tips.length === 0, 'no suggestion for presets already added');
failures += bad;
await server.close();
console.log(failures ? `${failures} render failures` : `UI smoke test passed (${names.length * variants.length} renders)`);
process.exit(failures ? 1 : 0);
