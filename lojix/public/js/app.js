function closeClient(i){
 // Finansal güvenlik: Toplu kapatma açık seferleri gerçek tahsilat olmadan kapatabiliyordu.
 // Cari hesap/tahsilat modeli tamamlanana kadar bu işlem özellikle engellenir.
 const c=_cari[i];
 if(c) alert('Güvenlik nedeniyle toplu cari kapatma devre dışıdır. Tahsilatı, gerçekleştiği tutar ve tarihle ayrı bir ödeme kaydı olarak girin. Açık seferleri topluca tahsil edilmiş saymayın.');
}
function savePayment(e){e.preventDefault();const client=val('payClient');if(client&&!state.clients.some(c=>c.name.toLocaleLowerCase('tr')===client.toLocaleLowerCase('tr')))state.clients.push({id:cid(client),name:client});const data={date:val('payDate'),client,amount:Number(val('payAmount')),note:val('payNote').trim()};if(editTarget&&editTarget.collection==='payments'){const r=state.payments.find(x=>String(x.id)===String(editTarget.id));if(r)Object.assign(r,data)}else state.payments.push({id:Date.now(),...data});$('payModal-form').reset();editTarget=null;closeModal('payModal');resetEditModal('payModal');saveState()}

/* ---------- Uyarılar / Bakım ---------- */
function alertList(){const o=[];
 state.vehicles.forEach(v=>{
  [['muayene','Muayene'],['sigorta','Trafik sigortası'],['kasko','Kasko']].forEach(([k,l])=>{if(!v[k])return;const d=dayDiff(v[k]);if(d<=30)o.push({lv:d<=7?'red':'amber',txt:`${v.plate} • ${l} ${d<0?-d+' gün önce doldu':d===0?'bugün doluyor':d+' gün kaldı'}`})});
  if(v.nextService>0&&v.odo>0){const r=v.nextService-v.odo;if(r<=2000)o.push({lv:r<=0?'red':'amber',txt:`${v.plate} • Bakım ${r<=0?fmtNum(-r,0)+' km geçti':fmtNum(r,0)+' km kaldı'}`})}});
 cariData().forEach(c=>{if(c.bal>0&&c.due&&dayDiff(c.due)<0)o.push({lv:'red',txt:`${c.client} • ${fmtTL(c.bal)} alacağın vadesi ${-dayDiff(c.due)} gün geçti`})});
 return o.sort((a,b)=>(a.lv==='red'?0:1)-(b.lv==='red'?0:1))}
function renderAlerts(){const a=alertList(),el=$('alerts-box');if(!a.length){el.innerHTML='';return}
 el.innerHTML=`<div class="card p-4 border-l-4 ${a.some(x=>x.lv==='red')?'border-l-rose-500':'border-l-amber-400'}"><div class="font-bold text-sm mb-2">⚠️ ${a.length} Uyarı</div><div class="space-y-1 text-xs md:text-sm">${a.slice(0,8).map(x=>`<div>${x.lv==='red'?'🔴':'🟠'} ${esc(x.txt)}</div>`).join('')}${a.length>8?`<div class="text-slate-400">+${a.length-8} uyarı daha</div>`:''}</div><button onclick="switchTab('maint')" class="mt-2 text-xs font-bold text-blue-600">Bakım & belgelere git →</button></div>`}
function badge(d){if(!d)return'<span class="text-[11px] text-slate-400">tarih yok</span>';const n=dayDiff(d);return`<span class="${n<=7?'bg-rose-100 text-rose-700':n<=30?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-700'} px-2 py-0.5 rounded-full text-[11px] font-bold">${n<0?-n+' gün geçti':n+' gün kaldı'}</span>`}
function renderMaint(){
 if(document.activeElement&&document.activeElement.id&&document.activeElement.id.startsWith('m-'))return;
 $('maint-tbody').innerHTML=state.vehicles.map((v,i)=>{
  const dc=k=>`<td class="td"><input type="date" id="m-${k}-${i}" value="${esc(v[k]||'')}" class="inp !py-1.5" style="min-width:140px"><div class="mt-1">${badge(v[k])}</div></td>`;
  const nc=k=>`<input type="number" inputmode="numeric" id="m-${k}-${i}" value="${v[k]||''}" class="inp !py-1.5" style="min-width:110px">`;
  const r=v.nextService>0&&v.odo>0?v.nextService-v.odo:null;
  const rb=r===null?'<span class="text-[11px] text-slate-400">km girin</span>':`<span class="${r<=0?'bg-rose-100 text-rose-700':r<=2000?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-700'} px-2 py-0.5 rounded-full text-[11px] font-bold">${r<=0?fmtNum(-r,0)+' km geçti':fmtNum(r,0)+' km kaldı'}</span>`;
  return`<tr><td class="td"><b>${esc(v.plate)}</b>${dl(v)}<div class="text-xs text-slate-500">${esc(v.driver)}</div></td>${dc('muayene')}${dc('sigorta')}${dc('kasko')}<td class="td">${nc('odo')}</td><td class="td">${nc('nextService')}<div class="mt-1">${rb}</div></td><td class="td">${nc('interval')}${v.interval>0&&v.odo>0?`<button onclick="markService(${i})" class="mt-1 text-[11px] font-bold text-blue-600 underline">Bakım yapıldı</button>`:''}</td></tr>`}).join('');
 const sm=$('maint-summary');if(sm){const vehicles=state.vehicles.length,expired=state.vehicles.reduce((n,v)=>n+['muayene','sigorta','kasko'].filter(k=>v[k]&&dayDiff(v[k])<0).length,0),soon=state.vehicles.reduce((n,v)=>n+['muayene','sigorta','kasko'].filter(k=>v[k]&&dayDiff(v[k])>=0&&dayDiff(v[k])<=30).length,0),service=state.vehicles.filter(v=>v.nextService>0&&v.odo>0&&v.nextService-v.odo<=2000).length;sm.innerHTML=[['FİLODAKİ ARAÇ',vehicles,'Bakım ve belge takibi'],['BELGESİ SÜRESİ GEÇEN',expired,'Kontrol gerekli'],['30 GÜN İÇİNDE BİTECEK',soon,'Belge yenileme zamanı'],['BAKIM UYARISI',service,'2.000 km veya daha az']].map(([l,v,sub],i)=>`<div class="lx-mini-stat"><div class="lx-mini-stat-label">${l}</div><div class="lx-mini-stat-value" style="${i===1&&v?'color:#ff8e9a':i===2&&v?'color:#f4c66d':i===3&&v?'color:#ffb36b':''}">${fmtNum(v,0)}</div><div class="lx-mini-stat-sub">${sub}</div></div>`).join('')}}
function readMaint(){state.vehicles.forEach((v,i)=>{['muayene','sigorta','kasko'].forEach(k=>v[k]=$(`m-${k}-${i}`).value);['odo','nextService','interval'].forEach(k=>v[k]=Number($(`m-${k}-${i}`).value)||0)})}
function saveMaint(){readMaint();document.activeElement.blur();saveState();alert('Kaydedildi.')}
function markService(i){readMaint();const v=state.vehicles[i];v.nextService=v.odo+v.interval;document.activeElement.blur();saveState()}
function bumpOdo(id,km){const v=state.vehicles.find(x=>x.id===id);if(v&&v.odo>0)v.odo+=km||0}
function previewTrip(){const t={vehicleId:val('tripVehicle'),km:0,price:Number(val('tripPrice'))||0,commPct:Number(val('tripComm'))||0,deduct:Number(val('tripDeduct'))||0,extra:Number(val('tripExtra'))||0};
 const f=estFuel(t,fuelRef()),c=tCut(t),n=t.price-c-f-t.extra;
 $('tripPreview').innerHTML=`Komisyon+kesinti: <b>${fmtTL(c)}</b> • Tahmini yakıt: <b>${fmtTL(f)}</b> • Masraf: <b>${fmtTL(t.extra)}</b><br>Tahmini net kâr: <b class="${netCls(n)}">${fmtTL(n)}</b>`}

/* ---------- Formlar ---------- */
let editTarget=null;

const fld=(id,l,type='text',x='')=>`<div><label class="lbl" for="${id}">${l}</label><input id="${id}" type="${type}" ${x} class="inp"></div>`;
const sel=(id,l,opts='',x='')=>`<div><label class="lbl" for="${id}">${l}</label><select id="${id}" ${x} class="inp">${opts}</select></div>`;
const modal=(id,title,fn,body,btn,col)=>`<div id="${id}" class="fixed inset-0 bg-slate-900/60 hidden items-center justify-center z-50 p-4"><div class="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto"><div class="flex justify-between items-center border-b pb-3 mb-3"><h3 class="font-bold">${title}</h3><button type="button" onclick="closeModal('${id}')" class="text-slate-400 text-2xl leading-none px-2">&times;</button></div><form id="${id}-form" onsubmit="${fn}(event)" class="space-y-3 text-sm">${body}<div class="pt-3 flex justify-end gap-2 border-t"><button type="button" onclick="closeModal('${id}')" class="px-4 py-2 rounded-lg bg-slate-100 font-semibold">İptal</button><button type="submit" class="px-5 py-2 rounded-lg ${col} text-white font-semibold">${btn}</button></div></form></div></div>`;
const g2=h=>`<div class="grid grid-cols-2 gap-3">${h}</div>`,g3=h=>`<div class="grid grid-cols-3 gap-3">${h}</div>`;
function buildModals(){
 $('modals').innerHTML=
 modal('tripModal','🛣️ Yeni Sefer & Navlun','saveTrip',
  g2(fld('tripDate','Tarih','date','required')+sel('tripVehicle','Araç','',"required onchange=\"syncDriver('tripVehicle','tripDriver');previewTrip()\""))+
  g2(sel('tripDriver','Şoför','','required')+fld('tripCargo','Yük & Frigo Derecesi','text','required list="cargoSuggestions" placeholder="Yaş Sebze (+4°C)"'))+
  g2(fld('tripRoute','Güzergâh (Nereden - Nereye)','text','required list="routeSuggestions" placeholder="Antalya - İstanbul Hal"')+fld('tripClient','Firma / Müşteri','text','required list="clientSuggestions"'))+
  g2(sel('tripCompany','İşi Veren Aracı Şirket','<option value="">Aracı şirket yok</option>','onchange="setTripCompany();previewTrip()"')+'<div class="text-xs text-slate-500 self-center">Şirket seçilince kayıtlı kesinti oranı otomatik uygulanır.</div>')+
  g2(fld('tripPrice','Navlun (₺)','number','required min="0" step="0.01" inputmode="decimal" oninput="previewTrip()"')+sel('tripPaid','Tahsilat','<option>Vadeli / Bekliyor</option><option>Tahsil Edildi</option>'))+
  g2(fld('tripDue','Vade Tarihi (vadeliyse)','date')+fld('tripComm','Komisyon (%)','number','min="0" max="100" step="0.1" value="0" inputmode="decimal" oninput="previewTrip()"'))+
  g2(fld('tripDeduct','Müşteri Kesintisi (₺)','number','min="0" step="0.01" value="0" inputmode="decimal" oninput="previewTrip()"')+fld('tripExtra','Sefer Masrafı (₺: HGS, harcırah)','number','min="0" step="0.01" value="0" inputmode="decimal" oninput="previewTrip()"'))+
  '<div id="tripPreview" class="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3"></div>',
  'Seferi Kaydet','bg-emerald-600')+
 modal('fuelModal','⛽ Yakıt Girişi','saveFuel',
  g2(fld('fuelDate','Tarih','date','required')+sel('fuelVehicle','Araç','',"required onchange=\"syncDriver('fuelVehicle','fuelDriver')\""))+
  g2(sel('fuelDriver','Şoför','','required')+sel('fuelType','Yakıt Türü','<option value="CEKICI">Çekici Mazotu</option><option value="FRIGO">Frigo Dorse Mazotu</option><option value="ADBLUE">AdBlue</option>'))+
  g3(fld('fuelLiters','Litre','number','required min="0.1" step="0.01" inputmode="decimal" oninput="calcFuel()"')+fld('fuelUnitPrice','Litre Fiyatı (₺)','number','required min="0.01" step="0.01" inputmode="decimal" oninput="calcFuel()"')+fld('fuelTotalCost','Toplam (₺)','number','required min="0.01" step="0.01" inputmode="decimal"'))+
  g2(fld('fuelOdometerKm','Araç Gösterge KM (çekici mazotunda zorunlu)','number','min="0" step="1" inputmode="numeric"')+fld('fuelStation','Petrol / İstasyon','text','list="stationSuggestions" placeholder="Opet Afyon / Shell"')),
  'Yakıtı Kaydet','bg-amber-500')+
 modal('expenseModal','🔧 Gider Girişi','saveExpense',
  g2(fld('expDate','Tarih','date','required')+sel('expVehicle','Araç','',"required onchange=\"syncDriver('expVehicle','expDriver')\""))+
  g2(sel('expDriver','Şoför','','required')+sel('expCategory','Kategori',CATS.map(c=>`<option>${esc(c)}</option>`).join(''),'required'))+
  g2(fld('expAmount','Tutar (₺)','number','required min="0.01" step="0.01" inputmode="decimal"')+fld('expNote','Açıklama','text','required list="expenseNoteSuggestions" placeholder="İstanbul harcırahı"')),
  'Gideri Kaydet','bg-rose-600')+
 modal('payModal','💵 Tahsilat (Kısmi Ödeme)','savePayment',
  g2(fld('payDate','Tarih','date','required')+sel('payClient','Müşteri','','required'))+
  g2(fld('payAmount','Tutar (₺)','number','required min="0.01" step="0.01" inputmode="decimal"')+fld('payNote','Not','text','placeholder="Havale / çek no"')),
  'Tahsilatı Kaydet','bg-emerald-600');
}
function openModal(id){
 setupSuggestions();if(!editTarget)resetEditModal(id);
 const m=$(id);m.classList.remove('hidden');m.classList.add('flex');
 if(id==='payModal'){$('payDate').value=today();return}
 const p={tripModal:['tripDate','tripVehicle','tripDriver'],fuelModal:['fuelDate','fuelVehicle','fuelDriver'],expenseModal:['expDate','expVehicle','expDriver']}[id];
 $(p[0]).value=today();syncDriver(p[1],p[2]);if(id==='tripModal'){if($('tripCompany'))$('tripCompany').value='';$('tripComm').readOnly=false;$('tripComm').value=0;previewTrip();}
}
function closeModal(id){const m=$(id);m.classList.add('hidden');m.classList.remove('flex');if(editTarget&&editTarget.modal===id)editTarget=null}
function editRecord(collection,id){
 const r=state[collection].find(x=>String(x.id)===String(id));if(!r)return;
 const modalId={trips:'tripModal',fuels:'fuelModal',expenses:'expenseModal',payments:'payModal'}[collection];if(!modalId)return;
 editTarget={collection,id:r.id,modal:modalId};openModal(modalId);
 const put=(field,value)=>{const el=$(field);if(el)el.value=value??''};
 if(collection==='trips'){
  put('tripDate',r.date);put('tripVehicle',r.vehicleId);syncDriver('tripVehicle','tripDriver');put('tripDriver',r.driver);put('tripCargo',r.cargo);put('tripRoute',r.route);put('tripClient',r.client);put('tripCompany',r.intermediaryCompanyId);put('tripPrice',r.price);put('tripPaid',r.paid);put('tripDue',r.due);put('tripComm',r.commPct);put('tripDeduct',r.deduct);put('tripExtra',r.extra);$('tripComm').readOnly=!!r.intermediaryCompanyId;previewTrip();
 }else if(collection==='fuels'){
  put('fuelDate',r.date);put('fuelVehicle',r.vehicleId);syncDriver('fuelVehicle','fuelDriver');put('fuelDriver',r.driver);put('fuelType',r.type);put('fuelLiters',r.liters);put('fuelUnitPrice',r.unitPrice);put('fuelTotalCost',r.totalCost);put('fuelOdometerKm',r.odometerKm);put('fuelStation',r.station);
 }else if(collection==='expenses'){
  put('expDate',r.date);put('expVehicle',r.vehicleId);syncDriver('expVehicle','expDriver');put('expDriver',r.driver);put('expCategory',r.category);put('expAmount',r.amount);put('expNote',r.note);
 }else if(collection==='payments'){
  put('payDate',r.date);put('payClient',r.client);put('payAmount',r.amount);put('payNote',r.note);
 }
 const m=$(modalId),title=m.querySelector('h3'),submit=m.querySelector('button[type="submit"]');if(title)title.textContent=({trips:'🛣️ Sefer Kaydını Düzenle',fuels:'⛽ Yakıt Kaydını Düzenle',expenses:'🔧 Gider Kaydını Düzenle',payments:'💵 Tahsilat Kaydını Düzenle'})[collection];if(submit)submit.textContent='Değişiklikleri Kaydet';
}
function resetEditModal(modalId){const m=$(modalId);if(!m)return;const title=m.querySelector('h3'),submit=m.querySelector('button[type="submit"]');if(title)title.textContent=({tripModal:'🛣️ Yeni Sefer & Navlun',fuelModal:'⛽ Yakıt Girişi',expenseModal:'🔧 Gider Girişi',payModal:'💵 Tahsilat (Kısmi Ödeme)'})[modalId];if(submit)submit.textContent=({tripModal:'Seferi Kaydet',fuelModal:'Yakıtı Kaydet',expenseModal:'Gideri Kaydet',payModal:'Tahsilatı Kaydet'})[modalId];}

function calcFuel(){const l=parseFloat($('fuelLiters').value)||0,p=parseFloat($('fuelUnitPrice').value)||0;$('fuelTotalCost').value=(l*p).toFixed(2)}
const val=id=>$(id).value;
function setTripCompany(){const c=state.intermediaryCompanies.find(x=>x.id===val('tripCompany'));if(c){$('tripComm').value=Number(c.rate)||0;$('tripComm').readOnly=true;}else{$('tripComm').value=0;$('tripComm').readOnly=false;}}
function addIntermediaryCompany(){const name=prompt('Aracı şirket adı:');if(name===null||!name.trim())return;const rateText=prompt('Navlun kesinti oranı (%):','7');if(rateText===null)return;const rate=Number(rateText);if(!Number.isFinite(rate)||rate<0||rate>100)return alert('Kesinti oranı %0 ile %100 arasında olmalı.');if(state.intermediaryCompanies.some(c=>c.name.toLocaleLowerCase('tr')===name.trim().toLocaleLowerCase('tr')))return alert('Bu şirket zaten kayıtlı.');state.intermediaryCompanies.push({id:'IC'+Date.now(),name:name.trim(),rate});saveState();}
function saveIntermediaryCompany(id){const c=state.intermediaryCompanies.find(x=>String(x.id)===String(id));if(!c)return;const name=($('ic-name-'+id)?.value||'').trim();const rate=Number($('ic-rate-'+id)?.value);if(!name)return alert('Şirket adı boş bırakılamaz.');if(!Number.isFinite(rate)||rate<0||rate>100)return alert('Kesinti oranı %0 ile %100 arasında olmalı.');if(state.intermediaryCompanies.some(x=>String(x.id)!==String(id)&&String(x.name||'').trim().toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))return alert('Bu şirket adı zaten kayıtlı.');c.name=name;c.rate=rate;saveState();alert('Aracı şirket kartı güncellendi. Yeni seferlerde güncel oran uygulanacak; eski sefer kayıtları korunur.')}
function editIntermediaryCompany(id){const c=state.intermediaryCompanies.find(x=>String(x.id)===String(id));if(!c)return;const name=prompt('Aracı şirket adı:',c.name);if(name===null||!name.trim())return;const rateText=prompt('Navlun kesinti oranı (%):',String(c.rate));if(rateText===null)return;const rate=Number(rateText);if(!Number.isFinite(rate)||rate<0||rate>100)return alert('Kesinti oranı %0 ile %100 arasında olmalı.');c.name=name.trim();c.rate=rate;saveState()}
function deleteIntermediaryCompany(id){if(!confirm('Aracı şirket kartı silinsin mi? Eski seferlerde kayıtlı kesinti tutarları korunur.'))return;state.intermediaryCompanies=state.intermediaryCompanies.filter(c=>c.id!==id);saveState()}
function saveTrip(e){e.preventDefault();const client=val('tripClient').trim();if(client&&!state.clients.some(c=>c.name.toLocaleLowerCase('tr')===client.toLocaleLowerCase('tr')))state.clients.push({id:cid(client),name:client});const data={date:val('tripDate'),vehicleId:val('tripVehicle'),driver:val('tripDriver'),cargo:val('tripCargo').trim(),route:val('tripRoute').trim(),client,price:Number(val('tripPrice')),paid:val('tripPaid'),due:val('tripDue'),intermediaryCompanyId:val('tripCompany')||'',commPct:Number(val('tripComm'))||0,deduct:Number(val('tripDeduct'))||0,extra:Number(val('tripExtra'))||0};if(editTarget&&editTarget.collection==='trips'){const r=state.trips.find(x=>String(x.id)===String(editTarget.id));if(r)Object.assign(r,data)}else state.trips.push({id:Date.now(),km:0,...data});$('tripModal-form').reset();editTarget=null;closeModal('tripModal');resetEditModal('tripModal');saveState()}
function saveFuel(e){e.preventDefault();const vehicleId=val('fuelVehicle'),type=val('fuelType'),odometerKm=Number(val('fuelOdometerKm'))||0;const editing=editTarget&&editTarget.collection==='fuels'?state.fuels.find(x=>String(x.id)===String(editTarget.id)):null;const prev=state.fuels.filter(x=>x.id!==(editing&&editing.id)&&x.vehicleId===vehicleId&&x.type==='CEKICI'&&Number(x.odometerKm)>0&&((x.date||'')<=val('fuelDate'))).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.id-a.id)[0];if(type==='CEKICI'&&!odometerKm)return alert('Çekici mazotu için aracın gösterge KM bilgisini girin.');if(type==='CEKICI'&&prev&&odometerKm<=Number(prev.odometerKm))return alert('Gösterge KM, önceki mazot kaydındaki KM değerinden büyük olmalı.');const data={date:val('fuelDate'),vehicleId,driver:val('fuelDriver'),type,liters:Number(val('fuelLiters')),unitPrice:Number(val('fuelUnitPrice')),totalCost:Number(val('fuelTotalCost'))||Number(val('fuelLiters'))*Number(val('fuelUnitPrice')),odometerKm,distanceKm:editing?editing.distanceKm||0:0,station:val('fuelStation').trim()};if(editing)Object.assign(editing,data);else state.fuels.push({id:Date.now(),...data});if(type==='CEKICI'){const vehicle=state.vehicles.find(v=>v.id===vehicleId);if(vehicle)vehicle.odo=Math.max(Number(vehicle.odo)||0,odometerKm)}$('fuelModal-form').reset();editTarget=null;closeModal('fuelModal');resetEditModal('fuelModal');saveState()}
function saveExpense(e){e.preventDefault();const data={date:val('expDate'),vehicleId:val('expVehicle'),driver:val('expDriver'),category:val('expCategory'),amount:Number(val('expAmount')),note:val('expNote').trim()};if(editTarget&&editTarget.collection==='expenses'){const r=state.expenses.find(x=>String(x.id)===String(editTarget.id));if(r)Object.assign(r,data)}else state.expenses.push({id:Date.now(),...data});$('expenseModal-form').reset();editTarget=null;closeModal('expenseModal');resetEditModal('expenseModal');saveState()}
function financeBars(income,cost,net){const max=Math.max(Math.abs(income),Math.abs(cost),Math.abs(net),1);const rows=[['Gelir',income,'bg-emerald-500'],['Gider + kesinti',cost,'bg-rose-500'],['Net kazanç',net,net>=0?'bg-blue-500':'bg-amber-500']];return rows.map(([l,v,c])=>`<div><div class="flex justify-between text-xs mb-1"><span>${l}</span><b>${fmtTL(v)}</b></div><div class="h-3 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${c} rounded-full" style="width:${Math.min(100,Math.abs(v)/max*100)}%"></div></div></div>`).join('')}
function setupSuggestions(){const unique=a=>[...new Map(a.filter(v=>v!==null&&v!==undefined).map(v=>String(v).trim()).filter(v=>v.length).map(v=>[v.toLocaleLowerCase('tr'),v])).values()].sort((a,b)=>a.localeCompare(b,'tr'));const vals={station:unique(state.fuels.map(x=>x.station)),client:unique([...state.clients.map(x=>x.name),...state.trips.map(x=>x.client),...state.payments.map(x=>x.client)]),route:unique(state.trips.map(x=>x.route)),cargo:unique(state.trips.map(x=>x.cargo)),expenseNote:unique(state.expenses.map(x=>x.note)),paymentNote:unique(state.payments.map(x=>x.note)),model:unique(state.vehicles.map(x=>x.model)),frigo:unique(state.vehicles.map(x=>x.frigo)),driver:unique(state.vehicles.map(x=>x.driver)),plate:unique(state.vehicles.map(x=>x.plate)),dorse:unique(state.vehicles.map(x=>x.dorse))};Object.entries({stationSuggestions:vals.station,clientSuggestions:vals.client,routeSuggestions:vals.route,cargoSuggestions:vals.cargo,expenseNoteSuggestions:vals.expenseNote,paymentNoteSuggestions:vals.paymentNote,modelSuggestions:vals.model,frigoSuggestions:vals.frigo,driverSuggestions:vals.driver,plateSuggestions:vals.plate,dorseSuggestions:vals.dorse}).forEach(([id,a])=>{const dl=$(id);if(dl)dl.innerHTML=a.map(x=>`<option value="${esc(x)}"></option>`).join('')});const mappings={tripClient:'clientSuggestions',payClient:'clientSuggestions',tripRoute:'routeSuggestions',tripCargo:'cargoSuggestions',fuelStation:'stationSuggestions',expNote:'expenseNoteSuggestions',payNote:'paymentNoteSuggestions'};Object.entries(mappings).forEach(([id,list])=>{const el=$(id);if(el){el.setAttribute('list',list);el.setAttribute('autocomplete','on')}});[['s-model-','modelSuggestions'],['s-frigo-','frigoSuggestions'],['s-driver-','driverSuggestions'],['s-plate-','plateSuggestions'],['s-dorse-','dorseSuggestions']].forEach(([prefix,list])=>document.querySelectorAll(`input[id^="${prefix}"]`).forEach(el=>{el.setAttribute('list',list);el.setAttribute('autocomplete','on')}))}
function togglePaid(id){const t=state.trips.find(x=>x.id===id);if(t){t.paid=t.paid==='Tahsil Edildi'?'Vadeli / Bekliyor':'Tahsil Edildi';saveState()}}
function delItem(c,id){if(!confirm('Bu kaydı silmek istediğinize emin misiniz?'))return;state[c]=state[c].filter(x=>x.id!==id);saveState()}
function saveFleet(){
 const nv=state.vehicles.map((v,i)=>({...v,plate:$('s-plate-'+i).value.trim(),dorse:$('s-dorse-'+i).value.trim(),model:$('s-model-'+i).value.trim(),frigo:$('s-frigo-'+i).value.trim(),driver:$('s-driver-'+i).value.trim(),phone:$('s-phone-'+i).value.trim()}));
 if(nv.some(v=>!v.plate||!v.driver))return alert('Plaka ve şoför adı boş bırakılamaz.');
 nv.forEach((v,i)=>{const old=state.vehicles[i].driver;if(old!==v.driver)['trips','fuels','expenses'].forEach(c=>state[c].forEach(r=>{if(r.vehicleId===v.id&&r.driver===old)r.driver=v.driver}))});
 state.vehicles=nv;document.activeElement.blur();saveState();alert('Araç ve şoför bilgileri güncellendi.');
}

/* ---------- Yedek / Dışa aktar ---------- */
async function download(blob,name){
 const file=new File([blob],name,{type:blob.type});
 if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(e){if(e.name==='AbortError')return}}
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);
}
const stamp=()=>today();
function exportJSON(){download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`Lojix_Yedek_${stamp()}.json`)}
function importJSON(ev){
 const file=ev.target.files[0];if(!file)return;const r=new FileReader();
 r.onload=()=>{try{const n=normalize(JSON.parse(r.result));if(!n)throw 0;if(!confirm('Mevcut tüm kayıtların yerine yedekteki veriler yüklenecek. Devam edilsin mi?'))return;try{localStorage.setItem(KEY+'_PREIMPORT_BACKUP',JSON.stringify(state))}catch(e){if(!confirm('Mevcut verinin otomatik geri dönüş kopyası alınamadı. Yine de devam etmek istiyor musunuz?'))return}state=n;saveState();alert('Yedek yüklendi. Önceki veriler için geri dönüş kopyası bu tarayıcıda saklandı.')}catch(e){alert('Geçersiz yedek dosyası.')}finally{ev.target.value=''}};
 r.readAsText(file);
}
function exportCSV(){
 const c=x=>`"${String(x??'').replace(/"/g,'""')}"`,{t,f,e}=D();
 let mv=$('monthFilter').value;
 let s='\uFEFFLojix - Filo Raporu;Tarih: '+new Date().toLocaleDateString('tr-TR')+';Dönem: '+(mv==='ALL'?'Tüm Zamanlar':mv)+'\n\nPlaka;Dorse Plakası;Model;Şoför;Sefer;KM;Navlun (Brüt);Komisyon/Kesinti;Yakıt;Diğer Gider;Lt/100km;Net Kâr\n';
 state.vehicles.forEach(v=>{const m=calc(t.filter(x=>x.vehicleId===v.id),f.filter(x=>x.vehicleId===v.id),e.filter(x=>x.vehicleId===v.id));
  s+=[c(v.plate),c(v.dorse),c(v.model),c(v.driver),m.n,m.km,m.gross,m.cut,m.fuel,m.exp,m.avg.toFixed(1),m.net].join(';')+'\n'});
 download(new Blob([s],{type:'text/csv;charset=utf-8'}),`Lojix_Rapor_${stamp()}.csv`);
}
function resetAll(){
 if(!confirm('DİKKAT: Tüm sefer, yakıt ve gider kayıtları kalıcı olarak silinecek (araç/şoför bilgileri kalır). Önce yedek aldınız mı?'))return;
 if(!confirm('Son kez soruyorum: tüm kayıtlar silinsin mi?'))return;
 state.trips=[];state.fuels=[];state.expenses=[];state.payments=[];saveState();
}

function printReport(){const mv=$('monthFilter').value;$('print-meta').textContent=$('page-title').textContent+' • Dönem: '+(mv==='ALL'?'Tüm Zamanlar':mv)+' • '+new Date().toLocaleDateString('tr-TR');window.print()}
(function(){const l=document.querySelector('link[rel="apple-touch-icon"]');if(l)document.querySelectorAll('.lojix-logo').forEach(i=>i.src=l.href)})();
buildNav();buildModals();switchTab('dashboard');renderAll();setupSuggestions();lxPrepLogo();
