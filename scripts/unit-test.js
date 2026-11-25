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
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/assistant.js'), 'utf8') + '\nthis.parseCommand = parseCommand; this.asstSpeechText = asstSpeechText; this.asstMergeText = typeof asstMergeText === "function" ? asstMergeText : null;', actx);
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
  ['alış faturası Halil kardeşi, kıvırcık 20 tane 35 tl', { type: 'purchase', party: 'Halil kardeşi', items: [I('Kıvırcık', 20, 'adet', 35)], paid: 0 }],
  ['Alış faturası Halil kardeşi kıvırcık yirmi tane otuz beş lira', { type: 'purchase', party: 'Halil kardeşi', items: [I('Kıvırcık', 20, 'adet', 35)], paid: 0 }],
  ["satış fişi Latif'e 10 kilo kara lahana 15'ten", { type: 'sale', party: 'Latif', items: [I('Kara lahana', 10, 'kg', 15)] }],
  ["Mehmet'ten faturayla 12 kasa domates 30'dan aldım", { type: 'purchase', party: 'Mehmet', items: [I('Domates', 12, 'kasa', 30)] }],
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
  ['Halil 2 bin 500 ödedi', { type: 'collect', party: 'Halil', amount: 2500 }],
  ['Halil 2 bin beş yüz lira ödedi', { type: 'collect', party: 'Halil', amount: 2500 }],
  ['Halil 1.000.000 ödedi', { type: 'collect', party: 'Halil', amount: 1000000 }],
  ["Halil'e 20 adet kıvırcık yirmi beşten sattım", { type: 'sale', party: 'Halil', items: [I('Kıvırcık', 20, 'adet', 25)] }],
  ["Latif'e 10 kasa marul 2 kasa lahana sattım", { type: 'sale', party: 'Latif', items: [I('Marul', 10, 'kasa', 0), I('Lahana', 2, 'kasa', 0)] }],
  ['Halil bin buçuk lira ödedi', { type: 'collect', party: 'Halil', amount: 1500 }],
  ['Halil iki bin buçuk ödedi', { type: 'collect', party: 'Halil', amount: 2500 }],
  ['Halil yüz buçuk ödedi', { type: 'collect', party: 'Halil', amount: 150 }],
  ["Halil'e iki buçuk kilo lahana 30 liradan sattım", { type: 'sale', party: 'Halil', items: [I('Lahana', 2.5, 'kg', 30)] }],
  ['Halil 9500 ödedi 500 kesti', { type: 'collect', party: 'Halil', amount: 9500, discount: 500, reason: 'Diğer' }],
  ["Fatoş'tan 2000 tahsil ettim 100 iskonto", { type: 'collect', party: 'Fatoş', amount: 2000, discount: 100, reason: 'İskonto' }],
  ['Halil 1000 ödedi 50 yuvarlama', { type: 'collect', party: 'Halil', amount: 1000, discount: 50, reason: 'Yuvarlama' }],
  ["Halil'e 300 lira fire düştüm", { type: 'collect', party: 'Halil', amount: 0, discount: 300, reason: 'Fire / bozuk ürün' }],
  ['Halil 1000 lira ödedi', { type: 'collect', party: 'Halil', amount: 1000, discount: 0 }],
  ["Halil'e 20 kıvırcık 25'ten sattım, 5 maydanoz hediye", { type: 'sale', party: 'Halil', items: [I('Kıvırcık', 20, '', 25), { prod: 'Maydanoz', qty: 5, unit: '', price: 0, gift: true }] }],
  ["Latif'e 3 kasa lahana hediye verdim", { type: 'sale', party: 'Latif', items: [{ prod: 'Lahana', qty: 3, unit: 'kasa', price: 0, gift: true }] }],
  ["hediye 2 kara lahana, Halil'e 10 kilo lahana 15'ten sattım", { type: 'sale', party: 'Halil', items: [{ prod: 'Kara lahana', qty: 2, unit: '', price: 0, gift: true }, I('Lahana', 10, 'kg', 15)] }],
  ['Bu ay ne kadar hediye verdim', { type: 'report', period: 'month', metric: 'gift' }],
  ['Kesintiler ne kadar', { type: 'report', metric: 'discount' }],
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

// ---- iPhone ses parçalarını birleştirme ----
const MT = actx.asstMergeText;
assert.ok(MT, 'asstMergeText tanımlı değil');
assert.strictEqual(MT('kasada ne', 'kasada ne kadar'), 'kasada ne kadar');   // birikimli
assert.strictEqual(MT('kasada ne kadar', 'kasada ne'), 'kasada ne kadar');   // eski parça tekrar geldi
assert.strictEqual(MT('kasada ne kadar', 'var'), 'kasada ne kadar var');     // yeni parça
assert.strictEqual(MT('', 'Halil'), 'Halil');
assert.strictEqual(MT('Halil 500', 'halil 500 ödedi'), 'halil 500 ödedi');   // büyük/küçük harf farkı
console.log('Ses parçası birleştirme testleri geçti.');
