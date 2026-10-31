// ═══ Darkstore Roster Pro — date-wise roster upload / edit ═══
const TPL_FIX=['#','Store code','Name','Designation','Agency','Shift','Week Off','Start','End'];
const cellTxt=x=>x.off?'Week Off':(x.time||SHIFT_LBL[x.shift]||'');
const hr=t=>{const h=parseHour(t);return h==null?'':h;};

function viewDates(){return rangeDates(ST.rFrom,addDays(ST.rFrom,6));}
function rowsFor(date){return (ST.edit&&ST.edit[date])||((getRoster(SESSION.store,date)||{}).rows)||null;}
function dateLocked(d){return d<todayIso()&&!ST.unlocked.rosterPast;}

function renderRoster(){
  const store=SESSION.store,el=document.getElementById('stRoster');
  document.getElementById('stFoot').hidden=true;
  if(!ST.rFrom)ST.rFrom=todayIso();
  const dates=viewDates(),missing=dates.filter(d=>!getRoster(store,d));
  let h='<div class="row mb"><label class="fld">Show 7 days from<input class="inp" type="date" value="'+ST.rFrom+'" onchange="if(this.value){ST.rFrom=this.value;ST.edit=null;renderRoster()}"/></label>'+
    '<button class="btn" onclick="ST.rFrom=addDays(ST.rFrom,-7);ST.edit=null;renderRoster()">‹ Prev</button><button class="btn" onclick="ST.rFrom=addDays(ST.rFrom,7);ST.edit=null;renderRoster()">Next ›</button>'+(missing.length?'<button class="btn pri" onclick="continueRoster()" title="Copy the previous week\'s roster to the days without one">Continue same roster</button>':'')+'</div>';
  h+=missing.length?'<div class="note '+(missing.includes(todayIso())?'bad':'warn')+'"><b>No roster for '+missing.length+' of 7 days:</b> '+missing.map(fmtShort).join(', ')+'</div>'
    :'<div class="note ok"><b>Roster uploaded for all 7 days.</b></div>';
  h+='<div class="card"><div class="card-h"><div><h3>Upload roster</h3><div class="sub">CSV or Excel · one row per person · one column per date</div></div><button class="btn sm" onclick="downloadTemplate()">Download template ('+fmtShort(dates[0])+' – '+fmtShort(dates[6])+')</button></div><div class="card-b">'+
    '<label class="drop" ondragover="event.preventDefault();this.classList.add(\'over\')" ondragleave="this.classList.remove(\'over\')" ondrop="event.preventDefault();this.classList.remove(\'over\');onRosterFile(event.dataTransfer.files[0])">'+
    '<input type="file" accept=".csv,.xlsx,.xls" hidden onchange="onRosterFile(this.files[0]);this.value=\'\'"/>Drop the roster file here or <b style="color:var(--navy)">choose file</b>'+
    '<div style="font-size:12px;color:var(--ink3);margin-top:6px">Columns: Name, Designation, Agency, Shift (DAY / EVENING / NIGHT), Week Off, Start, End, then one column per date — Week Off on the Week Off day, Start / End timing on the other days; type a different timing for any day (date only, e.g. 01-Nov-2026 — drag right in Excel to add more days). Date cells: timing like 8:00 AM - 5:00 PM, or Week Off.</div></label></div></div>';
  h+=ST.preview?previewHtml():gridHtml(dates);
  el.innerHTML=h;
}

// ─── template ───
// ─── continue with the same roster: copy the previous week (same weekday) into days without a roster ───
function continueRoster(){
  const store=SESSION.store,all=viewDates().filter(d=>!getRoster(store,d)&&!(ST.edit&&ST.edit[d])),ds=all.filter(d=>!dateLocked(d));
  if(!all.length){toast('Roster already saved for all 7 days');return;}
  if(!ds.length){askPw('These days are in the past. Enter the admin password to copy the roster.',()=>{ST.unlocked.rosterPast=true;continueRoster();});return;}
  const gone=new Set(empsOf(store,true).filter(e=>e.status==='Removed').map(e=>nk(e.name)));
  let n=0;
  ds.forEach(d=>{let src=null;for(let w=1;w<=5&&!src;w++)src=getRoster(store,addDays(d,-7*w));if(!src)return;
    ST.edit=ST.edit||{};ST.edit[d]=JSON.parse(JSON.stringify(src.rows)).filter(x=>!gone.has(nk(x.name)));n++;});
  if(!n){toast('No earlier roster found to copy — upload one',true);return;}
  renderRoster();toast('Previous week copied to '+n+' day(s) — check and press Save changes');
}
function downloadTemplate(){
  const store=SESSION.store,dates=viewDates();
  const base=latestRoster(store,dates[0]);
  let people;
  if(base) people=base.rows.map(x=>({name:x.name,designation:x.designation,vendor:x.vendor,shift:x.defShift||x.shift,weekOff:x.weekOff||'',start:x.start||'',end:x.end||''}));
  else{
    const st=empsOf(store);
    people=st.length?st.map(e=>({name:e.name,designation:e.designation,vendor:e.vendor||'',shift:e.shift||'',weekOff:e.weekOff||'',start:e.start||'',end:e.end||''}))
      :[{name:'GWC',designation:'Supervisor',vendor:'GWC',shift:'DAY',weekOff:'Sunday',start:'8:00 AM',end:'5:00 PM'}];
  }
  const rows=people.map((p,i)=>{
    const def=p.start&&p.end?p.start+' - '+p.end:'';
    return [i+1,store,p.name,p.designation,p.vendor,p.shift,p.weekOff?p.weekOff.toUpperCase():'',p.start,p.end,...dates.map(d=>{
      const r=getRoster(store,d),x=r&&r.rows.find(y=>nk(y.name)===nk(p.name));
      const sq=s=>nk(s).replace(/[\s.]/g,'');
      // formula: Week Off on the Week Off day, otherwise the Start / End timing
      const n=i+2,dn=dayName(d).toUpperCase(),isWo=p.weekOff&&p.weekOff===dayName(d);
      // plain text: week off day left blank (read from the Week Off column), other days show the Start / End timing
      // only the Week Off column's day is Week Off; every other day shows timing
      if(p.weekOff)return isWo?'Week Off':(x&&!x.off&&x.time&&!(def&&sq(x.time)===sq(def))?x.time:def);
      if(x){if(x.off)return 'Week Off';if(!x.time||(def&&sq(x.time)===sq(def)))return x.shift===p.shift||!x.shift?def:(SHIFT_LBL[x.shift]||x.shift).toUpperCase();return x.time;}
      return def;
    })];
  });
  downloadCsv('Roster '+store+' '+dates[0]+' to '+dates[6]+'.csv',[[...TPL_FIX,...dates.map(fmtDateCol)],...rows]);
  toast(base?'Template filled from current roster':'Template filled from employee list — check Shift, timings and Week Off');
}

// ─── upload + parse ───
async function onRosterFile(file){
  if(!file) return;
  try{
    const {grid,raw}=await readSheetFile(file);
    const hi=grid.findIndex(r=>r.some(c=>/^(staff\s*|employee\s*)?name$/i.test(String(c).trim())));
    if(hi<0) throw new Error('No "Name" column found — use the template');
    const H=grid[hi],HR=raw[hi]||H,col={},seenD=new Set();
    // Date headers: try day-first and month-first (Excel US: 10/30/2026); keep the order that reads more, consecutive dates
    const tryOrder=mdy=>{const o=[];H.forEach((c,i)=>{const rv=HR[i],dt=parseDateHead(typeof rv==='number'?rv:c,mdy);if(dt)o.push({i,date:dt});});return o;};
    const score=l=>{const s=l.map(x=>x.date).sort();let n=l.length*10;for(let j=1;j<s.length;j++)if(addDays(s[j-1],1)===s[j])n++;return n;};
    const oa=tryOrder(false),ob=tryOrder(true);
    let dcols=(score(ob)>score(oa)?ob:oa).filter(x=>{if(seenD.has(x.date))return false;seenD.add(x.date);return true;});
    const dIdx=new Set(dcols.map(x=>x.i));
    H.forEach((c,i)=>{
      const t=nk(c);if(dIdx.has(i))return;
      if(/^(#|no\.?|sr\.?\s*no\.?|s\.?\s*no\.?|sl\.?\s*no\.?)$/.test(t)) return;
      const set=k=>{if(col[k]==null)col[k]=i;};
      if(/store|code/.test(t))set('store');else if(/name/.test(t))set('name');else if(/desig|role|position/.test(t))set('designation');else if(/agency|vendor|company/.test(t))set('vendor');
      else if(/week\s*off|^wo$|off\s*day/.test(t))set('weekOff');else if(/^shift/.test(t))set('shift');
      else if(/start\s*h/.test(t))set('startHr');else if(/end\s*h/.test(t))set('endHr');else if(/start/.test(t))set('start');else if(/end/.test(t))set('end');
    });
    if(!dcols.length) throw new Error('No date columns found. Date headers must look like 01-Nov-2026 — download the template.');
    dcols=dcols.filter(x=>grid.slice(hi+1).some(r=>String(r[x.i]??'').trim())); // ignore date columns left completely empty
    if(!dcols.length) throw new Error('All date columns are empty');
    dcols.sort((a,b)=>a.date.localeCompare(b.date));
    const seen={},rows=[],sq=s=>nk(s).replace(/[\s.]/g,'');
    // previous default timing per person — date cells still holding the old timing follow the new Start/End
    const oldDef=new Map();
    empsOf(SESSION.store,true).forEach(e=>{if(e.start&&e.end)oldDef.set(nk(e.name),e.start+' - '+e.end);});
    const lr=latestRoster(SESSION.store,dcols[0].date);if(lr)lr.rows.forEach(x=>{if(x.start&&x.end)oldDef.set(nk(x.name),x.start+' - '+x.end);});
    grid.slice(hi+1).forEach((r,ri)=>{
      const g=k=>col[k]==null?'':String(r[col[k]]??'').trim();
      const name=g('name').replace(/\s+/g,' ');if(!name) return;
      const start=g('start'),end=g('end'),defTime=start&&end?start+' - '+end:'';
      const defH=parseHour(start)??parseHour(g('startHr'));
      let shift=normShift(g('shift'))||shiftFromHour(defH);
      const wo=normDay(g('weekOff')),errs=[],warns=[],cells={},od=oldDef.get(nk(name));
      const changed=defTime&&od&&sq(od)!==sq(defTime);
      dcols.forEach(({i,date})=>{
        let v=String(r[i]??'').trim();
        if(v.startsWith('='))v=''; // template formula not calculated (file not opened/saved in Excel) → use Week Off + Start / End columns
        if(isOffCell(v)){cells[date]={off:true};return;}
        if(!v){if(wo&&wo!=='None'&&wo===dayName(date))cells[date]={off:true};else if(defTime)cells[date]={off:false,time:defTime};else cells[date]=null;return;}
        if(/^(p|present)$/i.test(v)){if(!defTime&&!shift){errs.push(fmtShort(date)+': "P" needs Start/End or Shift');cells[date]=null;return;}cells[date]={off:false,shift,time:defTime};return;}
        const ns=normShift(v);if(ns){cells[date]={off:false,shift:ns,time:ns===shift?defTime:''};return;}
        const rg=splitRange(v),h=parseHour(rg?rg[0]:v);
        if(h==null){errs.push(fmtShort(date)+': "'+v+'" not understood');cells[date]=null;return;}
        if(changed&&sq(v)===sq(od)){cells[date]={off:false,shift:shift||shiftFromHour(parseHour(start)),time:defTime};return;}
        const same=defTime&&sq(v)===sq(defTime);
        cells[date]={off:false,shift:same&&shift?shift:shiftFromHour(h),time:v};
      });
      if(!shift){const f=Object.values(cells).find(c=>c&&c.shift);shift=f?f.shift:null;}
      Object.values(cells).forEach(c=>{if(c&&!c.shift)c.shift=shift;});
      if(!shift) errs.push('Shift missing — use DAY, EVENING or NIGHT');
      const k=nk(name);if(seen[k])errs.push('Duplicate of row '+seen[k]);else seen[k]=hi+ri+2;
      const blank=dcols.filter(d=>!cells[d.date]).length;if(blank&&!errs.length)warns.push(blank+' blank day(s) — not on roster those days');
      if(!g('vendor'))warns.push('No agency');
      if(dcols.length>=7){const offs=Object.values(cells).filter(c=>c&&c.off).length;if(offs===0)warns.push('No week off in this week');else if(offs>1)warns.push(offs+' week offs in this week — normally 1');}
      const sc=g('store').toUpperCase();if(sc&&sc!==SESSION.store)errs.push('Store code '+sc+' — you are logged in as '+SESSION.store);
      const jd=(dcols.find(d=>cells[d.date])||{}).date||'';
      rows.push({line:hi+ri+2,person:{name,designation:normDesig(g('designation')),vendor:g('vendor'),defShift:shift,weekOff:wo==='None'?'':wo,start,end,joinDate:jd},cells,errs,warns});
    });
    if(!rows.length) throw new Error('No people found under the Name column');
    ST.preview={file:file.name,dates:dcols.map(d=>d.date),rows};ST.edit=null;renderRoster();
  }catch(e){toast(e.message,true);}
}

function previewHtml(){
  const p=ST.preview,bad=p.rows.filter(x=>x.errs.length).length,store=SESSION.store;
  const replace=p.dates.filter(d=>getRoster(store,d)),past=p.dates.filter(d=>d<todayIso());
  let h='<div class="card"><div class="card-h"><div><h3>Preview · '+esc(p.file)+'</h3><div class="sub">'+p.rows.length+' people · '+fmtShort(p.dates[0])+' – '+fmtShort(p.dates[p.dates.length-1])+' ('+p.dates.length+' days)'+(bad?' · <span style="color:var(--bad);font-weight:700">'+bad+' rows need fixing</span>':'')+'</div></div>'+
    '<div class="row"><button class="btn sm" onclick="ST.preview=null;renderRoster()">Cancel</button><button class="btn pri sm" '+(bad?'disabled':'')+' onclick="savePreview()">Save roster</button></div></div>';
  const known=new Map((RD.emps[store]||[]).map(e=>[nk(e.name),e])),nw=p.rows.filter(x=>!known.has(nk(x.person.name))),back=p.rows.filter(x=>(known.get(nk(x.person.name))||{}).status==='Removed');
  if(nw.length||back.length) h+='<div class="card-b" style="padding-bottom:0"><div class="note" style="margin:0">'+(nw.length?'<b>'+nw.length+' new employee'+(nw.length>1?'s':'')+'</b> will be added: '+nw.map(x=>esc(x.person.name)).join(', ')+'. ':'')+(back.length?'<b>'+back.length+' removed</b> will be re-activated: '+back.map(x=>esc(x.person.name)).join(', ')+'.':'')+'</div></div>';
  if(replace.length||past.length) h+='<div class="card-b" style="padding-bottom:0">'+(replace.length?'<div class="note" style="margin-bottom:8px">Replaces the saved roster for '+replace.map(fmtShort).join(', ')+'. Days already confirmed keep their saved attendance.</div>':'')+(past.length?'<div class="note warn" style="margin:0">Includes past dates — admin password needed to save.</div>':'')+'</div>';
  // per-date counts
  h+='<div class="tw"><table class="t"><thead><tr><th>Per date</th>'+p.dates.map(d=>'<th class="n">'+fmtShort(d)+'</th>').join('')+'</tr></thead><tbody>'+
    [...SHIFTS.map(s=>[SHIFT_LBL[s],c=>c&&!c.off&&c.shift===s]),['Week Off',c=>c&&c.off]].map(([l,f])=>'<tr><td>'+l+'</td>'+p.dates.map(d=>'<td class="n">'+p.rows.filter(x=>f(x.cells[d])).length+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  h+='<div class="tw" style="border-top:1px solid var(--line)"><table class="t"><thead><tr><th>Row</th><th>Name</th><th>Designation</th><th>Agency</th><th>Shift</th>'+p.dates.map(d=>'<th>'+fmtShort(d)+'</th>').join('')+'<th>Check</th></tr></thead><tbody>'+
    p.rows.map(x=>'<tr class="'+(x.errs.length?'err':'')+'"><td class="n">'+x.line+'</td><td><b>'+esc(x.person.name)+'</b></td><td>'+esc(x.person.designation)+'</td><td>'+esc(x.person.vendor||'—')+'</td><td>'+esc(SHIFT_LBL[x.person.defShift]||'—')+'</td>'+
      p.dates.map(d=>{const c=x.cells[d];return '<td'+(c&&c.off?' class="wo"':'')+'>'+(!c?'—':c.off?'WO':esc(shortTime(c.time)||SHIFT_LBL[c.shift]))+(c&&!c.off&&c.shift!==x.person.defShift?' <span class="pill mute" style="padding:0 5px">'+SHIFT_LBL[c.shift]+'</span>':'')+'</td>';}).join('')+
      '<td class="err-msg">'+esc(x.errs.join('; '))+(x.warns.length&&!x.errs.length?'<span style="color:var(--warn)">'+esc(x.warns.join('; '))+'</span>':'')+'</td></tr>').join('')+'</tbody></table></div></div>';
  return h;
}
function savePreview(){
  const p=ST.preview;
  if(p.dates.some(d=>d<todayIso())&&!ST.unlocked.rosterPast){askPw('This roster includes past dates. Enter the admin password to save.',()=>{ST.unlocked.rosterPast=true;savePreview();});return;}
  const byDate={};
  p.dates.forEach(d=>{byDate[d]=p.rows.filter(x=>x.cells[d]).map(x=>Object.assign({},x.person,{shift:x.cells[d].shift,off:!!x.cells[d].off,time:x.cells[d].off?'':(x.cells[d].time||'')}));});
  const em=mergeEmps(SESSION.store,p.rows.map(x=>x.person),SESSION.store);
  Promise.all([saveRosterDates(SESSION.store,byDate,SESSION.store),saveEmps(SESSION.store,em.list)]).then(()=>{toast('Roster saved · '+p.rows.length+' people · '+p.dates.length+' days'+(em.added.length?' · '+em.added.length+' new employees':''));ST.preview=null;ST.rFrom=p.dates[0]<todayIso()?ST.rFrom:p.dates[0];renderSite();})
    .catch(e=>toast('Save failed: '+e.message,true));
}

// ─── grid view + edit ───
function gridHtml(dates){
  const store=SESSION.store,ppl=new Map();
  dates.forEach(d=>(rowsFor(d)||[]).forEach(x=>{if(!ppl.has(nk(x.name)))ppl.set(nk(x.name),x);}));
  if(!ppl.size) return '<div class="card"><div class="empty">No roster saved for these dates yet.</div></div>';
  const dirty=ST.edit&&Object.keys(ST.edit).length,em=new Map(empsOf(store,true).map(e=>[nk(e.name),e]));
  const na=(p,d)=>{const e=em.get(nk(p.name)),j=(e&&e.joinDate)||p.joinDate;return (j&&d<j)||(e&&e.status==='Removed'&&e.removedAt&&d>e.removedAt.slice(0,10));};
  const blank=(p,d)=>'<td style="color:var(--ink3)"'+(na(p,d)?' title="Not joined yet / removed">N/A':'>—')+'</td>';
  const list=[...ppl.values()].sort((a,b)=>SHIFTS.indexOf(a.defShift||a.shift)-SHIFTS.indexOf(b.defShift||b.shift)||a.name.localeCompare(b.name));
  let h='<div class="card"><div class="card-h"><div><h3>Roster · '+fmtShort(dates[0])+' – '+fmtShort(dates[6])+'</h3><div class="sub">'+ppl.size+' people · change a day to Day / Evening / Night / Week Off'+(dates.some(dateLocked)?' · past dates locked':'')+'</div></div>'+
    '<div class="row">'+(dates.some(dateLocked)?'<button class="btn sm" onclick="askPw(\'Editing past roster dates needs the admin password.\',()=>{ST.unlocked.rosterPast=true;renderRoster();})">Unlock past</button>':'')+
    '<button class="btn sm" onclick="woForm()">Change week off</button><button class="btn sm" onclick="shForm()">Change shift / timing</button>'+(dirty?'<button class="btn sm" onclick="ST.edit=null;renderRoster()">Discard</button><button class="btn pri sm" onclick="saveEdits()">Save changes</button>':'<button class="btn sm" onclick="addPersonForm()">Add person</button>')+'</div></div><div id="addForm"></div>';
  h+='<div class="tw"><table class="t"><thead><tr><th>Name</th><th>Designation</th><th>Agency</th>'+dates.map(d=>'<th>'+fmtShort(d)+'</th>').join('')+'<th></th></tr></thead><tbody>';
  const totals={};
  list.forEach(p=>{
    const k=nk(p.name).replace(/'/g,"\\'");
    h+='<tr><td><b>'+esc(p.name)+'</b></td><td>'+esc(p.designation)+'</td><td>'+esc(p.vendor||'—')+'</td>';
    dates.forEach(d=>{
      const rows=rowsFor(d);if(!rows){h+=blank(p,d);return;}
      const x=rows.find(y=>nk(y.name)===nk(p.name));if(!x){h+=blank(p,d);return;}
      const v=x.off?'WO':x.shift;totals[d]=totals[d]||{};totals[d][v]=(totals[d][v]||0)+1;
      h+='<td title="'+esc(x.time||'')+'"><select class="mini"'+(dateLocked(d)?' disabled':'')+' style="'+(x.off?'color:var(--warn);font-weight:600':'')+'" onchange="editCell(\''+d+'\',\''+k+'\',this.value)">'+
        [...SHIFTS.map(s=>[s,SHIFT_LBL[s]]),['WO','Week Off']].map(([o,l])=>'<option value="'+o+'"'+(o===v?' selected':'')+'>'+l+'</option>').join('')+'</select></td>';
    });
    h+='<td><button class="btn ghost sm" onclick="removePerson(\''+k+'\')">Remove</button></td></tr>';
  });
  h+='</tbody><tfoot><tr><td colspan="3">Day / Evening / Night / WO</td>'+dates.map(d=>{const t=totals[d];return '<td class="mono" style="font-size:12px">'+(t?[...SHIFTS,'WO'].map(s=>t[s]||0).join(' / '):'—')+'</td>';}).join('')+'<td></td></tr></tfoot></table></div></div>';
  return h;
}
function editable(d){return !dateLocked(d)&&rowsFor(d);}
function ensureEdit(d){ST.edit=ST.edit||{};if(!ST.edit[d])ST.edit[d]=JSON.parse(JSON.stringify(rowsFor(d)||[]));return ST.edit[d];}
function editCell(d,key,v){
  const x=ensureEdit(d).find(y=>nk(y.name)===key);if(!x)return;
  if(v==='WO'){x.off=true;x.time='';}
  else{const back=x.off;x.off=false;if(back||x.shift!==v)x.time=(v===(x.defShift||x.shift)&&x.start&&x.end)?x.start+' - '+x.end:'';x.shift=v;}
  renderRoster();
}
function removePerson(key){
  const ds=viewDates().filter(editable);
  if(!ds.length){toast('These dates are locked',true);return;}
  const p=ds.map(d=>rowsFor(d).find(y=>nk(y.name)===key)).find(Boolean);
  if(!confirm('Remove '+(p?p.name:'this person')+' from '+ds.length+' editable day(s) shown?'))return;
  ds.forEach(d=>{const r=ensureEdit(d),i=r.findIndex(y=>nk(y.name)===key);if(i>=0)r.splice(i,1);});
  renderRoster();
}
function addPersonForm(){
  document.getElementById('addForm').innerHTML='<div class="card-b row" style="border-bottom:1px solid var(--line)">'+
    '<label class="fld">Name<input class="inp" id="apName"/></label>'+
    '<label class="fld">Designation<select class="sel" id="apDesig"><option>Associate</option><option>Supervisor</option><option>Team Leader</option><option>Housekeeping</option></select></label>'+
    '<label class="fld">Agency<input class="inp" id="apVendor" style="width:120px"/></label>'+
    '<label class="fld">Shift<select class="sel" id="apShift">'+SHIFTS.map(s=>'<option value="'+s+'">'+SHIFT_LBL[s]+'</option>').join('')+'</select></label>'+
    '<label class="fld">Start<input class="inp" id="apStart" placeholder="8:00 AM" style="width:90px"/></label>'+
    '<label class="fld">End<input class="inp" id="apEnd" placeholder="5:00 PM" style="width:90px"/></label>'+
    '<label class="fld">Week Off<select class="sel" id="apWo"><option value="">None</option>'+DAYS.map(d=>'<option>'+d+'</option>').join('')+'</select></label>'+
    '<label class="fld">Joining date<input class="inp" type="date" id="apJoin" value="'+(viewDates().filter(editable)[0]||todayIso())+'"/></label>'+
    '<button class="btn pri" onclick="addPerson()">Add</button><button class="btn" onclick="document.getElementById(\'addForm\').innerHTML=\'\'">Cancel</button></div>';
  document.getElementById('apName').focus();
}
function addPerson(){
  const g=id=>document.getElementById(id).value.trim();
  const name=g('apName').replace(/\s+/g,' ');if(!name){toast('Enter a name',true);return;}
  const join=g('apJoin')||todayIso(),ds=viewDates().filter(d=>editable(d)&&d>=join);
  if(!ds.length){toast('No editable roster dates in view from '+fmtShort(join)+' — upload a roster first',true);return;}
  const start=g('apStart'),end=g('apEnd'),wo=g('apWo');
  const person={name,designation:g('apDesig'),vendor:g('apVendor'),defShift:g('apShift'),weekOff:wo,start,end,joinDate:join};
  let added=0;
  ds.forEach(d=>{const r=ensureEdit(d);if(r.some(y=>nk(y.name)===nk(name)))return;
    r.push(Object.assign({},person,{shift:person.defShift,off:wo===dayName(d),time:wo===dayName(d)?'':(start&&end?start+' - '+end:'')}));added++;});
  if(!added){toast(name+' is already on these dates',true);return;}
  renderRoster();toast(name+' added from '+fmtShort(join)+' to '+added+' day(s) — earlier days show N/A · press Save changes');
}
// ─── change week off: move a person's WO from one date to another (both in view) ───
function woPeople(){const m=new Map();viewDates().forEach(d=>(rowsFor(d)||[]).forEach(x=>{if(!m.has(nk(x.name)))m.set(nk(x.name),x.name);}));return [...m.entries()].sort((a,b)=>a[1].localeCompare(b[1]));}
function woForm(){
  const ppl=woPeople();if(!ppl.length){toast('No roster in view',true);return;}
  document.getElementById('addForm').innerHTML='<div class="card-b row" style="border-bottom:1px solid var(--line)">'+
    '<label class="fld">Person<select class="sel" id="woP" onchange="woFill()">'+ppl.map(([k,n])=>'<option value="'+esc(k)+'">'+esc(n)+'</option>').join('')+'</select></label>'+
    '<label class="fld">Current week off<select class="sel" id="woFrom"></select></label>'+
    '<label class="fld">Move to<select class="sel" id="woTo"></select></label>'+
    '<button class="btn pri" onclick="woApply()">Change</button><button class="btn" onclick="document.getElementById(\'addForm\').innerHTML=\'\'">Cancel</button>'+
    '<div id="woNote" style="font-size:12px;color:var(--ink3);flex-basis:100%"></div></div>';
  woFill();
}
function woFill(){
  const k=document.getElementById('woP').value,ds=viewDates();
  const st=d=>{const x=(rowsFor(d)||[]).find(y=>nk(y.name)===k);return x?(x.off?'off':'on'):null;};
  const offs=ds.filter(d=>st(d)==='off'),ons=ds.filter(d=>st(d)==='on'&&editable(d));
  document.getElementById('woFrom').innerHTML=(offs.length?offs.map(d=>'<option value="'+d+'"'+(editable(d)?'':' disabled')+'>'+fmtShort(d)+(editable(d)?'':' (locked)')+'</option>').join(''):'')+'<option value="">No week off in view</option>';
  document.getElementById('woTo').innerHTML=ons.map(d=>'<option value="'+d+'">'+fmtShort(d)+'</option>').join('')||'<option value="">—</option>';
  const f=offs.find(editable);if(f)document.getElementById('woFrom').value=f;else document.getElementById('woFrom').value='';
  document.getElementById('woNote').textContent='"Current week off" becomes a working day with the normal timing; "Move to" becomes Week Off. Choose "No week off in view" to only add a week off.';
}
function woApply(){
  const k=document.getElementById('woP').value,from=document.getElementById('woFrom').value,to=document.getElementById('woTo').value;
  if(!to){toast('Pick the new week off date',true);return;}
  if(from){const x=ensureEdit(from).find(y=>nk(y.name)===k);if(x){x.off=false;x.shift=x.defShift||x.shift;x.time=x.start&&x.end?x.start+' - '+x.end:'';}}
  const y=ensureEdit(to).find(z=>nk(z.name)===k);if(y){y.off=true;y.time='';}
  document.getElementById('addForm').innerHTML='';renderRoster();
  toast('Week off moved'+(from?' from '+fmtShort(from):'')+' to '+fmtShort(to)+' — press Save changes');
}
// ─── change shift / timing from a date onward (e.g. Night → Day after week off) ───
function shForm(){
  const ppl=woPeople();if(!ppl.length){toast('No roster in view',true);return;}
  const ds=viewDates().filter(editable);if(!ds.length){toast('These dates are locked',true);return;}
  document.getElementById('addForm').innerHTML='<div class="card-b row" style="border-bottom:1px solid var(--line)">'+
    '<label class="fld">Person<select class="sel" id="shP">'+ppl.map(([k,n])=>'<option value="'+esc(k)+'">'+esc(n)+'</option>').join('')+'</select></label>'+
    '<label class="fld">From date<select class="sel" id="shFrom">'+ds.map(d=>'<option value="'+d+'">'+fmtShort(d)+'</option>').join('')+'</select></label>'+
    '<label class="fld">New shift<select class="sel" id="shShift">'+SHIFTS.map(s=>'<option value="'+s+'">'+SHIFT_LBL[s]+'</option>').join('')+'</select></label>'+
    '<label class="fld">Start<input class="inp" id="shStart" placeholder="8:00 AM" style="width:90px"/></label>'+
    '<label class="fld">End<input class="inp" id="shEnd" placeholder="5:00 PM" style="width:90px"/></label>'+
    '<button class="btn pri" onclick="shApply()">Change</button><button class="btn" onclick="document.getElementById(\'addForm\').innerHTML=\'\'">Cancel</button>'+
    '<div style="font-size:12px;color:var(--ink3);flex-basis:100%">Applies from the chosen date to the end of this week; week offs stay as they are. It also becomes the person\'s normal shift for next roster templates.</div></div>';
}
function shApply(){
  const g=id=>document.getElementById(id).value.trim();
  const k=g('shP'),from=g('shFrom'),sh=g('shShift'),start=g('shStart'),end=g('shEnd');
  if(!!start!==!!end){toast('Enter both Start and End, or leave both empty',true);return;}
  const time=start&&end?start+' - '+end:'';let n=0;
  viewDates().filter(d=>d>=from&&editable(d)).forEach(d=>{const x=ensureEdit(d).find(y=>nk(y.name)===k);if(!x)return;
    x.defShift=sh;if(time){x.start=start;x.end=end;}
    if(!x.off){x.shift=sh;x.time=time;n++;}});
  if(!n){toast('No working days for this person from '+fmtShort(from),true);return;}
  document.getElementById('addForm').innerHTML='';renderRoster();
  toast('Shift changed to '+SHIFT_LBL[sh]+' for '+n+' day(s) from '+fmtShort(from)+' — press Save changes');
}
async function saveEdits(){
  try{
    const ppl=new Map();Object.values(ST.edit).flat().forEach(x=>ppl.set(nk(x.name),x));
    const em=mergeEmps(SESSION.store,[...ppl.values()],SESSION.store);
    await Promise.all([saveRosterDates(SESSION.store,ST.edit,SESSION.store),saveEmps(SESSION.store,em.list)]);
    ST.edit=null;toast('Roster updated'+(em.added.length?' · '+em.added.length+' new employee(s) added':''));renderSite();}
  catch(e){toast('Save failed: '+e.message,true);}
}
