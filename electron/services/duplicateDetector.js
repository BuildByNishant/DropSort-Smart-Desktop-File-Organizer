const { hashFile } = require('./hash');
const { friendlyError } = require('./errors');

const slim = (f) => ({ id: f.id, name: f.name, path: f.path, size: f.size, mtimeMs: f.mtimeMs });

/**
 * Finds byte-identical files. File size is the cheap first filter; only files that share
 * a size are hashed (streamed, SHA-256). Files are exact duplicates only if hashes match.
 * Nothing is ever deleted.
 */
async function findDuplicates(files, { signal, onProgress } = {}) {
  const bySize = new Map();
  for (const file of files) {
    if (file.size === 0) continue; // empty files are not meaningful duplicates
    if (!bySize.has(file.size)) bySize.set(file.size, []);
    bySize.get(file.size).push(file);
  }

  const candidateGroups = [...bySize.values()].filter((g) => g.length > 1);
  const total = candidateGroups.reduce((n, g) => n + g.length, 0);
  let done = 0;
  const groups = [];
  const unverified = [];

  for (const group of candidateGroups) {
    const byHash = new Map();
    for (const file of group) {
      if (signal && signal.aborted) return { cancelled: true };
      try {
        const hash = await hashFile(file.path, { signal });
        if (!byHash.has(hash)) byHash.set(hash, []);
        byHash.get(hash).push(slim(file));
      } catch (err) {
        if (signal && signal.aborted) return { cancelled: true };
        // Could not hash: never label it a duplicate.
        unverified.push({ ...slim(file), error: friendlyError(err) });
      }
      done += 1;
      if (onProgress) onProgress({ done, total, currentName: file.name });
    }
    for (const [hash, list] of byHash) {
      if (list.length > 1) groups.push({ hash, size: list[0].size, files: list });
    }
  }

  const wasted = (g) => g.size * (g.files.length - 1);
  groups.sort((a, b) => wasted(b) - wasted(a));

  return {
    cancelled: false,
    groups,
    unverified,
    stats: {
      candidatesHashed: total,
      groupCount: groups.length,
      duplicateFiles: groups.reduce((n, g) => n + g.files.length - 1, 0),
      reclaimableBytes: groups.reduce((n, g) => n + wasted(g), 0),
    },
  };
}

module.exports = { findDuplicates };
