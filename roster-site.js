// ═══ Darkstore Roster Pro — shell + store screens ═══
let SESSION=null; // {type:'site',store} | {type:'mgr'}
const ST={tab:'today',date:todayIso(),marks:{},dirty:false,unlocked:{},rFrom:null,preview:null,edit:null,q:''};

function toast(msg,bad){const t=document.getElementById('toast');t.textContent=msg;t.className='toast on'+(bad?' bad':'');clearTimeout(t._h);t._h=setTimeout(()=>t.className='toast',3200);}
function toggleTheme(){const d=document.documentElement.getAttribute('data-theme')==='dark';document.documentElement.setAttribute('data-theme',d?'light':'dark');try{localStorage.setItem('ds_theme',d?'light':'dark');}catch(e){}}
function show(id){document.querySelectorAll('.scr').forEach(s=>s.classList.toggle('on',s.id===id));window.scrollTo(0,0);}

let pwCb=null;
function askPw(msg,cb){pwCb=cb;document.getElementById('pwMsg').textContent=msg;document.getElementById('pwInp').value='';document.getElementById('pwModal').classList.add('on');setTimeout(()=>document.getElementById('pwInp').focus(),50);}
function pwClose(){document.getElementById('pwModal').classList.remove('on');pwCb=null;}
function pwOk(){if(document.getElementById('pwInp').value!==ADMIN_PW){toast('Wrong password',true);document.getElementById('pwInp').value='';return;}const cb=pwCb;pwClose();cb&&cb();}

async function boot(){
  try{await rdInit();}catch(e){document.getElementById('lgStatus').textContent='Offline — check connection';return;}
  fillLogin();
  try{const s=JSON.parse(sessionStorage.getItem('rp_session')||'null');if(s&&s.type==='site'&&pinOf(s.store))openSite(s.store);else if(s&&s.type==='mgr')openMgr();}catch(e){}
}
function fillLogin(){
  document.getElementById('lgSite').innerHTML='<option value="">Select your store</option>'+storeList().map(c=>'<option value="'+esc(c)+'">'+esc(storeLabel(c))+'</option>').join('');
  document.getElementById('lgStatus').textContent='Connected · '+storeList().length+' stores';
}
function siteLogin(){
  const store=document.getElementById('lgSite').value,pin=document.getElementById('lgPin').value.trim();
  if(!store){toast('Select your store',true);return;}
  if(pin!==pinOf(store)){toast('Wrong PIN for '+store,true);document.getElementById('lgPin').value='';return;}
  document.getElementById('lgPin').value='';openSite(store);
}
function mgrLogin(){
  if(document.getElementById('lgAdmin').value!==ADMIN_PW){toast('Wrong password',true);return;}
  document.getElementById('lgAdmin').value='';openMgr();
}
function logout(){SESSION=null;sessionStorage.removeItem('rp_session');(window._unsubs||[]).forEach(u=>{try{u()}catch(e){}});window._unsubs=[];show('scr-login');}

// ─── STORE ───
async function openSite(store){
  SESSION={type:'site',store};sessionStorage.setItem('rp_session',JSON.stringify(SESSION));
  document.getElementById('stName').textContent=store;
  document.getElementById('stSub').textContent='Loading…';
  show('scr-site');
  const t=todayIso();ST.date=t;ST.rFrom=t;ST.preview=null;ST.edit=null;
  document.getElementById('stToday').innerHTML='<div class="loading"><span class="spin"></span></div>';
  await Promise.all([loadRosters(addDays(t,-40),addDays(t,45)),loadDays(addDays(t,-40),t),loadEmps()]);
  if(RD.err) toast('Could not load data: '+RD.err,true);
  await backfillEmps();
  const re=()=>{if(!ST.dirty&&!ST.edit&&!ST.preview)renderSite();};
  window._unsubs=[listenRosters(addDays(t,-40),addDays(t,45),re),listenDays(addDays(t,-40),t,re),listenEmps(()=>{if(ST.tab==='emp')renderEmployees('stEmp',SESSION.store);})];
  loadMarks();siteTab('today');
}
function siteTab(t){
  ST.tab=t;
  document.querySelectorAll('#scr-site .tab').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  document.getElementById('stToday').hidden=t!=='today';
  document.getElementById('stRoster').hidden=t!=='roster';
  document.getElementById('stHist').hidden=t!=='hist';
  document.getElementById('stEmp').hidden=t!=='emp';
  renderSite();
}
function renderSite(){
  const store=SESSION&&SESSION.store;if(!store) return;
  const r=getRoster(store,todayIso()),site=siteOf(store);
  document.getElementById('stSub').textContent=(site?site+' · ':'')+(r?r.rows.length+' on today\'s roster':'No roster for today');
  if(ST.tab==='today')renderToday();else if(ST.tab==='roster')renderRoster();else if(ST.tab==='emp'){document.getElementById('stFoot').hidden=true;renderEmployees('stEmp',store);}else renderHist();
}
function loadMarks(){const d=getDay(SESSION.store,ST.date);ST.marks=Object.assign({},(d&&d.marks)||{});ST.dirty=false;ST.dirtyShifts=new Set();}

// ─── TODAY: mark exceptions, confirm each shift separately ───
function isLocked(){return ST.date<todayIso()&&!ST.unlocked[ST.date];}
function setDate(v){if(!v)return;if(v>todayIso()){toast('Cannot mark a future date',true);v=todayIso();}ST.date=v;loadMarks();renderToday();}
function shiftOfKey(k){const r=getRoster(SESSION.store,ST.date),x=r&&r.rows.find(y=>nk(y.name)===k);return x?x.shift:null;}
const hm=iso=>new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
function renderToday(){
  const store=SESSION.store,el=document.getElementById('stToday'),foot=document.getElementById('stFoot');
  if(!ST.dirtyShifts)ST.dirtyShifts=new Set();
  const res=dayPeople(store,ST.date,ST.dirty?ST.marks:null),locked=isLocked();
  let h='<div class="row mb" style="justify-content:space-between"><div class="row"><label class="fld">Date<input class="inp" type="date" value="'+ST.date+'" max="'+todayIso()+'" onchange="setDate(this.value)"/></label>'+
    '<div style="padding-bottom:8px;font-weight:600">'+dayName(ST.date)+'</div></div>'+
    (res.hasRoster?'<input class="inp" placeholder="Search name or agency" value="'+esc(ST.q)+'" oninput="ST.q=this.value;renderToday()" style="width:220px"/>':'')+'</div>';
  if(!res.hasRoster){
    el.innerHTML=h+'<div class="note bad"><b>No roster for '+fmtDate(ST.date)+'.</b> Upload the roster for this date before marking attendance.</div><button class="btn pri" onclick="ST.rFrom=ST.date;siteTab(\'roster\')">Upload roster</button>';
    foot.hidden=true;return;
  }
  if(res.confirmed) h+='<div class="note ok"><b>All shifts confirmed.</b> '+(locked?'Unlock with admin password to change.':'You can still change a shift and press Update.')+'</div>';
  else if(res.partial) h+='<div class="note warn"><b>'+res.done.length+' of '+res.shifts.length+' shifts confirmed.</b> Confirm each shift once its people have started — no need to wait for end of day.</div>';
  else h+='<div class="note warn"><b>No shift confirmed yet.</b> Everyone is Present by default. Mark only Absent, Sick or week-off changes, then press Confirm on that shift.</div>';
  if(locked) h+='<div class="row mb"><button class="btn" onclick="askPw(\'Editing a past day needs the admin password.\',()=>{ST.unlocked[ST.date]=true;renderToday();})">Unlock past day</button></div>';
  const q=nk(ST.q),ppl=res.people.filter(p=>!q||nk(p.name).includes(q)||nk(p.vendor).includes(q));
  const order={'Supervisor':0,'Team Leader':1,'Associate':2,'Housekeeping':3};
  SHIFTS.forEach(sh=>{
    const all=res.people.filter(p=>p.shift===sh);if(!all.length) return;
    const g=ppl.filter(p=>p.shift===sh).sort((a,b)=>(order[a.role]-order[b.role])||a.name.localeCompare(b.name));
    const t=tally(all),conf=res.sc[sh],dirty=ST.dirtyShifts.has(sh);
    h+='<div class="card shift-grp"><div class="shift-h"><div><span>'+SHIFT_LBL[sh]+' shift</span> <span class="c">'+t.total+' total · '+t.weekOff+' WO · '+t.present+' P · '+(t.absent+t.sick)+' A</span></div>'+
      '<div class="row" style="gap:8px">'+(conf?'<span class="pill ok">Confirmed '+hm(conf.at)+'</span>':'<span class="pill warn">Pending</span>')+(dirty?'<span class="pill bad">Unsaved</span>':'')+
      '<button class="btn sm '+(!conf||dirty?'pri':'')+'"'+(locked?' disabled':'')+' onclick="doConfirmShift(\''+sh+'\',this)">'+(conf?'Update ':'Confirm ')+SHIFT_LBL[sh]+'</button></div></div><ul class="ppl">';
    const slots={};g.forEach(p=>{const k=p.status==='Week Off'?'~WO':(p.time||'Working on week off');(slots[k]=slots[k]||[]).push(p);});
    Object.keys(slots).sort((a,b)=>(a==='~WO')-(b==='~WO')||slotKey(a,sh)-slotKey(b,sh)).forEach(sk=>{
      const sg=slots[sk],st=tally(sg);
      h+='<li class="slot-h"><span>'+(sk==='~WO'?'Week Off':esc(sk))+'</span><span>'+sg.length+(sk==='~WO'?'':' · <b class="'+(st.absent+st.sick?'bad':'')+'">'+(st.absent+st.sick)+' out</b>')+'</span></li>';
      sg.forEach(p=>{
        const lead=p.role==='Supervisor'||p.role==='Team Leader',k=esc(nk(p.name)).replace(/'/g,"\\'");
        h+='<li class="pp'+(lead?' lead':'')+'"><div style="min-width:0"><div class="nm" data-role="'+esc(p.role)+'">'+esc(p.name)+'</div><div class="meta">'+esc([p.designation,p.vendor,p.time].filter(Boolean).join(' · '))+'</div></div>';
        const dis=locked?' aria-disabled="true"':'',chg=p.woChanged?'<span class="wo-chg">WO changed</span>':'';
        if(p.rosterOff) h+='<div class="row" style="gap:6px;justify-content:flex-end">'+chg+'<div class="seg"'+dis+'><button class="w'+(p.status==='Week Off'?' on':'')+'" onclick="mark(\''+k+'\',\'~\')">Week Off</button><button class="p'+(p.status==='Present'?' on':'')+'" onclick="mark(\''+k+'\',\'Working\')" title="Came to work on rostered week off">Working</button></div></div>';
        else h+='<div class="row" style="gap:6px;justify-content:flex-end">'+chg+'<div class="seg"'+dis+'>'+[['Present','p','P'],['Absent','a','A'],['Sick Leave','s','Sick'],['Week Off','w','WO']].map(([v,c,l])=>'<button class="'+c+(p.status===v?' on':'')+'" onclick="mark(\''+k+'\',\''+v+'\')"'+(v==='Week Off'?' title="Week off moved to today"':'')+'>'+l+'</button>').join('')+'</div></div>';
        h+='</li>';
      });
    });
    if(!g.length) h+='<li class="empty">No match</li>';
    h+='</ul></div>';
  });
  el.innerHTML=h;
  const t=tally(res.people);
  foot.hidden=false;
  foot.innerHTML='<div class="sum"><span>Total <b>'+t.total+'</b></span><span class="wo">WO <b>'+t.weekOff+'</b></span><span>Rostered <b>'+t.rostered+'</b></span><span class="ok">Present <b>'+t.present+'</b></span><span class="bad">Absent <b>'+t.absent+'</b></span><span class="sick">Sick <b>'+t.sick+'</b></span><span>Absenteeism <b>'+pctTxt(t.absPct)+'</b></span></div>'+
    '<div class="row"><span style="font-size:13px;color:var(--ink2)"><b>'+res.done.length+'/'+res.shifts.length+'</b> shifts confirmed</span>'+(ST.dirty?'<button class="btn" onclick="loadMarks();renderToday()">Discard changes</button>':'')+'</div>';
}
function mark(key,status){
  if(isLocked())return;
  if(status==='Present'||status==='~')delete ST.marks[key];else ST.marks[key]=status;
  const sh=shiftOfKey(key);if(sh)ST.dirtyShifts.add(sh);
  ST.dirty=true;renderToday();
}
async function doConfirmShift(sh,btn){
  btn.disabled=true;btn.innerHTML='<span class="spin"></span> Saving';
  try{
    await confirmShift(SESSION.store,ST.date,sh,ST.marks,SESSION.store);
    ST.dirtyShifts.delete(sh);ST.dirty=ST.dirtyShifts.size>0;if(!ST.dirty)loadMarks();
    toast(SHIFT_LBL[sh]+' shift saved · '+fmtDate(ST.date));
  }catch(e){toast('Save failed: '+e.message,true);}
  renderToday();
}

// ─── HISTORY ───
function renderHist(){
  const store=SESSION.store;let h='<div class="card"><div class="card-h"><h3>Last 5 weeks</h3><span class="sub">Click a day to open it</span></div><div class="tw"><table class="t"><thead><tr><th>Date</th><th>Day</th><th>Status</th><th class="n">Total</th><th class="n">WO</th><th class="n">Present</th><th class="n">Absent</th><th class="n">Sick</th><th class="n">Absenteeism</th></tr></thead><tbody>';
  for(let d=todayIso(),i=0;i<35;i++,d=addDays(d,-1)){
    const r=dayPeople(store,d),t=tally(r.people);
    const st=!r.hasRoster?'<span class="pill mute">No roster</span>':r.confirmed?'<span class="pill ok">Confirmed</span>':r.partial?'<span class="pill warn">'+r.done.length+'/'+r.shifts.length+' shifts</span>':'<span class="pill warn">Pending</span>';
    h+='<tr class="click" onclick="ST.date=\''+d+'\';loadMarks();siteTab(\'today\')"><td>'+fmtDate(d)+'</td><td>'+dayName(d).slice(0,3)+'</td><td>'+st+'</td>'+
      (r.hasRoster?'<td class="n">'+t.total+'</td><td class="n wo">'+t.weekOff+'</td><td class="n ok">'+t.present+'</td><td class="n bad">'+t.absent+'</td><td class="n sick">'+t.sick+'</td><td class="n">'+pctTxt(t.absPct)+'</td>':'<td colspan="6"></td>')+'</tr>';
  }
  document.getElementById('stHist').innerHTML=h+'</tbody></table></div></div>';
  document.getElementById('stFoot').hidden=true;
}
