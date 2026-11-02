const fs = require('fs');
const crypto = require('crypto');

// Streams a file through SHA-256 so large files are never loaded into memory.
function hashFile(filePath, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });

    const onAbort = () => {
      stream.destroy(Object.assign(new Error('Cancelled'), { code: 'ABORT_ERR' }));
    };
    const cleanup = () => signal && signal.removeEventListener('abort', onAbort);

    if (signal) {
      if (signal.aborted) {
        stream.destroy();
        return reject(Object.assign(new Error('Cancelled'), { code: 'ABORT_ERR' }));
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', (err) => {
      cleanup();
      reject(err);
    });
    stream.on('end', () => {
      cleanup();
      resolve(hash.digest('hex'));
    });
  });
}

module.exports = { hashFile };
