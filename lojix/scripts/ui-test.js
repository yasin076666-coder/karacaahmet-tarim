// Arayüz akış testi (bulut gerekmez). Kullanım: node scripts/ui-test.js
const { chromium } = require('playwright');
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
    check((await P.textContent('#asst-out')).includes('kalan bakiye'), 'Rapor sorusu yanıtlandı: ' + (await P.textContent('#asst-out')).slice(0, 80));

    for (const p of [E, P]) check(!p.errs.length, 'Sayfa hatası yok ' + p.errs.join(' | '));
  } catch (e) { console.error(e); fails++; }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} kontrol BAŞARISIZ` : '\nTüm kontroller geçti');
  process.exit(fails ? 1 : 0);
}
