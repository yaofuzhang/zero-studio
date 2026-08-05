const $=s=>document.querySelector(s);
const API='http://localhost:8765';

(async function(){
  // Auto-scan recent
  try{const r=await fetch(API+'/api/scan-recent',{method:'POST'});const d=await r.json();if(d&&d.summary){render(d);showDashboard()}}catch(e){console.error(e)}

  // Recent list
  try{const r=await fetch(API+'/api/recent');const recent=await r.json();if(recent&&recent.length>0){$('#recentSection').style.display='block';$('#recentList').innerHTML=recent.map(f=>`<div class="recent-folder" data-folder="${escAttr(f)}"><span class="rf-icon">📁</span><span class="rf-path">${esc(f)}</span><span class="rf-arrow">→</span></div>`).join('');document.querySelectorAll('.recent-folder').forEach(el=>el.addEventListener('click',()=>doScan(el.dataset.folder)))}}catch(e){}
})();

$('#btnPick').addEventListener('click',pickAndScan);
$('#btnPickBig').addEventListener('click',pickAndScan);

async function pickAndScan(){
  try{const r=await fetch(API+'/api/pick-folder',{method:'POST'});const d=await r.json();if(d.folder)doScan(d.folder)}catch(e){alert('选择文件夹失败')}
}

async function doScan(folder){
  $('#pathText').textContent='⏳ 扫描中...';
  showDashboard();
  try{const r=await fetch(API+'/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder})});const d=await r.json();if(d.error){$('#pathText').textContent='❌ '+d.error;return};render(d)}catch(e){$('#pathText').textContent='❌ 服务连接失败'}  }

function showDashboard(){$('#welcome').classList.remove('active');$('#dashboard').classList.add('active')}

function render(report){
  const s=report.summary;
  let color,level;
  if(s.avg_score<40){color='#ef4444';level='需关注'}else if(s.avg_score<70){color='#eab308';level='一般'}else{color='#22c55e';level='健康'};
  $('#scoreArc').setAttribute('stroke',color);$('#scoreArc').setAttribute('stroke-dasharray',Math.max(1,(s.avg_score/100)*314)+' 314');
  $('#scoreValue').textContent=s.avg_score;$('#scoreValue').style.color=color;
  $('#scoreSub').textContent=level+' · '+s.total_files+' 文件 · '+s.total_lines.toLocaleString()+' 行';
  $('#pathText').textContent=report.root;
  $('#statGreen').textContent=s.green;$('#statYellow').textContent=s.yellow;$('#statRed').textContent=s.red;
  $('#statFiles').textContent=s.total_files;$('#statLines').textContent=s.total_lines.toLocaleString();$('#statTodos').textContent=s.total_todos;
  $('#fileBody').innerHTML=report.files.map(f=>
    `<tr><td><span class="file-dot ${f.level}"></span>${esc(f.name)}</td><td class="r"><span class="s-${f.level}">${f.score}</span></td><td class="r">${f.lines_total}</td><td class="r">${f.complexity_avg}</td><td class="r">${f.todos||0}</td></tr>`
  ).join('');
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function escAttr(s){return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
