// İki telefonlu eşitleme testi (Firebase emülatörüyle). Gerçek veriye dokunmaz.
// Kullanım: emülatörler açıkken  node scripts/sync-test.js <tohum.json> <uid>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [seedFile, uid] = process.argv.slice(2);
const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
const dir = path.join(__dirname, '..', 'public');
const EMAIL = 'test@ornek.com', PASS = 'test1234';
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if (!ok) fails++; };

http.createServer((q, res) => {
  const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(b); });
}).listen(8810, run);

async function phone(b, name, local, storageState, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState });
  if (opts.blockFirestore) await ctx.route('http://localhost:8080/**', r => r.abort()); // çekmeyen yer: bulut yok
  await ctx.addInitScript(([s, fresh]) => {
    window.KT_EMULATOR = true;
    if (fresh && !sessionStorage.x) { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.x = 1; }
  }, [local || {}, !storageState]);
  const p = await ctx.newPage();
  p.errs = []; p.dialogs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => { p.dialogs.push(d.message()); opts.dismiss ? d.dismiss() : d.accept(); });
  await p.goto('http://localhost:8810/', { waitUntil: 'networkidle' });
  p.ctx = ctx; p.name = name;
  return p;
}
const data = p => p.evaluate(() => window.__ktGetData());
const statusText = p => p.evaluate(() => document.getElementById('fb-status').textContent);
async function until(p, fn, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await fn()) return true; await p.waitForTimeout(250); }
  return false;
}
async function signIn(p) {
  await p.evaluate(([e, pw]) => firebase.auth().signInWithEmailAndPassword(e, pw), [EMAIL, PASS]);
  return until(p, async () => (await statusText(p)).startsWith('Eşitlendi'));
}
async function addSale(p, customer, qty, price) {
  await p.evaluate(() => openModal('sale-modal'));
  await p.fill('#sale-customer', customer);
  await p.locator('#sale-items-container .row-prod').first().fill('Maydanoz');
  await p.locator('#sale-items-container .row-qty').first().fill(String(qty));
  await p.locator('#sale-items-container .row-price').first().fill(String(price));
  await p.locator('#sale-form').evaluate(f => f.requestSubmit());
}
async function addExpense(p, amount, desc) {
  await p.evaluate(() => openModal('expense-modal'));
  await p.fill('#expense-amount', String(amount));
  await p.fill('#expense-desc', desc);
  await p.locator('#expense-form').evaluate(f => f.requestSubmit());
}
const counts = d => `${d.sales.length}/${d.purchases.length}/${d.expenses.length}/${d.cards.length}/${d.cashMoves.length}`;

async function run() {
  const b = await chromium.launch();
  const expected = `${JSON.parse(seed.tp_sales).length}/${JSON.parse(seed.tp_purchases).length}/${JSON.parse(seed.tp_expenses).length}/${JSON.parse(seed.tp_cards).length}/${JSON.parse(seed.tp_cash).length}`;

  console.log('1) Telefon A (eski verisi cihazda) giriş yapar');
  const A = await phone(b, 'A', seed);
  check(await signIn(A), 'A eşitlendi: ' + await statusText(A));
  const dA = await data(A);
  check(counts(dA) === expected, `A kayıt sayıları ${counts(dA)} = ${expected}`);
  check(A.dialogs.length === 0, 'A için onay sorusu çıkmadı (silme yok)');

  console.log('2) Telefon B (boş cihaz) giriş yapar, her şey buluttan gelir');
  const B = await phone(b, 'B', {});
  check(await signIn(B), 'B eşitlendi');
  check(counts(await data(B)) === expected, `B kayıt sayıları ${counts(await data(B))}`);
  check(JSON.stringify((await data(B)).sales.map(s => s.id).sort()) === JSON.stringify(dA.sales.map(s => s.id).sort()), 'A ve B aynı satış kimlikleri');

  console.log('3) A satış ekler → B canlı görür');
  await addSale(A, 'Canlı Test', 10, 7.5);
  check(await until(B, async () => (await data(B)).sales.some(s => s.customer === 'Canlı Test' && s.total === 75)), 'B yeni satışı aldı (75 TL)');

  console.log('4) B o satışı siler → A canlı görür');
  const sid = (await data(B)).sales.find(s => s.customer === 'Canlı Test').id;
  await B.evaluate(id => deleteRecord('sale', id), sid);
  check(await until(A, async () => !(await data(A)).sales.some(s => s.id === sid)), 'A’dan da silindi');

  console.log('5) A çevrimdışıyken gider girer, aynı anda B satış girer; A çevrimiçi olunca ikisi de her yerde');
  await A.ctx.setOffline(true); await A.evaluate(() => window.dispatchEvent(new Event('offline')));
  await addExpense(A, 123.45, 'Çevrimdışı mazot');
  await addSale(B, 'Eş Zamanlı', 4, 25);
  await A.waitForTimeout(1500);
  check(!(await data(B)).expenses.some(e => e.desc === 'Çevrimdışı mazot'), 'A çevrimdışıyken gider B’ye gitmedi (beklenen)');
  await A.ctx.setOffline(false); await A.evaluate(() => window.dispatchEvent(new Event('online')));
  check(await until(B, async () => (await data(B)).expenses.some(e => e.desc === 'Çevrimdışı mazot')), 'internet gelince gider B’ye ulaştı');
  check(await until(A, async () => (await data(A)).sales.some(s => s.customer === 'Eş Zamanlı')), 'B’nin satışı A’ya ulaştı');

  console.log('6) A çevrimdışı kayıt girer ve buluta göndermeden uygulama kapanır; yeniden açılınca yüklenir');
  await A.ctx.setOffline(true);
  await addExpense(A, 9.99, 'Kapanmadan önce');
  const state = await A.ctx.storageState();
  await A.ctx.close();
  const A2 = await phone(b, 'A2', null, state);
  check(await signIn(A2), 'A yeniden açıldı ve eşitlendi');
  check(await until(B, async () => (await data(B)).expenses.some(e => e.desc === 'Kapanmadan önce')), 'kapanmadan önceki gider B’ye ulaştı');
  check(A2.dialogs.length === 0, 'yeniden açılışta silme sorusu çıkmadı');

  console.log('7) B iki kez aynı anda düzenlemez; A2 ve B sayıları eşit');
  await B.waitForTimeout(1500);
  check(counts(await data(A2)) === counts(await data(B)), `A ${counts(await data(A2))} = B ${counts(await data(B))}`);

  console.log('8) Toplu silme (11 kayıt) onaysız gitmez');
  B.dialogs.length = 0;
  await B.evaluate(() => { const ids = new Set(sales.slice(0, 11).map(s => s.id)); sales = sales.filter(s => !ids.has(s.id)); saveAll(); applyFilters(); });
  check(await until(B, async () => B.dialogs.some(m => m.includes('Buluttan 11 kayıt silinecek'))), 'onay sorusu çıktı: "Buluttan 11 kayıt silinecek"');
  check(await until(A2, async () => (await data(A2)).sales.length === (await data(B)).sales.length), 'onaylanınca A’dan da silindi');

  console.log('9) Güvenlik kuralları');
  const denied = async (fn) => A2.evaluate(fn).then(() => false, e => /permission/i.test(e.message || e.code));
  check(await denied(() => firebase.firestore().doc(`users/${firebase.auth().currentUser.uid}/appData/main`).set({ x: 1 })), 'eski tek belgeye yazma reddedildi');
  check(await denied(() => firebase.firestore().doc('users/baskasi/sales/S_1').set({ ownerUid: 'baskasi', data: { id: 'S_1' }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })), 'başka hesaba yazma reddedildi');
  check(await denied(() => { const u = firebase.auth().currentUser.uid; return firebase.firestore().doc(`users/${u}/sales/S_X`).set({ ownerUid: u, data: { id: 'BASKA' }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); }), 'kimliği tutmayan kayıt reddedildi');
  check(await A2.evaluate(() => firebase.firestore().doc(`users/${firebase.auth().currentUser.uid}/appData/main`).get().then(d => d.exists && d.data().revision === 122)), 'eski belge (rev 122) okunabiliyor ve değişmemiş');

  console.log('10) Gecikme rozetleri ve WhatsApp hatırlatma (A2)');
  await A2.evaluate(() => switchTab('tab-reports'));
  const badges = await A2.locator('#all-customers span:has-text(" gün")').count();
  check(badges > 0, `cari listesinde gecikme rozeti var (${badges} müşteri)`);
  const idx = await A2.evaluate(() => partyNames.customer.findIndex(n => sales.some(s => s.customer === n && s.total - (s.paid || 0) > 0.005)));
  await A2.evaluate(i => { window.__opened = []; window.open = u => { window.__opened.push(u); }; openStatement('customer', i); }, idx);
  check(await A2.locator('#stmt-contact').isVisible(), 'müşteri ekstresinde telefon satırı görünüyor');
  await A2.fill('#stmt-phone', '0532 123 45 67'); await A2.locator('#stmt-phone').dispatchEvent('change');
  await A2.locator('#stmt-contact button').click();
  const url = (await A2.evaluate(() => window.__opened[0])) || '';
  const want = await A2.evaluate(i => { const n = partyNames.customer[i]; return formatMoney(round2(sales.filter(s => fk(s.customer) === fk(n)).reduce((a, s) => a + s.total - (s.paid || 0), 0))); }, idx);
  check(url.startsWith('https://wa.me/905321234567?text=') && decodeURIComponent(url).includes(want), `WhatsApp bağlantısı doğru numara ve bakiyeyle açıldı (${want})`);
  const name = await A2.evaluate(i => fk(partyNames.customer[i]), idx);
  check(await until(B, async () => (await data(B)).phones[name] === '0532 123 45 67'), 'telefon numarası B’ye eşitlendi');
  await A2.evaluate(() => { closeModal('stmt-modal'); openStatement('supplier', 0); });
  check(!(await A2.locator('#stmt-contact').isVisible()), 'tedarikçi ekstresinde telefon satırı yok');

  console.log('11) Fire kaydı eşitlenir');
  await A2.evaluate(() => { closeModal('stmt-modal'); openWasteModal(); });
  await A2.fill('#waste-prod', 'Maydanoz'); await A2.locator('#waste-prod').dispatchEvent('input'); await A2.fill('#waste-qty', '3');
  await A2.evaluate(() => saveWaste());
  check(await until(B, async () => (await data(B)).wastes.some(w => w.prod === 'Maydanoz' && w.qty === 3 && w.unit === 'adet')), 'fire kaydı (3 adet maydanoz) B’ye ulaştı');

  console.log('12) Çekmeyen yerde açılış: telefondaki kayıtlar silinmez');
  const st12 = await A2.ctx.storageState({ indexedDB: true }), before12 = counts(await data(A2));
  const C = await phone(b, 'C', null, st12, { blockFirestore: true });
  await C.waitForTimeout(20000);
  check(counts(await data(C)) === before12, `bulut yokken kayıtlar duruyor (${counts(await data(C))} = ${before12})`);
  check(!(await statusText(C)).startsWith('Eşitlendi'), 'bulut yokken "Eşitlendi" denmedi: ' + await statusText(C));
  check(!C.dialogs.some(m => m.includes('silinecek')), 'silme sorusu çıkmadı');
  await C.ctx.close();

  console.log('13) Yeni telefon işletme adını ve telefonları silmez');
  await A2.evaluate(() => { document.getElementById('stmt-biz').value = 'Karacaahmet Test'; saveBiz(); });
  check(await until(B, async () => (await data(B)).biz === 'Karacaahmet Test'), 'işletme adı B’ye ulaştı');
  const phonesBefore = JSON.stringify((await data(B)).phones);
  const F = await phone(b, 'F', {});
  check(await signIn(F), 'boş yeni telefon eşitlendi');
  await F.waitForTimeout(2000);
  check((await data(F)).biz === 'Karacaahmet Test' && JSON.stringify((await data(F)).phones) === phonesBefore, 'yeni telefona işletme adı ve telefonlar geldi');
  check((await data(B)).biz === 'Karacaahmet Test' && JSON.stringify((await data(B)).phones) === phonesBefore, 'B’de işletme adı ve telefonlar silinmedi');
  await F.ctx.close();

  console.log('14) Eski verili, hiç eşitlenmemiş telefon buluttaki düzenlemeyi ezmez, silineni geri getirmez');
  const sid14 = await A2.evaluate(() => { const s = sales.find(x => x.total - (x.paid || 0) > 5); s.payments.push({ id: newId('PY'), date: getTodayString(), amount: 1, note: 'test14' }); s.paid = sumPay(s.payments); saveAll(); return s.id; });
  check(await until(B, async () => (await data(B)).sales.find(s => s.id === sid14).payments.some(p => p.note === 'test14')), 'düzenleme B’ye ulaştı');
  const countB14 = (await data(B)).sales.length;
  const D = await phone(b, 'D', seed, null, { dismiss: true });
  check(await signIn(D), 'eski verili telefon eşitlendi');
  check((await data(D)).sales.find(s => s.id === sid14).payments.some(p => p.note === 'test14'), 'eski telefon buluttaki yeni hâli aldı (ezmedi)');
  check(D.dialogs.some(m => m.includes('bulutta olmayan')), 'buluttaki olmayan kayıtlar için soru soruldu');
  await B.waitForTimeout(2500);
  check((await data(B)).sales.length === countB14, `silinen kayıtlar geri gelmedi (B: ${(await data(B)).sales.length} = ${countB14})`);
  await D.ctx.close();

  console.log('15) İki telefon aynı satışa aynı anda tahsilat girer: ikisi de korunur');
  const sid15 = await A2.evaluate(() => sales.find(x => x.total - (x.paid || 0) > 200).id);
  for (const P of [A2, B]) { await P.ctx.setOffline(true); await P.evaluate(() => window.dispatchEvent(new Event('offline'))); }
  await A2.evaluate(id => { const s = sales.find(x => x.id === id); s.payments.push({ id: newId('PY'), date: getTodayString(), amount: 50, note: 'A15' }); s.paid = sumPay(s.payments); saveAll(); }, sid15);
  await B.evaluate(id => { const s = sales.find(x => x.id === id); s.payments.push({ id: newId('PY'), date: getTodayString(), amount: 70, note: 'B15' }); s.paid = sumPay(s.payments); saveAll(); }, sid15);
  await A2.ctx.setOffline(false); await A2.evaluate(() => window.dispatchEvent(new Event('online')));
  await A2.waitForTimeout(3000);
  await B.ctx.setOffline(false); await B.evaluate(() => window.dispatchEvent(new Event('online')));
  const both = P => async () => { const s = (await data(P)).sales.find(x => x.id === sid15); return ['A15', 'B15'].every(n => s.payments.some(p => p.note === n)) && Math.abs(s.paid - s.payments.reduce((a, p) => a + p.amount, 0)) < 0.01; };
  check(await until(A2, both(A2), 20000), 'A’da iki tahsilat da var ve ödenen toplamı doğru');
  check(await until(B, both(B), 20000), 'B’de iki tahsilat da var ve ödenen toplamı doğru');

  const errs = [...A.errs, ...B.errs, ...A2.errs];
  check(errs.length === 0, 'sayfa hatası yok ' + (errs.length ? JSON.stringify(errs.slice(0, 3)) : ''));
  console.log(fails ? `SONUÇ: ${fails} KONTROL BAŞARISIZ` : 'SONUÇ: TÜM KONTROLLER GEÇTİ');
  await b.close(); process.exit(fails ? 1 : 0);
}
