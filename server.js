const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyzeFolder } = require('./engine/analyzer');

const PORT = 8765;
const WWW = path.join(__dirname, 'www');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // API
  if (req.method === 'POST' && req.url === '/api/scan') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { folder } = JSON.parse(body);
        const report = analyzeFolder(folder);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(report));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/analyze-file') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { filePath } = JSON.parse(body);
        const { analyzeFile } = require('./engine/analyzer');
        const report = analyzeFile(filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(report));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static files
  let url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(WWW, url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ✅ Zero Studio 已启动`);
  console.log(`  🌐 http://localhost:${PORT}\n`);
  // Auto-open browser
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32'
    ? `start http://localhost:${PORT}`
    : process.platform === 'darwin'
      ? `open http://localhost:${PORT}`
      : `xdg-open http://localhost:${PORT}`;
  exec(cmd);
  console.log('  按 Ctrl+C 退出\n');
});
