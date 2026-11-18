// ================= ÖNERİ (OTOMATİK TAMAMLAMA) =================
// Müşteri, tedarikçi ve ürün adı yazarken, daha önce girilen adlardan öneri çıkar
(function () {
  const fold = s => String(s).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
  const box = document.createElement('div');
  box.className = 'fixed z-[70] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden hidden';
  document.body.appendChild(box);
  let cur = null, list = [];
  const kindOf = el => el.id === 'sale-customer' ? 'customer' : el.id === 'purchase-supplier' ? 'supplier' : (el.classList && el.classList.contains('row-prod')) ? 'product' : null;

  function names(kind) {
    const m = {};
    const add = (n, u) => {
      n = String(n || '').trim(); if (!n) return;
      const k = fold(n), o = m[k] || (m[k] = { name: n, n: 0, unit: '' });
      o.n++; if (u && !o.unit) o.unit = u;
    };
    if (kind === 'customer') sales.forEach(x => add(x.customer));
    else if (kind === 'supplier') purchases.forEach(x => add(x.supplier));
    else [...sales, ...purchases].forEach(r => r.items.forEach(i => add(i.prod, i.unit)));
    return Object.values(m);
  }
  function hide() { box.classList.add('hidden'); cur = null; }
  function show(inp) {
    const kind = kindOf(inp), q = fold(inp.value.trim());
    if (!kind || !q) return hide();
    list = names(kind).filter(x => fold(x.name).includes(q) && fold(x.name) !== q)
      .sort((a, b) => (fold(b.name).startsWith(q) - fold(a.name).startsWith(q)) || b.n - a.n).slice(0, 6);
    if (!list.length) return hide();
    cur = inp;
    box.innerHTML = list.map((x, i) => `<div data-i="${i}" class="px-3 py-2.5 text-sm border-b border-slate-100 last:border-0 active:bg-emerald-50">${esc(x.name)}</div>`).join('');
    const r = inp.getBoundingClientRect(), vv = window.visualViewport;
    const h = list.length * 42 + 4;
    const below = (vv ? vv.offsetTop + vv.height : window.innerHeight) - r.bottom;
    box.style.left = r.left + 'px';
    box.style.width = Math.max(r.width, 170) + 'px';
    box.style.top = (below < h + 8 ? Math.max(4, r.top - h - 4) : r.bottom + 4) + 'px';
    box.classList.remove('hidden');
  }
  document.addEventListener('input', e => { if (kindOf(e.target)) show(e.target); });
  document.addEventListener('focusout', e => { if (kindOf(e.target)) hide(); });
  document.addEventListener('scroll', () => { if (cur) show(cur); }, true);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (cur) show(cur); });
  // Dokununca odak kaybolmasın, adı yaz
  box.addEventListener('pointerdown', e => {
    e.preventDefault();
    const it = e.target.closest('[data-i]');
    if (!it || !cur) return;
    const x = list[+it.dataset.i], inp = cur;
    inp.value = x.name;
    if (kindOf(inp) === 'product') {
      const row = inp.closest('.item-row');
      const u = row && row.querySelector('.row-unit');
      if (u && x.unit && [...u.options].some(o => o.value === x.unit)) u.value = x.unit;
      // Fiyat boşsa bu ürünün son fiyatını yaz: satış formunda son satış, alış formunda son alış fiyatı
      const pr = row && row.querySelector('.row-price');
      const p = pr && !pr.value && lastPrice(x.name, row.closest('#sale-items-container') ? sales : purchases);
      if (p) { pr.value = p; pr.dispatchEvent(new Event('input', { bubbles: true })); }
      hide();
      inp.dispatchEvent(new Event('input', { bubbles: true })); // birim otomatik seçilsin (fire penceresi dahil)
      const q = row && row.querySelector('.row-qty'); if (q) q.focus();
    } else hide();
  });
})();
// ================= DETAYLI TABLOLAR =================
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const fk = x => String(x).toLocaleLowerCase('tr-TR').trim();
const colr = n => `<span class="font-bold ${n >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${n >= 0 ? '' : '-'}${formatMoney(Math.abs(n))}</span>`;
function tbl(head, rows, foot) {
  return `<div class="overflow-x-auto"><table class="w-full text-[11px] border-collapse"><thead><tr class="text-[10px] uppercase text-slate-400 border-b border-slate-300 text-left">${head.map((h, i) => `<th class="py-1.5 pr-2 whitespace-nowrap ${i ? 'text-right' : ''}">${h}</th>`).join('')}</tr></thead><tbody>`
    + (rows.map(r => `<tr class="border-b border-slate-100">${r.map((c, i) => `<td class="py-1.5 pr-2 ${i ? 'text-right whitespace-nowrap' : 'break-words'}">${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" class="py-4 text-center text-slate-400">Kayıt yok</td></tr>`)
    + `</tbody>${foot ? `<tfoot><tr class="font-bold border-t-2 border-slate-700">${foot.map((c, i) => `<td class="py-2 pr-2 ${i ? 'text-right whitespace-nowrap' : ''}">${c}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
}
function periodLabel() {
  const a = document.getElementById('filter-start').value, b = document.getElementById('filter-end').value;
  if (a || b) return `${a ? formatDate(a) : '...'} - ${b ? formatDate(b) : '...'}`;
  return { today: 'Bugün', week: 'Bu hafta', month: 'Bu ay', all: 'Tüm zamanlar' }[currentFilterMode];
}
function buildMonthly() {
  const mo = {}, M = k => mo[k] || (mo[k] = { s: 0, p: 0, g: 0, t: 0 });
  sales.forEach(r => { M(r.date.slice(0, 7)).s += r.total; r.payments.forEach(p => { M(p.date.slice(0, 7)).t += p.amount; }); });
  purchases.forEach(r => { M(r.date.slice(0, 7)).p += r.total; });
  expenses.forEach(e => expEntries(e).forEach(x => { M(x.date.slice(0, 7)).g += x.amount; }));
  const keys = Object.keys(mo).sort().reverse(), T = { s: 0, p: 0, g: 0, t: 0 };
  const rows = keys.map(k => {
    const o = mo[k]; ['s', 'p', 'g', 't'].forEach(f => { T[f] += o[f]; });
    return [`${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`, formatMoney(o.s), formatMoney(o.p), formatMoney(o.g), colr(o.s - o.p - o.g), formatMoney(o.t)];
  });
  return tbl(['Ay', 'Satış', 'Alış', 'Gider', 'Net Kâr', 'Tahsilat'], rows, ['Toplam', formatMoney(T.s), formatMoney(T.p), formatMoney(T.g), colr(T.s - T.p - T.g), formatMoney(T.t)]);
}
function buildProducts() {
  const pr = {}, P = (n, u) => pr[fk(n) + '|' + u] || (pr[fk(n) + '|' + u] = { name: n.trim(), unit: u, sq: 0, st: 0, bq: 0, bt: 0 });
  const it = i => i.total || round2(i.qty * i.price);
  sales.filter(r => dateFilterPass(r.date)).forEach(r => r.items.forEach(i => { const o = P(i.prod, i.unit); o.sq += i.qty; o.st += it(i); }));
  purchases.filter(r => dateFilterPass(r.date)).forEach(r => r.items.forEach(i => { const o = P(i.prod, i.unit); o.bq += i.qty; o.bt += it(i); }));
  const list = Object.values(pr).sort((a, b) => b.st - a.st);
  let ts = 0, tk = 0;
  const rows = list.map(o => {
    const kar = o.sq && o.bq ? round2(o.sq * (o.st / o.sq - o.bt / o.bq)) : null;
    ts += o.st; if (kar !== null) tk += kar;
    return [esc(o.name) + ` <span class="text-slate-400">(${esc(o.unit)})</span>`, o.sq ? round2(o.sq) : '-', o.sq ? formatMoney(o.st / o.sq) : '-', o.sq ? formatMoney(o.st) : '-', o.bq ? round2(o.bq) : '-', o.bq ? formatMoney(o.bt / o.bq) : '-', kar === null ? '-' : colr(kar)];
  });
  return tbl(['Ürün', 'Satılan', 'Ort. Satış', 'Satış Tutarı', 'Alınan', 'Ort. Alış', 'Tah. Kâr'], rows, ['Toplam', '', '', formatMoney(ts), '', '', colr(tk)]);
}
function buildParties(list, key, kind) {
  const m = {};
  list.filter(r => dateFilterPass(r.date)).forEach(r => { const o = m[fk(r[key])] || (m[fk(r[key])] = { name: r[key].trim(), n: 0, t: 0, p: 0 }); o.n++; o.t += r.total; o.p += r.paid || 0; });
  const arr = Object.values(m).sort((a, b) => b.t - a.t); let T = 0, Pd = 0, K = 0;
  const rows = arr.map(o => {
    const rem = Math.max(0, round2(o.t - o.p)); T += o.t; Pd += o.p; K += rem;
    const idx = partyNames[kind].findIndex(n => fk(n) === fk(o.name));
    return [idx >= 0 ? `<button onclick="openStatement('${kind}',${idx})" class="text-left text-indigo-700 underline">${esc(o.name)}</button>` : esc(o.name), o.n, formatMoney(o.t), formatMoney(o.p), `<b class="${rem > 0.005 ? 'text-rose-600' : 'text-slate-400'}">${formatMoney(rem)}</b>`];
  });
  const c = kind === 'customer';
  return tbl([c ? 'Müşteri' : 'Tedarikçi', 'Adet', c ? 'Satış' : 'Alış', c ? 'Tahsilat' : 'Ödenen', 'Kalan'], rows, ['Toplam', arr.reduce((a, o) => a + o.n, 0), formatMoney(T), formatMoney(Pd), formatMoney(K)]);
}
// Tüm hareketler: ekranda ve CSV'de aynı kaynak
function buildMoves() {
  const r = [], add = (date, type, who, o) => { if (dateFilterPass(date)) r.push({ date, type, who, prod: '', qty: '', unit: '', price: '', amt: 0, method: '', note: '', ...o }); };
  sales.forEach(x => { x.items.forEach(i => add(x.date, 'Satış', x.customer, { prod: i.prod, qty: i.qty, unit: i.unit, price: i.price, amt: i.total || round2(i.qty * i.price) })); x.payments.forEach(p => add(p.date, 'Tahsilat', x.customer, { amt: p.amount, note: p.note })); });
  purchases.forEach(x => { x.items.forEach(i => add(x.date, 'Alış', x.supplier, { prod: i.prod, qty: i.qty, unit: i.unit, price: i.price, amt: i.total || round2(i.qty * i.price) })); x.payments.forEach(p => add(p.date, 'Ödeme', x.supplier, { amt: p.amount, note: p.note })); });
  expenses.forEach(e => add(e.date, 'Gider', e.category, { amt: e.amount, method: e.method === 'card' ? 'Kart: ' + cardName(e.cardId) : 'Nakit', note: [e.desc, e.inst > 1 ? e.inst + ' taksit' : ''].filter(Boolean).join(' - ') }));
  cardPays.forEach(p => add(p.date, 'Kart Ödemesi', cardName(p.cardId), { amt: p.amount, note: p.note }));
  cashMoves.forEach(m => add(m.date, m.amount >= 0 ? 'Kasa Girişi' : 'Kasa Çıkışı', m.note || '', { amt: Math.abs(m.amount) }));
  return r.sort((a, b) => b.date.localeCompare(a.date));
}
// Son 6 ayın satışı ve maliyeti (alış + gider), yan yana çubuk; aya dokununca ayrıntı.
function monthTotals() {
  const mo = {}, M = k => mo[k] || (mo[k] = { s: 0, c: 0 });
  sales.forEach(r => { M(r.date.slice(0, 7)).s += r.total; });
  purchases.forEach(r => { M(r.date.slice(0, 7)).c += r.total; });
  expenses.forEach(e => expEntries(e).forEach(x => { M(x.date.slice(0, 7)).c += x.amount; }));
  const t = getTodayString(), y = +t.slice(0, 4), m = +t.slice(5, 7), out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1), k = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    out.push({ k, label: MONTHS[d.getMonth()].slice(0, 3), s: round2((mo[k] || {}).s || 0), c: round2((mo[k] || {}).c || 0) });
  }
  return out;
}
const shortMoney = v => v >= 1e6 ? round2(v / 1e6) + ' mn' : v >= 1e3 ? Math.round(v / 1e3) + ' bin' : String(Math.round(v));
function buildChart() {
  const data = monthTotals(), W = 360, H = 170, L = 38, B = 22, T = 8;
  const max = Math.max(1, ...data.map(d => Math.max(d.s, d.c)));
  const step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / step) * step; // yuvarlak üst sınır
  const yy = v => T + (H - T - B) * (1 - v / top), gw = (W - L) / data.length, bw = Math.min(16, gw / 3);
  let g = '';
  [0, 0.5, 1].forEach(f => { const v = top * f; g += `<line x1="${L}" x2="${W}" y1="${yy(v)}" y2="${yy(v)}" stroke="#e2e8f0" stroke-width="1"/><text x="${L - 4}" y="${yy(v) + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${shortMoney(v)}</text>`; });
  data.forEach((d, i) => {
    const cx = L + gw * i + gw / 2;
    const bar = (v, x, col) => v > 0 ? `<rect x="${x}" y="${yy(v)}" width="${bw}" height="${Math.max(1, yy(0) - yy(v))}" rx="3" fill="${col}"/>` : '';
    g += bar(d.s, cx - bw - 1, '#059669') + bar(d.c, cx + 1, '#d97706')
      + `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#64748b">${d.label}</text>`
      + `<rect x="${cx - gw / 2}" y="0" width="${gw}" height="${H}" fill="transparent" style="cursor:pointer" onclick="chartTip(${i})" onmouseenter="chartTip(${i})"/>`;
  });
  window.__chartData = data;
  return `<div class="flex gap-3 text-[11px] text-slate-600 mb-1"><span class="flex items-center gap-1"><i class="inline-block w-2.5 h-2.5 rounded-sm" style="background:#059669"></i>Satış</span><span class="flex items-center gap-1"><i class="inline-block w-2.5 h-2.5 rounded-sm" style="background:#d97706"></i>Alış + Gider</span></div>`
    + `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Son 6 ay satış ve maliyet grafiği">${g}</svg>`
    + `<div id="chart-tip" class="text-[11px] text-slate-700 bg-slate-50 rounded-xl px-2.5 py-1.5 mt-1"></div>`;
}
function chartTip(i) {
  const d = (window.__chartData || [])[i], el = document.getElementById('chart-tip'); if (!d || !el) return;
  const k = round2(d.s - d.c);
  el.innerHTML = `<b>${MONTHS[+d.k.slice(5, 7) - 1]} ${d.k.slice(0, 4)}</b> · Satış ${formatMoney(d.s)} · Alış+Gider ${formatMoney(d.c)} · Net kâr <b>${(k >= 0 ? '+' : '−') + formatMoney(Math.abs(k))}</b>`;
}
function renderTables() {
  document.getElementById('chart-monthly').innerHTML = buildChart();
  chartTip(Math.max(0, window.__chartData.map(d => d.s + d.c > 0).lastIndexOf(true))); // verisi olan son ay
  document.getElementById('tbl-period').textContent = periodLabel();
  document.getElementById('tbl-monthly').innerHTML = buildMonthly();
  renderStock();
  document.getElementById('tbl-products').innerHTML = buildProducts();
  document.getElementById('tbl-customers').innerHTML = buildParties(sales, 'customer', 'customer');
  document.getElementById('tbl-suppliers').innerHTML = buildParties(purchases, 'supplier', 'supplier');
  const mv = buildMoves();
  document.getElementById('tbl-moves').innerHTML = tbl(['Tarih', 'Tür', 'Cari / Açıklama', 'Tutar'],
    mv.slice(0, 60).map(x => [formatDate(x.date), esc(x.type), esc(x.who) + (x.prod ? ` <span class="text-slate-400">${esc(x.prod)} ${esc(x.qty)} ${esc(x.unit)} × ${formatMoney(x.price)}</span>` : ''), formatMoney(x.amt)]), null)
    + `<p class="text-[10px] text-slate-400 mt-2">${mv.length} hareket${mv.length > 60 ? ' (ekranda ilk 60 gösteriliyor, tamamı Excel dosyasında)' : ''}.</p>`;
}
function movesCsv() {
  const q = v => { v = String(v == null ? '' : v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const n = v => v === '' ? '' : String(v).replace('.', ',');
  const head = ['Tarih', 'Tür', 'Cari / Kategori', 'Ürün', 'Miktar', 'Birim', 'Birim Fiyat', 'Tutar', 'Ödeme Şekli', 'Açıklama'];
  return '\uFEFF' + [head.map(q).join(';')].concat(buildMoves().map(x => [formatDate(x.date), x.type, x.who, x.prod, n(x.qty), x.unit, n(x.price), n(x.amt), x.method, x.note].map(q).join(';'))).join('\r\n');
}
function exportMovesCsv() {
  const blob = new Blob([movesCsv()], { type: 'text/csv;charset=utf-8' }), name = `hareketler_${getTodayString()}.csv`;
  const file = new File([blob], name, { type: 'text/csv' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'Hareketler' }).catch(() => {});
  else { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
}

// Firebase köprüsü: mevcut hesaplama ve kayıt işlevleri değiştirilmeden veri erişimi açılır.
window.__ktGetData = function () {
  return { schemaVersion: 1, sales, purchases, expenses, cards, cardPays, cashMoves, wastes, biz: getBiz(), phones: getPhones() };
};
window.__ktApplyData = function (d) {
  if (!d || typeof d !== 'object') throw new Error('Bulut verisi geçersiz.');
  sales = normList(d.sales, normSale);
  purchases = normList(d.purchases, normPurchase);
  expenses = normList(d.expenses, normExpense);
  cards = normList(d.cards, normCard);
  cardPays = normList(d.cardPays, normCardPay);
  cashMoves = normList(d.cashMoves, normMove);
  wastes = normList(d.wastes, normWaste);
  try {
    localStorage.setItem('tp_sales', JSON.stringify(sales));
    localStorage.setItem('tp_purchases', JSON.stringify(purchases));
    localStorage.setItem('tp_expenses', JSON.stringify(expenses));
    localStorage.setItem('tp_cards', JSON.stringify(cards));
    localStorage.setItem('tp_cardpay', JSON.stringify(cardPays));
    localStorage.setItem('tp_cash', JSON.stringify(cashMoves));
    localStorage.setItem('tp_wastes', JSON.stringify(wastes));
    if (typeof d.biz === 'string') localStorage.setItem('tp_biz', d.biz);
    if (d.phones && typeof d.phones === 'object') localStorage.setItem('tp_phones', JSON.stringify(d.phones));
  } catch (e) { throw new Error('Bulut verisi alındı fakat bu cihaza kaydedilemedi: ' + e.message); }
  const bizInput = document.getElementById('stmt-biz'); if (bizInput && typeof d.biz === 'string') bizInput.value = d.biz;
  applyFilters(); renderCash(); renderStatement(); updateBackupBanner();
};
