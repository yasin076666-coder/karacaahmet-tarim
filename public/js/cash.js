// ================= KASA (NAKİT) =================
let cashSign = 1;
// Nakit girişleri: müşteri tahsilatları + kasa girişleri.
// Nakit çıkışlar: tedarikçi ödemeleri, nakit giderler, kart borcu ödemeleri, kasa çıkışları.
function cashRows() {
  const t = getTodayString(), r = [];
  sales.forEach(s => s.payments.forEach(p => r.push({ date: p.date, g: 'tah', label: 'Tahsilat: ' + s.customer, amount: p.amount })));
  purchases.forEach(x => x.payments.forEach(p => r.push({ date: p.date, g: 'alis', label: 'Ödeme: ' + x.supplier, amount: -p.amount })));
  expenses.filter(e => e.method !== 'card').forEach(e => r.push({ date: e.date, g: 'gider', label: 'Gider: ' + e.category + (e.desc ? ' - ' + e.desc : ''), amount: -e.amount }));
  cardPays.forEach(p => r.push({ date: p.date, g: 'kart', label: 'Kart ödemesi: ' + cardName(p.cardId), amount: -p.amount }));
  cashMoves.forEach(m => r.push({ date: m.date, g: m.amount >= 0 ? 'giris' : 'cikis', label: m.note || (m.amount >= 0 ? 'Kasa girişi' : 'Kasa çıkışı'), amount: m.amount, del: m.id }));
  return r.filter(x => x.date <= t).sort((a, b) => b.date.localeCompare(a.date));
}
function renderCash() {
  const rows = cashRows(), total = round2(rows.reduce((a, x) => a + x.amount, 0));
  const el = document.getElementById('cash-total');
  el.textContent = formatMoney(total);
  el.className = 'text-2xl font-bold mt-1 ' + (total < 0 ? 'text-rose-400' : 'text-emerald-400');
  document.getElementById('cash-hint').textContent = !cashMoves.length ? 'Başlangıç nakdini "+ Giriş" ile ekle.' : (total < 0 ? 'Kasa eksiye düştü, giriş eksik olabilir.' : '');
  const G = [['tah', '➕ Müşteri tahsilatları'], ['giris', '➕ Kasa girişleri'], ['alis', '➖ Tedarikçi ödemeleri'], ['gider', '➖ Nakit giderler'], ['kart', '➖ Kart borcu ödemeleri'], ['cikis', '➖ Kasa çıkışları']];
  const sum = g => round2(rows.filter(x => x.g === g).reduce((a, x) => a + x.amount, 0));
  document.getElementById('cash-detail').innerHTML =
    '<div class="space-y-1">' + G.map(([g, l]) => `<div class="flex justify-between text-slate-300"><span>${l}</span><span class="font-semibold">${formatMoney(Math.abs(sum(g)))}</span></div>`).join('') + '</div>' +
    '<div class="pt-2 border-t border-slate-700 space-y-1">' + (rows.slice(0, 30).map(x => `<div class="flex justify-between gap-2"><div class="min-w-0"><span class="text-[10px] text-slate-500">${formatDate(x.date)}</span> <span class="text-slate-300 break-words">${esc(x.label)}</span></div><div class="shrink-0 flex gap-1"><span class="font-bold ${x.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${x.amount >= 0 ? '+' : '-'}${formatMoney(Math.abs(x.amount))}</span>${x.del ? `<button onclick="delCash('${esc(x.del)}')" class="text-slate-500 px-1">×</button>` : ''}</div></div>`).join('') || '<span class="text-slate-500">Henüz hareket yok.</span>') + '</div>' +
    (rows.length > 30 ? '<p class="text-[10px] text-slate-500">Son 30 hareket gösteriliyor.</p>' : '');
}
function openCashModal(sign) {
  cashSign = sign;
  document.getElementById('cash-modal-title').textContent = sign > 0 ? '💵 Kasaya Para Girişi' : '💸 Kasadan Para Çıkışı';
  document.getElementById('cash-amount').value = '';
  document.getElementById('cash-note').value = '';
  document.getElementById('cash-date').value = getTodayString();
  document.getElementById('cash-modal').style.display = 'flex';
}
function saveCash() {
  const amt = parseFloat(document.getElementById('cash-amount').value);
  if (!(amt > 0)) return alert('Geçerli bir tutar girin.');
  cashMoves.unshift({ id: newId('M'), date: validDate(document.getElementById('cash-date').value), amount: cashSign * round2(amt), note: document.getElementById('cash-note').value.trim() });
  saveAll(); closeModal('cash-modal'); applyFilters();
}
function delCash(id) {
  if (!confirm('Bu kasa hareketi silinsin mi?')) return;
  cashMoves = cashMoves.filter(m => m.id !== id); saveAll(); applyFilters();
}
// Çevrimdışı kullanım için Service Worker (sw.js aynı klasörde olmalı)
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {}));
}
// ================= ARŞİVLEME =================
document.getElementById('archive-date').value = (new Date().getFullYear() - 1) + '-12-31';
async function archiveRecords() {
  const cut = document.getElementById('archive-date').value;
  if (!cut || cut > getTodayString()) return alert('Bugüne kadar bir tarih seçin.');
  // Sadece borcu kalmamış ve tüm ödemeleri seçilen tarihe kadar yapılmış kayıtlar
  const settled = r => r.date <= cut && (r.paid || 0) >= r.total - 0.005 && r.payments.every(p => p.date <= cut);
  const aS = sales.filter(settled), aP = purchases.filter(settled);
  const aE = expenses.filter(e => e.method !== 'card' && e.date <= cut);
  if (!aS.length && !aP.length && !aE.length) return alert('Bu tarihe kadar arşivlenecek kayıt yok.');
  // Kasadaki nakit değişmesin diye çıkarılan kayıtların net nakit etkisi "Devir" olarak yazılır
  const net = round2(aS.reduce((a, r) => a + sumPay(r.payments), 0) - aP.reduce((a, r) => a + sumPay(r.payments), 0) - aE.reduce((a, e) => a + e.amount, 0));
  if (!confirm(`${formatDate(cut)} tarihine kadar ${aS.length} satış, ${aP.length} alış ve ${aE.length} nakit gider arşivlenecek. Kasaya "Devir" olarak ${formatMoney(net)} yazılacak. Önce tam yedek indirilecek. Devam edilsin mi?`)) return;
  await exportData();
  if (!confirm('Yedek dosyası indi mi? İndiyse "Tamam"a basın; kayıtlar programdan çıkarılacak.')) return;
  sales = sales.filter(r => !aS.includes(r));
  purchases = purchases.filter(r => !aP.includes(r));
  expenses = expenses.filter(e => !aE.includes(e));
  if (net !== 0) cashMoves.unshift({ id: newId('M'), date: cut, amount: net, note: `Devir (${formatDate(cut)} öncesi arşivlendi)` });
  saveAll(); applyFilters();
  alert(`Arşivlendi: ${aS.length} satış, ${aP.length} alış, ${aE.length} gider. Yedek dosyanı sakla.`);
}
