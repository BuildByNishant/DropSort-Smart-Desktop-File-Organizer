const META = {
  Documents: { icon: '📄', color: '#3b82f6' },
  Spreadsheets: { icon: '📊', color: '#16a34a' },
  Presentations: { icon: '📽️', color: '#f97316' },
  Images: { icon: '🖼️', color: '#a855f7' },
  Videos: { icon: '🎬', color: '#ef4444' },
  Audio: { icon: '🎵', color: '#ec4899' },
  Archives: { icon: '🗜️', color: '#a16207' },
  Code: { icon: '💻', color: '#0ea5e9' },
  Others: { icon: '📦', color: '#6b7280' },
};
const PALETTE = ['#14b8a6', '#8b5cf6', '#e11d48', '#65a30d', '#d97706', '#0891b2'];

export function categoryMeta(name) {
  if (META[name]) return META[name];
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { icon: '📁', color: PALETTE[hash % PALETTE.length] };
}

// Display order: configured categories, then folders created by Smart Rules, then Others.
export function categoryOrder(categories = {}, extra = []) {
  const known = new Set([...Object.keys(categories), 'Others']);
  const fromRules = [...new Set(extra)].filter((c) => !known.has(c));
  return [...Object.keys(categories), ...fromRules, 'Others'];
}

export const QUICK_FOLDERS = [
  ['downloads', '📥', 'Downloads'],
  ['desktop', '🖥️', 'Desktop'],
  ['documents', '📄', 'Documents'],
];

export const EXT_RE = /^[a-z0-9][a-z0-9_+-]{0,14}$/;
export const normalizeExt = (raw) => String(raw || '').trim().toLowerCase().replace(/^\.+/, '');
export const sanitizeCategoryName = (name) =>
  String(name || '').replace(/[/\\:*?"<>|\u0000-\u001f]/g, '').replace(/^\.+/, '').trim().slice(0, 60);

export const isMovable = (item) => item.status === 'ready' || item.status === 'renamed';
export const totalBytes = (files) => (files ? files.reduce((n, f) => n + f.size, 0) : 0);

export const STATUS_LABELS = {
  ready: 'Ready',
  renamed: 'Will be renamed',
  'conflict-skip': 'Conflict: skipped',
  'in-place': 'Already in place',
  'in-destination': 'Already organized',
  moved: 'Moved',
  skipped: 'Skipped',
  failed: 'Failed',
  reversed: 'Restored',
};
