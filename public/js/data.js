function normMove(x) {
  return { id: safeId(x.id, 'M'), date: validDate(x.date), amount: num(x.amount), note: String(x.note || '') };
}
// ================= VERİ NORMALLEŞTİRME =================
function normItems(items) {
  return (Array.isArray(items) ? items : []).filter(it => it && typeof it === 'object').map(it => ({
    prod: String(it.prod || ''),
    qty: num(it.qty),
    unit: String(it.unit || 'kg'),
    price: num(it.price),
    total: num(it.total)
  }));
}

function normSale(s) {
  const items = normItems(s.items);
  return {
    id: safeId(s.id, 'S'),
    date: validDate(s.date),
    customer: String(s.customer || ''),
    items,
    total: num(s.total),
    paid: Math.max(0, num(s.paid))
  };
}

function normPurchase(p) {
  const items = normItems(p.items);
  return {
    id: safeId(p.id, 'P'),
    date: validDate(p.date),
    supplier: String(p.supplier || ''),
    items,
    total: num(p.total),
    paid: Math.max(0, num(p.paid))
  };
}

function normExpense(e) {
  return {
    id: safeId(e.id, 'E'),
    date: validDate(e.date),
    category: String(e.category || 'Diğer'),
    amount: num(e.amount),
    desc: String(e.desc || '')
  };
}

function normList(arr, fn) {
  return (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object').map(fn);
}

// Tek dosya paketi: yedek verileri HTML içine gömülüdür.
// Cihazda kayıt varsa üzerine yazılmaz; yalnızca ilgili yerel kayıt boş/yoksa gömülü yedek kullanılır.
const EMBEDDED_BACKUP = {}; // gerçek veriler artık yalnızca cihazda ve Firestore'da
const EMBEDDED_KEY_MAP = {
  tp_sales: 'sales',
  tp_purchases: 'purchases',
  tp_expenses: 'expenses',
  tp_cards: 'cards',
  tp_cardpay: 'cardPays',
  tp_cash: 'cashMoves'
};
function safeLoad(key) {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return JSON.parse(saved || '[]');
    const field = EMBEDDED_KEY_MAP[key];
    const embedded = field ? EMBEDDED_BACKUP[field] : [];
    return Array.isArray(embedded) ? embedded : [];
  } catch (e) {
    const field = EMBEDDED_KEY_MAP[key];
    return field && Array.isArray(EMBEDDED_BACKUP[field]) ? EMBEDDED_BACKUP[field] : [];
  }
}

// ================= ÖDEME GEÇMİŞİ & KART VERİSİ =================
function normPay(arr, fallbackDate, paid) {
  let p = (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object').map(x => ({
    id: safeId(x.id, 'PY'), date: validDate(x.date), amount: num(x.amount), note: String(x.note || '')
  }));
  if (!p.length && paid > 0) p = [{ id: newId('PY'), date: fallbackDate, amount: round2(paid), note: 'Peşinat' }];
  return p;
}
function sumPay(p) { return round2(p.reduce((a, x) => a + x.amount, 0)); }
function withPay(fn) {
  return function (x) {
    const r = fn(x);
    r.payments = normPay(x.payments, r.date, r.paid);
    r.paid = sumPay(r.payments);
    return r;
  };
}
normSale = withPay(normSale);
normPurchase = withPay(normPurchase);
const _normExpense = normExpense;
normExpense = function (e) {
  const r = _normExpense(e);
  r.method = e.method === 'card' ? 'card' : 'cash';
  r.cardId = r.method === 'card' ? String(e.cardId || '').replace(/[^\w-]/g, '') : '';
  r.inst = r.method === 'card' ? Math.min(36, Math.max(1, Math.round(num(e.inst)) || 1)) : 1;
  return r;
};
function normCard(c) {
  return { id: safeId(c.id, 'C'), name: String(c.name || 'Kart'), dueDay: Math.min(31, Math.max(1, Math.round(num(c.dueDay)) || 1)) };
}
function normCardPay(x) {
  return { id: safeId(x.id, 'CP'), cardId: String(x.cardId || '').replace(/[^\w-]/g, ''), date: validDate(x.date), amount: num(x.amount), note: String(x.note || '') };
}
// Fire: qty stoktan düşen miktar (sayımda fazla çıkarsa eksi olabilir)
function normWaste(x) {
  return { id: safeId(x.id, 'W'), date: validDate(x.date), prod: String(x.prod || '').trim(), unit: String(x.unit || 'kg'), qty: num(x.qty), note: String(x.note || '') };
}
// Toplam ödenen tutarı hedefe getir (fark, tarihli bir hareket olarak yazılır)
function setPaidTo(rec, target, date, note) {
  const diff = round2(target - sumPay(rec.payments));
  if (diff !== 0) rec.payments.push({ id: newId('PY'), date: validDate(date), amount: diff, note: note || 'Düzeltme' });
  rec.paid = sumPay(rec.payments);
}
let cards = normList(safeLoad('tp_cards'), normCard);
let cardPays = normList(safeLoad('tp_cardpay'), normCardPay);
let cashMoves = normList(safeLoad('tp_cash'), normMove);
let wastes = normList(safeLoad('tp_wastes'), normWaste); // fire ve sayım düzeltmeleri

// ================= DURUM =================
let sales = normList(safeLoad('tp_sales'), normSale);
let purchases = normList(safeLoad('tp_purchases'), normPurchase);
let expenses = normList(safeLoad('tp_expenses'), normExpense);

let activePaymentContext = null; // { type: 'sale' | 'purchase', id }
let payMode = 'add';             // 'add' | 'set'
let currentFilterMode = 'all';
const editing = { sale: null, purchase: null, expense: null };
const UNITS = ['kg', 'kasa', 'adet', 'çuval', 'bağ'];

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sale-date').value = getTodayString();
  document.getElementById('purchase-date').value = getTodayString();
  document.getElementById('expense-date').value = getTodayString();
  setQuickDate('today');
  updateBackupBanner();
  // Tarayıcıdan verilerin silinmemesini iste (desteklenirse)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
});

function saveAll() {
  try {
    localStorage.setItem('tp_sales', JSON.stringify(sales));
    localStorage.setItem('tp_purchases', JSON.stringify(purchases));
    localStorage.setItem('tp_expenses', JSON.stringify(expenses));
    localStorage.setItem('tp_cards', JSON.stringify(cards));
    localStorage.setItem('tp_cardpay', JSON.stringify(cardPays));
    localStorage.setItem('tp_cash', JSON.stringify(cashMoves));
    localStorage.setItem('tp_wastes', JSON.stringify(wastes));
  } catch (e) {
    alert('Veriler cihaza kaydedilemedi (depolama dolu veya kapalı olabilir). Lütfen hemen yedek alın.');
  }
  updateBackupBanner();
}
