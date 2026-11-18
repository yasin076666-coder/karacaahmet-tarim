// ================= MODAL YÖNETİMİ =================
function setModalTexts(prefix, title, submit) {
  const t = document.querySelector('#' + prefix + '-modal-title span');
  if (t) t.textContent = title;
  const b = document.getElementById(prefix + '-submit-btn');
  if (b) b.textContent = submit;
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  if (id === 'sale-modal') {
    editing.sale = null;
    document.getElementById('sale-form').reset();
    document.getElementById('sale-date').value = getTodayString();
    document.getElementById('sale-items-container').innerHTML = '';
    setModalTexts('sale', 'Yeni Müşteri Satışı Ekle', 'Satışı Kaydet');
    document.getElementById('sale-paid-label').textContent = 'Tahsil Edilen Peşinat (₺):';
    addItemRow('sale-items-container', 'sale');
  } else if (id === 'purchase-modal') {
    editing.purchase = null;
    document.getElementById('purchase-form').reset();
    document.getElementById('purchase-date').value = getTodayString();
    document.getElementById('purchase-items-container').innerHTML = '';
    setModalTexts('purchase', 'Yeni Ürün Alışı Ekle', 'Alışı Kaydet');
    document.getElementById('purchase-paid-label').textContent = 'Tedarikçiye Ödenen Peşinat (₺):';
    addItemRow('purchase-items-container', 'purchase');
  } else if (id === 'expense-modal') {
    editing.expense = null;
    document.getElementById('expense-form').reset();
    document.getElementById('expense-date').value = getTodayString();
    setModalTexts('expense', 'Yeni Masraf / Gider Ekle', 'Gideri Kaydet');
    fillCardSelect(); setExpMethod('cash'); document.getElementById('expense-inst').value = 1; updInstPreview();
  }
  el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
  if (id === 'payment-modal') activePaymentContext = null;
  if (id === 'sale-modal') editing.sale = null;
  if (id === 'purchase-modal') editing.purchase = null;
  if (id === 'expense-modal') editing.expense = null;
}

// ================= KAYIT DÜZENLEME =================
function editRecord(type, id) {
  if (type === 'sale') {
    const rec = sales.find(s => s.id === id);
    if (!rec) return;
    openModal('sale-modal');
    editing.sale = id;
    setModalTexts('sale', 'Satışı Düzenle', 'Değişiklikleri Kaydet');
    document.getElementById('sale-paid-label').textContent = 'Toplam Tahsil Edilen (₺):';
    document.getElementById('sale-date').value = rec.date;
    document.getElementById('sale-customer').value = rec.customer;
    const c = document.getElementById('sale-items-container');
    c.innerHTML = '';
    (rec.items.length ? rec.items : [null]).forEach(it => addItemRow('sale-items-container', 'sale', it));
    document.getElementById('sale-paid').value = rec.paid || '';
    calcModalTotal('sale-items-container', 'sale-total-preview');
  } else if (type === 'purchase') {
    const rec = purchases.find(p => p.id === id);
    if (!rec) return;
    openModal('purchase-modal');
    editing.purchase = id;
    setModalTexts('purchase', 'Alışı Düzenle', 'Değişiklikleri Kaydet');
    document.getElementById('purchase-paid-label').textContent = 'Toplam Ödenen (₺):';
    document.getElementById('purchase-date').value = rec.date;
    document.getElementById('purchase-supplier').value = rec.supplier;
    const c = document.getElementById('purchase-items-container');
    c.innerHTML = '';
    (rec.items.length ? rec.items : [null]).forEach(it => addItemRow('purchase-items-container', 'purchase', it));
    document.getElementById('purchase-paid').value = rec.paid || '';
    calcModalTotal('purchase-items-container', 'purchase-total-preview');
  } else if (type === 'expense') {
    const rec = expenses.find(e => e.id === id);
    if (!rec) return;
    openModal('expense-modal');
    editing.expense = id;
    setModalTexts('expense', 'Gideri Düzenle', 'Değişiklikleri Kaydet');
    document.getElementById('expense-date').value = rec.date;
    const sel = document.getElementById('expense-category');
    if (![...sel.options].some(o => o.value === rec.category)) {
      const opt = document.createElement('option');
      opt.value = rec.category;
      opt.textContent = rec.category;
      sel.appendChild(opt);
    }
    sel.value = rec.category;
    document.getElementById('expense-amount').value = rec.amount;
    document.getElementById('expense-desc').value = rec.desc || '';
    fillCardSelect(rec.cardId); setExpMethod(rec.method || 'cash'); document.getElementById('expense-inst').value = rec.inst || 1; updInstPreview();
  }
}

// ================= ÜRÜN SATIRLARI =================
function addItemRow(containerId, type, data) {
  const container = document.getElementById(containerId);
  const row = document.createElement('div');
  row.className = 'item-row p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2';

  const priceLabel = type === 'sale' ? 'Satış Fiyatı' : 'Alış Fiyatı';
  const priceClass = type === 'sale' ? 'text-emerald-700' : 'text-amber-700';
  const previewId = type + '-total-preview';

  row.innerHTML = `
    <div class="flex justify-between items-center">
      <input type="text" placeholder="Ürün Adı (Örn: Domates)" required class="row-prod w-2/3 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
      <button type="button" onclick="this.closest('.item-row').remove(); calcModalTotal('${containerId}', '${previewId}');" class="text-rose-500 hover:text-rose-700 text-xs px-2">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div class="flex gap-1 col-span-2">
        <input type="number" step="any" min="0" placeholder="Miktar" required oninput="calcModalTotal('${containerId}', '${previewId}')" class="row-qty w-2/3 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
        <select class="row-unit w-1/3 bg-white border border-slate-200 rounded-lg text-[10px] px-1">
          ${UNITS.map(u => `<option value="${u}">${u}</option>`).join('')}
        </select>
      </div>
      <div>
        <input type="number" step="any" min="0" placeholder="${priceLabel} ₺" required oninput="calcModalTotal('${containerId}', '${previewId}')" class="row-price w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold ${priceClass}">
      </div>
    </div>
  `;
  container.appendChild(row);

  if (data) {
    row.querySelector('.row-prod').value = data.prod;
    row.querySelector('.row-qty').value = data.qty;
    row.querySelector('.row-price').value = data.price;
    const unitSel = row.querySelector('.row-unit');
    if (![...unitSel.options].some(o => o.value === data.unit)) {
      const opt = document.createElement('option');
      opt.value = data.unit;
      opt.textContent = data.unit;
      unitSel.appendChild(opt);
    }
    unitSel.value = data.unit;
  }
  calcModalTotal(containerId, previewId);
}

function calcContainerTotal(containerId) {
  let total = 0;
  document.getElementById(containerId).querySelectorAll('.item-row').forEach(r => {
    const qty = parseFloat(r.querySelector('.row-qty')?.value) || 0;
    const price = parseFloat(r.querySelector('.row-price')?.value) || 0;
    total += qty * price;
  });
  return round2(total);
}

function calcModalTotal(containerId, previewId) {
  const total = calcContainerTotal(containerId);
  document.getElementById(previewId).textContent = formatMoney(total);
  return total;
}

function fillFullPayment(containerId, inputId) {
  document.getElementById(inputId).value = calcContainerTotal(containerId);
}

function readItems(containerId) {
  const items = [];
  let total = 0;
  document.getElementById(containerId).querySelectorAll('.item-row').forEach(r => {
    const prod = r.querySelector('.row-prod').value.trim();
    const qty = parseFloat(r.querySelector('.row-qty').value) || 0;
    const unit = r.querySelector('.row-unit').value;
    const price = parseFloat(r.querySelector('.row-price').value) || 0;
    const lineTotal = round2(qty * price);
    total += lineTotal;
    items.push({ prod, qty, unit, price, total: lineTotal });
  });
  return { items, total: round2(total) };
}

// ================= KAYDETME =================
function saveSale(e) {
  e.preventDefault();
  const { items, total } = readItems('sale-items-container');
  if (items.length === 0) return alert('Lütfen en az bir ürün ekleyin!');

  const paid = Math.max(0, parseFloat(document.getElementById('sale-paid').value) || 0);
  const data = {
    date: document.getElementById('sale-date').value || getTodayString(),
    customer: document.getElementById('sale-customer').value.trim(),
    items, total, paid
  };

  if (editing.sale) {
    const idx = sales.findIndex(s => s.id === editing.sale);
    if (idx >= 0) { const old = sales[idx]; sales[idx] = { id: old.id, ...data, payments: old.payments }; setPaidTo(sales[idx], paid, getTodayString()); }
  } else {
    const r = { id: newId('S'), ...data, payments: [] }; setPaidTo(r, paid, data.date, 'Peşinat'); sales.unshift(r);
  }

  saveAll();
  closeModal('sale-modal');
  applyFilters();
}

function savePurchase(e) {
  e.preventDefault();
  const { items, total } = readItems('purchase-items-container');
  if (items.length === 0) return alert('Lütfen en az bir ürün ekleyin!');

  const paid = Math.max(0, parseFloat(document.getElementById('purchase-paid').value) || 0);
  const data = {
    date: document.getElementById('purchase-date').value || getTodayString(),
    supplier: document.getElementById('purchase-supplier').value.trim(),
    items, total, paid
  };

  if (editing.purchase) {
    const idx = purchases.findIndex(p => p.id === editing.purchase);
    if (idx >= 0) { const old = purchases[idx]; purchases[idx] = { id: old.id, ...data, payments: old.payments }; setPaidTo(purchases[idx], paid, getTodayString()); }
  } else {
    const r = { id: newId('P'), ...data, payments: [] }; setPaidTo(r, paid, data.date, 'Peşinat'); purchases.unshift(r);
  }

  saveAll();
  closeModal('purchase-modal');
  applyFilters();
}

function saveExpense(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
  if (amount <= 0) return alert('Geçerli bir gider tutarı girin.');

  const data = {
    date: document.getElementById('expense-date').value || getTodayString(),
    category: document.getElementById('expense-category').value,
    amount: round2(amount),
    desc: document.getElementById('expense-desc').value.trim(),
    method: expMethod,
    cardId: expMethod === 'card' ? document.getElementById('expense-card').value : '',
    inst: expMethod === 'card' ? Math.min(36, Math.max(1, Math.round(parseFloat(document.getElementById('expense-inst').value)) || 1)) : 1
  };
  if (expMethod === 'card' && !data.cardId) return alert('Önce bir kart seçin veya "+ Kart" ile ekleyin.');

  if (editing.expense) {
    const idx = expenses.findIndex(x => x.id === editing.expense);
    if (idx >= 0) expenses[idx] = { id: editing.expense, ...data };
  } else {
    expenses.unshift({ id: newId('E'), ...data });
  }

  saveAll();
  closeModal('expense-modal');
  applyFilters();
}

// ================= SİLME =================
function deleteRecord(type, id) {
  if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
  if (type === 'sale') sales = sales.filter(s => s.id !== id);
  if (type === 'purchase') purchases = purchases.filter(p => p.id !== id);
  if (type === 'expense') expenses = expenses.filter(e => e.id !== id);
  saveAll();
  applyFilters();
}

// ================= TAHSİLAT / ÖDEME =================
function getPayRecord() {
  if (!activePaymentContext) return null;
  const { type, id } = activePaymentContext;
  return type === 'sale' ? sales.find(s => s.id === id) : purchases.find(p => p.id === id);
}

function refreshPaymentSummary() {
  const rec = getPayRecord();
  if (!rec) return;
  document.getElementById('pay-modal-total').textContent = formatMoney(rec.total);
  document.getElementById('pay-modal-paid').textContent = formatMoney(rec.paid || 0);
  document.getElementById('pay-modal-remaining').textContent = formatMoney(Math.max(0, rec.total - (rec.paid || 0)));
}

function setPayMode(mode) {
  payMode = mode;
  const rec = getPayRecord();
  const addBtn = document.getElementById('pay-mode-add');
  const setBtn = document.getElementById('pay-mode-set');
  const on = ['bg-white', 'text-slate-900', 'shadow-sm'];
  [addBtn, setBtn].forEach(b => { b.classList.remove(...on); b.classList.add('text-slate-600'); });
  const activeBtn = mode === 'add' ? addBtn : setBtn;
  activeBtn.classList.remove('text-slate-600');
  activeBtn.classList.add(...on);

  const input = document.getElementById('pay-modal-amount');
  if (mode === 'add') {
    document.getElementById('pay-modal-amount-label').textContent = 'Eklenecek Tutar (₺)';
    document.getElementById('pay-fill-btn').textContent = 'Kalanı Seç';
    const rem = rec ? Math.max(0, rec.total - (rec.paid || 0)) : 0;
    input.value = rem > 0 ? round2(rem) : '';
  } else {
    document.getElementById('pay-modal-amount-label').textContent = 'Yeni Toplam Tahsil/Ödenen Tutar (₺)';
    document.getElementById('pay-fill-btn').textContent = 'Tamamı';
    input.value = rec ? round2(rec.paid || 0) : '';
  }
}

function openPaymentModal(type, id) {
  activePaymentContext = { type, id };
  const rec = getPayRecord();
  if (!rec) return;

  if (type === 'sale') {
    document.getElementById('pay-modal-title').textContent = 'Müşteri Tahsilatı';
    document.getElementById('pay-modal-label').textContent = 'Müşteri:';
    document.getElementById('pay-modal-name').textContent = rec.customer;
  } else {
    document.getElementById('pay-modal-title').textContent = 'Tedarikçi Ödemesi';
    document.getElementById('pay-modal-label').textContent = 'Tedarikçi:';
    document.getElementById('pay-modal-name').textContent = rec.supplier;
  }
  refreshPaymentSummary();
  const rem = Math.max(0, rec.total - (rec.paid || 0));
  setPayMode(rem > 0 ? 'add' : 'set');
  document.getElementById('pay-modal-date').value = getTodayString();
  document.getElementById('payment-modal').style.display = 'flex';
}

function fillRemainingPayment() {
  const rec = getPayRecord();
  if (!rec) return;
  if (payMode === 'add') {
    document.getElementById('pay-modal-amount').value = round2(Math.max(0, rec.total - (rec.paid || 0)));
  } else {
    document.getElementById('pay-modal-amount').value = round2(rec.total);
  }
}

function confirmPayment() {
  const rec = getPayRecord();
  if (!rec) return;
  const raw = document.getElementById('pay-modal-amount').value;
  if (raw === '') return alert('Lütfen bir tutar girin.');
  const amt = parseFloat(raw);
  if (!isFinite(amt) || amt < 0) return alert('Lütfen geçerli bir tutar girin.');

  if (payMode === 'add') {
    if (amt <= 0) return alert('Eklenecek tutar sıfırdan büyük olmalı.');
    setPaidTo(rec, round2((rec.paid || 0) + amt), document.getElementById('pay-modal-date').value, 'Tahsilat/Ödeme');
  } else {
    setPaidTo(rec, round2(amt), document.getElementById('pay-modal-date').value);
  }

  saveAll();
  closeModal('payment-modal');
  applyFilters();
}

// ================= SEKMELER =================
function switchTab(tabId, scroll) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.classList.add('text-slate-600');
  });
  document.getElementById(tabId).classList.remove('hidden');
  const activeBtn = document.getElementById('nav-' + tabId);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.classList.remove('text-slate-600');
  }
  if (scroll) document.getElementById(tabId).scrollIntoView({ behavior: 'smooth', block: 'start' }); // alt menüden: içeriğe git
}
