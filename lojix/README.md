# Lojix

Frigo tır filosu için sefer, navlun, yakıt, gider, cari ve bakım takibi. Firebase Hosting + Firestore (proje: `lojix-pro`).

## Yapı
- `public/index.html` — sayfa iskeleti
- `public/js/` — yükleme sırası: `core.js` (veri, hesap, ekranlar) → `report.js` (PDF raporlar) → `app.js` (formlar, yedek) → `sync.js` (bulut eşitleme)
- `src/app.css` — Tailwind girdisi; `public/css/app.css` buradan üretilir
- `public/sw.js` — internetsiz açılış

## Veri
Ekip ortak filoyu kullanır. Her kayıt ayrı Firestore belgesi: `fleets/lojix/{vehicles|clients|trips|fuels|expenses|payments|companies}/{kayıtId}`.
Erişim `firestore.rules` içindeki UID listesiyle sınırlı. Eski tek belge `lojix_data/1`, bulut boşken ilk girişte bir kez içe alınır.

## Komutlar
```bash
npm install
npm run build:css
npx firebase-tools hosting:channel:deploy onizleme --project lojix-pro   # önizleme
npx firebase-tools deploy --only hosting,firestore:rules --project lojix-pro  # canlı
```

## Test
```bash
npx firebase-tools emulators:start --only auth,firestore --project lojix-pro   # ayrı terminalde
node scripts/sync-test.js   # iki telefon + yabancı hesap: taşıma, canlı eşitleme, çevrimdışı, kurallar
node scripts/ui-test.js     # araç ekle/sil, sefer km, fatura arama, sefere bağlı tahsilat, formlar (emülatör gerekmez)
```
`scripts/seed.json` uydurma deneme verisidir.


