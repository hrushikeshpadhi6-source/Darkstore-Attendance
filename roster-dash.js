// ═══ Darkstore Roster Pro — manager dashboard, stores, exports ═══
const MG={loaded:null,last:null,detail:null,tab:'ov'};
function mgTab(t){
  MG.tab=t;document.querySelectorAll('#mgTabs .tab').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  const P={ov:'mgPaneOv',an:'mgPaneAn',hr:'mgPaneHr',ot:'mgPaneOt',emp:'mgPaneEmp',st:'mgPaneSt'};
  Object.entries(P).forEach(([k,id])=>document.getElementById(id).hidden=k!==t);
  document.getElementById('mgFilterCard').hidden=!(t==='ov'||t==='an'||t==='hr');
  ['mgFrom','mgTo'].forEach(id=>{const e=document.getElementById(id);if(t==='hr')e.removeAttribute('max');else{e.max=todayIso();if(e.value>e.max)e.value=e.max;}});
  if(t==='hr'&&window.hrEnter)hrEnter();
  if(t==='emp')renderEmployees('mgPaneEmp',null);else if(t==='ot')otEnter();else renderMgr();
}

async function openMgr(){
  SESSION={type:'mgr'};sessionStorage.setItem('rp_session',JSON.stringify(SESSION));
  show('scr-mgr');
  const t=todayIso();
  ['mgFrom','mgTo'].forEach(id=>{const e=document.getElementById(id);e.value=t;e.max=t;e.onchange=mgChange;});
  fillMgrStores();
  document.getElementById('mgMonth').value=t.slice(0,7);
  document.getElementById('mgSite').onchange=renderMgr;document.getElementById('mgRole').onchange=renderMgr;
  document.getElementById('mgKpi').innerHTML='<div class="loading"><span class="spin"></span></div>';
  const lf=addDays(t,-35);
  await Promise.all([loadRosters(lf,addDays(t,45)),loadDays(lf,t),loadEmps()]);
  MG.loaded={from:lf,to:t};
  await backfillEmps();
  const rr=()=>{if(MG.tab==='ot')renderOt();else renderMgr();};
  window._unsubs=[listenRosters(lf,addDays(t,45),rr),listenDays(lf,t,rr),listenEmps(()=>{if(MG.tab==='emp')renderEmployees('mgPaneEmp',null);else if(MG.tab==='ot')renderOt();else renderHeadcount();})];
  rr();
  if(RD.err) document.getElementById('mgWarn').insertAdjacentHTML('afterbegin','<div class="note bad"><b>Could not load data:</b> '+esc(RD.err)+'</div>');
}
function fillMgrStores(){
  const s=document.getElementById('mgSite'),cur=s.value;
  s.innerHTML='<option value="">All stores</option>'+storeList().map(c=>'<option value="'+esc(c)+'"'+(c===cur?' selected':'')+'>'+esc(storeLabel(c))+'</option>').join('');
}
async function mgChange(){
  const f=document.getElementById('mgFrom'),t=document.getElementById('mgTo');
  if(t.value<f.value) t.value=f.value;
  if(f.value<MG.loaded.from){
    document.getElementById('mgKpi').innerHTML='<div class="loading"><span class="spin"></span> Loading older data…</div>';
    await Promise.all([loadRosters(f.value,MG.loaded.from),loadDays(f.value,MG.loaded.from)]);
    MG.loaded.from=f.value;
  }
  renderMgr();
}
function mgQuick(k){
  const t=todayIso();let a=t,b=t;
  if(k===-1){a=b=addDays(t,-1);}else if(k==='w'){a=addDays(t,-((dOf(t).getDay()+6)%7));}else if(k==='m'){a=t.slice(0,8)+'01';}
  document.getElementById('mgFrom').value=a;document.getElementById('mgTo').value=b;mgChange();
}
function roleOk(p,role){if(!role)return true;if(role==='Lead')return p.role==='Supervisor'||p.role==='Team Leader';return p.role===role;}

function computeMgr(f,t){
  const from=f||document.getElementById('mgFrom').value,to=t||document.getElementById('mgTo').value;
  const fs=document.getElementById('mgSite').value,role=document.getElementById('mgRole').value;
  const stores=fs?[fs]:storeList(),dates=rangeDates(from,to>todayIso()?todayIso():to);
  const recs=[],store={};
  stores.forEach(code=>{
    const s=store[code]={code,site:siteOf(code),days:0,conf:0,people:[]};
    dates.forEach(d=>{
      const r=dayPeople(code,d);if(!r.hasRoster)return;
      s.days++;if(r.confirmed)s.conf++;s.sd=(s.sd||0)+r.done.length;s.st=(s.st||0)+r.shifts.length;
      r.people.filter(p=>roleOk(p,role)).forEach(p=>{const x=Object.assign({},p,{store:code,site:s.site,date:d,confirmed:!!p.confirmed});recs.push(x);if(x.confirmed)s.people.push(x);});
    });
  });
  return {from,to,stores,dates,recs,conf:recs.filter(r=>r.confirmed),store,role};
}
const THEAD='<th class="n">Total</th><th class="n">WO</th><th class="n">Rostered</th><th class="n">Present</th><th class="n">Absent</th><th class="n">Sick</th><th class="n">Absenteeism</th>';
function tcells(t){return '<td class="n">'+t.total+'</td><td class="n wo">'+t.weekOff+'</td><td class="n">'+t.rostered+'</td><td class="n ok">'+t.present+'</td><td class="n bad">'+t.absent+'</td><td class="n sick">'+t.sick+'</td><td class="n'+(t.absPct>=10?' abs-hi':'')+'">'+(t.rostered?pctTxt(t.absPct):'—')+'</td>';}

function renderMgr(){
  if(!SESSION||SESSION.type!=='mgr') return;
  const c=MG.last=computeMgr(),single=c.from===c.to,today=todayIso(),tmr=addDays(today,1);
  document.getElementById('mgSub').textContent=(single?fmtDate(c.from):fmtDate(c.from,{day:'numeric',month:'short'})+' – '+fmtDate(c.to))+' · '+(c.stores.length===1?storeLabel(c.stores[0]):c.stores.length+' stores');
  const all=storeList(),noT=all.filter(s=>!getRoster(s,today)),noTm=all.filter(s=>!getRoster(s,tmr)),notConf=all.filter(s=>getRoster(s,today)&&!dayPeople(s,today).confirmed).map(s=>{const r=dayPeople(s,today),p=r.shifts.filter(x=>!r.done.includes(x)).map(x=>SHIFT_LBL[x]);return s+(r.done.length?' ('+p.join(', ')+')':'');});
  let w='';
  if(noT.length) w+='<div class="note bad"><b>No roster for today ('+noT.length+'):</b> '+noT.map(esc).join(', ')+'</div>';
  if(noTm.length) w+='<div class="note warn"><b>No roster for tomorrow ('+noTm.length+'):</b> '+noTm.map(esc).join(', ')+'</div>';
  if(notConf.length) w+='<div class="note warn"><b>Shifts pending today ('+notConf.length+' stores):</b> '+notConf.map(esc).join(', ')+'</div>';
  document.getElementById('mgWarn').innerHTML=w;
  const t=tally(c.conf),pend=c.recs.filter(r=>!r.confirmed&&r.status!=='Week Off').length;
  const k=(l,v,cls)=>'<div class="kpi '+(cls||'')+'"><div class="l">'+l+'</div><div class="v">'+v+'</div></div>';
  document.getElementById('mgKpi').innerHTML=k('Total',t.total)+k('Week off',t.weekOff,'warn')+k('Rostered',t.rostered)+k('Present',t.present,'ok')+k('Absent',t.absent,'bad')+k('Sick',t.sick,'sick')+k('Absenteeism',t.rostered?pctTxt(t.absPct):'—',t.absPct>=10?'bad':'')+(pend?k('Pending',pend,'warn'):'');
  document.getElementById('mgShiftSub').textContent='Confirmed days only'+(pend?' · '+pend+' rostered still pending':'');
  document.getElementById('mgShift').innerHTML='<thead><tr><th>Shift</th>'+THEAD+'</tr></thead><tbody>'+
    SHIFTS.map(s=>{const L=c.conf.filter(r=>r.shift===s),by={};L.forEach(r=>{const k=slotStart(r.time);if(k)(by[k]=by[k]||[]).push(r);});
      const subs=Object.keys(by).sort((a,b)=>slotKey(a+' - x',s)-slotKey(b+' - x',s));
      return '<tr><td><b>'+SHIFT_LBL[s]+'</b></td>'+tcells(tally(L))+'</tr>'+(subs.length>1?subs.map(k=>{const sb=by[k],wo=L.filter(r=>r.status==='Week Off'&&!r.time).length;return '<tr class="sub"><td>'+esc(k)+' start</td>'+tcells(tally(sb))+'</tr>';}).join(''):'');}).join('')+'</tbody><tfoot><tr><td>Total</td>'+tcells(t)+'</tr></tfoot>';
  document.getElementById('mgStore').innerHTML='<thead><tr><th>Store</th><th>Site</th><th>Status</th>'+THEAD+'</tr></thead><tbody>'+
    Object.values(c.store).map(s=>{
      const status=!s.days?'<span class="pill bad">No roster</span>':s.conf===s.days?'<span class="pill ok">'+(single?'Confirmed':s.conf+'/'+s.days+' days')+'</span>':'<span class="pill warn">'+(single?(s.sd?s.sd+'/'+s.st+' shifts':'Pending'):s.conf+'/'+s.days+' days')+'</span>';
      return '<tr class="click" onclick="openDetail(\''+esc(s.code)+'\')"><td class="mono"><b>'+esc(s.code)+'</b></td><td>'+esc(s.site||'—')+'</td><td>'+status+'</td>'+tcells(tally(s.people))+'</tr>';
    }).join('')+'</tbody><tfoot><tr><td>Total</td><td></td><td></td>'+tcells(t)+'</tr></tfoot>';
  const vend={};c.conf.forEach(r=>{const v=r.vendor||'(No agency)';(vend[v]=vend[v]||[]).push(r);});
  const vl=Object.keys(vend).map(v=>({v,t:tally(vend[v])})).sort((a,b)=>b.t.absPct-a.t.absPct||b.t.total-a.t.total);
  document.getElementById('mgVendor').innerHTML='<thead><tr><th>Agency</th>'+THEAD+'</tr></thead><tbody>'+
    (vl.length?vl.map(x=>'<tr><td><b>'+esc(x.v)+'</b></td>'+tcells(x.t)+'</tr>').join(''):'<tr><td colspan="8" class="empty">No confirmed attendance in this range</td></tr>')+'</tbody>'+(vl.length?'<tfoot><tr><td>Total</td>'+tcells(t)+'</tr></tfoot>':'');
  renderStores();renderHeadcount();renderAnalysis();if(window.renderHourly)renderHourly();
  if(MG.detail) openDetail(MG.detail,true);
}
function openDetail(code,keep){
  MG.detail=code;const s=MG.last.store[code];if(!s)return;
  const ab=s.people.filter(p=>p.status==='Absent'||p.status==='Sick Leave').sort((a,b)=>b.date.localeCompare(a.date)||SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift));
  document.getElementById('mgDetailCard').hidden=false;
  document.getElementById('mgDetailT').textContent=storeLabel(code)+' · absentees';
  document.getElementById('mgDetailS').textContent=ab.length+' absent / sick in range';
  document.getElementById('mgDetail').innerHTML='<thead><tr><th>Date</th><th>Name</th><th>Shift</th><th>Timing</th><th>Designation</th><th>Agency</th><th>Status</th></tr></thead><tbody>'+
    (ab.length?ab.map(p=>'<tr><td>'+fmtDate(p.date)+'</td><td><b>'+esc(p.name)+'</b></td><td>'+SHIFT_LBL[p.shift]+'</td><td>'+esc(p.time||'—')+'</td><td>'+esc(p.designation)+'</td><td>'+esc(p.vendor||'—')+'</td><td class="'+(p.status==='Absent'?'bad':'sick')+'">'+p.status+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">No absences</td></tr>')+'</tbody>';
  if(!keep){const el=document.getElementById('mgDetailCard');window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-70,behavior:'smooth'});}
}
function closeDetail(){MG.detail=null;document.getElementById('mgDetailCard').hidden=true;}

// ─── stores (code ↔ site, PIN) ───
function renderStores(){
  const el=document.getElementById('mgStores');if(!el)return;
  if(el.contains(document.activeElement)) return;
  const sites=siteList(),opt=v=>'<option value="">— none —</option>'+sites.map(s=>'<option'+(s===v?' selected':'')+'>'+esc(s)+'</option>').join('');
  el.innerHTML='<thead><tr><th>Store code</th><th>Linked site</th><th>PIN</th><th>Today</th></tr></thead><tbody>'+
    storeList().map(c=>{const r=getRoster(c,todayIso());return '<tr><td class="mono"><b>'+esc(c)+'</b></td><td><select class="mini" onchange="setStoreSite(\''+esc(c)+'\',this.value)">'+opt(siteOf(c))+'</select></td><td class="mono">'+esc(pinOf(c))+'</td><td>'+(r?'<span class="pill ok">'+r.rows.length+' rostered</span>':'<span class="pill bad">No roster</span>')+'</td></tr>';}).join('')+
    '</tbody><tfoot><tr><td><input class="inp mono" id="nsCode" placeholder="QAA9" maxlength="8" style="width:100px;text-transform:uppercase"/></td><td><select class="sel" id="nsSite">'+opt('')+'</select></td><td colspan="2"><button class="btn pri sm" onclick="addStore()">Add store</button></td></tr></tfoot>';
}
async function setStoreSite(code,site){RD.stores[code].site=site;try{await saveStores();toast(code+' linked to '+(site||'no site'));}catch(e){toast('Save failed',true);}fillMgrStores();renderMgr();}
async function addStore(){
  const code=document.getElementById('nsCode').value.trim().toUpperCase(),site=document.getElementById('nsSite').value;
  if(!/^[A-Z0-9]{3,8}$/.test(code)){toast('Store code like QAA9',true);return;}
  if(RD.stores[code]){toast(code+' already exists',true);return;}
  const pin=nextPin();RD.stores[code]={site,pin};
  try{await saveStores();toast('Store '+code+' added · PIN '+pin);}catch(e){toast('Save failed',true);}
  fillMgrStores();fillLogin();document.getElementById('nsCode').value='';renderMgr();
}

async function changePw(){
  const g=id=>document.getElementById(id).value,kind=g('cpKind'),cur=g('cpCur'),n1=g('cpNew'),n2=g('cpNew2');
  if(!(await pwCheck('admin',cur))){toast('Current admin password is wrong',true);return;}
  if(n1.length<4){toast('New password: at least 4 characters',true);return;}
  if(n1!==n2){toast('New passwords do not match',true);return;}
  try{await pwSave(kind,n1);['cpCur','cpNew','cpNew2'].forEach(i=>document.getElementById(i).value='');toast((kind==='admin'?'Admin':'Operations')+' password changed');}catch(e){toast('Save failed: '+e.message,true);}
}

// ─── exports ───
const HCSV=['Total','Week Off','Rostered','Present','Absent','Sick Leave','Absenteeism %'];
const tcsv=t=>[t.total,t.weekOff,t.rostered,t.present,t.absent,t.sick,t.rostered?t.absPct.toFixed(1):''];
function fname(k){const c=MG.last;return 'Darkstore '+k+' '+c.from+(c.from!==c.to?' to '+c.to:'')+'.csv';}
function exportStore(){
  const c=MG.last,rows=[['Store Code','Site','Days with roster','Days confirmed',...HCSV,...SHIFTS.flatMap(s=>[SHIFT_LBL[s]+' Present',SHIFT_LBL[s]+' Absent'])]];
  Object.values(c.store).forEach(s=>rows.push([s.code,s.site,s.days,s.conf,...tcsv(tally(s.people)),...SHIFTS.flatMap(sh=>{const x=tally(s.people.filter(p=>p.shift===sh));return [x.present,x.absent+x.sick];})]));
  rows.push(['Total','','','',...tcsv(tally(c.conf))]);
  downloadCsv(fname('store-wise'),rows);
}
function exportVendor(){
  const c=MG.last,rows=[['Agency','Store',...HCSV]],vend={};
  c.conf.forEach(r=>{const v=r.vendor||'(No agency)';(vend[v]=vend[v]||{all:[],by:{}});vend[v].all.push(r);(vend[v].by[r.store]=vend[v].by[r.store]||[]).push(r);});
  Object.keys(vend).sort().forEach(v=>{rows.push([v,'All stores',...tcsv(tally(vend[v].all))]);Object.keys(vend[v].by).sort().forEach(s=>rows.push(['',s,...tcsv(tally(vend[v].by[s]))]));});
  downloadCsv(fname('agency-wise'),rows);
}
// Date-wise P / A / SL / WO grid (like the classic monthly sheet)
function exportSheet(){buildSheet(MG.last,fmtHead,fname('attendance sheet'));}
async function exportMonth(){
  const v=document.getElementById('mgMonth').value;if(!v){toast('Pick a month',true);return;}
  const [y,mo]=v.split('-').map(Number),from=v+'-01',last=isoOf(new Date(y,mo,0)),to=last>todayIso()?todayIso():last;
  if(from>todayIso()){toast('That month has not started yet',true);return;}
  toast('Preparing '+MONTHS[mo]+' '+y+'…');
  if(from<MG.loaded.from){await Promise.all([loadRosters(from,MG.loaded.from),loadDays(from,MG.loaded.from)]);MG.loaded.from=from;}
  const c=computeMgr(from,to);
  c.dates=rangeDates(from,last); // full month columns 1…28/30/31; future days stay blank
  const st=document.getElementById('mgSite').value;
  buildSheet(c,d=>String(dOf(d).getDate()),'Darkstore attendance '+MONTHS[mo]+' '+y+(st?' '+st:'')+'.csv',MONTHS[mo]+' '+y);
}
function buildSheet(c,headFn,name,title){
  const dates=c.dates,ppl=new Map();
  const code=p=>p.status==='Week Off'?(p.woChanged?'WO*':'WO'):!p.confirmed?'-':p.status==='Absent'?'A':p.status==='Sick Leave'?'SL':(p.woChanged?'P*':'P');
  c.recs.forEach(p=>{const k=p.store+'|'+nk(p.name);
    if(!ppl.has(k))ppl.set(k,{store:p.store,site:p.site,name:p.name,designation:p.designation,vendor:p.vendor,shift:p.shift,cells:{}});
    ppl.get(k).cells[p.date]=code(p);});
  const list=[...ppl.values()].sort((a,b)=>a.store.localeCompare(b.store)||SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift)||a.name.localeCompare(b.name));
  // N/A before joining date and after removal (only where there is no roster record)
  list.forEach(p=>{
    const e=(RD.emps[p.store]||[]).find(x=>nk(x.name)===nk(p.name)),first=Object.keys(p.cells).sort()[0];
    const join=e&&e.joinDate?(first&&first<e.joinDate?first:e.joinDate):'',left=e&&e.status==='Removed'&&e.removedAt?e.removedAt.slice(0,10):'';
    p.join=join;p.status=left?'Removed '+left:(e?'Active':'');
    dates.forEach(d=>{if(!p.cells[d]&&((join&&d<join)||(left&&d>left)))p.cells[d]='N/A';});
  });
  const rows=[];
  if(title){rows.push(['Attendance '+title]);rows.push(['','','','','','','','','',...dates.map(d=>dayName(d).slice(0,3))]);}
  rows.push(['#','Store Code','Site','Name','Designation','Agency','Shift','Joining Date','Status',...dates.map(headFn),'Working Days (P)','Absent (A)','Sick Leave (SL)','Week Off (WO)','Pending','Absenteeism %']);
  list.forEach((p,i)=>{
    const v=dates.map(d=>p.cells[d]||'');
    const n=x=>v.filter(y=>y.replace('*','')===x).length,P=n('P'),A=n('A'),S=n('SL'),W=n('WO'),pend=n('-');
    rows.push([i+1,p.store,p.site,p.name,p.designation,p.vendor,SHIFT_LBL[p.shift]||p.shift,p.join||'',p.status||'',...v,P,A,S,W,pend,(P+A+S)?((A+S)/(P+A+S)*100).toFixed(1):'']);
  });
  // per-date totals
  const tot=x=>dates.map(d=>list.filter(p=>(p.cells[d]||'').replace('*','')===x).length);
  rows.push([]);
  [['Total P','P'],['Total A','A'],['Total SL','SL'],['Total WO','WO']].forEach(([l,x])=>rows.push(['','','',l,'','','','','',...tot(x)]));
  rows.push(['','','','Absenteeism %','','','','','',...dates.map(d=>{const g=x=>list.filter(p=>(p.cells[d]||'').replace('*','')===x).length,P=g('P'),A=g('A')+g('SL');return (P+A)?(A/(P+A)*100).toFixed(1):'';})]);
  rows.push([]);rows.push(['','','','Key: P Present · A Absent · SL Sick Leave · WO Week Off · * week off changed · - not confirmed · N/A not joined yet / removed · blank = not on roster']);
  downloadCsv(name,rows);
}
function exportDetail(){
  const c=MG.last,rows=[['Date','Day','Store Code','Site','Name','Designation','Role','Agency','Shift','Timing','Status','Week Off Changed','Day Confirmed']];
  c.recs.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.store.localeCompare(b.store)||SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift)||a.name.localeCompare(b.name))
    .forEach(p=>rows.push([p.date,dayName(p.date),p.store,p.site,p.name,p.designation,p.role,p.vendor,SHIFT_LBL[p.shift]||p.shift,p.time,p.confirmed||p.status==='Week Off'?p.status:'Pending',p.woChanged?'Yes':'',p.confirmed?'Yes':'No']));
  downloadCsv(fname('attendance detail'),rows);
}

boot();
