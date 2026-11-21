const KEY='FRIGO_FILO_PRO_V1';
const CATS=['Şoför Maaş / Sefer Primi','Şoför Harcırah / Yemek / Avans','Periyodik Bakım & Sanayi','Frigo Soğutucu Bakım / Gaz','Lastik & Kaplama','HGS / OGS / Köprü / Feribot','Sigorta / Kasko / Muayene / MTV','Trafik Cezası / Diğer'];
const TABS=[['dashboard','grid','Özet','Özet'],['trips','route','Sefer','Seferler'],['cari','users','Cari','Cari hesap'],['fuel','fuel','Yakıt','Yakıt'],['expenses','receipt','Gider','Giderler'],['vehicles','truck','Araçlar','Araç kâr karnesi'],['drivers','user','Şoför','Şoförler'],['maint','shield','Bakım','Bakım ve belgeler'],['settings','sliders','Ayarlar','Ayarlar']];
const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const $=id=>document.getElementById(id);
const ic=(n,c='')=>`<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
// Plaka etiketi: Türk plakası görünümü (beyaz zemin, mavi TR şeridi).
const plate=(p,c='')=>`<span class="plate ${c}"><i>TR</i><b>${esc(p||'—')}</b></span>`;
// Telefon kartı: üstte araç/kişi ve tarih, ortada başlık, sağda büyük tutar, altta durum ve düğmeler.
const mcard=o=>`<article class="mcard"><div class="mc-top"><div class="flex items-center gap-2 min-w-0">${o.lead||''}</div><span class="shrink-0">${o.date||''}</span></div><div class="mc-main"><div class="min-w-0"><div class="mc-title">${o.title}</div>${o.sub?`<div class="mc-sub">${o.sub}</div>`:''}</div><div class="mc-amt ${o.cls||''}">${o.amt}</div></div>${o.foot?`<div class="mc-foot">${o.foot}</div>`:''}<div class="mc-act">${o.act}</div></article>`;
const emptyState=msg=>`<div class="empty-state"><img class="logo-tile" src="img/icon-192.png" alt="">${msg}</div>`;
const mlist=(id,items,msg)=>{const el=$(id);if(el)el.innerHTML=items.length?items.join(''):emptyState(msg)};
const NEW_HINT='Sağ alttaki <b>+</b> düğmesiyle ya da <b>Söyle</b> diyerek ekleyin.';
const rowActions=(col,id,label)=>`<div class="row-act flex justify-end gap-0.5"><button onclick="editRecord('${col}',${id})" class="btn btn-icon" title="Düzenle" aria-label="${label} düzenle">${ic('pencil')}</button><button onclick="delItem('${col}',${id})" class="btn btn-icon danger" title="Sil" aria-label="${label} sil">${ic('trash')}</button></div>`;
// Kısa bildirim (alert yerine): ekranı kilitlemez, ekran okuyucuya duyurulur.
function toast(msg,tone='ok'){let w=$('toasts');if(!w){w=document.createElement('div');w.id='toasts';w.setAttribute('role','status');w.setAttribute('aria-live','polite');document.body.appendChild(w)}const t=document.createElement('div');t.className='toast toast-'+tone;t.textContent=msg;w.appendChild(t);setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300)},tone==='error'?5000:3000)}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const fmtD=d=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8)+'.'+d.slice(5,7)+'.'+d.slice(0,4):esc(d||'—');
const fmtTL=v=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(v||0)+' ₺';
const fmtNum=(v,d=1)=>new Intl.NumberFormat('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v||0);
const sum=(a,k)=>a.reduce((s,x)=>s+Number(x[k]||0),0);
const byDate=a=>[...a].sort((x,y)=>(y.date||'').localeCompare(x.date||'')||y.id-x.id);

const defaults={
  vehicles:[], clients:[], trips:[], fuels:[], expenses:[], payments:[],
  intermediaryCompanies:[{id:'IC_TALYA',name:'Talya Lojistik',rate:7},{id:'IC_MOONLOG',name:'Moonlog Lojistik',rate:7}]
};
const clone=o=>JSON.parse(JSON.stringify(o));
const nameKey=n=>String(n||'').trim().toLocaleLowerCase('tr');
// Müşteri kimliği addan türetilir: her cihaz aynı müşteriye aynı kimliği verir, eşitlemede çift kart oluşmaz.
function cid(n){let h=2166136261;for(const ch of nameKey(n)){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0}return 'C_'+h.toString(36)}
const arr=a=>Array.isArray(a)?a:[];
const isPlaceholder=v=>v&&v.plate==='ARAÇ EKLEYİN'&&v.model==='Yeni araç';
function normalize(s){if(!s||typeof s!=='object')return null;
 const trips=arr(s.trips),names=new Map();
 [...arr(s.clients).map(c=>typeof c==='string'?c:c&&c.name),...trips.map(t=>t.client),...arr(s.payments).map(p=>p.client)].forEach(n=>{n=String(n||'').trim();if(n&&!names.has(nameKey(n)))names.set(nameKey(n),n)});
 return{vehicles:arr(s.vehicles).filter(v=>v&&v.id&&!isPlaceholder(v)).map(v=>({dorse:'',muayene:'',sigorta:'',kasko:'',odo:0,nextService:40000,interval:40000,...v})),clients:[...names.values()].map(n=>({id:cid(n),name:n})),payments:arr(s.payments),intermediaryCompanies:arr(s.intermediaryCompanies),trips,fuels:arr(s.fuels),expenses:arr(s.expenses)}}
function loadState(){try{const n=normalize(JSON.parse(localStorage.getItem(KEY)));if(n)return n}catch(e){}return normalize(clone(defaults))}
function saveState(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){toast('Cihaza kayıt yapılamadı: tarayıcı depolaması kapalı ya da dolu. Ayarlar > JSON Yedeği İndir ile verinizi kurtarın.','error')}setupSuggestions();renderAll()}
let state=loadState();
// Eşitleme köprüsü: buluttan gelen veri ekrana ve cihaza yazılır (buluta geri gönderilmez).
window.__lxApplyData=d=>{const n=normalize(d);if(!n)return;state=n;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}setupSuggestions();renderAll()};

/* ---------- Navigasyon ---------- */
const PRIMARY=['dashboard','trips','cari','fuel'];
function buildNav(){
 const groups=[['Genel',['dashboard']],['Operasyon',['trips','fuel','expenses']],['Finans',['cari']],['Filo',['vehicles','drivers','maint']],['Sistem',['settings']]];
 const navHtml='<nav aria-label="Ana menü">'+groups.map(([label,ids])=>`<div class="nav-group-label">${label}</div>`+TABS.filter(t=>ids.includes(t[0])).map(t=>`<button onclick="switchTab('${t[0]}')" data-tab="${t[0]}" class="nav-btn w-full text-left flex items-center gap-3">${ic(t[1])}<span>${t[3]}</span></button>`).join('')).join('')+'</nav>';
 $('side').insertAdjacentHTML('beforeend',navHtml);
 $('mnav').innerHTML=TABS.filter(t=>PRIMARY.includes(t[0])).map(t=>`<button onclick="switchTab('${t[0]}')" data-tab="${t[0]}" class="mob-btn">${ic(t[1],'ic-lg')}${t[2]}</button>`).join('')+`<button onclick="openSheet('moreSheet')" data-tab="more" class="mob-btn">${ic('more','ic-lg')}Daha</button>`;
 $('moreList').innerHTML=TABS.filter(t=>!PRIMARY.includes(t[0])).map(t=>`<button class="sheet-item" onclick="switchTab('${t[0]}')"><span class="sheet-ic bg-slate-100 text-slate-700">${ic(t[1])}</span><span>${t[3]}</span></button>`).join('');
}
function openSheet(id){$(id).classList.add('open');const f=$(id).querySelector('button');if(f)f.focus()}
function closeSheet(id){$(id).classList.remove('open')}
function quick(id){closeSheet('quickSheet');openModal(id)}
// Tema: dark (varsayılan, öznitelik yok) | light | brand | auto (telefonun gündüz/gece ayarını izler). Seçim bu telefonda saklanır.
const THEME_COLORS={dark:'#060B14',light:'#F4F6FA',brand:'#0A2A5C'};
function themePref(){try{return localStorage.getItem('LOJIX_THEME')||'dark'}catch(e){return 'dark'}}
function applyTheme(){const p=themePref(),t=p==='auto'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;if(t==='dark')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t;const m=document.querySelector('meta[name=theme-color]');if(m)m.content=THEME_COLORS[t]||THEME_COLORS.dark;document.querySelectorAll('[data-theme-opt]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.themeOpt===p)))}
function setTheme(t){try{t==='dark'?localStorage.removeItem('LOJIX_THEME'):localStorage.setItem('LOJIX_THEME',t)}catch(e){}applyTheme()}
matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>{if(themePref()==='auto')applyTheme()});
// Telefonda tablolar karta döner: her hücreye başlıktaki etiketi yaz.
function labelCells(){document.querySelectorAll('table.rtable').forEach(tb=>{const hs=[...tb.querySelectorAll('thead th')].map(th=>th.textContent.trim());tb.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{if(td.hasAttribute('colspan'))return;td.dataset.label=hs[i]||'';if(td.childNodes.length>1||(td.firstChild&&td.firstChild.nodeType===3)){const w=document.createElement('div');w.append(...td.childNodes);td.append(w)}}))})}
function switchTab(id){
 document.querySelectorAll('.tab-content').forEach(e=>e.classList.toggle('active',e.id==='tab-'+id));
 document.querySelectorAll('.nav-btn').forEach(b=>{const a=b.dataset.tab===id;b.classList.toggle('active',a);a?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});
 document.querySelectorAll('.mob-btn').forEach(b=>{const a=b.dataset.tab===id||(b.dataset.tab==='more'&&!PRIMARY.includes(id));b.classList.toggle('active',a)});closeSheet('moreSheet');
 $('page-title').textContent=TABS.find(t=>t[0]===id)[3];$('monthFilter').style.visibility=['maint','settings'].includes(id)?'hidden':'';window.scrollTo(0,0);
}

/* ---------- Filtre / hesap ---------- */
function fillMonths(){
 const el=$('monthFilter'),cur=el.value||'ALL',set=new Set([today().slice(0,7)]);
 [...state.trips,...state.fuels,...state.expenses].forEach(i=>i.date&&set.add(i.date.slice(0,7)));
 el.innerHTML='<option value="ALL">Tüm Zamanlar</option><option value="RANGE">Tarih Aralığı</option>'+[...set].sort().reverse().map(m=>`<option value="${m}">${MONTHS[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join('');
 el.value=(cur==='ALL'||cur==='RANGE'||set.has(cur))?cur:'ALL';
 const controls=$('dateRangeControls');if(controls)controls.style.display=el.value==='RANGE'?'flex':'none';
}
function onPeriodChange(){fillMonths();renderAll()}
function D(){const mode=$('monthFilter').value,from=$('globalStartDate')?.value||'',to=$('globalEndDate')?.value||'';const f=a=>mode==='ALL'?a:mode==='RANGE'?a.filter(i=>i.date&&(!from||i.date>=from)&&(!to||i.date<=to)):a.filter(i=>i.date&&i.date.startsWith(mode));return{t:f(state.trips),f:f(state.fuels),e:f(state.expenses)}}
const tComm=t=>(Number(t.price)||0)*(Number(t.commPct)||0)/100;
const tCut=t=>tComm(t)+(Number(t.deduct)||0);
const dayDiff=d=>Math.round((new Date(d)-new Date(today()))/864e5);
function fuelKmRows(list){const out=[];list.filter(x=>x.type==='CEKICI'&&Number(x.odometerKm)>0).forEach(cur=>{const prev=state.fuels.filter(x=>x.vehicleId===cur.vehicleId&&x.type==='CEKICI'&&Number(x.odometerKm)>0&&((x.date||'')<(cur.date||'')||((x.date||'')===(cur.date||'')&&x.id<cur.id))).sort((x,y)=>(y.date||'').localeCompare(x.date||'')||y.id-x.id)[0];if(prev){const km=Number(cur.odometerKm)-Number(prev.odometerKm);if(km>0)out.push({...cur,distanceKm:km,consumptionLiters:Number(cur.liters)||0})}});return out}
function fuelRef(){const all=[...fuelKmRows(state.fuels),...state.fuels.filter(x=>x.type==='CEKICI'&&!Number(x.odometerKm)&&Number(x.distanceKm)>0).map(x=>({...x,consumptionLiters:Number(x.liters)||0}))];
 const mk=a=>({avg:a.length?sum(a,'consumptionLiters')/sum(a,'distanceKm')*100:0,price:a.length?[...a].sort((x,y)=>(y.date||'').localeCompare(x.date||''))[0].unitPrice:0});
 const r={ALL:mk(all)};state.vehicles.forEach(v=>{const a=all.filter(x=>x.vehicleId===v.id);r[v.id]=a.length?mk(a):r.ALL});return r}
const estFuel=(t,r)=>{const q=r[t.vehicleId]||r.ALL;return(Number(t.km)||0)*q.avg/100*q.price};
const tNet=(t,r)=>(Number(t.price)||0)-tCut(t)-estFuel(t,r)-(Number(t.extra)||0);
function calc(t,f,e){
 const ck=f.filter(x=>x.type==='CEKICI'&&Number(x.distanceKm)>0),fr=f.filter(x=>x.type==='FRIGO');
 const odRows=fuelKmRows(f);const km=odRows.reduce((s,x)=>s+x.distanceKm,0)+sum(ck.filter(x=>!Number(x.odometerKm)),'distanceKm'),lit=odRows.reduce((s,x)=>s+x.consumptionLiters,0)+sum(ck.filter(x=>!Number(x.odometerKm)),'liters'),fuel=sum(f,'totalCost'),extra=sum(t,'extra'),exp=sum(e,'amount')+extra;
 const gross=sum(t,'price'),cut=t.reduce((s,x)=>s+tCut(x),0),rev=gross-cut;
 const pay=sum(e.filter(x=>x.category.startsWith('Şoför')),'amount');
 return{n:t.length,km:km||sum(t,'km'),gross,cut,rev,fuel,exp,pay,maint:exp-pay,frigoL:sum(fr,'liters'),frigoC:sum(fr,'totalCost'),
  adblue:sum(f.filter(x=>x.type==='ADBLUE'),'totalCost'),cekiciC:sum(f.filter(x=>x.type==='CEKICI'),'totalCost'),
  avg:km>0?lit/km*100:0,net:rev-fuel-exp};
}
const dl=v=>v&&v.dorse?`<div class="text-[11px] text-slate-400">Dorse: ${esc(v.dorse)}</div>`:'';
const vehObj=id=>state.vehicles.find(v=>v.id===id)||{plate:id};
const netCls=n=>n>=0?'text-blue-600':'text-rose-600';

/* ---------- Seçim kutuları ---------- */
function fill(id,html){const el=$(id),c=el.value;el.innerHTML=html;if([...el.options].some(o=>o.value===c))el.value=c}
function populateSelects(){
 const vo=state.vehicles.map(v=>`<option value="${esc(v.id)}">${esc(v.plate)}${v.dorse?' / '+esc(v.dorse):''}</option>`).join('');
 const dOpt=state.vehicles.map(v=>`<option value="${esc(v.driver)}">${esc(v.driver)} (${esc(v.plate)})</option>`).join('');
 ['tripVehicle','fuelVehicle','expVehicle'].forEach(i=>fill(i,vo));
 ['tF-v','fF-v','eF-v'].forEach(i=>fill(i,'<option value="ALL">Tüm Araçlar</option>'+vo));
 ['tripDriver','fuelDriver','expDriver'].forEach(i=>fill(i,dOpt));
 if($('tripCompany'))fill('tripCompany','<option value="">Aracı şirket yok</option>'+state.intermediaryCompanies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} (%${fmtNum(c.rate,1)})</option>`).join(''));
 fill('tF-d','<option value="ALL">Tüm Şoförler</option>'+[...new Set(state.vehicles.map(v=>v.driver))].map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join(''));
 fill('eF-c','<option value="ALL">Tüm Kategoriler</option>'+CATS.map(c=>`<option>${esc(c)}</option>`).join(''));
}
function syncDriver(vs,ds){const v=state.vehicles.find(x=>x.id===$(vs).value);if(v)$(ds).value=v.driver}

/* ---------- Render ---------- */
function renderDashboard(){
 const {t,f,e}=D(),a=calc(t,f,e),mg=a.rev>0?(a.net/a.rev*100).toFixed(1):'0';
 if($('hello-title')){const h=new Date().getHours(),now=new Date(),mo=today().slice(0,7),m=x=>(x.date||'').startsWith(mo),c=calc(state.trips.filter(m),state.fuels.filter(m),state.expenses.filter(m)),al=alertList().length;
  $('hello-date').textContent=now.toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long'});
  $('hello-title').textContent=h<12?'Günaydın':h<18?'İyi günler':'İyi akşamlar';
  $('hello-sum').innerHTML=!state.vehicles.length?'Başlamak için ilk aracınızı ekleyin.':c.n?`Bu ay <b class="text-slate-800">${c.n} sefer</b>, ${fmtTL(c.gross)} navlun, net <b class="${netCls(c.net)}">${fmtTL(c.net)}</b>. ${al?`<b class="text-amber-700">${al} uyarı</b> var.`:'Uyarı yok.'}`:`Bu ay henüz sefer yok. ${al?`<b class="text-amber-700">${al} uyarı</b> var.`:''}`}
 const kpi=(l,v,s,c='',x='')=>`<div class="card p-4 md:p-5 ${x}"><div class="kpi-label">${l}</div><div class="kpi-value ${c}">${v}</div><div class="kpi-sub">${s}</div></div>`;
 const mn=monthNets(),mx=Math.max(...mn.map(Math.abs),1);
 const spark=`<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${mn.map((v,i)=>`${i*20},${(15-(v/mx)*12).toFixed(1)}`).join(' ')}"/></svg>`;
 const heroSub=`Kâr marjı %${mg} · ${a.n} sefer · çizgi: son 6 ayın neti`+spark;
 $('kpis').innerHTML=kpi('Net filo kârı',fmtTL(a.net),heroSub,'','kpi-hero col-span-2')+kpi('Navlun',fmtTL(a.gross),`Açık alacak ${fmtTL(openTotal())}`)+kpi('Yakıt',fmtTL(a.fuel),a.avg>0?`Çekici ${fmtNum(a.avg)} lt/100 km`:'Tüketim için gösterge km girin')+kpi('Diğer giderler',fmtTL(a.exp),`Komisyon ve kesinti ${fmtTL(a.cut)}`,'','hidden lg:block');
 if($('dash-title'))$('dash-title').textContent=`Araç kârlılığı (${state.vehicles.length} araç)`;
 $('dash-tbody').innerHTML=(state.vehicles.length?'':'<tr><td colspan="6" class="td text-center py-8">Henüz araç yok. <button class="text-blue-600 font-semibold" onclick="openVehicleModal()">İlk aracı ekleyin</button></td></tr>')+state.vehicles.map(v=>{const m=calc(t.filter(x=>x.vehicleId===v.id),f.filter(x=>x.vehicleId===v.id),e.filter(x=>x.vehicleId===v.id));
  return`<tr><td class="td"><div>${plate(v.plate)}<div class="text-xs text-slate-400 mt-1">${esc(v.model)}</div></div></td><td class="td">${esc(v.driver)}</td><td class="td text-right text-emerald-700 font-semibold">${fmtTL(m.gross)}</td><td class="td text-right text-rose-600 font-semibold">${fmtTL(m.gross-m.net)}</td><td class="td text-center">${m.avg>0?fmtNum(m.avg):'-'}</td><td class="td text-right font-extrabold ${netCls(m.net)}">${fmtTL(m.net)}</td></tr>`}).join('');
 const row=(c,l,v)=>`<div class="flex justify-between py-2.5 border-b border-slate-200 last:border-0"><span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full ${c}"></span>${l}</span><b>${fmtTL(v)}</b></div>`;
 $('breakdown').innerHTML=row('bg-amber-500','Çekici mazotu',a.cekiciC)+row('bg-sky-500','Frigo dorse mazotu',a.frigoC)+row('bg-indigo-500','AdBlue',a.adblue)+row('bg-purple-500','Şoför maaş ve harcırah',a.pay)+row('bg-rose-500','Bakım, servis ve diğer',a.maint)+row('bg-slate-500','Komisyon ve kesintiler',a.cut);
 const chart=trendChart();renderGauges(a);if($('finance-chart'))$('finance-chart').innerHTML=chart;if($('expense-chart'))$('expense-chart').innerHTML=chart;
}
function renderTrips(){
 let a=D().t;const v=$('tF-v').value,d=$('tF-d').value;
 if(v!=='ALL')a=a.filter(x=>x.vehicleId===v);if(d!=='ALL')a=a.filter(x=>x.driver===d);
 const q=nameKey($('tF-q')?.value);if(q)a=a.filter(x=>[x.route,x.client,x.cargo,x.invoiceNo,x.driver,vehObj(x.vehicleId).plate].some(f=>nameKey(f).includes(q)));
 const ref=fuelRef(),tn=a.reduce((s,t)=>s+tNet(t,ref),0);
 $('trip-sum').innerHTML=a.length?`${a.length} sefer · navlun <b class="text-slate-800">${fmtTL(sum(a,'price'))}</b> · komisyon ve kesinti <b class="text-rose-600">${fmtTL(a.reduce((s,t)=>s+tCut(t),0))}</b> · tahmini kâr <b class="${netCls(tn)}">${fmtTL(tn)}</b> <span class="text-slate-400">(km girilmeyen seferde yakıt düşülmez)</span>`:'';
 $('trips-tbody').innerHTML=a.length?byDate(a).map(t=>{const n=tNet(t,ref),cm=tComm(t);return`<tr><td class="td whitespace-nowrap">${fmtD(t.date)}</td><td class="td"><div>${plate(vehObj(t.vehicleId).plate)}<div class="text-xs text-slate-500 mt-1">${esc(t.driver)}</div></div></td><td class="td"><b>${esc(t.route)}</b><div class="text-xs text-slate-500">${esc(t.client)}</div>${t.intermediaryCompanyId&&state.intermediaryCompanies.find(c=>c.id===t.intermediaryCompanyId)?`<div class="text-xs text-violet-700">Aracı: ${esc(state.intermediaryCompanies.find(c=>c.id===t.intermediaryCompanyId).name)} (%${fmtNum(t.commPct,1)})</div>`:''}${t.cargo?`<div class="text-xs text-sky-700 flex items-center gap-1">${ic('snow','ic-sm')}${esc(t.cargo)}</div>`:''}${t.invoiceNo?`<div class="text-xs text-slate-500 flex items-center gap-1">${ic('receipt','ic-sm')}${esc(t.invoiceNo)}</div>`:''}</td><td class="td text-right font-bold text-emerald-700">${fmtTL(t.price)}</td><td class="td text-right text-rose-600">${fmtTL(tCut(t))}<div class="text-[10px] text-slate-400">${t.commPct>0?'%'+t.commPct+' kom. ':''}${t.deduct>0?'kesinti '+fmtTL(t.deduct):''}</div></td><td class="td text-right"><b class="${netCls(n)}">${fmtTL(n)}</b><div class="text-[10px] text-slate-400">${Number(t.km)>0?'yakıt tahmini ~'+fmtTL(estFuel(t,ref)):'yakıt sefer bazında dağıtılmıyor'}${t.extra>0?' • masraf '+fmtTL(t.extra):''}</div></td><td class="td text-center"><button onclick="togglePaid(${t.id})" class="px-2.5 py-1 rounded-full text-xs font-bold ${t.paid==='Tahsil Edildi'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}">${esc(t.paid)}</button>${t.paid!=='Tahsil Edildi'&&t.due?`<div class="text-[10px] mt-1 ${dayDiff(t.due)<0?'text-rose-600 font-bold':'text-slate-400'}">vade ${fmtD(t.due)}</div>`:''}</td><td class="td whitespace-nowrap">${rowActions('trips',t.id,'Sefer')}</td></tr>`}).join(''):'<tr><td colspan="8" class="text-center py-8 text-slate-400">Kayıt yok.</td></tr>';
 const co=t=>state.intermediaryCompanies.find(c=>c.id===t.intermediaryCompanyId);
 mlist('trips-cards',byDate(a).map(t=>{const n=tNet(t,ref),ok=t.paid==='Tahsil Edildi',late=!ok&&t.due&&dayDiff(t.due)<0;return mcard({lead:`${plate(vehObj(t.vehicleId).plate)}<span class="truncate">${esc(t.driver)}</span>`,date:fmtD(t.date),title:esc(t.route||'Sefer'),
  sub:[esc(t.client),t.cargo?esc(t.cargo):'',co(t)?'Aracı: '+esc(co(t).name):'',t.invoiceNo?'Fatura '+esc(t.invoiceNo):''].filter(Boolean).join(' · '),amt:fmtTL(t.price),cls:'text-emerald-700',
  foot:`<button onclick="togglePaid(${t.id})" class="pill ${ok?'bg-emerald-100 text-emerald-700':late?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}">${ok?'Tahsil edildi':late?`Vade geçti · ${fmtD(t.due)}`:t.due?`Vadeli · ${fmtD(t.due)}`:'Bekliyor'}</button><span>Tahmini kâr <b class="${netCls(n)}">${fmtTL(n)}</b></span>${Number(t.km)>0?`<span>${fmtNum(t.km,0)} km</span>`:''}`,act:rowActions('trips',t.id,'Sefer')})}),'Bu dönemde sefer yok. '+NEW_HINT);
}
function renderFuel(){
 let a=D().f;const v=$('fF-v').value,t=$('fF-t').value;
 if(v!=='ALL')a=a.filter(x=>x.vehicleId===v);if(t!=='ALL')a=a.filter(x=>x.type===t);
 const lab={CEKICI:'bg-amber-100 text-amber-800|Çekici',FRIGO:'bg-sky-100 text-sky-800|Frigo Dorse',ADBLUE:'bg-indigo-100 text-indigo-800|AdBlue'};
 $('fuel-tbody').innerHTML=a.length?byDate(a).map(f=>{const[c,n]=(lab[f.type]||'bg-slate-100|?').split('|');const prev=f.type==='CEKICI'&&Number(f.odometerKm)>0?state.fuels.filter(x=>x.vehicleId===f.vehicleId&&x.type==='CEKICI'&&Number(x.odometerKm)>0&&((x.date||'')<(f.date||'')||((x.date||'')===(f.date||'')&&x.id<f.id))).sort((x,y)=>(y.date||'').localeCompare(x.date||'')||y.id-x.id)[0]:null;const delta=prev?Number(f.odometerKm)-Number(prev.odometerKm):Number(f.distanceKm)||0;const avg=f.type==='CEKICI'&&delta>0?fmtNum(f.liters/delta*100)+' Lt':'-';
  return`<tr><td class="td whitespace-nowrap">${fmtD(f.date)}</td><td class="td"><div>${plate(vehObj(f.vehicleId).plate)}<div class="text-xs text-slate-500 mt-1">${esc(f.driver)}</div></div></td><td class="td"><span class="${c} px-2 py-0.5 rounded text-xs font-bold">${n}</span><div class="text-xs text-slate-400">${esc(f.station||'-')}</div></td><td class="td text-right">${fmtNum(f.liters)} Lt</td><td class="td text-right">${fmtNum(f.unitPrice,2)} ₺</td><td class="td text-right">${f.odometerKm?fmtNum(f.odometerKm,0):(f.distanceKm>0?fmtNum(f.distanceKm,0):'-')}</td><td class="td text-center font-bold">${avg}</td><td class="td text-right font-extrabold text-amber-700">${fmtTL(f.totalCost)}</td><td class="td whitespace-nowrap">${rowActions('fuels',f.id,'Yakıt kaydı')}</td></tr>`}).join(''):'<tr><td colspan="9" class="text-center py-8 text-slate-400">Kayıt yok.</td></tr>';
 const fl={CEKICI:'Çekici mazotu',FRIGO:'Frigo mazotu',ADBLUE:'AdBlue'};
 mlist('fuel-cards',byDate(a).map(f=>{const prev=f.type==='CEKICI'&&Number(f.odometerKm)>0?state.fuels.filter(x=>x.vehicleId===f.vehicleId&&x.type==='CEKICI'&&Number(x.odometerKm)>0&&((x.date||'')<(f.date||'')||((x.date||'')===(f.date||'')&&x.id<f.id))).sort((x,y)=>(y.date||'').localeCompare(x.date||'')||y.id-x.id)[0]:null,d=prev?Number(f.odometerKm)-Number(prev.odometerKm):0;
  return mcard({lead:`${plate(vehObj(f.vehicleId).plate)}<span class="truncate">${esc(f.driver)}</span>`,date:fmtD(f.date),title:`${fl[f.type]||'Yakıt'} · ${fmtNum(f.liters,0)} lt`,sub:[f.station?esc(f.station):'',f.unitPrice?fmtNum(f.unitPrice,2)+' ₺/lt':''].filter(Boolean).join(' · '),amt:fmtTL(f.totalCost),cls:'text-amber-700',
  foot:[f.odometerKm?`Gösterge ${fmtNum(f.odometerKm,0)} km`:'',d>0?`<b class="text-slate-700">${fmtNum(f.liters/d*100)} lt/100 km</b>`:''].filter(Boolean).join('<span class="text-slate-400">·</span>'),act:rowActions('fuels',f.id,'Yakıt kaydı')})}),'Bu dönemde yakıt kaydı yok. '+NEW_HINT);
}
function renderExpenses(){
 let a=D().e;const v=$('eF-v').value,c=$('eF-c').value;
 if(v!=='ALL')a=a.filter(x=>x.vehicleId===v);if(c!=='ALL')a=a.filter(x=>x.category===c);
 $('exp-tbody').innerHTML=a.length?byDate(a).map(e=>`<tr><td class="td whitespace-nowrap">${fmtD(e.date)}</td><td class="td">${plate(vehObj(e.vehicleId).plate)}</td><td class="td">${esc(e.driver)}</td><td class="td"><span class="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg text-xs">${esc(e.category)}</span></td><td class="td">${esc(e.note)}</td><td class="td text-right font-extrabold text-rose-600">${fmtTL(e.amount)}</td><td class="td whitespace-nowrap">${rowActions('expenses',e.id,'Gider')}</td></tr>`).join(''):'<tr><td colspan="7" class="text-center py-8 text-slate-400">Kayıt yok.</td></tr>';
 mlist('exp-cards',byDate(a).map(e=>mcard({lead:`${plate(vehObj(e.vehicleId).plate)}<span class="truncate">${esc(e.driver)}</span>`,date:fmtD(e.date),title:esc(e.category),sub:esc(e.note),amt:fmtTL(e.amount),cls:'text-rose-600',act:rowActions('expenses',e.id,'Gider')})),'Bu dönemde gider yok. '+NEW_HINT);
}
function renderVehicles(){
 const {t,f,e}=D();
 $('veh-grid').innerHTML=state.vehicles.map(v=>{const m=calc(t.filter(x=>x.vehicleId===v.id),f.filter(x=>x.vehicleId===v.id),e.filter(x=>x.vehicleId===v.id));const kmc=m.km>0?(m.fuel+m.exp)/m.km:0;
  return`<div class="card p-5 space-y-3"><div class="flex justify-between gap-3 border-b border-slate-200 pb-3"><div class="min-w-0">${plate(v.plate,'lg')}${v.dorse?`<div class="text-xs text-slate-400 mt-1.5">Dorse ${esc(v.dorse)}</div>`:''}<p class="text-sm text-slate-500 mt-1">${esc(v.model)}${v.frigo?` · <span class="text-sky-600">${esc(v.frigo)}</span>`:''}</p><p class="text-sm mt-1 flex items-center gap-1.5">${ic('user','ic-sm')}<b class="font-semibold">${esc(v.driver)}</b>${v.phone?`<a class="text-blue-600" href="tel:${esc(v.phone)}">${esc(v.phone)}</a>`:''}</p></div><div class="text-right shrink-0"><div class="kpi-label">Net kâr</div><div class="kpi-value ${netCls(m.net)}">${fmtTL(m.net)}</div></div></div>
  <div class="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-xl text-xs"><div><span class="text-slate-400 block">Sefer</span><b>${m.n} (${fmtNum(m.km,0)} KM)</b></div><div><span class="text-slate-400 block">Çekici Ort.</span><b class="text-amber-700">${m.avg>0?fmtNum(m.avg)+' Lt':'Veri yok'}</b></div><div><span class="text-slate-400 block">Frigo Yakıtı</span><b class="text-sky-700">${fmtNum(m.frigoL,0)} Lt</b></div></div>
  <div class="space-y-1 text-xs"><div class="flex justify-between"><span>Navlun geliri</span><b class="text-emerald-700">+ ${fmtTL(m.gross)}</b></div><div class="flex justify-between"><span>Komisyon & kesinti</span><b class="text-rose-600">- ${fmtTL(m.cut)}</b></div><div class="flex justify-between"><span>Yakıt (çekici+frigo+AdBlue)</span><b class="text-amber-700">- ${fmtTL(m.fuel)}</b></div><div class="flex justify-between"><span>Bakım, lastik & şoför</span><b class="text-rose-600">- ${fmtTL(m.exp)}</b></div><div class="flex justify-between pt-1 border-t border-slate-100"><span>KM başı maliyet</span><b>${fmtNum(kmc,2)} ₺</b></div></div></div>`}).join('');
}
function renderDrivers(){
 const {t,f,e}=D();
 $('drv-tbody').innerHTML=state.vehicles.map(v=>{const m=calc(t.filter(x=>x.driver===v.driver),f.filter(x=>x.driver===v.driver),e.filter(x=>x.driver===v.driver));
  return`<tr><td class="td"><b>${esc(v.driver)}</b><div class="text-xs text-slate-400">${esc(v.phone)}</div></td><td class="td">${plate(v.plate)}</td><td class="td text-center">${m.n} / ${fmtNum(m.km,0)} KM</td><td class="td text-center font-bold text-amber-700">${m.avg>0?fmtNum(m.avg):'-'}</td><td class="td text-right text-emerald-700 font-bold">${fmtTL(m.rev)}</td><td class="td text-right text-purple-700 font-bold">${fmtTL(m.pay)}</td><td class="td text-right text-rose-600 font-semibold">${fmtTL(m.fuel+m.maint)}</td><td class="td text-right font-extrabold ${netCls(m.net)}">${fmtTL(m.net)}</td></tr>`}).join('');
}
function renderSettings(){
 if(document.activeElement&&document.activeElement.id&&document.activeElement.id.startsWith('s-'))return;
 $('set-tbody').innerHTML=state.vehicles.map((v,i)=>`<tr><td class="py-2 px-2 font-bold text-slate-400">${i+1}</td>`+['plate','dorse','model','frigo','driver','phone'].map(k=>`<td class="py-2 px-1"><input id="s-${k}-${i}" value="${esc(v[k])}" class="inp !py-1.5"></td>`).join('')+`<td class="py-2 px-1"><button onclick="deleteVehicle(${i})" class="btn btn-icon danger" title="Aracı sil" aria-label="${esc(v.plate)} aracını sil">${ic('trash')}</button></td></tr>`).join('')||'<tr><td colspan="8" class="td text-center py-6">Henüz araç yok. Araç ekle düğmesiyle başlayın.</td></tr>';
 const cc=$('intermediaryCompanyRows');if(cc)cc.innerHTML=state.intermediaryCompanies.map(c=>`<div class="border rounded-lg p-3 space-y-2"><div class="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] items-end gap-2"><div><label class="lbl" for="ic-name-${esc(c.id)}">Aracı şirket adı</label><input id="ic-name-${esc(c.id)}" class="inp" value="${esc(c.name)}" maxlength="120"></div><div><label class="lbl" for="ic-rate-${esc(c.id)}">Navlun kesintisi (%)</label><input id="ic-rate-${esc(c.id)}" class="inp" type="number" min="0" max="100" step="0.1" value="${Number(c.rate)||0}"></div><div class="flex gap-2"><button class="btn btn-primary" onclick="saveIntermediaryCompany('${esc(c.id)}')">Kaydet</button><button class="btn btn-danger" onclick="deleteIntermediaryCompany('${esc(c.id)}')">Sil</button></div></div><p class="text-xs text-slate-500">Yeni seferlerde bu oran otomatik uygulanır. Önceden kaydedilmiş seferlerin oranı geçmiş kayıt olarak korunur.</p></div>`).join('')||'<p class="text-sm text-slate-500">Henüz aracı şirket eklenmedi.</p>';
 const ss=$('settings-summary');if(ss){const total=state.vehicles.length,drivers=new Set(state.vehicles.map(v=>(v.driver||'').trim()).filter(Boolean)).size,companies=state.intermediaryCompanies.length,records=state.trips.length+state.fuels.length+state.expenses.length+state.payments.length;ss.innerHTML=[['Araç',total,'Filo tanımları'],['Şoför',drivers,'Tanımlı sürücüler'],['Aracı şirket',companies,'Komisyon kartları'],['Kayıt',records,'Sefer, yakıt, gider ve tahsilat']].map(([l,v,sub])=>`<div class="lx-mini-stat"><div class="lx-mini-stat-label">${l}</div><div class="lx-mini-stat-value">${fmtNum(v,0)}</div><div class="lx-mini-stat-sub">${sub}</div></div>`).join('')}
}
function renderAll(){fillMonths();populateSelects();renderDashboard();renderTrips();renderFuel();renderExpenses();renderVehicles();renderDrivers();renderSettings();renderAlerts();renderCari();renderMaint();labelCells();applyTheme()}

/* ---------- Cari ---------- */
let _cari=[];
function cariData(start='',end=''){
 const m={},get=n=>m[n]=m[n]||{client:n,n:0,gross:0,open:0,paid:0,due:null,openTrips:[],dueOpen:0,notDueOpen:0,noDueOpen:0};
 const inRange=d=>(!start||(!!d&&d>=start))&&(!end||(!!d&&d<=end));
 state.trips.filter(t=>inRange(t.date)).forEach(t=>{const c=get(t.client);c.n++;c.gross+=Number(t.price)||0;if(t.paid!=='Tahsil Edildi'){const amt=Math.max(0,(Number(t.price)||0)-tCut(t));c.open+=amt;c.openTrips.push({...t,_amount:amt});if(t.due&&(!c.due||t.due<c.due))c.due=t.due}});
 const linked={};state.payments.filter(p=>!p.closed&&inRange(p.date)).forEach(p=>{const c=get(p.client),a=Number(p.amount)||0;c.paid+=a;if(p.tripId)linked[p.tripId]=(linked[p.tripId]||0)+a});
 return Object.values(m).map(c=>{c.bal=c.open-c.paid;let paymentPool=Math.max(0,c.paid);c.openTrips.forEach(t=>{const l=Math.min(t._amount,linked[t.id]||0);t._linked=l;paymentPool-=l});paymentPool=Math.max(0,paymentPool);const items=[...c.openTrips].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||(a.date||'').localeCompare(b.date||''));items.forEach(t=>{const left=Math.max(0,t._amount-t._linked);const applied=Math.min(paymentPool,left);paymentPool-=applied;const outstanding=left-applied;t._left=outstanding;if(t.due){if(dayDiff(t.due)<=0)c.dueOpen+=outstanding;else c.notDueOpen+=outstanding}else c.noDueOpen+=outstanding});return c}).sort((a,b)=>b.bal-a.bal)
}
const openTotal=()=>cariData().reduce((s,c)=>s+Math.max(c.bal,0),0);
function renderCari(){
 const start=$('cariStart')?.value||'',end=$('cariEnd')?.value||'';const L=_cari=cariData(start,end),all=cariData();
 const k=(l,v,c)=>`<div class="card p-4"><div class="text-[11px] font-semibold text-slate-500">${l}</div><div class="text-lg md:text-xl font-extrabold ${c}">${fmtTL(v)}</div></div>`;
 $('cari-kpis').innerHTML=k('Kalan alacak',L.reduce((s,c)=>s+Math.max(c.bal,0),0),'text-blue-600')+k('Vadesi gelen veya geçen',L.reduce((s,c)=>s+c.dueOpen,0),'text-rose-600')+k('Vadesi gelmeyen',L.reduce((s,c)=>s+c.notDueOpen,0),'text-emerald-600')+k('Vadesi belirsiz',L.reduce((s,c)=>s+c.noDueOpen,0),'text-amber-600');
 $('cari-tbody').innerHTML=L.length?L.map(c=>{const d=c.due?dayDiff(c.due):0;const vd=c.bal<=0?'<span class="text-emerald-600">Kapalı</span>':c.due?(d<0?`<span class="text-rose-600 font-bold">${-d} gün gecikti</span>`:`${fmtD(c.due)} (${d} gün)`):'<span class="text-slate-400">Vade yok</span>';
  return`<tr><td class="td font-bold">${esc(c.client)}</td><td class="td text-right">${c.n}</td><td class="td text-right">${fmtTL(c.gross)}</td><td class="td text-right text-amber-700">${fmtTL(c.open)}</td><td class="td text-right text-emerald-700">${fmtTL(c.paid)}</td><td class="td text-right font-extrabold ${c.bal>0?'text-rose-600':'text-emerald-600'}">${fmtTL(c.bal)}</td><td class="td whitespace-nowrap">${vd}</td><td class="td"><button onclick="showClientReport('${encodeURIComponent(c.client)}')" class="text-blue-600 font-semibold text-sm">Ekstre</button></td></tr>`}).join(''):'<tr><td colspan="8" class="text-center py-8 text-slate-400">Müşteri yok.</td></tr>';
 const ot=L.flatMap(c=>c.openTrips.map(t=>({...t,clientName:c.client}))).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
 $('open-tbody').innerHTML=ot.length?ot.map(t=>`<tr><td class="td font-bold">${esc(t.client)}</td><td class="td">${fmtD(t.date)} • ${esc(t.route)}</td><td class="td whitespace-nowrap">${t.due?(dayDiff(t.due)<0?`<span class="text-rose-600 font-bold">${fmtD(t.due)} (${-dayDiff(t.due)} gün gecikti)</span>`:fmtD(t.due)):'-'}</td><td class="td text-right font-bold">${fmtTL(t._left??t._amount)}${t._left!==undefined&&t._left<t._amount?`<div class="text-[10px] text-slate-400">navlun net ${fmtTL(t._amount)}</div>`:''}</td><td class="td"><button onclick="editRecord('trips',${t.id})" class="btn btn-icon" title="Düzenle" aria-label="Seferi düzenle">${ic('pencil')}</button></td></tr>`).join(''):'<tr><td colspan="5" class="text-center py-6 text-slate-400">Açık sefer yok.</td></tr>';
 $('pay-tbody').innerHTML=state.payments.length?byDate(state.payments).map(p=>`<tr class="${p.closed?'opacity-50':''}"><td class="td whitespace-nowrap">${fmtD(p.date)}</td><td class="td font-bold">${esc(p.client)}</td><td class="td">${esc(p.note)}${p.closed?' (hesap kapatıldı)':''}${p.tripId&&state.trips.find(t=>String(t.id)===String(p.tripId))?`<div class="text-xs text-slate-500">Sefer: ${esc(tripLabel(state.trips.find(t=>String(t.id)===String(p.tripId))))}</div>`:''}</td><td class="td text-right font-bold text-emerald-700">${fmtTL(p.amount)}</td><td class="td whitespace-nowrap">${rowActions('payments',p.id,'Tahsilat')}</td></tr>`).join(''):'<tr><td colspan="5" class="text-center py-6 text-slate-400">Tahsilat kaydı yok.</td></tr>';
 mlist('pay-cards',byDate(state.payments).map(p=>{const tr=p.tripId&&state.trips.find(t=>String(t.id)===String(p.tripId));return mcard({lead:`<b class="text-slate-800 truncate">${esc(p.client)}</b>`,date:fmtD(p.date),title:esc(p.note||'Tahsilat'),sub:tr?'Sefer: '+esc(tripLabel(tr)):'',amt:fmtTL(p.amount),cls:'text-emerald-700',act:rowActions('payments',p.id,'Tahsilat')})}),'Henüz tahsilat yok.');
 const names=[...new Set([...state.clients.map(c=>c.name),...all.map(c=>c.client)].filter(Boolean))];$('client-cards').innerHTML=names.length?names.map(n=>{const c=all.find(x=>x.client===n)||{n:0,gross:0,open:0,paid:0,bal:0,dueOpen:0,notDueOpen:0};return`<div class="card p-4"><div class="font-semibold">${esc(n)}</div><div class="grid grid-cols-2 gap-2 text-xs mt-3"><div><span class="text-slate-500">Sefer</span><div class="font-bold">${c.n}</div></div><div><span class="text-slate-500">Kalan alacak</span><div class="font-extrabold text-rose-600">${fmtTL(Math.max(c.bal,0))}</div></div><div><span class="text-slate-500">Vadesi gelen</span><div class="font-bold">${fmtTL(c.dueOpen)}</div></div><div><span class="text-slate-500">Vadesi gelmeyen</span><div class="font-bold">${fmtTL(c.notDueOpen)}</div></div></div><div class="flex flex-wrap gap-3 mt-3"><button onclick="showClientReport('${encodeURIComponent(n)}')" class="text-blue-600 text-sm font-semibold">Ekstre (PDF)</button><button onclick="createReceivable('${encodeURIComponent(n)}')" class="text-emerald-700 text-sm font-semibold">Vadeli sefer ekle</button></div></div>`}).join(''):'<p class="text-sm text-slate-500">Henüz müşteri kartı yok.</p>';
 fill('payClient',names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join(''));setupSuggestions();
}
function createClient(){openModal('clientModal')}
function saveClient(e){e.preventDefault();const n=val('clientName').trim();if(!n)return;if(!state.clients.some(c=>nameKey(c.name)===nameKey(n)))state.clients.push({id:cid(n),name:n});$('clientModal-form').reset();closeModal('clientModal');saveState();toast('Müşteri kartı oluşturuldu: '+n)}
// Alacak kartı = vadeli sefer: sefer formu müşteri adıyla açılır.
function createReceivable(encodedName){openModal('tripModal');if(!$('tripModal').classList.contains('flex'))return;$('tripClient').value=decodeURIComponent(encodedName);$('tripPaid').value='Vadeli / Bekliyor';$('tripRoute').focus()}
const tripLabel=t=>`${t.date||''} • ${t.route||'sefer'}${t.invoiceNo?' • '+t.invoiceNo:''}`;
// Son 6 ayın net kârı (eski → yeni), çizgi ve aylık değişim için
function monthNets(){const out=[];let [y,m]=today().slice(0,7).split('-').map(Number);for(let i=0;i<6;i++){const k=`${y}-${String(m).padStart(2,'0')}`,f=a=>a.filter(x=>(x.date||'').startsWith(k));out.unshift(calc(f(state.trips),f(state.fuels),f(state.expenses)).net);if(--m===0){m=12;y--}}return out}
// Yarım daire ibreli gösterge. zones: [[başlangıç, bitiş, renk]]
function gauge({label,value,min,max,zones,text,unit,note}){
 const C=100,R=78,ang=v=>Math.PI*(1-(Math.min(max,Math.max(min,v))-min)/(max-min)),pt=(v,r=R)=>[C+r*Math.cos(ang(v)),95-r*Math.sin(ang(v))];
 const arc=(a,b,col)=>{const[x1,y1]=pt(a),[x2,y2]=pt(b);return `<path class="g-arc" d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${col}" style="color:${col}" stroke-width="12" fill="none" stroke-linecap="butt"/>`};
 const has=value!==null&&isFinite(value),[nx,ny]=has?pt(value,R-30):[C,95];
 return `<div class="card gauge" role="img" aria-label="${esc(label)}: ${has?esc(text):'veri yok'}"><svg viewBox="0 0 200 148">${arc(min,max,'var(--line)')}${zones.map(z=>arc(z[0],z[1],z[2])).join('')}
  ${has?`<line class="g-needle" x1="${C}" y1="95" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"/>`:''}<circle class="g-hub" cx="${C}" cy="95" r="5"/>
  <text class="g-val" x="${C}" y="130" text-anchor="middle">${has?esc(text):'—'}</text><text class="g-unit" x="${C}" y="146" text-anchor="middle">${esc(unit)}</text>
  <text class="g-tick" x="22" y="110" text-anchor="middle">${min}</text><text class="g-tick" x="178" y="110" text-anchor="middle">${max}</text></svg><div class="g-label">${esc(label)}</div>${note?`<div class="g-note">${note}</div>`:''}</div>`;
}
function renderGauges(a){
 const el=$('gauges');if(!el)return;
 const P='var(--pos)',W='var(--warn)',N='var(--neg)',margin=a.rev>0?a.net/a.rev*100:null;
 const L=cariData(),netAll=state.trips.reduce((s,t)=>s+Math.max(0,(Number(t.price)||0)-tCut(t)),0),open=L.reduce((s,c)=>s+Math.max(c.bal,0),0),coll=netAll>0?(1-open/netAll)*100:null;
 const rpk=a.km>0?a.gross/a.km:null,cpk=a.km>0?(a.fuel+a.exp)/a.km:null,cmax=rpk?Math.max(5,Math.ceil(rpk/5)*5):10;
 el.innerHTML=gauge({label:'Kâr marjı',value:margin,min:0,max:80,zones:[[0,15,N],[15,30,W],[30,80,P]],text:margin!==null?'%'+fmtNum(margin,0):'',unit:'net / navlun'})
  +gauge({label:'Çekici tüketimi',value:a.avg>0?a.avg:null,min:20,max:45,zones:[[20,32,P],[32,37,W],[37,45,N]],text:a.avg>0?fmtNum(a.avg):'',unit:'lt / 100 km',note:a.avg>0?'':'Gösterge km\'li mazot girin'})
  +gauge({label:'Tahsilat oranı',value:coll,min:0,max:100,zones:[[0,60,N],[60,85,W],[85,100,P]],text:coll!==null?'%'+fmtNum(coll,0):'',unit:'tahsil edilen',note:open>0?`Açık ${fmtTL(open)}`:''})
  +gauge({label:'Km başı maliyet',value:cpk,min:0,max:cmax,zones:[[0,cmax*.6,P],[cmax*.6,cmax*.85,W],[cmax*.85,cmax,N]],text:cpk!==null?fmtNum(cpk,1):'',unit:'₺ / km',note:rpk?`Navlun ${fmtNum(rpk,1)} ₺/km`:''});
}
