// ═══ Darkstore Roster Pro — hourly floor count (week off excluded, overlaps counted) ═══
const HR={mode:'plan',sel:null};
function hmOf(s){const m=String(s??'').trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);if(!m)return null;let h=+m[1];const ap=(m[3]||'').toLowerCase();if(ap==='p'&&h<12)h+=12;if(ap==='a'&&h===12)h=0;return h>23?null:h+(+m[2]||0)/60;}
function spanOf(t){const r=splitRange(t);if(!r)return null;const a=hmOf(r[0]);let b=hmOf(r[1]);if(a==null||b==null)return null;if(b<=a)b+=24;return [a,b];}
const hrCounts=p=>HR.mode==='act'?p.status==='Present':p.status!=='Week Off';
// hours (0–47 on the person's date) the person fully covers
function hrHours(p){const s=spanOf(p.time);if(!s)return [];const o=[];for(let h=Math.ceil(s[0]);h+1<=s[1];h++)o.push(h);return o;}
function hourlyFor(code,date,role){
  const cnt=Array(24).fill(0),who=Array.from({length:24},()=>[]);let est=false;
  const prev=addDays(date,-1),prevSrc=getRoster(code,prev)?prev:(getRoster(code,addDays(prev,7))?(est=true,addDays(prev,7)):null);
  [[date,0],[prevSrc,24]].forEach(([d,off])=>{
    if(!d)return;const r=dayPeople(code,d);if(!r.hasRoster)return;
    if(off&&est)r.people=r.people.map(p=>Object.assign({},p,{status:p.status==='Week Off'?'Week Off':'Present',confirmed:false}));
    r.people.filter(p=>roleOk(p,role)&&hrCounts(p)).forEach(p=>hrHours(p).forEach(h=>{const x=h-off;if(x>=0&&x<24){cnt[x]++;who[x].push(Object.assign({store:code},p));}}));
  });
  return {cnt,who,est:est&&!!getRoster(code,date),has:!!getRoster(code,date)};
}
function hrRows(){
  const from=document.getElementById('mgFrom').value,to=document.getElementById('mgTo').value;
  const fs=document.getElementById('mgSite').value,role=document.getElementById('mgRole').value;
  const stores=fs?[fs]:storeList(),dates=rangeDates(from,to),byStore=!fs&&from===to&&stores.length>1;
  const sum=list=>{const cnt=Array(24).fill(0),who=Array.from({length:24},()=>[]);let has=false,est=false;list.forEach(x=>{has=has||x.has;est=est||x.est;x.cnt.forEach((v,i)=>{cnt[i]+=v;who[i].push(...x.who[i]);});});return {cnt,who,has,est};};
  if(byStore) return {byStore,role,rows:stores.map(s=>Object.assign({key:s,label:s,sub:siteOf(s)||''},hourlyFor(s,from,role)))};
  return {byStore,role,rows:dates.map(d=>Object.assign({key:d,label:dayName(d).toUpperCase(),sub:fmtDate(d,{day:'numeric',month:'short'})},sum(stores.map(s=>hourlyFor(s,d,role)))))};
}
function renderHourly(){
  const el=document.getElementById('mgPaneHr');if(!el||el.hidden)return;
  const R=MG.hr=hrRows(),rows=R.rows.filter(r=>r.has),max=Math.max(1,...rows.flatMap(r=>r.cnt));
  const roleL={Associate:'Associates','':'All roles',Lead:'Supervisors & TLs',Housekeeping:'Housekeeping'}[R.role]||R.role;
  let h='<div class="card"><div class="card-h"><div><h3>'+esc(roleL)+' on floor per hour</h3><div class="sub">Week off excluded · a person counts in an hour when their shift covers the full hour · overnight hours count on the next day'+(R.byStore?' · one row per store':'')+'</div><div class="hr-lg"><span class="hi">High ≥80% of peak</span><span class="mid">Normal</span><span class="thin">Thin &lt;55%</span><span class="z">Nobody</span></div></div>'+
    '<div class="row" style="gap:8px"><div class="vsw"><button onclick="hrWeek(-7)">‹ Week</button><button onclick="hrWeek(7)">Week ›</button></div><div class="vsw">'+[['plan','Rostered'],['act','Actual']].map(([v,l])=>'<button class="'+(HR.mode===v?'on':'')+'" onclick="HR.mode=\''+v+'\';HR.sel=null;renderHourly()">'+l+'</button>').join('')+'</div><button class="btn sm" onclick="exportHourly()">Export CSV</button></div></div>';
  if(!rows.length){el.innerHTML=h+'<div class="empty">No roster in this range.</div></div>';return;}
  h+='<div class="tw"><table class="t hr"><thead><tr><th>'+(R.byStore?'Store':'Day')+'</th>'+Array.from({length:24},(_,i)=>'<th class="hc">'+i+'</th>').join('')+'<th class="n">Peak</th><th class="n">Low</th></tr></thead><tbody>';
  rows.forEach(r=>{
    const mh=r.cnt.reduce((a,b)=>a+b,0),pk=Math.max(...r.cnt),lo=Math.min(...r.cnt);
    h+='<tr><td><b>'+esc(r.label)+'</b><div class="meta-c">'+esc(r.sub)+(r.est?' · <span title="No roster for the day before — hours after midnight use the same weekday from the next week, like the Excel sheet" style="color:var(--warn)">0–8h est.</span>':'')+'</div></td>'+r.cnt.map((v,i)=>{const a=pk?v/pk:0,sel=HR.sel&&HR.sel[0]===r.key&&HR.sel[1]===i,band=!v?'z':a>=.8?'hi':a<.55?'thin':'mid';
      return '<td class="hc '+band+(sel?' sel':'')+(v===lo?' lo':'')+'" onclick="HR.sel=[\''+r.key+'\','+i+'];renderHourly()" title="'+i+':00–'+(i+1)+':00 · '+v+'">'+v+'</td>';}).join('')+
      '<td class="n">'+pk+'</td><td class="n'+(lo===0?' bad':'')+'">'+lo+'</td></tr>';
  });
  h+='</tbody></table></div>';
  if(HR.sel){const r=rows.find(x=>x.key===HR.sel[0]);if(r){const i=HR.sel[1],L=r.who[i].slice().sort((a,b)=>(a.time||'').localeCompare(b.time||'')||a.name.localeCompare(b.name));
    h+='<div class="card-b" style="border-top:1px solid var(--line)"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>'+esc(r.label)+' '+esc(r.sub)+' · '+i+':00–'+(i+1)+':00 · '+L.length+' on floor</b><button class="btn xs" onclick="HR.sel=null;renderHourly()">Close</button></div>'+
      (L.length?'<div class="tw"><table class="t"><thead><tr>'+(R.byStore||!document.getElementById('mgSite').value?'<th>Store</th>':'')+'<th>Name</th><th>Designation</th><th>Agency</th><th>Timing</th><th>Status</th></tr></thead><tbody>'+
      L.map(p=>'<tr>'+(R.byStore||!document.getElementById('mgSite').value?'<td class="mono">'+esc(p.store)+'</td>':'')+'<td><b>'+esc(p.name)+'</b></td><td>'+esc(p.designation)+'</td><td>'+esc(p.vendor||'—')+'</td><td class="mono">'+esc(p.time)+'</td><td>'+(p.confirmed?esc(p.status):'<span class="pill warn xs">Pending</span>')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Nobody on floor this hour</div>')+'</div>';}}
  el.innerHTML=h+'</div>';
}
function exportHourly(){
  const R=MG.hr||hrRows(),rows=R.rows.filter(r=>r.has);
  const out=[[(R.byStore?'Store':'Day'),(R.byStore?'Site':'Date'),...Array.from({length:24},(_,i)=>String(i)),'Peak','Lowest']];
  rows.forEach(r=>out.push([r.label,R.byStore?r.sub:r.key,...r.cnt,Math.max(...r.cnt),Math.min(...r.cnt)]));
  downloadCsv('Hourly floor count '+(HR.mode==='act'?'actual ':'rostered ')+document.getElementById('mgFrom').value+' to '+document.getElementById('mgTo').value+'.csv',out);
}
function hrWeek(n){const f=document.getElementById('mgFrom'),t=document.getElementById('mgTo');f.value=addDays(f.value,n);t.value=addDays(f.value,6);HR.sel=null;mgChange();}
function hrEnter(){const f=document.getElementById('mgFrom'),t=document.getElementById('mgTo');if(f.value===t.value){f.value=addDays(f.value,-((dOf(f.value).getDay()+6)%7));t.value=addDays(f.value,6);}}
