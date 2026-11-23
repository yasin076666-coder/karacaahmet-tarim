// Sesli giriş testi: tarayıcının konuşma tanıması taklit edilir (gerçek mikrofon gerekmez).
// Kullanım: node scripts/voice-test.js
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'public');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if (!ok) fails++; };
const type = f => ({ js: 'text/javascript', css: 'text/css', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2' })[f.split('.').pop()] || 'text/html';
const srv = http.createServer((q, res) => {
  const f = path.join(dir, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': type(f) }); res.end(b); });
}).listen(8813, run);

// mode 'deaf': mikrofon açılır (onaudiostart) ama hiç sonuç gelmez — iPhone ana ekran uygulamasındaki belirti
// mode 'nofinal': ara sonuçlar gelir, 'bitti' işareti hiç gelmez
const mockSR = mode => {
  window.ASST_NO_AUDIO_MS = 700;
  window.__sr = { made: 0, continuous: [] };
  window.SpeechRecognition = function () {
    window.__sr.made++; const r = this;
    r.start = () => { window.__sr.continuous.push(r.continuous); setTimeout(() => r.onaudiostart && r.onaudiostart(), 50);
      if (mode === 'nofinal') setTimeout(() => r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: '300 lira yemek' }], { isFinal: false })] }), 150); };
    r.stop = () => setTimeout(() => r.onend && r.onend(), 10);
  };
};
async function page(b, opts, mode) {
  const p = await b.newPage(opts);
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(mockSR, mode);
  await p.goto('http://localhost:8813/', { waitUntil: 'load' });
  await p.waitForTimeout(400);
  return p;
}
const out = p => p.evaluate(() => document.getElementById('asst-out').textContent);
const expenseOpen = p => p.evaluate(() => getComputedStyle(document.getElementById('expense-modal')).display !== 'none');

async function run() {
  const b = await chromium.launch();
  try {
    console.log('1) iPhone: mikrofon açılıyor ama yazı gelmiyor → klavye diktesi');
    const I = await page(b, { ...devices['iPhone 13'] }, 'deaf');
    await I.click('#asst-mic');
    await I.waitForTimeout(1300);
    check((await out(I)).includes('yazıya dönmedi') && (await out(I)).includes('🎤'), 'Durum fark edildi, klavye diktesi önerildi');
    check(await I.evaluate(() => window.__sr.continuous[0] === false), 'iPhone\'da tek seferlik dinleme kullanıldı');
    check(await I.evaluate(() => +localStorage.getItem('asst_dictate_until') > Date.now()), 'Tercih telefonda hatırlandı');
    await I.fill('#asst-input', '500 lira mazot');   // klavye diktesinin yazdığı metin (input olayı)
    await I.waitForTimeout(3000);
    check(await expenseOpen(I) && await I.inputValue('#expense-amount') === '500', 'Dikte bitince susunca kendiliğinden gönderildi: gider formu 500 ile açıldı');
    await I.evaluate(() => closeModal('expense-modal'));
    await I.click('#asst-mic');
    check(await I.evaluate(() => window.__sr.made) === 1 && await I.evaluate(() => document.activeElement.id) === 'asst-input' && (await out(I)).includes('🎤'), 'Sonraki basışta beklemeden doğrudan klavye diktesi (kutu açık)');
    await I.locator('#asst-out button').click();
    check(await I.evaluate(() => window.__sr.made === 2 && !localStorage.getItem('asst_dictate_until')), '"Doğrudan dinlemeyi yeniden dene" tercihi sıfırladı ve dinlemeyi başlattı');
    await I.waitForTimeout(1300);
    await I.fill('#asst-input', '250 lira yemek'); await I.press('#asst-input', 'Enter');
    await I.waitForTimeout(3000);
    check(await I.inputValue('#expense-amount') === '250', 'Elle Enter ile gönderim çalıştı, otomatik gönderim ikinci kez tetiklenmedi');

    console.log('2) Masaüstü/Android: "bitti" işareti gelmese de susunca gönderilir');
    const A = await page(b, { viewport: { width: 1280, height: 900 } }, 'nofinal');
    await A.click('#asst-mic');
    await A.waitForTimeout(3300);
    check(await A.evaluate(() => window.__sr.continuous[0] === true), 'Masaüstünde sürekli dinleme kullanıldı');
    check(await expenseOpen(A) && await A.inputValue('#expense-amount') === '300', 'Ara sonuçtan gider formu 300 ile açıldı');
    check(!(await A.evaluate(() => localStorage.getItem('asst_dictate_until'))), 'Çalışan tanımada klavye diktesi tercihi kaydedilmedi');

    for (const p of [I, A]) check(!p.errs.length, 'Sayfa hatası yok ' + p.errs.join(' | '));
  } catch (e) { console.error(e); fails++; }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} kontrol BAŞARISIZ` : '\nTüm kontroller geçti');
  process.exit(fails ? 1 : 0);
}
