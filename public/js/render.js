// ================= FİLTRELER =================
function highlightFilterBtn(mode) {
  document.querySelectorAll('.date-filter-btn').forEach(btn => {
    btn.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
    btn.classList.add('text-slate-600');
  });
  const b = document.getElementById('btn-' + mode);
  if (b) {
    b.classList.remove('text-slate-600');
    b.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
  }
}

function setQuickDate(mode) {
  currentFilterMode = mode;
  highlightFilterBtn(mode);
  document.getElementById('filter-start').value = '';
  document.getElementById('filter-end').value = '';
  applyFilters();
}

// Özel tarih seçilirse hızlı filtre vurgusu kalkar
function onCustomDateChange() {
  const s = document.getElementById('filter-start').value;
  const e = document.getElementById('filter-end').value;
  if (s || e) {
    document.querySelectorAll('.date-filter-btn').forEach(btn => {
      btn.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
      btn.classList.add('text-slate-600');
    });
  } else {
    highlightFilterBtn(currentFilterMode);
  }
  applyFilters();
}

function resetFilters() {
  document.getElementById('filter-search').value = '';
  setQuickDate('all');
}

// Haftayı Pazartesi'den Pazar'a hesapla (yerel saat)
function getWeekRange() {
  const now = new Date();
  const dayIdx = (now.getDay() + 6) % 7; // Pzt=0 ... Paz=6
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayIdx);
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayIdx + 6);
  return { start: toDateStr(monday), end: toDateStr(sunday) };
}

function dateFilterPass(dateStr) {
  const start = document.getElementById('filter-start').value;
  const end = document.getElementById('filter-end').value;
  if (start && dateStr < start) return false;
  if (end && dateStr > end) return false;

  if (!start && !end) {
    if (currentFilterMode === 'today') return dateStr === getTodayString();
    if (currentFilterMode === 'week') {
      const w = getWeekRange();
      return dateStr >= w.start && dateStr <= w.end;
    }
    if (currentFilterMode === 'month') {
      return dateStr.slice(0, 7) === getTodayString().slice(0, 7);
    }
  }
  return true;
}

function byDateDesc(a, b) { return b.date.localeCompare(a.date); }

function applyFilters() {
  const q = document.getElementById('filter-search').value.trim().toLowerCase();

  const fSales = [...sales].sort(byDateDesc).filter(s => {
    if (!dateFilterPass(s.date)) return false;
    if (q) {
      const matchCust = s.customer.toLowerCase().includes(q);
      const matchItem = s.items.some(it => it.prod.toLowerCase().includes(q));
      if (!matchCust && !matchItem) return false;
    }
    return true;
  });

  const fPurchases = [...purchases].sort(byDateDesc).filter(p => {
    if (!dateFilterPass(p.date)) return false;
    if (q) {
      const matchSupp = p.supplier.toLowerCase().includes(q);
      const matchItem = p.items.some(it => it.prod.toLowerCase().includes(q));
      if (!matchSupp && !matchItem) return false;
    }
    return true;
  });

  const fExpenses = [...expenses].sort(byDateDesc).filter(e => {
    if (!expEntries(e).some(x => dateFilterPass(x.date))) return false;
    if (q) {
      const matchCat = e.category.toLowerCase().includes(q);
      const matchDesc = (e.desc || '').toLowerCase().includes(q);
      if (!matchCat && !matchDesc) return false;
    }
    return true;
  });

  render(fSales, fPurchases, fExpenses);
}

// ================= ÇİZİM =================
function render(fSales, fPurchases, fExpenses) {
  let totalSales = 0, totalPurchases = 0, totalExpenses = 0;
  let totalReceivable = 0, totalDebt = 0;

  const customerBalances = {};
  const supplierBalances = {};
  const productSummary = {};
  const expenseCats = {};

  fSales.forEach(s => {
    totalSales += s.total;
    const rem = Math.max(0, s.total - (s.paid || 0));
    totalReceivable += rem; // kayıt bazında, fazla tahsilat diğer kayıtları eksiltmez
    if (rem > 0) customerBalances[s.customer] = (customerBalances[s.customer] || 0) + rem;

    s.items.forEach(it => {
      if (!Object.prototype.hasOwnProperty.call(productSummary, it.prod)) {
        productSummary[it.prod] = { qty: 0, unit: it.unit, total: 0 };
      }
      productSummary[it.prod].qty += it.qty;
      productSummary[it.prod].total += it.total;
    });
  });

  fPurchases.forEach(p => {
    totalPurchases += p.total;
    const rem = Math.max(0, p.total - (p.paid || 0));
    totalDebt += rem;
    if (rem > 0) supplierBalances[p.supplier] = (supplierBalances[p.supplier] || 0) + rem;
  });

  fExpenses.forEach(e => {
    totalExpenses += e.amount;
    expenseCats[e.category] = (expenseCats[e.category] || 0) + e.amount;
  });

  const netProfit = totalSales - totalPurchases - totalExpenses;

  document.getElementById('stat-sales').textContent = formatMoney(totalSales);
  document.getElementById('stat-purchases').textContent = formatMoney(totalPurchases);
  document.getElementById('stat-expenses').textContent = formatMoney(totalExpenses);
  document.getElementById('stat-net-profit').textContent = (netProfit >= 0 ? '+' : '') + formatMoney(netProfit);
  document.getElementById('stat-net-profit').className = `text-sm sm:text-base font-bold mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
  document.getElementById('stat-receivables').textContent = formatMoney(totalReceivable);
  document.getElementById('stat-debts').textContent = formatMoney(totalDebt);

  document.getElementById('count-sales').textContent = fSales.length;
  document.getElementById('count-purchases').textContent = fPurchases.length;
  document.getElementById('count-expenses').textContent = fExpenses.length;

  // 1. SATIŞLAR
  const salesList = document.getElementById('sales-list');
  if (fSales.length === 0) {
    salesList.innerHTML = '';
    document.getElementById('sales-empty').classList.remove('hidden');
  } else {
    document.getElementById('sales-empty').classList.add('hidden');
    salesList.innerHTML = fSales.map(s => {
      const rem = Math.max(0, s.total - (s.paid || 0));
      const isDone = rem <= 0;
      const over = (s.paid || 0) > s.total ? ` (fazla: ${formatMoney(s.paid - s.total)})` : '';
      const itemsDesc = s.items.map(it => `${esc(it.prod)} (${esc(it.qty)} ${esc(it.unit)} × ${esc(it.price)}₺)`).join(', ');
      const sid = esc(s.id);
      return `
        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0">
              <span class="text-[10px] text-slate-400 block">${formatDate(s.date)}</span>
              <h4 class="font-bold text-sm text-slate-800 break-words">${esc(s.customer)}</h4>
              <p class="text-xs text-slate-500 mt-0.5 break-words">${itemsDesc}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <div class="text-right">
                <span class="text-xs font-bold text-emerald-700 block">${formatMoney(s.total)}</span>
                <span class="text-[10px] ${isDone ? 'text-emerald-600' : 'text-indigo-600 font-semibold'}">
                  ${isDone ? '✓ Tamamı Alındı' : `Kalan: ${formatMoney(rem)}`}
                </span>
              </div>
              <button onclick="editRecord('sale', '${sid}')" title="Düzenle" class="text-slate-300 hover:text-indigo-500 text-xs px-1">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button onclick="deleteRecord('sale', '${sid}')" title="Sil" class="text-slate-300 hover:text-rose-500 text-xs px-1">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <span class="text-[11px] text-slate-500">Tahsil: ${formatMoney(s.paid || 0)}${over}</span>
            <button onclick="openPaymentModal('sale', '${sid}')" class="text-xs px-2.5 py-1 rounded-lg font-semibold ${isDone ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}">
              ${isDone ? 'Tahsilat Düzenle' : '+ Tahsilat Ekle'}
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // 2. ALIŞLAR
  const purchasesList = document.getElementById('purchases-list');
  if (fPurchases.length === 0) {
    purchasesList.innerHTML = '';
    document.getElementById('purchases-empty').classList.remove('hidden');
  } else {
    document.getElementById('purchases-empty').classList.add('hidden');
    purchasesList.innerHTML = fPurchases.map(p => {
      const rem = Math.max(0, p.total - (p.paid || 0));
      const isDone = rem <= 0;
      const over = (p.paid || 0) > p.total ? ` (fazla: ${formatMoney(p.paid - p.total)})` : '';
      const itemsDesc = p.items.map(it => `${esc(it.prod)} (${esc(it.qty)} ${esc(it.unit)} × ${esc(it.price)}₺)`).join(', ');
      const pid = esc(p.id);
      return `
        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0">
              <span class="text-[10px] text-slate-400 block">${formatDate(p.date)}</span>
              <h4 class="font-bold text-sm text-slate-800 break-words">${esc(p.supplier)}</h4>
              <p class="text-xs text-slate-500 mt-0.5 break-words">${itemsDesc}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <div class="text-right">
                <span class="text-xs font-bold text-amber-700 block">${formatMoney(p.total)}</span>
                <span class="text-[10px] ${isDone ? 'text-slate-500' : 'text-orange-600 font-semibold'}">
                  ${isDone ? '✓ Ödendi' : `Borç: ${formatMoney(rem)}`}
                </span>
              </div>
              <button onclick="editRecord('purchase', '${pid}')" title="Düzenle" class="text-slate-300 hover:text-indigo-500 text-xs px-1">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button onclick="deleteRecord('purchase', '${pid}')" title="Sil" class="text-slate-300 hover:text-rose-500 text-xs px-1">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <span class="text-[11px] text-slate-500">Ödenen: ${formatMoney(p.paid || 0)}${over}</span>
            <button onclick="openPaymentModal('purchase', '${pid}')" class="text-xs px-2.5 py-1 rounded-lg font-semibold ${isDone ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}">
              ${isDone ? 'Ödeme Düzenle' : '+ Borç Öde'}
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // 3. GİDERLER
  const expensesList = document.getElementById('expenses-list');
  if (fExpenses.length === 0) {
    expensesList.innerHTML = '';
    document.getElementById('expenses-empty').classList.remove('hidden');
  } else {
    document.getElementById('expenses-empty').classList.add('hidden');
    expensesList.innerHTML = fExpenses.map(e => {
      const eid = esc(e.id);
      return `
        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center gap-2">
          <div class="min-w-0">
            <span class="text-[10px] text-slate-400 block">${formatDate(e.date)}</span>
            <span class="text-xs font-bold text-slate-800">${esc(e.category)}</span>${e.method === 'card' ? ` <span class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">💳 ${esc(cardName(e.cardId))}</span>` : ''}
            ${e.inst > 1 ? `<span class="text-[10px] text-violet-700 block">${e.inst} taksit · aylık ${formatMoney(expEntries(e)[0].amount)} · ${expEntries(e).filter(x => x.date <= getTodayString()).length}/${e.inst} işlendi</span>` : ''}
            ${e.desc ? `<span class="text-xs text-slate-500 block break-words">${esc(e.desc)}</span>` : ''}
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-xs font-bold text-rose-600">-${formatMoney(e.amount)}</span>
            <button onclick="editRecord('expense', '${eid}')" title="Düzenle" class="text-slate-300 hover:text-indigo-500 text-xs px-1">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button onclick="deleteRecord('expense', '${eid}')" title="Sil" class="text-slate-300 hover:text-rose-500 text-xs px-1">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // Gider kategori rozetleri
  const catBadgeContainer = document.getElementById('expense-category-badges');
  const catKeys = Object.keys(expenseCats);
  if (catKeys.length === 0) {
    catBadgeContainer.innerHTML = '<span class="text-slate-400 text-xs">Kayıtlı gider yok</span>';
  } else {
    catBadgeContainer.innerHTML = catKeys.map(k => `
      <span class="bg-rose-50 border border-rose-100 text-rose-800 px-2 py-1 rounded-lg font-medium text-[11px]">
        ${esc(k)}: <strong>${formatMoney(expenseCats[k])}</strong>
      </span>`).join('');
  }

  // 4. RAPORLAR
  renderBalanceList('report-customer-balances', customerBalances, 'text-indigo-600', 'Tüm alacaklar tahsil edildi');
  renderBalanceList('report-supplier-balances', supplierBalances, 'text-orange-600', 'Ödenmemiş borç yok');

  const pContainer = document.getElementById('report-products');
  const pKeys = Object.keys(productSummary);
  if (pKeys.length === 0) {
    pContainer.innerHTML = '<span class="text-slate-400">Satış verisi yok</span>';
  } else {
    pContainer.innerHTML = pKeys.map(k => {
      const item = productSummary[k];
      return `
        <div class="flex justify-between items-center py-1 border-b border-slate-50 last:border-0 gap-2">
          <span class="break-words">${esc(k)}</span>
          <span class="font-bold text-slate-800 text-right">${esc(round2(item.qty))} ${esc(item.unit)} (${formatMoney(item.total)})</span>
        </div>`;
    }).join('');
  }
}

function renderBalanceList(elemId, map, colorClass, emptyMsg) {
  const el = document.getElementById(elemId);
  const keys = Object.keys(map).filter(k => map[k] > 0);
  if (keys.length === 0) {
    el.innerHTML = `<span class="text-slate-400 text-xs">${esc(emptyMsg)}</span>`;
  } else {
    el.innerHTML = keys.map(k => `
      <div class="flex justify-between items-center py-1 border-b border-slate-50 last:border-0 gap-2">
        <span class="text-slate-700 font-medium break-words">${esc(k)}</span>
        <span class="font-bold ${colorClass}">${formatMoney(map[k])}</span>
      </div>`).join('');
  }
}

// ================= BİÇİMLENDİRME =================
function formatMoney(amount) {
  return '₺' + Number(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = String(dateStr).split('-');
  return `${esc(day)}.${esc(month)}.${esc(year)}`;
}
