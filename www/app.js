let currentFolder = '';
let scanData = null;

const $ = (s) => document.querySelector(s);
const btnScan = $('#btnScan');
const btnRefresh = $('#btnRefresh');
const pathInput = $('#pathInput');
const folderInfo = $('#folderInfo');
const tableBody = $('#tableBody');
const statusEl = $('#status');

// ─── API ───────────────────────────────────────────
async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function doScan(folder) {
  currentFolder = folder;
  folderInfo.textContent = '⏳ 扫描中...';
  statusEl.textContent = '⏳ 正在扫描 ' + folder + ' ...';
  const report = await api('/api/scan', { folder });
  if (report.error) {
    statusEl.textContent = '❌ ' + report.error;
    return;
  }
  scanData = report;
  folderInfo.textContent = folder;
  render(report);
}

// ─── Events ────────────────────────────────────────
btnScan.addEventListener('click', () => {
  const folder = pathInput.value.trim();
  if (!folder) { statusEl.textContent = '请输入文件夹路径'; return; }
  doScan(folder);
});

btnRefresh.addEventListener('click', () => {
  if (!currentFolder) { statusEl.textContent = '请先扫描一个文件夹'; return; }
  doScan(currentFolder);
});

pathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const folder = pathInput.value.trim();
    if (folder) doScan(folder);
  }
});

// 拖拽文件夹
document.addEventListener('dragover', (e) => { e.preventDefault(); });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const items = e.dataTransfer.items;
  if (items && items[0]) {
    const entry = items[0].webkitGetAsEntry();
    if (entry && entry.isDirectory) {
      // webkitGetAsEntry 返回的路径在 Windows 上不完整
      // 使用 dataTransfer.files 获取路径
    }
  }
  // Fallback: 从文件路径推断文件夹
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    // 获取文件夹路径（跨浏览器兼容性差）
    statusEl.textContent = '请将文件夹路径粘贴到输入框中';
  }
});

// ─── Render ────────────────────────────────────────
function render(report) {
  const s = report.summary;
  $('#sTotal').textContent = s.total;
  $('#sGreen').textContent = s.greens;
  $('#sYellow').textContent = s.yellows;
  $('#sRed').textContent = s.reds;
  $('#sScore').textContent = s.avgScore + '%';
  $('#sTodos').textContent = s.totalTodos;
  $('#sLines').textContent = s.totalLines.toLocaleString();
  statusEl.textContent = `✅ 共 ${s.total} 个文件 · ${s.greens} 健康 · ${s.yellows} 中风险 · ${s.reds} 高风险`;

  if (report.files.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="empty"><h2>未发现代码文件</h2><p>请选择包含 .ts/.js 文件的文件夹</p></td></tr>';
    return;
  }

  tableBody.innerHTML = report.files.map((f, i) => `
    <tr onclick="showDetail(${i})">
      <td><span class="badge badge-${f.health.level}"></span>${esc(f.name)}</td>
      <td><span class="score-num score-${f.health.level}">${f.health.score}</span></td>
      <td>${f.lines.total}</td>
      <td>${f.complexity.average}</td>
      <td>${f.complexity.count}</td>
      <td>${f.todos}</td>
    </tr>
  `).join('');
}

function showDetail(i) {
  const f = scanData.files[i];
  if (!f) return;
  const funcs = f.complexity.perFunction
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 5)
    .map(fn => `  ${fn.name}: CCN ${fn.complexity} (L${fn.line})`)
    .join('\n');

  const msg = [
    `📄 ${f.name}`,
    `📏 行数: ${f.lines.total} (代码 ${f.lines.code} · 注释 ${f.lines.comment})`,
    `🔄 圈复杂度: 总计 ${f.complexity.total} · 平均 ${f.complexity.average} · ${f.complexity.count} 函数`,
    `🏷️ TODO: ${f.todos}`,
    `❤️ 健康评分: ${f.health.score}/100`,
    funcs ? `\n高复杂度函数:\n${funcs}` : '',
  ].join('\n');
  alert(msg);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
