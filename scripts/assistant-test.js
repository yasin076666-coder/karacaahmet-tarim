// Asistan arayüz testi (gerçek veri kopyasıyla).  node scripts/assistant-test.js public <tohum.json>
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const [dir,seedFile]=process.argv.slice(2); const seed=JSON.parse(fs.readFileSync(seedFile,'utf8'));
let fails=0; const check=(ok,m)=>{console.log((ok?'  ✔ ':'  ✘ ')+m); if(!ok) fails++;};
const s=http.createServer((q,res)=>{const u=q.url.split('?')[0];const f=path.join(dir,u==='/'?'index.html':u);fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(b);});}).listen(0,async()=>{
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});await c.addInitScript(s=>{if(!sessionStorage.x){for(const k in s)localStorage.setItem(k,s[k]);sessionStorage.x=1;}},seed);
const p=await c.newPage();const errs=[],dialogs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{dialogs.push(d.message());d.accept();});
await p.goto('http://localhost:'+s.address().port+'/',{waitUntil:'networkidle'});
const ask=async t=>{await p.fill('#asst-input',t);await p.locator('#asst-input').press('Enter');await p.waitForTimeout(150);return p.locator('#asst-out').innerText();};
const v=sel=>p.locator(sel).first().inputValue();
// 1) Satış formu doldurulur, kaydedince kayıt eklenir
const n0=await p.evaluate(()=>sales.length);
await ask("Halil kardeşi'ne 20 adet kıvırcık 25 liradan sattım, 200 peşin aldım");
check(await p.locator('#sale-modal').isVisible(),'satış formu açıldı');
check(await v('#sale-customer')==='Halil kardeşi' && await v('#sale-items-container .row-prod')==='Kıvırcık' && await v('#sale-items-container .row-qty')==='20' && await v('#sale-items-container .row-unit')==='adet' && await v('#sale-items-container .row-price')==='25' && await v('#sale-paid')==='200','form alanları doğru: Halil kardeşi, Kıvırcık 20 adet × 25, peşin 200');
await p.locator('#sale-form').evaluate(f=>f.requestSubmit());
const last=await p.evaluate(()=>sales[0]);
check(await p.evaluate(()=>sales.length)===n0+1 && last.total===500 && last.paid===200,'Kaydet ile satış eklendi (500 ₺, 200 peşin)');
// 2) Fiyatı söylenmeyen kalem son fiyattan dolar
await ask("Latif'e 10 kilo lahana sattım");
const lp=await p.evaluate(()=>lastPrice('Lahana', sales));
check(await v('#sale-items-container .row-price')===String(lp) && await v('#sale-items-container .row-unit')==='kg',`fiyat söylenmeyince son satış fiyatı geldi (${lp}) ve birim kg`);
await p.evaluate(()=>closeModal('sale-modal'));
// 3) Gider formu
await ask('dün 750 lira mazot');
check(await p.locator('#expense-modal').isVisible() && await v('#expense-amount')==='750' && await v('#expense-category')==='Mazot / Yakıt','gider formu: 750 ₺, Mazot / Yakıt');
check(await v('#expense-date')===await p.evaluate(()=>{const d=new Date(getTodayString()+'T12:00');d.setDate(d.getDate()-1);return toDateStr(d);}),'"dün" tarihi doğru');
await p.evaluate(()=>closeModal('expense-modal'));
// 4) Tahsilat: açık kayıtlara eskiden yeniye
const before=await p.evaluate(()=>round2(sales.filter(r=>fk(r.customer)==='halil kardeşi').reduce((a,r)=>a+r.total-(r.paid||0),0)));
const out=await ask('Halil kardeşi 1000 lira ödedi');
const after=await p.evaluate(()=>round2(sales.filter(r=>fk(r.customer)==='halil kardeşi').reduce((a,r)=>a+r.total-(r.paid||0),0)));
check(dialogs.some(d=>d.includes('1.000,00')&&d.includes('eskiden yeniye')),'tahsilat öncesi onay soruldu');
check(Math.abs(before-after-1000)<0.01,`alacak 1000 ₺ azaldı (${before} → ${after})`);
const oldest=await p.evaluate(()=>sales.filter(r=>fk(r.customer)==='halil kardeşi').sort((a,b)=>a.date.localeCompare(b.date))[0]);
check(oldest.payments.some(x=>x.note==='Asistan: tahsilat'),'ödeme en eski kayda işlendi');
// 5) Raporlar
const want=await p.evaluate(()=>formatMoney(round2(sales.filter(r=>fk(r.customer)==='halil kardeşi').reduce((a,r)=>a+r.total-(r.paid||0),0))));
check((await ask("Halil kardeşi'nin borcu ne kadar?")).includes(want),`borç sorusu: ${want}`);
check((await ask('Kasada ne kadar var')).includes(await p.locator('#cash-total').innerText()),'kasa sorusu kasa kartıyla aynı');
const tot=await p.evaluate(()=>formatMoney(round2(sales.reduce((a,r)=>a+r.total,0))));
check((await ask('Toplam ne kadar sattım?')).includes(tot),`tüm zamanlar satış: ${tot}`);
check((await ask('Bu ay en çok ne sattım')).includes('en çok satılanlar'),'en çok satılanlar cevabı');
check((await ask('selam')).includes('Anlayamadım'),'anlaşılmayan cümlede yardım gösterildi');
// 6) Mikrofon: destek yoksa klavye mikrofonuna yönlendirir (hata vermez)
await p.evaluate(()=>{delete window.SpeechRecognition;window.webkitSpeechRecognition=undefined;asstListen();});
check((await p.locator('#asst-out').innerText()).includes('klavyedeki'),'ses tanıma yoksa klavye mikrofonu önerildi');
// 7) Mikrofon akışı (sahte tanıyıcı): canlı yazı, susunca gönderme, sesli cevap, durdurma
await p.evaluate(()=>{
  window.__spoken=[]; Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices:()=>[{lang:'tr-TR',name:'TR'}],speak:u=>{window.__speakCalls=(window.__speakCalls||0)+1;if(u.text.trim())window.__spoken.push(u.text);}}});
  window.SpeechSynthesisUtterance=function(t){this.text=t;};
  window.webkitSpeechRecognition=function(){const r=this;window.__rec=r;r.start=()=>{};r.stop=()=>{r.onend&&r.onend();};};
});
await p.evaluate(()=>asstListen());
check((await p.locator('#asst-out').innerText()).includes('Dinliyorum'),'mikrofon açıldı: "Dinliyorum…"');
await p.evaluate(()=>window.__rec.onresult({results:[Object.assign([{transcript:'kasada ne'}],{isFinal:false})]}));
check(await p.locator('#asst-input').inputValue()==='kasada ne','konuşurken yazı kutuda canlı göründü');
check(!(await p.evaluate(()=>window.__spoken.length)),'yarım cümlede henüz gönderilmedi');
await p.evaluate(()=>{window.__rec.onresult({results:[Object.assign([{transcript:'kasada ne kadar var'}],{isFinal:true})]});window.__rec.onend();});
const spoken=await p.evaluate(()=>window.__spoken);
const cash=(await p.locator('#cash-total').innerText()).replace('₺','').replace(/,00$/,'');
check(spoken.length===1 && spoken[0].includes(cash+' lira') && !spoken[0].includes('₺'),'cümle bitince gönderildi ve cevap sesli okundu: "'+spoken[0]+'"');
await p.evaluate(()=>{asstListen();});
await p.evaluate(()=>asstListen()); // tekrar basınca durur
check(await p.evaluate(()=>asstRec===null) && await p.locator('#asst-mic.bg-emerald-600').count()===1,'mikrofona tekrar basınca dinleme durdu');
await ask('Kasada ne kadar var');
check((await p.evaluate(()=>window.__spoken.length))===1,'yazarak sorulunca sesli okunmadı');
// 8) iPhone davranışları: birikimli ara sonuçlar tekrar etmez, duraklamada kesmez, mikrofonda okuma başlatılmaz
await p.evaluate(()=>{ window.__spoken=[]; window.__rec=null; window.__speakCalls=0; });
await p.evaluate(()=>asstListen());
check(await p.evaluate(()=>window.__speakCalls===0),'mikrofona basınca sesli okuma başlatılmadı (mikrofonu meşgul etmez)');
const R=(list,idx)=>({list,idx}); // diziler tarayıcıda kurulur (isFinal yolda kaybolmasın)
await p.evaluate(({list,idx})=>window.__rec.onresult({resultIndex:idx,results:list.map(([t,f])=>Object.assign([{transcript:t}],{isFinal:f}))}),R([['kasada',false]],0));
await p.evaluate(({list,idx})=>window.__rec.onresult({resultIndex:idx,results:list.map(([t,f])=>Object.assign([{transcript:t}],{isFinal:f}))}),R([['kasada',false],['kasada ne',false]],1));
await p.evaluate(({list,idx})=>window.__rec.onresult({resultIndex:idx,results:list.map(([t,f])=>Object.assign([{transcript:t}],{isFinal:f}))}),R([['kasada',false],['kasada ne',false],['kasada ne kadar',true]],2));
check(await p.locator('#asst-input').inputValue()==='kasada ne kadar','birikimli ara sonuçlar tekrar etmedi: "'+await p.locator('#asst-input').inputValue()+'"');
await p.waitForTimeout(1200); // kısa duraklama
check(await p.evaluate(()=>asstRec!==null),'kısa duraklamada dinleme kesilmedi');
await p.evaluate(({list,idx})=>window.__rec.onresult({resultIndex:idx,results:list.map(([t,f])=>Object.assign([{transcript:t}],{isFinal:f}))}),R([['kasada ne kadar',true],['var',true]],1));
{const v=await p.locator('#asst-input').inputValue();check(v==='kasada ne kadar var','duraklamadan sonra söylenen eklendi: "'+v+'" kayıt açık: '+await p.evaluate(()=>asstRec!==null));}
await p.waitForTimeout(3200); // uzun sessizlik: kendiliğinden gönderir
check(await p.evaluate(()=>asstRec===null) && (await p.evaluate(()=>window.__spoken[0]||'')).includes('lira'),'sessizlikten sonra gönderildi ve cevap okundu');
// "bitti" işareti hiç gelmeyen iPhone: birikimli ara sonuçlar yine tekrar etmeden birleşir
await p.evaluate(()=>{ window.__spoken=[]; asstListen(); });
await p.evaluate(({list,idx})=>window.__rec.onresult({resultIndex:idx,results:list.map(([t,f])=>Object.assign([{transcript:t}],{isFinal:f}))}),R([['kasada',false],['kasada ne',false],['kasada ne kadar var',false]],2));
check(await p.locator('#asst-input').inputValue()==='kasada ne kadar var','"bitti" işareti gelmeyince de tekrarsız: "'+await p.locator('#asst-input').inputValue()+'"');
await p.evaluate(()=>asstListen()); // tekrar basınca gönderir
check((await p.evaluate(()=>window.__spoken[0]||'')).includes('lira'),'mikrofona tekrar basınca gönderildi ve cevap okundu');
await p.evaluate(()=>{ window.__rec=null; asstListen(); });
await p.waitForTimeout(7600); // hiç ses gelmiyor
check((await p.locator('#asst-out').innerText()).includes('Dikte'),'ses gelmeyince ne yapılacağı söylendi');
check(await p.evaluate(()=>asstRec===null),'ses gelmeyince dinleme kapandı');
check(errs.length===0,'sayfa hatası yok '+JSON.stringify(errs.slice(0,3)));
await p.screenshot({path:process.env.SHOT||'/dev/null'}).catch(()=>{});
console.log(fails?`SONUÇ: ${fails} BAŞARISIZ`:'SONUÇ: TÜM KONTROLLER GEÇTİ'); await b.close(); s.close(); process.exit(fails?1:0);});
