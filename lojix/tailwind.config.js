// Renkler CSS değişkenlerine bağlı: aynı sınıflar açık ve koyu temada doğru görünür (değerler src/app.css :root içinde).
const v = n => `var(--${n})`;
const scale = (soft, strong, extra = {}) => ({ 50: v(soft), 100: v(soft), 200: v(soft), 400: v(strong), 500: v(strong), 600: v(strong), 700: v(strong), 800: v(strong), ...extra });
module.exports = {
  content: ['public/index.html', 'public/js/**/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      colors: {
        slate: { 50: v('sunken'), 100: v('sunken'), 200: v('line'), 300: v('line'), 400: v('faint'), 500: v('muted'), 600: v('muted'), 700: v('text'), 800: v('text'), 900: v('text') },
        emerald: scale('pos-soft', 'pos'),
        rose: scale('neg-soft', 'neg'),
        amber: scale('warn-soft', 'warn'),
        blue: scale('brand-soft', 'brand-text'),
        sky: scale('ice-soft', 'ice'),
        indigo: scale('violet-soft', 'violet'),
        violet: scale('violet-soft', 'violet'),
        purple: scale('violet-soft', 'violet')
      }
    }
  }
};
