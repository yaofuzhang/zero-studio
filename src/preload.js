const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zero', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  scanFolder: (folder) => ipcRenderer.invoke('scan-folder', folder),
  scanAndSave: (folder) => ipcRenderer.invoke('scan-and-save', folder),
  getRecent: () => ipcRenderer.invoke('get-recent'),
  onInitData: (callback) => {
    ipcRenderer.on('init-data', (_event, data) => callback(data));
  },
});
