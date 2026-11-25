// Tahsilatta kesinti ve hediye ürün testi.  node scripts/gift-discount-test.js public <tohum.json>
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const [dir, seedFile] = process.argv.slice(2); const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
let fails = 0; const check = (ok, m) => { console.log((ok ? '  ✔ ' : '  ✘ ') + m); if (!ok) fails++; };
const T = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const s = http.createServer((q, res) => { const u = q.url.split('?')[0]; const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'text/html' }); res.end(b); }); }).listen(0, async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript(s => { if (!sessionStorage.x) { for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.x = 1; } }, seed);
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:' + s.address().port + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => setQuickDate('all'));
  const money = sel => p.evaluate(sel => { const t = document.querySelector(sel).textContent; return +t.replace(/[^\d,-]/g, '').replace(',', '.') * (t.includes('-') || t.includes('−') ? -1 : 1); }, sel);
  const cash = () => p.evaluate(() => round2(cashRows().reduce((a, x) => a + x.amount, 0)));

  console.log('1) Tahsilatta kesinti');
  const sid = await p.evaluate(() => sales.find(x => x.total - (x.paid || 0) > 1000).id);
  const rem = await p.evaluate(id => { const s = sales.find(x => x.id === id); return round2(s.total - s.paid); }, sid);
  const cash0 = await cash(), profit0 = await money('#stat-net-profit');
  await p.evaluate(id => openPaymentModal('sale', id), sid);
  check(await p.locator('#pay-discount').isVisible(), 'tahsilat ekranında kesinti alanı var');
  await p.fill('#pay-modal-amount', String(rem - 500));
  await p.fill('#pay-discount', '500');
  await p.selectOption('#pay-discount-reason', 'İskonto');
  await p.evaluate(() => confirmPayment());
  const sale = await p.evaluate(id => sales.find(x => x.id === id), sid);
  check(Math.abs(sale.paid - sale.total) < 0.01, `müşterinin borcu tamamen kapandı (kalan ${(sale.total - sale.paid).toFixed(2)})`);
  check(sale.payments.some(x => x.kind === 'kesinti' && x.amount === 500 && x.note.includes('İskonto')), 'kesinti ayrı bir satır olarak kaydedildi (500, İskonto)');
  check(Math.abs((await cash()) - cash0 - (rem - 500)) < 0.01, `kasaya yalnız nakit kısım girdi (+${rem - 500})`);
  { const p1 = await money('#stat-net-profit'); check(Math.abs(profit0 - p1 - 500) < 0.01, `net kâr 500 azaldı (${profit0} → ${p1})`); }
  check(Math.abs((await money('#stat-discounts')) - 500) < 0.01, 'dönem özetinde kesinti 500 görünüyor');
  await p.evaluate(id => { switchTab('tab-reports'); const n = sales.find(x => x.id === id).customer; openStatement('customer', partyNames.customer.findIndex(x => fk(x) === fk(n))); }, sid);
  check(await p.locator('#stmt-body').getByText('Kesinti').count() > 0, 'cari ekstrede kesinti satırı görünüyor');
  await p.evaluate(() => closeModal('stmt-modal'));
  await p.evaluate(id => openPaymentModal('purchase', purchases[0].id));
  check(!(await p.locator('#pay-discount').isVisible()), 'tedarikçi ödemesinde kesinti alanı yok');
  await p.evaluate(() => closeModal('payment-modal'));

  console.log('2) Hediye ürün');
  const profit1 = await money('#stat-net-profit');
  await p.evaluate(() => openModal('sale-modal'));
  await p.fill('#sale-customer', 'Hediye Test');
  const rows = p.locator('#sale-items-container .item-row');
  await rows.nth(0).locator('.row-prod').fill('Kıvırcık'); await rows.nth(0).locator('.row-qty').fill('10'); await rows.nth(0).locator('.row-price').fill('25');
  await p.evaluate(() => addItemRow('sale-items-container', 'sale'));
  await rows.nth(1).locator('.row-prod').fill('Kıvırcık'); await rows.nth(1).locator('.row-qty').fill('4');
  await rows.nth(1).locator('.row-gift').check();
  check(await rows.nth(1).locator('.row-price').isDisabled(), 'hediye işaretlenince fiyat alanı kapandı');
  check((await p.locator('#sale-total-preview').innerText()).includes('250'), 'toplam yalnız ücretli kalemden: ' + await p.locator('#sale-total-preview').innerText());
  await p.locator('#sale-form').evaluate(f => f.requestSubmit());
  const hs = await p.evaluate(() => sales.find(x => x.customer === 'Hediye Test'));
  const unit = await p.evaluate(() => unitValue('Kıvırcık', 'adet').p);
  const gift = hs && hs.items.find(i => i.gift);
  check(hs && hs.total === 250, `müşteriye yalnız 250 ₺ borç yazıldı (${hs && hs.total})`);
  check(gift && gift.qty === 4 && gift.total === 0 && Math.abs(gift.cost - Math.round(4 * unit * 100) / 100) < 0.01, `hediye kalemin maliyeti kayda yazıldı (${gift && gift.cost} = 4 × ${unit.toFixed(2)})`);
  { const p2 = await money('#stat-net-profit'); check(Math.abs(profit1 + 250 - gift.cost - p2) < 0.01, `net kâr: +250 satış − hediye maliyeti (${profit1} → ${p2}, maliyet ${gift.cost})`); }
  check(Math.abs((await money('#stat-gifts')) - gift.cost) < 0.01, 'dönem özetinde hediye maliyeti görünüyor');
  check((await p.locator('#sales-list').innerText()).includes('hediye'), 'satış listesinde hediye kalem belirtiliyor');
  await p.evaluate(() => switchTab('tab-tables'));
  const gt = await p.locator('#tbl-gifts').innerText();
  check(gt.includes('Hediye Test') && gt.includes('Kıvırcık'), 'raporda hangi müşteriye ne hediye verildiği görünüyor');
  const sold = await p.evaluate(() => { let q = 0; sales.forEach(r => r.items.forEach(i => { if (fk(i.prod) === 'kıvırcık' && i.unit === 'adet' && !i.gift) q += i.qty; })); return round2(q); });
  check((await p.locator('#tbl-products tr:has-text("Kıvırcık")').first().innerText()).includes(String(sold).replace('.', ',')) || (await p.locator('#tbl-products tr:has-text("Kıvırcık")').first().innerText()).includes(String(sold)), `ürün tablosunda hediye satış sayılmadı (satılan ${sold})`);
  await p.evaluate(() => { const s = sales.find(x => x.customer === 'Hediye Test'); editRecord('sale', s.id); });
  check(await p.locator('#sale-items-container .row-gift').nth(1).isChecked(), 'düzenlemede hediye işareti korunuyor');
  await p.evaluate(() => closeModal('sale-modal'));

  console.log('3) Kalıcılık');
  await p.reload({ waitUntil: 'networkidle' });
  check(await p.evaluate(() => sales.find(x => x.customer === 'Hediye Test').items.some(i => i.gift && i.cost > 0)), 'yeniden açınca hediye bilgisi duruyor');
  check(await p.evaluate(id => sales.find(x => x.id === id).payments.some(x => x.kind === 'kesinti'), sid), 'yeniden açınca kesinti bilgisi duruyor');
  check(errs.length === 0, 'sayfa hatası yok ' + JSON.stringify(errs.slice(0, 3)));
  console.log(fails ? `SONUÇ: ${fails} BAŞARISIZ` : 'SONUÇ: TÜM KONTROLLER GEÇTİ'); await b.close(); s.close(); process.exit(fails ? 1 : 0);
});
