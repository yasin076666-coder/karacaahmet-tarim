// Son fiyat, grafik ayrıntısı, yedek uyarısı ve internetsiz açılış testi.  node scripts/ui-test.js public <tohum.json>
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const [dir,seedFile]=process.argv.slice(2); const seed=JSON.parse(fs.readFileSync(seedFile,'utf8'));
let fails=0; const check=(ok,m)=>{console.log((ok?'  ✔ ':'  ✘ ')+m); if(!ok) fails++;};
const s=http.createServer((q,res)=>{const u=q.url.split('?')[0];const f=path.join(dir,u==='/'?'index.html':u);fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});res.end(b);});}).listen(8830,async()=>{
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});await c.addInitScript(s=>{if(!sessionStorage.x){for(const k in s)localStorage.setItem(k,s[k]);sessionStorage.x=1;}},seed);
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8830/',{waitUntil:'networkidle'});
// 1) Son fiyat
const want=await p.evaluate(()=>{let best=null;sales.forEach(r=>r.items.forEach(i=>{if(i.prod==='Kıvırcık'&&(!best||r.date>best.d))best={d:r.date,p:i.price};}));return best&&best.p;});
await p.evaluate(()=>openModal('sale-modal'));
const prod=p.locator('#sale-items-container .row-prod').first(); await prod.click(); await prod.pressSequentially('kıvır');
await p.locator('[data-i="0"]').first().dispatchEvent('pointerdown');
const got=await p.locator('#sale-items-container .row-price').first().inputValue();
check(String(got)===String(want), `Kıvırcık seçilince son satış fiyatı doldu (${got} = ${want})`);
await p.evaluate(()=>closeModal('sale-modal'));
// 2) Grafik ayrıntısı: verisi olan son ay
await p.evaluate(()=>switchTab('tab-tables'));
const tip=await p.locator('#chart-tip').innerText(); check(/Ekim 2026/.test(tip), 'grafik ayrıntısı verisi olan son ayı gösteriyor: '+tip.split('·')[0].trim());
// 3) Yedek uyarısı bulut açıkken gizli
await p.evaluate(()=>{window.__ktCloudOk=true;updateBackupBanner();});
check(await p.locator('#backup-banner').isHidden(), 'bulut eşitlemesi açıkken yedek uyarısı gizli');
// 4) İnternetsiz açılış
await p.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:10000}).catch(()=>{});
await p.reload({waitUntil:'networkidle'}); // önbellek dolsun (SW kontrolünde ikinci yükleme)
await c.setOffline(true);
await p.reload({waitUntil:'load'}).catch(e=>errs.push('offline reload: '+e.message));
await p.waitForTimeout(800);
const n=await p.evaluate(()=>typeof sales!=='undefined'?sales.length:-1).catch(()=>-1);
check(n===JSON.parse(seed.tp_sales).length, `internet yokken uygulama açıldı ve ${n} satış görünüyor`);
check(await p.locator('nav button').count()===6, 'internet yokken alt menü yerinde (stil yüklendi)');
await c.setOffline(false);
check(errs.filter(e=>!/offline|Firebase|firestore/i.test(e)).length===0,'sayfa hatası yok '+JSON.stringify(errs.slice(0,3)));
console.log(fails?`SONUÇ: ${fails} BAŞARISIZ`:'SONUÇ: TÜM KONTROLLER GEÇTİ'); await b.close(); s.close(); process.exit(fails?1:0);});
