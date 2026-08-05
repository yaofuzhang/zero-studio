let scanData = null;
const $ = s => document.querySelector(s);
const API = 'http://localhost:8765';

// ─── Init ───────────────────────────────────────────
(async function init() {
  // Wait for server
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch(API + '/api/recent'); if (r.ok) break; } catch {}
    await new Promise(r => setTimeout(r, 300));
  }

  // Auto-scan recent folder
  try {
    const r = await fetch(API + '/api/scan-recent', { method: 'POST' });
    const d = await r.json();
    if (d && d.summary) {
      scanData = d;
      render(d);
      showDashboard();
    }
  } catch {}

  // Load recent list
  try {
    const r = await fetch(API + '/api/recent');
    const recent = await r.json();
    if (recent && recent.length > 0) {
      $('#recentSection').style.display = 'block';
      $('#recentList').innerHTML = recent.map(f => `
        <div class="recent-folder" onclick="doScan('${escAttr(f)}')">
          <span class="rf-icon">📁</span><span class="rf-path">${esc(f)}</span><span class="rf-arrow">→</span>
        </div>
      `).join('');
    }
  } catch {}
})();

// ─── Folder Picker: via server PowerShell ───────────
async function pickAndScan() {
  $('#pathText').textContent = '⏳ 打开文件夹选择器...';
  try {
    const r = await fetch(API + '/api/pick-folder', { method: 'POST' });
    const data = await r.json();
    if (data.folder) {
      doScan(data.folder);
    } else {
      $('#pathText').textContent = '选择文件夹开始分析';
    }
  } catch {
    $('#pathText').textContent = '❌ 服务连接失败';
  }
}

// ─── Scan ──────────────────────────────────────────
async function doScan(folder) {
  $('#pathText').textContent = '⏳ 扫描中...';
  showDashboard();
  try {
    const r = await fetch(API + '/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    });
    const report = await r.json();
    if (report.error) { $('#pathText').textContent = '❌ ' + report.error; return; }
    scanData = report;
    render(report);
  } catch {
    $('#pathText').textContent = '❌ 服务连接失败';
  }
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

  $('#scoreArc').setAttribute('stroke', color);
  $('#scoreArc').setAttribute('stroke-dasharray', Math.max(1, (s.avgScore / 100) * 314) + ' 314');
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
      <td class="r"><span class="s-${f.health.level}">${f.health.score}</span></td>
      <td class="r">${f.lines.total}</td>
      <td class="r">${f.complexity.average}</td>
      <td class="r">${f.todos || 0}</td>
    </tr>
  `).join('');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
