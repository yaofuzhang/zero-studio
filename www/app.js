let scanData = null;
const $ = s => document.querySelector(s);
const API = 'http://localhost:8765';

// Wait for Neutralino
Neutralino.init();

Neutralino.events.on('ready', async () => {
  // Launch Node.js server
  try {
    await Neutralino.os.execCommand('node server.js', { cwd: '../' });
  } catch {}

  // Give server a moment to start, then auto-scan
  setTimeout(async () => {
    try {
      const res = await fetch(API + '/api/scan-recent', { method: 'POST' });
      const data = await res.json();
      if (data && data.summary) {
        scanData = data;
        showDashboard();
        render(data);
      }
      loadRecent();
    } catch {}
  }, 1500);
});

// ─── Pick folder (native dialog) ───────────────────
async function pickAndScan() {
  try {
    const entries = await Neutralino.dialog.showOpenDialog('选择项目文件夹', {
      defaultPath: 'C:/Users',
    });
    if (entries && entries.length > 0) {
      doScan(entries[0]);
    }
  } catch {
    // Fallback: manual input
    const folder = prompt('输入文件夹路径:');
    if (folder) doScan(folder);
  }
}

async function doScan(folder) {
  $('#pathText').textContent = folder;
  showDashboard();
  try {
    const res = await fetch(API + '/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    });
    const report = await res.json();
    if (report.error) { $('#pathText').textContent = '❌ ' + report.error; return; }
    scanData = report;
    render(report);
  } catch {
    $('#pathText').textContent = '❌ 服务未启动，请运行 node server.js';
  }
}

// ─── Recent ────────────────────────────────────────
async function loadRecent() {
  try {
    const res = await fetch(API + '/api/recent');
    const recent = await res.json();
    if (recent && recent.length > 0) {
      $('#recentSection').style.display = 'block';
      $('#recentList').innerHTML = recent.map(f => `
        <div class="recent-folder" onclick="doScan('${escAttr(f)}')">
          <span class="rf-icon">📁</span>
          <span class="rf-path">${esc(f)}</span>
          <span class="rf-arrow">→</span>
        </div>
      `).join('');
    }
  } catch {}
}

// ─── UI ────────────────────────────────────────────
function showDashboard() {
  $('#welcome').classList.remove('active');
  $('#dashboard').classList.add('active');
}

$('#btnPick').addEventListener('click', pickAndScan);
$('#btnPickBig').addEventListener('click', pickAndScan);

function render(report) {
  const s = report.summary;
  let color, level;
  if (s.avgScore < 40) { color = '#ef4444'; level = '需关注'; }
  else if (s.avgScore < 70) { color = '#eab308'; level = '一般'; }
  else { color = '#22c55e'; level = '健康'; }

  const dash = Math.max(1, (s.avgScore / 100) * 314);
  $('#scoreArc').setAttribute('stroke', color);
  $('#scoreArc').setAttribute('stroke-dasharray', dash + ' 314');
  $('#scoreValue').textContent = s.avgScore;
  $('#scoreValue').style.color = color;
  $('#scoreSub').textContent = level + ' · ' + s.total + ' 文件 · ' + s.totalLines.toLocaleString() + ' 行';
  $('#pathText').textContent = report.root;

  $('#statGreen').textContent = s.greens;
  $('#statYellow').textContent = s.yellows;
  $('#statRed').textContent = s.reds;
  $('#statFiles').textContent = s.total;
  $('#statLines').textContent = s.totalLines.toLocaleString();
  $('#statTodos').textContent = s.totalTodos;

  $('#fileBody').innerHTML = report.files.map(f => `
    <tr>
      <td><span class="file-dot ${f.health.level}"></span>${esc(f.name)}</td>
      <td class="r"><span style="color:${f.health.level==='red'?'#ef4444':f.health.level==='yellow'?'#eab308':'#22c55e'};font-weight:600">${f.health.score}</span></td>
      <td class="r">${f.lines.total}</td>
      <td class="r">${f.complexity.average}</td>
      <td class="r">${f.todos || 0}</td>
    </tr>
  `).join('');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
