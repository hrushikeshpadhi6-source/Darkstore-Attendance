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
  syncRosterRemovals().then(n=>{if(n&&SESSION&&SESSION.type==='mgr')rr();}).catch(()=>{}); // in the background, after the page shows
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
  if(SSUM.mode==='date')SSUM.mode='all';
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
  const ssStatus=(sh,L)=>{if(!sh)return '';const g={};L.forEach(p=>{const k=p.store+'|'+p.date;g[k]=g[k]||p.confirmed;});const n=Object.keys(g).length,d=Object.values(g).filter(Boolean).length;
    const lbl=c.dates.length>1?' store-days':(c.stores.length>1?' stores':'');return '<span class="pill '+(d===n?'ok':'warn')+' xs">'+(n===1?(d?'Confirmed':'Pending'):d+'/'+n+lbl+' confirmed')+'</span>';};
  document.getElementById('mgShiftCard').innerHTML=shiftSummaryHtml(c.recs,{key:'ops|'+(c.stores.length===1?c.stores[0]:'all')+'|'+c.from+(c.from!==c.to?'|'+c.to:''),multi:true,noAgency:true,rerender:'renderMgr()',onStore:'openDetail',statusFn:ssStatus,extra:'<select class="sel" style="min-height:0;padding:4px 8px;font-size:12px" onchange="document.getElementById(\'mgRole\').value=this.value;renderMgr()">'+[...document.getElementById('mgRole').options].map(o=>'<option value="'+esc(o.value)+'"'+(o.value===c.role?' selected':'')+'>'+esc(o.text)+'</option>').join('')+'</select>',sub:(c.dates.length>1?'<b>'+c.dates.length+' days added together</b> (each person counted once per day) · pick a single day for daily figures · ':'')+(single?fmtDate(c.from):fmtDate(c.from,{day:'numeric',month:'short'})+' – '+fmtDate(c.to))+' · '+(c.stores.length===1?storeLabel(c.stores[0]):c.stores.length+' stores')+(SSUM.mode==='store'?' · click a store to see everyone\'s status':' · use the Store filter above for one store')});
  document.getElementById('mgStore').innerHTML='<thead><tr><th>Store</th><th>Site</th><th>Status</th>'+THEAD+'</tr></thead><tbody>'+
    Object.values(c.store).map(s=>{
      const status=!s.days?'<span class="pill bad">No roster</span>':s.conf===s.days?'<span class="pill ok">'+(single?'Confirmed':s.conf+'/'+s.days+' days')+'</span>':'<span class="pill warn">'+(single?(s.sd?s.sd+'/'+s.st+' shifts':'Pending'):s.conf+'/'+s.days+' days')+'</span>';
      return '<tr class="click" onclick="openDetail(\''+esc(s.code)+'\')"><td class="mono"><b>'+esc(s.code)+'</b></td><td>'+esc(s.site||'—')+'</td><td>'+status+'</td>'+tcells(tally(s.people))+'</tr>';
    }).join('')+'</tbody><tfoot><tr><td>Total</td><td></td><td></td>'+tcells(t)+'</tr></tfoot>';
  const vend={};c.conf.forEach(r=>{const v=normVendor(r.vendor)||'(No agency)';(vend[v]=vend[v]||[]).push(r);});
  const vl=Object.keys(vend).map(v=>({v,t:tally(vend[v])})).sort((a,b)=>b.t.absPct-a.t.absPct||b.t.total-a.t.total);
  document.getElementById('mgVendor').innerHTML='<thead><tr><th>Agency</th>'+THEAD+'</tr></thead><tbody>'+
    (vl.length?vl.map(x=>'<tr><td><b>'+esc(x.v)+'</b></td>'+tcells(x.t)+'</tr>').join(''):'<tr><td colspan="8" class="empty">No confirmed attendance in this range</td></tr>')+'</tbody>'+(vl.length?'<tfoot><tr><td>Total</td>'+tcells(t)+'</tr></tfoot>':'');
  renderStores();renderHeadcount();renderAnalysis();if(window.renderHourly)renderHourly();
  if(MG.detail) openDetail(MG.detail,true);
}
const DT_F=[['all','Everyone'],['out','Absent / sick'],['pend','Not marked'],['wo','Week off'],['p','Present']];
function openDetail(code,keep){
  MG.detail=code;const c=MG.last;if(!c||!c.store[code])return;MG.dtF=MG.dtF||'all';
  const st=p=>p.status==='Week Off'?'wo':(p.status==='Absent'||p.status==='Sick Leave')?'out':p.confirmed?'p':'pend';
  const all=c.recs.filter(p=>p.store===code),L=all.filter(p=>MG.dtF==='all'||st(p)===MG.dtF).sort((a,b)=>b.date.localeCompare(a.date)||SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift)||startMin(a.time,a.shift)-startMin(b.time,b.shift)||a.name.localeCompare(b.name));
  const lbl={wo:['Week Off','wo'],out:[null,'bad'],p:['Present','ok'],pend:['Not marked','wo']};
  document.getElementById('mgDetailCard').hidden=false;
  document.getElementById('mgDetailT').textContent=storeLabel(code)+' · status';
  document.getElementById('mgDetailS').innerHTML='<div class="seg sm" style="margin-top:6px;display:inline-flex">'+DT_F.map(([k,l])=>'<button class="'+(MG.dtF===k?'on':'')+'" onclick="MG.dtF=\''+k+'\';openDetail(\''+esc(code)+'\',true)">'+l+' '+(k==='all'?all.length:all.filter(p=>st(p)===k).length)+'</button>').join('')+'</div>';
  const multi=c.from!==c.to;
  document.getElementById('mgDetail').innerHTML='<thead><tr>'+(multi?'<th>Date</th>':'')+'<th>Name</th><th>Shift</th><th>Timing</th><th>Designation</th><th>Agency</th><th>Status</th></tr></thead><tbody>'+
    (L.length?L.map(p=>{const s=st(p),[t,cl]=lbl[s];return '<tr>'+(multi?'<td>'+fmtDate(p.date)+'</td>':'')+'<td><b>'+esc(p.name)+'</b>'+(p.woChanged?' <span class="wo-chg">WO changed</span>':'')+'</td><td>'+SHIFT_LBL[p.shift]+'</td><td>'+esc(p.time||'—')+'</td><td>'+esc(p.designation)+'</td><td>'+esc(normVendor(p.vendor)||'—')+'</td><td class="'+cl+'">'+(t||p.status)+'</td></tr>';}).join(''):'<tr><td colspan="7" class="empty">No one in this filter</td></tr>')+'</tbody>';
  if(!keep){const el=document.getElementById('mgDetailCard');window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-70,behavior:'smooth'});}
}
function closeDetail(){MG.detail=null;document.getElementById('mgDetailCard').hidden=true;}

// ─── stores (code ↔ site, PIN) ───
function renderStores(){
  const el=document.getElementById('mgStores');if(!el)return;
  if(el.contains(document.activeElement)) return;
  const sites=[...new Set([...siteList(),...storeList().map(siteOf).filter(Boolean)])].sort();
  el.innerHTML='<thead><tr><th>Store code</th><th>Store name / site</th><th>PIN</th><th>Today</th></tr></thead><tbody>'+
    storeList().map(c=>{const r=getRoster(c,todayIso());return '<tr><td class="mono"><b>'+esc(c)+'</b></td><td><input class="inp" list="stSites" value="'+esc(siteOf(c))+'" placeholder="Type a name" onchange="setStoreSite(\''+esc(c)+'\',this.value)" style="width:200px"/></td><td class="mono">'+esc(pinOf(c))+'</td><td>'+(r?'<span class="pill ok">'+r.rows.length+' rostered</span>':'<span class="pill bad">No roster</span>')+'</td></tr>';}).join('')+
    '</tbody><tfoot><tr><td><input class="inp mono" id="nsCode" placeholder="QAA9" maxlength="8" style="width:100px;text-transform:uppercase"/></td><td><input class="inp" id="nsSite" list="stSites" placeholder="Store name — pick or type new" style="width:200px"/></td><td colspan="2"><button class="btn pri sm" onclick="addStore()">Add store</button></td></tr></tfoot>';
  let dl=document.getElementById('stSites');if(!dl){dl=document.createElement('datalist');dl.id='stSites';document.body.appendChild(dl);}
  dl.innerHTML=sites.map(s=>'<option value="'+esc(s)+'"></option>').join('');
}
async function setStoreSite(code,site){site=String(site||'').replace(/\s+/g,' ').trim();if(site===siteOf(code))return;RD.stores[code].site=site;try{await saveStores();toast(code+' linked to '+(site||'no site'));}catch(e){toast('Save failed',true);}fillMgrStores();renderMgr();}
async function addStore(){
  const code=document.getElementById('nsCode').value.trim().toUpperCase(),site=document.getElementById('nsSite').value.trim().replace(/\s+/g,' ');
  if(!site){toast('Enter a store name',true);return;}
  if(!/^[A-Z0-9]{3,8}$/.test(code)){toast('Store code like QAA9',true);return;}
  if(RD.stores[code]){toast(code+' already exists',true);return;}
  const pin=nextPin();RD.stores[code]={site,pin};
  try{await saveStores();toast('Store '+code+' added · PIN '+pin);}catch(e){toast('Save failed',true);}
  fillMgrStores();fillLogin();document.getElementById('nsCode').value='';document.getElementById('nsSite').value='';renderMgr();
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
  const daily=storeDailyRows(c);
  if(!window.XLSX){downloadCsv(fname('store-wise'),rows);downloadCsv(fname('store daily headcount'),daily);toast('Excel library not loaded, downloaded 2 CSV files',true);return;}
  const wb=XLSX.utils.book_new(),add=(r,n,w)=>{const ws=XLSX.utils.aoa_to_sheet(r);ws['!cols']=w.map(x=>({wch:x}));XLSX.utils.book_append_sheet(wb,ws,n);};
  add(rows,'Store-wise',[11,16,9,9,...HCSV.map(()=>11),...SHIFTS.flatMap(()=>[11,11])]);
  add(daily,'Store daily headcount',[11,16,12,11,11,13,15,10,10,10,10,10,10,11]);
  XLSX.writeFile(wb,fname('store-wise').replace(/\.csv$/,'.xlsx'));
}
// One row per store per date: headcount by role (all roles, not the Role filter) and attendance
function storeDailyRows(c){
  const out=[['Store Code','Site','Date','Day','Associates','Housekeeping','TL & Supervisors','Total Headcount','Week Off','Rostered','Present','Absent','Not Marked','Absent %']];
  const tot=[0,0,0,0,0,0,0,0,0];
  c.stores.forEach(code=>c.dates.forEach(d=>{
    const r=dayPeople(code,d);if(!r.hasRoster)return;
    const L=r.people,rc=f=>L.filter(f).length;
    const aa=rc(p=>p.role==='Associate'),hk=rc(p=>p.role==='Housekeeping'),tl=rc(p=>p.role==='Supervisor'||p.role==='Team Leader');
    const wo=rc(p=>p.status==='Week Off'),ros=L.length-wo;
    const ab=rc(p=>(p.status==='Absent'||p.status==='Sick Leave')&&p.confirmed),pr=rc(p=>p.status!=='Week Off'&&p.status!=='Absent'&&p.status!=='Sick Leave'&&p.confirmed),nm=ros-ab-pr;
    const v=[aa,hk,tl,L.length,wo,ros,pr,ab,nm];v.forEach((x,i)=>tot[i]+=x);
    out.push([code,siteOf(code),fmtDate(d,{day:'2-digit',month:'short',year:'numeric'}),dayName(d),...v,(pr+ab)?+(ab/(pr+ab)*100).toFixed(1):'']);
  }));
  out.push(['Total','','','',...tot,(tot[6]+tot[7])?+(tot[7]/(tot[6]+tot[7])*100).toFixed(1):'']);
  return out;
}
function exportVendor(){
  const c=MG.last,rows=[['Agency','Store',...HCSV]],vend={};
  c.conf.forEach(r=>{const v=normVendor(r.vendor)||'(No agency)';(vend[v]=vend[v]||{all:[],by:{}});vend[v].all.push(r);(vend[v].by[r.store]=vend[v].by[r.store]||[]).push(r);});
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
  const code=p=>p.status==='Week Off'?'WO':!p.confirmed?'-':p.status==='Absent'?'A':p.status==='Sick Leave'?'SL':'P';
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
  if(title){rows.push(['Attendance '+title]);rows.push(['','','','','','','','','','',...dates.map(d=>dayName(d).slice(0,3))]);}
  rows.push(['#','Emp ID','Store Code','Site','Name','Designation','Agency','Shift','Joining Date','Status',...dates.map(headFn),'Working Days (P)','Absent (A)','Sick Leave (SL)','Week Off (WO)','Pending','Absenteeism %']);
  list.forEach((p,i)=>{
    const v=dates.map(d=>p.cells[d]||'');
    const n=x=>v.filter(y=>y.replace('*','')===x).length,P=n('P'),A=n('A'),S=n('SL'),W=n('WO'),pend=n('-');
    rows.push([i+1,empIdOf(p.store,p.name,p.vendor),p.store,p.site,p.name,p.designation,p.vendor,SHIFT_LBL[p.shift]||p.shift,p.join||'',p.status||'',...v,P,A,S,W,pend,(P+A+S)?((A+S)/(P+A+S)*100).toFixed(1):'']);
  });
  // per-date totals
  const tot=x=>dates.map(d=>list.filter(p=>(p.cells[d]||'').replace('*','')===x).length);
  rows.push([]);
  [['Total P','P'],['Total A','A'],['Total SL','SL'],['Total WO','WO']].forEach(([l,x])=>rows.push(['','','','',l,'','','','','',...tot(x)]));
  rows.push(['','','','','Absenteeism %','','','','','',...dates.map(d=>{const g=x=>list.filter(p=>(p.cells[d]||'').replace('*','')===x).length,P=g('P'),A=g('A')+g('SL');return (P+A)?(A/(P+A)*100).toFixed(1):'';})]);
  rows.push([]);rows.push(['','','','','Key: P Present · A Absent · SL Sick Leave · WO Week Off · - not confirmed · N/A not joined yet / removed · blank = not on roster']);
  writeAttendanceXlsx(list,dates,title,name).catch(err=>{console.warn('xlsx',err);downloadCsv(name,rows);toast('Excel could not be made, downloaded CSV instead',true);});
}
// ─── Attendance sheet as a formatted Excel file: one header row with dates, frozen, with filter; status colours ───
let EXCELJS_P=null;
function loadExcelJs(){
  if(window.ExcelJS) return Promise.resolve();
  if(EXCELJS_P) return EXCELJS_P;
  const one=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=()=>window.ExcelJS?res():rej(new Error('ExcelJS missing'));s.onerror=()=>{s.remove();rej(new Error('load '+src));};document.head.appendChild(s);});
  EXCELJS_P=one('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js').catch(()=>one('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js')).catch(e=>{EXCELJS_P=null;throw e;});
  return EXCELJS_P;
}
const XL_ST={P:['E5F4EC','0B6B3D',false],A:['FBD5DB','C00000',true],SL:['EFEAFB','5B3BB0',true],WO:['FDF1DC','9A5B00',false],'-':['F2F2F2','808080',false],'N/A':['F2F2F2','A0A0A0',false]};
async function writeAttendanceXlsx(list,dates,title,name){
  toast('Preparing Excel…');
  await loadExcelJs();
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Attendance',{views:[{state:'frozen',xSplit:5,ySplit:2}]});
  const fixed=['#','Emp ID','Store Code','Site','Name','Designation','Agency','Shift','Joining Date','Status'],sum=['Working Days (P)','Absent (A)','Sick Leave (SL)','Week Off (WO)','Pending','Absent %'];
  const nF=fixed.length,nD=dates.length,nC=nF+nD+sum.length;
  const dh=d=>{const x=dOf(d);return (title?String(x.getDate()):pad(x.getDate())+'-'+MON3[x.getMonth()])+'\n'+dayName(d).slice(0,3);};
  const st=document.getElementById('mgSite').value;
  const thin={style:'thin',color:{argb:'FFD0D7E2'}},box={top:thin,left:thin,bottom:thin,right:thin};
  const fill=c=>({type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c}});
  // row 1: title
  ws.mergeCells(1,1,1,Math.min(nC,nF+Math.max(nD,1)));
  const t=ws.getCell(1,1);t.value='Attendance '+(title||(fmtDate(dates[0])+(dates.length>1?' to '+fmtDate(dates[dates.length-1]):'')))+' · '+(st?storeLabel(st):'All stores');
  t.font={bold:true,size:14,color:{argb:'FFFFFFFF'}};t.fill=fill('1D3A6B');t.alignment={vertical:'middle'};ws.getRow(1).height=26;
  // row 2: header (dates + day)
  const hr=ws.getRow(2);hr.values=[...fixed,...dates.map(dh),...sum];hr.height=32;
  hr.eachCell((c,i)=>{c.font={bold:true,color:{argb:'FFFFFFFF'},size:10};c.fill=fill('1D3A6B');c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=box;});
  // data rows
  list.forEach((p,i)=>{
    const v=dates.map(d=>p.cells[d]||''),n=x=>v.filter(y=>y===x).length,P=n('P'),A=n('A'),S=n('SL'),W=n('WO'),pend=n('-');
    const r=ws.addRow([i+1,empIdOf(p.store,p.name,p.vendor),p.store,p.site,p.name,p.designation,p.vendor,SHIFT_LBL[p.shift]||p.shift,p.join?fmtDate(p.join,{day:'2-digit',month:'short',year:'numeric'}):'',p.status||'',...v,P,A,S,W,pend,(P+A+S)?+((A+S)/(P+A+S)*100).toFixed(1):'']);
    r.eachCell({includeEmpty:true},(c,ci)=>{c.border=box;c.font={size:10};
      if(ci>nF&&ci<=nF+nD){c.alignment={horizontal:'center'};const s=XL_ST[c.value];if(s){c.fill=fill(s[0]);c.font={size:10,bold:s[2],color:{argb:'FF'+s[1]}};}}
      else if(ci>nF+nD){c.alignment={horizontal:'center'};if(ci===nF+nD+2&&A)c.font={size:10,bold:true,color:{argb:'FFC00000'}};if(ci===nF+nD+6&&c.value!==''&&c.value>=10)c.font={size:10,bold:true,color:{argb:'FFC00000'}};}
      if(ci===5)c.font={size:10,bold:true};});
    if(String(p.status).startsWith('Removed'))r.getCell(10).font={size:10,color:{argb:'FFC00000'}};
  });
  const last=2+list.length;
  ws.autoFilter={from:{row:2,column:1},to:{row:Math.max(last,2),column:nC}};
  // per-date totals below (outside the filter)
  ws.addRow([]);
  const cnt=(d,x)=>list.filter(p=>p.cells[d]===x).length;
  [['Total P','P','0B6B3D'],['Total A','A','C00000'],['Total SL','SL','5B3BB0'],['Total WO','WO','9A5B00']].forEach(([l,x,col])=>{
    const r=ws.addRow(['','','','',l,'','','','','',...dates.map(d=>cnt(d,x))]);
    r.eachCell((c,ci)=>{c.font={bold:true,size:10,color:{argb:'FF'+col}};if(ci>nF)c.alignment={horizontal:'center'};});});
  const ar=ws.addRow(['','','','','Absent %','','','','','',...dates.map(d=>{const P=cnt(d,'P'),A=cnt(d,'A')+cnt(d,'SL');return (P+A)?+(A/(P+A)*100).toFixed(1):'';})]);
  ar.eachCell((c,ci)=>{c.font={bold:true,size:10,color:{argb:ci>nF&&c.value>=10?'FFC00000':'FF15202E'}};if(ci>nF)c.alignment={horizontal:'center'};});
  ws.addRow([]);ws.addRow(['','','','','Key: P Present, A Absent, SL Sick Leave, WO Week Off, - not confirmed, N/A not joined yet or removed, blank not on roster']).getCell(5).font={italic:true,size:9,color:{argb:'FF7D8A9C'}};
  // widths
  [5,12,10,14,26,16,13,9,13,16].forEach((w,i)=>ws.getColumn(i+1).width=w);
  for(let i=0;i<nD;i++)ws.getColumn(nF+1+i).width=title?5.5:8;
  sum.forEach((s,i)=>ws.getColumn(nF+nD+1+i).width=11);
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=name.replace(/\.csv$/i,'')+'.xlsx';
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
  toast('Excel downloaded · '+list.length+' people');
}
function exportDetail(){
  const c=MG.last,rows=[['Date','Day','Store Code','Site','Emp ID','Name','Designation','Role','Agency','Shift','Timing','Status','Week Off Changed','Day Confirmed']];
  c.recs.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.store.localeCompare(b.store)||SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift)||a.name.localeCompare(b.name))
    .forEach(p=>rows.push([p.date,dayName(p.date),p.store,p.site,empIdOf(p.store,p.name,p.vendor),p.name,p.designation,p.role,p.vendor,SHIFT_LBL[p.shift]||p.shift,p.time,p.confirmed||p.status==='Week Off'?p.status:'Pending',p.woChanged?'Yes':'',p.confirmed?'Yes':'No']));
  downloadCsv(fname('attendance detail'),rows);
}

boot();
