// ═══ Darkstore Roster Pro — overtime (OT) entry & export ═══
const OT={rows:[],from:null,to:null,store:'',sel:new Set()};
const otId=r=>sid(r.store)+'_'+r.date+'_'+sid(nk(r.name)).replace(/\s/g,'_');
async function otLoad(){
  if(!db){OT.rows=[];return;}
  const s=await tmo(db.collection('ot').where('date','>=',OT.from).where('date','<=',OT.to).get(),10000);
  OT.rows=s?s.docs.map(d=>Object.assign({id:d.id},d.data())):[];
}
async function otEnter(){
  const t=todayIso();
  if(!OT.from){OT.from=t.slice(0,8)+'01';OT.to=t;OT.date=t;OT.store=storeList()[0]||'';}
  renderOt();await otLoad();renderOt();
}
function otPeople(){
  const r=getRoster(OT.store,OT.date),m=new Map();
  empsOf(OT.store).forEach(e=>m.set(nk(e.name),{name:e.name,designation:e.designation||'',vendor:e.vendor||''}));
  if(r)r.rows.forEach(x=>{if(!m.has(nk(x.name)))m.set(nk(x.name),{name:x.name,designation:x.designation||'',vendor:x.vendor||''});});
  return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function renderOt(){
  const el=document.getElementById('mgPaneOt');if(!el)return;
  const ppl=otPeople(),done=new Map(OT.rows.filter(r=>r.store===OT.store&&r.date===OT.date).map(r=>[nk(r.name),r.hours]));
  const q=(OT.q||'').toLowerCase(),vis=ppl.filter(p=>!q||p.name.toLowerCase().includes(q));
  const all=vis.length&&vis.every(p=>OT.sel.has(nk(p.name)));
  let h='<div class="card"><div class="card-h"><div><h3>Add OT</h3><div class="sub">Choose the store and date, tick one or more associates, enter OT hours and save</div></div></div>'+
    '<div class="card-b row">'+
    '<label class="fld">Store<select class="sel" id="otStore" onchange="OT.store=this.value;OT.sel.clear();renderOt()">'+storeList().map(c=>'<option value="'+esc(c)+'"'+(c===OT.store?' selected':'')+'>'+esc(storeLabel(c))+'</option>').join('')+'</select></label>'+
    '<label class="fld">Date<input class="inp" type="date" id="otDate" value="'+OT.date+'" onchange="OT.date=this.value;OT.sel.clear();renderOt()"/></label>'+
    '<label class="fld">OT hours<input class="inp" type="number" id="otHrs" min="0.5" max="16" step="0.5" value="'+(OT.hrs||2)+'" style="width:90px" oninput="OT.hrs=this.value"/></label>'+
    '<label class="fld">Reason (optional)<input class="inp" id="otWhy" value="'+esc(OT.why||'')+'" placeholder="e.g. Peak / short staff" oninput="OT.why=this.value"/></label>'+
    '<button class="btn pri" onclick="otSave()">Save OT for '+OT.sel.size+' selected</button></div>'+
    '<div class="card-b row" style="border-top:1px solid var(--line);padding-top:10px"><input class="inp" placeholder="Search name" value="'+esc(OT.q||'')+'" oninput="OT.q=this.value;renderOt();const i=document.querySelector(\'#mgPaneOt input[placeholder=\\\'Search name\\\']\');i.focus();i.setSelectionRange(99,99)" style="max-width:220px"/><span class="sub">'+ppl.length+' people · '+OT.sel.size+' selected</span></div>';
  h+='<div class="tw"><table class="t"><thead><tr><th style="width:36px"><input type="checkbox"'+(all?' checked':'')+' onchange="otAll(this.checked)"/></th><th>Name</th><th>Designation</th><th>Agency</th><th>OT on '+fmtShort(OT.date)+'</th></tr></thead><tbody>';
  if(!vis.length)h+='<tr><td colspan="5" style="color:var(--ink3)">No associates for this store</td></tr>';
  vis.forEach(p=>{const k=nk(p.name);h+='<tr onclick="otTog(\''+esc(k).replace(/'/g,"\\'")+'\')" style="cursor:pointer"><td><input type="checkbox"'+(OT.sel.has(k)?' checked':'')+' onclick="event.stopPropagation();otTog(\''+esc(k).replace(/'/g,"\\'")+'\')"/></td><td>'+esc(p.name)+'</td><td>'+esc(p.designation)+'</td><td>'+esc(p.vendor)+'</td><td>'+(done.has(k)?'<span class="pill ok">'+done.get(k)+' h</span>':'<span style="color:var(--ink3)">—</span>')+'</td></tr>';});
  h+='</tbody></table></div></div>';
  // records
  const list=OT.rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.store.localeCompare(b.store)||a.name.localeCompare(b.name));
  const tot=list.reduce((s,r)=>s+(+r.hours||0),0);
  h+='<div class="card"><div class="card-h"><div><h3>OT records</h3><div class="sub">'+list.length+' entries · '+tot+' hours</div></div>'+
    '<div class="row" style="gap:8px"><input class="inp" type="date" value="'+OT.from+'" onchange="OT.from=this.value;otEnter()" style="padding:5px 8px;font-size:12px"/><input class="inp" type="date" value="'+OT.to+'" onchange="OT.to=this.value;otEnter()" style="padding:5px 8px;font-size:12px"/>'+
    '<button class="btn sm" onclick="otExport(false)">Export list</button><button class="btn pri sm" onclick="otExport(true)">Export date-wise sheet</button></div></div>'+
    '<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Store</th><th>Name</th><th>Designation</th><th>Agency</th><th>OT hours</th><th>Reason</th><th></th></tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="8" style="color:var(--ink3)">No OT in this date range</td></tr>';
  list.forEach(r=>{h+='<tr><td>'+fmtShort(r.date)+'</td><td>'+esc(storeLabel(r.store))+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.designation||'')+'</td><td>'+esc(normVendor(r.vendor))+'</td><td class="mono">'+r.hours+'</td><td>'+esc(r.reason||'')+'</td><td><button class="btn ghost sm" onclick="otDel(\''+esc(r.id)+'\')">Remove</button></td></tr>';});
  el.innerHTML=h+'</tbody></table></div></div>';
}
function otTog(k){OT.sel.has(k)?OT.sel.delete(k):OT.sel.add(k);renderOt();}
function otAll(on){const q=(OT.q||'').toLowerCase();otPeople().filter(p=>!q||p.name.toLowerCase().includes(q)).forEach(p=>on?OT.sel.add(nk(p.name)):OT.sel.delete(nk(p.name)));renderOt();}
async function otSave(){
  const hrs=parseFloat(document.getElementById('otHrs').value);
  if(!OT.store||!OT.date){toast('Choose store and date',true);return;}
  if(!OT.sel.size){toast('Select at least one associate',true);return;}
  if(!(hrs>0&&hrs<=16)){toast('Enter OT hours between 0.5 and 16',true);return;}
  if(!db){toast('Not connected to Firebase',true);return;}
  const why=(document.getElementById('otWhy').value||'').trim(),b=db.batch(),at=new Date().toISOString();
  const recs=otPeople().filter(p=>OT.sel.has(nk(p.name))).map(p=>({store:OT.store,site:siteOf(OT.store),date:OT.date,name:p.name,designation:p.designation,vendor:p.vendor,hours:hrs,reason:why,at}));
  recs.forEach(r=>b.set(db.collection('ot').doc(otId(r)),r));
  const ok=await tmo(b.commit().then(()=>true),10000);
  if(!ok){toast('Save failed — check connection',true);return;}
  recs.forEach(r=>{const id=otId(r);OT.rows=OT.rows.filter(x=>x.id!==id);if(r.date>=OT.from&&r.date<=OT.to)OT.rows.push(Object.assign({id},r));});
  OT.sel.clear();renderOt();toast(hrs+' h OT saved for '+recs.length+' associate(s) on '+fmtShort(OT.date));
}
async function otDel(id){
  const r=OT.rows.find(x=>x.id===id);if(!r||!confirm('Remove '+r.hours+' h OT for '+r.name+' on '+fmtShort(r.date)+'?'))return;
  const ok=await tmo(db.collection('ot').doc(id).delete().then(()=>true),8000);
  if(!ok){toast('Remove failed',true);return;}
  OT.rows=OT.rows.filter(x=>x.id!==id);renderOt();toast('OT removed');
}
function otExport(sheet){
  if(!OT.rows.length){toast('No OT in this date range',true);return;}
  const name='OT_'+OT.from+'_to_'+OT.to+(sheet?'_sheet':'')+'.csv';
  if(!sheet){
    const rows=[['Date','Day','Store Code','Site','Name','Designation','Agency','OT Hours','Reason']];
    OT.rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.store.localeCompare(b.store)||a.name.localeCompare(b.name))
      .forEach(r=>rows.push([fmtDateCol(r.date),dayName(r.date),r.store,r.site||siteOf(r.store),r.name,r.designation||'',normVendor(r.vendor),r.hours,r.reason||'']));
    downloadCsv(name,rows);return;
  }
  const dates=rangeDates(OT.from,OT.to),ppl=new Map();
  OT.rows.forEach(r=>{const k=r.store+'|'+nk(r.name);if(!ppl.has(k))ppl.set(k,{store:r.store,site:r.site||siteOf(r.store),name:r.name,designation:r.designation||'',vendor:normVendor(r.vendor),h:{}});ppl.get(k).h[r.date]=(ppl.get(k).h[r.date]||0)+(+r.hours||0);});
  const rows=[['OT '+fmtDateCol(OT.from)+' to '+fmtDateCol(OT.to)],['#','Store Code','Site','Name','Designation','Agency',...dates.map(fmtDateCol),'OT Days','Total OT Hours']];
  const list=[...ppl.values()].sort((a,b)=>a.store.localeCompare(b.store)||a.name.localeCompare(b.name)),day={};
  list.forEach((p,i)=>{const v=dates.map(d=>{if(p.h[d])day[d]=(day[d]||0)+p.h[d];return p.h[d]||'';});rows.push([i+1,p.store,p.site,p.name,p.designation,p.vendor,...v,v.filter(x=>x).length,v.reduce((s,x)=>s+(+x||0),0)]);});
  rows.push(['','','','Total hours','','',...dates.map(d=>day[d]||''),'',Object.values(day).reduce((s,x)=>s+x,0)]);
  downloadCsv(name,rows);
}
