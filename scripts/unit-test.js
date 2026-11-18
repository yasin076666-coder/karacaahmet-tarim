// public/js/util.js içindeki saf fonksiyonların testi.  node scripts/unit-test.js
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/util.js'), 'utf8'), ctx);
const { waPhone } = ctx;

for (const [inp, want] of [
  ['0532 123 45 67', '905321234567'],
  ['532-123-45-67', '905321234567'],
  ['+90 (532) 123 45 67', '905321234567'],
  ['905321234567', '905321234567'],
  ['0212 123 45 67', ''],   // sabit hat: WhatsApp değil
  ['0532 123 45', ''],      // eksik hane
  ['', ''], [null, ''],
]) assert.strictEqual(waPhone(inp), want, `waPhone(${JSON.stringify(inp)})`);

vm.runInContext('getTodayString = () => "2026-11-20"', ctx);
assert.strictEqual(ctx.daysSince('2026-11-20'), 0);
assert.strictEqual(ctx.daysSince('2026-10-21'), 30);
assert.strictEqual(ctx.daysSince('2026-03-29'), 236); // yaz saati geçişini kapsar
console.log('Birim testleri geçti.');

// ---- Asistan ayrıştırıcısı ----
const actx = {};
vm.createContext(actx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/assistant.js'), 'utf8') + '\nthis.parseCommand = parseCommand; this.asstSpeechText = asstSpeechText;', actx);
const C = { today: '2026-11-20', customers: ['Halil kardeşi', 'Halil', 'Kor ateş', 'Latif', 'Fatoş'], suppliers: ['Hal', 'Mehmet'], products: ['Kıvırcık', 'Lahana', 'Kara lahana', 'Maydanoz', 'Düz marul'] };
const P = t => JSON.parse(JSON.stringify(actx.parseCommand(t, C)));
const I = (prod, qty, unit, price) => ({ prod, qty, unit, price });
const cases = [
  ["Halil'e 20 adet kıvırcık 25 liradan sattım, 200 peşin aldım", { type: 'sale', party: 'Halil', items: [I('Kıvırcık', 20, 'adet', 25)], paid: 200 }],
  ["Halil kardeşi'ne 10 kilo lahana 15'ten sattım", { type: 'sale', party: 'Halil kardeşi', items: [I('Lahana', 10, 'kg', 15)], paid: 0 }],
  ['Kor ateşe yirmi beş adet maydanoz tanesi 5 lira sattım peşin', { type: 'sale', party: 'Kor ateş', items: [I('Maydanoz', 25, 'adet', 5)], paid: 'full' }],
  ["Latif'e 30 kıvırcık 20 ve 5 kilo kara lahana 18 sattım veresiye", { type: 'sale', party: 'Latif', items: [I('Kıvırcık', 30, '', 20), I('Kara lahana', 5, 'kg', 18)], paid: 0 }],
  ["Mehmet'ten 40 kasa kıvırcık 22 liradan aldım, 500 ödedim", { type: 'purchase', party: 'Mehmet', items: [I('Kıvırcık', 40, 'kasa', 22)], paid: 500 }],
  ["Halden 30 kasa düz marul 18'den aldım", { type: 'purchase', party: 'Hal', items: [I('Düz marul', 30, 'kasa', 18)], paid: 0 }],
  ['500 lira mazot', { type: 'expense', amount: 500, category: 'Mazot / Yakıt', card: false, date: '2026-11-20' }],
  ['dün yemek 250 lira kartla', { type: 'expense', amount: 250, category: 'Yemek / Çay', card: true, date: '2026-11-19' }],
  ['1.500 lira kira ödedim', { type: 'expense', amount: 1500, category: 'Kira' }],
  ['Halil 1000 lira ödedi', { type: 'collect', party: 'Halil', amount: 1000 }],
  ["Fatoş'tan 300 tahsil ettim", { type: 'collect', party: 'Fatoş', amount: 300 }],
  ["Mehmet'e 2000 lira ödedim", { type: 'pay', party: 'Mehmet', amount: 2000 }],
  ['Ahmet 15 adet kıvırcık 25 sattım', { type: 'sale', party: 'Ahmet', items: [I('Kıvırcık', 15, 'adet', 25)] }],
  ["bir kasa kıvırcık iki yüz liraya sattım Latif'e", { type: 'sale', party: 'Latif', items: [I('Kıvırcık', 1, 'kasa', 200)] }],
  ["Halil'e 20 kıvırcık sattım", { type: 'sale', party: 'Halil', items: [I('Kıvırcık', 20, '', 0)] }],
  ['dün Halil kardeşine iki buçuk kilo lahana 30 liradan sattım', { type: 'sale', party: 'Halil kardeşi', date: '2026-11-19', items: [I('Lahana', 2.5, 'kg', 30)] }],
  ['Bugün ne kadar sattım?', { type: 'report', period: 'today', metric: 'sales', party: null }],
  ['Bu ay kâr ne kadar', { type: 'report', period: 'month', metric: 'profit' }],
  ["Halil'in borcu ne kadar", { type: 'report', metric: 'balance', party: { name: 'Halil', kind: 'customer' } }],
  ['Kasada ne kadar var', { type: 'report', metric: 'cash' }],
  ['Bu hafta en çok ne sattım', { type: 'report', period: 'week', metric: 'top' }],
  ['merhaba', { type: 'unknown' }],
];
let bad = 0;
for (const [text, want] of cases) {
  const got = P(text), diff = Object.keys(want).filter(k => JSON.stringify(got[k]) !== JSON.stringify(want[k]));
  if (diff.length) { bad++; console.log('✘', JSON.stringify(text), '\n   beklenen', JSON.stringify(want), '\n   bulunan ', JSON.stringify(got)); }
}
assert.strictEqual(bad, 0, `${bad} asistan cümlesi yanlış anlaşıldı`);
console.log(`Asistan: ${cases.length} cümlenin hepsi doğru anlaşıldı.`);

// ---- Sesli okuma metni ----
const ST = actx.asstSpeechText;
assert.strictEqual(ST('Bu ay: satış ₺12.500,00 − alış ₺3.000,50 − gider ₺0,00 = net kâr <b>₺9.499,50</b>'), 'Bu ay: satış 12.500 lira eksi alış 3.000 lira 50 kuruş eksi gider 0 lira eşittir net kâr 9.499 lira 50 kuruş');
assert.strictEqual(ST('💵 Kasadaki nakit: <b>₺10.382,00</b>'), 'Kasadaki nakit: 10.382 lira');
assert.strictEqual(ST('Bu ay en çok satılanlar: <br>1. <b>Kıvırcık</b> 20 adet · ₺500,00'), 'Bu ay en çok satılanlar: . 1. Kıvırcık 20 adet , 500 lira');
console.log('Sesli okuma metni testleri geçti.');
