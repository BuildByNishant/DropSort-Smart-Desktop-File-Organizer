const DAY = 86400000;
const LARGE_BYTES = 500e6;

const SCREENSHOT_RE = /screenshot|screen shot/i;
const INVOICE_RE = /invoice|receipt/i;

// Friendly facts about a scanned folder: clutter score, biggest files and one-click suggestions.
export function computeInsights(files, { now = Date.now(), existingPresets = new Set() } = {}) {
  const total = files.length;
  const byCategory = {};
  let totalSize = 0;
  let oldCount = 0;
  let largeCount = 0;
  let screenshots = 0;
  let invoices = 0;
  let installers = 0;

  for (const f of files) {
    totalSize += f.size;
    byCategory[f.category] = byCategory[f.category] || { count: 0, size: 0 };
    byCategory[f.category].count += 1;
    byCategory[f.category].size += f.size;
    if (now - f.mtimeMs > 365 * DAY) oldCount += 1;
    if (f.size > LARGE_BYTES) largeCount += 1;
    if (SCREENSHOT_RE.test(f.name)) screenshots += 1;
    if (INVOICE_RE.test(f.name)) invoices += 1;
    if (f.ext === 'dmg' || f.ext === 'pkg') installers += 1;
  }

  const othersCount = byCategory.Others ? byCategory.Others.count : 0;
  const countPart = Math.min(50, Math.round(total / 4));
  const othersPart = total ? Math.round((25 * othersCount) / total) : 0;
  const oldPart = total ? Math.round((25 * oldCount) / total) : 0;
  const score = Math.max(0, Math.min(100, countPart + othersPart + oldPart));
  const level = score < 25 ? 'Tidy' : score < 55 ? 'Getting messy' : 'Cluttered';

  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 5);

  const tips = [];
  const add = (presetId, text) => {
    if (!existingPresets.has(presetId)) tips.push({ presetId, text });
  };
  if (screenshots > 0) add('screenshots', `${screenshots} screenshot${screenshots === 1 ? '' : 's'} found. Give them their own folder.`);
  if (invoices > 0) add('invoices', `${invoices} invoice or receipt file${invoices === 1 ? '' : 's'} found. Keep them together.`);
  if (installers > 0) add('installers', `${installers} installer${installers === 1 ? '' : 's'} (.dmg / .pkg) found. They are usually safe to tidy away.`);
  if (largeCount > 0) add('large', `${largeCount} file${largeCount === 1 ? ' is' : 's are'} over 500 MB. Group the big ones.`);
  if (oldCount >= 10) add('old', `${oldCount} files have not changed in over a year. Move them to an archive folder.`);

  return { total, totalSize, byCategory, largest, oldCount, largeCount, othersCount, score, level, tips };
}
