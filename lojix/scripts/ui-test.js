// Arayüz akış testi (bulut gerekmez). Kullanım: node scripts/ui-test.js
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
const dir = path.join(__dirname, '..', 'public');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if (!ok) fails++; };
const type = f => ({ js: 'text/javascript', css: 'text/css', png: 'image/png' })[f.split('.').pop()] || 'text/html';
const srv = http.createServer((q, res) => {
  const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': type(f) }); res.end(b); });
}).listen(8812, run);

async function page(b, local) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.addInitScript(s => { localStorage.clear(); if (s) localStorage.setItem('FRIGO_FILO_PRO_V1', s); }, local ? JSON.stringify(local) : null);
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8812/', { waitUntil: 'load' });
  return p;
}
const submit = (p, id) => p.locator(`#${id}-form`).evaluate(f => f.requestSubmit());
const st = p => p.evaluate(() => state);
const visible = (p, id) => p.evaluate(id => document.getElementById(id).classList.contains('flex'), id);

async function run() {
  const b = await chromium.launch();
  try {
    console.log('1) Boş cihaz: önce araç istenir, araç eklenir');
    const E = await page(b, null);
    await E.evaluate(() => openModal('tripModal'));
    check(await visible(E, 'vehicleModal') && !(await visible(E, 'tripModal')), 'Araç yokken sefer yerine araç formu açıldı');
    await E.fill('#vehPlate', '34 TEST 01'); await E.fill('#vehDriver', 'Deneme Şoför'); await E.fill('#vehOdo', '100000');
    await submit(E, 'vehicleModal');
    const ev = (await st(E)).vehicles;
    check(ev.length === 1 && ev[0].plate === '34 TEST 01' && ev[0].nextService === 140000, 'Araç eklendi, sonraki bakım km hesaplandı');
    check((await E.textContent('#dash-title')).includes('1 araç'), 'Özet başlığı araç sayısını gösteriyor');
    await E.evaluate(() => openVehicleModal()); await E.fill('#vehPlate', '34 test 01'); await E.fill('#vehDriver', 'X'); await submit(E, 'vehicleModal');
    check((await st(E)).vehicles.length === 1, 'Aynı plaka ikinci kez eklenmedi');
    await E.evaluate(() => closeModal('vehicleModal'));
    await E.evaluate(() => deleteVehicle(0));
    check((await st(E)).vehicles.length === 0, 'Kaydı olmayan araç silindi');

    console.log('2) Sefer km, fatura no, arama');
    const P = await page(b, seed);
    const v0 = seed.vehicles[0];
    await P.evaluate(() => openModal('tripModal'));
    await P.selectOption('#tripVehicle', v0.id);
    await P.fill('#tripRoute', 'Antalya - Konya'); await P.fill('#tripClient', 'Yeni Müşteri Ltd.');
    await P.fill('#tripPrice', '30000'); await P.fill('#tripKm', '650'); await P.fill('#tripInvoice', 'IRS-777');
    check((await P.textContent('#tripPreview')).includes('Tahmini yakıt') && !(await P.textContent('#tripPreview')).includes('Tahmini yakıt: 0 ₺'), 'Km girilince yakıt tahmini hesaplandı');
    await submit(P, 'tripModal');
    let s = await st(P);
    const nt = s.trips.find(t => t.invoiceNo === 'IRS-777');
    check(nt && nt.km === 650, 'Sefer km ve fatura no kaydedildi');
    check(s.vehicles.find(v => v.id === v0.id).odo === v0.odo + 650, 'Aracın km\'si sefer kadar ilerledi');
    check(s.clients.some(c => c.name === 'Yeni Müşteri Ltd.'), 'Yeni müşteri kartı otomatik oluştu');
    await P.evaluate(id => editRecord('trips', id), nt.id);
    check((await P.textContent('#tripModal h3')).includes('düzenle'), 'Düzenleme penceresinin başlığı doğru');
    await P.fill('#tripKm', '600'); await submit(P, 'tripModal');
    check((await st(P)).vehicles.find(v => v.id === v0.id).odo === v0.odo + 600, 'Km düzeltilince araç km\'si farka göre düzeldi');
    await P.evaluate(() => switchTab('trips')); await P.fill('#tF-q', 'irs-777');
    check(await P.locator('#trips-tbody tr').count() === 1, 'Fatura numarasıyla arama tek seferi buldu');
    await P.fill('#tF-q', '');

    console.log('3) Sefere bağlı tahsilat');
    const open = s.trips.filter(t => t.client === 'Ege Meyve Ltd.' && t.paid !== 'Tahsil Edildi').sort((a, b) => a.due.localeCompare(b.due));
    const target = open[open.length - 1];  // vadesi en geç olan sefer: genel tahsilat buna değmezdi
    const before = await P.evaluate(() => cariData().find(c => c.client === 'Ege Meyve Ltd.'));
    await P.evaluate(() => openModal('payModal'));
    await P.selectOption('#payClient', 'Ege Meyve Ltd.');
    await P.evaluate(() => fillPayTrips());
    check(await P.locator('#payTrip option').count() === open.length + 1, 'Tahsilat formu müşterinin açık seferlerini listeledi');
    await P.selectOption('#payTrip', String(target.id)); await P.fill('#payAmount', '10000'); await submit(P, 'payModal');
    const after = await P.evaluate(() => cariData().find(c => c.client === 'Ege Meyve Ltd.'));
    const tAfter = after.openTrips.find(t => t.id === target.id), tBefore = before.openTrips.find(t => t.id === target.id);
    check(tAfter._left === tBefore._left - 10000, `Tahsilat seçilen seferden düştü (${tBefore._left} → ${tAfter._left})`);
    check(Math.round(after.bal) === Math.round(before.bal - 10000), 'Müşteri bakiyesi tahsilat kadar azaldı');
    check((await st(P)).payments.some(p => p.tripId === target.id), 'Tahsilat kaydında sefer bağlantısı var');

    console.log('4) Formlar: müşteri, aracı şirket; araç silme koruması');
    await P.evaluate(() => createClient()); await P.fill('#clientName', 'Form Müşterisi'); await submit(P, 'clientModal');
    check((await st(P)).clients.some(c => c.name === 'Form Müşterisi'), 'Müşteri kartı formla eklendi');
    await P.evaluate(() => addIntermediaryCompany()); await P.fill('#companyName', 'Deneme Lojistik'); await P.fill('#companyRate', '5'); await submit(P, 'companyModal');
    check((await st(P)).intermediaryCompanies.some(c => c.name === 'Deneme Lojistik' && c.rate === 5), 'Aracı şirket formla eklendi');
    const id = (await st(P)).intermediaryCompanies.find(c => c.name === 'Deneme Lojistik').id;
    await P.evaluate(id => deleteIntermediaryCompany(id), id);
    await P.reload({ waitUntil: 'load' });
    check(!(await st(P)).intermediaryCompanies.some(c => c.name === 'Deneme Lojistik'), 'Silinen aracı şirket yeniden açılışta geri gelmedi');
    const n = (await st(P)).vehicles.length;
    await P.evaluate(() => deleteVehicle(0));
    check((await st(P)).vehicles.length === n && (await P.textContent('#toasts')).includes('silinemez'), 'Kaydı olan araç silinmedi, nedeni bildirildi');
    await P.evaluate(enc => createReceivable(enc), encodeURIComponent('Toros Gıda'));
    check(await P.inputValue('#tripClient') === 'Toros Gıda' && await P.inputValue('#tripPaid') === 'Vadeli / Bekliyor', 'Alacak kartı vadeli sefer formunu müşteriyle açtı');

    console.log('5) Asistan: yazarak ve sesle kayıt, rapor sorusu');
    await P.evaluate(() => { document.querySelectorAll('.modal-wrap.flex').forEach(m => closeModal(m.id)); openSheet('quickSheet'); });
    await P.fill('#asst-input', "101 Antalya'dan İstanbul'a sefer 45 bin Toros Gıda 900 km, 30 gün vadeli");
    await P.locator('#asst-input').press('Enter');
    check(await visible(P, 'tripModal') && await P.inputValue('#tripVehicle') === 'V0' && await P.inputValue('#tripRoute') === 'Antalya - İstanbul'
      && await P.inputValue('#tripPrice') === '45000' && await P.inputValue('#tripKm') === '900' && await P.inputValue('#tripClient') === 'Toros Gıda', 'Yazılan cümle sefer formunu doldurdu');
    check((await P.textContent('#toasts')).includes('Anladığım: Sefer · 07 ABC 101 · Antalya - İstanbul'), 'Ne anlaşıldığı gösterildi');
    const nTrips = (await st(P)).trips.length;
    check(nTrips === (await st(P)).trips.length && !(await st(P)).trips.some(t => t.price === 45000 && t.km === 900), 'Asistan kendiliğinden kaydetmedi');
    await submit(P, 'tripModal');
    check((await st(P)).trips.length === nTrips + 1, 'Kaydet ile sefer eklendi');
    // Ses tanıma: tarayıcının SpeechRecognition'ı sahte bir cümleyle taklit edilir
    await P.evaluate(() => { window.SpeechRecognition = function () { this.start = () => setTimeout(() => { this.onresult({ results: [Object.assign([{ transcript: "102'ye 300 litre mazot 44,5'ten kilometre 300500" }], { isFinal: true })] }); this.onend(); }, 50); }; });
    await P.evaluate(() => asstListen());
    await P.waitForTimeout(300);
    check(await visible(P, 'fuelModal') && await P.inputValue('#fuelVehicle') === 'V1' && await P.inputValue('#fuelLiters') === '300' && await P.inputValue('#fuelOdometerKm') === '300500', 'Sesli cümle yakıt formunu doldurdu');
    await P.evaluate(() => closeModal('fuelModal'));
    await P.evaluate(() => openSheet('quickSheet')); await P.fill('#asst-input', 'Toros Gıda borcu ne kadar?'); await P.locator('#asst-input').press('Enter');
    await P.evaluate(() => openModal('expenseModal')); await P.evaluate(() => openSheet('quickSheet')); await P.fill('#asst-input', 'vazgeç'); await P.locator('#asst-input').press('Enter');
    check(!(await visible(P, 'expenseModal')), '"Vazgeç" açık formu kapattı');
    await P.evaluate(() => openSheet('quickSheet')); await P.fill('#asst-input', 'Toros Gıda borcu ne kadar?'); await P.locator('#asst-input').press('Enter');
    check((await P.textContent('#asst-out')).includes('kalan bakiye'), 'Rapor sorusu yanıtlandı: ' + (await P.textContent('#asst-out')).slice(0, 80));

    console.log('6) Telefon: kartlar ve dokunmalı seçim');
    const M = await b.newPage({ viewport: { width: 390, height: 844 } });
    await M.addInitScript(x => { localStorage.clear(); localStorage.setItem('FRIGO_FILO_PRO_V1', x); }, JSON.stringify(seed));
    await M.goto('http://localhost:8812/', { waitUntil: 'load' });
    await M.evaluate(() => switchTab('trips'));
    check(await M.locator('#trips-cards .mcard').count() === seed.trips.length && !(await M.isVisible('#trips-tbody')), 'Telefonda seferler kart olarak listelendi, tablo gizli');
    await M.evaluate(() => openModal('fuelModal'));
    await M.click('#fuelModal .seg button:has-text("Frigo")');
    check(await M.inputValue('#fuelType') === 'FRIGO', 'Dokunmalı seçim yakıt türünü değiştirdi');
    await M.evaluate(() => { $('fuelType').value = 'ADBLUE'; });
    check(await M.getAttribute('#fuelModal .seg button:has-text("AdBlue")', 'aria-pressed') === 'true', 'Kodla atanan değer düğmelere yansıdı');
    await M.close();

    console.log('6b) Araç ↔ şoför bağlantısı');
    await P.evaluate(() => document.querySelectorAll('.modal-wrap.flex').forEach(m => closeModal(m.id)));
    for (const [m, v, d] of [['tripModal', 'tripVehicle', 'tripDriver'], ['fuelModal', 'fuelVehicle', 'fuelDriver'], ['expenseModal', 'expVehicle', 'expDriver']]) {
      await P.evaluate(m => openModal(m), m);
      await P.selectOption('#' + v, seed.vehicles[2].id);
      const okA = await P.inputValue('#' + d) === seed.vehicles[2].driver;
      await P.selectOption('#' + d, seed.vehicles[1].driver);
      const okB = await P.inputValue('#' + v) === seed.vehicles[1].id;
      check(okA && okB, `${m}: araç seçilince şoför, şoför seçilince araç değişti`);
      await P.evaluate(m => closeModal(m), m);
    }

    console.log('7) Otomatik yardımlar');
    await P.evaluate(() => document.querySelectorAll('.modal-wrap.flex').forEach(m => closeModal(m.id)));
    await P.evaluate(() => openModal('tripModal'));
    await P.fill('#tripRoute', 'Mersin - İzmir'); await P.dispatchEvent('#tripRoute', 'change');
    const lastMI = seed.trips.filter(t => t.route === 'Mersin - İzmir').sort((a, b) => b.date.localeCompare(a.date))[0];
    check(await P.inputValue('#tripPrice') === String(lastMI.price) && await P.inputValue('#tripClient') === lastMI.client && (await P.textContent('#tripModal .auto-hint')).includes('Son seferden'), 'Güzergâh yazılınca son seferin navlunu ve müşterisi geldi');
    await P.evaluate(() => closeModal('tripModal'));
    await P.evaluate(() => openModal('fuelModal'));
    check(await P.inputValue('#fuelUnitPrice') === '44.5' && await P.inputValue('#fuelStation') === 'Opet Afyon', 'Yakıtta son litre fiyatı ve istasyon geldi');
    await P.evaluate(() => closeModal('fuelModal'));
    // Yarım form: yazılan değer sayfa yeniden açılınca geri gelir, kaydedilince silinir
    await P.evaluate(() => openModal('expenseModal')); await P.fill('#expAmount', '1234'); await P.fill('#expNote', 'yarım kalan');
    // test sayfası her açılışta hafızayı temizlediği için kapanmayı dışarı dokunarak taklit ediyoruz (taslak telefonda kalır)
    await P.mouse.click(5, 5);
    check(await P.evaluate(() => !document.getElementById('expenseModal').classList.contains('flex') && !!localStorage.getItem('LOJIX_DRAFT_expenseModal')), 'Form kapandı, taslak telefonda saklı');
    await P.evaluate(() => openModal('expenseModal'));
    check(await P.inputValue('#expAmount') === '1234' && await P.inputValue('#expNote') === 'yarım kalan' && await P.isVisible('#expenseModal .draft-bar'), 'Yarım kalan gider formu geri geldi');
    await submit(P, 'expenseModal');
    check(await P.evaluate(() => !localStorage.getItem('LOJIX_DRAFT_expenseModal')), 'Kaydedilince taslak silindi');
    await P.evaluate(() => openModal('expenseModal'));
    check(await P.inputValue('#expAmount') === '' && !(await P.isVisible('#expenseModal .draft-bar')), 'Sonraki yeni form boş açıldı');
    await P.evaluate(() => closeModal('expenseModal'));
    await P.evaluate(() => switchTab('dashboard'));
    check((await P.textContent('#cloud-banner')).includes('Bulut bağlı değil') && await P.isVisible('#cloud-banner'), 'Giriş yokken bulut uyarısı görünüyor');
    check(await P.evaluate(() => !document.documentElement.dataset.theme && getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toUpperCase() === '#050B17'), 'Varsayılan tema koyu kokpit');
    check(await P.locator('#gauges .gauge').count() === 4, 'Dört gösterge çizildi');
    await P.evaluate(() => setTheme('brand'));
    check(await P.evaluate(() => document.documentElement.dataset.theme === 'brand' && localStorage.getItem('LOJIX_THEME') === 'brand' && document.querySelector('[data-theme-opt=brand]').getAttribute('aria-checked') === 'true'), 'Marka renkli tema seçildi ve saklandı');
    await P.emulateMedia({ colorScheme: 'light' }); await P.evaluate(() => setTheme('auto'));
    check(await P.evaluate(() => document.documentElement.dataset.theme) === 'light', 'Telefona göre: gündüz modunda açık tema');
    await P.emulateMedia({ colorScheme: 'dark' });
    await P.waitForFunction(() => !document.documentElement.dataset.theme, null, { timeout: 3000 }).catch(() => {});
    check(await P.evaluate(() => !document.documentElement.dataset.theme), 'Telefona göre: gece moduna geçince kokpit');
    await P.evaluate(() => setTheme('dark'));

    console.log('8) Ses: iPhone\'da yazı gelmezse klavye diktesi; "bitti" işareti olmadan da gönderim');
    const mock = mode => { window.LX_NO_AUDIO_MS = 700; window.__sr = { made: 0, cont: [] };
      window.SpeechRecognition = function () { window.__sr.made++; const r = this;
        r.start = () => { window.__sr.cont.push(r.continuous); setTimeout(() => r.onaudiostart && r.onaudiostart(), 50);
          if (mode === 'nofinal') setTimeout(() => r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: '103 HGS 750' }], { isFinal: false })] }), 150); };
        r.stop = () => setTimeout(() => r.onend && r.onend(), 10); }; };
    const vp = async (opts, mode) => { const p = await b.newPage(opts); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
      await p.addInitScript(s => { localStorage.clear(); localStorage.setItem('FRIGO_FILO_PRO_V1', s); }, JSON.stringify(seed)); await p.addInitScript(mock, mode);
      await p.goto('http://localhost:8812/', { waitUntil: 'load' }); await p.waitForTimeout(300); return p; };
    const I = await vp({ ...devices['iPhone 13'] }, 'deaf');
    await I.evaluate(() => asstListen()); await I.waitForTimeout(1300);
    check((await I.textContent('#asst-out')).includes('yazıya dönmedi') && await I.evaluate(() => window.__sr.cont[0] === false && +localStorage.getItem('LOJIX_DICTATE_UNTIL') > Date.now()), 'iPhone: yazı gelmeyince klavye diktesi, tek seferlik dinleme, tercih hatırlandı');
    await I.fill('#asst-input', '102 lastik 5000'); await I.waitForTimeout(3000);
    check(await visible(I, 'expenseModal') && await I.inputValue('#expAmount') === '5000' && await I.inputValue('#expVehicle') === 'V1', 'Dikte bitince susunca gider formu kendiliğinden doldu');
    await I.evaluate(() => closeModal('expenseModal')); await I.evaluate(() => asstListen());
    check(await I.evaluate(() => window.__sr.made === 1 && document.activeElement.id === 'asst-input'), 'Sonraki basışta beklemeden doğrudan klavye diktesi');
    const T = await vp({ ...devices['iPhone 13'] }, 'deaf');
    await T.evaluate(() => localStorage.setItem('LOJIX_SR_OK', '1')); await T.evaluate(() => asstListen()); await T.waitForTimeout(1300);
    check((await T.textContent('#asst-out')).includes('bu sefer ses alamadı') && await T.evaluate(() => !localStorage.getItem('LOJIX_DICTATE_UNTIL')), 'Daha önce çalışmış telefonda tek boş dinleme geçici sayıldı, dikte tercihi kaydedilmedi');
    const W = await vp({ viewport: { width: 1280, height: 900 } }, 'nofinal');
    await W.evaluate(() => asstListen()); await W.waitForTimeout(3300);
    check(await W.evaluate(() => window.__sr.cont[0] === true) && await visible(W, 'expenseModal') && await W.inputValue('#expAmount') === '750', 'Masaüstü: "bitti" işareti olmadan susunca gider formu doldu');
    for (const p of [I, W, T]) check(!p.errs.length, 'Ses testinde sayfa hatası yok ' + p.errs.join(' | '));

    for (const p of [E, P]) check(!p.errs.length, 'Sayfa hatası yok ' + p.errs.join(' | '));
  } catch (e) { console.error(e); fails++; }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} kontrol BAŞARISIZ` : '\nTüm kontroller geçti');
  process.exit(fails ? 1 : 0);
}
