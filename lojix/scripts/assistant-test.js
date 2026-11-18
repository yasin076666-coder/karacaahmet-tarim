// Asistan cümle çözücü testi (tarayıcı gerekmez). Kullanım: node scripts/assistant-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctxVm = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/assistant.js'), 'utf8') + '\nthis.lxParse = lxParse;', ctxVm);
const CATS = ['Şoför Maaş / Sefer Primi', 'Şoför Harcırah / Yemek / Avans', 'Periyodik Bakım & Sanayi', 'Frigo Soğutucu Bakım / Gaz', 'Lastik & Kaplama', 'HGS / OGS / Köprü / Feribot', 'Sigorta / Kasko / Muayene / MTV', 'Trafik Cezası / Diğer'];
const C = {
  today: '2026-11-18',
  vehicles: [{ id: 'V1', plate: '07 ABC 101', driver: 'Ahmet Yılmaz' }, { id: 'V2', plate: '07 ABC 102', driver: 'Mehmet Kaya' }, { id: 'V3', plate: '34 XYZ 560', driver: 'Ali Demir' }],
  clients: ['Toros Gıda', 'Akdeniz Sebze A.Ş.', 'Ege Meyve Ltd.'],
  companies: [{ id: 'IC_TALYA', name: 'Talya Lojistik' }, { id: 'IC_MOONLOG', name: 'Moonlog Lojistik' }],
  stations: ['Opet Afyon'], cats: CATS
};
const P = t => JSON.parse(JSON.stringify(ctxVm.lxParse(t, C)));
let fails = 0;
function expect(text, want) {
  const got = P(text), bad = Object.keys(want).filter(k => JSON.stringify(got[k]) !== JSON.stringify(want[k]));
  console.log((bad.length ? '  ✘ ' : '  ✔ ') + text + (bad.length ? '\n      beklenen ' + JSON.stringify(Object.fromEntries(bad.map(k => [k, want[k]]))) + '\n      gelen    ' + JSON.stringify(Object.fromEntries(bad.map(k => [k, got[k]]))) : ''));
  if (bad.length) fails++;
}
console.log('Sefer');
expect("101 Antalya'dan İstanbul'a sefer 45 bin Toros Gıda 900 km, 30 gün vadeli", { type: 'trip', vehicleId: 'V1', route: 'Antalya - İstanbul', client: 'Toros Gıda', price: 45000, km: 900, due: '2026-12-18', paid: 'Vadeli / Bekliyor' });
expect("Ahmet Talya üzerinden Mersin'den İzmir'e 38 bin navlun", { type: 'trip', vehicleId: 'V1', company: 'IC_TALYA', route: 'Mersin - İzmir', price: 38000 });
expect('07 ABC 102 Antalya - Bursa Ege Meyve kırk iki bin lira peşin', { type: 'trip', vehicleId: 'V2', route: 'Antalya - Bursa', price: 42000, paid: 'Tahsil Edildi' });
expect("dün Mehmet'le Antalya'dan Ankara'ya 36.500 lira sefer, Akdeniz Sebze", { type: 'trip', vehicleId: 'V2', date: '2026-11-17', route: 'Antalya - Ankara', client: 'Akdeniz Sebze A.Ş.', price: 36500 });
expect("560 Antalya'dan İstanbul Hal'e sefer 50 bin yüzde 7 komisyon", { type: 'trip', vehicleId: 'V3', route: 'Antalya - İstanbul Hal', price: 50000, commPct: 7 });
console.log('Yakıt');
expect("101'e 400 litre mazot 44,5'ten, kilometre 412000, Opet", { type: 'fuel', vehicleId: 'V1', fuelType: 'CEKICI', liters: 400, unitPrice: 44.5, totalCost: 17800, odometerKm: 412000, station: 'Opet' });
expect('102 frigo mazotu 80 litre 3500 lira', { type: 'fuel', vehicleId: 'V2', fuelType: 'FRIGO', liters: 80, totalCost: 3500, unitPrice: 43.75 });
expect('560 AdBlue 40 litre 900 lira', { type: 'fuel', vehicleId: 'V3', fuelType: 'ADBLUE', liters: 40, totalCost: 900 });
expect('Ali 350 litre motorin toplam 15 bin 575 lira gösterge 188000', { type: 'fuel', vehicleId: 'V3', liters: 350, totalCost: 15575, odometerKm: 188000 });
expect('Ahmet 300 litre mazot 13350 lira 412500 km de', { type: 'fuel', vehicleId: 'V1', liters: 300, totalCost: 13350, odometerKm: 412500 });
console.log('Gider');
expect("Ahmet'e 2500 harcırah", { type: 'expense', vehicleId: 'V1', amount: 2500, category: CATS[1] });
expect('101 lastik 18 bin', { type: 'expense', vehicleId: 'V1', amount: 18000, category: CATS[4] });
expect('560 HGS 750', { type: 'expense', vehicleId: 'V3', amount: 750, category: CATS[5] });
expect('102 kasko 32 bin lira ödedim', { type: 'expense', vehicleId: 'V2', amount: 32000, category: CATS[6] });
expect('Mehmet sanayide yağ değişimi 4500 lira', { type: 'expense', vehicleId: 'V2', amount: 4500, category: CATS[2] });
expect('101 frigo gaz dolumu 6000', { type: 'expense', vehicleId: 'V1', amount: 6000, category: CATS[3] });
expect('dün trafik cezası 2700 lira', { type: 'expense', amount: 2700, category: CATS[7], date: '2026-11-17' });
console.log('Tahsilat');
expect('Toros Gıda 50 bin havale gönderdi', { type: 'payment', client: 'Toros Gıda', amount: 50000, note: 'Havale / EFT' });
expect("Ege Meyve'den 20 bin tahsil ettik", { type: 'payment', client: 'Ege Meyve Ltd.', amount: 20000 });
console.log('Rapor');
expect('Bu ay net kâr ne kadar?', { type: 'report', period: 'month', metric: 'profit' });
expect("Toros Gıda'nın borcu ne kadar?", { type: 'report', metric: 'balance', client: 'Toros Gıda' });
expect('101 bu ay yakıt ne kadar', { type: 'report', period: 'month', metric: 'fuel', vehicleId: 'V1' });
expect('geçen ay kaç sefer yaptık', { type: 'report', period: 'lastmonth', metric: 'trips' });
expect('Bugün ne kadar navlun', { type: 'report', period: 'today', metric: 'freight' });
console.log(fails ? `\n${fails} cümle BAŞARISIZ` : '\nTüm cümleler doğru çözüldü');
process.exit(fails ? 1 : 0);
