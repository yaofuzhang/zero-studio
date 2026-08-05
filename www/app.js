const $=s=>document.querySelector(s);
const API='http://localhost:8765';
const pathInput=$('#pathInput');

// ─── Init: auto-scan recent ────────────────────────
(async function(){
  try{
    const r=await fetch(API+'/api/scan-recent',{method:'POST'});
    const d=await r.json();
    if(d&&d.summary){
      showDashboard();
      render(d);
      pathInput.value=d.root;
    }
  }catch(e){}
  loadRecent();
})();

async function loadRecent(){
  try{
    const r=await fetch(API+'/api/recent');
    const recent=await r.json();
    if(recent&&recent.length>0){
      $('#recentSection').style.display='block';
      $('#recentList').innerHTML=recent.map(f=>
        `<div class="recent-folder" data-folder="${escAttr(f)}">
          <span class="rf-icon">📁</span><span class="rf-path">${esc(f)}</span><span class="rf-arrow">→</span>
        </div>`
      ).join('');
      document.querySelectorAll('.recent-folder').forEach(el=>
        el.addEventListener('click',()=>{
          pathInput.value=el.dataset.folder;
          doScan(el.dataset.folder);
        })
      );
    }
  }catch(e){}
}

// ─── Scan ──────────────────────────────────────────
$('#btnScan').addEventListener('click',()=>{
  const folder=pathInput.value.trim();
  if(folder)doScan(folder);
});

pathInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const folder=pathInput.value.trim();
    if(folder)doScan(folder);
  }
});

async function doScan(folder){
  showDashboard();
  pathInput.value=folder;
  try{
    const r=await fetch(API+'/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder})});
    const d=await r.json();
    if(d.error)return;
    render(d);
    loadRecent();
  }catch(e){}
}

function showDashboard(){$('#welcome').classList.remove('active');$('#dashboard').classList.add('active')}

function render(report){
  const s=report.summary;
  let color,level;
  if(s.avg_score<40){color='#ef4444';level='需关注'}
  else if(s.avg_score<70){color='#eab308';level='一般'}
  else{color='#22c55e';level='健康'}
  $('#scoreArc').setAttribute('stroke',color);
  $('#scoreArc').setAttribute('stroke-dasharray',Math.max(1,(s.avg_score/100)*314)+' 314');
  $('#scoreValue').textContent=s.avg_score;$('#scoreValue').style.color=color;
  $('#scoreSub').textContent=level+' · '+s.total_files+' 文件 · '+s.total_lines.toLocaleString()+' 行';
  $('#statGreen').textContent=s.green;$('#statYellow').textContent=s.yellow;$('#statRed').textContent=s.red;
  $('#statFiles').textContent=s.total_files;$('#statLines').textContent=s.total_lines.toLocaleString();$('#statTodos').textContent=s.total_todos;
  $('#fileBody').innerHTML=report.files.map(f=>
    `<tr><td><span class="file-dot ${f.level}"></span>${esc(f.name)}</td><td class="r"><span class="s-${f.level}">${f.score}</span></td><td class="r">${f.lines_total}</td><td class="r">${f.complexity_avg}</td><td class="r">${f.todos||0}</td></tr>`
  ).join('');
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function escAttr(s){return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
