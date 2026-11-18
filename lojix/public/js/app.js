function closeClient(i){
 // Finansal güvenlik: Toplu kapatma açık seferleri gerçek tahsilat olmadan kapatabiliyordu.
 // Cari hesap/tahsilat modeli tamamlanana kadar bu işlem özellikle engellenir.
 const c=_cari[i];
 if(c) toast('Güvenlik nedeniyle toplu cari kapatma devre dışıdır. Tahsilatı, gerçekleştiği tutar ve tarihle ayrı bir ödeme kaydı olarak girin. Açık seferleri topluca tahsil edilmiş saymayın.','error');
}
function savePayment(e){e.preventDefault();const client=val('payClient');if(client&&!state.clients.some(c=>c.name.toLocaleLowerCase('tr')===client.toLocaleLowerCase('tr')))state.clients.push({id:cid(client),name:client});const data={date:val('payDate'),client,amount:Number(val('payAmount')),note:val('payNote').trim(),tripId:val('payTrip')?Number(val('payTrip')):''};if(editTarget&&editTarget.collection==='payments'){const r=state.payments.find(x=>String(x.id)===String(editTarget.id));if(r)Object.assign(r,data)}else state.payments.push({id:Date.now(),...data});$('payModal-form').reset();editTarget=null;closeModal('payModal');resetEditModal('payModal');saveState()}

/* ---------- Uyarılar / Bakım ---------- */
function alertList(){const o=[];
 state.vehicles.forEach(v=>{
  [['muayene','Muayene'],['sigorta','Trafik sigortası'],['kasko','Kasko']].forEach(([k,l])=>{if(!v[k])return;const d=dayDiff(v[k]);if(d<=30)o.push({lv:d<=7?'red':'amber',txt:`${v.plate} • ${l} ${d<0?-d+' gün önce doldu':d===0?'bugün doluyor':d+' gün kaldı'}`})});
  if(v.nextService>0&&v.odo>0){const r=v.nextService-v.odo;if(r<=2000)o.push({lv:r<=0?'red':'amber',txt:`${v.plate} • Bakım ${r<=0?fmtNum(-r,0)+' km geçti':fmtNum(r,0)+' km kaldı'}`})}});
 cariData().forEach(c=>{if(c.bal>0&&c.due&&dayDiff(c.due)<0)o.push({lv:'red',txt:`${c.client} • ${fmtTL(c.bal)} alacağın vadesi ${-dayDiff(c.due)} gün geçti`})});
 return o.sort((a,b)=>(a.lv==='red'?0:1)-(b.lv==='red'?0:1))}
function renderAlerts(){const a=alertList(),el=$('alerts-box');if(!a.length){el.innerHTML='';return}
 el.innerHTML=`<div class="card p-4 md:p-5"><div class="font-semibold mb-2 flex items-center gap-2 ${a.some(x=>x.lv==='red')?'text-rose-600':'text-amber-700'}">${ic('alert')}${a.length} uyarı</div><div class="space-y-1.5 text-sm">${a.slice(0,8).map(x=>`<div class="flex items-start gap-2"><span class="w-2 h-2 rounded-full mt-1.5 shrink-0 ${x.lv==='red'?'bg-rose-500':'bg-amber-500'}"></span><span>${esc(x.txt)}</span></div>`).join('')}${a.length>8?`<div class="text-slate-400">+${a.length-8} uyarı daha</div>`:''}</div><button onclick="switchTab('maint')" class="mt-3 text-sm font-semibold text-blue-600">Bakım ve belgeleri aç</button></div>`}
function badge(d){if(!d)return'<span class="text-[11px] text-slate-400">tarih yok</span>';const n=dayDiff(d);return`<span class="${n<=7?'bg-rose-100 text-rose-700':n<=30?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-700'} px-2 py-0.5 rounded-full text-[11px] font-bold">${n<0?-n+' gün geçti':n+' gün kaldı'}</span>`}
function renderMaint(){
 if(document.activeElement&&document.activeElement.id&&document.activeElement.id.startsWith('m-'))return;
 $('maint-tbody').innerHTML=state.vehicles.map((v,i)=>{
  const dc=k=>`<td class="td"><input type="date" id="m-${k}-${i}" value="${esc(v[k]||'')}" class="inp !py-1.5" style="min-width:140px"><div class="mt-1">${badge(v[k])}</div></td>`;
  const nc=k=>`<input type="number" inputmode="numeric" id="m-${k}-${i}" value="${v[k]||''}" class="inp !py-1.5" style="min-width:110px">`;
  const r=v.nextService>0&&v.odo>0?v.nextService-v.odo:null;
  const rb=r===null?'<span class="text-[11px] text-slate-400">km girin</span>':`<span class="${r<=0?'bg-rose-100 text-rose-700':r<=2000?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-700'} px-2 py-0.5 rounded-full text-[11px] font-bold">${r<=0?fmtNum(-r,0)+' km geçti':fmtNum(r,0)+' km kaldı'}</span>`;
  return`<tr><td class="td"><div>${plate(v.plate)}<div class="text-xs text-slate-500 mt-1">${esc(v.driver)}</div></div></td>${dc('muayene')}${dc('sigorta')}${dc('kasko')}<td class="td">${nc('odo')}</td><td class="td">${nc('nextService')}<div class="mt-1">${rb}</div></td><td class="td">${nc('interval')}${v.interval>0&&v.odo>0?`<button onclick="markService(${i})" class="mt-1 text-[11px] font-bold text-blue-600 underline">Bakım yapıldı</button>`:''}</td></tr>`}).join('');
 const sm=$('maint-summary');if(sm){const vehicles=state.vehicles.length,expired=state.vehicles.reduce((n,v)=>n+['muayene','sigorta','kasko'].filter(k=>v[k]&&dayDiff(v[k])<0).length,0),soon=state.vehicles.reduce((n,v)=>n+['muayene','sigorta','kasko'].filter(k=>v[k]&&dayDiff(v[k])>=0&&dayDiff(v[k])<=30).length,0),service=state.vehicles.filter(v=>v.nextService>0&&v.odo>0&&v.nextService-v.odo<=2000).length;sm.innerHTML=[['Araç',vehicles,'Bakım ve belge takibi'],['Süresi geçen belge',expired,'Kontrol gerekli'],['30 günde bitecek',soon,'Belge yenileme zamanı'],['Bakımı yaklaşan',service,'2.000 km veya daha az']].map(([l,v,sub],i)=>`<div class="lx-mini-stat"><div class="lx-mini-stat-label">${l}</div><div class="lx-mini-stat-value" style="${i===1&&v?'color:var(--neg)':i===2&&v?'color:var(--warn)':i===3&&v?'color:var(--warn)':''}">${fmtNum(v,0)}</div><div class="lx-mini-stat-sub">${sub}</div></div>`).join('')}}
function readMaint(){state.vehicles.forEach((v,i)=>{['muayene','sigorta','kasko'].forEach(k=>v[k]=$(`m-${k}-${i}`).value);['odo','nextService','interval'].forEach(k=>v[k]=Number($(`m-${k}-${i}`).value)||0)})}
function saveMaint(){readMaint();document.activeElement.blur();saveState();toast('Bakım ve belge bilgileri kaydedildi.')}
function markService(i){readMaint();const v=state.vehicles[i];v.nextService=v.odo+v.interval;document.activeElement.blur();saveState()}
function bumpOdo(id,km){const v=state.vehicles.find(x=>x.id===id);if(v&&v.odo>0&&km)v.odo=Math.max(0,v.odo+km)}
function previewTrip(){const t={vehicleId:val('tripVehicle'),km:Number(val('tripKm'))||0,price:Number(val('tripPrice'))||0,commPct:Number(val('tripComm'))||0,deduct:Number(val('tripDeduct'))||0,extra:Number(val('tripExtra'))||0};
 const f=estFuel(t,fuelRef()),c=tCut(t),n=t.price-c-f-t.extra;
 $('tripPreview').innerHTML=`Komisyon+kesinti: <b>${fmtTL(c)}</b> • Tahmini yakıt: <b>${fmtTL(f)}</b> • Masraf: <b>${fmtTL(t.extra)}</b><br>Tahmini net kâr: <b class="${netCls(n)}">${fmtTL(n)}</b>`}

/* ---------- Formlar ---------- */
let editTarget=null;

const fld=(id,l,type='text',x='')=>`<div><label class="lbl" for="${id}">${l}</label><input id="${id}" type="${type}" ${x} class="inp"></div>`;
const sel=(id,l,opts='',x='')=>`<div><label class="lbl" for="${id}">${l}</label><select id="${id}" ${x} class="inp">${opts}</select></div>`;
const modal=(id,title,fn,body,btn)=>`<div id="${id}" class="modal-wrap fixed inset-0 hidden items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="${id}-title" onclick="if(event.target===this)closeModal('${id}')"><div class="modal-box rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto"><div class="flex justify-between items-center pb-3 mb-1"><h3 id="${id}-title" class="font-semibold text-lg">${title}</h3><button type="button" onclick="closeModal('${id}')" class="btn btn-icon" aria-label="Kapat"><svg class="ic"><use href="#i-plus" transform="rotate(45 12 12)"/></svg></button></div><form id="${id}-form" onsubmit="${fn}(event)" class="space-y-3 text-sm">${body}<div class="pt-4 flex justify-end gap-2"><button type="button" onclick="closeModal('${id}')" class="btn btn-quiet">Vazgeç</button><button type="submit" class="btn btn-primary">${btn}</button></div></form></div></div>`;
const g2=h=>`<div class="grid grid-cols-2 gap-3">${h}</div>`,g3=h=>`<div class="grid grid-cols-3 gap-3">${h}</div>`;
function buildModals(){
 $('modals').innerHTML=
 modal('tripModal','Yeni sefer','saveTrip',
  g2(fld('tripDate','Tarih','date','required')+sel('tripVehicle','Araç','',"required onchange=\"syncDriver('tripVehicle','tripDriver');previewTrip()\""))+
  g2(sel('tripDriver','Şoför','','required')+fld('tripCargo','Yük & Frigo Derecesi','text','list="cargoSuggestions" placeholder="Yaş Sebze (+4°C)"'))+
  g2(fld('tripRoute','Güzergâh (Nereden - Nereye)','text','required list="routeSuggestions" placeholder="Antalya - İstanbul Hal"')+fld('tripClient','Firma / Müşteri','text','required list="clientSuggestions"'))+
  g2(fld('tripKm','Sefer KM','number','min="0" step="1" inputmode="numeric" placeholder="Yakıt tahmini ve bakım km için" oninput="previewTrip()"')+fld('tripInvoice','Fatura / İrsaliye No','text','maxlength="60" placeholder="ABC2026000123"'))+
  g2(sel('tripCompany','İşi Veren Aracı Şirket','<option value="">Aracı şirket yok</option>','onchange="setTripCompany();previewTrip()"')+'<div class="text-xs text-slate-500 self-center">Şirket seçilince kayıtlı kesinti oranı otomatik uygulanır.</div>')+
  g2(fld('tripPrice','Navlun (₺)','number','required min="0" step="0.01" inputmode="decimal" oninput="previewTrip()"')+sel('tripPaid','Tahsilat','<option>Vadeli / Bekliyor</option><option>Tahsil Edildi</option>'))+
  g2(fld('tripDue','Vade Tarihi (vadeliyse)','date')+fld('tripComm','Komisyon (%)','number','min="0" max="100" step="0.1" value="0" inputmode="decimal" oninput="previewTrip()"'))+
  g2(fld('tripDeduct','Müşteri Kesintisi (₺)','number','min="0" step="0.01" value="0" inputmode="decimal" oninput="previewTrip()"')+fld('tripExtra','Sefer Masrafı (₺: HGS, harcırah)','number','min="0" step="0.01" value="0" inputmode="decimal" oninput="previewTrip()"'))+
  '<div id="tripPreview" class="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3"></div>',
  'Seferi kaydet')+
 modal('fuelModal','Yakıt kaydı','saveFuel',
  g2(fld('fuelDate','Tarih','date','required')+sel('fuelVehicle','Araç','',"required onchange=\"syncDriver('fuelVehicle','fuelDriver')\""))+
  g2(sel('fuelDriver','Şoför','','required')+sel('fuelType','Yakıt Türü','<option value="CEKICI">Çekici Mazotu</option><option value="FRIGO">Frigo Dorse Mazotu</option><option value="ADBLUE">AdBlue</option>'))+
  g3(fld('fuelLiters','Litre','number','required min="0.1" step="0.01" inputmode="decimal" oninput="calcFuel()"')+fld('fuelUnitPrice','Litre Fiyatı (₺)','number','required min="0.01" step="0.01" inputmode="decimal" oninput="calcFuel()"')+fld('fuelTotalCost','Toplam (₺)','number','required min="0.01" step="0.01" inputmode="decimal"'))+
  g2(fld('fuelOdometerKm','Araç Gösterge KM (çekici mazotunda zorunlu)','number','min="0" step="1" inputmode="numeric"')+fld('fuelStation','Petrol / İstasyon','text','list="stationSuggestions" placeholder="Opet Afyon / Shell"')),
  'Yakıtı kaydet')+
 modal('expenseModal','Gider kaydı','saveExpense',
  g2(fld('expDate','Tarih','date','required')+sel('expVehicle','Araç','',"required onchange=\"syncDriver('expVehicle','expDriver')\""))+
  g2(sel('expDriver','Şoför','','required')+sel('expCategory','Kategori',CATS.map(c=>`<option>${esc(c)}</option>`).join(''),'required'))+
  g2(fld('expAmount','Tutar (₺)','number','required min="0.01" step="0.01" inputmode="decimal"')+fld('expNote','Açıklama','text','required list="expenseNoteSuggestions" placeholder="İstanbul harcırahı"')),
  'Gideri kaydet')+
 modal('payModal','Tahsilat','savePayment',
  g2(fld('payDate','Tarih','date','required')+sel('payClient','Müşteri','','required onchange="fillPayTrips()"'))+
  sel('payTrip','Hangi sefer için? (isteğe bağlı)','<option value="">Genel tahsilat (vadesi en yakın seferden düşer)</option>')+
  g2(fld('payAmount','Tutar (₺)','number','required min="0.01" step="0.01" inputmode="decimal"')+fld('payNote','Not','text','placeholder="Havale / çek no"')),
  'Tahsilatı kaydet')+
 modal('vehicleModal','Yeni araç','saveVehicle',
  g2(fld('vehPlate','Çekici Plakası','text','required maxlength="20" placeholder="07 ABC 123"')+fld('vehDorse','Dorse Plakası','text','maxlength="20"'))+
  g2(fld('vehModel','Çekici Model','text','maxlength="60" list="modelSuggestions" placeholder="Mercedes Actros"')+fld('vehFrigo','Frigo Ünite','text','maxlength="60" list="frigoSuggestions" placeholder="Thermo King"'))+
  g2(fld('vehDriver','Şoför','text','required maxlength="60" list="driverSuggestions"')+fld('vehPhone','Şoför Telefonu','tel','maxlength="20" inputmode="tel"'))+
  g2(fld('vehOdo','Güncel KM','number','min="0" step="1" inputmode="numeric"')+fld('vehInterval','Bakım Aralığı (KM)','number','min="0" step="1000" value="40000" inputmode="numeric"')),
  'Aracı ekle')+
 modal('clientModal','Yeni müşteri','saveClient',fld('clientName','Müşteri / firma adı','text','required maxlength="120" list="clientSuggestions"'),'Müşteriyi ekle')+
 modal('companyModal','Yeni aracı şirket','saveCompany',
  g2(fld('companyName','Şirket adı','text','required maxlength="120"')+fld('companyRate','Navlun kesintisi (%)','number','required min="0" max="100" step="0.1" value="7" inputmode="decimal"')),
  'Şirketi ekle');
}
function openModal(id){
 if(['tripModal','fuelModal','expenseModal'].includes(id)&&!state.vehicles.length){toast('Önce bir araç ekleyin.','error');id='vehicleModal'}
 setupSuggestions();if(!editTarget)resetEditModal(id);
 const m=$(id);m.classList.remove('hidden');m.classList.add('flex');setTimeout(()=>{const f=m.querySelector('input:not([type=hidden]),select');if(f&&window.matchMedia('(min-width:768px)').matches)f.focus()},50);
 if(id==='payModal'){$('payDate').value=today();fillPayTrips();return}
 const p=({tripModal:['tripDate','tripVehicle','tripDriver'],fuelModal:['fuelDate','fuelVehicle','fuelDriver'],expenseModal:['expDate','expVehicle','expDriver']})[id];if(!p)return;
 $(p[0]).value=today();syncDriver(p[1],p[2]);if(id==='tripModal'){if($('tripCompany'))$('tripCompany').value='';$('tripComm').readOnly=false;$('tripComm').value=0;previewTrip();}
}
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;document.querySelectorAll('.sheet-wrap.open').forEach(x=>closeSheet(x.id));document.querySelectorAll('.modal-wrap.flex').forEach(x=>closeModal(x.id))});
function closeModal(id){const m=$(id);m.classList.add('hidden');m.classList.remove('flex');if(editTarget&&editTarget.modal===id)editTarget=null}
function editRecord(collection,id){
 const r=state[collection].find(x=>String(x.id)===String(id));if(!r)return;
 const modalId={trips:'tripModal',fuels:'fuelModal',expenses:'expenseModal',payments:'payModal'}[collection];if(!modalId)return;
 editTarget={collection,id:r.id,modal:modalId};openModal(modalId);
 const put=(field,value)=>{const el=$(field);if(el)el.value=value??''};
 if(collection==='trips'){
  put('tripDate',r.date);put('tripVehicle',r.vehicleId);syncDriver('tripVehicle','tripDriver');put('tripDriver',r.driver);put('tripCargo',r.cargo);put('tripRoute',r.route);put('tripClient',r.client);put('tripCompany',r.intermediaryCompanyId);put('tripPrice',r.price);put('tripPaid',r.paid);put('tripDue',r.due);put('tripComm',r.commPct);put('tripDeduct',r.deduct);put('tripExtra',r.extra);put('tripKm',r.km||'');put('tripInvoice',r.invoiceNo);$('tripComm').readOnly=!!r.intermediaryCompanyId;previewTrip();
 }else if(collection==='fuels'){
  put('fuelDate',r.date);put('fuelVehicle',r.vehicleId);syncDriver('fuelVehicle','fuelDriver');put('fuelDriver',r.driver);put('fuelType',r.type);put('fuelLiters',r.liters);put('fuelUnitPrice',r.unitPrice);put('fuelTotalCost',r.totalCost);put('fuelOdometerKm',r.odometerKm);put('fuelStation',r.station);
 }else if(collection==='expenses'){
  put('expDate',r.date);put('expVehicle',r.vehicleId);syncDriver('expVehicle','expDriver');put('expDriver',r.driver);put('expCategory',r.category);put('expAmount',r.amount);put('expNote',r.note);
 }else if(collection==='payments'){
  put('payDate',r.date);put('payClient',r.client);fillPayTrips();put('payTrip',r.tripId);put('payAmount',r.amount);put('payNote',r.note);
 }
 const m=$(modalId),title=m.querySelector('h3'),submit=m.querySelector('button[type="submit"]');if(title)title.textContent=({trips:'Seferi düzenle',fuels:'Yakıt kaydını düzenle',expenses:'Gideri düzenle',payments:'Tahsilatı düzenle'})[collection];if(submit)submit.textContent='Değişiklikleri kaydet';
}
function resetEditModal(modalId){const m=$(modalId);if(!m)return;const title=m.querySelector('h3'),submit=m.querySelector('button[type="submit"]');if(title)title.textContent=({tripModal:'Yeni sefer',fuelModal:'Yakıt kaydı',expenseModal:'Gider kaydı',payModal:'Tahsilat'})[modalId];if(submit)submit.textContent=({tripModal:'Seferi kaydet',fuelModal:'Yakıtı kaydet',expenseModal:'Gideri kaydet',payModal:'Tahsilatı kaydet'})[modalId];}

function calcFuel(){const l=parseFloat($('fuelLiters').value)||0,p=parseFloat($('fuelUnitPrice').value)||0;$('fuelTotalCost').value=(l*p).toFixed(2)}
const val=id=>$(id).value;
function setTripCompany(){const c=state.intermediaryCompanies.find(x=>x.id===val('tripCompany'));if(c){$('tripComm').value=Number(c.rate)||0;$('tripComm').readOnly=true;}else{$('tripComm').value=0;$('tripComm').readOnly=false;}}
function addIntermediaryCompany(){openModal('companyModal')}
function saveCompany(e){e.preventDefault();const name=val('companyName').trim(),rate=Number(val('companyRate'));if(!name)return;if(!Number.isFinite(rate)||rate<0||rate>100)return toast('Kesinti oranı %0 ile %100 arasında olmalı.','error');if(state.intermediaryCompanies.some(c=>nameKey(c.name)===nameKey(name)))return toast('Bu şirket zaten kayıtlı.','error');state.intermediaryCompanies.push({id:'IC'+Date.now(),name,rate});$('companyModal-form').reset();closeModal('companyModal');saveState();toast('Aracı şirket eklendi: '+name)}
function saveIntermediaryCompany(id){const c=state.intermediaryCompanies.find(x=>String(x.id)===String(id));if(!c)return;const name=($('ic-name-'+id)?.value||'').trim();const rate=Number($('ic-rate-'+id)?.value);if(!name)return toast('Şirket adı boş bırakılamaz.','error');if(!Number.isFinite(rate)||rate<0||rate>100)return toast('Kesinti oranı %0 ile %100 arasında olmalı.','error');if(state.intermediaryCompanies.some(x=>String(x.id)!==String(id)&&nameKey(x.name)===nameKey(name)))return toast('Bu şirket adı zaten kayıtlı.','error');c.name=name;c.rate=rate;saveState();toast('Aracı şirket kartı güncellendi. Eski sefer kayıtlarının oranı korunur.')}
function deleteIntermediaryCompany(id){if(!confirm('Aracı şirket kartı silinsin mi? Eski seferlerde kayıtlı kesinti tutarları korunur.'))return;state.intermediaryCompanies=state.intermediaryCompanies.filter(c=>c.id!==id);saveState()}
function saveTrip(e){e.preventDefault();const client=val('tripClient').trim();if(client&&!state.clients.some(c=>c.name.toLocaleLowerCase('tr')===client.toLocaleLowerCase('tr')))state.clients.push({id:cid(client),name:client});const data={date:val('tripDate'),vehicleId:val('tripVehicle'),driver:val('tripDriver'),cargo:val('tripCargo').trim(),route:val('tripRoute').trim(),client,price:Number(val('tripPrice')),paid:val('tripPaid'),due:val('tripDue'),intermediaryCompanyId:val('tripCompany')||'',commPct:Number(val('tripComm'))||0,deduct:Number(val('tripDeduct'))||0,extra:Number(val('tripExtra'))||0,km:Number(val('tripKm'))||0,invoiceNo:val('tripInvoice').trim()};if(editTarget&&editTarget.collection==='trips'){const r=state.trips.find(x=>String(x.id)===String(editTarget.id));if(r){if(r.vehicleId===data.vehicleId)bumpOdo(data.vehicleId,data.km-(Number(r.km)||0));else{bumpOdo(r.vehicleId,-(Number(r.km)||0));bumpOdo(data.vehicleId,data.km)}Object.assign(r,data)}}else{state.trips.push({id:Date.now(),...data});bumpOdo(data.vehicleId,data.km)}$('tripModal-form').reset();editTarget=null;closeModal('tripModal');resetEditModal('tripModal');saveState()}
function saveFuel(e){e.preventDefault();const vehicleId=val('fuelVehicle'),type=val('fuelType'),odometerKm=Number(val('fuelOdometerKm'))||0;const editing=editTarget&&editTarget.collection==='fuels'?state.fuels.find(x=>String(x.id)===String(editTarget.id)):null;const prev=state.fuels.filter(x=>x.id!==(editing&&editing.id)&&x.vehicleId===vehicleId&&x.type==='CEKICI'&&Number(x.odometerKm)>0&&((x.date||'')<=val('fuelDate'))).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.id-a.id)[0];if(type==='CEKICI'&&!odometerKm)return toast('Çekici mazotu için aracın gösterge KM bilgisini girin.','error');if(type==='CEKICI'&&prev&&odometerKm<=Number(prev.odometerKm))return toast('Gösterge KM, önceki mazot kaydındaki KM değerinden büyük olmalı.','error');const data={date:val('fuelDate'),vehicleId,driver:val('fuelDriver'),type,liters:Number(val('fuelLiters')),unitPrice:Number(val('fuelUnitPrice')),totalCost:Number(val('fuelTotalCost'))||Number(val('fuelLiters'))*Number(val('fuelUnitPrice')),odometerKm,distanceKm:editing?editing.distanceKm||0:0,station:val('fuelStation').trim()};if(editing)Object.assign(editing,data);else state.fuels.push({id:Date.now(),...data});if(type==='CEKICI'){const vehicle=state.vehicles.find(v=>v.id===vehicleId),later=state.fuels.some(x=>x.vehicleId===vehicleId&&x.type==='CEKICI'&&Number(x.odometerKm)>0&&(x.date||'')>data.date);if(vehicle&&!later)vehicle.odo=odometerKm}$('fuelModal-form').reset();editTarget=null;closeModal('fuelModal');resetEditModal('fuelModal');saveState()}
function saveExpense(e){e.preventDefault();const data={date:val('expDate'),vehicleId:val('expVehicle'),driver:val('expDriver'),category:val('expCategory'),amount:Number(val('expAmount')),note:val('expNote').trim()};if(editTarget&&editTarget.collection==='expenses'){const r=state.expenses.find(x=>String(x.id)===String(editTarget.id));if(r)Object.assign(r,data)}else state.expenses.push({id:Date.now(),...data});$('expenseModal-form').reset();editTarget=null;closeModal('expenseModal');resetEditModal('expenseModal');saveState()}
function setupSuggestions(){const unique=a=>[...new Map(a.filter(v=>v!==null&&v!==undefined).map(v=>String(v).trim()).filter(v=>v.length).map(v=>[v.toLocaleLowerCase('tr'),v])).values()].sort((a,b)=>a.localeCompare(b,'tr'));const vals={station:unique(state.fuels.map(x=>x.station)),client:unique([...state.clients.map(x=>x.name),...state.trips.map(x=>x.client),...state.payments.map(x=>x.client)]),route:unique(state.trips.map(x=>x.route)),cargo:unique(state.trips.map(x=>x.cargo)),expenseNote:unique(state.expenses.map(x=>x.note)),paymentNote:unique(state.payments.map(x=>x.note)),model:unique(state.vehicles.map(x=>x.model)),frigo:unique(state.vehicles.map(x=>x.frigo)),driver:unique(state.vehicles.map(x=>x.driver)),plate:unique(state.vehicles.map(x=>x.plate)),dorse:unique(state.vehicles.map(x=>x.dorse))};Object.entries({stationSuggestions:vals.station,clientSuggestions:vals.client,routeSuggestions:vals.route,cargoSuggestions:vals.cargo,expenseNoteSuggestions:vals.expenseNote,paymentNoteSuggestions:vals.paymentNote,modelSuggestions:vals.model,frigoSuggestions:vals.frigo,driverSuggestions:vals.driver,plateSuggestions:vals.plate,dorseSuggestions:vals.dorse}).forEach(([id,a])=>{const dl=$(id);if(dl)dl.innerHTML=a.map(x=>`<option value="${esc(x)}"></option>`).join('')});const mappings={tripClient:'clientSuggestions',payClient:'clientSuggestions',tripRoute:'routeSuggestions',tripCargo:'cargoSuggestions',fuelStation:'stationSuggestions',expNote:'expenseNoteSuggestions',payNote:'paymentNoteSuggestions'};Object.entries(mappings).forEach(([id,list])=>{const el=$(id);if(el){el.setAttribute('list',list);el.setAttribute('autocomplete','on')}});[['s-model-','modelSuggestions'],['s-frigo-','frigoSuggestions'],['s-driver-','driverSuggestions'],['s-plate-','plateSuggestions'],['s-dorse-','dorseSuggestions']].forEach(([prefix,list])=>document.querySelectorAll(`input[id^="${prefix}"]`).forEach(el=>{el.setAttribute('list',list);el.setAttribute('autocomplete','on')}))}
function togglePaid(id){const t=state.trips.find(x=>x.id===id);if(t){t.paid=t.paid==='Tahsil Edildi'?'Vadeli / Bekliyor':'Tahsil Edildi';saveState()}}
function delItem(c,id){if(!confirm('Bu kaydı silmek istediğinize emin misiniz?'))return;state[c]=state[c].filter(x=>x.id!==id);saveState()}
function saveFleet(){
 const nv=state.vehicles.map((v,i)=>({...v,plate:$('s-plate-'+i).value.trim(),dorse:$('s-dorse-'+i).value.trim(),model:$('s-model-'+i).value.trim(),frigo:$('s-frigo-'+i).value.trim(),driver:$('s-driver-'+i).value.trim(),phone:$('s-phone-'+i).value.trim()}));
 if(nv.some(v=>!v.plate||!v.driver))return toast('Plaka ve şoför adı boş bırakılamaz.','error');
 nv.forEach((v,i)=>{const old=state.vehicles[i].driver;if(old!==v.driver)['trips','fuels','expenses'].forEach(c=>state[c].forEach(r=>{if(r.vehicleId===v.id&&r.driver===old)r.driver=v.driver}))});
 state.vehicles=nv;document.activeElement.blur();saveState();toast('Araç ve şoför bilgileri güncellendi.');
}
function openVehicleModal(){openModal('vehicleModal')}
function saveVehicle(e){e.preventDefault();const plate=val('vehPlate').trim(),driver=val('vehDriver').trim();if(!plate||!driver)return;if(state.vehicles.some(v=>nameKey(v.plate)===nameKey(plate)))return toast('Bu plaka zaten kayıtlı.','error');const odo=Number(val('vehOdo'))||0,interval=Number(val('vehInterval'))||40000;
 state.vehicles.push({id:'V'+Date.now(),plate,dorse:val('vehDorse').trim(),model:val('vehModel').trim(),frigo:val('vehFrigo').trim(),driver,phone:val('vehPhone').trim(),odo,interval,nextService:odo?odo+interval:interval,muayene:'',sigorta:'',kasko:''});
 $('vehicleModal-form').reset();closeModal('vehicleModal');saveState();toast('Araç eklendi: '+plate)}
function deleteVehicle(i){const v=state.vehicles[i];if(!v)return;const n=['trips','fuels','expenses'].reduce((s,c)=>s+state[c].filter(r=>r.vehicleId===v.id).length,0);
 if(n)return toast(`${v.plate} plakalı araca bağlı ${n} kayıt var; geçmiş raporlar bozulmasın diye araç silinemez. Plakayı ve şoförü düzenleyebilirsiniz.`,'error');
 if(!confirm(v.plate+' plakalı araç silinsin mi?'))return;state.vehicles.splice(i,1);saveState();toast('Araç silindi.')}
function fillPayTrips(){if(!$('payTrip'))return;const c=cariData().find(x=>x.client===val('payClient'));fill('payTrip','<option value="">Genel tahsilat (vadesi en yakın seferden düşer)</option>'+(c?c.openTrips:[]).map(t=>`<option value="${t.id}">${esc(tripLabel(t))} — kalan ${fmtTL(t._left)}</option>`).join(''))}

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
 r.onload=()=>{try{const n=normalize(JSON.parse(r.result));if(!n)throw 0;if(!confirm('Mevcut tüm kayıtların yerine yedekteki veriler yüklenecek. Devam edilsin mi?'))return;try{localStorage.setItem(KEY+'_PREIMPORT_BACKUP',JSON.stringify(state))}catch(e){if(!confirm('Mevcut verinin otomatik geri dönüş kopyası alınamadı. Yine de devam etmek istiyor musunuz?'))return}state=n;saveState();toast('Yedek yüklendi. Önceki veriler için geri dönüş kopyası bu tarayıcıda saklandı.')}catch(e){toast('Geçersiz yedek dosyası.','error')}finally{ev.target.value=''}};
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

// Son 6 ayın navlunu, gider+kesintisi ve neti (dönem filtresinden bağımsız).
function trendChart(){
 const base=today().slice(0,7),months=[];let [y,m]=base.split('-').map(Number);
 for(let i=0;i<6;i++){months.unshift(`${y}-${String(m).padStart(2,'0')}`);if(--m===0){m=12;y--}}
 const rows=months.map(k=>{const f=a=>a.filter(i=>(i.date||'').startsWith(k)),c=calc(f(state.trips),f(state.fuels),f(state.expenses));return{k,inc:c.gross,out:c.fuel+c.exp+c.cut,net:c.net}});
 if(!rows.some(r=>r.inc||r.out))return '<p class="text-sm text-slate-500 py-6">Son 6 ayda kayıt yok. İlk seferi ekleyince grafik burada oluşur.</p>';
 const W=600,H=220,top=24,bot=40,ch=H-top-bot,max=Math.max(...rows.map(r=>Math.max(r.inc,r.out)),1),gw=W/6,bw=Math.min(26,gw/3.2);
 const sh=v=>v>=1e6?fmtNum(v/1e6,1)+' mn':v>=1e3?fmtNum(v/1e3,0)+' b':fmtNum(v,0);
 const bars=rows.map((r,i)=>{const x=i*gw+gw/2,hi=r.inc/max*ch,ho=r.out/max*ch;
  return `<g><title>${MONTHS[+r.k.slice(5)-1]} ${r.k.slice(0,4)}: navlun ${fmtTL(r.inc)}, gider ve kesinti ${fmtTL(r.out)}, net ${fmtTL(r.net)}</title>
  <rect class="bar-in" x="${x-bw-2}" y="${top+ch-hi}" width="${bw}" height="${Math.max(hi,1)}" rx="4"/><rect class="bar-out" x="${x+2}" y="${top+ch-ho}" width="${bw}" height="${Math.max(ho,1)}" rx="4"/>
  <text x="${x}" y="${H-22}" text-anchor="middle">${MONTHS[+r.k.slice(5)-1].slice(0,3)}</text>
  <text x="${x}" y="${H-6}" text-anchor="middle" class="${r.net>=0?'net-pos':'net-neg'}">${r.net<0?'−':''}${sh(Math.abs(r.net))}</text></g>`}).join('');
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 6 ayın navlun, gider ve net kâr grafiği"><line x1="0" x2="${W}" y1="${top+ch}" y2="${top+ch}" stroke="var(--line)"/>${bars}</svg>`;
}
