let currentFolder = '';
let scanData = null;

const $ = (s) => document.querySelector(s);
const btnScan = $('#btnScan');
const btnRefresh = $('#btnRefresh');
const folderInfo = $('#folderInfo');
const tableBody = $('#tableBody');
const statusEl = $('#status');

// ─── Init ──────────────────────────────────────────
if (window.zero) {
  window.zero.onScanStart((folder) => {
    folderInfo.textContent = '正在扫描 ' + folder + ' ...';
    statusEl.textContent = '⏳ 扫描中...';
  });

  window.zero.onScanResult((report) => {
    scanData = report;
    currentFolder = report.root;
    folderInfo.textContent = report.root;
    render(report);
  });

  window.zero.onScanError((err) => {
    statusEl.textContent = '❌ 扫描失败: ' + err;
  });
}

btnScan.addEventListener('click', async () => {
  const report = await window.zero.scanFolder();
  if (report && !report.error) {
    scanData = report;
    currentFolder = report.root;
    folderInfo.textContent = report.root;
    render(report);
  }
});

btnRefresh.addEventListener('click', async () => {
  if (!currentFolder) return;
  statusEl.textContent = '⏳ 刷新中...';
  const report = await window.zero.rescan(currentFolder);
  if (report && !report.error) {
    scanData = report;
    render(report);
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
      <td>
        <span class="badge badge-${f.health.level}"></span>
        ${esc(f.name)}
      </td>
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
