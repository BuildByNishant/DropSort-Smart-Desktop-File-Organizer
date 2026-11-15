const fs = require('fs');
const os = require('os');
const path = require('path');

function makeTempDir(prefix = 'dropsort-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function write(dir, name, content = 'x', mtime) {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  if (mtime) fs.utimesSync(p, mtime, mtime);
  return p;
}
const exists = (p) => fs.existsSync(p);

// Returns an in-memory database, or null when better-sqlite3 was rebuilt for Electron
// (then `npm test` cannot load it under plain Node and those tests are skipped).
function tryOpenMemoryDb() {
  try {
    return require('../electron/database/db').openDatabase(':memory:');
  } catch {
    return null;
  }
}

// A minimal stand-in for Electron so IPC handlers can be tested without a window.
function fakeElectron({ pickQueue = [], saveQueue = [] } = {}) {
  const handlers = new Map();
  const sent = [];
  const sender = { send: (channel, payload) => sent.push({ channel, payload }), isDestroyed: () => false };
  return {
    handlers, sent,
    electron: {
      ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
      dialog: {
        showOpenDialog: async () => {
          const next = pickQueue.shift();
          return next ? { canceled: false, filePaths: [next] } : { canceled: true, filePaths: [] };
        },
        showSaveDialog: async () => {
          const next = saveQueue.shift();
          return next ? { canceled: false, filePath: next } : { canceled: true };
        },
      },
      shell: {
        showItemInFolder: (p) => sent.push({ channel: 'reveal', payload: p }),
        openExternal: async (u) => sent.push({ channel: 'openExternal', payload: u }),
      },
      BrowserWindow: { fromWebContents: () => null },
      app: { getName: () => 'DropSort', getVersion: () => '1.0.0', getPath: (n) => os.tmpdir() + '/' + n },
    },
    call: async (channel, ...args) => handlers.get(channel)({ sender }, ...args),
  };
}

module.exports = { makeTempDir, write, exists, tryOpenMemoryDb, fakeElectron };
