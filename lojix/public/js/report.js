function reportDateTR(v){if(!v)return '—';const d=new Date(v+'T12:00:00');return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('tr-TR')}
function reportMoney(v){return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0)+' ₺'}
function reportEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function reportLogo(){return new URL('img/logo-640.jpg',location.href).href}  // yüksek çözünürlüklü logo: PDF'te keskin
/* ===== LOJIX rapor / PDF (iPhone ana ekran uygulaması uyumlu) =====
   Eski sürüm window.open + window.print kullanıyordu; iOS'ta ana ekrana eklenen uygulamada ikisi de çalışmaz.
   Yeni sürüm: rapor uygulama içinde önizlenir, "PDF Paylaş" gerçek bir PDF dosyası üretip iOS paylaşım menüsünü açar. */
const LX_REPORT_CSS=`@page{size:A4;margin:14mm 13mm 16mm}*{box-sizing:border-box}body{margin:0;font:12px/1.45 Arial,Helvetica,sans-serif;color:#172033;background:#fff}header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0e7490;padding:0 0 14px;margin-bottom:18px}.logo{width:64px;height:64px;object-fit:contain;border-radius:12px}.brand{font-size:23px;font-weight:800;letter-spacing:.4px;color:#102a43}.tag{font-size:10px;color:#64748b;margin-top:2px}.doc{margin-left:auto;text-align:right}.doc h1{font-size:17px;margin:0 0 5px;color:#0f3b5d}.doc p{margin:2px 0;color:#64748b;font-size:10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.panel{border:1px solid #dbe4ea;border-radius:8px;padding:10px 12px}.panel h3{margin:0 0 5px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.6px}.panel strong{font-size:14px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 18px}.kpi{border:1px solid #dbe4ea;border-top:3px solid #0e7490;border-radius:7px;padding:9px}.kpi .label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.3px}.kpi .value{font-size:14px;font-weight:800;margin-top:5px;overflow-wrap:anywhere}.section{font-size:12px;color:#0f3b5d;margin:17px 0 7px;padding-bottom:5px;border-bottom:1px solid #dbe4ea;font-weight:800}table{width:100%;border-collapse:collapse;font-size:10px}thead{display:table-header-group}th{background:#102a43;color:#fff;text-align:left;padding:8px 6px;font-weight:700}td{padding:7px 6px;border-bottom:1px solid #e5ebf0;vertical-align:top}tbody tr:nth-child(even){background:#f7fafc}.num{text-align:right;white-space:nowrap}.muted{color:#64748b}.pill{display:inline-block;border-radius:20px;background:#e0f2fe;color:#075985;padding:2px 7px;font-size:9px}.warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:7px;padding:9px 10px;font-size:9px;margin-top:13px}.foot{margin-top:20px;padding-top:8px;border-top:1px solid #dbe4ea;display:flex;justify-content:space-between;color:#64748b;font-size:9px}.negative{color:#b91c1c}.positive{color:#047857}.empty{padding:18px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:7px}/* ekstre bileşenleri */.kpi.hl{background:#f0f9ff}.pill{font-weight:700}.pill-ok{background:#d1fae5;color:#047857}.pill-late{background:#fee2e2;color:#b91c1c}.pill-warn{background:#fef3c7;color:#b45309}.stack{margin:6px 0 14px}.stack .st{font-size:10px;font-weight:700;color:#0f3b5d;margin-bottom:6px}.bar{display:flex;height:12px;border-radius:6px;overflow:hidden;background:#e5ebf0}.bar span{display:block;height:100%}.legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:9px;color:#475569}.legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}.sign .box{border:1px solid #cbd5e1;border-radius:8px;height:84px;padding:9px 11px;display:flex;flex-direction:column;justify-content:space-between;font-size:10px;color:#0f3b5d}.sign .box span{color:#64748b;font-size:9px}@media screen{body{padding:14px}}@media screen and (max-width:700px){.meta{grid-template-columns:1fr}.kpis{grid-template-columns:1fr 1fr}table{display:block;overflow-x:auto}header{flex-wrap:wrap}.doc{margin-left:0;text-align:left;flex-basis:100%}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}.panel,.kpi{break-inside:avoid}}`;
const LX_OVERLAY_CSS=`#lx-report-overlay{position:fixed;left:0;top:0;right:0;bottom:0;z-index:100000;display:none;flex-direction:column;background:#0b1220}
#lx-report-overlay .lxr-bar{display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:#0f172a;border-bottom:1px solid #26364f;color:#e7edf7}
#lx-report-overlay .lxr-title{flex:1;min-width:0;font:700 13px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
#lx-report-overlay .lxr-bar button{border:0;border-radius:10px;padding:10px 14px;font:700 14px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#fff;background:#334155;touch-action:manipulation;-webkit-appearance:none;white-space:nowrap}
#lx-report-overlay .lxr-bar .lxr-share{background:#0e7490}
#lx-report-frame{flex:1;width:100%;border:0;background:#fff}`;
let _lxReport=null,_lxLogo=null,_lxLogoReq=false;

// Logoyu PDF için önceden JPEG'e çevirir (paylaşım düğmesine basıldığında beklememek için uygulama açılırken çalışır)
function lxPrepLogo(){
 if(_lxLogoReq)return;_lxLogoReq=true;
 try{
  const src=reportLogo();if(!src)return;
  const img=new Image();
  img.onload=()=>{try{
   const s=300,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');
   x.fillStyle='#fff';x.fillRect(0,0,s,s);x.drawImage(img,0,0,s,s);
   const b=atob(c.toDataURL('image/jpeg',0.9).split(',')[1]),u=new Uint8Array(b.length);
   for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
   _lxLogo={bytes:u,w:s,h:s};
  }catch(e){_lxLogo=null}};
  img.src=src;
 }catch(e){}
}

// Rapor gövdesini (HTML) gerçek bir PDF dosyasına çevirir. Harici kütüphane gerekmez, çevrimdışı çalışır.
function lxBuildPdf(title,body,filename){
 const PW=595.28,PH=841.89,ML=38,MR=38,MT=36,MB=48,CW=PW-ML-MR;
 const mc=document.createElement('canvas').getContext('2d');
 const FONT='Helvetica, Arial, sans-serif';
 const TRK={'Ğ':1,'ğ':2,'İ':3,'ı':4,'Ş':5,'ş':6};
 const CP1252={'€':128,'‚':130,'„':132,'…':133,'†':134,'‡':135,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'™':153};
 const clean=s=>String(s==null?'':s).replace(/[\u00A0\u202F\u2009]/g,' ').replace(/[\u200B\u200E\u200F]/g,'').replace(/₺/g,'TL').replace(/[−‒]/g,'-').replace(/→/g,'>').replace(/←/g,'<');
 const hex=s=>{let h='';for(const ch of clean(s)){let c=TRK[ch];if(c===undefined){const n=ch.charCodeAt(0);c=n<32?32:n<128?n:(n>=160&&n<=255)?n:(CP1252[ch]||63)}h+=(c<16?'0':'')+c.toString(16)}return'<'+h+'>'};
 const mw=(t,sz,b)=>{mc.font=(b?'bold ':'')+sz+'px '+FONT;return mc.measureText(clean(t)).width*1.012};
 const rg=h=>{h=h.replace('#','');return[0,2,4].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(3)).join(' ')};
 const f2=n=>n.toFixed(2);
 const pages=[];let cur=null,y=0;
 const T=(x,yy,t,sz,o)=>{o=o||{};cur.push(`BT /${o.b?'F2':'F1'} ${sz} Tf ${rg(o.c||'#172033')} rg ${f2(x)} ${f2(PH-yy)} Td ${hex(t)} Tj ET`)};
 const R=(x,top,w,h,fill,stroke,lw,dash)=>{let s='q ';if(fill)s+=rg(fill)+' rg ';if(stroke)s+=rg(stroke)+' RG '+(lw||0.6)+' w ';if(dash)s+='[3 3] 0 d ';s+=`${f2(x)} ${f2(PH-top-h)} ${f2(w)} ${f2(h)} re ${fill&&stroke?'B':fill?'f':'S'} Q`;cur.push(s)};
 const Ln=(x1,y1,x2,y2,c,lw)=>cur.push(`q ${rg(c)} RG ${lw} w ${f2(x1)} ${f2(PH-y1)} m ${f2(x2)} ${f2(PH-y2)} l S Q`);
 const TR=(xr,yy,t,sz,o)=>T(xr-mw(t,sz,o&&o.b),yy,t,sz,o);
 const up=s=>String(s||'').trim().toLocaleUpperCase('tr');

 // runs: [{t,b,c}|{br:1}] -> satırlar (kelime kaydırmalı)
 function wrap(runs,width,sz){
  const lines=[[]];let x=0;
  for(const r of runs){
   if(r.br){lines.push([]);x=0;continue}
   for(const p of clean(r.t).split(/(\s+)/)){
    if(!p)continue;
    let line=lines[lines.length-1];
    if(/^\s+$/.test(p)){if(line.length){const sw=mw(' ',sz,r.b);line.push({t:' ',b:r.b,c:r.c,w:sw});x+=sw}continue}
    const w=mw(p,sz,r.b);
    if(w>width){ // çok uzun kelime: karakter bazlı böl
     let rest=p;
     while(rest){
      let n=rest.length;while(n>1&&mw(rest.slice(0,n),sz,r.b)>width-x)n--;
      if(x>0&&mw(rest[0],sz,r.b)>width-x){lines.push([]);x=0;continue}
      const seg=rest.slice(0,n),sw=mw(seg,sz,r.b);
      lines[lines.length-1].push({t:seg,b:r.b,c:r.c,w:sw});x+=sw;rest=rest.slice(n);
      if(rest){lines.push([]);x=0}
     }
     continue;
    }
    if(x+w>width&&line.length){while(line.length&&line[line.length-1].t===' ')line.pop();lines.push([]);x=0;line=lines[lines.length-1]}
    line.push({t:p,b:r.b,c:r.c,w});x+=w;
   }
  }
  return lines;
 }
 const lineW=ln=>{let w=0;for(const s of ln)w+=s.w;return w};
 function drawLine(ln,al,xl,xr,base,sz){
  ln=ln.slice();while(ln.length&&ln[ln.length-1].t===' ')ln.pop();
  if(!ln.length)return;
  const tot=lineW(ln);let x=al==='r'?xr-tot:al==='c'?(xl+xr)/2-tot/2:xl;
  let g=null;
  const flush=()=>{if(g){T(g.x,base,g.t,sz,{b:g.b,c:g.c});g=null}};
  for(const s of ln){
   if(g&&g.b===s.b&&g.c===s.c){g.t+=s.t}else{flush();g={x,t:s.t,b:s.b,c:s.c}}
   x+=s.w;
  }
  flush();
 }
 function runsOf(node,st,out){
  for(const n of node.childNodes){
   if(n.nodeType===3){out.push({t:n.textContent,b:st.b,c:st.c})}
   else if(n.nodeType===1){
    if(n.tagName==='BR'){out.push({br:1});continue}
    out.push.apply(out,runsOf(n,styleOf(n,{b:st.b||n.tagName==='STRONG'||n.tagName==='B',c:st.c}),[]));
   }
  }
  return out;
 }
 function styleOf(n,s){
  const cl=n.classList;s={b:s.b,c:s.c};
  if(cl.contains('muted'))s.c='#64748b';
  if(cl.contains('positive'))s.c='#047857';
  if(cl.contains('negative'))s.c='#b91c1c';
  if(cl.contains('pill')){s.c='#075985';s.b=true}
  if(cl.contains('pill-ok'))s.c='#047857';
  if(cl.contains('pill-late'))s.c='#b91c1c';
  if(cl.contains('pill-warn'))s.c='#b45309';
  return s;
 }
 const textOf=n=>(n?n.textContent:'').replace(/\s+/g,' ').trim();

 const logo=_lxLogo;
 function newPage(first){
  cur=[];pages.push(cur);y=MT;
  if(first){
   const xl=ML+(logo?56:0);
   if(logo)cur.push(`q 46 0 0 46 ${f2(ML)} ${f2(PH-y-46)} cm /Im1 Do Q`);
   T(xl,y+22,'LOJIX',21,{b:1,c:'#102a43'});
   T(xl,y+35,'Lojistikte akılcı çözümler',8,{c:'#64748b'});
   TR(PW-MR,y+14,title,13,{b:1,c:'#0f3b5d'});
   TR(PW-MR,y+28,'Rapor tarihi: '+reportDateTR(today()),8,{c:'#64748b'});
   const fn='Belge: '+filename;let fs=8;while(fs>5.5&&mw(fn,fs)>CW-70)fs-=.5;
   TR(PW-MR,y+40,fn,fs,{c:'#64748b'});
   Ln(ML,y+54,PW-MR,y+54,'#0e7490',2.2);
   y+=68;
  }else{
   T(ML,y+8,'LOJIX • '+title,8,{b:1,c:'#64748b'});
   Ln(ML,y+14,PW-MR,y+14,'#dbe4ea',0.6);
   y+=24;
  }
 }
 const ensure=h=>{if(y+h>PH-MB){newPage(false);return true}return false};

 function drawMeta(el){
  const ps=[...el.querySelectorAll('.panel')];if(!ps.length)return;
  const gap=10,w=(CW-gap*(ps.length-1))/ps.length,pad=8;
  const items=ps.map(p=>({lab:up(textOf(p.querySelector('h3'))),val:wrap([{t:textOf(p.querySelector('strong')),b:1,c:'#172033'}],w-2*pad,11),sub:wrap([{t:textOf(p.querySelector('.muted')),c:'#64748b'}],w-2*pad,8)}));
  const h=Math.max(...items.map(i=>pad+10+i.val.length*14+3+i.sub.length*11+pad));
  ensure(h+8);
  items.forEach((it,i)=>{
   const x=ML+i*(w+gap);R(x,y,w,h,null,'#dbe4ea',0.7);
   T(x+pad,y+pad+6,it.lab,7,{c:'#64748b'});
   let yy=y+pad+10;
   it.val.forEach(l=>{drawLine(l,'l',x+pad,x+w-pad,yy+11,11);yy+=14});
   yy+=3;it.sub.forEach(l=>{drawLine(l,'l',x+pad,x+w-pad,yy+8,8);yy+=11});
  });
  y+=h+10;
 }
 function drawKpis(el){
  const ks=[...el.querySelectorAll('.kpi')];if(!ks.length)return;
  const gap=8,w=(CW-gap*(ks.length-1))/ks.length,pad=7,h=40;
  ensure(h+14);y+=4;
  ks.forEach((k,i)=>{
   const x=ML+i*(w+gap),v=k.querySelector('.value'),vt=textOf(v);
   if(k.classList.contains('hl'))R(x,y,w,h,'#f0f9ff');R(x,y,w,h,null,'#dbe4ea',0.7);R(x,y,w,2.6,'#0e7490');
   let ls=6.5;const lab=up(textOf(k.querySelector('.label')));while(ls>5&&mw(lab,ls)>w-2*pad)ls-=.25;
   T(x+pad,y+14,lab,ls,{c:'#64748b'});
   let vs=11.5;while(vs>7&&mw(vt,vs,1)>w-2*pad)vs-=.5;
   const col=v.classList.contains('negative')?'#b91c1c':v.classList.contains('positive')?'#047857':'#172033';
   T(x+pad,y+31,vt,vs,{b:1,c:col});
  });
  y+=h+10;
 }
 function drawSection(el){
  ensure(70);y+=8;
  T(ML,y+9,textOf(el),10,{b:1,c:'#0f3b5d'});
  Ln(ML,y+14,PW-MR,y+14,'#dbe4ea',0.6);
  y+=22;
 }
 function drawBox(el,kind){
  const pad=8,sz=kind==='warn'?7.5:9,lh=sz*1.4;
  const runs=runsOf(el,{b:0,c:kind==='warn'?'#9a3412':'#64748b'},[]);
  const lines=wrap(runs,CW-2*pad-2,sz),h=lines.length*lh+2*pad-2;
  ensure(h+12);y+=6;
  if(kind==='warn')R(ML,y,CW,h,'#fff7ed','#fed7aa',0.7);else R(ML,y,CW,h,null,'#cbd5e1',0.7,true);
  lines.forEach((l,i)=>drawLine(l,kind==='warn'?'l':'c',ML+pad,PW-MR-pad,y+pad+sz*0.85+i*lh-1,sz));
  y+=h+8;
 }
 function drawPara(el){
  const sz=9,lh=12.5,lines=wrap(runsOf(el,{b:0,c:'#172033'},[]),CW,sz);
  lines.forEach(l=>{ensure(lh+2);drawLine(l,'l',ML,PW-MR,y+sz,sz);y+=lh});y+=4;
 }
 function drawStack(el){
  const segs=[...el.querySelectorAll('.bar span')];if(!segs.length)return;
  const tot=segs.reduce((a,s)=>a+Number(s.dataset.v),0);if(tot<=0)return;
  ensure(54);y+=4;
  T(ML,y+8,el.dataset.title||'',8.5,{b:1,c:'#0f3b5d'});y+=14;
  let x=ML;segs.forEach(s=>{const w=CW*Number(s.dataset.v)/tot;R(x,y,w,9,s.dataset.c);x+=w});
  y+=18;
  let lx=ML;const ls=7.5;
  segs.forEach(s=>{const lab=s.dataset.l+': ',val=s.dataset.t,w=10+mw(lab,ls)+mw(val,ls,1);
   if(lx>ML&&lx+w>PW-MR){lx=ML;y+=11}
   R(lx,y-6,6,6,s.dataset.c);T(lx+10,y,lab,ls,{c:'#475569'});T(lx+10+mw(lab,ls),y,val,ls,{b:1,c:'#172033'});lx+=w+14;
  });
  y+=14;
 }
 function drawSign(el){
  const bs=[...el.querySelectorAll('.box')];if(!bs.length)return;
  const gap=12,w=(CW-gap*(bs.length-1))/bs.length,h=66;ensure(h+16);y+=8;
  bs.forEach((b,i)=>{
   const x=ML+i*(w+gap);R(x,y,w,h,null,'#cbd5e1',0.7);
   const tt=textOf(b.querySelector('b'));let fs=8;while(fs>5.5&&mw(tt,fs,1)>w-18)fs-=.5;
   T(x+9,y+14,tt,fs,{b:1,c:'#0f3b5d'});T(x+9,y+h-9,textOf(b.querySelector('span')),7,{c:'#64748b'});
  });
  y+=h+6;
 }

 function drawTable(tbl){
  const sz=7.5,lh=sz*1.38,vp=4.2,pad=5;
  const hRows=[...tbl.querySelectorAll('thead tr')],bRows=[...tbl.querySelectorAll('tbody tr')],fRows=[...tbl.querySelectorAll('tfoot tr')];
  const first=(hRows[0]||bRows[0]);if(!first)return;
  const nc=first.children.length;
  const isNum=[...first.children].map(c=>c.classList.contains('num'));
  const HS={b:1,c:'#ffffff'},BS={b:0,c:'#172033'};
  const cellRuns=(c,st)=>runsOf(c,styleOf(c,st),[]);
  const allRows=[...hRows.map(r=>[r,HS]),...bRows.map(r=>[r,BS]),...fRows.map(r=>[r,HS])];
  const nat=new Array(nc).fill(0);
  allRows.forEach(([r,st])=>[...r.children].forEach((c,i)=>{if(i>=nc)return;const ls=wrap(cellRuns(c,st),1e6,sz);const w=Math.max(0,...ls.map(lineW));nat[i]=Math.max(nat[i],Math.min(w,270))}));
  const nw=nat.map(w=>w+2*pad),total=nw.reduce((a,b)=>a+b,0);
  const fx=nw.map((w,i)=>isNum[i]||nat[i]<=75); // sayı ve kısa sütunlar (tarih, durum) daraltılmaz
  const flex=nw.map((w,i)=>i).filter(i=>!fx[i]);
  let wid;
  if(total<=CW){
   const extra=CW-total,fs=flex.reduce((a,i)=>a+nw[i],0);
   wid=nw.map((w,i)=>flex.length?(fx[i]?w:w+extra*nw[i]/fs):w*CW/total);
  }else{
   const fixed=nw.reduce((a,w,i)=>a+(fx[i]?w:0),0),fs=flex.reduce((a,i)=>a+nw[i],0),avail=CW-fixed;
   wid=nw.map((w,i)=>fx[i]?w:w*avail/fs);
   if(!flex.length||avail<=0||flex.some(i=>wid[i]<46))wid=nw.map(w=>w*CW/total);
  }
  const layout=(tr,st)=>{
   const cells=[...tr.children].slice(0,nc);
   const lines=cells.map((c,i)=>wrap(cellRuns(c,st),wid[i]-2*pad,sz));
   return{cells,lines,h:Math.max(1,...lines.map(l=>l.length))*lh+2*vp};
  };
  const drawRow=(L,fill,bw)=>{
   if(fill)R(ML,y,CW,L.h,fill);
   let x=ML;
   L.cells.forEach((c,i)=>{
    const al=isNum[i]?'r':'l';
    L.lines[i].forEach((ln,li)=>drawLine(ln,al,x+pad,x+wid[i]-pad,y+vp+sz*0.92+li*lh,sz));
    x+=wid[i];
   });
   if(bw)Ln(ML,y+L.h,PW-MR,y+L.h,'#e5ebf0',0.5);
   y+=L.h;
  };
  const HL=hRows.map(r=>layout(r,HS)),FL=fRows.map(r=>layout(r,HS));
  const head=()=>HL.forEach(L=>drawRow(L,'#102a43',false));
  const hh=HL.reduce((a,L)=>a+L.h,0);
  const BL=bRows.map(r=>layout(r,BS));
  ensure(hh+(BL[0]?BL[0].h:0)+6);
  head();
  BL.forEach((L,i)=>{
   const fh=(i===BL.length-1)?FL.reduce((a,x)=>a+x.h,0):0; // son satır, toplam satırıyla birlikte kalsın
   if(y+L.h+fh>PH-MB){newPage(false);head()}
   drawRow(L,i%2?'#f7fafc':null,true);
  });
  FL.forEach(L=>{if(y+L.h>PH-MB){newPage(false);head()}drawRow(L,'#102a43',false)});
  y+=10;
 }

 const doc=new DOMParser().parseFromString('<div id="r">'+body+'</div>','text/html');
 const root=doc.getElementById('r');
 newPage(true);
 for(const el of root.children){
  const cl=el.classList;
  if(cl.contains('meta'))drawMeta(el);
  else if(cl.contains('kpis'))drawKpis(el);
  else if(cl.contains('section'))drawSection(el);
  else if(cl.contains('stack'))drawStack(el);
  else if(cl.contains('sign'))drawSign(el);
  else if(el.tagName==='TABLE')drawTable(el);
  else if(cl.contains('warn'))drawBox(el,'warn');
  else if(cl.contains('empty'))drawBox(el,'empty');
  else if(textOf(el))drawPara(el);
 }
 // alt bilgi + sayfa numarası
 pages.forEach((p,i)=>{
  cur=p;
  Ln(ML,PH-36,PW-MR,PH-36,'#dbe4ea',0.6);
  T(ML,PH-26,'LOJIX • Lojistikte akılcı çözümler',7.5,{b:1,c:'#64748b'});
  TR(PW-MR,PH-26,'Sayfa '+(i+1)+' / '+pages.length,7.5,{c:'#64748b'});
  T(ML,PH-15,'Bu rapor uygulamadaki kayıtlar esas alınarak oluşturulmuştur.',7,{c:'#64748b'});
 });

 // PDF dosyasını birleştir
 const enc=new TextEncoder(),chunks=[],offs=[];let off=0;
 const put=b=>{const u=typeof b==='string'?enc.encode(b):b;chunks.push(u);off+=u.length};
 const first1=logo?6:5;
 put('%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n');
 offs[1]=off;put('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
 offs[2]=off;put('2 0 obj\n<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(first1+2*i)+' 0 R').join(' ')+'] >>\nendobj\n');
 const fenc='<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [1 /Gbreve /gbreve /Idotaccent /dotlessi /Scedilla /scedilla] >>';
 offs[3]=off;put('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding '+fenc+' >>\nendobj\n');
 offs[4]=off;put('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding '+fenc+' >>\nendobj\n');
 if(logo){
  offs[5]=off;put('5 0 obj\n<< /Type /XObject /Subtype /Image /Width '+logo.w+' /Height '+logo.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+logo.bytes.length+' >>\nstream\n');
  put(logo.bytes);put('\nendstream\nendobj\n');
 }
 const res='<< /Font << /F1 3 0 R /F2 4 0 R >>'+(logo?' /XObject << /Im1 5 0 R >>':'')+' >>';
 pages.forEach((p,i)=>{
  const po=first1+2*i,co=po+1,s=p.join('\n');
  offs[po]=off;put(po+' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+f2(PW)+' '+f2(PH)+'] /Resources '+res+' /Contents '+co+' 0 R >>\nendobj\n');
  offs[co]=off;put(co+' 0 obj\n<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream\nendobj\n');
 });
 const n=first1+2*pages.length,xo=off;
 let x='xref\n0 '+n+'\n0000000000 65535 f \n';
 for(let i=1;i<n;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
 put(x+'trailer\n<< /Size '+n+' /Root 1 0 R >>\nstartxref\n'+xo+'\n%%EOF');
 return new Blob(chunks,{type:'application/pdf'});
}

function lxSaveBlob(blob,name){
 const u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),60000);
}
// PDF'i üretir ve iPhone paylaşım menüsünü açar (Dosyalar'a kaydet, WhatsApp, Mail, AirDrop...)
// Not: navigator.share dokunma anına bağlı olduğu için PDF burada eşzamanlı üretilir, bekleme yoktur.
function lxSharePdf(){
 const r=_lxReport;if(!r)return;
 let blob;
 try{blob=lxBuildPdf(r.title,r.body,r.filename)}
 catch(e){console.error(e);toast('PDF oluşturulamadı: '+((e&&e.message)||e),'error');return}
 let file=null;try{file=new File([blob],r.filename,{type:'application/pdf'})}catch(e){}
 if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
  navigator.share({files:[file],title:r.filename}).catch(e=>{if(e&&e.name==='AbortError')return;lxSaveBlob(blob,r.filename)});
  return;
 }
 lxSaveBlob(blob,r.filename);
}
function lxPrintPreview(){
 const f=$('lx-report-frame');
 try{f.contentWindow.focus();f.contentWindow.print()}catch(e){toast('Bu cihazda yazdırma desteklenmiyor. "PDF Paylaş" düğmesini kullanın.')}
}
function closeLojixPDF(){
 const ov=$('lx-report-overlay');if(!ov)return;
 ov.style.display='none';const f=$('lx-report-frame');if(f)f.srcdoc='';
 document.documentElement.style.overflow='';document.body.style.overflow='';
}
function openLojixPDF(title,body,filename){
 lxPrepLogo();
 _lxReport={title,body,filename};
 if(!$('lx-report-style')){const st=document.createElement('style');st.id='lx-report-style';st.textContent=LX_OVERLAY_CSS;document.head.appendChild(st)}
 const logo=reportLogo();
 const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${reportEscape(filename)}</title><style>${LX_REPORT_CSS}</style></head><body><header>${logo?`<img class="logo" src="${logo}" alt="LOJIX logo">`:''}<div><div class="brand">LOJIX</div><div class="tag">Lojistikte akılcı çözümler</div></div><div class="doc"><h1>${reportEscape(title)}</h1><p>Rapor tarihi: ${reportDateTR(today())}</p><p>Belge: ${reportEscape(filename)}</p></div></header>${body}<div class="foot"><span>LOJIX • Lojistikte akılcı çözümler</span><span>Bu rapor uygulamadaki kayıtlar esas alınarak oluşturulmuştur.</span></div></body></html>`;
 let ov=$('lx-report-overlay');
 if(!ov){ov=document.createElement('div');ov.id='lx-report-overlay';document.body.appendChild(ov)}
 const standalone=!!(window.navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches));
 const canPrint=!standalone&&!/iPhone|iPad|iPod/.test(navigator.userAgent);
 ov.innerHTML=`<div class="lxr-bar"><button type="button" onclick="closeLojixPDF()">← Geri</button><div class="lxr-title">${reportEscape(title)}</div>${canPrint?'<button type="button" onclick="lxPrintPreview()" aria-label="Yazdır">🖨️</button>':''}<button type="button" class="lxr-share" onclick="lxSharePdf()">⬆ PDF Paylaş</button></div><iframe id="lx-report-frame" title="Rapor önizleme"></iframe>`;
 $('lx-report-frame').srcdoc=html;
 ov.style.display='flex';document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
}
function lxStack(title,items){
 const list=items.filter(i=>i.v>0),tot=list.reduce((s,i)=>s+i.v,0);if(tot<=0)return'';
 const tx=i=>`${reportMoney(i.v)} · %${Math.round(i.v/tot*100)}`;
 return `<div class="stack" data-title="${reportEscape(title)}"><div class="st">${reportEscape(title)}</div><div class="bar">${list.map(i=>`<span style="width:${(i.v/tot*100).toFixed(2)}%;background:${i.c}" data-v="${i.v}" data-c="${i.c}" data-l="${reportEscape(i.l)}" data-t="${reportEscape(tx(i))}"></span>`).join('')}</div><div class="legend">${list.map(i=>`<span><i style="background:${i.c}"></i>${reportEscape(i.l)}: <b>${reportEscape(tx(i))}</b></span>`).join('')}</div></div>`;
}
function printClientPDF(encodedName){
 const name=decodeURIComponent(encodedName);const start=$('cariStart')?.value||'',end=$('cariEnd')?.value||'';
 const c=cariData(start,end).find(x=>x.client===name)||{client:name,n:0,gross:0,open:0,paid:0,bal:0,due:null,dueOpen:0,notDueOpen:0,noDueOpen:0,openTrips:[]};
 const inRange=d=>(!start||(!!d&&d>=start))&&(!end||(!!d&&d<=end));
 const trips=state.trips.filter(t=>t.client===name&&inRange(t.date)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
 const pays=state.payments.filter(p=>p.client===name&&!p.closed&&inRange(p.date)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
 const E=reportEscape,M=reportMoney;
 const net=t=>Math.max(0,(Number(t.price)||0)-tCut(t)),settled=t=>t.paid==='Tahsil Edildi';
 const gross=trips.reduce((s,t)=>s+(Number(t.price)||0),0),comm=trips.reduce((s,t)=>s+tComm(t),0),ded=trips.reduce((s,t)=>s+(Number(t.deduct)||0),0);
 const netTot=trips.reduce((s,t)=>s+net(t),0),setNet=trips.filter(settled).reduce((s,t)=>s+net(t),0),payTot=pays.reduce((s,p)=>s+(Number(p.amount)||0),0);
 const statusOf=t=>settled(t)?['Tahsil edildi','pill-ok']:!t.due?['Açık','pill-warn']:dayDiff(t.due)<=0?['Vadesi geldi','pill-late']:['Vadeli','pill'];
 const vadeCell=t=>{if(!t.due)return'—';const d=dayDiff(t.due),s=E(reportDateTR(t.due));if(settled(t))return s;return d<0?`${s}<br><span class="negative">${-d} gün gecikti</span>`:d===0?`${s}<br><span class="negative">Bugün</span>`:`${s}<br><span class="muted">${d} gün kaldı</span>`};
 const tripRows=trips.map(t=>{const v=vehObj(t.vehicleId),[st,cls]=statusOf(t),cm=tComm(t),dd=Number(t.deduct)||0,pc=Number(t.commPct)||0;const sub=[v.plate,t.driver,t.cargo].filter(Boolean).join(' · ');
  return `<tr><td>${E(reportDateTR(t.date))}</td><td><strong>${E(t.route||'—')}</strong>${sub?`<br><span class="muted">${E(sub)}</span>`:''}</td><td>${vadeCell(t)}</td><td class="num">${M(t.price)}</td><td class="num ${cm>0?'negative':'muted'}">${M(cm)}${pc>0?`<br><span class="muted">%${E(pc)}</span>`:''}</td><td class="num ${dd>0?'negative':'muted'}">${M(dd)}</td><td class="num"><strong>${M(net(t))}</strong></td><td><span class="pill ${cls}">${st}</span></td></tr>`}).join('');
 let cum=0;
 const payRows=pays.map(p=>{cum+=Number(p.amount)||0;return `<tr><td>${E(reportDateTR(p.date))}</td><td>${E(p.note||'Tahsilat')}</td><td class="num positive"><strong>${M(p.amount)}</strong></td><td class="num">${M(cum)}</td></tr>`}).join('');
 const sr=(k,d,v,o)=>{o=o||{};return `<tr><td>${o.b?`<strong>${E(k)}</strong>`:E(k)}</td><td class="muted">${E(d)}</td><td class="num ${o.cls||''}">${o.b?`<strong>${M(v)}</strong>`:M(v)}</td></tr>`};
 const period=(start||end)?`${start?reportDateTR(start):'Başlangıç yok'} – ${end?reportDateTR(end):'Bitiş yok'}`:'Tüm tarihler';
 const balCls=c.bal>0?'negative':c.bal<0?'positive':'';
 const body=`<div class="meta"><div class="panel"><h3>Cari hesap / müşteri</h3><strong>${E(name)}</strong><div class="muted" style="margin-top:4px">Dönem: ${E(period)}</div></div><div class="panel"><h3>Hesap durumu</h3><strong>${c.bal>0?'Alacak bakiyesi':c.bal<0?'Fazla tahsilat / alacaklı bakiye':'Bakiye kapalı'}</strong><div class="muted" style="margin-top:4px">En yakın vade: ${E(c.due?reportDateTR(c.due):'Belirtilmemiş')}</div></div></div>`
 +`<div class="kpis"><div class="kpi"><div class="label">Sefer sayısı</div><div class="value">${trips.length}</div></div><div class="kpi"><div class="label">Brüt navlun</div><div class="value">${M(gross)}</div></div><div class="kpi"><div class="label">Komisyon + kesinti</div><div class="value negative">${M(comm+ded)}</div></div><div class="kpi"><div class="label">Net sefer alacağı</div><div class="value">${M(netTot)}</div></div></div>`
 +`<div class="kpis"><div class="kpi"><div class="label">Dönem tahsilatları</div><div class="value positive">${M(payTot)}</div></div><div class="kpi hl"><div class="label">Kalan bakiye</div><div class="value ${balCls}">${M(c.bal)}</div></div><div class="kpi"><div class="label">Vadesi gelen / geçen</div><div class="value">${M(c.dueOpen)}</div></div><div class="kpi"><div class="label">Vadesi gelmeyen</div><div class="value">${M(c.notDueOpen)}</div></div></div>`
 +lxStack('Navlunun dağılımı',[{v:netTot,c:'#0e7490',l:'Net alacak'},{v:comm,c:'#f59e0b',l:'Komisyon'},{v:ded,c:'#ef4444',l:'Diğer kesintiler'}])
 +lxStack('Kalan bakiyenin vade dağılımı',[{v:c.dueOpen,c:'#dc2626',l:'Vadesi gelen / geçen'},{v:c.notDueOpen,c:'#0ea5e9',l:'Vadesi gelmeyen'},{v:c.noDueOpen,c:'#94a3b8',l:'Vadesi belirsiz'}])
 +`<div class="section">Hesap özeti</div><table><thead><tr><th>Kalem</th><th>Hesaplama</th><th class="num">Tutar</th></tr></thead><tbody>`
 +sr('Brüt navlun',`${trips.length} seferin toplam navlunu`,gross)
 +sr('(-) Komisyon','Sefer bazlı komisyon oranlarına göre',comm,{cls:comm>0?'negative':'muted'})
 +sr('(-) Diğer kesintiler','Sefer kartlarındaki sabit kesintiler',ded,{cls:ded>0?'negative':'muted'})
 +sr('(=) Net sefer alacağı','Navlun - komisyon - kesinti',netTot,{b:1})
 +sr('(-) Tahsil edilmiş seferler','"Tahsil Edildi" işaretli seferlerin net tutarı',setNet)
 +sr('(=) Açık sefer alacağı','Henüz tahsil edilmemiş seferler',c.open,{b:1})
 +sr('(-) Tahsilat kayıtları','Dönem içindeki ödemeler',payTot,{cls:'positive'})
 +sr('(=) Kalan bakiye','Güncel cari bakiye',c.bal,{b:1,cls:balCls})
 +`</tbody></table>`
 +`<div class="section">Sefer ve kesinti detayları</div>${trips.length?`<table><thead><tr><th>Tarih</th><th>Güzergâh / araç</th><th>Vade</th><th class="num">Navlun</th><th class="num">Komisyon</th><th class="num">Kesinti</th><th class="num">Net alacak</th><th>Durum</th></tr></thead><tbody>${tripRows}</tbody><tfoot><tr><th>TOPLAM</th><th>${trips.length} sefer</th><th></th><th class="num">${M(gross)}</th><th class="num">${M(comm)}</th><th class="num">${M(ded)}</th><th class="num">${M(netTot)}</th><th></th></tr></tfoot></table>`:'<div class="empty">Seçilen dönemde sefer kaydı bulunamadı.</div>'}`
 +`<div class="section">Tahsilat hareketleri</div>${pays.length?`<table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tahsilat</th><th class="num">Toplam tahsilat</th></tr></thead><tbody>${payRows}</tbody><tfoot><tr><th>TOPLAM</th><th>${pays.length} kayıt</th><th class="num">${M(payTot)}</th><th></th></tr></tfoot></table>`:'<div class="empty">Seçilen dönemde tahsilat kaydı bulunamadı.</div>'}`
 +`<div class="section">Mutabakat</div><div class="sign"><div class="box"><b>LOJIX</b><span>Tarih / Kaşe - İmza</span></div><div class="box"><b>${E(name)}</b><span>Mutabıkız. Tarih / Kaşe - İmza</span></div></div>`
 +`<div class="warn"><strong>Hesaplama notu:</strong> Net alacak = navlun - komisyon - kesinti. Sefere bağlanan tahsilat önce o seferden, bağlanmayan tahsilat vadesi en yakın seferden düşülür. Bu ekstre müşteri bazlı dönem özetidir; kesin fatura mutabakatı yerine geçmez. Kalan bakiye, uygulamadaki cari hesapla aynıdır.</div>`;
 openLojixPDF('CARİ HESAP EKSTRESİ',body,`LOJIX_Cari_Ekstresi_${name.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ-]+/gi,'_')}_${today()}.pdf`);
}
function showClientReport(name){printClientPDF(name)}
function printCariOverviewPDF(){
 const start=$('cariStart')?.value||'',end=$('cariEnd')?.value||'';const rows=cariData(start,end);const period=(start||end)?`${start?reportDateTR(start):'Başlangıç yok'} – ${end?reportDateTR(end):'Bitiş yok'}`:'Tüm tarihler';
 const totalGross=rows.reduce((s,c)=>s+c.gross,0),totalOpen=rows.reduce((s,c)=>s+c.open,0),totalPaid=rows.reduce((s,c)=>s+c.paid,0),totalBal=rows.reduce((s,c)=>s+c.bal,0);
 const body=`<div class="meta"><div class="panel"><h3>Rapor kapsamı</h3><strong>Genel cari hesap özeti</strong><div class="muted" style="margin-top:4px">Dönem: ${reportEscape(period)}</div></div><div class="panel"><h3>Hesap sayısı</h3><strong>${rows.length} müşteri / cari</strong><div class="muted" style="margin-top:4px">Tarih aralığı cari ekranındaki filtrelerden alınmıştır.</div></div></div><div class="kpis"><div class="kpi"><div class="label">Toplam navlun</div><div class="value">${reportMoney(totalGross)}</div></div><div class="kpi"><div class="label">Açık sefer alacağı</div><div class="value">${reportMoney(totalOpen)}</div></div><div class="kpi"><div class="label">Tahsilat kayıtları</div><div class="value positive">${reportMoney(totalPaid)}</div></div><div class="kpi"><div class="label">Net cari bakiye</div><div class="value ${totalBal>0?'negative':totalBal<0?'positive':''}">${reportMoney(totalBal)}</div></div></div><div class="section">Müşteri bazında cari durum</div>${rows.length?`<table><thead><tr><th>Müşteri / firma</th><th class="num">Sefer</th><th class="num">Toplam navlun</th><th class="num">Açık alacak</th><th class="num">Tahsilat</th><th class="num">Kalan bakiye</th><th>En yakın vade</th></tr></thead><tbody>${rows.map(c=>`<tr><td><strong>${reportEscape(c.client)}</strong></td><td class="num">${c.n}</td><td class="num">${reportMoney(c.gross)}</td><td class="num">${reportMoney(c.open)}</td><td class="num positive">${reportMoney(c.paid)}</td><td class="num ${c.bal>0?'negative':c.bal<0?'positive':''}"><strong>${reportMoney(c.bal)}</strong></td><td>${reportEscape(c.due?reportDateTR(c.due):'—')}</td></tr>`).join('')}</tbody><tfoot><tr><th>TOPLAM</th><th class="num">${rows.reduce((s,c)=>s+c.n,0)}</th><th class="num">${reportMoney(totalGross)}</th><th class="num">${reportMoney(totalOpen)}</th><th class="num">${reportMoney(totalPaid)}</th><th class="num">${reportMoney(totalBal)}</th><th>—</th></tr></tfoot></table>`:'<div class="empty">Seçilen dönemde cari kayıt bulunamadı.</div>'}<div class="warn"><strong>Hesaplama notu:</strong> Sefere bağlanan tahsilat önce o seferden, diğerleri vadesi en yakın seferden düşülür. Rapor müşteri bazlı dönem özeti sunar; kesin fatura mutabakatı yerine geçmez. Cari tutarlar uygulamanın mevcut hesaplama kurallarından alınmıştır.</div>`;
 openLojixPDF('GENEL CARİ RAPORU',body,`LOJIX_Genel_Cari_Raporu_${today()}.pdf`);
}
