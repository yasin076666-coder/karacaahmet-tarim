// ================= YARDIMCI FONKSİYONLAR =================
// HTML kaçışı (XSS koruması)
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function pad(n) { return String(n).padStart(2, '0'); }

// Yerel saate göre YYYY-MM-DD (UTC kayması yok)
function toDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function getTodayString() { return toDateStr(new Date()); }

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function newId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ID'yi güvenli karaktere indir (onclick içinde kullanıldığı için)
function safeId(id, prefix) {
  const c = String(id || '').replace(/[^\w-]/g, '');
  return c || newId(prefix);
}

function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : getTodayString();
}
// "0532 123 45 67", "532...", "+90 532..." → "905321234567" (wa.me biçimi); cep numarası değilse ''.
function waPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 && d[0] === '5' ? '90' + d : '';
}
function daysSince(date) { return Math.round((Date.parse(getTodayString()) - Date.parse(date)) / 864e5); }
