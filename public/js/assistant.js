// ================= ASİSTAN (kurallı, ücretsiz, internetsiz) =================
// parseCommand saf fonksiyondur (ekrana dokunmaz): cümle + bilinen adlar → ne yapılacağı.
// Kayıtlar doğrudan eklenmez; ilgili form doldurulmuş açılır, kullanıcı "Kaydet"e basar.
const ASST_UNITS = { adet: 'adet', tane: 'adet', kilo: 'kg', kg: 'kg', kilogram: 'kg', kasa: 'kasa', 'çuval': 'çuval', 'bağ': 'bağ', demet: 'bağ' };
const ASST_NUM = { 'sıfır': 0, bir: 1, iki: 2, 'üç': 3, 'dört': 4, 'beş': 5, 'altı': 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10, yirmi: 20, otuz: 30, 'kırk': 40, elli: 50, 'altmış': 60, 'yetmiş': 70, seksen: 80, doksan: 90 };
const ASST_CATS = [
  ['Mazot / Yakıt', /mazot|yakit|benzin|motorin|lpg/],
  ['Nakliye / Taşıma', /nakliye|tasima|hamal|kargo/],
  ['Araç Bakım / Tamir', /tamir|bakim|lastik|servis|sanayi/],
  ['Elektrik / Su / Fatura', /elektrik|fatura|dogalgaz|internet|telefon/],
  ['Yemek / Çay', /yemek|cay|kumanya|kahvalti|simit|ogle/],
  ['Market', /market|malzeme|poset|naylon|bakkal/],
  ['Kira', /kira/],
];
const ASST_FILLER = new Set(['ve', 'de', 'da', 'ile', 'için', 'lira', 'tl', '@', 'sattım', 'sattık', 'sattı', 'satış', 'sat', 'verdim', 'verdik', 'aldım', 'aldık', 'alış', 'ekle', 'kaydet', 'yaz', 'tane', 'bir', 'olarak', 'toplam', 'her', 'birim', 'fiyat', 'fiyatı', 'fiyatına', 'fiyatla', 'fiyatından']);
const asstFold = s => String(s).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
const asstTitle = s => s.split(' ').filter(Boolean).map(w => w[0].toLocaleUpperCase('tr-TR') + w.slice(1)).join(' ');
const asstEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NB = '(?<!\\p{L})', NA = '(?!\\p{L})'; // Türkçe harflerle çalışan kelime sınırı

// Sayı kelimeleri ve rakamlar tek sayıya: "yirmi beş"→25, "2 bin 500"→2500, "bin beş yüz"→1500.
// İki ayrı rakam ("20 25": miktar ve fiyat) birleşmez; rakam yalnız "bin/yüz"den sonra devam eder.
function asstJoinNumbers(t) {
  const out = [], toks = t.split(' ');
  for (let i = 0; i < toks.length;) {
    const kind = w => /^\d+(?:\.\d+)?$/.test(w) ? 'D' : w in ASST_NUM ? 'W' : (w === 'yüz' || w === 'bin') ? 'M' : w === 'buçuk' ? 'H' : '';
    if (!kind(toks[i]) || kind(toks[i]) === 'H') { out.push(toks[i++]); continue; }
    const run = [toks[i++]];
    while (i < toks.length) {
      const k = kind(toks[i]), last = kind(run[run.length - 1]), wordsOnly = run.every(w => kind(w) === 'W');
      if (k === 'M' || k === 'H' || (k === 'W' && (wordsOnly || last === 'M')) || (k === 'D' && last === 'M')) run.push(toks[i++]); else break;
    }
    let total = 0, cur = 0, lastM = '';
    run.forEach(w => {
      const k = kind(w);
      if (w === 'yüz') { cur = (cur || 1) * 100; lastM = w; }
      else if (w === 'bin') { total += (cur || 1) * 1000; cur = 0; lastM = w; }
      else if (k === 'H') { if (lastM === 'bin') total += 500; else if (lastM === 'yüz') cur += 50; else cur += 0.5; } // "bin buçuk" = 1500
      else { cur += k === 'D' ? +w : ASST_NUM[w]; lastM = ''; }
    });
    out.push(String(total + cur));
  }
  return out.join(' ');
}
function asstNormalize(text) {
  let t = String(text).toLocaleLowerCase('tr-TR').replace(/[’`´]/g, "'").replace(/₺/g, ' lira ');
  t = t.replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1').replace(/(\d),(\d)/g, '$1.$2'); // 1.000.000 → 1000000, 2,5 → 2.5
  // Birim fiyat işaretleri "@" olur: "25 liradan", "25'ten", "yirmi beşten", "tanesi 25"
  const priceMarks = x => x
    .replace(new RegExp(`(\\d)\\s*(?:lira|tl)'?(?:dan|den|ya|ye)${NA}`, 'gu'), '$1 @')
    .replace(new RegExp(`(\\d)'?(?:dan|den|tan|ten)${NA}`, 'gu'), '$1 @');
  t = priceMarks(t);
  const W = Object.keys(ASST_NUM).filter(w => w !== 'on' && w !== 'bir').concat('yüz', 'bin').join('|'); // "ondan", "birden" başka anlam
  t = t.replace(new RegExp(`${NB}(${W})'?(?:dan|den|tan|ten)${NA}`, 'gu'), '$1 @');
  t = t.replace(/[^\p{L}\d.'@ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  t = priceMarks(asstJoinNumbers(t));
  t = t.replace(new RegExp(`${NB}(?:tanesi|tanesini|kilosu|kilosunu|kasası|kasasını|adedi)\\s+(\\d+(?:\\.\\d+)?)`, 'gu'), '$1 @');
  return t.replace(/\s+/g, ' ').trim();
}
// Metinde geçen en uzun bilinen adı bulur ("halil'e", "halilden", "halil kardeşi'nin").
function asstFindName(t, names) {
  const ft = asstFold(t); let best = null;
  names.forEach(n => {
    const fn = asstFold(n).trim(); if (!fn) return;
    const m = ft.match(new RegExp(`${NB}${asstEsc(fn)}(?:'?(?:[yn]?[ea]|n?[dt][ea]n|n?[iu]n|y?l[ea]))?${NA}`, 'u'));
    if (m && (!best || fn.length > best.fn.length)) best = { name: n, fn, idx: m.index, len: m[0].length };
  });
  return best;
}

function parseCommand(text, ctx) {
  let t = asstNormalize(text);
  const f = asstFold(t), has = re => re.test(f);
  if (!t) return { type: 'unknown' };
  // Tarih
  let date = ctx.today;
  if (has(/(?<![a-z])dun(?![a-z])/)) { const d = new Date(ctx.today + 'T12:00:00'); d.setDate(d.getDate() - 1); date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  t = t.replace(new RegExp(`${NB}(?:dün|bugün|şimdi|az önce)${NA}`, 'gu'), ' ');
  // Soru → rapor
  if (/\?/.test(text) || has(/ne kadar|(?<![a-z])kac(?![a-z])|nedir|rapor|ozet|goster|en cok|kasada|kasa ne|(?<![a-z])kim(?![a-z])/)) {
    const period = has(/gecen ay/) ? 'lastmonth' : has(/bu hafta|haftalik|(?<![a-z])hafta/) ? 'week' : has(/bu ay|aylik|(?<![a-z])ay(?![a-z])/) ? 'month'
      : has(/bu yil|yillik|(?<![a-z])yil/) ? 'year' : has(/(?<![a-z])dun(?![a-z])/) ? 'yesterday' : has(/tum|hepsi|toplam/) ? 'all' : 'today';
    const metric = has(/kasa|nakit/) ? 'cash' : has(/borc|alacak/) ? 'balance' : has(/en cok/) ? 'top' : has(/(?<![a-z])kar(?![a-z])|kazan/) ? 'profit'
      : has(/gider|masraf|harca/) ? 'expense' : has(/tahsil/) ? 'collected' : has(/alis|aldi|aldik/) ? 'purchase' : 'sales';
    const c = asstFindName(t, ctx.customers), s = asstFindName(t, ctx.suppliers);
    return { type: 'report', period, metric, party: c ? { name: c.name, kind: 'customer' } : s ? { name: s.name, kind: 'supplier' } : null };
  }
  // Cari (müşteri/tedarikçi) adı
  const cust = asstFindName(t, ctx.customers), sup = asstFindName(t, ctx.suppliers);
  const hit = cust && sup ? (cust.fn.length >= sup.fn.length ? cust : sup) : cust || sup;
  let party = null;
  if (hit) { party = hit.name; t = (t.slice(0, hit.idx) + ' ' + t.slice(hit.idx + hit.len)).trim(); }
  else {
    const m = t.match(/^((?:\p{L}+ ){0,2}\p{L}+)'\p{L}+/u) || t.match(/^(\p{L}+) (?=\d)/u);
    if (m && !ASST_FILLER.has(m[1])) { party = asstTitle(m[1]); t = t.slice(m[0].length).trim(); }
  }
  // Ödeme
  let paid = null;
  const pm = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:lira|tl)?\\s*(?:\\p{L}{0,5}\\s)?(?:peşin|nakit|aldım|aldık|aldı|ödedi|ödedim|ödedik|verdi|verdim|ödendi|tahsil)${NA}`, 'u'));
  if (pm) { paid = +pm[1]; t = t.replace(pm[0], ' '); }
  else if (has(/hepsini|tamamini|tumunu|(?<![a-z])pesin|(?<![a-z])nakit/)) paid = 'full';
  else if (has(/veresiye|borca|(?<![a-z])borc/)) paid = 0;
  t = t.replace(new RegExp(`${NB}(?:hepsini|tamamını|tümünü|peşin|nakit|veresiye|borca|borç|kartla|kart|ile)${NA}`, 'gu'), ' ');
  // Kalemler: [miktar][birim?][ürün][fiyat] veya [ürün][miktar][birim][fiyat]
  const items = []; let cur = { nums: [], unit: '', words: [] };
  const close = () => {
    if (cur.words.length && cur.nums.length) {
      const prodRaw = cur.words.join(' '), known = ctx.products.find(p => asstFold(p) === asstFold(prodRaw));
      items.push({ prod: known || asstTitle(prodRaw), qty: cur.nums[0], unit: cur.unit, price: cur.nums[1] || 0 });
    }
    cur = { nums: [], unit: '', words: [] };
  };
  // Kalem; ürün kelimesi ve iki sayı (miktar, fiyat) birikince kapanır. Fiyatsız kalemin fiyatı formda son fiyattan gelir.
  const toks = t.split(' ');
  toks.forEach((tok, i) => {
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      // "10 kasa marul 2 kasa lahana": birimli yeni miktar, fiyatsız önceki kalemi kapatır
      if (cur.nums.length === 1 && cur.words.length && ASST_UNITS[toks[i + 1]]) close();
      cur.nums.push(+tok); if (cur.nums.length > 2) cur.nums.shift(); if (cur.nums.length === 2 && cur.words.length) close(); return;
    }
    if (ASST_UNITS[tok]) { cur.unit = ASST_UNITS[tok]; return; }
    if (!ASST_FILLER.has(tok) && /^\p{L}+$/u.test(tok)) cur.words.push(tok);
  });
  close();
  const amount = (t.match(/\d+(?:\.\d+)?/) || [])[0];
  // Niyet
  if (has(/(?<![a-z])sat(t|is|ar|i)|(?<![a-z])sat(?![a-z])/) || (items.length && has(/verdim|verdik/))) return { type: 'sale', party, date, items, paid: paid === null ? 0 : paid };
  if (!items.length && party && has(/odedi(?!m)|tahsil|yatirdi|getirdi|verdi(?!m)/) && (paid !== null || amount)) return { type: 'collect', party, date, amount: typeof paid === 'number' ? paid : +amount };
  if (!items.length && party && sup && hit === sup && has(/odedim|verdim|odeme/) && (paid !== null || amount)) return { type: 'pay', party, date, amount: typeof paid === 'number' ? paid : +amount };
  if (items.length && has(/aldim|aldik|(?<![a-z])alis|(?<![a-z])aldi/)) return { type: 'purchase', party, date, items, paid: paid === null ? 0 : paid };
  if (!items.length && party && cust && has(/aldim|aldik/) && typeof paid === 'number') return { type: 'collect', party, date, amount: paid };
  const cat = ASST_CATS.find(([, re]) => has(re));
  const expAmount = typeof paid === 'number' ? paid : amount ? +amount : 0;
  if (expAmount && (cat || has(/gider|masraf|harcad|odedim|verdim/))) {
    const desc = asstTitle(t.replace(/\d+(?:\.\d+)?/g, ' ').split(' ').filter(w => w && !ASST_FILLER.has(w) && !/^(gider|masraf|harcadım|ödedim|verdim|için)$/.test(w)).join(' '));
    return { type: 'expense', date, amount: expAmount, category: cat ? cat[0] : 'Diğer', desc, card: has(/kart/) };
  }
  if (items.length) return { type: 'sale', party, date, items, paid: paid === null ? 0 : paid };
  return { type: 'unknown' };
}

// ---------------- Arayüz ----------------
let asstVoiceTurn = false; // komut mikrofondan geldiyse cevap sesli okunur
function asstSay(html) {
  const el = document.getElementById('asst-out'); el.innerHTML = html; el.classList.remove('hidden');
  if (asstVoiceTurn) asstSpeak(asstSpeechText(html));
}
// Ekrandaki cevabı okunacak metne çevirir: "₺9.570,00" → "9.570 lira", "−" → "eksi". Saf fonksiyon.
function asstSpeechText(html) {
  return String(html).replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]+>/g, '')
    .replace(/[+−-]?₺([\d.]+),(\d{2})/g, (m, n, k) => (m[0] === '−' || m[0] === '-' ? 'eksi ' : '') + n + ' lira' + (k === '00' ? '' : ' ' + (+k) + ' kuruş'))
    .replace(/ − /g, ' eksi ').replace(/ = /g, ' eşittir ').replace(/[·•]/g, ', ')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').replace(/\s+/g, ' ').trim();
}
function asstSpeak(text) {
  if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  try { speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(text), v = speechSynthesis.getVoices().find(x => /^tr/i.test(x.lang));
  u.lang = 'tr-TR'; u.rate = 1.05; if (v) u.voice = v;
  try { speechSynthesis.speak(u); } catch (e) {} // okuma olmasa da asistan çalışmaya devam eder
}
function asstCtx() {
  const uniq = a => [...new Map(a.filter(Boolean).map(x => [fk(x), x.trim()])).values()];
  return {
    today: getTodayString(),
    customers: uniq(sales.map(s => s.customer)), suppliers: uniq(purchases.map(p => p.supplier)),
    products: uniq([...sales, ...purchases].flatMap(r => r.items.map(i => i.prod)).concat(wastes.map(w => w.prod))),
  };
}
const ASST_HELP = `<b>Şöyle söyleyebilirsiniz:</b><br>• Halil'e 20 adet kıvırcık 25 liradan sattım, 200 peşin aldım<br>• Halden 30 kasa marul 18'den aldım, veresiye<br>• 500 lira mazot · dün yemek 250 lira kartla<br>• Halil 1000 lira ödedi<br>• Bugün ne kadar sattım? · Bu ay kâr ne kadar? · Halil'in borcu ne kadar? · Kasada ne kadar var?`;

function runAssistant() {
  const inp = document.getElementById('asst-input'), text = inp.value.trim();
  if (!text) return asstSay(ASST_HELP);
  const cmd = parseCommand(text, asstCtx());
  if (cmd.type === 'sale' || cmd.type === 'purchase') return asstOpenForm(cmd, inp);
  if (cmd.type === 'expense') return asstOpenExpense(cmd, inp);
  if (cmd.type === 'collect' || cmd.type === 'pay') return asstSettle(cmd, inp);
  if (cmd.type === 'report') return asstSay(asstReport(cmd));
  asstSay('Anlayamadım. ' + ASST_HELP);
}
function asstOpenForm(cmd, inp) {
  const P = cmd.type, list = P === 'sale' ? sales : purchases;
  if (!cmd.items.length) return asstSay('Ürün ve miktarı anlayamadım. Örnek: "Halil\'e 20 adet kıvırcık 25 liradan sattım".');
  openModal(P + '-modal');
  document.getElementById(P === 'sale' ? 'sale-customer' : 'purchase-supplier').value = cmd.party || '';
  document.getElementById(P + '-date').value = cmd.date;
  const cont = document.getElementById(P + '-items-container');
  cmd.items.forEach((it, i) => {
    if (i > 0) addItemRow(P + '-items-container', P);
    const row = cont.querySelectorAll('.item-row')[i], unit = it.unit || lastUnit(it.prod), price = it.price || lastPrice(it.prod, list);
    row.querySelector('.row-prod').value = it.prod;
    if (unit) row.querySelector('.row-unit').value = unit;
    row.querySelector('.row-qty').value = it.qty;
    if (price) row.querySelector('.row-price').value = price;
  });
  calcModalTotal(P + '-items-container', P + '-total-preview');
  if (cmd.paid === 'full') fillFullPayment(P + '-items-container', P + '-paid');
  else if (cmd.paid) document.getElementById(P + '-paid').value = cmd.paid;
  inp.value = '';
  asstSay(`${P === 'sale' ? 'Satış' : 'Alış'} formu dolduruldu. Kontrol edip <b>Kaydet</b>'e basın.`);
}
function asstOpenExpense(cmd, inp) {
  openModal('expense-modal');
  document.getElementById('expense-amount').value = cmd.amount;
  document.getElementById('expense-category').value = cmd.category;
  document.getElementById('expense-desc').value = cmd.desc;
  document.getElementById('expense-date').value = cmd.date;
  if (cmd.card && cards.length) setExpMethod('card');
  inp.value = '';
  asstSay(`Gider formu dolduruldu (${esc(cmd.category)}, ${formatMoney(cmd.amount)}). Kontrol edip <b>Kaydet</b>'e basın.`);
}
// Tahsilat / tedarikçiye ödeme: açık kayıtlara eskiden yeniye dağıtılır.
function asstSettle(cmd, inp) {
  const c = cmd.type === 'collect', list = c ? sales : purchases, key = c ? 'customer' : 'supplier';
  const open = list.filter(r => fk(r[key]) === fk(cmd.party) && r.total - (r.paid || 0) > 0.005).sort((a, b) => a.date.localeCompare(b.date));
  if (!(cmd.amount > 0)) return asstSay('Tutarı anlayamadım.');
  if (!open.length) return asstSay(`<b>${esc(cmd.party)}</b> için açık ${c ? 'alacak' : 'borç'} bulunamadı.`);
  const debt = round2(open.reduce((a, r) => a + r.total - (r.paid || 0), 0)), apply = Math.min(cmd.amount, debt);
  const label = c ? 'tahsilat' : 'ödeme';
  if (!confirm(`${cmd.party}: ${formatMoney(apply)} ${label}, ${open.length} açık kayda eskiden yeniye işlenecek.` + (cmd.amount > debt ? ` Toplam ${c ? 'alacak' : 'borç'} ${formatMoney(debt)}; fazla ${formatMoney(cmd.amount - debt)} işlenmeyecek.` : '') + ' Onaylıyor musunuz?')) return;
  let left = apply;
  open.forEach(r => {
    if (left <= 0.005) return;
    const p = round2(Math.min(left, r.total - (r.paid || 0)));
    r.payments.push({ id: newId('PY'), date: cmd.date, amount: p, note: 'Asistan: ' + label });
    r.paid = sumPay(r.payments); left = round2(left - p);
  });
  saveAll(); applyFilters(); inp.value = '';
  asstSay(`✔ ${esc(cmd.party)}: ${formatMoney(apply)} ${label} işlendi. Kalan ${c ? 'alacak' : 'borç'}: <b>${formatMoney(round2(debt - apply))}</b>`);
}
function asstRange(period) {
  const t = getTodayString(), d = new Date(t + 'T12:00:00'), ym = (y, m) => y + '-' + String(m).padStart(2, '0');
  if (period === 'yesterday') { d.setDate(d.getDate() - 1); const s = toDateStr(d); return [s, s, 'Dün']; }
  if (period === 'week') { const w = getWeekRange(); return [w.start, w.end, 'Bu hafta']; }
  if (period === 'month') return [t.slice(0, 7) + '-01', t, 'Bu ay'];
  if (period === 'lastmonth') { const p = new Date(d.getFullYear(), d.getMonth() - 1, 1); const k = ym(p.getFullYear(), p.getMonth() + 1); return [k + '-01', k + '-31', 'Geçen ay']; }
  if (period === 'year') return [t.slice(0, 4) + '-01-01', t, 'Bu yıl'];
  if (period === 'all') return ['0000', '9999', 'Tüm zamanlar'];
  return [t, t, 'Bugün'];
}
function asstReport(cmd) {
  const [a, b, label] = asstRange(cmd.period), inR = x => x >= a && x <= b;
  const sum = (list, f) => round2(list.reduce((s, x) => s + f(x), 0));
  if (cmd.metric === 'cash') return `💵 Kasadaki nakit: <b>${esc(document.getElementById('cash-total').textContent)}</b>`;
  if (cmd.metric === 'balance') {
    const bal = (list, key, n) => round2(list.filter(r => !n || fk(r[key]) === fk(n)).reduce((s, r) => s + r.total - (r.paid || 0), 0));
    if (cmd.party) return cmd.party.kind === 'customer' ? `<b>${esc(cmd.party.name)}</b> kalan borcu (bize): <b>${formatMoney(bal(sales, 'customer', cmd.party.name))}</b>` : `<b>${esc(cmd.party.name)}</b>'e kalan borcumuz: <b>${formatMoney(bal(purchases, 'supplier', cmd.party.name))}</b>`;
    return `Toplam alacak: <b>${formatMoney(bal(sales, 'customer'))}</b> · Toplam borç: <b>${formatMoney(bal(purchases, 'supplier'))}</b>`;
  }
  const S = sum(sales.filter(r => inR(r.date)), r => r.total), P = sum(purchases.filter(r => inR(r.date)), r => r.total);
  const E = sum(expenses.flatMap(expEntries).filter(x => inR(x.date)), x => x.amount);
  if (cmd.metric === 'top') {
    const m = {}; sales.filter(r => inR(r.date)).forEach(r => r.items.forEach(i => { const k = fk(i.prod) + '|' + i.unit; const o = m[k] || (m[k] = { n: i.prod, u: i.unit, q: 0, t: 0 }); o.q += i.qty; o.t += i.total || round2(i.qty * i.price); }));
    const top = Object.values(m).sort((x, y) => y.t - x.t).slice(0, 3);
    return `${label} en çok satılanlar: ` + (top.map((o, i) => `<br>${i + 1}. <b>${esc(o.n)}</b> ${round2(o.q)} ${esc(o.u)} · ${formatMoney(o.t)}`).join('') || 'satış yok.');
  }
  if (cmd.party && cmd.party.kind === 'customer') return `${label} <b>${esc(cmd.party.name)}</b>'e satış: <b>${formatMoney(sum(sales.filter(r => inR(r.date) && fk(r.customer) === fk(cmd.party.name)), r => r.total))}</b>`;
  if (cmd.metric === 'profit') return `${label}: satış ${formatMoney(S)} − alış ${formatMoney(P)} − gider ${formatMoney(E)} = net kâr <b>${formatMoney(round2(S - P - E))}</b>`;
  if (cmd.metric === 'expense') return `${label} gider: <b>${formatMoney(E)}</b>` + (P ? ` (ayrıca mal alışı ${formatMoney(P)})` : '');
  if (cmd.metric === 'purchase') return `${label} mal alışı: <b>${formatMoney(P)}</b>`;
  if (cmd.metric === 'collected') return `${label} tahsilat: <b>${formatMoney(sum(sales.flatMap(r => r.payments).filter(p => inR(p.date)), p => p.amount))}</b>`;
  return `${label} satış: <b>${formatMoney(S)}</b> (${sales.filter(r => inR(r.date)).length} satış)`;
}
// Sesle söyleme: söylenen kutuda canlı görünür, susunca gönderilir; tekrar basınca durur.
let asstRec = null;
function asstListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, inp = document.getElementById('asst-input'), btn = document.getElementById('asst-mic');
  if (asstRec) { asstRec.stop(); return; }
  const fallback = () => { asstSay('Bu ekranda doğrudan ses tanıma açılamadı. Kutuya dokunup klavyedeki 🎤 tuşuyla söyleyin, sonra gönderin.'); inp.focus(); };
  if (!SR) return fallback();
  // iPhone sesli okumaya yalnız dokunuşla izin verir: dokunurken sessiz bir okuma ile kilidi aç
  if (window.speechSynthesis && window.SpeechSynthesisUtterance) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
  const r = new SR(); r.lang = 'tr-TR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let done = false;
  r.onresult = e => {
    const res = [...e.results], text = res.map(x => x[0].transcript).join(' ').trim();
    inp.value = text;
    if (res.length && res[res.length - 1].isFinal && !done) { done = true; asstVoiceTurn = true; try { runAssistant(); } finally { asstVoiceTurn = false; } }
  };
  r.onerror = e => { if (e.error === 'no-speech') asstSay('Ses duyulmadı, tekrar deneyin.'); else if (e.error !== 'aborted') fallback(); };
  r.onend = () => {
    asstRec = null; btn.classList.remove('animate-pulse', 'bg-rose-600'); btn.classList.add('bg-emerald-600');
    if (!done && inp.value.trim()) { done = true; asstVoiceTurn = true; try { runAssistant(); } finally { asstVoiceTurn = false; } } // son parça "final" gelmeden bittiyse
  };
  try {
    r.start(); asstRec = r; inp.value = '';
    btn.classList.add('animate-pulse', 'bg-rose-600'); btn.classList.remove('bg-emerald-600');
    asstSay('Dinliyorum… Bitirince susun ya da mikrofona tekrar basın.');
  } catch (e) { asstRec = null; fallback(); }
}
