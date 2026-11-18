// Fire ve otomatik birim testi.  node scripts/stock-test.js public <tohum.json>
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const [dir,seedFile]=process.argv.slice(2); const seed=JSON.parse(fs.readFileSync(seedFile,'utf8'));
let fails=0; const check=(ok,m)=>{console.log((ok?'  ✔ ':'  ✘ ')+m); if(!ok) fails++;};
const s=http.createServer((q,res)=>{const u=q.url.split('?')[0];const f=path.join(dir,u==='/'?'index.html':u);fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(b);});}).listen(0,async()=>{
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});await c.addInitScript(s=>{if(!sessionStorage.x){for(const k in s)localStorage.setItem(k,s[k]);sessionStorage.x=1;}},seed);
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('http://localhost:'+s.address().port+'/',{waitUntil:'networkidle'});
// 1) Otomatik birim: öneriden seçmeden, adı yazınca
await p.evaluate(()=>openModal('sale-modal'));
const prod=p.locator('#sale-items-container .row-prod').first(), unit=p.locator('#sale-items-container .row-unit').first();
await prod.fill('Maydanoz'); await prod.dispatchEvent('input');
check(await unit.inputValue()==='adet', 'satışta "Maydanoz" yazınca birim adet oldu');
await prod.fill('lahana'); await prod.dispatchEvent('input');
check(await unit.inputValue()==='kg', 'satışta "lahana" yazınca birim kg oldu');
await prod.fill('Yeni Ürün'); await prod.dispatchEvent('input');
check(await unit.inputValue()==='kg', 'bilinmeyen üründe birim değişmedi');
await p.evaluate(()=>closeModal('sale-modal'));
// 2) Fire: öneriden seçince birim, kayıt, değer
await p.evaluate(()=>{ setQuickDate('all'); openWasteModal(); });
await p.locator('#waste-prod').pressSequentially('maydan'); await p.locator('[data-i="0"]').first().dispatchEvent('pointerdown');
check(await p.locator('#waste-unit').inputValue()==='adet', 'fire penceresinde öneriden Maydanoz seçilince birim adet');
await p.fill('#waste-qty','4'); await p.evaluate(()=>saveWaste());
// Maydanoz alış kaydı yok → değer ortalama satış fiyatıyla
const want=await p.evaluate(()=>{let q=0,t=0;sales.forEach(r=>r.items.forEach(i=>{if(fk(i.prod)==='maydanoz'&&i.unit==='adet'){q+=i.qty;t+=i.total||i.qty*i.price;}}));return formatMoney(Math.round(4*t/q*100)/100);});
await p.evaluate(()=>switchTab('tab-tables'));
const row=await p.locator('#tbl-stock tr:has-text("Maydanoz")').innerText();
check(row.includes(want) && row.includes('satış fiyatıyla'), `fire değeri satış fiyatıyla hesaplandı (${want})`);
// Alış kaydı olan ürün: Kıvırcık → ortalama alış fiyatı
await p.evaluate(()=>{ wastes.unshift({id:newId('W'),date:getTodayString(),prod:'Kıvırcık',unit:'adet',qty:10,note:''}); saveAll(); applyFilters(); });
const want2=await p.evaluate(()=>{let q=0,t=0;purchases.forEach(r=>r.items.forEach(i=>{if(fk(i.prod)==='kıvırcık'&&i.unit==='adet'){q+=i.qty;t+=i.total||i.qty*i.price;}}));return formatMoney(Math.round(10*t/q*100)/100);});
const row2=await p.locator('#tbl-stock tr:has-text("Kıvırcık")').innerText();
check(row2.includes(want2) && !row2.includes('satış fiyatıyla'), `alınan üründe fire değeri alış fiyatıyla (${want2})`);
// 3) Kalıcılık ve silme
await p.reload({waitUntil:'networkidle'});
check(await p.evaluate(()=>wastes.length)===2, 'yeniden açınca 2 fire kaydı duruyor');
const id=await p.evaluate(()=>wastes[0].id); await p.evaluate(id=>deleteWaste(id),id);
check(await p.evaluate(()=>wastes.length)===1, 'fire kaydı silindi');
check(errs.length===0,'sayfa hatası yok '+JSON.stringify(errs.slice(0,3)));
console.log(fails?`SONUÇ: ${fails} BAŞARISIZ`:'SONUÇ: TÜM KONTROLLER GEÇTİ'); await b.close(); s.close(); process.exit(fails?1:0);});
