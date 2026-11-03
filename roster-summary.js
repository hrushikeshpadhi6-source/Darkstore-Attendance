// ═══ Darkstore Roster Pro — shift-level summary (Today tab + Operations Overview) ═══
const SSUM={mode:'all',data:{}};
const ssGrp=()=>SSUM.mode==='date'?(p=>p.date):(p=>p.store),ssGrpLbl=k=>SSUM.mode==='date'?fmtDate(k):storeLabel(k);
function startMin(t,shift){
  const r=splitRange(t);if(!r)return 9999;
  const m=String(r[0]).match(/(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?/i);if(!m)return 9999;
  let h=+m[1];const ap=(m[3]||'').toLowerCase();if(ap==='p'&&h<12)h+=12;if(ap==='a'&&h===12)h=0;
  if(shift==='NIGHT'&&h<12)h+=24;return h*60+(+m[2]||0);
}
const ssAg=p=>normVendor(p.vendor)||'(No agency)';
function ssCount(L,isConf){
  const c={rostered:0,present:0,absent:0,weekOff:0,pending:0};
  L.forEach(p=>{if(p.status==='Week Off'){c.weekOff++;return;}c.rostered++;
    if(p.status==='Absent'||p.status==='Sick Leave')c.absent++;else if(isConf(p))c.present++;else c.pending++;});
  const m=c.present+c.absent;c.pct=m?c.present/m*100:null;return c;
}
const ssPres=(p,isConf)=>p.status!=='Absent'&&p.status!=='Sick Leave'&&isConf(p);
function ssAgCell(L,v,isConf){const x=L.filter(p=>ssAg(p)===v&&p.status!=='Week Off'),pr=x.filter(p=>ssPres(p,isConf)).length;return x.length?pr+'/'+x.length:'—';}
// recs: people with shift, vendor, status (+ store, date for multi-store). opts: {key, isConf, statusFn(sh,L), title, sub}
function shiftSummaryHtml(recs,opts){
  const isConf=opts.isConf||(p=>!!p.confirmed),ags=opts.noAgency?[]:[...new Set(recs.map(ssAg))].sort((a,b)=>recs.filter(p=>ssAg(p)===b).length-recs.filter(p=>ssAg(p)===a).length||a.localeCompare(b));
  SSUM.data[opts.key]={recs,isConf,ags,statusFn:opts.statusFn,multi:!!opts.multi};
  const cells=(L,sh)=>{const c=ssCount(L,isConf);return '<td class="n">'+c.rostered+'</td><td class="n ok">'+c.present+'</td><td class="n bad">'+c.absent+'</td><td class="n wo">'+c.weekOff+'</td><td class="n"'+(c.pending?' style="color:var(--warn);font-weight:600"':'')+'>'+c.pending+'</td><td class="n'+(c.pct!=null&&c.pct<90?' abs-hi':'')+'">'+(c.pct==null?'—':c.pct.toFixed(1)+'%')+'</td>'+
    ags.map((v,i)=>'<td class="n"'+(i===0?' style="border-left:1px solid var(--line)"':'')+'>'+ssAgCell(L,v,isConf)+'</td>').join('')+'<td>'+(opts.statusFn?opts.statusFn(sh,L):'')+'</td>';};
  const rowsFor=(L,sub)=>SHIFTS.filter(sh=>L.some(p=>p.shift===sh)).map(sh=>'<tr'+(sub?' class="sub"':'')+'><td>'+(sub?'':'<b>')+SHIFT_LBL[sh]+(sub?'':'</b>')+'</td>'+cells(L.filter(p=>p.shift===sh),sh)+'</tr>').join('');
  let body;
  if(opts.multi&&SSUM.mode!=='all'){const gf=ssGrp(),ss=[...new Set(recs.map(gf))].sort();
    body=ss.map(s=>{const L=recs.filter(p=>gf(p)===s),ck=SSUM.mode==='store'&&opts.onStore;return '<tr'+(ck?' class="click" title="See everyone\'s status" onclick="'+opts.onStore+'(\''+esc(s)+'\')"':'')+'><td'+(SSUM.mode==='store'?' class="mono"':'')+'><b>'+esc(ssGrpLbl(s))+'</b></td>'+cells(L,null).replace(/<td>[^]*<\/td>$/,'<td></td>')+'</tr>'+rowsFor(L,true);}).join('');}
  else body=rowsFor(recs,false);
  const tog=(opts.extra||'')+(opts.multi?'<div class="seg sm">'+[['all','Combined'],['store','By store']].map(([m,l])=>'<button class="'+(SSUM.mode===m?'on':'')+'" onclick="SSUM.mode=\''+m+'\';'+opts.rerender+'">'+l+'</button>').join('')+'</div>':'');
  return '<div class="card"><div class="card-h"><div><h3>'+(opts.title||'Shift summary')+'</h3><div class="sub">'+(opts.sub||'')+'</div></div><div class="row" style="gap:8px">'+tog+'<button class="btn sm" onclick="exportShiftSummary(\''+opts.key+'\')">Export CSV</button></div></div>'+
    '<div class="tw"><table class="t ssum"><thead><tr><th>'+(opts.multi&&SSUM.mode!=='all'?(SSUM.mode==='date'?'Date':'Store')+' / shift':'Shift')+'</th><th class="n">Rostered</th><th class="n">Present</th><th class="n">Absent</th><th class="n">Week Off</th><th class="n">Not marked</th><th class="n">Att %</th>'+
    ags.map((v,i)=>'<th class="n" title="Present / rostered"'+(i===0?' style="border-left:1px solid var(--line)"':'')+'>'+esc(v)+'</th>').join('')+'<th>Status</th></tr></thead><tbody>'+
    (recs.length?body:'<tr><td colspan="'+(8+ags.length)+'" class="empty">No one rostered</td></tr>')+'</tbody>'+
    (recs.length?'<tfoot><tr><td>Total</td>'+cells(recs,null).replace(/<td>[^]*<\/td>$/,'<td></td>')+'</tr></tfoot>':'')+'</table></div>'+
    (ags.length?'<div class="ssum-key">Agency columns show present / rostered (excludes week off). Not marked = rostered in a shift that is not confirmed yet.</div>':'')+'</div>';
}
function exportShiftSummary(key){
  const d=SSUM.data[key];if(!d)return;
  const plain=s=>String(s||'').replace(/<[^>]+>/g,'').trim();
  const line=(lbl,L,sh)=>{const c=ssCount(L,d.isConf);return [lbl,c.rostered,c.present,c.absent,c.weekOff,c.pending,c.pct==null?'':c.pct.toFixed(1),...d.ags.flatMap(v=>{const x=L.filter(p=>ssAg(p)===v&&p.status!=='Week Off');return [x.filter(p=>ssPres(p,d.isConf)).length,x.length];}),sh&&d.statusFn?plain(d.statusFn(sh,L)):''];};
  const rows=[[d.multi&&SSUM.mode==='date'?'Date':'Store',' Shift','Rostered','Present','Absent','Week Off','Not marked','Attendance %',...d.ags.flatMap(v=>[v+' Present',v+' Rostered']),'Status']];
  const add=(store,L)=>{SHIFTS.filter(sh=>L.some(p=>p.shift===sh)).forEach(sh=>rows.push([store,...line(SHIFT_LBL[sh],L.filter(p=>p.shift===sh),sh)]));rows.push([store,...line('Total',L,null)]);};
  if(d.multi){const gf=SSUM.mode==='date'?(p=>p.date):(p=>p.store);[...new Set(d.recs.map(gf))].sort().forEach(s=>add(s,d.recs.filter(p=>gf(p)===s)));rows.push([]);add('All',d.recs);}
  else add(key.split('|')[1]||'',d.recs);
  rows[0][1]='Shift';
  downloadCsv('Shift summary '+key.replace(/\|/g,' ')+'.csv',rows);
}
