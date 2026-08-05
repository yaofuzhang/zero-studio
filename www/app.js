let currentFolder = '';
let scanData = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── API ───────────────────────────────────────────
async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function doScan(folder) {
  currentFolder = folder;
  $('#tbPath').textContent = '⏳ 扫描中...';
  const report = await api('/api/scan', { folder });
  if (report.error) {
    $('#tbPath').textContent = '❌ ' + report.error;
    return;
  }
  scanData = report;
  $('#tbPath').textContent = folder;
  renderAll(report);
}

// ─── Sidebar Navigation ────────────────────────────
$$('.sb-item[data-view]').forEach(el => {
  el.addEventListener('click', () => {
    $$('.sb-item[data-view]').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    const view = el.dataset.view;
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
    if (scanData) updateView(view);
  });
});

// ─── Folder Picker ─────────────────────────────────
$('#btnPick').addEventListener('click', async () => {
  const folder = prompt('输入文件夹路径（或拖拽文件夹到窗口）:', currentFolder || '');
  if (folder && folder.trim()) doScan(folder.trim());
});

$('#btnRefresh').addEventListener('click', () => {
  if (currentFolder) doScan(currentFolder);
});

// ─── Drag & Drop ───────────────────────────────────
const dropZone = $('#dropZone');
dropZone.addEventListener('click', () => {
  const folder = prompt('输入文件夹路径:', currentFolder || '');
  if (folder && folder.trim()) doScan(folder.trim());
});

document.addEventListener('dragover', e => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
});

document.addEventListener('dragleave', e => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
});

document.addEventListener('drop', e => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');

  // 尝试从拖放获取路径
  const items = e.dataTransfer.items;
  if (items) {
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // 从 file 对象获取路径 (仅 Windows 有效)
          const file = item.getAsFile();
          if (file && file.path) {
            // file.path 在 Electron 中可用，浏览器中可能需要手动输入
          }
        }
      }
    }
  }

  // 浏览器安全限制：提示用户手动输入路径
  const hint = prompt('浏览器安全限制，请输入拖拽的文件夹路径:', '');
  if (hint && hint.trim()) doScan(hint.trim());
});

// ─── Render All ────────────────────────────────────
function renderAll(report) {
  const s = report.summary;
  // 隐藏拖放区
  dropZone.classList.remove('active');
  $('#riskSection').style.display = 'block';

  // 评分环形图
  let color;
  if (s.avgScore < 40) color = '#ef4444';
  else if (s.avgScore < 70) color = '#eab308';
  else color = '#22c55e';

  const dash = (s.avgScore / 100) * 327;
  $('#scoreArc').setAttribute('stroke', color);
  $('#scoreArc').setAttribute('stroke-dasharray', dash + ' 327');
  $('#scoreValue').textContent = s.avgScore + '%';
  $('#scoreValue').style.color = color;
  $('#scoreSub').textContent = s.total + ' 个文件 · ' + s.totalLines.toLocaleString() + ' 行代码';

  // 统计卡片
  $('#statFiles').textContent = s.total;
  $('#statGreen').textContent = s.greens;
  $('#statYellow').textContent = s.yellows;
  $('#statRed').textContent = s.reds;
  $('#statTodos').textContent = s.totalTodos;
  $('#statLines').textContent = s.totalLines.toLocaleString();

  // 高风险列表
  const risks = report.files.filter(f => f.health.level !== 'green');
  if (risks.length === 0) {
    $('#riskList').innerHTML = '<div class="risk-item"><span style="color:var(--green);font-size:14px">✅ 所有文件健康度良好</span></div>';
  } else {
    $('#riskList').innerHTML = risks.slice(0, 10).map(f => `
      <div class="risk-item">
        <div class="ri-score ${f.health.level}">${f.health.score}</div>
        <div class="ri-info">
          <div class="ri-name" title="${f.path}">${f.name}</div>
          <div class="ri-meta">${f.lines.total} 行 · CCN ${f.complexity.average} · ${f.complexity.count} 函数 · ${f.todos} TODO</div>
        </div>
      </div>
    `).join('');
  }

  // 文件表格
  $('#fileBody').innerHTML = report.files.map(f => `
    <tr>
      <td><span class="file-dot ${f.health.level}"></span>${esc(f.name)}</td>
      <td>${f.lines.total}</td>
      <td>${f.complexity.average}</td>
      <td>${f.complexity.count}</td>
      <td>${f.todos}</td>
      <td><span style="color:${f.health.level === 'red' ? '#ef4444' : f.health.level === 'yellow' ? '#eab308' : '#22c55e'};font-weight:600">${f.health.score}</span></td>
    </tr>
  `).join('');

  // TODO 视图
  updateTodoView(report);
}

function updateView(view) {
  if (!scanData) return;
  if (view === 'todos') updateTodoView(scanData);
}

function updateTodoView(report) {
  // 收集所有 TODO
  // TODO items aren't currently stored per-file in the report - we'd need to add that
  // For now, show a summary
  $('#todoSummary').innerHTML = '<div class="todo-chip"><span style="color:var(--muted)">此功能需要扫描引擎升级 v1.1</span></div>';
  $('#todoList').innerHTML = '';
}

// ─── Helpers ───────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Add file-dot style dynamically
const style = document.createElement('style');
style.textContent = `
  .file-dot { display:inline-block; width:6px; height:6px; border-radius:50%; margin-right:8px; }
  .file-dot.red { background:#ef4444; } .file-dot.yellow { background:#eab308; } .file-dot.green { background:#22c55e; }
`;
document.head.appendChild(style);
