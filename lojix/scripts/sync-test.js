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
  // Sahip B (Yasin); A yönetici, R görüntüleyici olarak Kullanıcılar listesinde (gerçek kurulumdaki gibi uid'leriyle)
  for (const [who, role] of [['a', 'admin'], ['r', 'viewer']])
    await req('PATCH', fsUrl('/fleets/lojix/users/' + encodeURIComponent(USERS[who][1])), { fields: { name: fv(who.toUpperCase()), role: fv(role), uid: fv(USERS[who][0]) } }, OWNER);
}
// Eski tek belgeyi (lojix_data/1) emülatöre yazar: Firestore REST değer biçimine çevirir.
const fv = v => v === null || v === undefined ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(fv) } }
  : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fv(x)])) } }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
// Bulutta hazır filo: her kaydı fleets/lojix/{tür}/{id} belgesine yazar (müşteriler telefonda addan türetilir)
async function seedFleet(d) {
  const kinds = { vehicles: d.vehicles, trips: d.trips, fuels: d.fuels, expenses: d.expenses, payments: d.payments, companies: d.intermediaryCompanies };
  const writes = Object.entries(kinds).flatMap(([k, list]) => list.map(r => ({ update: { name: `projects/${PROJECT}/databases/(default)/documents/fleets/lojix/${k}/${r.id}`, fields: { data: fv(r), updatedBy: fv('seed') } }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] })));
  await req('POST', `${EMU}:8080/v1/projects/${PROJECT}/databases/(default)/documents:commit`, { writes }, OWNER);
}
async function countDocs(kind) { const r = await req('GET', fsUrl(`/fleets/lojix/${kind}?pageSize=300`), null, OWNER); return (r.documents || []).length; }

http.createServer((q, res) => {
  const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': type(f) }); res.end(b); });
}).listen(8811, run);

async function phone(b, name, local) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => { window.LX_EMULATOR = true; window.LX_SYNC_SKEW = 1500; if (!sessionStorage.x) { localStorage.clear(); if (s) localStorage.setItem('FRIGO_FILO_PRO_V1', s); sessionStorage.x = 1; } }, local ? JSON.stringify(local) : null);
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
    console.log('1) Bulutta hazır filo var, yeni telefon ilk kez bağlanır');
    await seedFleet(seed);
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
    const r4 = await A.evaluate(() => ({ inc: window.__lxIncremental, reads: window.__lxReads }));
    check(r4.inc && r4.reads < 10, `Yeniden açılışta artımlı eşitleme, okunan belge: ${r4.reads} (toplam ${before + 70}+)`);

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
    await B.evaluate(() => switchTab('settings'));
    await B.fill('#userName', 'Deneme Ortak'); await B.fill('#userEmail', USERS_P_EMAIL); await B.selectOption('#userRole', 'partner'); await B.selectOption('#userCompany', 'IC_MOONLOG');
    await B.locator('#userForm').evaluate(f => f.requestSubmit());
    check(await until(B, async () => (await B.textContent('#users-list')).includes(USERS_P_EMAIL)), 'Sahip iş ortağını ekledi');
    await A.evaluate(() => { switchTab('settings'); renderUsers(); });
    await A.waitForTimeout(500);
    check(await A.evaluate(() => getComputedStyle(document.querySelector('[data-owner]')).display === 'none' && !document.getElementById('users-list').textContent.trim()), 'Yönetici Kullanıcılar bölümünü hiç görmüyor');
    const rd2 = await A.evaluate(async () => { try { await firebase.firestore().collection('fleets').doc('lojix').collection('users').get(); return 'okudu'; } catch (e) { return e.code; } });
    check(rd2 === 'permission-denied', 'Kural: sahip dışında kimse kullanıcı listesini okuyamaz');
    const wr = await A.evaluate(async () => { try { await firebase.firestore().collection('fleets').doc('lojix').collection('users').doc('kotu@test.com').set({ role: 'admin' }); return 'yazdı'; } catch (e) { return e.code; } });
    check(wr === 'permission-denied', 'Kural: sahip dışında kimse kullanıcı/rol ekleyemez');
    const Pp = await phone(b, 'P', null);
    check(await signIn(Pp, 'p'), 'İş ortağı girişi: ' + await status(Pp));
    check(await Pp.evaluate(() => window.LX_ROLE === 'partner' && document.body.classList.contains('partner')), 'Rol: iş ortağı');
    const sp = await st(Pp);
    check(sp.trips.length === 0 && sp.expenses.length === 0 && sp.fuels.length === 0 && sp.payments.length === 0 && sp.vehicles.length > 0, 'Başkalarının kayıtlarını görmüyor, araç listesini görüyor');
    await Pp.evaluate(() => switchTab('cari'));
    check(await Pp.evaluate(() => document.getElementById('tab-home').classList.contains('active')), 'Cari sayfası kapalı, Panelim\'e yönlendi');
    check(await Pp.evaluate(() => { const t = document.getElementById('tab-home').textContent; return t.includes('Deneme Ortak'.split(' ')[0]) && t.includes('Moonlog Lojistik · İş ortağı') && t.includes('Bekleyen tahsilat') && !/kâr|net /i.test(t); }), 'Panelim: karşılama, şirket etiketi, göstergeler; kâr yok');
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

    console.log('8) İkinci iş ortağını sahip ekler: hesap açılır, parola bağlantısı gider');
    const E2 = 'ikinci@moonlog.test';
    await B.evaluate(() => switchTab('settings'));
    await B.fill('#userName', 'İkinci Ortak'); await B.fill('#userEmail', E2); await B.selectOption('#userRole', 'partner'); await B.selectOption('#userCompany', 'IC_MOONLOG');
    await B.locator('#userForm').evaluate(f => f.requestSubmit());
    check(await until(B, async () => (await B.textContent('#toasts')).includes('Giriş hesabı açıldı')), 'Hesap açıldı bildirimi');
    check(await B.evaluate(() => firebase.auth().currentUser.email) === USERS.b[1], 'Sahibin oturumu kapanmadı');
    const codes = (await req('GET', `${EMU}:9099/emulator/v1/projects/${PROJECT}/oobCodes`)).oobCodes || [];
    const rcode = codes.filter(c => c.email === E2 && c.requestType === 'PASSWORD_RESET').pop();
    check(!!rcode, 'Parola belirleme bağlantısı gönderildi');
    await req('POST', `${EMU}:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=x`, { oobCode: rcode.oobCode, newPassword: 'yeniParola1' });
    const P2 = await phone(b, 'P2', null);
    await P2.evaluate(() => switchTab('settings'));
    await P2.fill('#lojix-cloud-email', E2); await P2.fill('#lojix-cloud-password', 'yeniParola1'); await P2.click('#lojix-cloud-login');
    check(await until(P2, async () => (await status(P2)).startsWith('Eşitlendi')), 'İkinci ortak kendi parolasıyla girdi: ' + await status(P2));
    check(await P2.evaluate(() => window.LX_ROLE === 'partner' && firebase.auth().currentUser.emailVerified), 'Bağlantı e-postayı doğruladı, rol iş ortağı');
    check((await st(P2)).trips.length === 0, 'İkinci ortak birinci ortağın seferlerini görmüyor');

    console.log('9) Şoför: yalnızca yakıt ve gider, atanan araç kilitli; sahip erişimi kaldırır');
    const ED = 'sofor@test.com';
    await B.fill('#userName', 'Deneme Şoför'); await B.fill('#userEmail', ED); await B.selectOption('#userRole', 'driver'); await B.selectOption('#userVehicle', 'V1');
    await B.locator('#userForm').evaluate(f => f.requestSubmit());
    check(await until(B, async () => (await B.textContent('#users-list')).includes(ED)), 'Sahip şoförü ekledi');
    const dcode = ((await req('GET', `${EMU}:9099/emulator/v1/projects/${PROJECT}/oobCodes`)).oobCodes || []).filter(c => c.email === ED && c.requestType === 'PASSWORD_RESET').pop();
    await req('POST', `${EMU}:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=x`, { oobCode: dcode.oobCode, newPassword: 'soforParola1' });
    const D = await phone(b, 'D', null);
    await D.evaluate(() => switchTab('settings'));
    await D.fill('#lojix-cloud-email', ED); await D.fill('#lojix-cloud-password', 'soforParola1'); await D.click('#lojix-cloud-login');
    check(await until(D, async () => (await status(D)).startsWith('Eşitlendi')), 'Şoför girişi: ' + await status(D));
    check(await D.evaluate(() => window.LX_ROLE === 'driver' && document.body.classList.contains('driver')), 'Rol: şoför');
    await D.evaluate(() => switchTab('trips'));
    check(await D.evaluate(() => document.getElementById('tab-home').classList.contains('active') && getComputedStyle(document.querySelector('#side [data-tab=trips]')).display === 'none'), 'Sefer sayfası kapalı, Panelim\'e yönlendi');
    check(await D.evaluate(() => { const t = document.getElementById('tab-home').textContent; return t.includes('Şoför') && t.includes('Bu ay yakıt') && !t.includes('Sefer ekle'); }), 'Şoför Panelim: yakıt/gider göstergeleri, sefer düğmesi yok');
    await D.evaluate(() => openModal('tripModal'));
    check(!(await D.evaluate(() => document.getElementById('tripModal').classList.contains('flex'))) && (await D.textContent('#toasts')).includes('yalnızca yakıt ve gider'), 'Sefer formu açılmadı');
    await D.evaluate(() => openModal('fuelModal'));
    check(await D.inputValue('#fuelVehicle') === 'V1' && await D.evaluate(() => document.getElementById('fuelVehicle').disabled), 'Yakıtta atanan araç kilitli');
    await D.fill('#fuelLiters', '200'); await D.fill('#fuelUnitPrice', '45'); await D.evaluate(() => calcFuel()); await D.fill('#fuelOdometerKm', '999999');
    await D.locator('#fuelModal-form').evaluate(f => f.requestSubmit());
    await addExpense(D, 650, 'şoför yemek');
    check(await until(A, async () => (await st(A)).fuels.some(f => f.odometerKm === 999999 && f.createdByRole === 'driver' && f.createdByName === 'Deneme Şoför')), 'Şoförün yakıtı yöneticiye ekleyen bilgisiyle geldi');
    check(await until(A, async () => (await st(A)).expenses.some(e => e.note === 'şoför yemek' && e.vehicleId === 'V1')), 'Şoförün gideri yöneticiye geldi');
    await A.evaluate(() => switchTab('expenses'));
    check(await until(A, async () => (await A.textContent('#exp-cards')).includes('Deneme Şoför · şoför')), 'Yönetici listesinde "· şoför" etiketi');
    const dr = await D.evaluate(async () => { const c = firebase.firestore().collection('fleets').doc('lojix'), u = firebase.auth().currentUser.uid, ts = firebase.firestore.FieldValue.serverTimestamp(), r = {};
      try { await c.collection('trips').doc('77').set({ data: { id: 77, createdBy: u }, updatedAt: ts, updatedBy: u }); r.trip = 'yazdı'; } catch (e) { r.trip = e.code; }
      try { await c.collection('fuels').doc('78').set({ data: { id: 78, createdBy: u, vehicleId: 'V2' }, updatedAt: ts, updatedBy: u }); r.other = 'yazdı'; } catch (e) { r.other = e.code; } return r; });
    check(dr.trip === 'permission-denied' && dr.other === 'permission-denied', 'Kural: şoför sefer ve başka araca yakıt yazamaz ' + JSON.stringify(dr));
    await B.evaluate(e => removeUser(e), ED);
    check(await until(B, async () => !(await B.textContent('#users-list')).includes(ED)), 'Sahip şoförün erişimini kaldırdı');
    await D.reload({ waitUntil: 'load' });
    check(await until(D, async () => (await status(D)).includes('erişim izni yok')), 'Erişimi kaldırılan şoför giremiyor: ' + await status(D));

    console.log('10) Artımlı eşitleme: kapalı telefon açılınca silinen, düzenlenen, eklenen ve geri alınan kayıtları alır');
    await B.evaluate(() => firebase.auth().signOut());
    await B.waitForTimeout(500);
    const t10 = (await st(A)).trips, del = t10[0].id, ed = t10[1].id, rst = t10[2].id;
    await A.evaluate(id => delItem('trips', id), del);
    await A.evaluate(id => editRecord('trips', id), ed); await A.fill('#tripPrice', '77777'); await A.locator('#tripModal-form').evaluate(f => f.requestSubmit());
    await addExpense(A, 4321, 'kapalıyken eklenen');
    await A.evaluate(id => delItem('trips', id), rst);
    await A.waitForTimeout(800);
    const trId = await A.evaluate(id => { const t = window.__lxTrash.find(x => x.action === 'delete' && String(x.recordId) === String(id)); return t && t.id; }, rst);
    await A.evaluate(id => trashRestore(id), trId);
    await A.waitForTimeout(1500);
    check(await signIn(B, 'b'), 'B yeniden girdi: ' + await status(B));
    const sb = await st(B), r10 = await B.evaluate(() => ({ inc: window.__lxIncremental, reads: window.__lxReads }));
    check(r10.inc, 'B artımlı eşitleme yaptı');
    check(!sb.trips.some(t => t.id === del), 'Kapalıyken silinen sefer B\'den de silindi');
    check(sb.trips.find(t => t.id === ed).price === 77777, 'Kapalıyken düzenlenen sefer güncellendi');
    check(sb.expenses.some(e => e.note === 'kapalıyken eklenen'), 'Kapalıyken eklenen gider geldi');
    check(sb.trips.some(t => t.id === rst), 'Silinip geri alınan sefer yerinde');
    check(r10.reads < 15, 'Okunan belge sayısı küçük: ' + r10.reads);
    check(JSON.stringify(sb.trips.map(t => t.id).sort()) === JSON.stringify((await st(A)).trips.map(t => t.id).sort()), 'B ve A sefer listeleri aynı');
    await B.evaluate(() => document.getElementById('lojix-cloud-refresh').click());
    check(await until(B, async () => (await status(B)).startsWith('Eşitlendi') && !(await B.evaluate(() => window.__lxIncremental))), '"Yeniden eşitle" tam okuma yapar');

    for (const p of [A, B, X, Rp, Pp, P2, D]) check(!p.errs.length, 'Sayfa hatası yok ' + p.errs.join(' | '));
  } catch (e) { console.error(e); fails++; }
  await b.close();
  console.log(fails ? `\n${fails} kontrol BAŞARISIZ` : '\nTüm kontroller geçti');
  process.exit(fails ? 1 : 0);
}
