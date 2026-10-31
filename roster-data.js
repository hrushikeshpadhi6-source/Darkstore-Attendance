// ═══ Darkstore Roster Pro — data layer (Firebase) ═══
const FB_CONFIG={apiKey:"AIzaSyDcxK2x1xeFftXX6Xg1tXoGs1WVpV5YY9k",authDomain:"darkstore-attendance.firebaseapp.com",projectId:"darkstore-attendance",storageBucket:"darkstore-attendance.firebasestorage.app",messagingSenderId:"675191225861",appId:"1:675191225861:web:67b88319db36e96e89e66c"};
// Passwords are stored only as SHA-256 hashes (meta/auth in Firebase; these are first-run defaults). Change them in Operations → Stores.
const PW_DEF={admin:'ef41508be60646ecf44297c3b94f89a6e9089b6f289c3d7ed6d5c40411b74bb0',ops:'6e363346c4da55e75ff5ae511aa8afd39a6eaabfcbc80e7c817859f5d8ecdd5f'};
async function pwHash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('rp|'+String(s||'')));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function pwCheck(kind,v){return (await pwHash(v))===((RD.auth||{})[kind]||PW_DEF[kind]);}
async function pwSave(kind,v){const h=await pwHash(v);RD.auth=Object.assign({},PW_DEF,RD.auth||{},{[kind]:h});await tmo(db.collection('meta').doc('auth').set({admin:RD.auth.admin,ops:RD.auth.ops,updatedAt:new Date().toISOString()}),8000);}
const BASE_PINS={"Al Raha":"1001","Yas Mall":"1002","MBZ":"1003","Khalifa City":"1004","Al Qusais":"1005","Business Bay":"1006","NIP":"1007","Sharjah Central":"1008"};
// First-run store list: code → linked site (PIN follows the site; unlinked stores get 1010, 1011…). Editable in Manager → Stores.
const SEED_STORES={QAA1:'MBZ',QAA6:'',QAA7:'Al Raha',QDG8:'DIFC DUBAI',QDD3:'Yas Mall',QDG5:'',QDC6:'Al Qusais',QHA5:'Sharjah Central'};
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS=['','January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SHIFTS=['DAY','EVENING','NIGHT'];
const SHIFT_LBL={DAY:'Day',EVENING:'Evening',NIGHT:'Night'};
const SHIFT_ABC={DAY:'A',EVENING:'B',NIGHT:'C'}; // classic app shift letters

let db=null;
const RD={pins:{},stores:{},emps:{},rosters:{},days:{},err:null};

// ─── dates (local yyyy-mm-dd) ───
const pad=n=>String(n).padStart(2,'0');
function isoOf(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function dOf(iso){const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d);}
function todayIso(){return isoOf(new Date());}
function addDays(iso,n){const d=dOf(iso);d.setDate(d.getDate()+n);return isoOf(d);}
function dayName(iso){return DAYS[(dOf(iso).getDay()+6)%7];}
function fmtDate(iso,opt){return dOf(iso).toLocaleDateString('en-GB',opt||{day:'numeric',month:'short',year:'numeric'});}
function fmtHead(iso){const d=dOf(iso);return pad(d.getDate())+'-'+MON3[d.getMonth()]+'-'+d.getFullYear()+' ('+dayName(iso).slice(0,3)+')';}
function fmtDateCol(iso){const d=dOf(iso);return pad(d.getDate())+'-'+MON3[d.getMonth()]+'-'+d.getFullYear();}
function fmtShort(iso){const d=dOf(iso);return dayName(iso).slice(0,3)+' '+d.getDate()+' '+MON3[d.getMonth()];}
function rangeDates(a,b){const out=[];for(let x=a;x<=b;x=addDays(x,1))out.push(x);return out;}
function parseDateHead(v,mdy){
  if(typeof v==='number'&&v>30000&&v<80000){const d=new Date(Math.round((v-25569)*864e5));return isoOf(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));}
  const t=String(v||'').replace(/\(.*?\)/g,'').replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b,?/ig,'').trim();
  if(!t) return null;
  const yf=y=>y?(y<100?2000+y:y):null;
  const mi=s=>MON3.findIndex(x=>x.toLowerCase()===String(s).slice(0,3).toLowerCase())+1;
  const mk=(y,mo,d)=>{if(!(mo>=1&&mo<=12&&d>=1&&d<=31))return null;
    if(!y){const now=new Date();y=now.getFullYear();const c=new Date(y,mo-1,d);if(c-now>200*864e5)y--;else if(now-c>165*864e5)y++;}
    const dt=new Date(y,mo-1,d);return dt.getMonth()===mo-1?isoOf(dt):null;};
  let m;
  if(m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))return mk(+m[1],+m[2],+m[3]);
  if(m=t.match(/^(\d{1,2})[\s\-\/.]*([a-z]{3,9})[\s\-\/.,]*(\d{2,4})?$/i)){const mo=mi(m[2]);return mo?mk(yf(+m[3]||0),mo,+m[1]):null;}
  if(m=t.match(/^([a-z]{3,9})[\s\-\/.]*(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]*(\d{2,4})?$/i)){const mo=mi(m[1]);return mo?mk(yf(+m[3]||0),mo,+m[2]):null;}
  if(m=t.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/))return mdy?mk(yf(+m[3]||0),+m[1],+m[2]):mk(yf(+m[3]||0),+m[2],+m[1]);
  return null;
}

// ─── text helpers ───
const nk=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const sid=s=>String(s||'').trim().replace(/[\/#\[\]\.]/g,'-');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const tmo=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms||8000))]);
function roleOf(desig){const d=nk(desig);if(/supervisor/.test(d))return 'Supervisor';if(/team\s*lead|^tl$/.test(d))return 'Team Leader';if(/house\s*-?\s*keep|cleaner/.test(d))return 'Housekeeping';return 'Associate';}
function normDesig(d){d=String(d||'').trim();if(/^warehouse\s+associate$/i.test(d))return 'Warehouse Assistant';if(/^house\s*-?\s*keep(ing|er)?$/i.test(d))return 'Housekeeping';if(/^(tl|team\s*lead(er)?)$/i.test(d))return 'Team Leader';return d||'Associate';}
function normDay(s){const t=nk(s);if(!t)return '';if(/^(none|no|nil|-|na|n\/a)$/.test(t))return 'None';return DAYS.find(d=>d.toLowerCase().startsWith(t.slice(0,3)))||'';}
function normShift(s){const t=nk(s).replace(/\s*shift$/,'');if(/^(day|morning|morn|general|gen|a)$/.test(t))return 'DAY';if(/^(evening|eve|afternoon|mid|b)$/.test(t))return 'EVENING';if(/^(night|c)$/.test(t))return 'NIGHT';return null;}
function parseHour(s){
  if(typeof s==='number'&&s>=0&&s<1) return Math.floor(s*24);
  const m=String(s??'').trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);if(!m)return null;
  let h=+m[1];const ap=(m[3]||'').toLowerCase();if(ap==='p'&&h<12)h+=12;if(ap==='a'&&h===12)h=0;return h>23?null:h;
}
function shiftFromHour(h){return h==null?null:(h>=5&&h<14)?'DAY':(h>=14&&h<22)?'EVENING':'NIGHT';}
function isOffCell(s){return /^(week\s*-?\s*off|wo|w\/o|off|rest|holiday)$/i.test(String(s||'').trim());}
function splitRange(s){const p=String(s||'').split(/\s*(?:-|–|—|\bto\b)\s*/i).filter(Boolean);return p.length>=2?[p[0].trim(),p[1].trim()]:null;}
function slotStart(t){const r=splitRange(t);return r?r[0]:'';}
function slotKey(t,shift){const h=parseHour(slotStart(t));if(h==null)return 99;return shift==='NIGHT'&&h<12?h+24:h;}
const shortTime=t=>String(t||'').replace(/:00/g,'').replace(/\s*AM/gi,'a').replace(/\s*PM/gi,'p').replace(/\s*-\s*/,'–');

// ─── init / reference data ───
async function rdInit(){
  if(db) return true;
  try{firebase.initializeApp(FB_CONFIG);}catch(e){}
  db=firebase.firestore();
  try{db.enablePersistence({synchronizeTabs:true}).catch(()=>{});}catch(e){}
  let storesDoc=null,storesRead=false,pinsRead=false;
  await Promise.all([
    tmo(db.collection('meta').doc('auth').get(),9000).then(d=>{if(d&&d.exists)RD.auth=d.data();}).catch(()=>{}),
    tmo(db.collection('meta').doc('sitePins').get(),9000).then(d=>{if(d){pinsRead=true;RD.pins=Object.assign({},BASE_PINS,(d.exists&&d.data().pins)||{});}else RD.pins=Object.assign({},BASE_PINS);}).catch(()=>{RD.pins=Object.assign({},BASE_PINS);}),
    tmo(db.collection('meta').doc('stores').get(),9000).then(d=>{if(d){storesRead=true;storesDoc=d.exists?d.data().stores:null;}}).catch(()=>{})
  ]);
  if(!Object.keys(RD.pins).length) RD.pins=Object.assign({},BASE_PINS);
  if(storesDoc&&Object.keys(storesDoc).length){RD.stores=storesDoc;RD.storesOk=true;try{localStorage.setItem('rp_stores',JSON.stringify(storesDoc));}catch(e){}}
  else if(storesRead&&pinsRead){
    // Seed ONLY when both reads succeeded and the stores doc truly doesn't exist
    RD.stores={};
    Object.entries(SEED_STORES).forEach(([c,s])=>{RD.stores[c]={site:s,pin:(s&&RD.pins[s])||nextPin()};});
    RD.storesOk=true;
    tmo(db.collection('meta').doc('stores').set({stores:RD.stores,updatedAt:new Date().toISOString()}),8000).catch(()=>{});
  }else{
    // Slow/failed read: use cached copy, never write
    try{RD.stores=JSON.parse(localStorage.getItem('rp_stores')||'{}')||{};}catch(e){RD.stores={};}
    RD.storesOk=false;RD.err=RD.err||'Store list did not load — check connection and refresh';
  }
  return true;
}
function storeList(){return Object.keys(RD.stores).sort();}
function pinOf(c){return (RD.stores[c]||{}).pin||null;}
function siteOf(c){return (RD.stores[c]||{}).site||'';}
function storeLabel(c){const s=siteOf(c);return s?c+' — '+s:c;}
function siteList(){return Object.keys(RD.pins).filter(x=>x&&!/^[a-z]{2,4}\d{1,3}$/i.test(x)).sort();}
function nextPin(){const used=new Set([...Object.values(RD.pins),...Object.values(RD.stores||{}).map(x=>x.pin)]);let n=1010;while(used.has(String(n)))n++;return String(n);}
async function saveStores(){if(!RD.storesOk)throw new Error('Store list not loaded — refresh first');try{localStorage.setItem('rp_stores',JSON.stringify(RD.stores));}catch(e){}await tmo(db.collection('meta').doc('stores').set({stores:RD.stores,updatedAt:new Date().toISOString()}),8000);}
// ─── employee master: meta/emp__{store} = {store,list:[{name,designation,vendor,shift,start,end,weekOff,joinDate,status,…}]} ───
// Built only from Roster Pro (roster uploads + Employees tab). Nothing is read from the classic app.
function empKey(store){return 'emp__'+sid(store);}
function empQ(){return db.collection('meta').where(firebase.firestore.FieldPath.documentId(),'>=','emp__').where(firebase.firestore.FieldPath.documentId(),'<=','emp__~');}
async function loadEmps(){RD.empsOk=false;try{const s=await tmo(empQ().get(),12000);if(s){s.docs.forEach(x=>{const v=x.data();RD.emps[v.store]=v.list||[];});RD.empsOk=true;}}catch(e){console.warn('loadEmps',e);RD.err=e.message;}}
// One-time: stores whose roster was uploaded before the employee list existed get their list built from the latest roster.
// Writes only when the employee read actually succeeded (never on a slow/failed load).
async function backfillEmps(){
  if(!RD.empsOk) return 0;
  let n=0;
  for(const store of storeList()){
    if(RD.emps[store]) continue;
    const r=latestRoster(store);if(!r||!r.rows||!r.rows.length) continue;
    const res=mergeEmps(store,r.rows.map(x=>({name:x.name,designation:x.designation,vendor:x.vendor,defShift:x.defShift||x.shift,weekOff:x.weekOff,start:x.start,end:x.end})),'roster backfill');
    try{await saveEmps(store,res.list);n++;}catch(e){console.warn('backfill',store,e);}
  }
  return n;
}
function listenEmps(cb){return empQ().onSnapshot(s=>{s.docChanges().forEach(c=>{const v=c.doc.data();if(c.type==='removed')delete RD.emps[v.store];else RD.emps[v.store]=v.list||[];});cb&&cb();},e=>console.warn('emps listen',e));}
function empsOf(store,all){return (RD.emps[store]||[]).filter(e=>all||e.status!=='Removed');}
async function saveEmps(store,list){RD.emps[store]=list;const r=await tmo(db.collection('meta').doc(empKey(store)).set({store,list,updatedAt:new Date().toISOString()}),8000);return r;}
// Add new names from a roster, update details of existing ones, re-activate removed ones that are rostered again
function mergeEmps(store,people,by){
  const list=JSON.parse(JSON.stringify(RD.emps[store]||[])),now=new Date().toISOString(),res={added:[],reactivated:[],list};
  people.forEach(x=>{
    const k=nk(x.name),e=list.find(y=>nk(y.name)===k);
    const f={designation:x.designation,vendor:x.vendor||'',shift:x.defShift||x.shift,start:x.start||'',end:x.end||'',weekOff:x.weekOff||''};
    if(!e){list.push(Object.assign({name:x.name,status:'Active',joinDate:x.joinDate||todayIso(),addedAt:now,addedBy:by,source:'roster'},f));res.added.push(x.name);}
    else{if(e.status==='Removed'){e.status='Active';e.reactivatedAt=now;delete e.removedAt;delete e.removedReason;res.reactivated.push(x.name);}
      Object.keys(f).forEach(k2=>{if(f[k2])e[k2]=f[k2];});}
  });
  return res;
}

// ─── storage in 'meta' (allowed by Firestore rules); IDs start with the date so range reads need no index ───
const DOCID=()=>firebase.firestore.FieldPath.documentId();
function rangeQ(prefix,a,b){return db.collection('meta').where(DOCID(),'>=',prefix+a).where(DOCID(),'<=',prefix+b+'~');}
function snapInto(target){return s=>{s.docChanges().forEach(c=>{if(c.type==='removed')delete target[c.doc.id];else target[c.doc.id]=c.doc.data();});};}

// Roster: one doc per store per date → rows [{name,designation,vendor,defShift,weekOff,start,end,shift,off,time}]
function rosterKey(store,date){return 'rost__'+date+'__'+sid(store);}
function getRoster(store,date){return RD.rosters[rosterKey(store,date)]||null;}
function latestRoster(store,beforeOrOn){
  let best=null;Object.values(RD.rosters).forEach(r=>{if(r.store===store&&(!beforeOrOn||r.date<=beforeOrOn)&&(!best||r.date>best.date))best=r;});
  return best||(beforeOrOn?latestRoster(store):null);
}
async function saveRosterDates(store,byDate,by){
  const b=db.batch(),now=new Date().toISOString();
  Object.entries(byDate).forEach(([date,rows])=>{
    const doc={store,site:siteOf(store),date,rows,updatedAt:now,by:by||store};
    RD.rosters[rosterKey(store,date)]=doc;
    b.set(db.collection('meta').doc(rosterKey(store,date)),doc);
  });
  const r=await tmo(b.commit(),10000);
  return r;
}
async function loadRosters(from,to){
  try{const s=await tmo(rangeQ('rost__',from,to).get(),12000);if(s)s.docs.forEach(d=>{RD.rosters[d.id]=d.data();});}
  catch(e){console.warn('loadRosters',e);RD.err=e.message;}
}
function listenRosters(from,to,cb){const f=snapInto(RD.rosters);return rangeQ('rost__',from,to).onSnapshot(s=>{f(s);cb&&cb();},e=>console.warn('rosters listen',e));}

// Store sessions: read/listen only this store's docs by exact ID (much faster than range reads across all stores)
async function loadStoreDocs(store,prefix,from,to,target){
  await Promise.all(rangeDates(from,to).map(dt=>tmo(db.collection('meta').doc(prefix+dt+'__'+sid(store)).get(),12000).then(s=>{if(s&&s.exists)target[s.id]=s.data();}).catch(e=>{RD.err=e.message;})));
}
function listenStoreDocs(store,prefix,from,to,target,cb){
  return rangeDates(from,to).map(dt=>db.collection('meta').doc(prefix+dt+'__'+sid(store)).onSnapshot(s=>{if(s.exists)target[s.id]=s.data();else delete target[s.id];cb&&cb();},e=>console.warn('listen',e)));
}
// Day confirmations
function dayKey(store,date){return 'rday__'+date+'__'+sid(store);}
function getDay(store,date){return RD.days[dayKey(store,date)]||null;}
async function loadDays(from,to){
  try{const s=await tmo(rangeQ('rday__',from,to).get(),12000);if(s)s.docs.forEach(d=>{RD.days[d.id]=d.data();});}
  catch(e){console.warn('loadDays',e);RD.err=e.message;}
}
function listenDays(from,to,cb){const f=snapInto(RD.days);return rangeQ('rday__',from,to).onSnapshot(s=>{f(s);cb&&cb();},e=>console.warn('days listen',e));}

// People + status for one store on one date. Each shift is confirmed separately (day.shifts = {DAY:{at,by},…}).
// marks: 'Absent' | 'Sick Leave' | 'Week Off' (week off moved to today) | 'Working' (came in on rostered week off)
function buildPeople(rows,m){
  return rows.map(x=>{
    const mk=m[nk(x.name)],def=x.start&&x.end?x.start+' - '+x.end:'';
    let status,time=x.off?'':(x.time||''),woChanged=false;
    if(x.off){if(mk==='Working'){status='Present';time=def;woChanged=true;}else status='Week Off';}
    else if(mk==='Week Off'){status='Week Off';woChanged=true;}
    else status=(mk&&mk!=='Working')?mk:'Present';
    return {name:x.name,designation:x.designation,role:roleOf(x.designation),vendor:x.vendor||'',shift:x.shift,time,status,woChanged,rosterOff:!!x.off};
  });
}
function shiftsConf(day){
  if(!day) return {};
  if(day.shifts) return day.shifts;
  if(day.confirmed){const o={};SHIFTS.forEach(s=>o[s]={at:day.confirmedAt,by:day.by});return o;} // older whole-day confirmations
  return {};
}
function dayPeople(store,date,marks){
  const day=getDay(store,date),r=getRoster(store,date),sc=shiftsConf(day),snap=(day&&day.people)||[];
  if(!r&&!snap.length) return {hasRoster:false,confirmed:false,partial:false,day,sc,shifts:[],done:[],people:[]};
  const fresh=r?buildPeople(r.rows,marks||(day&&day.marks)||{}):[],freshSh=new Set(fresh.map(p=>p.shift));
  let people=marks?[...fresh,...snap.filter(p=>sc[p.shift]&&!freshSh.has(p.shift))]
                  :[...snap.filter(p=>sc[p.shift]),...fresh.filter(p=>!sc[p.shift])];
  people=people.map(p=>Object.assign({},p,{confirmed:!!sc[p.shift]}));
  const shs=SHIFTS.filter(s=>people.some(p=>p.shift===s)),done=shs.filter(s=>sc[s]);
  return {hasRoster:true,confirmed:shs.length>0&&done.length===shs.length,partial:done.length>0&&done.length<shs.length,day,sc,shifts:shs,done,people};
}
async function clearShift(store,date,shift,by){
  const day=getDay(store,date);if(!day) return null;
  const r=getRoster(store,date),sc=Object.assign({},shiftsConf(day));delete sc[shift];
  const snap=day.people||[],gone=snap.filter(p=>p.shift===shift);
  const inShift=new Set([...gone.map(p=>nk(p.name)),...(r?r.rows.filter(x=>x.shift===shift).map(x=>nk(x.name)):[])]);
  const marks=Object.assign({},day.marks||{});Object.keys(marks).forEach(k=>{if(inShift.has(k))delete marks[k];});
  const people=snap.filter(p=>p.shift!==shift);
  const t=tally(people.filter(p=>sc[p.shift])),site=day.site||siteOf(store)||store,now=new Date().toISOString();
  const doc=Object.assign({},day,{marks,shifts:sc,confirmed:false,people,clearedAt:now,clearedBy:by||store,
    counts:{total:t.total,weekOff:t.weekOff,present:t.present,absent:t.absent,sick:t.sick}});
  RD.days[dayKey(store,date)]=doc;
  const b=db.batch();b.set(db.collection('meta').doc(dayKey(store,date)),doc);
  const dt=dOf(date),y=dt.getFullYear(),mo=dt.getMonth()+1,dd=dt.getDate();
  gone.forEach(p=>{const sh=SHIFT_ABC[p.shift]||p.shift;
    const id=[site,y,mo,dd,sh,p.name].map(x=>String(x??'').trim().replace(/[\/#\[\]\.]/g,'-')).join('|');
    b.delete(db.collection('attendance').doc(id));});
  await tmo(b.commit(),10000);
  return doc;
}
async function confirmShift(store,date,shift,marks,by){
  const day=getDay(store,date)||{},r=getRoster(store,date);
  if(!r) throw new Error('No roster for this date');
  const prev=shiftsConf(day),sc=Object.assign({},prev),now=new Date().toISOString();
  const inShift=new Set(r.rows.filter(x=>x.shift===shift).map(x=>nk(x.name)));
  const merged=Object.assign({},day.marks||{});
  Object.keys(merged).forEach(k=>{if(inShift.has(k))delete merged[k];});
  Object.entries(marks||{}).forEach(([k,v])=>{if(inShift.has(k))merged[k]=v;});
  sc[shift]={at:now,by:by||store};
  const fresh=buildPeople(r.rows,merged),snap=day.people||[];
  const people=SHIFTS.flatMap(s=>{
    if(s===shift) return fresh.filter(p=>p.shift===s);
    const old=snap.filter(p=>p.shift===s);
    return prev[s]&&old.length?old:fresh.filter(p=>p.shift===s);
  }).map(p=>{const q=Object.assign({},p);delete q.confirmed;return q;});
  const shs=SHIFTS.filter(s=>people.some(p=>p.shift===s)),all=shs.every(s=>sc[s]);
  const t=tally(people.filter(p=>sc[p.shift])),site=siteOf(store)||store;
  const doc={store,site,date,marks:merged,shifts:sc,confirmed:all,confirmedAt:now,by:by||store,people,
    counts:{total:t.total,weekOff:t.weekOff,present:t.present,absent:t.absent,sick:t.sick}};
  RD.days[dayKey(store,date)]=doc;
  const b=db.batch();
  b.set(db.collection('meta').doc(dayKey(store,date)),doc);
  // Mirror this shift into the classic 'attendance' collection so old History/Reports stay complete
  const dt=dOf(date),y=dt.getFullYear(),mo=dt.getMonth()+1,dd=dt.getDate();
  people.filter(p=>p.shift===shift).forEach(p=>{
    const sh=SHIFT_ABC[p.shift]||p.shift;
    const rec={staffName:p.name,site,store,shift:sh,shiftName:p.shift,timing:p.time||'',status:p.status,designation:p.designation,agency:p.vendor,day:String(dd),month:MONTHS[mo],year:String(y),dateKey:y*10000+mo*100+dd,submittedBy:by||store,source:'roster',submittedAt:now};
    const id=[site,y,mo,dd,sh,p.name].map(x=>String(x??'').trim().replace(/[\/#\[\]\.]/g,'-')).join('|');
    b.set(db.collection('attendance').doc(id),rec);
  });
  await tmo(b.commit(),10000);
  return doc;
}

// ─── tally ───
function tally(people){
  const t={total:people.length,weekOff:0,present:0,absent:0,sick:0};
  people.forEach(p=>{if(p.status==='Week Off')t.weekOff++;else if(p.status==='Absent')t.absent++;else if(p.status==='Sick Leave')t.sick++;else t.present++;});
  t.rostered=t.total-t.weekOff;
  t.absPct=t.rostered?((t.absent+t.sick)/t.rostered*100):0;
  return t;
}
const pctTxt=v=>v.toFixed(1)+'%';

// ─── CSV / Excel ───
function csvCell(v){v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function downloadCsv(name,rows){
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}
function parseCsvText(txt){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<txt.length;i++){const c=txt[i];
    if(q){if(c==='"'){if(txt[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}
    else if(c==='"')q=true;else if(c===','||c==='\t'){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;}
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows.filter(r=>r.some(c=>String(c).trim()));
}
// Returns {grid (display text), raw (raw values — Excel date headers arrive as serial numbers)}
async function readSheetFile(file){
  if(/\.(xlsx|xls)$/i.test(file.name)){
    if(!window.XLSX) throw new Error('Excel reader not loaded — save as CSV and try again');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];
    const keep=r=>r.some(c=>String(c).trim());
    return {grid:XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}).filter(keep),raw:XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''}).filter(keep)};
  }
  const g=parseCsvText((await file.text()).replace(/^\ufeff/,''));
  return {grid:g,raw:g};
}
