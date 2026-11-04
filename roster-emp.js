// ═══ Darkstore Roster Pro — employee master (Roster Pro only, independent of the classic app) ═══
const EMP={q:'',status:'Active',store:'',vendor:'',el:null,scope:null,form:null,sort:null};
const EMP_COLS=[['store','Store'],['empId','Emp ID'],['name','Name'],['designation','Designation'],['vendor','Agency'],['shift','Shift'],['timing','Timing'],['weekOff','Week Off'],['joinDate','Joined'],['status','Status']];
function empSort(k){const s=EMP.sort;EMP.sort=(k==='shift'||k==='timing')&&!(s&&s.k===k&&s.dir===1)?null:{k,dir:s&&s.k===k?-s.dir:1};empRerender();}
const empTm=e=>startMin((e.start||'')+' - '+(e.end||''),e.shift);
function empCmp(a,b){const s=EMP.sort;if(!s)return SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift)||empTm(a)-empTm(b)||a.store.localeCompare(b.store)||a.name.localeCompare(b.name);
  const v=e=>s.k==='timing'?empTm(e):s.k==='shift'?SHIFTS.indexOf(e.shift):s.k==='weekOff'?DAYS.indexOf(e.weekOff):String(e[s.k]||'').toLowerCase();
  const x=v(a),y=v(b);return (x<y?-1:x>y?1:0)*s.dir||empTm(a)-empTm(b)||a.name.localeCompare(b.name);}
const DESIGS=['Associate','Supervisor','Team Leader','Housekeeping'];

function allEmps(stores){const out=[];stores.forEach(s=>(RD.emps[s]||[]).forEach(e=>out.push(Object.assign({store:s},e))));return out;}
function vendorsKnown(){return [...new Set(Object.values(RD.emps).flat().map(e=>e.vendor).filter(Boolean))].sort();}

function renderEmployees(elId,scope){
  EMP.el=elId;EMP.scope=scope||null;
  const el=document.getElementById(elId);if(!el)return;
  if(EMP.form&&el.contains(document.activeElement))return; // don't wipe a form being typed in
  const stores=scope?[scope]:(EMP.store?[EMP.store]:storeList());
  const list=allEmps(stores),act=list.filter(e=>e.status!=='Removed'),q=nk(EMP.q);
  const vis=list.filter(e=>(EMP.status==='All'||(EMP.status==='Active'?e.status!=='Removed':e.status==='Removed'))&&(!EMP.vendor||e.vendor===EMP.vendor)&&(!q||nk(e.name).includes(q)||nk(e.vendor).includes(q)||nk(e.designation).includes(q)))
    .sort(empCmp);
  const rc=r=>act.filter(e=>roleOf(e.designation)===r).length;
  let h='';
  const hc=headcountHtml(act,!scope&&!EMP.store);
  let k='<div class="kpis">'+[['Active',act.length,''],['Associates',rc('Associate'),''],['Housekeeping',rc('Housekeeping'),''],['Supervisors & TLs',rc('Supervisor')+rc('Team Leader'),''],['Removed',list.length-act.length,'bad']].map(([l,v,c])=>'<div class="kpi '+c+'"><div class="l">'+l+'</div><div class="v">'+v+'</div></div>').join('')+'</div>';
  h=k+hc;
  h+='<div class="card"><div class="card-h"><div class="row" style="gap:8px">'+
    '<input class="inp" placeholder="Search name, agency, designation" value="'+esc(EMP.q)+'" oninput="EMP.q=this.value;empRerender()" style="width:230px"/>'+
    '<select class="sel" onchange="EMP.status=this.value;empRerender()">'+['Active','Removed','All'].map(s=>'<option'+(s===EMP.status?' selected':'')+'>'+s+'</option>').join('')+'</select>'+
    (scope?'':'<select class="sel" onchange="EMP.store=this.value;empRerender()"><option value="">All stores</option>'+storeList().map(c=>'<option value="'+esc(c)+'"'+(c===EMP.store?' selected':'')+'>'+esc(storeLabel(c))+'</option>').join('')+'</select>')+
    '<select class="sel" onchange="EMP.vendor=this.value;empRerender()"><option value="">All agencies</option>'+vendorsKnown().map(v=>'<option'+(v===EMP.vendor?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div>'+
    '<div class="row" style="gap:8px"><button class="btn sm" onclick="exportEmployees()">Export CSV</button><button class="btn pri sm" onclick="empForm()">Add employee</button></div></div>'+
    '<div id="empForm"></div><div class="tw"><table class="t"><thead><tr>'+EMP_COLS.filter(c=>!scope||c[0]!=='store').map(([k,l])=>{const on=EMP.sort?EMP.sort.k===k:(k==='shift'||k==='timing');return '<th class="srt'+(on?' on':'')+'" onclick="empSort(\''+k+'\')" title="Sort by '+l+'">'+l+(EMP.sort&&EMP.sort.k===k?(EMP.sort.dir>0?' ↑':' ↓'):'')+'</th>';}).join('')+'<th>'+(EMP.sort?'<button class="btn ghost xs" onclick="EMP.sort=null;empRerender()">By shift timing</button>':'')+'</th></tr></thead><tbody>'+
    (vis.length?vis.map((e,i)=>{const k=esc(nk(e.name)).replace(/'/g,"\\'"),s=esc(e.store);
      const grp=!EMP.sort&&(i===0||vis[i-1].shift!==e.shift)?'<tr class="grp"><td colspan="'+(scope?10:11)+'">'+esc(SHIFT_LBL[e.shift]||'No shift')+' shift<span>'+vis.filter(x=>x.shift===e.shift).length+'</span></td></tr>':'';
      return grp+'<tr>'+(scope?'':'<td class="mono">'+s+'</td>')+'<td class="mono">'+esc(e.empId||'—')+'</td><td><b>'+esc(e.name)+'</b></td><td>'+esc(e.designation)+'</td><td>'+esc(e.vendor||'—')+'</td><td>'+esc(SHIFT_LBL[e.shift]||'—')+'</td><td>'+esc(e.start&&e.end?e.start+' - '+e.end:'—')+'</td><td>'+esc(e.weekOff||'—')+'</td><td>'+(e.joinDate?fmtDate(e.joinDate):'—')+'</td>'+
        '<td>'+(e.status==='Removed'?'<span class="pill bad" title="'+esc(e.removedReason||'')+'">Removed '+(e.removedAt?fmtDate(e.removedAt.slice(0,10),{day:'numeric',month:'short'}):'')+'</span>':'<span class="pill ok">Active</span>')+'</td>'+
        '<td style="text-align:right"><button class="btn ghost sm" onclick="empForm(\''+s+'\',\''+k+'\')">Edit</button>'+(e.status==='Removed'?'<button class="btn ghost sm" onclick="empRestore(\''+s+'\',\''+k+'\')">Restore</button>':'<button class="btn ghost sm" style="color:var(--bad)" onclick="empRemove(\''+s+'\',\''+k+'\')">Remove</button>')+'</td></tr>';}).join('')
      :'<tr><td colspan="11" class="empty">'+(list.length?'No one matches':'No employees yet — they are added automatically when a roster is uploaded, or use Add employee')+'</td></tr>')+
    '</tbody></table></div></div>';
  el.innerHTML=h;
}
function empRerender(){EMP.form=null;renderEmployees(EMP.el,EMP.scope);}

function empForm(store,key){
  const e=key?(RD.emps[store]||[]).find(x=>nk(x.name)===key):null;
  EMP.form={store:store||EMP.scope||EMP.store||'',key:key||null};
  const v=k=>esc(e?e[k]||'':'');
  const sel=(id,opts,cur)=>'<select class="sel" id="'+id+'">'+opts.map(([o,l])=>'<option value="'+esc(o)+'"'+(o===cur?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>';
  document.getElementById('empForm').innerHTML='<div class="card-b" style="border-bottom:1px solid var(--line);background:var(--card2)"><div style="font-weight:700;margin-bottom:10px">'+(e?'Edit '+esc(e.name):'Add employee')+'</div><div class="row">'+
    (EMP.scope?'':'<label class="fld">Store'+sel('efStore',storeList().map(c=>[c,c]),EMP.form.store||storeList()[0])+'</label>')+
    '<label class="fld">Name<input class="inp" id="efName" value="'+v('name')+'"'+(e?' readonly style="background:var(--card2)"':'')+'/></label>'+
    '<label class="fld">Designation<input class="inp" id="efDesig" list="efDesigs" value="'+(e?v('designation'):'Associate')+'" style="width:150px"/><datalist id="efDesigs">'+DESIGS.map(d=>'<option>'+d+'</option>').join('')+'</datalist></label>'+
    '<label class="fld">Agency<input class="inp" id="efVendor" list="efVendors" value="'+v('vendor')+'" style="width:130px"/><datalist id="efVendors">'+vendorsKnown().map(x=>'<option>'+esc(x)+'</option>').join('')+'</datalist></label>'+
    '<label class="fld">Shift'+sel('efShift',SHIFTS.map(s=>[s,SHIFT_LBL[s]]),e?e.shift:'DAY')+'</label>'+
    '<label class="fld">Start<input class="inp" id="efStart" value="'+v('start')+'" placeholder="8:00 AM" style="width:90px"/></label>'+
    '<label class="fld">End<input class="inp" id="efEnd" value="'+v('end')+'" placeholder="5:00 PM" style="width:90px"/></label>'+
    '<label class="fld">Week Off'+sel('efWo',[['','None'],...DAYS.map(d=>[d,d])],e?e.weekOff||'':'')+'</label>'+
    '<label class="fld">Joining date<input class="inp" type="date" id="efJoin" value="'+(e?v('joinDate'):todayIso())+'"/></label></div>'+
    '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:10px"><input type="checkbox" id="efRoster" '+(e?'':'checked')+'/>'+(e?'Also apply shift / timing / week off to the roster from today':'Also add to the uploaded roster from today')+'</label>'+
    '<div class="row" style="margin-top:12px"><button class="btn pri" onclick="empSave()">Save</button><button class="btn" onclick="EMP.form=null;document.getElementById(\'empForm\').innerHTML=\'\'">Cancel</button></div></div>';
  (e?document.getElementById('efDesig'):document.getElementById('efName')).focus();
}
async function empSave(){
  const g=id=>{const x=document.getElementById(id);return x?x.value.trim():'';};
  const store=EMP.scope||g('efStore')||EMP.form.store,name=g('efName').replace(/\s+/g,' ');
  if(!store){toast('Pick a store',true);return;}
  if(!name){toast('Enter a name',true);return;}
  const start=g('efStart'),end=g('efEnd');
  if((start&&parseHour(start)==null)||(end&&parseHour(end)==null)){toast('Timing like 8:00 AM',true);return;}
  const f={designation:normDesig(g('efDesig')),vendor:normVendor(g('efVendor')),shift:g('efShift'),start,end,weekOff:g('efWo'),joinDate:g('efJoin')||todayIso()};
  const list=JSON.parse(JSON.stringify(RD.emps[store]||[])),key=EMP.form.key,now=new Date().toISOString(),by=SESSION.type==='mgr'?'Admin':SESSION.store;
  let e=list.find(x=>nk(x.name)===(key||nk(name)));
  if(!key&&e&&e.status!=='Removed'){toast(name+' already exists in '+store,true);return;}
  if(e){Object.assign(e,f);if(!key){e.status='Active';e.reactivatedAt=now;delete e.removedAt;delete e.removedReason;}}
  else{e=Object.assign({name,status:'Active',addedAt:now,addedBy:by,source:'manual'},f);list.push(e);}
  const toRoster=document.getElementById('efRoster').checked;
  try{
    await saveEmps(store,list);
    let n=0;
    if(toRoster) n=await rosterFromToday(store,rows=>{
      const k=nk(e.name),x=rows.find(y=>nk(y.name)===k);
      const base={name:e.name,designation:e.designation,vendor:e.vendor,defShift:e.shift,weekOff:e.weekOff,start:e.start,end:e.end};
      return {rows,x,base};
    },by);
    EMP.form=null;toast((key?'Updated ':'Added ')+e.name+(toRoster?' · roster updated for '+n+' day(s)':''));renderEmployees(EMP.el,EMP.scope);
  }catch(err){toast('Save failed: '+err.message,true);}
}
// Apply an employee to every saved roster date from today (adds or updates the row)
async function rosterFromToday(store,fn,by){
  const t=todayIso(),byDate={};
  Object.values(RD.rosters).filter(r=>r.store===store&&r.date>=t).forEach(r=>{
    const rows=JSON.parse(JSON.stringify(r.rows)),{x,base}=fn(rows),off=!!base.weekOff&&base.weekOff===dayName(r.date);
    const row=Object.assign({},base,{shift:base.defShift,off,time:off?'':(base.start&&base.end?base.start+' - '+base.end:'')});
    if(x)Object.assign(x,row);else rows.push(row);
    byDate[r.date]=rows;
  });
  if(Object.keys(byDate).length) await saveRosterDates(store,byDate,by);
  return Object.keys(byDate).length;
}
async function empRemove(store,key){
  const list=JSON.parse(JSON.stringify(RD.emps[store]||[])),e=list.find(x=>nk(x.name)===key);if(!e)return;
  const reason=prompt('Remove '+e.name+' from '+store+'?\nReason (resigned, transferred, absconded…):','Resigned');
  if(reason===null)return;
  e.status='Removed';e.removedAt=new Date().toISOString();e.removedReason=reason;e.removedBy=SESSION.type==='mgr'?'Admin':SESSION.store;
  try{
    await saveEmps(store,list);
    // take them off roster dates after today (today and past keep their record)
    const t=todayIso(),byDate={};
    Object.values(RD.rosters).filter(r=>r.store===store&&r.date>t&&r.rows.some(y=>nk(y.name)===key)).forEach(r=>{byDate[r.date]=r.rows.filter(y=>nk(y.name)!==key);});
    if(Object.keys(byDate).length) await saveRosterDates(store,byDate,e.removedBy);
    toast(e.name+' removed'+(Object.keys(byDate).length?' · taken off '+Object.keys(byDate).length+' future roster day(s)':''));empRerender();
  }catch(err){toast('Save failed: '+err.message,true);}
}
async function empRestore(store,key){
  const list=JSON.parse(JSON.stringify(RD.emps[store]||[])),e=list.find(x=>nk(x.name)===key);if(!e)return;
  e.status='Active';e.reactivatedAt=new Date().toISOString();delete e.removedAt;delete e.removedReason;
  try{await saveEmps(store,list);toast(e.name+' restored — add them to the roster if they are working');empRerender();}catch(err){toast('Save failed: '+err.message,true);}
}
function exportEmployees(){
  const stores=EMP.scope?[EMP.scope]:(EMP.store?[EMP.store]:storeList());
  const rows=[['Emp ID','Store Code','Site','Name','Designation','Role','Agency','Shift','Start','End','Week Off','Joining Date','Status','Removed On','Removal Reason','Added By','Source']];
  allEmps(stores).sort((a,b)=>a.store.localeCompare(b.store)||a.name.localeCompare(b.name)).forEach(e=>rows.push([e.empId||'',e.store,siteOf(e.store),e.name,e.designation,roleOf(e.designation),e.vendor,SHIFT_LBL[e.shift]||e.shift,e.start,e.end,e.weekOff,e.joinDate,e.status||'Active',e.removedAt?e.removedAt.slice(0,10):'',e.removedReason||'',e.addedBy||'',e.source||'']));
  downloadCsv('Darkstore employees '+(stores.length===1?stores[0]+' ':'')+todayIso()+'.csv',rows);
}

// ─── headcount: by agency and by store (Employees tab) ───
const HC_COLS=[['Associates',e=>roleOf(e.designation)==='Associate'],['Housekeeping',e=>roleOf(e.designation)==='Housekeeping'],['Sup & TL',e=>/Supervisor|Team Leader/.test(roleOf(e.designation))],...SHIFTS.map(s=>[SHIFT_LBL[s],e=>e.shift===s])];
function hcTable(title,sub,label,groups,act,exportFn){
  const row=(l,L,mono)=>'<td'+(mono?' class="mono"':'')+'><b>'+esc(l)+'</b></td>'+HC_COLS.map(([,f],i)=>'<td class="n"'+(i===3?' style="border-left:1px solid var(--line)"':'')+'>'+L.filter(f).length+'</td>').join('')+'<td class="n" style="font-weight:700">'+L.length+'</td>';
  return '<div class="card"><div class="card-h"><div><h3>'+title+'</h3><div class="sub">'+sub+'</div></div><button class="btn sm" onclick="'+exportFn+'()">Export CSV</button></div><div class="tw"><table class="t"><thead><tr><th>'+label+'</th>'+HC_COLS.map(([l],i)=>'<th class="n"'+(i===3?' style="border-left:1px solid var(--line)"':'')+'>'+l+'</th>').join('')+'<th class="n">Total</th></tr></thead><tbody>'+
    (groups.length?groups.map(([k,L,lbl])=>'<tr>'+row(lbl||k,L,label==='Store')+'</tr>').join(''):'<tr><td colspan="8" class="empty">No employees yet</td></tr>')+'</tbody>'+(groups.length?'<tfoot><tr>'+row('Total',act)+'</tr></tfoot>':'')+'</table></div></div>';
}
function hcGroups(act,keyFn){const by={};act.forEach(e=>{const v=keyFn(e);(by[v]=by[v]||[]).push(e);});return Object.keys(by).map(k=>[k,by[k]]);}
function headcountHtml(act,withStores){
  const scopeLbl=EMP.scope?storeLabel(EMP.scope):EMP.store?storeLabel(EMP.store):'all stores';
  EMP.lastAct=act;
  let h='<div class="'+(withStores?'grid2 mb':'')+'">';
  h+=hcTable('Headcount by agency','Active employees · '+esc(scopeLbl),'Agency',hcGroups(act,e=>e.vendor||'(No agency)').sort((a,b)=>b[1].length-a[1].length),act,'exportHcAgency');
  if(withStores) h+=hcTable('Headcount by store','Active employees per store','Store',storeList().map(c=>[c,act.filter(e=>e.store===c),storeLabel(c)]).filter(g=>g[1].length),act,'exportHcStore');
  h+='</div>';
  if(withStores) h+=storeAgencyHtml(act);
  return h;
}
// Store × agency matrix (associates + housekeeping + leads, split by agency)
function storeAgencyHtml(act){
  const ags=hcGroups(act,e=>e.vendor||'(No agency)').sort((x,y)=>y[1].length-x[1].length).map(g=>g[0]);
  const ss=storeList().filter(c=>act.some(e=>e.store===c));
  if(!ss.length) return '';
  const cnt=(s,v)=>act.filter(e=>e.store===s&&(e.vendor||'(No agency)')===v).length;
  return '<div class="card"><div class="card-h"><div><h3>Store × agency</h3><div class="sub">Active employees per store, split by agency</div></div><button class="btn sm" onclick="exportStoreAgency()">Export CSV</button></div><div class="tw"><table class="t"><thead><tr><th>Store</th>'+ags.map(v=>'<th class="n">'+esc(v)+'</th>').join('')+'<th class="n">Total</th></tr></thead><tbody>'+
    ss.map(s=>'<tr><td class="mono"><b>'+esc(storeLabel(s))+'</b></td>'+ags.map(v=>{const n=cnt(s,v);return '<td class="n"'+(n?'':' style="color:var(--ink3)"')+'>'+n+'</td>';}).join('')+'<td class="n" style="font-weight:700">'+act.filter(e=>e.store===s).length+'</td></tr>').join('')+
    '</tbody><tfoot><tr><td>Total</td>'+ags.map(v=>'<td class="n">'+act.filter(e=>(e.vendor||'(No agency)')===v).length+'</td>').join('')+'<td class="n">'+act.length+'</td></tr></tfoot></table></div></div>';
}
function exportStoreAgency(){
  const act=EMP.lastAct||[],ags=[...new Set(act.map(e=>e.vendor||'(No agency)'))].sort();
  const rows=[['Store Code','Site',...ags,'Total']];
  storeList().filter(c=>act.some(e=>e.store===c)).forEach(s=>rows.push([s,siteOf(s),...ags.map(v=>act.filter(e=>e.store===s&&(e.vendor||'(No agency)')===v).length),act.filter(e=>e.store===s).length]));
  rows.push(['Total','',...ags.map(v=>act.filter(e=>(e.vendor||'(No agency)')===v).length),act.length]);
  downloadCsv('Headcount store x agency '+todayIso()+'.csv',rows);
}
function hcCsv(name,label,groups,act){
  const rows=[[label,...HC_COLS.map(c=>c[0]),'Total']];
  groups.forEach(([k,L,lbl])=>rows.push([lbl||k,...HC_COLS.map(([,f])=>L.filter(f).length),L.length]));
  rows.push(['Total',...HC_COLS.map(([,f])=>act.filter(f).length),act.length]);
  downloadCsv(name+' '+todayIso()+'.csv',rows);
}
function exportHcAgency(){const a=EMP.lastAct||[];hcCsv('Headcount by agency'+(EMP.scope||EMP.store?' '+(EMP.scope||EMP.store):''),'Agency',hcGroups(a,e=>e.vendor||'(No agency)'),a);}
function exportHcStore(){const a=EMP.lastAct||[];hcCsv('Headcount by store','Store',storeList().map(c=>[c,a.filter(e=>e.store===c),storeLabel(c)]).filter(g=>g[1].length),a);}
function renderHeadcount(){
  const el=document.getElementById('mgHead');if(!el)return;
  const fs=document.getElementById('mgSite').value,stores=fs?[fs]:storeList();
  const act=allEmps(stores).filter(e=>e.status!=='Removed');
  document.getElementById('mgHeadSub').textContent='Active employees · '+(fs?storeLabel(fs):'all stores');
  const by={};act.forEach(e=>{const v=e.vendor||'(No agency)';(by[v]=by[v]||[]).push(e);});
  const cols=[['Associates',e=>roleOf(e.designation)==='Associate'],['Housekeeping',e=>roleOf(e.designation)==='Housekeeping'],['Sup & TL',e=>/Supervisor|Team Leader/.test(roleOf(e.designation))],...SHIFTS.map(s=>[SHIFT_LBL[s],e=>e.shift===s])];
  const row=(l,L)=>'<td><b>'+esc(l)+'</b></td>'+cols.map(([,f],i)=>'<td class="n'+(i===2?'':'')+'"'+(i===3?' style="border-left:1px solid var(--line)"':'')+'>'+L.filter(f).length+'</td>').join('')+'<td class="n" style="font-weight:700">'+L.length+'</td>';
  const vs=Object.keys(by).sort((a,b)=>by[b].length-by[a].length);
  el.innerHTML='<thead><tr><th>Agency</th>'+cols.map(([l],i)=>'<th class="n"'+(i===3?' style="border-left:1px solid var(--line)"':'')+'>'+l+'</th>').join('')+'<th class="n">Total</th></tr></thead><tbody>'+
    (vs.length?vs.map(v=>'<tr>'+row(v,by[v])+'</tr>').join(''):'<tr><td colspan="8" class="empty">No employees yet — upload a roster</td></tr>')+'</tbody>'+(vs.length?'<tfoot><tr>'+row('Total',act)+'</tr></tfoot>':'');
}
