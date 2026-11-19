const { contextBridge, ipcRenderer, webUtils } = require('electron');

// The renderer gets a small, explicit API. It never receives ipcRenderer, fs, shell
// or any way to run commands or read arbitrary paths.
async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (!res || !res.ok) throw new Error((res && res.error) || 'Something went wrong.');
  return res.data;
}

contextBridge.exposeInMainWorld('dropsort', {
  getAppInfo: () => call('app:getInfo'),

  selectFolder: (purpose = 'source', startIn) => call('dialog:selectFolder', purpose, startIn),
  // A folder dragged onto the window: the path is read from the real dropped file here in the preload.
  dropFolder: (file) => {
    let droppedPath;
    try {
      droppedPath = webUtils.getPathForFile(file);
    } catch {
      return Promise.reject(new Error('That item could not be read. Try the Select Folder button instead.'));
    }
    return call('dialog:approveDropped', droppedPath);
  },
  scanFolder: (folderPath, options) => call('scan:start', folderPath, options),
  cancelJob: (jobId) => call('job:cancel', jobId),
  recategorizeScan: (scanId) => call('scan:recategorize', scanId),

  previewOrganization: (scanId, options) => call('preview:build', scanId, options),
  organize: (planId, options) => call('organize:run', planId, options),
  findDuplicates: (scanId, options) => call('duplicates:find', scanId, options),

  getHistory: (filters) => call('history:sessions', filters),
  getOperations: (sessionId, filters) => call('history:operations', sessionId, filters),
  undoOperation: (operationId) => call('history:undoOperation', operationId),
  undoSession: (sessionId) => call('history:undoSession', sessionId),
  getDashboard: () => call('dashboard:get'),

  getSettings: () => call('settings:get'),
  saveSettings: (data) => call('settings:save', data),

  exportCsv: (kind, id, options) => call('export:csv', kind, id, options),
  openPrivacySettings: (pane) => call('system:openPrivacySettings', pane),
  revealInFinder: (filePath) => call('shell:reveal', filePath),

  // Progress events (scan, duplicates, organize). Returns an unsubscribe function.
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('dropsort:progress', listener);
    return () => ipcRenderer.removeListener('dropsort:progress', listener);
  },
});
