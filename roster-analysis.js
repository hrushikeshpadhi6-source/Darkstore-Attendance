// ═══ Darkstore Roster Pro — absenteeism analysis ═══
function bar(p,max){const w=max?Math.min(100,p/max*100):0;return '<div class="abar"><i style="width:'+w.toFixed(0)+'%"></i></div>';}
function renderAnalysis(){
  const el=document.getElementById('mgPaneAn');if(!el||el.hidden)return;
  const c=MG.last,conf=c.conf,t=tally(conf);
  if(!conf.length){el.innerHTML='<div class="card"><div class="empty">No confirmed attendance in this range yet.</div></div>';return;}
  const grp=(keyFn)=>{const m={};conf.forEach(r=>{const k=keyFn(r);if(k==null)return;(m[k]=m[k]||[]).push(r);});return Object.entries(m).map(([k,l])=>({k,t:tally(l)})).filter(x=>x.t.rostered);};
  const worst=l=>l.slice().sort((a,b)=>b.t.absPct-a.t.absPct)[0];
  const byStore=grp(r=>r.store),byVend=grp(r=>r.vendor||'(No agency)'),byDay=grp(r=>r.date),byWd=grp(r=>dayName(r.date)),bySh=grp(r=>r.shift);
  const ws=worst(byStore),wv=worst(byVend),wd=worst(byWd);
  const k=(l,v,s,cls)=>'<div class="kpi '+(cls||'')+'"><div class="l">'+l+'</div><div class="v" style="font-size:'+(String(v).length>8?'16':'24')+'px">'+esc(v)+'</div>'+(s?'<div style="font-size:12px;color:var(--ink3)">'+esc(s)+'</div>':'')+'</div>';
  let h='<div class="row mb" style="justify-content:flex-end"><button class="btn pri" onclick="exportAbsXlsx()">Export absenteeism (Excel)</button></div><div class="kpis">'+k('Absenteeism',pctTxt(t.absPct),(t.absent+t.sick)+' of '+t.rostered+' rostered',t.absPct>=10?'bad':'')+k('Absent',t.absent,'','bad')+k('Sick leave',t.sick,'','sick')+
    (ws?k('Highest store',ws.k,pctTxt(ws.t.absPct)):'')+(wv?k('Highest agency',wv.k,pctTxt(wv.t.absPct)):'')+(wd&&byDay.length>=7?k('Worst weekday',wd.k,pctTxt(wd.t.absPct)):'')+'</div>';
  const tbl=(title,sub,rows,label,max)=>'<div class="card"><div class="card-h"><div><h3>'+title+'</h3><div class="sub">'+sub+'</div></div></div><div class="tw"><table class="t"><thead><tr><th>'+label+'</th><th class="n">Rostered</th><th class="n">Absent</th><th class="n">Sick</th><th class="n">Absenteeism</th><th style="width:30%"></th></tr></thead><tbody>'+
    rows.map(x=>'<tr><td><b>'+x.l+'</b></td><td class="n">'+x.t.rostered+'</td><td class="n bad">'+x.t.absent+'</td><td class="n sick">'+x.t.sick+'</td><td class="n'+(x.t.absPct>=10?' abs-hi':'')+'">'+pctTxt(x.t.absPct)+'</td><td>'+bar(x.t.absPct,max)+'</td></tr>').join('')+'</tbody></table></div></div>';
  const mx=l=>Math.max(10,...l.map(x=>x.t.absPct));
  const dayRows=byDay.sort((a,b)=>a.k.localeCompare(b.k)).map(x=>({l:fmtShort(x.k),t:x.t}));
  h+='<div class="grid2 mb">'+tbl('By store','Highest first',byStore.sort((a,b)=>b.t.absPct-a.t.absPct).map(x=>({l:esc(storeLabel(x.k)),t:x.t})),'Store',mx(byStore))+
     tbl('By agency','Highest first',byVend.sort((a,b)=>b.t.absPct-a.t.absPct).map(x=>({l:esc(x.k),t:x.t})),'Agency',mx(byVend))+'</div>';
  h+='<div class="grid2 mb">'+tbl('By shift','',SHIFTS.map(s=>bySh.find(x=>x.k===s)).filter(Boolean).map(x=>({l:SHIFT_LBL[x.k],t:x.t})),'Shift',mx(bySh))+
     tbl('By weekday',byDay.length<7?'Pick a longer range for a weekday pattern':'Which days people miss most',DAYS.map(d=>byWd.find(x=>x.k===d)).filter(Boolean).map(x=>({l:x.k,t:x.t})),'Day',mx(byWd))+'</div>';
  if(dayRows.length>1) h+=tbl('Daily trend',fmtShort(c.from)+' – '+fmtShort(c.to),dayRows,'Date',mx(byDay));
  // repeat absentees
  const per={};conf.filter(r=>r.status==='Absent'||r.status==='Sick Leave').forEach(r=>{const key=r.store+'|'+nk(r.name);(per[key]=per[key]||{r,a:0,s:0,dates:[]});per[key][r.status==='Absent'?'a':'s']++;per[key].dates.push(r.date);});
  const rep=Object.values(per).filter(x=>x.a+x.s>=2).sort((a,b)=>(b.a+b.s)-(a.a+a.s)||b.a-a.a);
  h+='<div class="card"><div class="card-h"><div><h3>Repeat absentees</h3><div class="sub">2 or more absences in this range</div></div>'+(rep.length?'<button class="btn sm" onclick="exportRepeat()">Export CSV</button>':'')+'</div><div class="tw"><table class="t"><thead><tr><th>Name</th><th>Store</th><th>Agency</th><th>Shift</th><th class="n">Absent</th><th class="n">Sick</th><th>Dates</th></tr></thead><tbody>'+
    (rep.length?rep.map(x=>'<tr><td><b>'+esc(x.r.name)+'</b></td><td class="mono">'+esc(x.r.store)+'</td><td>'+esc(x.r.vendor||'—')+'</td><td>'+SHIFT_LBL[x.r.shift]+'</td><td class="n bad">'+x.a+'</td><td class="n sick">'+x.s+'</td><td style="white-space:normal;font-size:12px;color:var(--ink2)">'+x.dates.sort().map(fmtShort).join(', ')+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">No repeat absentees in this range</td></tr>')+'</tbody></table></div></div>';
  MG.repeat=rep;
  el.innerHTML=h;
}
// Detailed absenteeism workbook: summary, every absence with date, person-wise, repeat absentees, date × store
function exportAbsXlsx(){
  const c=MG.last,conf=c.conf;
  if(!conf.length){toast('No confirmed attendance in this range',true);return;}
  const out=r=>r.status==='Absent'||r.status==='Sick Leave';
  const pct=t=>t.rostered?+(t.absPct.toFixed(1)):'';
  const H=['Rostered','Present','Absent','Sick Leave','Week Off','Absenteeism %'];
  const tr=t=>[t.rostered,t.present,t.absent,t.sick,t.weekOff,pct(t)];
  const grp=f=>{const m={};conf.forEach(r=>{const k=f(r);(m[k]=m[k]||[]).push(r);});return m;};
  const role=document.getElementById('mgRole'),st=document.getElementById('mgSite').value;
  // 1. Summary
  const S=[['Absenteeism report'],['Range',fmtDate(c.from)+' – '+fmtDate(c.to)],['Stores',st?storeLabel(st):'All stores'],['Role',role.options[role.selectedIndex].text],['Generated',new Date().toLocaleString('en-GB')],[],['Overall',...H],['All',...tr(tally(conf))],[]];
  const block=(title,m,order,lbl)=>{S.push([title,...H]);(order||Object.keys(m).sort()).filter(k=>m[k]).forEach(k=>S.push([lbl?lbl(k):k,...tr(tally(m[k]))]));S.push([]);};
  block('By store',grp(r=>r.store),null,storeLabel);
  block('By agency',grp(r=>r.vendor||'(No agency)'));
  block('By shift',grp(r=>r.shift),SHIFTS,k=>SHIFT_LBL[k]);
  block('By weekday',grp(r=>dayName(r.date)),DAYS);
  // 2. Absence detail
  const D=[['Date','Day','Store Code','Site','Name','Designation','Agency','Shift','Timing','Status']];
  conf.filter(out).sort((x,y)=>x.date.localeCompare(y.date)||x.store.localeCompare(y.store)||SHIFTS.indexOf(x.shift)-SHIFTS.indexOf(y.shift)||x.name.localeCompare(y.name))
    .forEach(r=>D.push([fmtDate(r.date,{day:'2-digit',month:'short',year:'numeric'}),dayName(r.date),r.store,r.site,r.name,r.designation,r.vendor,SHIFT_LBL[r.shift],r.time,r.status]));
  // 3. Person-wise
  const per={};conf.forEach(r=>{const k=r.store+'|'+nk(r.name);(per[k]=per[k]||{r,l:[]}).l.push(r);});
  const P=[['Name','Store Code','Site','Designation','Agency','Shift',...H,'Absent dates','Sick dates']];
  Object.values(per).map(x=>({x,t:tally(x.l)})).sort((p,q)=>(q.t.absent+q.t.sick)-(p.t.absent+p.t.sick)||p.x.r.name.localeCompare(q.x.r.name)).forEach(({x,t})=>{
    const ds=s=>x.l.filter(r=>r.status===s).map(r=>r.date).sort().map(fmtShort).join(', ');
    P.push([x.r.name,x.r.store,x.r.site,x.r.designation,x.r.vendor,SHIFT_LBL[x.r.shift],...tr(t),ds('Absent'),ds('Sick Leave')]);});
  // 4. Repeat absentees (2+)
  const R=[['Name','Store Code','Site','Agency','Shift','Absent','Sick Leave','Total out','Dates']];
  Object.values(per).forEach(x=>{const a=x.l.filter(r=>r.status==='Absent').length,s=x.l.filter(r=>r.status==='Sick Leave').length;if(a+s>=2)R.push([x.r.name,x.r.store,x.r.site,x.r.vendor,SHIFT_LBL[x.r.shift],a,s,a+s,x.l.filter(out).map(r=>r.date).sort().map(fmtShort).join(', ')]);});
  R.splice(1,R.length,...R.slice(1).sort((p,q)=>q[7]-p[7]));
  // 5. Daily by store (absenteeism %)
  const ds=[...new Set(conf.map(r=>r.date))].sort(),ss=[...new Set(conf.map(r=>r.store))].sort();
  const G=[['Store',...ds.map(fmtShort),'Total']];
  ss.forEach(s=>G.push([s,...ds.map(d=>{const t=tally(conf.filter(r=>r.store===s&&r.date===d));return t.rostered?pct(t):'';}),pct(tally(conf.filter(r=>r.store===s)))]));
  G.push(['All',...ds.map(d=>pct(tally(conf.filter(r=>r.date===d)))),pct(tally(conf))]);
  const name='Darkstore absenteeism '+c.from+(c.from!==c.to?' to '+c.to:'')+(st?' '+st:'');
  if(!window.XLSX){downloadCsv(name+' (absences).csv',D);toast('Excel library not loaded — downloaded the absence list as CSV',true);return;}
  const wb=XLSX.utils.book_new(),add=(rows,n,w)=>{const ws=XLSX.utils.aoa_to_sheet(rows);if(w)ws['!cols']=w.map(x=>({wch:x}));XLSX.utils.book_append_sheet(wb,ws,n);};
  add(S,'Summary',[22,10,10,10,11,10,14]);
  add(D,'Absence detail',[13,11,10,16,24,20,14,9,20,11]);
  add(P,'Person-wise',[24,10,16,20,14,9,10,9,9,11,10,14,40,30]);
  add(R,'Repeat absentees',[24,10,16,14,9,8,10,10,50]);
  add(G,'Daily by store %',[12,...ds.map(()=>10),8]);
  XLSX.writeFile(wb,name+'.xlsx');
  toast('Excel downloaded · '+(D.length-1)+' absences');
}
function exportRepeat(){
  const rows=[['Name','Store Code','Site','Agency','Shift','Absent','Sick Leave','Dates']];
  (MG.repeat||[]).forEach(x=>rows.push([x.r.name,x.r.store,x.r.site,x.r.vendor,SHIFT_LBL[x.r.shift],x.a,x.s,x.dates.sort().join(' ')]));
  downloadCsv(fname('repeat absentees'),rows);
}
