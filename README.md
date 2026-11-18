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
