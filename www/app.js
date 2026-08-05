var $=function(s){return document.querySelector(s)};
var API='http://localhost:8765';
var pathInput=$('#pathInput');

// Show status in a visible place
function status(msg, color){
  var el=$('#scanStatus');
  if(!el){
    el=document.createElement('div');
    el.id='scanStatus';
    el.style.cssText='text-align:center;padding:12px;font-size:13px;font-weight:500';
    var header=document.querySelector('header');
    header.parentNode.insertBefore(el, header.nextSibling);
  }
  el.textContent=msg;
  el.style.color=color||'#e4e4f0';
}

// Init: auto-scan recent
(async function(){
  try{
    var r=await fetch(API+'/api/scan-recent',{method:'POST'});
    var d=await r.json();
    if(d&&d.summary){showDashboard();render(d);pathInput.value=d.root}
  }catch(e){status('⚠️ 无法连接服务 — 请确认 start.bat 已运行','#fbbf24')}
  loadRecent();
})();

async function loadRecent(){
  try{
    var r=await fetch(API+'/api/recent');
    var recent=await r.json();
    if(recent&&recent.length>0){
      var sec=$('#recentSection');if(sec)sec.style.display='block';
      var list=$('#recentList');if(!list)return;
      list.innerHTML='';
      for(var i=0;i<recent.length;i++){
        var div=document.createElement('div');
        div.className='recent-folder';
        div.innerHTML='<span class="rf-icon">📁</span><span class="rf-path">'+esc(recent[i])+'</span><span class="rf-arrow">→</span>';
        div.onclick=(function(f){return function(){pathInput.value=f;doScan(f)}})(recent[i]);
        list.appendChild(div);
      }
    }
  }catch(e){}
}

$('#btnScan').onclick=function(){
  var f=pathInput.value.trim();
  if(f)doScan(f);
};

pathInput.onkeydown=function(e){
  if(e.key==='Enter'||e.keyCode===13){
    var f=pathInput.value.trim();
    if(f)doScan(f);
  }
};

function doScan(folder){
  status('⏳ 正在扫描 '+folder+' ...','#e4e4f0');
  showDashboard();
  pathInput.value=folder;
  fetch(API+'/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder:folder})})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){status('❌ '+d.error,'#ef4444');return}
      render(d);
      status('✅ 扫描完成 · '+d.summary.total_files+' 文件 · 健康度 '+d.summary.avg_score+'%','#22c55e');
      loadRecent();
    })
    .catch(function(e){status('❌ 请求失败: '+e.message,'#ef4444')});
}

function showDashboard(){$('#welcome').classList.remove('active');$('#dashboard').classList.add('active')}

function render(report){
  var s=report.summary;
  var color,level;
  if(s.avg_score<40){color='#ef4444';level='需关注'}
  else if(s.avg_score<70){color='#eab308';level='一般'}
  else{color='#22c55e';level='健康'}
  var arc=$('#scoreArc');arc.setAttribute('stroke',color);arc.setAttribute('stroke-dasharray',Math.max(1,(s.avg_score/100)*314)+' 314');
  var sv=$('#scoreValue');sv.textContent=s.avg_score;sv.style.color=color;
  $('#scoreSub').textContent=level+' · '+s.total_files+' 文件 · '+s.total_lines.toLocaleString()+' 行';
  $('#statGreen').textContent=s.green;$('#statYellow').textContent=s.yellow;$('#statRed').textContent=s.red;
  $('#statFiles').textContent=s.total_files;$('#statLines').textContent=s.total_lines.toLocaleString();$('#statTodos').textContent=s.total_todos;
  var body=$('#fileBody');
  body.innerHTML='';
  for(var i=0;i<report.files.length;i++){
    var f=report.files[i];
    var tr=document.createElement('tr');
    tr.innerHTML='<td><span class="file-dot '+f.level+'"></span>'+esc(f.name)+'</td><td class="r"><span class="s-'+f.level+'">'+f.score+'</span></td><td class="r">'+f.lines_total+'</td><td class="r">'+f.complexity_avg+'</td><td class="r">'+(f.todos||0)+'</td>';
    body.appendChild(tr);
  }
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
