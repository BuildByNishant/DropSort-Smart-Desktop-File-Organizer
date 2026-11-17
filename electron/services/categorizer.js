const path = require('path');

// Proposed defaults (editable in Settings). "Others" is implicit: it is the
// fallback for unknown extensions and files without an extension.
const DEFAULT_CATEGORIES = {
  Documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'pages'],
  Spreadsheets: ['xls', 'xlsx', 'csv', 'ods', 'numbers'],
  Presentations: ['ppt', 'pptx', 'odp', 'key'],
  Images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tiff', 'tif'],
  Videos: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'wmv'],
  Audio: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'aiff'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  Code: [
    'py', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'java', 'c', 'cpp',
    'h', 'sh', 'rb', 'go', 'rs', 'php', 'swift', 'kt', 'sql', 'xml', 'yml', 'yaml',
  ],
};

const FALLBACK_CATEGORY = 'Others';
const EXTENSION_RE = /^[a-z0-9][a-z0-9_+-]{0,14}$/;

function cloneDefaults() {
  return structuredClone(DEFAULT_CATEGORIES);
}

// "PDF", ".pdf" -> "pdf"
function normalizeExtension(ext) {
  return String(ext || '').trim().toLowerCase().replace(/^\.+/, '');
}

// Category names become folder names, so strip anything unsafe.
function sanitizeFolderName(name) {
  return String(name)
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 60);
}

function categoryFolderName(category) {
  return sanitizeFolderName(category) || FALLBACK_CATEGORY;
}

// Validates and normalizes a category -> extensions mapping from the UI.
// Each extension can belong to only one category (first one wins).
function validateCategories(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Categories must be an object of category names and extension lists.');
  }
  const out = {};
  const seenNames = new Set();
  const seenExts = new Set();

  for (const [rawName, exts] of Object.entries(input)) {
    const name = sanitizeFolderName(rawName);
    if (!name) throw new Error('Category names cannot be empty.');
    if (name.toLowerCase() === FALLBACK_CATEGORY.toLowerCase()) continue; // implicit
    if (seenNames.has(name.toLowerCase())) throw new Error(`Duplicate category name: ${name}`);
    seenNames.add(name.toLowerCase());
    if (!Array.isArray(exts)) throw new Error(`Extensions for "${name}" must be a list.`);

    const list = [];
    for (const raw of exts) {
      const ext = normalizeExtension(raw);
      if (!ext) continue;
      if (!EXTENSION_RE.test(ext)) throw new Error(`Invalid extension: "${raw}"`);
      if (seenExts.has(ext)) continue;
      seenExts.add(ext);
      list.push(ext);
    }
    out[name] = list;
  }
  return out;
}

function buildExtensionMap(categories) {
  const map = new Map();
  for (const [category, exts] of Object.entries(categories)) {
    for (const ext of exts) map.set(normalizeExtension(ext), category);
  }
  return map;
}

function categorize(fileName, extensionMap) {
  const ext = normalizeExtension(path.extname(fileName));
  return (ext && extensionMap.get(ext)) || FALLBACK_CATEGORY;
}

// ------------------------------------------------------------ smart rules
// A rule sends matching files to a folder of your choice and wins over extension categories.
// field/op pairs: name (contains|startsWith|endsWith), extension (is), size (largerThan, MB), age (olderThan, days)
const RULE_OPS = {
  name: ['contains', 'startsWith', 'endsWith'],
  extension: ['is'],
  size: ['largerThan'],
  age: ['olderThan'],
};
const MAX_RULES = 30;
const DAY_MS = 86400000;

function validateRules(input) {
  if (!Array.isArray(input)) throw new Error('Rules must be a list.');
  if (input.length > MAX_RULES) throw new Error(`You can have at most ${MAX_RULES} rules.`);
  const seenIds = new Set();
  return input.map((raw, index) => {
    const r = raw && typeof raw === 'object' ? raw : {};
    const label = `Rule ${index + 1}`;
    const id = typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(r.id) ? r.id : null;
    if (!id || seenIds.has(id)) throw new Error(`${label} has an invalid or duplicate id.`);
    seenIds.add(id);
    const name = String(r.name || '').trim().slice(0, 60);
    if (!name) throw new Error(`${label} needs a name.`);
    if (!RULE_OPS[r.field] || !RULE_OPS[r.field].includes(r.op)) throw new Error(`"${name}" has an invalid condition.`);
    const folder = sanitizeFolderName(r.folder);
    if (!folder) throw new Error(`"${name}" needs a destination folder name.`);

    let value;
    if (r.field === 'size' || r.field === 'age') {
      value = Number(r.value);
      if (!Number.isFinite(value) || value <= 0 || value > 1e7) throw new Error(`"${name}" needs a positive number.`);
    } else {
      const parts = String(r.value || '').split(',').map((v) => v.trim()).filter(Boolean);
      if (parts.length === 0 || parts.some((v) => v.length > 100)) throw new Error(`"${name}" needs a value to look for.`);
      if (r.field === 'extension') {
        for (const part of parts) {
          if (!EXTENSION_RE.test(normalizeExtension(part))) throw new Error(`"${part}" is not a valid extension.`);
        }
        value = parts.map(normalizeExtension).join(',');
      } else {
        value = parts.join(',');
      }
    }
    const rule = { id, name, enabled: r.enabled !== false, field: r.field, op: r.op, value, folder };
    if (typeof r.presetId === 'string' && /^[a-z-]{1,30}$/.test(r.presetId)) rule.presetId = r.presetId;
    return rule;
  });
}

function prepareRule(rule) {
  const folder = sanitizeFolderName(rule.folder) || FALLBACK_CATEGORY;
  if (rule.field === 'name' || rule.field === 'extension') {
    const needles = String(rule.value || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    return { ...rule, folder, needles };
  }
  return { ...rule, folder };
}

function compileRules(rules = []) {
  return rules.filter((r) => r.enabled !== false).map(prepareRule);
}

function matchPreparedRule(rule, file, now) {
  switch (rule.field) {
    case 'name': {
      const lower = file.name.toLowerCase();
      const stem = rule.op === 'endsWith' ? path.parse(lower).name : null;
      return rule.needles.some((needle) => {
        if (rule.op === 'startsWith') return lower.startsWith(needle);
        if (rule.op === 'endsWith') return stem.endsWith(needle) || lower.endsWith(needle);
        return lower.includes(needle);
      });
    }
    case 'extension':
      return rule.needles.includes(normalizeExtension(path.extname(file.name)));
    case 'size':
      return file.size > rule.value * 1e6;
    case 'age':
      return now - file.mtimeMs > rule.value * DAY_MS;
    default:
      return false;
  }
}

function ruleMatches(rule, file, now) {
  return matchPreparedRule(rule.needles ? rule : prepareRule(rule), file, now);
}

// Decides a file's category folder: first matching enabled rule, else its extension category, else Others.
// Pass pre-compiled rules (via compileRules) when classifying many files.
function classifyFile(file, { extensionMap, rules = [], compiledRules, now = Date.now() }) {
  const active = compiledRules || compileRules(rules);
  for (const rule of active) {
    if (matchPreparedRule(rule, file, now)) {
      return { category: rule.folder, ruleId: rule.id, ruleName: rule.name };
    }
  }
  return { category: categorize(file.name, extensionMap), ruleId: null, ruleName: null };
}

// ----------------------------------------------------------------- layout
// How files are arranged inside the destination.
const LAYOUTS = ['type', 'type-month', 'type-year', 'year', 'month'];

function pad(n) {
  return String(n).padStart(2, '0');
}

// Folder segments (below the destination root) for a file.
function layoutSegments(layout, category, mtimeMs) {
  const d = new Date(mtimeMs);
  const year = String(d.getFullYear());
  const month = `${year}-${pad(d.getMonth() + 1)}`;
  const folder = categoryFolderName(category);
  switch (layout) {
    case 'type-month': return [folder, month];
    case 'type-year': return [folder, year];
    case 'year': return [year];
    case 'month': return [month];
    default: return [folder];
  }
}

module.exports = {
  DEFAULT_CATEGORIES,
  FALLBACK_CATEGORY,
  cloneDefaults,
  normalizeExtension,
  sanitizeFolderName,
  categoryFolderName,
  validateCategories,
  buildExtensionMap,
  categorize,
  RULE_OPS,
  MAX_RULES,
  validateRules,
  compileRules,
  ruleMatches,
  classifyFile,
  LAYOUTS,
  layoutSegments,
};
