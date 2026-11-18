// ================= FİRE & OTOMATİK BİRİM =================
// Ürünün en son kullanılan birimi (satış, alış veya fire kaydından); bilinmiyorsa ''.
function lastUnit(prod) {
  const k = fk(prod); let best = null;
  const see = (p, u, d) => { if (fk(p) === k && (!best || d > best.d)) best = { u, d }; };
  sales.forEach(r => r.items.forEach(i => see(i.prod, i.unit, r.date)));
  purchases.forEach(r => r.items.forEach(i => see(i.prod, i.unit, r.date)));
  wastes.forEach(w => see(w.prod, w.unit, w.date));
  return best ? best.u : '';
}
// Ürünün listedeki (satış ya da alış) en son fiyatı; yoksa 0.
function lastPrice(prod, list) {
  const k = fk(prod); let best = null;
  list.forEach(r => r.items.forEach(i => { if (fk(i.prod) === k && i.price > 0 && (!best || r.date > best.d)) best = { d: r.date, p: i.price }; }));
  return best ? best.p : 0;
}
// Kalemde ürün adı yazılınca birimi o ürünün son birimine getir (kıvırcık adet, lahana kg).
document.addEventListener('input', e => {
  const inp = e.target;
  if (!inp.classList || !inp.classList.contains('row-prod')) return;
  const sel = inp.id === 'waste-prod' ? document.getElementById('waste-unit') : inp.closest('.item-row') && inp.closest('.item-row').querySelector('.row-unit');
  const u = sel && lastUnit(inp.value);
  if (u && [...sel.options].some(o => o.value === u)) sel.value = u;
});

// Fire değeri: alış kaydı varsa ortalama alış fiyatı, yoksa (kendi ürünü) ortalama satış fiyatı.
function unitValue(prod, unit) {
  const k = fk(prod), avg = list => { let q = 0, t = 0; list.forEach(r => r.items.forEach(i => { if (fk(i.prod) === k && i.unit === unit && i.qty > 0) { q += i.qty; t += i.total || round2(i.qty * i.price); } })); return q ? t / q : 0; };
  const b = avg(purchases);
  return b ? { p: b, bySale: false } : { p: avg(sales), bySale: true };
}
const fmtQty = (q, u) => `${round2(q).toLocaleString('tr-TR')} ${u}`;

function renderStock() {
  const el = document.getElementById('tbl-stock'); if (!el) return;
  const m = {};
  wastes.filter(w => dateFilterPass(w.date)).forEach(w => {
    const o = m[fk(w.prod) + '|' + w.unit] || (m[fk(w.prod) + '|' + w.unit] = { name: w.prod, unit: w.unit, q: 0 });
    o.q += w.qty;
  });
  let total = 0;
  const rows = Object.values(m).map(o => { const v = unitValue(o.name, o.unit), amt = round2(o.q * v.p); total += amt; return { ...o, amt, bySale: v.bySale }; })
    .sort((a, b) => b.amt - a.amt)
    .map(o => [esc(o.name), fmtQty(o.q, o.unit), o.amt ? formatMoney(o.amt) + (o.bySale ? ' <span class="text-slate-400">(satış fiyatıyla)</span>' : '') : '-']);
  el.innerHTML = tbl(['Ürün', 'Fire', 'Tahmini değer'], rows, ['Toplam', '', formatMoney(total)]);
  const recent = [...wastes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  document.getElementById('waste-list').innerHTML = recent.length ? recent.map(w => `
    <div class="flex justify-between items-center py-1 border-b border-slate-50 gap-2">
      <span>${formatDate(w.date)} · <b>${esc(w.prod)}</b> ${fmtQty(w.qty, w.unit)}${w.note ? ` <span class="text-slate-400">${esc(w.note)}</span>` : ''}</span>
      <button onclick="deleteWaste('${w.id}')" title="Sil" class="text-slate-300 hover:text-rose-500 px-1"><i class="fa-regular fa-trash-can"></i></button>
    </div>`).join('') : '<span class="text-slate-400">Henüz fire kaydı yok.</span>';
}

function openWasteModal() {
  const us = document.getElementById('waste-unit');
  if (!us.options.length) us.innerHTML = UNITS.map(u => `<option value="${u}">${u}</option>`).join('');
  ['waste-prod', 'waste-qty', 'waste-note'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('waste-date').value = getTodayString();
  document.getElementById('waste-modal').style.display = 'flex';
}
function saveWaste() {
  const prod = document.getElementById('waste-prod').value.trim(), unit = document.getElementById('waste-unit').value;
  const qty = round2(parseFloat(document.getElementById('waste-qty').value));
  if (!prod) return alert('Ürün adını yazın.');
  if (!(qty > 0)) return alert('Geçerli bir miktar girin.');
  wastes.unshift({ id: newId('W'), date: validDate(document.getElementById('waste-date').value), prod, unit, qty, note: document.getElementById('waste-note').value.trim() });
  saveAll(); closeModal('waste-modal'); applyFilters();
}
function deleteWaste(id) {
  if (!confirm('Bu fire kaydını silmek istediğinize emin misiniz?')) return;
  wastes = wastes.filter(w => w.id !== id);
  saveAll(); applyFilters();
}
