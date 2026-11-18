// ================= ASİSTAN (kurallı, ücretsiz) =================
// Yazarak ya da sesle: "07 ABC 101 Antalya'dan İstanbul'a sefer 45 bin Toros Gıda 900 km", "101'e 400 litre mazot 44,5'ten".
// lxParse saf fonksiyondur (ekrana dokunmaz): cümle + bilinen adlar → ne yapılacağı.
// Kayıt doğrudan eklenmez: ilgili form doldurulmuş açılır, kullanıcı kontrol edip "Kaydet"e basar.
const LX_NUM = { 'sıfır': 0, bir: 1, iki: 2, 'üç': 3, 'dört': 4, 'beş': 5, 'altı': 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10, yirmi: 20, otuz: 30, 'kırk': 40, elli: 50, 'altmış': 60, 'yetmiş': 70, seksen: 80, doksan: 90 };
const LX_NB = '(?<!\\p{L})', LX_NA = '(?!\\p{L})';   // Türkçe harflerle çalışan kelime sınırı
const lxFold = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[âà]/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
const lxTitle = s => s.split(' ').filter(Boolean).map(w => w[0].toLocaleUpperCase('tr-TR') + w.slice(1)).join(' ');
const lxRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Gider kategorileri (uygulamadaki CATS ile aynı sırada eşlenir)
const LX_CAT_RULES = [
  [0, /maas|(?<![a-z])prim/],
  [1, /harcirah|yemek|avans|yol parasi|kumanya/],
  [6, /sigorta|kasko|muayene|(?<![a-z])mtv/],
  [5, /(?<![a-z])hgs|(?<![a-z])ogs|kopru|feribot|otoyol|gise|osmangazi|yavuz sultan/],
  [4, /lastik|kaplama/],
  [3, /frigo|sogutucu|(?<![a-z])gaz(?![a-z])|thermo|carrier/],
  [2, /bakim|sanayi|tamir|servis|yag degis|filtre|balata|aku(?![a-z])|parca/],
  [7, /ceza|(?<![a-z])diger/],
];
const LX_STATIONS = ['Opet', 'Shell', 'BP', 'Petrol Ofisi', 'Total', 'Aytemiz', 'Lukoil', 'Alpet', 'Po', 'Kadoil', 'Moil', 'TP'];
const LX_FILLER = new Set(['ve', 'de', 'da', 'ile', 'için', 'lira', 'tl', 'liralık', '@', 'ekle', 'kaydet', 'yaz', 'gir', 'olarak', 'toplam', 'tutar', 'tutarı', 'bir', 'tane', 'plakalı', 'plaka', 'araç', 'aracı', 'aracına', 'tır', 'tıra', 'şoför', 'şoförü', 'gider', 'masraf', 'ödedim', 'verdim', 'harcadım', 'aldım', 'yaptım', 'yaptı', 'aldı', 'ödendi', 'ödedi', 'oldu', 'için', 'bugün', 'dün']);

function lxNormalize(text) {
  let t = String(text).toLocaleLowerCase('tr-TR').replace(/[’`´]/g, "'").replace(/₺/g, ' lira ').replace(/%\s*(\d)/g, 'yüzde $1');
  t = t.replace(/(\p{L})\s*[-–—]\s*(\p{L})/gu, '$1 _ $2');                       // "Antalya - İstanbul" güzergâh ayracı
  t = t.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2'); // 1.500.000 → 1500000, 44,5 → 44.5
  // "45 bin", "15 bin 575 lira", "1,2 milyon" — rakam + çarpan, kelime sayılarından önce
  t = t.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(milyon|bin)${LX_NA}(?:\\s+(\\d{1,3})(?=\\s*(?:lira|tl)?\\s*(?:$|[,;]|lira|tl)))?`, 'gu'), (m, n, u, r) => ' ' + String(+n * (u === 'bin' ? 1000 : 1e6) + (r ? +r : 0)) + ' ');
  const W = Object.keys(LX_NUM).concat('yüz', 'bin', 'milyon', 'buçuk').join('|');
  t = t.replace(new RegExp(`${LX_NB}(?:(?:${W})${LX_NA}\\s*)+`, 'gu'), m => {     // "kırk beş bin" → 45000
    let total = 0, cur = 0;
    m.trim().split(/\s+/).forEach(w => {
      if (w === 'yüz') cur = (cur || 1) * 100;
      else if (w === 'bin') { total += (cur || 1) * 1000; cur = 0; }
      else if (w === 'milyon') { total += (cur || 1) * 1e6; cur = 0; }
      else if (w === 'buçuk') cur += 0.5;
      else cur += LX_NUM[w];
    });
    return ' ' + (total + cur) + ' ';
  });
  t = t.replace(/(\d)\s+(\d{3})(?!\d)/g, (m, a, b) => a + ' ' + b);               // "45 000" iki sayı kalsın (plaka kuyruğu olabilir)
  // Birim fiyat işareti "@": "44,5'ten", "44.5 liradan", "litresi 44.5"
  t = t.replace(new RegExp(`(\\d)\\s*(?:lira|tl)'?(?:dan|den)${LX_NA}`, 'gu'), '$1 @');
  t = t.replace(new RegExp(`(\\d)'?(?:dan|den|tan|ten)${LX_NA}`, 'gu'), '$1 @');
  t = t.replace(new RegExp(`${LX_NB}(?:litresi|litresini|fiyatı)\\s+(\\d+(?:\\.\\d+)?)`, 'gu'), '$1 @');
  return t.replace(/[^\p{L}\d.'@_ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
// Metinde geçen en uzun bilinen adı bulur; Türkçe ekleri tolere eder ("toros gıda'ya", "ahmet'le", "opet'ten").
function lxFind(t, names) {
  const ft = lxFold(t); let best = null;
  names.forEach(n => {
    const fn = lxFold(n).trim(); if (!fn) return;
    const m = ft.match(new RegExp(`${LX_NB}${lxRe(fn)}(?:'?\\p{L}{0,5})?${LX_NA}`, 'u'));
    if (m && (!best || fn.length > best.fn.length)) best = { name: n, fn, idx: m.index, len: m[0].length };
  });
  return best;
}
// Müşteri adı kısaltılarak da söylenir: "Akdeniz Sebze" (A.Ş. olmadan), "Ege Meyve", tek kelime ayırt ediciyse "Toros".
function lxClientNames(clients) {
  const out = [], legal = /\s+(?:a\.?\s?ş\.?|ltd\.?|şti\.?|san\.?|tic\.?|ve|gıda|lojistik|nakliyat|tarım)(?=\s|$).*$/iu;
  clients.forEach(full => {
    const v = new Set([full, full.replace(/[.,]/g, ' ').replace(/\s+(?:a ş|ltd|şti|san|tic)(?=\s|$).*$/iu, '').trim(), full.replace(legal, '').trim()]);
    const first = full.split(/\s+/)[0];
    if (first.length >= 4 && clients.filter(c => lxFold(c.split(/\s+/)[0]) === lxFold(first)).length === 1) v.add(first);
    v.forEach(x => { if (x) out.push(Object.assign(new String(x), { full })); });
  });
  return out;
}
const lxCut = (t, hit) => (t.slice(0, hit.idx) + ' ' + t.slice(hit.idx + hit.len)).replace(/\s+/g, ' ').trim();
const lxAddDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

// Araç: tam plaka ("07 abc 101"), plakanın sonu ("101") ya da şoför adı
function lxVehicle(t, vehicles) {
  const flat = lxFold(t).replace(/\s+/g, ''), plain = v => lxFold(v.plate).replace(/\s+/g, '');
  const full = vehicles.find(v => plain(v) && flat.includes(plain(v)));
  if (full) {
    const parts = lxFold(full.plate).split(/\s+/).filter(Boolean).map(lxRe).join('\\s*');
    const m = lxFold(t).match(new RegExp(`${parts}(?:'?\\p{L}{0,4})?`, 'u'));
    return { v: full, t: m ? lxCut(t, { idx: m.index, len: m[0].length }) : t };
  }
  for (const v of vehicles) {                        // plaka kuyruğu tek bir araca aitse
    const tail = (v.plate.match(/(\d{2,4})\s*$/) || [])[1];
    if (!tail || vehicles.filter(x => (x.plate.match(/(\d{2,4})\s*$/) || [])[1] === tail).length > 1) continue;
    // "101", "101'e", "101 plakalı" — arkasından birim gelen sayı (101 km, 101 lira) plaka sayılmaz
    const m = lxFold(t).match(new RegExp(`(?<![\\d.])${tail}(?:'\\p{L}{1,4})?(?![\\d.])(?!\\s*(?:km|kilometre|lira|tl|litre|lt|@|bin))`, 'u'));
    if (m)
      return { v, t: lxCut(t, { idx: m.index, len: m[0].length }) };
  }
  const names = [];
  vehicles.forEach(v => { if (v.driver) { names.push(v.driver); names.push(v.driver.split(' ')[0]); } });
  const d = lxFind(t, names);
  if (d) { const v = vehicles.find(x => x.driver === d.name || x.driver.split(' ')[0] === d.name); return { v, t: lxCut(t, d) }; }
  return { v: null, t };
}

function lxParse(text, ctx) {
  let t = lxNormalize(text);
  const F = () => lxFold(t), has = re => re.test(F());
  if (!t) return { type: 'unknown' };
  let date = ctx.today;
  if (has(/(?<![a-z])dun(?![a-z])/)) date = lxAddDays(ctx.today, -1);
  else if (has(/evvelsi gun|onceki gun/)) date = lxAddDays(ctx.today, -2);
  t = t.replace(new RegExp(`${LX_NB}(?:dün|bugün|şimdi|az önce|evvelsi gün|önceki gün)${LX_NA}`, 'gu'), ' ');

  // Soru → rapor
  if (/\?/.test(text) || has(/ne kadar|(?<![a-z])kac(?![a-z])|nedir|rapor|ozet|goster(?!ge)|durum/)) {
    const period = has(/gecen ay/) ? 'lastmonth' : has(/bu hafta|haftalik|(?<![a-z])hafta/) ? 'week' : has(/bu ay|aylik|(?<![a-z])ay(?![a-z])/) ? 'month'
      : has(/bu yil|yillik|(?<![a-z])yil/) ? 'year' : date !== ctx.today ? 'yesterday' : has(/bugun/) || /bugün/i.test(text) ? 'today' : 'all';
    const metric = has(/alacak|borc|bakiye|vade/) ? 'balance' : has(/(?<![a-z])kar(?![a-z])|kazan|(?<![a-z])net/) ? 'profit' : has(/yakit|mazot|motorin|tuketim|litre/) ? 'fuel'
      : has(/gider|masraf|harca/) ? 'expense' : has(/navlun|ciro|gelir/) ? 'freight' : has(/sefer/) ? 'trips' : has(/bakim|muayene|sigorta|belge/) ? 'maint' : 'summary';
    const veh = lxVehicle(t, ctx.vehicles), cl = lxFind(t, lxClientNames(ctx.clients));
    return { type: 'report', period, metric, vehicleId: veh.v ? veh.v.id : '', client: cl ? cl.name.full : '' };
  }

  const veh = lxVehicle(t, ctx.vehicles); t = veh.t;
  const vehicleId = veh.v ? veh.v.id : '';
  let client = '', company = '', station = '';
  const co = lxFind(t, ctx.companies.flatMap(c => [c.name, c.name.split(' ')[0]]));
  if (co) { company = ctx.companies.find(c => c.name === co.name || c.name.split(' ')[0] === co.name).id; t = lxCut(t, co); t = t.replace(new RegExp(`^\\s*(?:üzerinden|aracılığıyla|kanalıyla)${LX_NA}|\\s(?:üzerinden|aracılığıyla|kanalıyla)${LX_NA}`, 'gu'), ' '); }
  const cl = lxFind(t, lxClientNames(ctx.clients));
  if (cl) { client = cl.name.full; t = lxCut(t, cl); }
  const st = lxFind(t, [...new Set([...ctx.stations, ...LX_STATIONS])]);
  if (st && has(/mazot|motorin|dizel|yakit|adblue|ad blue|litre|(?<![a-z])lt(?![a-z])/)) { station = st.name; t = lxCut(t, st); }

  // Etiketli sayılar
  const take = re => { const m = t.match(re); if (!m) return null; t = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); return m; };
  let m;
  const liters = (m = take(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:litre|lt)${LX_NA}`, 'u'))) ? +m[1] : null;
  const unitPrice = (m = take(/(\d+(?:\.\d+)?)\s*@/)) ? +m[1] : null;
  const dueDays = (m = take(new RegExp(`(\\d+)\\s*gün(?:lük)?\\s*vade(?:li|yle|ye)?${LX_NA}`, 'u'))) ? +m[1] : null;
  const commPct = (m = take(new RegExp(`yüzde\\s*(\\d+(?:\\.\\d+)?)(?:'?\\p{L}{0,6})?(?:\\s*(?:komisyon|kesinti))?`, 'u'))) ? +m[1] : null;
  const odoM = take(new RegExp(`(?:gösterge|kilometre(?:si|de)?|km(?:'?(?:si|de))?)\\s*(\\d{4,7})${LX_NA}|(\\d{4,7})\\s*(?:km|kilometre)(?:'?(?:de|da))${LX_NA}`, 'u'));
  let odometer = odoM ? +(odoM[1] || odoM[2]) : null;
  const kmM = take(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:km|kilometre)${LX_NA}`, 'u'));
  let km = kmM ? +kmM[1] : null;
  const total = (m = take(new RegExp(`(?:toplam|tutar(?:ı)?)\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*(?:lira|tl)?\\s*(?:tuttu|tutar)${LX_NA}`, 'u'))) ? +(m[1] || m[2]) : null;
  const nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const amount = total || (nums.length ? Math.max(...nums) : null);

  // Yakıt
  if (has(/mazot|motorin|dizel|yakit|adblue|ad blue/) || liters) {
    const type = has(/adblue|ad blue/) ? 'ADBLUE' : has(/frigo|dorse|sogutucu/) ? 'FRIGO' : 'CEKICI';
    if (type === 'CEKICI' && !odometer && km && km >= 10000) { odometer = km; km = null; }
    if (type === 'CEKICI' && !odometer) { const big = nums.filter(n => n >= 10000 && n !== total && n < 3e6).sort((a, b) => b - a)[0]; if (big && liters) odometer = big; }
    let lt = liters, up = unitPrice, tot = total;
    const rest = nums.filter(n => n !== odometer);
    if (!tot && lt && up) tot = Math.round(lt * up * 100) / 100;
    if (!tot && lt && !up && rest.length) tot = Math.max(...rest);
    if (!up && lt && tot) up = Math.round(tot / lt * 100) / 100;
    return { type: 'fuel', date, vehicleId, fuelType: type, liters: lt, unitPrice: up, totalCost: tot, odometerKm: odometer, station };
  }
  // Tahsilat: müşteri + ödedi/gönderdi/tahsil
  if (client && has(/odedi|tahsil|yatirdi|gonderdi|havale|(?<![a-z])eft|odeme geldi|para geldi|cek verdi/) && !has(/sefer|navlun/)) {
    return { type: 'payment', date, client, amount, note: has(/havale|eft/) ? 'Havale / EFT' : has(/(?<![a-z])cek/) ? 'Çek' : has(/nakit|elden/) ? 'Nakit' : '' };
  }
  // Güzergâh: "antalya'dan istanbul'a", "antalya _ istanbul", "antalya istanbul arası"
  let route = '';
  const rm = t.match(new RegExp(`(\\p{L}+(?:\\s\\p{L}+)?)'?(?:dan|den|tan|ten)\\s+(\\p{L}+(?:\\s(?:hal|hali|halı|limanı|liman|depo|deposu))?)'?(?:a|e|ya|ye|na|ne)?${LX_NA}`, 'u'))
    || t.match(/(\p{L}+)\s_\s(\p{L}+(?:\s(?:hal|hali|halı))?)/u) || t.match(new RegExp(`(\\p{L}+)\\s+(\\p{L}+)\\s+arası${LX_NA}`, 'u'));
  if (rm && !/^\d/.test(rm[1])) { route = lxTitle(rm[1].trim()) + ' - ' + lxTitle(rm[2].trim()); t = t.replace(rm[0], ' '); }
  if (route || has(/sefer|navlun|(?<![a-z])yuk|tasidi|gotur/)) {
    const paid = has(/pesin|tahsil edildi|odendi|parasini aldik|nakit aldik/) ? 'Tahsil Edildi' : 'Vadeli / Bekliyor';
    const cargo = (t.match(new RegExp(`(?:yük(?:ü)?|yükle)\\s+((?:\\p{L}+\\s?){1,3})`, 'u')) || [])[1];
    return { type: 'trip', date, vehicleId, route, client, company, price: amount, km, paid, due: dueDays ? lxAddDays(date, dueDays) : '', commPct, cargo: cargo ? lxTitle(cargo.trim()) : '' };
  }
  // Gider
  const rule = LX_CAT_RULES.find(([, re]) => has(re));
  if (amount && (rule || has(/gider|masraf|harcad|odedim|verdim|aldim|odendi/))) {
    const words = t.replace(/\d+(?:\.\d+)?/g, ' ').split(' ').filter(w => w && !LX_FILLER.has(w) && w !== '_' && w !== '@' && !/^(şoföre|için|lık|lik)$/.test(w));
    return { type: 'expense', date, vehicleId, amount, category: rule ? ctx.cats[rule[0]] : ctx.cats[ctx.cats.length - 1], note: lxTitle(words.join(' ')) || (rule ? ctx.cats[rule[0]] : '') };
  }
  return { type: 'unknown' };
}

// ---------------- Arayüz ----------------
// Örnekler kullanıcının kendi araç ve müşterileriyle gösterilir.
function lxHelp() {
  const tail = v => ((v && v.plate || '').match(/(\d{2,4})\s*$/) || [, '101'])[1], v1 = tail(state.vehicles[0]), v2 = tail(state.vehicles[1] || state.vehicles[0]);
  const drv = ((state.vehicles[0] && state.vehicles[0].driver) || 'Ahmet').split(' ')[0], cl = (state.clients[0] && state.clients[0].name) || 'Toros Gıda';
  return `<b>Şöyle söyleyebilirsiniz:</b><ul class="list-disc pl-5 mt-1 space-y-0.5">
<li>${v1} Antalya'dan İstanbul'a sefer 45 bin ${esc(cl)} 900 km, 30 gün vadeli</li>
<li>${esc(drv)} Talya üzerinden Mersin'den İzmir'e 38 bin navlun</li>
<li>${v1}'e 400 litre mazot 44,5'ten, kilometre 412000, Opet</li>
<li>${v2} frigo mazotu 80 litre 3500 lira · ${v2} AdBlue 40 litre 900 lira</li>
<li>${esc(drv)}'e 2500 harcırah · ${v1} lastik 18 bin · HGS 750</li>
<li>${esc(cl)} 50 bin havale gönderdi</li>
<li>Bu ay net kâr ne kadar? · ${esc(cl)} borcu ne kadar? · ${v1} bu ay yakıt?</li></ul>`;
}
function asstSay(html) { const el = $('asst-out'); el.innerHTML = html; el.classList.remove('hidden'); }
function asstCtx() {
  return { today: today(), vehicles: state.vehicles.map(v => ({ id: v.id, plate: v.plate || '', driver: v.driver || '' })),
    clients: [...new Set([...state.clients.map(c => c.name), ...state.trips.map(t => t.client)].filter(Boolean))],
    companies: state.intermediaryCompanies.map(c => ({ id: c.id, name: c.name })), stations: [...new Set(state.fuels.map(f => f.station).filter(Boolean))], cats: CATS };
}
function runAssistant() {
  const inp = $('asst-input'), text = inp.value.trim();
  if (!text) return asstSay(lxHelp());
  const c = lxParse(text, asstCtx()), put = (id, v) => { if (v !== null && v !== undefined && v !== '' && $(id)) $(id).value = v; };
  const vNote = c.vehicleId ? '' : ' Araç anlaşılmadı, formda seçin.';
  const open = (modal, msg) => { closeSheet('quickSheet'); openModal(modal); return msg; };
  let msg;
  if (c.type === 'trip') {
    msg = open('tripModal', 'Sefer formu dolduruldu.');
    if (c.vehicleId) { put('tripVehicle', c.vehicleId); syncDriver('tripVehicle', 'tripDriver'); }
    put('tripDate', c.date); put('tripRoute', c.route); put('tripClient', c.client); put('tripPrice', c.price); put('tripKm', c.km); put('tripCargo', c.cargo); put('tripPaid', c.paid); put('tripDue', c.due);
    if (c.company) { put('tripCompany', c.company); setTripCompany(); } else if (c.commPct !== null) put('tripComm', c.commPct);
    previewTrip();
  } else if (c.type === 'fuel') {
    msg = open('fuelModal', 'Yakıt formu dolduruldu.');
    if (c.vehicleId) { put('fuelVehicle', c.vehicleId); syncDriver('fuelVehicle', 'fuelDriver'); }
    put('fuelDate', c.date); put('fuelType', c.fuelType); put('fuelLiters', c.liters); put('fuelUnitPrice', c.unitPrice); put('fuelTotalCost', c.totalCost); put('fuelOdometerKm', c.odometerKm); put('fuelStation', c.station);
    if (c.fuelType === 'CEKICI' && !c.odometerKm) msg += ' Çekici mazotu için gösterge km\'sini yazın.';
  } else if (c.type === 'expense') {
    msg = open('expenseModal', `Gider formu dolduruldu (${esc(c.category)}).`);
    if (c.vehicleId) { put('expVehicle', c.vehicleId); syncDriver('expVehicle', 'expDriver'); }
    put('expDate', c.date); put('expAmount', c.amount); put('expCategory', c.category); put('expNote', c.note);
  } else if (c.type === 'payment') {
    msg = open('payModal', 'Tahsilat formu dolduruldu.');
    put('payDate', c.date); put('payClient', c.client); fillPayTrips(); put('payAmount', c.amount); put('payNote', c.note);
    asstSay(msg + ' Kontrol edip <b>kaydedin</b>.'); inp.value = ''; return;
  } else if (c.type === 'report') { return asstSay(asstReport(c)); }
  else return asstSay('Anlayamadım. ' + lxHelp());
  inp.value = '';
  toast(msg + vNote + ' Kontrol edip kaydedin.', vNote ? 'error' : 'ok');
}
function asstRange(p) {
  const t = today(), y = t.slice(0, 4), mo = t.slice(0, 7);
  if (p === 'today') return [t, t, 'Bugün'];
  if (p === 'yesterday') { const d = lxAddDays(t, -1); return [d, d, 'Dün']; }
  if (p === 'week') { const d = new Date(t + 'T12:00:00'), w = (d.getDay() + 6) % 7; return [lxAddDays(t, -w), t, 'Bu hafta']; }
  if (p === 'month') return [mo + '-01', t, 'Bu ay'];
  if (p === 'lastmonth') { const d = new Date(+y, +t.slice(5, 7) - 2, 1), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); return [k + '-01', k + '-31', 'Geçen ay']; }
  if (p === 'year') return [y + '-01-01', t, 'Bu yıl'];
  return ['0000', '9999', 'Tüm zamanlar'];
}
function asstReport(c) {
  const [a, b, label] = asstRange(c.period), inR = x => (x.date || '') >= a && (x.date || '') <= b, byV = x => !c.vehicleId || x.vehicleId === c.vehicleId;
  const r = calc(state.trips.filter(x => inR(x) && byV(x)), state.fuels.filter(x => inR(x) && byV(x)), state.expenses.filter(x => inR(x) && byV(x)));
  const who = c.vehicleId ? ' ' + plate(vehObj(c.vehicleId).plate) : '';
  if (c.metric === 'balance') {
    const L = cariData();
    if (c.client) { const x = L.find(y => y.client === c.client); return x ? `<b>${esc(c.client)}</b> kalan bakiye: <b>${fmtTL(x.bal)}</b> · vadesi gelen ${fmtTL(x.dueOpen)}${x.due ? ' · en yakın vade ' + fmtD(x.due) : ''}` : `${esc(c.client)} için cari kayıt yok.`; }
    return `Toplam kalan alacak: <b>${fmtTL(L.reduce((s, x) => s + Math.max(x.bal, 0), 0))}</b> · vadesi gelen veya geçen: <b>${fmtTL(L.reduce((s, x) => s + x.dueOpen, 0))}</b>`;
  }
  if (c.metric === 'maint') { const al = alertList(); return al.length ? `${al.length} uyarı:<br>` + al.slice(0, 6).map(x => esc(x.txt)).join('<br>') : 'Belge ve bakım uyarısı yok.'; }
  if (c.metric === 'fuel') return `${label}${who} yakıt: <b>${fmtTL(r.fuel)}</b>${r.avg > 0 ? ` · çekici ortalaması <b>${fmtNum(r.avg)} lt/100 km</b>` : ''} · frigo ${fmtNum(r.frigoL, 0)} lt`;
  if (c.metric === 'expense') return `${label}${who} diğer giderler: <b>${fmtTL(r.exp)}</b> (yakıt hariç; yakıt ${fmtTL(r.fuel)})`;
  if (c.metric === 'freight') return `${label}${who} navlun: <b>${fmtTL(r.gross)}</b> · ${r.n} sefer`;
  if (c.metric === 'trips') return `${label}${who}: <b>${r.n} sefer</b>, ${fmtNum(r.km, 0)} km, navlun ${fmtTL(r.gross)}`;
  if (c.metric === 'profit') return `${label}${who}: navlun ${fmtTL(r.gross)} − kesinti ${fmtTL(r.cut)} − yakıt ${fmtTL(r.fuel)} − gider ${fmtTL(r.exp)} = net <b class="${netCls(r.net)}">${fmtTL(r.net)}</b>`;
  return `${label}${who}: ${r.n} sefer · navlun ${fmtTL(r.gross)} · yakıt ${fmtTL(r.fuel)} · gider ${fmtTL(r.exp)} · net <b class="${netCls(r.net)}">${fmtTL(r.net)}</b>`;
}
// Sesle söyleme: tarayıcı destekliyorsa doğrudan, yoksa klavyedeki mikrofon
function asstListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, inp = $('asst-input'), btn = $('asst-mic');
  openSheet('quickSheet');
  const fallback = () => { asstSay('Bu ekranda doğrudan ses tanıma açılamadı. Kutuya dokunup klavyedeki mikrofon tuşuyla söyleyin, sonra gönderin.'); inp.focus(); };
  if (!SR) return fallback();
  const r = new SR(); r.lang = 'tr-TR'; r.interimResults = true; r.maxAlternatives = 1;
  btn.classList.add('listening'); btn.setAttribute('aria-pressed', 'true');
  r.onresult = e => { const res = e.results[e.results.length - 1]; inp.value = res[0].transcript; if (res.isFinal) runAssistant(); };
  r.onerror = e => { if (e.error === 'no-speech') asstSay('Ses duyulmadı, tekrar deneyin.'); else if (e.error === 'not-allowed') asstSay('Mikrofon izni verilmedi. Telefon ayarlarından tarayıcıya mikrofon izni verin ya da klavyedeki mikrofonu kullanın.'); else fallback(); };
  r.onend = () => { btn.classList.remove('listening'); btn.setAttribute('aria-pressed', 'false'); };
  try { r.start(); asstSay('Dinliyorum… Kaydı söyleyin.'); } catch (e) { btn.classList.remove('listening'); fallback(); }
}
