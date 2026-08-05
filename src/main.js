const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { analyzeFolder } = require('../engine/analyzer');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 720, minWidth: 800, minHeight: 500,
    title: 'Zero Studio', backgroundColor: '#0a0a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '../www/index.html'));
}

ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择项目文件夹' });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('scan-folder', async (_e, folder) => {
  try { return analyzeFolder(folder); } catch (e) { return { error: e.message }; }
});
ipcMain.handle('scan-and-save', async (_e, folder) => {
  try {
    saveRecent(folder);
    return analyzeFolder(folder);
  } catch (e) { return { error: e.message }; }
});
ipcMain.handle('get-recent', () => {
  const fs = require('fs');
  const rf = path.join(app.getPath('userData'), 'recent.json');
  try { return JSON.parse(fs.readFileSync(rf, 'utf-8')); } catch { return []; }
});

function saveRecent(folder) {
  const fs = require('fs');
  const rf = path.join(app.getPath('userData'), 'recent.json');
  let list = [];
  try { list = JSON.parse(fs.readFileSync(rf, 'utf-8')); } catch {}
  list = [folder, ...list.filter(f => f !== folder)].slice(0, 10);
  fs.writeFileSync(rf, JSON.stringify(list));
}

app.whenReady().then(() => {
  createWindow();
  const fs = require('fs');
  const rf = path.join(app.getPath('userData'), 'recent.json');
  let recent = [];
  try { recent = JSON.parse(fs.readFileSync(rf, 'utf-8')); } catch {}

  if (recent.length > 0) {
    try {
      const report = analyzeFolder(recent[0]);
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('init-data', { report, folder: recent[0], recent });
      });
    } catch {
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('init-data', { report: null, folder: null, recent });
      });
    }
  } else {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('init-data', { report: null, folder: null, recent });
    });
  }
});

app.on('window-all-closed', () => app.quit());
