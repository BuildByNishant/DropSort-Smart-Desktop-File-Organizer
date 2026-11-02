const { cloneDefaults, validateCategories, validateRules, LAYOUTS } = require('./categorizer');

const DEFAULT_SETTINGS = {
  categories: cloneDefaults(),
  rules: [],                   // smart rules (win over extension categories)
  layout: 'type',              // how files are arranged inside the destination
  onboarded: false,            // first-run walkthrough completed
  recursiveScan: false,        // scanning subfolders must be an explicit choice
  includeHidden: false,
  conflictPolicy: 'rename',    // rename | skip
  destinationMode: 'choose',   // choose | remember | in-place
  theme: 'system',             // system | light | dark
  lastDestination: null,       // set by the app itself, never by the renderer
};

const ENUMS = {
  layout: LAYOUTS,
  conflictPolicy: ['rename', 'skip'],
  destinationMode: ['choose', 'remember', 'in-place'],
  theme: ['system', 'light', 'dark'],
};
const BOOLEANS = ['recursiveScan', 'includeHidden', 'onboarded'];

function getSettings(db) {
  const settings = { ...DEFAULT_SETTINGS, categories: cloneDefaults() };
  const rows = db.prepare('SELECT setting_key, setting_value FROM settings').all();
  for (const row of rows) {
    if (!(row.setting_key in DEFAULT_SETTINGS)) continue;
    try {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    } catch {
      /* ignore a corrupted value and keep the default */
    }
  }
  return settings;
}

const upsert = (db) =>
  db.prepare(
    `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`
  );

// Validates a partial settings object from the UI and saves the known keys only.
function saveSettings(db, input) {
  const updates = {};
  if ('categories' in input) updates.categories = validateCategories(input.categories);
  if ('rules' in input) updates.rules = validateRules(input.rules);
  for (const key of BOOLEANS) {
    if (key in input) {
      if (typeof input[key] !== 'boolean') throw new Error(`Invalid value for ${key}.`);
      updates[key] = input[key];
    }
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (key in input) {
      if (!allowed.includes(input[key])) throw new Error(`Invalid value for ${key}.`);
      updates[key] = input[key];
    }
  }
  const stmt = upsert(db);
  db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) stmt.run(key, JSON.stringify(value));
  })();
  return getSettings(db);
}

// For values only the main process may set (e.g. the last destination folder).
function setInternalSetting(db, key, value) {
  upsert(db).run(key, JSON.stringify(value));
}

module.exports = { DEFAULT_SETTINGS, getSettings, saveSettings, setInternalSetting };
