const { app, BrowserWindow, dialog, nativeTheme, session } = require('electron');
const path = require('path');
const { openDatabase } = require('./database/db');
const { registerIpcHandlers } = require('./ipc/handlers');

const DEV_URL = 'http://127.0.0.1:5173';
const useDevServer = !app.isPackaged && process.env.DROPSORT_DEV === '1';

let db = null;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'DropSort',
    titleBarStyle: 'hiddenInset', // native macOS look
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#f5f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // renderer is isolated from Electron/Node internals
      nodeIntegration: false, // renderer has NO direct Node.js access
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Keep the app on its own pages: no pop-ups, no navigating away.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = useDevServer ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  if (useDevServer) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit(); // two copies would write to the same database
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

    try {
      db = openDatabase(path.join(app.getPath('userData'), 'dropsort.db'));
    } catch (err) {
      dialog.showErrorBox('DropSort could not start', `The local database could not be opened.\n\n${err.message}`);
      app.quit();
      return;
    }

    registerIpcHandlers({ electron: require('electron'), db });
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    try {
      if (db) db.close();
    } catch {
      /* ignore */
    }
  });
}
