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
  [0, /maas|(?<![a-z])prim|ikramiye|(?<![a-z])ucret/],
  [1, /harcirah|yemek|avans|yol parasi|kumanya|konaklama|(?<![a-z])otel/],
  [6, /sigorta|kasko|muayene|(?<![a-z])mtv|takograf|tescil/],
  [5, /(?<![a-z])hgs|(?<![a-z])ogs|kopru|feribot|otoyol|gise|gecis ucreti|osmangazi|yavuz sultan|(?<![a-z])roro/],
  [4, /lastik|kaplama|(?<![a-z])jant|(?<![a-z])rot(?![a-z])|balans/],
  [3, /frigo|sogutucu|sogutma|(?<![a-z])gaz(?![a-z])|thermo|termo|carrier|kompresor/],
  [2, /bakim|sanayi|tamir|servis|(?<![a-z])yag|filtre|balata|aku(?![a-z])|parca|fren|debriyaj|sanziman|kaporta|(?<![a-z])boya|elektrikci|yikama/],
  [7, /ceza|radar|(?<![a-z])park|(?<![a-z])diger/],
];
// Ses tanımanın sık yanlış yazdıkları ve eş anlamlılar → uygulamanın anladığı kelime
const LX_SYN = [
  [/(?<!\p{L})(?:ad|ed|at|et)\s?bl[uü]e?(?!\p{L})|(?<!\p{L})adbl[uü](?!\p{L})|(?<!\p{L})üre(?!\p{L})/gu, 'adblue'],
  [/(?<!\p{L})(?:masot|mazod|mazut|motorın)/gu, 'mazot'],
  [/(?<!\p{L})(?:depo(?:yu)?\s+(?:doldur|full|fulle)\p{L}*|full\s+depo\p{L}*|fulle\p{L}*)/gu, 'mazot'],
  [/(?<!\p{L})navlon/gu, 'navlun'],
  [/(?<!\p{L})(?:nakliye (?:ücreti|bedeli|parası)|taşıma (?:ücreti|bedeli)|yük parası)(?!\p{L})/gu, 'navlun'],
  [/(?<!\p{L})ha\s?ge\s?se(?!\p{L})/gu, 'hgs'], [/(?<!\p{L})o\s?ge\s?se(?!\p{L})/gu, 'ogs'],
  [/(?<!\p{L})(?:harçırah|harçlık|yol harçlığı)/gu, 'harcırah'],
  [/(?<!\p{L})(?:kayeme|ka me)(?!\p{L})/gu, 'km'], [/(\d)\s*kilometrelik(?!\p{L})/gu, '$1 km'],
  [/(\d)\s*litrelik(?!\p{L})/gu, '$1 litre'], [/(?<!\p{L})türk lirası(?!\p{L})/gu, 'lira'], [/(\d)\s*liralık(?!\p{L})/gu, '$1 lira'],
];
// 81 il; güzergâh uçları bunlarla ve geçmiş seferlerin güzergâhlarıyla tanınır
const LX_CITIES = 'Adana Adıyaman Afyon Afyonkarahisar Ağrı Aksaray Amasya Ankara Antalya Ardahan Artvin Aydın Balıkesir Bartın Batman Bayburt Bilecik Bingöl Bitlis Bolu Burdur Bursa Çanakkale Çankırı Çorum Denizli Diyarbakır Düzce Edirne Elazığ Erzincan Erzurum Eskişehir Gaziantep Giresun Gümüşhane Hakkari Hatay Iğdır Isparta İstanbul İzmir Kahramanmaraş Maraş Karabük Karaman Kars Kastamonu Kayseri Kırıkkale Kırklareli Kırşehir Kilis Kocaeli İzmit Konya Kütahya Malatya Manisa Mardin Mersin Muğla Muş Nevşehir Niğde Ordu Osmaniye Rize Sakarya Adapazarı Samsun Siirt Sinop Sivas Şanlıurfa Urfa Şırnak Tekirdağ Tokat Trabzon Tunceli Uşak Van Yalova Yozgat Zonguldak Gebze Alanya Serik Manavgat Kumluca Finike Kaş Demre Fethiye Bodrum Torbalı Bayrampaşa Hadımköy Tuzla Çorlu Lüleburgaz Ereğli Polatlı İskenderun Tarsus Silifke Erdemli Ceyhan Akşehir Bozüyük İnegöl'.split(' ');
const LX_MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const LX_DAYS = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];
const LX_STATIONS = ['Opet', 'Shell', 'BP', 'Petrol Ofisi', 'Total', 'Aytemiz', 'Lukoil', 'Alpet', 'Po', 'Kadoil', 'Moil', 'TP'];
const LX_FILLER = new Set(['ve', 'de', 'da', 'ile', 'için', 'lira', 'tl', 'liralık', '@', 'ekle', 'kaydet', 'yaz', 'gir', 'olarak', 'toplam', 'tutar', 'tutarı', 'bir', 'tane', 'plakalı', 'plaka', 'araç', 'aracı', 'aracına', 'tır', 'tıra', 'şoför', 'şoförü', 'gider', 'masraf', 'ödedim', 'verdim', 'harcadım', 'aldım', 'yaptım', 'yaptı', 'aldı', 'ödendi', 'ödedi', 'oldu', 'için', 'bugün', 'dün']);

function lxNormalize(text) {
  let t = String(text).toLocaleLowerCase('tr-TR').replace(/[’`´]/g, "'").replace(/₺/g, ' lira ').replace(/%\s*(\d)/g, 'yüzde $1');
  LX_SYN.forEach(([re, to]) => { t = t.replace(re, to); });
  t = t.replace(/(\p{L})\s*[-–—]\s*(\p{L})/gu, '$1 _ $2');                       // "Antalya - İstanbul" güzergâh ayracı
  t = t.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2'); // 1.500.000 → 1500000, 44,5 → 44.5
  // "45 bin", "15 bin 575 lira", "1,2 milyon" — rakam + çarpan, kelime sayılarından önce
  t = t.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(milyon|bin)(?:lik|lık|e|i|den|de)?${LX_NA}(?:\\s+(\\d{1,3})(?=\\s*(?:lira|tl)?\\s*(?:$|[,;]|lira|tl)))?`, 'gu'), (m, n, u, r) => ' ' + String(+n * (u === 'bin' ? 1000 : 1e6) + (r ? +r : 0)) + ' ');
  // "kırk dört virgül beşten": birim fiyat ekli sayı kelimesi ("ondan", "birden" günlük dilde başka anlamda, onlar hariç)
  t = t.replace(new RegExp(`${LX_NB}(iki|üç|dört|beş|altı|yedi|sekiz|dokuz|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz)(?:den|dan|ten|tan)${LX_NA}`, 'gu'), '$1 @');
  // çarpanlar ek alabilir: "kırk beş bine", "yüz binlik"
  const W = Object.keys(LX_NUM).concat('buçuk', 'yüz(?:lük|e|ü)?', 'bin(?:lik|e|i|den|de)?', 'milyon(?:luk|a|u|dan|da)?').join('|');
  t = t.replace(new RegExp(`${LX_NB}(?:(?:${W})${LX_NA}\\s*)+`, 'gu'), m => {     // "kırk beş bin" → 45000
    let total = 0, cur = 0;
    m.trim().split(/\s+/).map(w => w.replace(/^(yüz|bin|milyon)\p{L}*$/u, '$1')).forEach(w => {
      if (w === 'yüz') cur = (cur || 1) * 100;
      else if (w === 'bin') { total += (cur || 1) * 1000; cur = 0; }
      else if (w === 'milyon') { total += (cur || 1) * 1e6; cur = 0; }
      else if (w === 'buçuk') cur += 0.5;
      else cur += LX_NUM[w];
    });
    return ' ' + (total + cur) + ' ';
  });
  t = t.replace(new RegExp(`(\\d+)\\s+(?:virgül|nokta)\\s+(\\d+)`, 'gu'), '$1.$2');   // "kırk dört virgül beş" → 44.5
  // Birim fiyat işareti "@": "44,5'ten", "44.5 liradan", "litresi 44.5"
  t = t.replace(new RegExp(`(\\d)\\s*(?:lira|tl)'?(?:dan|den)${LX_NA}`, 'gu'), '$1 @');
  t = t.replace(new RegExp(`(\\d)'?(?:dan|den|tan|ten)${LX_NA}`, 'gu'), '$1 @');
  t = t.replace(new RegExp(`${LX_NB}(?:litresi|litresini|fiyatı)\\s+(\\d+(?:\\.\\d+)?)`, 'gu'), '$1 @');
  return t.replace(/[^\p{L}\d.'@_ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
// Metinde geçen en uzun bilinen adı bulur; Türkçe ekleri tolere eder ("toros gıda'ya", "ahmet'le", "opet'ten").
function lxFind(t, names, fuzzy) {
  const ft = lxFold(t); let best = null;
  names.forEach(n => {
    const fn = lxFold(n).trim(); if (!fn) return;
    const m = ft.match(new RegExp(`${LX_NB}${lxRe(fn)}(?:'?\\p{L}{0,5})?${LX_NA}`, 'u'));
    if (m && (!best || fn.length > best.fn.length)) best = { name: n, fn, idx: m.index, len: m[0].length };
  });
  return best || (fuzzy ? lxFuzzy(ft, names) : null);
}
// Ses tanıma bir iki harfi yanlış duyabilir ("toros gıta"): kelime penceresi ile ad arasındaki harf farkına bakılır.
function lxLev(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; } }
  return d[b.length];
}
function lxFuzzy(ft, names) {
  const toks = [...ft.matchAll(/\p{L}+(?:'\p{L}+)?/gu)]; let best = null;
  names.forEach(n => {
    const fn = lxFold(n).trim(), k = fn.split(' ').length, max = fn.length >= 10 ? 2 : fn.length >= 5 ? 1 : 0;
    if (!max) return;
    for (let i = 0; i + k <= toks.length; i++) {
      const w = toks.slice(i, i + k), cand = ft.slice(w[0].index, w[k - 1].index + w[k - 1][0].length).replace(/'/g, '');
      for (let L = fn.length - 1; L <= Math.min(cand.length, fn.length + 1); L++) {   // sondaki Türkçe eki tolere et
        if (cand.length - L > 5) continue;
        const d = lxLev(cand.slice(0, L), fn);
        if (d <= max && (!best || d < best.d || (d === best.d && fn.length > best.fn.length))) best = { name: n, fn, d, idx: w[0].index, len: cand.length + (ft.slice(w[0].index, w[k - 1].index + w[k - 1][0].length).length - cand.length) };
      }
    }
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
// Güzergâh: bilinen yerleri sırayla bulur; "-dan/-den" eki çıkışı, "-a/-e" eki varışı belirler (sıra ters söylense de).
function lxRoute(t, places) {
  const ft = lxFold(t), hits = [];
  places.forEach(p => {
    const fp = lxFold(p); if (fp.length < 3) return;
    const re = new RegExp(`${LX_NB}${lxRe(fp)}('?(?:y|n)?(?:dan|den|tan|ten|a|e|da|de|ta|te|ya|ye))?(\\s(?:hal|hali|limani|liman|depo|deposu|gumruk|gumrugu)(?:'?\\p{L}{0,4})?)?${LX_NA}`, 'gu');
    for (const m of ft.matchAll(re)) hits.push({ p, idx: m.index, len: m[0].length, suf: (m[1] || '').replace("'", ''), ext: m[2] ? LX_EXT[m[2].trim().replace(/'.*$/, '')] || '' : '' });
  });
  hits.sort((a, b) => a.idx - b.idx || b.len - a.len);
  const uniq = []; hits.forEach(h => { if (!uniq.some(u => h.idx < u.idx + u.len && u.idx < h.idx + h.len)) uniq.push(h); });
  if (uniq.length < 2) return null;
  let [a, b] = uniq;
  const from = h => /^(?:y|n)?(?:dan|den|tan|ten)$/.test(h.suf), to = h => /^(?:y|n)?(?:a|e|ya|ye)$/.test(h.suf);
  if (to(a) && from(b)) [a, b] = [b, a];
  const name = h => h.p + (h.ext ? ' ' + h.ext : '');
  const cut = [a, b].sort((x, y) => y.idx - x.idx).reduce((s, h) => s.slice(0, h.idx) + ' ' + s.slice(h.idx + h.len), t);
  return { route: name(a) + ' - ' + name(b), t: cut.replace(/\s+/g, ' ').trim() };
}
const LX_EXT = { hal: 'Hal', hali: 'Hal', limani: 'Limanı', liman: 'Limanı', depo: 'Depo', deposu: 'Depo', gumruk: 'Gümrük', gumrugu: 'Gümrük' };
const lxISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// "15 kasım", "15 kasımda", "salı günü", "3 gün önce" → tarih; metinden çıkarılır. Gün adı en yakın geçmiş günü verir ("geçen salı" da).
function lxDate(t, today) {
  const T = new Date(today + 'T12:00:00');
  let m = t.match(new RegExp(`(?<![\\d.])(\\d{1,2})\\s+(${LX_MONTHS.join('|')})(?:'?\\p{L}{0,3})?${LX_NA}`, 'u'));
  if (m) { const d = new Date(T.getFullYear(), LX_MONTHS.indexOf(m[2]), +m[1], 12); if (d > T) d.setFullYear(d.getFullYear() - 1); return { date: lxISO(d), t: t.replace(m[0], ' ') }; }
  m = t.match(new RegExp(`(\\d{1,2})\\s+gün\\s+(?:önce|evvel)${LX_NA}`, 'u'));
  if (m) { const d = new Date(T); d.setDate(d.getDate() - +m[1]); return { date: lxISO(d), t: t.replace(m[0], ' ') }; }
  m = t.match(new RegExp(`${LX_NB}(geçen\\s+)?(pazartesi|salı|çarşamba|perşembe|cumartesi|cuma|pazar)(?:\\s+günü|'?\\p{L}{0,2})?${LX_NA}`, 'u'));
  if (m && (m[2] !== 'pazar' || /günü/.test(m[0]))) { const d = new Date(T), back = ((T.getDay() - LX_DAYS.indexOf(m[2])) + 7) % 7 || 7; d.setDate(d.getDate() - back); return { date: lxISO(d), t: t.replace(m[0], ' ') }; }
  return null;
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
  const d = lxFind(t, names, true);
  if (d) { const v = vehicles.find(x => x.driver === String(d.name) || x.driver.split(' ')[0] === String(d.name)); return { v, t: lxCut(t, d) }; }
  return { v: null, t };
}

function lxParse(text, ctx) {
  let t = lxNormalize(text);
  const F = () => lxFold(t), has = re => re.test(F());
  if (!t) return { type: 'unknown' };
  if (/^(?:iptal|vazgeç|vazgeçtim|kapat|hayır|boş ver)(?!\p{L})/u.test(t)) return { type: 'cancel' };
  let date = ctx.today;
  const dt = lxDate(t, ctx.today);
  if (dt) { date = dt.date; t = dt.t; }
  else if (has(/(?<![a-z])dun(?![a-z])/)) date = lxAddDays(ctx.today, -1);
  else if (has(/evvelsi gun|onceki gun/)) date = lxAddDays(ctx.today, -2);
  t = t.replace(new RegExp(`${LX_NB}(?:dün|bugün|şimdi|az önce|evvelsi gün|önceki gün)${LX_NA}`, 'gu'), ' ');

  // Soru → rapor
  if (/\?/.test(text) || has(/ne kadar|(?<![a-z])kac(?![a-z])|nedir|rapor|ozet|goster(?!ge)|durum|(?<![a-z])kim(?:in)?(?![a-z])|hangi|en (?:cok|fazla|az)|borclu|vadesi gec|geciken/)) {
    const period = has(/gecen ay/) ? 'lastmonth' : has(/bu hafta|haftalik|(?<![a-z])hafta/) ? 'week' : has(/bu ay|aylik|(?<![a-z])ay(?![a-z])/) ? 'month'
      : has(/bu yil|yillik|(?<![a-z])yil/) ? 'year' : date !== ctx.today ? 'yesterday' : has(/bugun/) || /bugün/i.test(text) ? 'today' : 'all';
    const metric = has(/en (?:cok|fazla) (?:kar|kazan|para getir)|en karli/) ? 'topProfit' : has(/en (?:cok|fazla) (?:yak|yakit|mazot|tuket)|en yuksek tuketim/) ? 'topFuel'
      : has(/borclu|vadesi gec|geciken|kimin borcu|kim borc/) ? 'debtors' : has(/alacak|borc|bakiye|vade/) ? 'balance' : has(/(?<![a-z])kar(?![a-z])|kazan|(?<![a-z])net/) ? 'profit' : has(/yakit|mazot|motorin|tuketim|litre/) ? 'fuel'
      : has(/gider|masraf|harca/) ? 'expense' : has(/navlun|ciro|gelir/) ? 'freight' : has(/sefer/) ? 'trips' : has(/bakim|muayene|sigorta|belge/) ? 'maint' : 'summary';
    const veh = lxVehicle(t, ctx.vehicles), cl = lxFind(t, lxClientNames(ctx.clients));
    return { type: 'report', period, metric, vehicleId: veh.v ? veh.v.id : '', client: cl ? cl.name.full : '' };
  }

  const veh = lxVehicle(t, ctx.vehicles); t = veh.t;
  const vehicleId = veh.v ? veh.v.id : '';
  let client = '', company = '', station = '';
  const co = lxFind(t, ctx.companies.flatMap(c => [c.name, c.name.split(' ')[0]]), true);
  if (co) { company = ctx.companies.find(c => c.name === co.name || c.name.split(' ')[0] === co.name).id; t = lxCut(t, co); t = t.replace(new RegExp(`^\\s*(?:üzerinden|aracılığıyla|kanalıyla)${LX_NA}|\\s(?:üzerinden|aracılığıyla|kanalıyla)${LX_NA}`, 'gu'), ' '); }
  const cl = lxFind(t, lxClientNames(ctx.clients), true);
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
  const places = [...new Set([...LX_CITIES, ...(ctx.routes || []).flatMap(r => String(r).split(/\s*[-–—]\s*/).map(x => x.replace(/\s+(?:Hal|Hali|Halı|Limanı|Liman|Depo)$/i, '').trim()))].filter(x => x && x.length >= 3))];
  const rr = lxRoute(t, places);
  if (rr) { route = rr.route; t = rr.t; }
  const rm = rr ? null : t.match(new RegExp(`(\\p{L}+(?:\\s\\p{L}+)?)'?(?:dan|den|tan|ten)\\s+(\\p{L}+(?:\\s(?:hal|hali|halı|limanı|liman|depo|deposu))?)'?(?:a|e|ya|ye|na|ne)?${LX_NA}`, 'u'))
    || t.match(/(\p{L}+)\s_\s(\p{L}+(?:\s(?:hal|hali|halı))?)/u) || t.match(new RegExp(`(\\p{L}+)\\s+(\\p{L}+)\\s+arası${LX_NA}`, 'u'));
  if (rm && !/^\d/.test(rm[1]) && !route) { route = lxTitle(rm[1].trim()) + ' - ' + lxTitle(rm[2].trim()); t = t.replace(rm[0], ' '); }
  if (route || has(/sefer|navlun|(?<![a-z])yuk|tasidi|gotur/)) {
    const paid = has(/pesin|tahsil edildi|odendi|parasini aldik|nakit aldik|elden aldik|odemesi yapildi|parasi alindi/) ? 'Tahsil Edildi' : 'Vadeli / Bekliyor';
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
    companies: state.intermediaryCompanies.map(c => ({ id: c.id, name: c.name })), routes: [...new Set(state.trips.map(t => t.route).filter(Boolean))], stations: [...new Set(state.fuels.map(f => f.station).filter(Boolean))], cats: CATS };
}
// Ne anlaşıldığını tek satırda gösterir: kullanıcı yanlış duyulan yeri hemen görür.
function lxSummary(c) {
  const v = c.vehicleId ? vehObj(c.vehicleId).plate : 'araç ?', T = n => n ? fmtTL(n) : '';
  const fuel = { CEKICI: 'Çekici mazotu', FRIGO: 'Frigo mazotu', ADBLUE: 'AdBlue' };
  const parts = c.type === 'trip' ? ['Sefer', v, c.route || 'güzergâh ?', c.client, T(c.price), c.km ? c.km + ' km' : '', c.company ? 'aracı şirketli' : '', c.due ? 'vade ' + fmtD(c.due) : c.paid === 'Tahsil Edildi' ? 'peşin' : '']
    : c.type === 'fuel' ? [fuel[c.fuelType], v, c.liters ? c.liters + ' lt' : '', T(c.totalCost), c.odometerKm ? 'gösterge ' + fmtNum(c.odometerKm, 0) : '', c.station]
    : c.type === 'expense' ? ['Gider', v, c.category, T(c.amount)] : c.type === 'payment' ? ['Tahsilat', c.client, T(c.amount), c.note] : [];
  if (c.date && c.date !== today()) parts.push(fmtD(c.date));
  return parts.filter(Boolean).map(esc).join(' · ');
}
function runAssistant(alts) {
  lxDictating = false; clearTimeout(lxDictT);   // elle ya da dikteyle gönderildi: sayaç iptal
  const inp = $('asst-input'), text = inp.value.trim();
  if (!text) return asstSay(lxHelp());
  // Ses tanıma birden fazla seçenek verdiyse anlaşılan ilkini al
  let c = lxParse(text, asstCtx());
  if (c.type === 'unknown' && alts) for (const a of alts) { const x = lxParse(a, asstCtx()); if (x.type !== 'unknown') { c = x; inp.value = a; break; } }
  if (c.type === 'cancel') { document.querySelectorAll('.modal-wrap.flex').forEach(m => closeModal(m.id)); closeSheet('quickSheet'); inp.value = ''; return toast('İptal edildi.'); }
  const said = lxSummary(c), put = (id, v) => { if (v !== null && v !== undefined && v !== '' && $(id)) $(id).value = v; };
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
    toast('Anladığım: ' + said.replace(/&amp;/g, '&') + '. Kontrol edip kaydedin.'); inp.value = ''; return;
  } else if (c.type === 'report') { return asstSay(asstReport(c)); }
  else return asstSay('Anlayamadım. ' + lxHelp());
  inp.value = '';
  toast('Anladığım: ' + said.replace(/&amp;/g, '&') + '. ' + msg + vNote + ' Kontrol edip kaydedin.', vNote ? 'error' : 'ok');
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
  if (c.metric === 'debtors') {
    const L = cariData().filter(x => x.bal > 0).sort((x, y) => y.dueOpen - x.dueOpen || y.bal - x.bal).slice(0, 6);
    return L.length ? 'Alacaklar (vadesi geçen önce):<br>' + L.map(x => `<b>${esc(x.client)}</b> ${fmtTL(x.bal)}${x.dueOpen > 0 ? ` · <span class="text-rose-600">vadesi gelen ${fmtTL(x.dueOpen)}</span>` : ''}`).join('<br>') : 'Açık alacak yok.';
  }
  if (c.metric === 'topProfit' || c.metric === 'topFuel') {
    const rows = state.vehicles.map(v => ({ v, m: calc(state.trips.filter(x => inR(x) && x.vehicleId === v.id), state.fuels.filter(x => inR(x) && x.vehicleId === v.id), state.expenses.filter(x => inR(x) && x.vehicleId === v.id)) }));
    if (c.metric === 'topProfit') return `${label} en çok kazandıran araçlar:<br>` + rows.sort((a, b2) => b2.m.net - a.m.net).slice(0, 3).map((r, i) => `${i + 1}. ${plate(r.v.plate)} net <b>${fmtTL(r.m.net)}</b>`).join('<br>');
    const f = rows.filter(r => r.m.avg > 0).sort((a, b2) => b2.m.avg - a.m.avg);
    return f.length ? `${label} en çok yakan araçlar (lt/100 km):<br>` + f.slice(0, 3).map((r, i) => `${i + 1}. ${plate(r.v.plate)} <b>${fmtNum(r.m.avg)}</b>`).join('<br>') : 'Tüketim için gösterge km\'li çekici mazotu kaydı yok.';
  }
  if (c.metric === 'maint') { const al = alertList(); return al.length ? `${al.length} uyarı:<br>` + al.slice(0, 6).map(x => esc(x.txt)).join('<br>') : 'Belge ve bakım uyarısı yok.'; }
  if (c.metric === 'fuel') return `${label}${who} yakıt: <b>${fmtTL(r.fuel)}</b>${r.avg > 0 ? ` · çekici ortalaması <b>${fmtNum(r.avg)} lt/100 km</b>` : ''} · frigo ${fmtNum(r.frigoL, 0)} lt`;
  if (c.metric === 'expense') return `${label}${who} diğer giderler: <b>${fmtTL(r.exp)}</b> (yakıt hariç; yakıt ${fmtTL(r.fuel)})`;
  if (c.metric === 'freight') return `${label}${who} navlun: <b>${fmtTL(r.gross)}</b> · ${r.n} sefer`;
  if (c.metric === 'trips') return `${label}${who}: <b>${r.n} sefer</b>, ${fmtNum(r.km, 0)} km, navlun ${fmtTL(r.gross)}`;
  if (c.metric === 'profit') return `${label}${who}: navlun ${fmtTL(r.gross)} − kesinti ${fmtTL(r.cut)} − yakıt ${fmtTL(r.fuel)} − gider ${fmtTL(r.exp)} = net <b class="${netCls(r.net)}">${fmtTL(r.net)}</b>`;
  return `${label}${who}: ${r.n} sefer · navlun ${fmtTL(r.gross)} · yakıt ${fmtTL(r.fuel)} · gider ${fmtTL(r.exp)} · net <b class="${netCls(r.net)}">${fmtTL(r.net)}</b>`;
}
// ---------------- Sesle söyleme (iPhone uyumlu; Karacaahmet'teki çalışan yapı) ----------------
// Sürekli dinler, susunca gönderir; iPhone 'bitti' işareti göndermese de çalışır. Mikrofon açılıp yazı gelmezse
// (iPhone'da ana ekrandan açılan uygulamada olur) klavye diktesine geçer ve bu tercih 14 gün hatırlanır.
const LX_IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const LX_SILENCE_MS = 2500, LX_MAX_MS = 30000, LX_NO_AUDIO_MS = (typeof window !== 'undefined' && window.LX_NO_AUDIO_MS) || (LX_IOS ? 5000 : 7000);
const LX_DICTATE_KEY = 'LOJIX_DICTATE_UNTIL', LX_DICTATE_DAYS = 14;
let asstRec = null, lxDictating = false, lxDictT = 0;
// iPhone ara sonuçları birikimli verir ("609", "609 antalya", ...): parçalar tekrar etmeden birleşir.
function lxMergeText(acc, next) {
  acc = String(acc || '').trim(); next = String(next || '').trim();
  if (!acc) return next; if (!next) return acc;
  const fa = lxFold(acc), fn = lxFold(next);
  if (fn.startsWith(fa)) return next;
  if (fa.includes(fn)) return acc;
  return acc + ' ' + next;
}
const lxDictateRemembered = () => { try { return +(localStorage.getItem(LX_DICTATE_KEY) || 0) > Date.now(); } catch (e) { return false; } };
function lxRememberDictate(on) { try { on ? localStorage.setItem(LX_DICTATE_KEY, String(Date.now() + LX_DICTATE_DAYS * 864e5)) : localStorage.removeItem(LX_DICTATE_KEY); } catch (e) {} }
// Klavye diktesi: kutu açılır, kişi klavyedeki 🎤 ile söyler; susunca kendiliğinden gönderilir.
function lxDictate(msg) {
  openSheet('quickSheet');
  const inp = $('asst-input'); lxDictating = true; clearTimeout(lxDictT); inp.value = ''; inp.focus();
  asstSay((msg ? msg + '<br>' : '') + 'Kutuya dokunup klavyedeki <b>🎤</b> tuşuyla söyleyin; bitirince <b>2,5 sn susun</b>, kendiliğinden gönderilir. '
    + '<button type="button" class="underline font-semibold" onclick="lxRememberDictate(false);asstListen()">Doğrudan dinlemeyi yeniden dene</button>');
}
if (typeof document !== 'undefined') document.addEventListener('input', e => {
  if (!lxDictating || !e.target || e.target.id !== 'asst-input') return;
  clearTimeout(lxDictT);
  lxDictT = setTimeout(() => { if (lxDictating && $('asst-input').value.trim()) runAssistant(); }, LX_SILENCE_MS);
});
function asstListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, inp = $('asst-input'), btn = $('asst-mic');
  if (asstRec) { asstRec.stop(); return; }                  // dinlerken tekrar basınca bitir ve gönder
  if (!SR) return lxDictate('Bu tarayıcıda doğrudan ses tanıma yok.');
  if (lxDictateRemembered()) return lxDictate();            // bu telefonda doğrudan dinleme çalışmadı: hemen klavye diktesi
  openSheet('quickSheet'); lxDictating = false;
  // iPhone'un tanıyıcısı sürekli kipte takılabiliyor: orada tek seferlik dinleme
  const r = new SR(); r.lang = 'tr-TR'; r.continuous = !LX_IOS; r.interimResults = true; r.maxAlternatives = 3;
  let finalText = '', interim = '', alts = [], heard = false, audio = false, sent = false, failed = false, silenceT = 0, noAudioT = 0, maxT = 0;
  const timers = () => [silenceT, noAudioT, maxT].forEach(clearTimeout);
  const live = on => { btn.classList.toggle('listening', on); btn.setAttribute('aria-pressed', String(on)); btn.setAttribute('aria-label', on ? 'Dinlemeyi bitir ve gönder' : 'Sesle söyle'); };
  const send = () => {
    if (sent) return; sent = true; timers();
    const text = lxMergeText(finalText, interim);
    if (failed) return;
    if (!text) { if (!heard) asstSay('Ses duyulmadı. Mikrofona basıp konuşun, bitirince susun.'); return; }
    inp.value = text; runAssistant(alts.filter(a => a && a !== text));
  };
  r.onaudiostart = () => { audio = true; };
  r.onresult = e => {
    heard = true; clearTimeout(noAudioT);
    for (let i = e.resultIndex || 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) { finalText = lxMergeText(finalText, res[0].transcript); alts = [...res].map(a => a.transcript); }
    }
    // Ara sonuçlar her seferinde baştan kurulur: bazı iPhone sürümleri "bitti" işaretini hiç göndermez
    interim = [...e.results].filter(x => !x.isFinal).reduce((acc, x) => lxMergeText(acc, x[0].transcript), '');
    inp.value = lxMergeText(finalText, interim);
    clearTimeout(silenceT); silenceT = setTimeout(() => r.stop(), LX_SILENCE_MS);   // susunca gönder
  };
  r.onerror = e => {
    if (e.error === 'aborted' || e.error === 'no-speech') return;
    failed = true;
    if (e.error === 'service-not-allowed') { lxRememberDictate(true); lxDictate('Bu ekranda doğrudan ses tanıma kapalı (iPhone’da ana ekrandan açılan uygulamalarda olur).'); }
    else if (e.error === 'not-allowed') lxDictate('Mikrofon izni verilmedi. Telefon ayarlarından tarayıcıya mikrofon izni verin.');
    else if (e.error === 'audio-capture') asstSay('Mikrofon başka bir uygulama tarafından kullanılıyor olabilir. Kapatıp tekrar deneyin.');
    else lxDictate();
  };
  r.onend = () => { asstRec = null; live(false); send(); };
  try {
    r.start(); asstRec = r; inp.value = ''; live(true);
    asstSay('Dinliyorum… Bitirince susun ya da mikrofona tekrar basın.');
    noAudioT = setTimeout(() => {
      if (heard) return;
      failed = true; try { r.stop(); } catch (e) {}
      if (audio) { lxRememberDictate(true); lxDictate('Mikrofon açıldı ama söylediğiniz yazıya dönmedi; bu telefonda klavye diktesi kullanılacak.'); }
      else asstSay('Mikrofondan ses gelmiyor. iPhone’da Ayarlar → Genel → Klavye → <b>Dikte</b> açık olmalı ve tarayıcıya mikrofon izni verilmiş olmalı.');
    }, LX_NO_AUDIO_MS);
    maxT = setTimeout(() => r.stop(), LX_MAX_MS);
  } catch (e) { asstRec = null; live(false); lxDictate(); }
}
