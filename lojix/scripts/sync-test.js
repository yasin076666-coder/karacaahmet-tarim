// Ekip eşitleme testi (Firebase emülatörüyle). Gerçek veriye dokunmaz.
// Kullanım: emülatörler açıkken (npx firebase-tools emulators:start --only auth,firestore --project lojix-pro)
//   node scripts/sync-test.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
const dir = path.join(__dirname, '..', 'public');
const USERS_P_EMAIL = 'ortak@moonlog.test';
const PROJECT = 'lojix-pro', EMU = 'http://localhost', PASS = 'test1234';
// Kurallardaki gerçek ekip UID'leri + üye olmayan biri
// a ve b yazabilir; r ekipte ama yalnızca görür; x ekip dışı
const USERS = { a: ['s8DnbccECcQEN8i48fqO5r68yky1', 'a@test.com'], b: ['yBvvM9DhzXaOzq77zh64mwIdF3l2', 'b@test.com'], r: ['kSPDmR5caBhnLXJQTJSVaTiuBcj2', 'r@test.com'], x: ['yabanciUid000000000000000000', 'x@test.com'], p: ['ortakUid00000000000000000001', 'ortak@moonlog.test'] };
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if (!ok) fails++; };
const type = f => ({ js: 'text/javascript', css: 'text/css', png: 'image/png', webmanifest: 'application/manifest+json' })[f.split('.').pop()] || 'text/html';

async function req(method, url, body, headers = {}) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(method + ' ' + url + ' ' + r.status + ' ' + await r.text());
  return r.status === 200 ? r.json().catch(() => ({})) : {};
}
const fsUrl = p => `${EMU}:8080/v1/projects/${PROJECT}/databases/(default)/documents${p}`;
const OWNER = { Authorization: 'Bearer owner' };  // emülatörde kurallları atlar
async function reset() {
  await req('DELETE', `${EMU}:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
  await req('DELETE', `${EMU}:9099/emulator/v1/projects/${PROJECT}/accounts`);
  await req('POST', `${EMU}:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchCreate`,
    { users: Object.values(USERS).map(([localId, email]) => ({ localId, email, rawPassword: PASS, emailVerified: true })) }, OWNER);
}
// Eski tek belgeyi (lojix_data/1) emülatöre yazar: Firestore REST değer biçimine çevirir.
const fv = v => v === null || v === undefined ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(fv) } }
  : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fv(x)])) } }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
async function putLegacy(data) { await req('PATCH', fsUrl('/lojix_data/1'), { fields: { data: fv(data), updated_at: fv('2026-10-23T00:00:00Z') } }, OWNER); }
async function countDocs(kind) { const r = await req('GET', fsUrl(`/fleets/lojix/${kind}?pageSize=300`), null, OWNER); return (r.documents || []).length; }

http.createServer((q, res) => {
  const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': type(f) }); res.end(b); });
}).listen(8811, run);

async function phone(b, name, local) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => { window.LX_EMULATOR = true; if (!sessionStorage.x) { localStorage.clear(); if (s) localStorage.setItem('FRIGO_FILO_PRO_V1', s); sessionStorage.x = 1; } }, local ? JSON.stringify(local) : null);
  const p = await ctx.newPage();
  p.errs = []; p.dialogs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => { p.dialogs.push(d.message()); d.accept(); });
  await p.goto('http://localhost:8811/', { waitUntil: 'networkidle' });
  p.ctx = ctx; return p;
}
const st = p => p.evaluate(() => state);
const status = p => p.evaluate(() => document.getElementById('lojix-cloud-status').textContent);
async function until(p, fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await p.waitForTimeout(250); } return false; }
async function signIn(p, who) {
  await p.evaluate(() => switchTab('settings'));
  await p.fill('#lojix-cloud-email', USERS[who][1]); await p.fill('#lojix-cloud-password', PASS); await p.click('#lojix-cloud-login');
  return until(p, async () => (await status(p)).startsWith('Eşitlendi'));
}
async function addExpense(p, amount, note) {
  await p.evaluate(() => openModal('expenseModal'));
  await p.fill('#expAmount', String(amount)); await p.fill('#expNote', note);
  await p.locator('#expenseModal-form').evaluate(f => f.requestSubmit());
}

async function run() {
  const b = await chromium.launch();
  try {
    await reset();
    console.log('1) Eski tek belge bulutta, yeni sürümün ilk girişi onu taşır');
    const legacy = JSON.parse(JSON.stringify(seed));
    legacy.clients = [{ id: 'C1', name: 'Akdeniz Sebze A.Ş.' }];   // eski sürüm sıra numaralı kimlik kullanıyordu
    await putLegacy(legacy);
    // A telefonunda bulutta olmayan bir yerel kayıt ve buluttakinden farklı bir sefer var
    const localA = JSON.parse(JSON.stringify(seed));
    localA.expenses.push({ id: 1799999999999, date: '2026-11-17', vehicleId: 'V0', driver: 'Ahmet Yılmaz', category: 'Lastik & Kaplama', amount: 9000, note: 'yalnız A telefonunda' });
    localA.trips[0].price = 1;
    const A = await phone(b, 'A', localA);
    check(await signIn(A, 'a'), 'A girişi ve ilk eşitleme: ' + await status(A));
    const sa = await st(A);
    check(sa.trips.length === seed.trips.length, `A seferleri: ${sa.trips.length}`);
    check(sa.expenses.length === seed.expenses.length + 1, `A'nın yerel gideri korundu ve eklendi: ${sa.expenses.length}`);
    check(sa.trips.find(t => t.id === seed.trips[0].id).price === seed.trips[0].price, 'İlk eşitlemede çakışan seferde bulut kazandı');
    check(await A.evaluate(() => !!localStorage.getItem('FRIGO_FILO_PRO_V1_PRE_SYNC_BACKUP')), 'Cihazdaki eski hâl yerel yedekte duruyor');
    check(await until(A, async () => await countDocs('trips') === seed.trips.length), 'Seferler buluta tek tek yazıldı');
    check(await countDocs('expenses') === seed.expenses.length + 1, 'Giderler buluta yazıldı');
    check(await countDocs('clients') === 3 && sa.clients.every(c => c.id.startsWith('C_')), 'Müşteriler addan türeyen kimlikle, çift kayıt olmadan yazıldı');

    console.log('2) İkinci telefon (B, boş cihaz) aynı filoyu görür, kayıtlar anında gider gelir');
    const B = await phone(b, 'B', null);
    check(await signIn(B, 'b'), 'B girişi: ' + await status(B));
    check((await st(B)).trips.length === seed.trips.length && (await st(B)).vehicles.length === seed.vehicles.length, 'B tüm filoyu aldı');
    await addExpense(B, 777, 'B telefonundan gider');
    check(await until(A, async () => (await st(A)).expenses.some(e => e.note === 'B telefonundan gider')), 'B\'nin gideri A\'ya canlı geldi');
    const victim = seed.trips[1].id;
    await A.evaluate(id => delItem('trips', id), victim);
    check(await until(B, async () => !(await st(B)).trips.some(t => t.id === victim)), 'A\'da silinen sefer B\'den de silindi');
    await A.evaluate(id => editRecord('trips', id), seed.trips[2].id);
    await A.fill('#tripPrice', '99999'); await A.locator('#tripModal-form').evaluate(f => f.requestSubmit());
    check(await until(B, async () => (await st(B)).trips.find(t => t.id === seed.trips[2].id).price === 99999), 'A\'daki düzenleme B\'ye geldi');

    console.log('3) Çevrimdışı kayıt, internet gelince gider');
    await B.ctx.setOffline(true);
    await addExpense(B, 555, 'çevrimdışı gider');
    await B.ctx.setOffline(false);
    check(await until(A, async () => (await st(A)).expenses.some(e => e.note === 'çevrimdışı gider'), 20000), 'Çevrimdışı gider A\'ya ulaştı');

    console.log('4) Yeniden açılış: tekrar yükleme ya da silme olmaz');
    const before = await countDocs('trips');
    await A.reload({ waitUntil: 'load' });
    check(await until(A, async () => (await status(A)).startsWith('Eşitlendi')), 'A yeniden eşitlendi');
    check(await countDocs('trips') === before && (await st(A)).trips.length === before, `Sefer sayısı değişmedi: ${before}`);

    console.log('5) Ekipte olmayan hesap verilere erişemez');
    const X = await phone(b, 'X', null);
    await X.evaluate(() => switchTab('settings'));
    await X.fill('#lojix-cloud-email', USERS.x[1]); await X.fill('#lojix-cloud-password', PASS); await X.click('#lojix-cloud-login');
    check(await until(X, async () => (await status(X)).includes('erişim izni yok')), 'Yabancı hesaba izin verilmedi: ' + await status(X));
    check((await st(X)).trips.length === 0, 'Yabancı hesap hiçbir kayıt görmedi');

    console.log('6) Yalnızca görebilen hesap');
    const Rp = await phone(b, 'R', null);
    check(await signIn(Rp, 'r'), 'Görüntüleme hesabı girişi: ' + await status(Rp));
    check((await st(Rp)).trips.length === (await st(A)).trips.length, 'Görüntüleme hesabı tüm filoyu görüyor');
    check(await Rp.evaluate(() => document.body.classList.contains('ro') && getComputedStyle(document.getElementById('fab')).display === 'none'), 'Ekleme düğmeleri gizli');
    await Rp.evaluate(() => openModal('tripModal'));
    check(!(await Rp.evaluate(() => document.getElementById('tripModal').classList.contains('flex'))) && (await Rp.textContent('#toasts')).includes('yalnızca görüntüleyebilir'), 'Form açılmadı, nedeni bildirildi');
    const before6 = (await st(A)).trips.length, tid = (await st(Rp)).trips[0].id;
    await Rp.evaluate(id => delItem('trips', id), tid);
    check((await st(Rp)).trips.length === before6, 'Silme engellendi');
    // Kural düzeyi: uygulamayı atlayıp doğrudan Firestore'a yazma denemesi reddedilmeli
    const denied = await Rp.evaluate(async () => { try { await firebase.firestore().collection('fleets').doc('lojix').collection('expenses').doc('999').set({ data: { id: 999, amount: 1 }, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: firebase.auth().currentUser.uid }); return 'yazdı'; } catch (e) { return e.code; } });
    check(denied === 'permission-denied', 'Bulut kuralı doğrudan yazmayı reddetti: ' + denied);
    await addExpense(A, 321, 'A yeni gider');
    check(await until(Rp, async () => (await st(Rp)).expenses.some(e => e.note === 'A yeni gider')), 'Yazabilen hesabın kaydı görüntüleme hesabına canlı geldi');

    console.log('7) İş ortağı (Moonlog): kendi kayıtları, kısıtlı ekran, çöp kutusu');
    await A.evaluate(() => switchTab('settings'));
    await A.fill('#partnerName', 'Deneme Ortak'); await A.fill('#partnerEmail', USERS_P_EMAIL); await A.selectOption('#partnerCompany', 'IC_MOONLOG');
    await A.locator('#partnerForm').evaluate(f => f.requestSubmit());
    check(await until(A, async () => (await A.textContent('#users-list')).includes(USERS_P_EMAIL)), 'Yönetici iş ortağını ekledi');
    const Pp = await phone(b, 'P', null);
    check(await signIn(Pp, 'p'), 'İş ortağı girişi: ' + await status(Pp));
    check(await Pp.evaluate(() => window.LX_ROLE === 'partner' && document.body.classList.contains('partner')), 'Rol: iş ortağı');
    const sp = await st(Pp);
    check(sp.trips.length === 0 && sp.expenses.length === 0 && sp.fuels.length === 0 && sp.payments.length === 0 && sp.vehicles.length > 0, 'Başkalarının kayıtlarını görmüyor, araç listesini görüyor');
    await Pp.evaluate(() => switchTab('cari'));
    check(await Pp.evaluate(() => document.getElementById('tab-trips').classList.contains('active')), 'Cari sayfası kapalı, seferlere yönlendi');
    check(await Pp.evaluate(() => getComputedStyle(document.querySelector('#side [data-tab=dashboard]')).display === 'none' && getComputedStyle(document.querySelector('th.pk')).display === 'none' && getComputedStyle(document.getElementById('tripPreview')).display === 'none'), 'Özet menüsü, kâr sütunu ve formdaki kâr tahmini gizli');
    await Pp.evaluate(() => openModal('tripModal'));
    check(await Pp.inputValue('#tripCompany') === 'IC_MOONLOG' && await Pp.evaluate(() => document.getElementById('tripCompany').disabled), 'Seferde Moonlog kilitli seçili');
    await Pp.fill('#tripRoute', 'Antalya - Kayseri'); await Pp.fill('#tripClient', 'Ortak Müşteri'); await Pp.fill('#tripPrice', '40000');
    await Pp.locator('#tripModal-form').evaluate(f => f.requestSubmit());
    await addExpense(Pp, 1500, 'ortak gideri');
    check(await until(A, async () => (await st(A)).trips.some(t => t.route === 'Antalya - Kayseri' && t.createdByName === 'Deneme Ortak' && t.intermediaryCompanyId === 'IC_MOONLOG')), 'Ortağın seferi yöneticiye ekleyen adıyla geldi');
    check(await until(A, async () => (await st(A)).expenses.some(e => e.note === 'ortak gideri')), 'Ortağın gideri yöneticiye geldi');
    const rd = await Pp.evaluate(async () => { const c = firebase.firestore().collection('fleets').doc('lojix'); const r = {}; try { await c.collection('trips').get(); r.all = 'okudu'; } catch (e) { r.all = e.code; } try { await c.collection('payments').get(); r.pay = 'okudu'; } catch (e) { r.pay = e.code; } try { await c.collection('vehicles').doc('V0').set({ data: { id: 'V0', plate: 'X' }, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: firebase.auth().currentUser.uid }); r.veh = 'yazdı'; } catch (e) { r.veh = e.code; }
      try { await c.collection('trips').doc('5').set({ data: { id: 5, createdBy: firebase.auth().currentUser.uid, intermediaryCompanyId: 'IC_TALYA' }, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: firebase.auth().currentUser.uid }); r.co = 'yazdı'; } catch (e) { r.co = e.code; } try { await c.collection('trash').get(); r.trash = 'okudu'; } catch (e) { r.trash = e.code; } return r; });
    check(rd.all === 'permission-denied' && rd.pay === 'permission-denied', 'Kural: ortak tüm seferleri ve tahsilatları okuyamaz ' + JSON.stringify(rd));
    check(rd.veh === 'permission-denied' && rd.co === 'permission-denied' && rd.trash === 'permission-denied', 'Kural: araca, başka şirketli sefere ve çöp kutusuna erişemez');
    await Pp.evaluate(() => openSheet('quickSheet')); await Pp.fill('#asst-input', 'bu ay net kâr ne kadar'); await Pp.locator('#asst-input').press('Enter');
    check((await Pp.textContent('#asst-out')).includes('yalnızca yönetici'), 'Asistan iş ortağına kâr bilgisi vermedi');
    await Pp.evaluate(() => closeSheet('quickSheet'));
    const ot = (await st(Pp)).trips[0];
    await Pp.evaluate(id => editRecord('trips', id), ot.id); await Pp.fill('#tripPrice', '42000'); await Pp.locator('#tripModal-form').evaluate(f => f.requestSubmit());
    const oe = (await st(Pp)).expenses[0];
    await Pp.evaluate(id => delItem('expenses', id), oe.id);
    await A.evaluate(() => switchTab('trash'));
    const mine = () => A.evaluate(() => (window.__lxTrash || []).filter(t => t.byName === 'Deneme Ortak').map(t => t.action + ':' + t.kind).sort().join(','));
    check(await until(A, async () => (await mine()) === 'delete:expenses,edit:trips'), 'Çöp kutusunda ortağın düzenlediği sefer ve sildiği gider var: ' + await mine());
    const trashN = await A.evaluate(() => window.__lxTrash.length);
    check((await A.textContent('#trash-list')).includes('navlun') && (await A.textContent('#trash-list')).includes('gün sonra kalıcı silinir'), 'Düzenlemede değişen alan ve kalan gün görünüyor');
    const delId = await A.evaluate(() => window.__lxTrash.find(t => t.action === 'delete' && t.byName === 'Deneme Ortak').id);
    await A.evaluate(id => trashRestore(id), delId);
    check(await until(Pp, async () => (await st(Pp)).expenses.some(e => e.note === 'ortak gideri')), 'Yönetici geri aldı, gider ortağın listesine de döndü');
    check(await until(A, async () => (await A.evaluate(() => window.__lxTrash.length)) === trashN - 1), 'Geri alınan kayıt çöp kutusundan çıktı');

    for (const p of [A, B, X, Rp, Pp]) check(!p.errs.length, 'Sayfa hatası yok ' + p.errs.join(' | '));
  } catch (e) { console.error(e); fails++; }
  await b.close();
  console.log(fails ? `\n${fails} kontrol BAŞARISIZ` : '\nTüm kontroller geçti');
  process.exit(fails ? 1 : 0);
}
