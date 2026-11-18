# Karacaahmet Tarım

Al-sat, masraf ve cari hesap uygulaması. Firebase Hosting + Firestore.

## Yapı
- `public/index.html` — sayfa iskeleti
- `public/js/` — uygulama kodu (yükleme sırası önemli: util → data → forms → render → backup → cards → cash → tables)
- `public/firebase-sync.js` — bulut eşitleme
- `src/app.css` — Tailwind girdisi; `public/css/app.css` buradan üretilir

## Komutlar
```bash
npm install
npm run build:css   # CSS'i üret
npm run deploy      # CSS'i üret ve yayınla
```

## Veri yapısı
Her kayıt ayrı Firestore belgesi: `users/{uid}/{sales|purchases|expenses|cards|cardPays|cashMoves}/{kayıtId}`,
işletme bilgisi `users/{uid}/meta/settings`. Eski tek belge `users/{uid}/appData/main` salt okunur yedek olarak durur.

## Testler
```bash
npx firebase-tools emulators:start --only auth,firestore   # ayrı terminalde
node scripts/sync-test.js <tohum.json> <emülatör-uid>     # iki telefonlu eşitleme testi
```
`scripts/migrate.py` eski tek belgeyi kayıt başına belgelere taşır ve doğrular (`--emulator`, `--dry-run`).
