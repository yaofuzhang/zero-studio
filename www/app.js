let scanData = null;
let currentFolder = '';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ─── API ───────────────────────────────────────────
async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── Pick folder (native dialog) ───────────────────
async function pickAndScan() {
  const result = await api('/api/pick-folder');
  if (result.folder) {
    doScan(result.folder);
  }
}

// ─── Scan folder ───────────────────────────────────
async function doScan(folder) {
  currentFolder = folder;
  $('#pathText').textContent = folder;
  $('#welcome').classList.remove('active');
  $('#dashboard').classList.add('active');

  const report = await api('/api/scan', { folder });
  if (report.error) {
    $('#pathText').textContent = '❌ ' + report.error;
    return;
  }
  scanData = report;
  render(report);
}

// ─── Buttons ───────────────────────────────────────
$('#btnPick').addEventListener('click', pickAndScan);
$('#btnPickBig').addEventListener('click', pickAndScan);

// ─── Load recent + auto-scan ───────────────────────
async function init() {
  const recent = await api('/api/recent');
  if (recent && recent.length > 0) {
    // Show recent folders
    $('#recentSection').style.display = 'block';
    $('#recentList').innerHTML = recent.map(f => `
      <div class="recent-folder" onclick="doScan('${escAttr(f)}')">
        <span class="rf-icon">📁</span>
        <span class="rf-path">${esc(f)}</span>
        <span class="rf-arrow">→</span>
      </div>
    `).join('');
  }

  // Auto-scan most recent
  const initial = await api('/api/scan-recent');
  if (initial && !initial.error && initial.summary) {
    currentFolder = initial.root;
    scanData = initial;
    $('#pathText').textContent = initial.root;
    $('#welcome').classList.remove('active');
    $('#dashboard').classList.add('active');
    render(initial);
  }
}

// ─── Render ────────────────────────────────────────
function render(report) {
  const s = report.summary;

  // Ring
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

  // Stats
  $('#statGreen').textContent = s.greens;
  $('#statYellow').textContent = s.yellows;
  $('#statRed').textContent = s.reds;
  $('#statFiles').textContent = s.total;
  $('#statLines').textContent = s.totalLines.toLocaleString();
  $('#statTodos').textContent = s.totalTodos;

  // Table
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

// ─── Helpers ───────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function escAttr(s) {
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Start ─────────────────────────────────────────
init();
