const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { analyzeFolder } = require('./engine/analyzer');

const PORT = 8765;
const WWW = path.join(__dirname, 'www');
const RECENT_FILE = path.join(__dirname, '.recent.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// ─── Recent folders ────────────────────────────────
function loadRecent() {
  try { return JSON.parse(fs.readFileSync(RECENT_FILE, 'utf-8')); }
  catch { return []; }
}

function saveRecent(folder) {
  let list = loadRecent();
  list = [folder, ...list.filter(f => f !== folder)].slice(0, 10);
  fs.writeFileSync(RECENT_FILE, JSON.stringify(list));
}

// ─── Native folder picker (Windows) ─────────────────
function pickFolderWindows() {
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.Description = "选择要分析的项目文件夹"
    $f.ShowNewFolderButton = $false
    if ($f.ShowDialog() -eq "OK") { $f.SelectedPath }
  `;
  try {
    const result = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      windowsHide: true,
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

// ─── Server ─────────────────────────────────────────
const server = http.createServer((req, res) => {
  const sendJSON = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const readBody = () => new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });

  // GET /api/recent — 最近扫描的文件夹
  if (req.method === 'GET' && req.url === '/api/recent') {
    return sendJSON(200, loadRecent());
  }

  // POST /api/pick-folder — 原生文件夹选择器
  if (req.method === 'POST' && req.url === '/api/pick-folder') {
    const folder = pickFolderWindows();
    if (folder) {
      saveRecent(folder);
      return sendJSON(200, { folder });
    }
    return sendJSON(200, { folder: null });
  }

  // POST /api/scan — 扫描指定文件夹
  if (req.method === 'POST' && req.url === '/api/scan') {
    return readBody().then(body => {
      try {
        const { folder } = JSON.parse(body);
        if (!folder || !fs.existsSync(folder)) {
          return sendJSON(400, { error: '文件夹不存在' });
        }
        saveRecent(folder);
        const report = analyzeFolder(folder);
        sendJSON(200, report);
      } catch (e) {
        sendJSON(500, { error: e.message });
      }
    });
  }

  // POST /api/scan-recent — 扫描最近文件夹（启动时自动）
  if (req.method === 'POST' && req.url === '/api/scan-recent') {
    const recent = loadRecent();
    if (recent.length > 0 && fs.existsSync(recent[0])) {
      try {
        const report = analyzeFolder(recent[0]);
        return sendJSON(200, report);
      } catch (e) {
        return sendJSON(200, { error: e.message });
      }
    }
    return sendJSON(200, null);
  }

  // Static files
  let url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(WWW, url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ✅ Zero Studio 已启动`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  📂 选择文件夹即可开始\n`);
  const cmd = process.platform === 'win32'
    ? `start http://localhost:${PORT}`
    : process.platform === 'darwin' ? `open http://localhost:${PORT}` : `xdg-open http://localhost:${PORT}`;
  exec(cmd);
});
