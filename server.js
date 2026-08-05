const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { analyze } = require('./engine/analyzer');

const PORT = 8765;
const WWW = path.join(__dirname, 'www');
const RECENT_FILE = path.join(__dirname, '.recent.json');

const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const CODE_EXTS = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const SKIP = new Set(['node_modules','.git','dist','build','out','target','.next']);

// ─── Recent ────────────────────────────────────────
function loadRecent() { try { return JSON.parse(fs.readFileSync(RECENT_FILE,'utf-8')); } catch { return []; } }
function saveRecent(f) { let l=loadRecent(); l=[f,...l.filter(x=>x!==f)].slice(0,10); fs.writeFileSync(RECENT_FILE,JSON.stringify(l)); }

// ─── Folder picker ─────────────────────────────────
function pickFolder() {
  try {
    const ps = `Add-Type -AssemblyName System.Windows.Forms;$f=New-Object System.Windows.Forms.FolderBrowserDialog;$f.Description='选择项目文件夹';if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}`;
    return execSync(`powershell -NoProfile -Command "${ps.replace(/"/g,'\\"')}"`,{encoding:'utf8',windowsHide:true}).trim()||null;
  } catch { return null; }
}

// ─── Scanner ───────────────────────────────────────
function scanFolder(root) {
  const files = [];
  function walk(dir) {
    let e; try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of e) {
      if (d.name.startsWith('.') || SKIP.has(d.name)) continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) walk(full);
      else if (d.isFile() && CODE_EXTS.has(path.extname(d.name).toLowerCase())) {
        try {
          const code = fs.readFileSync(full, 'utf-8');
          const r = analyze(code);
          files.push({
            name: d.name, path: full,
            lines_total: r.lines.total, lines_code: r.lines.code, lines_comment: r.lines.comment, lines_blank: r.lines.blank,
            complexity_total: r.complexity.total, complexity_count: r.complexity.count, complexity_avg: r.complexity.average,
            todos: r.todoCount, score: r.health.score, level: r.health.level,
          });
        } catch {}
      }
    }
  }
  walk(root);
  files.sort((a,b) => a.score - b.score);
  return {
    root, files,
    summary: {
      total_files: files.length,
      green: files.filter(f=>f.level==='green').length,
      yellow: files.filter(f=>f.level==='yellow').length,
      red: files.filter(f=>f.level==='red').length,
      avg_score: files.length ? Math.round(files.reduce((s,f)=>s+f.score,0)/files.length) : 100,
      total_todos: files.reduce((s,f)=>s+f.todos,0),
      total_lines: files.reduce((s,f)=>s+f.lines_code,0),
    }
  };
}

// ─── Server ─────────────────────────────────────────
const server = http.createServer((req, res) => {
  const send = (code, data) => { res.writeHead(code,{'Content-Type':'application/json'}); res.end(JSON.stringify(data)); };

  if (req.method==='GET' && req.url==='/api/recent') return send(200, loadRecent());

  if (req.method==='POST' && req.url==='/api/pick-folder') {
    const f = pickFolder();
    return send(200, { folder: f });
  }

  if (req.method==='POST' && req.url==='/api/scan') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { folder } = JSON.parse(body);
        if (!folder || !fs.existsSync(folder)) return send(400, { error: '文件夹不存在' });
        saveRecent(folder);
        send(200, scanFolder(folder));
      } catch(e) { send(500, { error: e.message }); }
    });
    return;
  }

  if (req.method==='POST' && req.url==='/api/scan-recent') {
    const recent = loadRecent();
    if (recent.length > 0 && fs.existsSync(recent[0])) {
      return send(200, scanFolder(recent[0]));
    }
    return send(200, null);
  }

  // Static
  const url = req.url === '/' ? '/index.html' : req.url;
  const fp = path.join(WWW, url);
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ✅ Zero Studio 已启动`);
  console.log(`  🌐 http://localhost:${PORT}\n`);
  exec(`start http://localhost:${PORT}`);
});
