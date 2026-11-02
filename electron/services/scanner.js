const fs = require('fs');
const path = require('path');
const { normalizeExtension } = require('./categorizer');
const { friendlyError } = require('./errors');

// Files that are still being written by a browser or other app.
const IN_PROGRESS_EXTENSIONS = new Set(['crdownload', 'part', 'download', 'opdownload', 'partial']);
// macOS bundles are folders that behave like single files; never descend into them.
const PACKAGE_DIR_EXTENSIONS = new Set([
  '.app', '.bundle', '.framework', '.photoslibrary', '.xcodeproj', '.xcworkspace',
  '.rtfd', '.musiclibrary', '.fcpbundle', '.imovielibrary',
]);
const ALWAYS_SKIP_NAMES = new Set(['.DS_Store', '.localized', '.Spotlight-V100', '.Trashes', '.fseventsd']);
const SKIP_DIR_NAMES = new Set(['node_modules']);

/**
 * Scans a folder and returns file metadata. Does not modify anything.
 * - Immediate contents only unless `recursive` is true.
 * - Directories, symbolic links and unreadable items are skipped (and reported).
 * - Cancellable through an AbortSignal; reports progress through onProgress.
 */
async function scanFolder(root, options = {}) {
  const { recursive = false, includeHidden = false, signal, onProgress } = options;

  const rootStat = await fs.promises.stat(root);
  if (!rootStat.isDirectory()) throw new Error('The selected path is not a folder.');

  const files = [];
  const skipped = [];
  let hiddenIgnored = 0;
  let nextId = 1;
  const stack = [root];

  while (stack.length > 0) {
    if (signal && signal.aborted) return { cancelled: true };
    const dir = stack.pop();

    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (dir === root) throw err; // the folder itself is unreadable: surface it
      skipped.push({ path: dir, reason: friendlyError(err) });
      continue;
    }

    for (const entry of entries) {
      if (signal && signal.aborted) return { cancelled: true };
      const name = entry.name;
      const full = path.join(dir, name);

      if (ALWAYS_SKIP_NAMES.has(name)) continue;
      if (!includeHidden && name.startsWith('.')) {
        hiddenIgnored += 1;
        continue;
      }
      if (entry.isSymbolicLink()) {
        skipped.push({ path: full, reason: 'Symbolic link (skipped for safety)' });
        continue;
      }
      if (entry.isDirectory()) {
        if (!recursive) continue;
        if (SKIP_DIR_NAMES.has(name) || PACKAGE_DIR_EXTENSIONS.has(path.extname(name).toLowerCase())) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) {
        skipped.push({ path: full, reason: 'Not a regular file' });
        continue;
      }

      const ext = normalizeExtension(path.extname(name));
      if (IN_PROGRESS_EXTENSIONS.has(ext)) {
        skipped.push({ path: full, reason: 'Download in progress' });
        continue;
      }

      let stat;
      try {
        stat = await fs.promises.lstat(full);
      } catch (err) {
        skipped.push({ path: full, reason: friendlyError(err) });
        continue;
      }

      files.push({
        id: nextId++,
        name,
        ext,
        path: full,
        dir,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        birthtimeMs: stat.birthtimeMs,
      });

      if (onProgress && files.length % 25 === 0) onProgress({ filesFound: files.length, currentDir: dir });
    }
  }

  if (onProgress) onProgress({ filesFound: files.length, currentDir: root });
  return { cancelled: false, files, skipped, hiddenIgnored };
}

module.exports = { scanFolder };
