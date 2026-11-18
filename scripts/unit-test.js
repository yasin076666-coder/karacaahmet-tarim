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
