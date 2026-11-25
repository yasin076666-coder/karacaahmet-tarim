// ================= KARTLAR & CARİ EKSTRE =================
let expMethod = 'cash', editingCard = null, cardPayId = null, stmtCtx = null, stmtRowsCur = [];
const partyNames = { customer: [], supplier: [] };
const STMT_L = { customer: ['Satış', 'Tahsilat', 'Kalan Alacak'], supplier: ['Alış', 'Ödeme', 'Kalan Borç'], card: ['Harcama', 'Ödeme', 'Kart Borcu'] };

function cardName(id) { const c = cards.find(x => x.id === id); return c ? c.name : 'Silinmiş kart'; }
function cardCharges(id, future) {
  const t = getTodayString();
  return round2(expenses.filter(e => e.method === 'card' && e.cardId === id)
    .reduce((a, e) => a + expEntries(e).filter(x => future ? x.date > t : x.date <= t).reduce((b, x) => b + x.amount, 0), 0));
}
function cardBal(id) {
  return round2(cardCharges(id, false) - cardPays.filter(p => p.cardId === id).reduce((a, p) => a + p.amount, 0));
}
function nextDue(c) {
  const t = new Date(), t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const mk = (y, m) => new Date(y, m, Math.min(c.dueDay, new Date(y, m + 1, 0).getDate()));
  let d = mk(t.getFullYear(), t.getMonth());
  if (d < t0) d = mk(t.getFullYear(), t.getMonth() + 1);
  return { date: d, days: Math.round((d - t0) / 86400000) };
}
function setExpMethod(m) {
  expMethod = m;
  document.getElementById('exp-card-wrap').classList.toggle('hidden', m !== 'card');
  ['cash', 'card'].forEach(k => {
    const b = document.getElementById('exp-m-' + k), on = k === m;
    b.classList.toggle('bg-white', on); b.classList.toggle('shadow-sm', on);
    b.classList.toggle('text-slate-900', on); b.classList.toggle('text-slate-600', !on);
  });
}
function fillCardSelect(sel) {
  const el = document.getElementById('expense-card');
  el.innerHTML = cards.length ? cards.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')
    : '<option value="">Kart yok - "+ Kart" ile ekleyin</option>';
  if (sel) el.value = sel;
}
function openCardModal(id) {
  editingCard = id || null;
  const c = cards.find(x => x.id === id);
  document.getElementById('card-name').value = c ? c.name : '';
  document.getElementById('card-due').value = c ? c.dueDay : '';
  document.getElementById('card-modal-title').textContent = c ? 'Kartı Düzenle' : 'Yeni Kart Ekle';
  document.getElementById('card-modal').style.display = 'flex';
}
function saveCard() {
  const name = document.getElementById('card-name').value.trim();
  const due = Math.round(parseFloat(document.getElementById('card-due').value));
  if (!name) return alert('Kart adını girin.');
  if (!(due >= 1 && due <= 31)) return alert('Son ödeme gününü 1-31 arası girin.');
  const cur = document.getElementById('expense-card').value;
  let id = editingCard;
  if (id) { const c = cards.find(x => x.id === id); c.name = name; c.dueDay = due; fillCardSelect(cur); }
  else { id = newId('C'); cards.push({ id, name, dueDay: due }); fillCardSelect(id); }
  saveAll(); closeModal('card-modal'); applyFilters();
}
function deleteCard(id) {
  if (expenses.some(e => e.cardId === id) || cardPays.some(p => p.cardId === id)) return alert('Hareketi olan kart silinemez.');
  if (!confirm('Kart silinsin mi?')) return;
  cards = cards.filter(c => c.id !== id); saveAll(); applyFilters();
}
function openCardPay(id) {
  cardPayId = id;
  document.getElementById('cp-name').textContent = cardName(id);
  document.getElementById('cp-debt').textContent = formatMoney(cardBal(id));
  document.getElementById('cp-amount').value = Math.max(0, cardBal(id)) || '';
  document.getElementById('cp-date').value = getTodayString();
  document.getElementById('cardpay-modal').style.display = 'flex';
}
function saveCardPay() {
  const amt = parseFloat(document.getElementById('cp-amount').value);
  if (!(amt > 0)) return alert('Geçerli bir tutar girin.');
  cardPays.push({ id: newId('CP'), cardId: cardPayId, date: validDate(document.getElementById('cp-date').value), amount: round2(amt), note: '' });
  saveAll(); closeModal('cardpay-modal'); applyFilters();
}

function renderExtras(fExp, fSal, fPur) {
  const q = document.getElementById('filter-search').value.trim().toLowerCase();
  const ent = [];
  expenses.forEach(e => {
    if (q && !(e.category.toLowerCase().includes(q) || (e.desc || '').toLowerCase().includes(q))) return;
    expEntries(e).forEach(x => { if (dateFilterPass(x.date)) ent.push({ e, amount: x.amount }); });
  });
  const expTotal = ent.reduce((a, x) => a + x.amount, 0);
  // Net kâr tek yerde: taksitli giderler + kesinti (tahsilat tarihine göre) + hediye maliyeti (satış tarihine göre)
  const disc = round2(sales.flatMap(discountsOf).filter(x => dateFilterPass(x.date)).reduce((a, x) => a + x.amount, 0));
  const gifts = round2(fSal.reduce((a, s) => a + giftCost(s), 0));
  const net = round2(fSal.reduce((a, x) => a + x.total, 0) - fPur.reduce((a, x) => a + x.total, 0) - expTotal - disc - gifts);
  document.getElementById('stat-expenses').textContent = formatMoney(expTotal);
  document.getElementById('stat-discounts').textContent = formatMoney(disc);
  document.getElementById('stat-gifts').textContent = formatMoney(gifts);
  document.getElementById('stat-net-profit').textContent = (net >= 0 ? '+' : '') + formatMoney(net);
  document.getElementById('stat-net-profit').className = `text-lg font-bold ${net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`;
  document.getElementById('stat-card-debt').textContent = formatMoney(cards.reduce((a, c) => a + Math.max(0, cardBal(c.id)), 0));
  const due = [];
  document.getElementById('cards-list').innerHTML = cards.length ? cards.map(c => {
    const bal = cardBal(c.id), fut = cardCharges(c.id, true), nd = nextDue(c), warn = bal > 0.005 && nd.days <= 3, cid = esc(c.id);
    if (warn) due.push(`${esc(c.name)}: ${nd.days === 0 ? 'bugün son ödeme günü' : nd.days + ' gün kaldı'} (${formatMoney(bal)})`);
    return `<div class="bg-white p-3.5 rounded-2xl border ${warn ? 'border-amber-300' : 'border-slate-200'} shadow-sm space-y-2">
      <div class="flex justify-between items-start gap-2">
        <div><h4 class="font-bold text-sm text-slate-800 break-words">💳 ${esc(c.name)}</h4>
          <p class="text-[11px] ${warn ? 'text-amber-700 font-semibold' : 'text-slate-500'}">Son ödeme: ayın ${c.dueDay}. günü · ${nd.days === 0 ? 'bugün' : nd.days + ' gün kaldı'}</p>
          ${fut > 0.005 ? `<p class="text-[11px] text-violet-700">Bekleyen taksitler: <b>${formatMoney(fut)}</b></p>` : ''}</div>
        <div class="text-right shrink-0"><span class="text-[10px] text-slate-400 block">Güncel Borç</span>
          <span class="text-base font-bold ${bal > 0.005 ? 'text-violet-700' : 'text-slate-400'}">${formatMoney(bal)}</span></div>
      </div>
      <div class="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
        <div class="flex gap-1">
          <button onclick="openStatement('card','${cid}')" class="px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-700">Ekstre</button>
          <button onclick="openCardModal('${cid}')" class="text-slate-300 hover:text-indigo-500 px-2"><i class="fa-regular fa-pen-to-square"></i> ✎</button>
          <button onclick="deleteCard('${cid}')" class="text-slate-300 hover:text-rose-500 px-1"><i class="fa-regular fa-trash-can"></i> 🗑</button>
        </div>
        <button onclick="openCardPay('${cid}')" class="px-3 py-1 rounded-lg font-bold bg-violet-100 text-violet-800">+ Borç Öde</button>
      </div></div>`;
  }).join('') : '<div class="bg-white p-8 rounded-2xl text-center text-slate-400 text-xs border border-slate-200">Henüz kart eklenmedi. "+ Kart Ekle" ile başlayın.</div>';
  const bn = document.getElementById('card-banner');
  bn.innerHTML = due.length ? '💳 <b>Kart ödeme günü yaklaşıyor:</b><br>' + due.join('<br>') : '';
  bn.classList.toggle('hidden', !due.length);

  const agg = (list, key, kind) => {
    const m = {};
    list.forEach(r => {
      const k = r[key].trim().toLowerCase(); const o = m[k] || (m[k] = { name: r[key].trim(), tot: 0, paid: 0, old: '' });
      o.tot += r.total; o.paid += r.paid || 0;
      if (r.total - (r.paid || 0) > 0.005 && (!o.old || r.date < o.old)) o.old = r.date; // en eski ödenmemiş kayıt
    });
    const arr = Object.values(m).sort((a, b) => (b.tot - b.paid) - (a.tot - a.paid));
    partyNames[kind] = arr.map(x => x.name);
    return arr.map((x, i) => `<button onclick="openStatement('${kind}',${i})" class="w-full flex justify-between items-center py-1.5 border-b border-slate-50 text-left gap-2"><span class="font-medium text-slate-700 break-words">${esc(x.name)}${x.old && x.tot - x.paid > 0.005 ? ageBadge(daysSince(x.old)) : ''}</span><span class="font-bold ${x.tot - x.paid > 0.005 ? 'text-indigo-600' : 'text-slate-400'}">${formatMoney(x.tot - x.paid)}</span></button>`).join('') || '<span class="text-slate-400">Kayıt yok</span>';
  };
  document.getElementById('all-customers').innerHTML = agg(sales, 'customer', 'customer');
  document.getElementById('all-suppliers').innerHTML = agg(purchases, 'supplier', 'supplier');

  const cats = {};
  ent.forEach(x => { cats[x.e.category] = (cats[x.e.category] || 0) + x.amount; });
  const cash = ent.filter(x => x.e.method !== 'card').reduce((a, x) => a + x.amount, 0), card = expTotal - cash;
  document.getElementById('expense-category-badges').innerHTML =
    (Object.keys(cats).map(k => `<span class="bg-rose-50 border border-rose-100 text-rose-800 px-2 py-1 rounded-lg font-medium text-[11px]">${esc(k)}: <strong>${formatMoney(cats[k])}</strong></span>`).join('') || '<span class="text-slate-400 text-xs">Kayıtlı gider yok</span>')
    + `<span class="w-full text-[11px] text-slate-500 mt-1">💵 Nakit: <b>${formatMoney(cash)}</b> · 💳 Kart: <b>${formatMoney(card)}</b></span>`;
}
const _render = render;
render = function (a, b, c) { _render(a, b, c); renderExtras(c, a, b); renderCash(); renderTables(); };

function stmtAllRows(kind, ref) {
  const rows = [];
  if (kind === 'card') {
    expenses.filter(e => e.method === 'card' && e.cardId === ref).forEach(e => {
      const en = expEntries(e);
      en.forEach((x, k) => { if (x.date <= getTodayString()) rows.push({ date: x.date, desc: e.category + (e.desc ? ' - ' + e.desc : '') + (en.length > 1 ? ` (${k + 1}/${en.length}. taksit)` : ''), inc: x.amount, dec: 0 }); });
    });
    cardPays.filter(p => p.cardId === ref).forEach(p => rows.push({ date: p.date, desc: 'Kart ödemesi', inc: 0, dec: p.amount, del: ['cp', p.id] }));
  } else {
    const isC = kind === 'customer', key = (partyNames[kind][ref] || '').toLowerCase();
    (isC ? sales : purchases).filter(r => (isC ? r.customer : r.supplier).trim().toLowerCase() === key).forEach(r => {
      rows.push({ date: r.date, desc: r.items.map(itemLabel).join(', '), items: r.items, inc: r.total, dec: 0, paid: r.paid || 0, rem: Math.max(0, round2(r.total - (r.paid || 0))), st: (r.paid || 0) >= r.total - 0.005 ? 'paid' : (r.paid || 0) > 0.005 ? 'part' : 'open' });
      r.payments.forEach(p => rows.push(p.kind === 'kesinti'
        ? { date: p.date, desc: p.note || 'Kesinti', label: 'Kesinti', inc: 0, dec: p.amount, del: [kind, r.id, p.id] }
        : { date: p.date, desc: (isC ? 'Tahsilat' : 'Ödeme') + (p.note ? ' (' + p.note + ')' : ''), inc: 0, dec: p.amount, del: [kind, r.id, p.id] }));
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || ((b.inc > 0) - (a.inc > 0)));
}
function openStatement(kind, ref) {
  stmtCtx = { kind, ref };
  stmtFilter = 'all';
  document.getElementById('stmt-biz').value = getBiz();
  document.getElementById('stmt-contact').style.display = kind === 'customer' ? 'flex' : 'none';
  if (kind === 'customer') document.getElementById('stmt-phone').value = getPhones()[fk(partyNames.customer[ref] || '')] || '';
  document.getElementById('stmt-start').value = '';
  document.getElementById('stmt-end').value = '';
  renderStatement();
  document.getElementById('stmt-modal').style.display = 'flex';
}
function stmtData() {
  // Bulut verisi yüklenirken cari ekstre henüz seçili olmayabilir.
  // Boş bağlamda destructuring hatası yerine çağırana güvenli sonuç ver.
  if (!stmtCtx || !stmtCtx.kind || !STMT_L[stmtCtx.kind]) return null;
  const { kind, ref } = stmtCtx, L = STMT_L[kind];
  const st = document.getElementById('stmt-start').value, en = document.getElementById('stmt-end').value;
  const all = stmtAllRows(kind, ref);
  let bal = round2(all.filter(r => st && r.date < st).reduce((a, r) => a + r.inc - r.dec, 0));
  const opening = bal;
  const rows = all.filter(r => (!st || r.date >= st) && (!en || r.date <= en)).map(r => { bal = round2(bal + r.inc - r.dec); return { ...r, bal }; });
  const title = kind === 'card' ? cardName(ref) : (partyNames[kind][ref] || '');
  const base = { L, title, rows, opening, st, en, closing: bal, inc: round2(rows.reduce((a, r) => a + r.inc, 0)), dec: round2(rows.reduce((a, r) => a + r.dec, 0)), flabel: '', filtered: false };
  if (stmtFilter === 'all' || kind === 'card') return base;
  // Fatura bazlı görünüm: tahsil edilmiş / edilmemiş (kısmi ödemeler "edilmemiş" sayılır)
  const cu = kind === 'customer';
  const fr = all.filter(r => r.inc > 0 && r.st && (!st || r.date >= st) && (!en || r.date <= en) && (stmtFilter === 'open' ? r.st !== 'paid' : r.st === 'paid'))
    .map(r => ({ ...r, dec: 0, bal: r.rem }));
  return { ...base, rows: fr, filtered: true,
    flabel: stmtFilter === 'open' ? (cu ? 'Tahsil Edilmemiş' : 'Ödenmemiş') : (cu ? 'Tahsil Edilmiş' : 'Ödenmiş'),
    inc: round2(fr.reduce((a, r) => a + r.inc, 0)), dec: round2(fr.reduce((a, r) => a + r.paid, 0)), closing: round2(fr.reduce((a, r) => a + r.rem, 0)) };
}
// ===== PDF ekstre: tuvale çiz -> JPEG -> sayfa başına tek görselli PDF =====
function pdfFromJpegs(jpgs, w, h) {
  const PW = 595.28, PH = 841.89, enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n' + body + '\nendobj\n'); };
  const N = 2 + 3 * jpgs.length;
  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [' + jpgs.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ') + '] /Count ' + jpgs.length + ' >>');
  jpgs.forEach((jpg, i) => {
    const pg = 3 + 3 * i, ct = pg + 1, im = pg + 2, cs = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(ct, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    offs[im] = len;
    push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    push(jpg);
    push('\nendstream\nendobj\n');
  });
  const xr = len;
  let x = `xref\n0 ${N + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= N; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size ${N + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0;
  parts.forEach(b => { out.set(b, p); p += b.length; });
  return new Blob([out], { type: 'application/pdf' });
}

function buildStatementPdf() {
  if (!stmtCtx || !stmtCtx.kind || !STMT_L[stmtCtx.kind]) { alert('Önce bir cari veya kart ekstresi açın.'); return; }
  const d = stmtData(); if (!d) { alert('Ekstre verisi hazır değil. Lütfen ekstreyi yeniden açın.'); return; }
  const biz = getBiz() || 'Hesap Defterim', today = formatDate(getTodayString()), bal = d.closing;
  const kindLabel = { customer: 'MÜŞTERİ', supplier: 'TEDARİKÇİ', card: 'KART' }[stmtCtx.kind];
  const rng0 = (d.st || d.en) ? `${d.st ? formatDate(d.st) : '...'} - ${d.en ? formatDate(d.en) : '...'}` : 'Tüm zamanlar';
  const rng = rng0 + (d.flabel ? ' · ' + d.flabel : '');
  const sd = x => { const [y, m, dd] = x.split('-'); return `${dd}.${m}.${y.slice(2)}`; };
  const W = 1240, H = 1754, M = 60, pages = [];
  const FF = '-apple-system, "Helvetica Neue", Arial, sans-serif', F = (w, sz) => `${w} ${sz}px ${FF}`;
  const dateX = M, descX = M + 150, amtR = W - M - 230, balR = W - M, descMax = amtR - 200 - descX;
  let c, g, y;
  const rr = (x, yy, w, h, r, fill) => { g.fillStyle = fill; g.beginPath(); if (g.roundRect) g.roundRect(x, yy, w, h, r); else g.rect(x, yy, w, h); g.fill(); };
  const tx = (s, x, yy, font, col, al) => { g.font = font; g.fillStyle = col; g.textAlign = al || 'left'; g.fillText(s, x, yy); };
  const wrap = (str, firstW, maxW) => {
    const lines = []; let line = '', w = firstW;
    String(str).split(/\s+/).forEach(word => {
      const t = line ? line + ' ' + word : word;
      if (!line || g.measureText(t).width <= w) line = t; else { lines.push(line); line = word; w = maxW; }
    });
    lines.push(line); return lines;
  };
  const newPage = () => { c = document.createElement('canvas'); c.width = W; c.height = H; g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); pages.push(c); y = M; };
  const head = () => {
    const f = F('bold', 15);
    tx('TARİH', dateX, y + 24, f, '#94a3b8'); tx('AÇIKLAMA', descX, y + 24, f, '#94a3b8');
    tx('TUTAR', amtR, y + 24, f, '#94a3b8', 'right'); tx(d.filtered ? 'KALAN' : 'BAKİYE', balR, y + 24, f, '#94a3b8', 'right');
    y += 38; g.fillStyle = '#cbd5e1'; g.fillRect(M, y, W - 2 * M, 2); y += 6;
  };

  newPage();
  // Başlık bandı + logo
  rr(M, y, W - 2 * M, 150, 26, '#0f172a');
  rr(M + 24, y + 14, 300, 122, 20, '#fff');
  const li = document.getElementById('app-logo');
  if (li && li.naturalWidth) {
    const sc = Math.min(276 / li.naturalWidth, 98 / li.naturalHeight), lw = li.naturalWidth * sc, lh = li.naturalHeight * sc;
    g.drawImage(li, M + 24 + 150 - lw / 2, y + 14 + 61 - lh / 2, lw, lh);
  }
  if (getBiz()) {
    tx(biz, M + 360, y + 70, F('bold', 34), '#fff');
    tx('CARİ HESAP EKSTRESİ', M + 360, y + 108, F('bold', 18), '#6ee7b7');
  } else tx('CARİ HESAP EKSTRESİ', M + 360, y + 86, F('bold', 24), '#6ee7b7');
  tx('Tarih: ' + today, W - M - 30, y + 70, F('normal', 20), '#cbd5e1', 'right');
  tx('Dönem: ' + rng, W - M - 30, y + 106, F('normal', 20), '#cbd5e1', 'right');
  y += 150 + 36;
  // Hesap
  tx(kindLabel, M, y + 16, F('bold', 16), '#94a3b8'); y += 52;
  g.font = F('bold', 36);
  wrap(d.title, W - 2 * M, W - 2 * M).forEach(l => { tx(l, M, y, F('bold', 36), '#0f172a'); y += 46; });
  y += 20;
  // Özet kutuları
  const bw = (W - 2 * M - 40) / 3, boxes = [
    ['Toplam ' + d.L[0], formatMoney(d.inc), '#f1f5f9', '#64748b', '#0f172a'],
    ['Toplam ' + d.L[1], formatMoney(d.dec), '#ecfdf5', '#059669', '#047857'],
    [d.L[2], formatMoney(bal), '#0f172a', '#94a3b8', bal > 0.005 ? '#fcd34d' : '#6ee7b7']];
  boxes.forEach((b, i) => {
    const x = M + i * (bw + 20);
    rr(x, y, bw, 120, 20, b[2]); tx(b[0], x + 24, y + 42, F('normal', 18), b[3]); tx(b[1], x + 24, y + 90, F('bold', 32), b[4]);
  });
  y += 120 + 44;
  head();
  // Satırlar
  const rows = d.st && !d.filtered ? [{ opening: true }].concat(d.rows) : d.rows;
  rows.forEach((r, i) => {
    g.font = F('normal', 22);
    let lines, pill = '', pw = 0;
    if (r.opening) lines = ['Devir bakiye'];
    else { pill = r.label || (r.inc ? d.L[0] : d.L[1]); g.font = F('bold', 15); pw = g.measureText(pill).width + 22; g.font = F('normal', 22); lines = wrap(r.desc, descMax - pw - 10, descMax); }
    let its = null;
    if (r.items && r.items.length) {
      const iw = descMax - 170; let first = true;
      its = r.items.map(it => {
        const ls = wrap(it.gift ? `${it.prod}  ${it.qty} ${it.unit} (hediye)` : `${it.prod}  ${it.qty} ${it.unit} × ${formatMoney(it.price)}`, first ? iw - pw - 10 : iw, iw);
        first = false; return { ls, total: it.total || round2(it.qty * it.price) };
      });
      lines = its.flatMap(x => x.ls);
    }
    const sl = r.opening ? null : stLine(r);
    const rh = lines.length * 30 + (sl ? 30 : 0) + 22;
    if (y + rh > H - 140) { newPage(); head(); }
    if (i % 2) { g.fillStyle = '#f8fafc'; g.fillRect(M, y, W - 2 * M, rh); }
    const by = y + 29;
    tx(sd(r.opening ? d.st : r.date), dateX, by, F('normal', 22), '#64748b');
    if (pill) { rr(descX, y + 8, pw, 28, 8, r.inc ? '#e2e8f0' : '#d1fae5'); tx(pill, descX + 11, by - 3, F('bold', 15), r.inc ? '#334155' : '#047857'); }
    if (its) {
      let ln = 0;
      its.forEach(x => {
        x.ls.forEach((l, k) => tx(l, (ln + k) ? descX : descX + pw + 10, by + (ln + k) * 30, F('normal', 22), '#1e293b'));
        tx(formatMoney(x.total), descX + descMax, by + ln * 30, F('bold', 21), '#475569', 'right');
        ln += x.ls.length;
      });
    } else lines.forEach((l, k) => tx(l, k ? descX : descX + (pill ? pw + 10 : 0), by + k * 30, F(r.opening ? 'italic' : 'normal', 22), '#1e293b'));
    if (sl) tx(sl.txt, descX, by + lines.length * 30, F('bold', 20), sl.hex);
    if (!r.opening) tx(r.inc ? formatMoney(r.inc) : '-' + formatMoney(r.dec), amtR, by, F('bold', 22), r.inc ? '#0f172a' : '#059669', 'right');
    tx(formatMoney(r.opening ? d.opening : r.bal), balR, by, F('bold', 22), '#334155', 'right');
    g.fillStyle = '#e2e8f0'; g.fillRect(M, y + rh - 1, W - 2 * M, 1);
    y += rh;
  });
  if (!rows.length) { tx('Bu aralıkta hareket yok.', W / 2, y + 60, F('normal', 22), '#94a3b8', 'center'); y += 100; }
  // Toplam + imza
  if (y > H - 420) newPage();
  y += 16; g.fillStyle = '#0f172a'; g.fillRect(M, y, W - 2 * M, 3); y += 48;
  tx(d.L[2] + (bal < -0.005 ? ' (fazla ödeme / avans)' : ''), M, y, F('bold', 26), '#0f172a');
  tx(formatMoney(bal), balR, y, F('bold', 30), '#0f172a', 'right'); y += 50;
  tx('Bu ekstre ' + today + ' tarihinde ' + biz + ' tarafından düzenlenmiştir.', M, y, F('normal', 17), '#94a3b8'); y += 150;
  [[M + 40, 'Düzenleyen'], [W - M - 400, 'Mutabakat / İmza']].forEach(([x, l]) => {
    g.fillStyle = '#94a3b8'; g.fillRect(x, y, 360, 2); tx(l, x + 180, y + 30, F('normal', 18), '#64748b', 'center');
  });
  pages.forEach((p, i) => {
    const q = p.getContext('2d'); q.font = F('normal', 16); q.fillStyle = '#94a3b8'; q.textAlign = 'right';
    q.fillText(`Sayfa ${i + 1} / ${pages.length}`, W - M, H - 40);
  });
  const jpgs = pages.map(p => Uint8Array.from(atob(p.toDataURL('image/jpeg', 0.92).split(',')[1]), ch => ch.charCodeAt(0)));
  return pdfFromJpegs(jpgs, W, H);
}
function sharePdf() {
  let blob;
  try { blob = buildStatementPdf(); } catch (e) { return alert('PDF oluşturulamadı.'); }
  const d = stmtData(); if (!d || !blob) return;
  const nm = d.title.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'cari';
  const name = `ekstre_${nm}_${getTodayString()}.pdf`;
  const file = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: d.title + ' - Cari Ekstre' }).catch(() => {});
  } else {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
let stmtFilter = 'all';
function setStmtFilter(f) { stmtFilter = f; renderStatement(); }
function updateFilterUi() {
  if (!stmtCtx) return;
  const card = stmtCtx.kind === 'card', cu = stmtCtx.kind === 'customer';
  document.getElementById('stmt-filter').classList.toggle('hidden', card);
  const lab = { all: 'Tümü', open: cu ? 'Tahsil Edilmemiş' : 'Ödenmemiş', paid: cu ? 'Tahsil Edilmiş' : 'Ödenmiş' };
  ['all', 'open', 'paid'].forEach(k => {
    const b = document.getElementById('sf-' + k); b.textContent = lab[k];
    b.className = 'py-1.5 rounded-lg ' + (k === stmtFilter ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600');
  });
}
function stLine(r) {
  if (!r.st || !stmtCtx) return null;
  const cu = stmtCtx.kind === 'customer';
  const t = { paid: cu ? 'Tahsil edildi' : 'Ödendi', part: cu ? 'Kısmi tahsilat' : 'Kısmi ödeme', open: cu ? 'Tahsil edilmedi' : 'Ödenmedi' }[r.st];
  const c = { paid: ['#059669', 'text-emerald-600'], part: ['#d97706', 'text-amber-600'], open: ['#e11d48', 'text-rose-600'] }[r.st];
  return { txt: r.st === 'paid' ? '✓ ' + t : r.st === 'part' ? `◐ ${t}: ${formatMoney(r.paid)} · Kalan: ${formatMoney(r.rem)}` : '○ ' + t, hex: c[0], cls: c[1] };
}
function itemsHtml(items) {
  return '<div class="mt-1 space-y-0.5">' + items.map(i => `<div class="flex justify-between gap-2"><span>${esc(i.prod)} <span class="text-slate-400">${esc(i.qty)} ${esc(i.unit)} ${i.gift ? '· hediye' : '× ' + formatMoney(i.price)}</span></span><span class="font-semibold text-slate-600 whitespace-nowrap">${formatMoney(i.total || round2(i.qty * i.price))}</span></div>`).join('') + '</div>';
}
const ageBadge = n => `<span class="ml-1 text-[10px] font-semibold ${n > 30 ? 'text-rose-600' : n > 14 ? 'text-amber-600' : 'text-slate-400'}">${n} gün</span>`;
function getPhones() { try { return JSON.parse(localStorage.getItem('tp_phones') || '{}') || {}; } catch (e) { return {}; } }
function savePhone() {
  const name = stmtCtx && partyNames.customer[stmtCtx.ref]; if (!name) return;
  const p = getPhones(), v = document.getElementById('stmt-phone').value.trim();
  if (v) p[fk(name)] = v; else delete p[fk(name)];
  try { localStorage.setItem('tp_phones', JSON.stringify(p)); } catch (e) {}
}
function remindWhatsApp() {
  const name = stmtCtx && partyNames.customer[stmtCtx.ref], num = waPhone(document.getElementById('stmt-phone').value);
  if (!name) return;
  if (!num) return alert('Geçerli bir cep telefonu girin (örn. 0532 123 45 67).');
  // Ekstre filtrelerinden bağımsız, tüm zamanların kalan bakiyesi
  const bal = round2(sales.filter(s => fk(s.customer) === fk(name)).reduce((a, s) => a + s.total - (s.paid || 0), 0));
  const msg = `Merhaba ${name}, ${getBiz() || 'Hesap Defterim'} olarak hatırlatmak isteriz: ${formatDate(getTodayString())} itibarıyla güncel bakiyeniz ${formatMoney(bal)}. İyi çalışmalar.`;
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank');
}
function getBiz() { try { return localStorage.getItem('tp_biz') || ''; } catch (e) { return ''; } }
function saveBiz() {
  try { localStorage.setItem('tp_biz', document.getElementById('stmt-biz').value.trim()); } catch (e) {}
  renderStatement();
}
function renderStatement() {
  // Bulut verisi yüklenirken cari ekstre seçili olmayabilir.
  // stmtData() stmtCtx içindeki kind/ref alanlarını açtığı için null durumda hata verir.
  if (!stmtCtx || !stmtCtx.kind || !STMT_L[stmtCtx.kind]) {
    stmtRowsCur = [];
    return;
  }
  const d = stmtData();
  if (!d) { stmtRowsCur = []; return; }
  stmtRowsCur = d.rows;
  updateFilterUi();
  const biz = getBiz() || 'Hesap Defterim', today = formatDate(getTodayString()), bal = d.closing;
  const kindLabel = { customer: 'Müşteri', supplier: 'Tedarikçi', card: 'Kart' }[stmtCtx.kind];
  const rng0 = (d.st || d.en) ? `${d.st ? formatDate(d.st) : '...'} - ${d.en ? formatDate(d.en) : '...'}` : 'Tüm zamanlar';
  const rng = rng0 + (d.flabel ? ' · ' + d.flabel : '');
  const sd = x => { const [y, m, dd] = x.split('-'); return `${dd}.${m}.${y.slice(2)}`; };
  const hs = document.getElementById('app-logo');
  const logo = hs ? `<img src="${hs.src}" alt="" class="h-14 bg-white rounded-lg px-1.5 py-0.5 shrink-0">` : '';
  const note = bal < -0.005 ? ' (fazla ödeme / avans)' : '';
  document.getElementById('stmt-title').textContent = 'Cari Ekstre';
  document.getElementById('stmt-body').innerHTML = `
  <div class="rounded-2xl border border-slate-200 overflow-hidden">
    <div class="bg-slate-900 text-white p-4 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">${logo}
        <div class="min-w-0">${getBiz() ? `<div class="font-bold text-sm break-words">${esc(getBiz())}</div>` : ''}
          <div class="text-[10px] tracking-widest text-emerald-300">CARİ HESAP EKSTRESİ</div></div></div>
      <div class="text-right text-[10px] text-slate-300 shrink-0"><div>Tarih: ${today}</div><div>Dönem: ${rng}</div></div>
    </div>
    <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
      <div class="text-[10px] uppercase font-bold text-slate-400">${kindLabel}</div>
      <div class="font-bold text-slate-800 break-words">${esc(d.title)}</div>
    </div>
    <div class="grid grid-cols-3 gap-2 p-3">
      <div class="rounded-xl bg-slate-50 p-2"><div class="text-[10px] text-slate-400">Toplam ${d.L[0]}</div><div class="text-xs font-bold text-slate-800">${formatMoney(d.inc)}</div></div>
      <div class="rounded-xl bg-emerald-50 p-2"><div class="text-[10px] text-emerald-600">Toplam ${d.L[1]}</div><div class="text-xs font-bold text-emerald-700">${formatMoney(d.dec)}</div></div>
      <div class="rounded-xl bg-slate-900 p-2"><div class="text-[10px] text-slate-400">${d.L[2]}</div><div class="text-xs font-bold ${bal > 0.005 ? 'text-amber-300' : 'text-emerald-300'}">${formatMoney(bal)}</div></div>
    </div>
    <div class="px-3 pb-3 overflow-x-auto">
      <table class="w-full text-[11px] border-collapse">
        <thead><tr class="text-[10px] uppercase text-slate-400 border-b border-slate-300 text-left">
          <th class="py-1.5 pr-1 w-[52px]">Tarih</th><th class="py-1.5 pr-1">Açıklama</th><th class="py-1.5 pr-1 text-right">Tutar</th><th class="py-1.5 text-right">${d.filtered ? 'Kalan' : 'Bakiye'}</th><th class="no-print w-5"></th></tr></thead>
        <tbody>
          ${d.st && !d.filtered ? `<tr class="bg-slate-50 text-slate-500"><td class="py-1.5 pr-1">${sd(d.st)}</td><td class="pr-1 italic" colspan="2">Devir bakiye</td><td class="text-right font-semibold">${formatMoney(d.opening)}</td><td class="no-print"></td></tr>` : ''}
          ${d.rows.map((r, i) => `<tr class="border-b border-slate-100 align-top ${i % 2 ? 'bg-slate-50/60' : ''}">
            <td class="py-1.5 pr-1 text-slate-500 whitespace-nowrap">${sd(r.date)}</td>
            <td class="py-1.5 pr-1 break-words"><span class="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mr-1 ${r.inc ? 'bg-slate-200 text-slate-700' : r.label ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}">${r.label || (r.inc ? d.L[0] : d.L[1])}</span>${r.items && r.items.length ? itemsHtml(r.items) : esc(r.desc)}${(x => x ? `<div class="text-[10px] font-semibold mt-0.5 ${x.cls}">${esc(x.txt)}</div>` : '')(stLine(r))}</td>
            <td class="py-1.5 pr-1 text-right font-bold whitespace-nowrap ${r.inc ? 'text-slate-800' : 'text-emerald-600'}">${r.inc ? formatMoney(r.inc) : '-' + formatMoney(r.dec)}</td>
            <td class="py-1.5 text-right font-semibold whitespace-nowrap text-slate-700">${formatMoney(r.bal)}</td>
            <td class="no-print">${r.del ? `<button onclick="delStmtPay(${i})" class="text-slate-300 hover:text-rose-500 px-1">×</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="py-6 text-center text-slate-400">Bu aralıkta hareket yok.</td></tr>'}
        </tbody>
        <tfoot><tr class="font-bold text-xs border-t-2 border-slate-800"><td colspan="2" class="py-2">${d.L[2]}${note}</td><td></td><td class="py-2 text-right">${formatMoney(bal)}</td><td class="no-print"></td></tr></tfoot>
      </table>
    </div>
    <div class="px-4 pb-3 text-[10px] text-slate-400">Bu ekstre ${today} tarihinde ${esc(biz)} tarafından düzenlenmiştir.</div>
    <div class="print-only px-4 pb-6"><div class="grid grid-cols-2 gap-10 pt-12 text-[10px] text-slate-500 text-center"><div class="border-t border-slate-400 pt-1">Düzenleyen</div><div class="border-t border-slate-400 pt-1">Mutabakat / İmza</div></div></div>
  </div>`;
}
function delStmtPay(i) {
  const r = stmtRowsCur[i];
  if (!r || !r.del || !confirm('Bu ödeme/tahsilat hareketi silinsin mi?')) return;
  if (r.del[0] === 'cp') cardPays = cardPays.filter(p => p.id !== r.del[1]);
  else {
    const rec = (r.del[0] === 'customer' ? sales : purchases).find(x => x.id === r.del[1]);
    if (rec) { rec.payments = rec.payments.filter(p => p.id !== r.del[2]); rec.paid = sumPay(rec.payments); }
  }
  saveAll(); applyFilters(); renderStatement();
}
function shareStatement() {
  if (!stmtCtx || !stmtCtx.kind || !STMT_L[stmtCtx.kind]) { alert('Önce bir cari veya kart ekstresi açın.'); return; }
  const d = stmtData(); if (!d) { alert('Ekstre verisi hazır değil. Lütfen ekstreyi yeniden açın.'); return; }
  const biz = getBiz() || 'Hesap Defterim';
  const rng0 = (d.st || d.en) ? `${d.st ? formatDate(d.st) : '...'} - ${d.en ? formatDate(d.en) : '...'}` : 'Tüm zamanlar';
  const rng = rng0 + (d.flabel ? ' · ' + d.flabel : '');
  const txt = `${biz}\nCARİ HESAP EKSTRESİ\n${d.title}\nDönem: ${rng}\nTarih: ${formatDate(getTodayString())}\n\n`
    + d.rows.map(r => `${formatDate(r.date)} | ${r.items && r.items.length ? d.L[0] : r.desc} | ${r.inc ? formatMoney(r.inc) : '-' + formatMoney(r.dec)} | ${d.filtered ? 'Kalan' : 'Bakiye'}: ${formatMoney(r.bal)}` + (r.items && r.items.length ? '\n' + r.items.map(i => `   - ${i.prod}: ${i.qty} ${i.unit} × ${formatMoney(i.price)} = ${formatMoney(i.total || round2(i.qty * i.price))}`).join('\n') : '') + (stLine(r) ? '\n   ' + stLine(r).txt : '')).join('\n')
    + `\n\nToplam ${d.L[0]}: ${formatMoney(d.inc)}\nToplam ${d.L[1]}: ${formatMoney(d.dec)}\n${d.L[2]}: ${formatMoney(d.closing)}`;
  if (navigator.share) navigator.share({ text: txt }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => alert('Ekstre kopyalandı.'), () => alert('Kopyalanamadı.'));
  else alert(txt);
}
// ================= TAKSİT =================
// Kartlı giderin aylık taksit dökümü (ilk taksit alış ayında, her ay aynı günde)
function expEntries(e) {
  if (e.method !== 'card' || !(e.inst > 1)) return [{ date: e.date, amount: e.amount }];
  const [y, m, d] = e.date.split('-').map(Number), base = round2(e.amount / e.inst), out = [];
  for (let k = 0; k < e.inst; k++) {
    const last = new Date(y, m + k, 0).getDate();
    out.push({
      date: toDateStr(new Date(y, m - 1 + k, Math.min(d, last))),
      amount: k === e.inst - 1 ? round2(e.amount - base * (e.inst - 1)) : base
    });
  }
  return out;
}
function updInstPreview() {
  const n = Math.min(36, Math.max(1, Math.round(parseFloat(document.getElementById('expense-inst').value)) || 1));
  const a = parseFloat(document.getElementById('expense-amount').value) || 0;
  document.getElementById('inst-preview').textContent = n > 1 && a > 0 ? `${n} ay × ${formatMoney(a / n)}` : '';
}
document.getElementById('expense-amount').addEventListener('input', updInstPreview);
