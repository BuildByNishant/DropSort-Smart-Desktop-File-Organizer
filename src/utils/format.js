// Finder-style sizes (1 KB = 1000 bytes)
export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '-';
  if (bytes < 1000) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = -1;
  do {
    value /= 1000;
    i += 1;
  } while (value >= 1000 && i < units.length - 1);
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(value) {
  if (value == null) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function plural(n, singular, pluralForm) {
  return `${n.toLocaleString()} ${n === 1 ? singular : pluralForm || `${singular}s`}`;
}

// "/Users/me/Downloads/a/b" relative to "/Users/me/Downloads" -> "a/b"
export function relativeDir(dir, root) {
  if (!dir || !root || dir === root) return '';
  return dir.startsWith(root + '/') ? dir.slice(root.length + 1) : dir;
}

export function folderName(p) {
  if (!p) return '';
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] || p;
}
