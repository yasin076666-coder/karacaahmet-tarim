// Renkler Cost Tarım logosundan: orman yeşili yazı, yaprak yeşili, adaçayı zemin.
// Tailwind'in renk adları yeniden tanımlanır; böylece JS'in ürettiği bütün sınıflar da yeni temaya geçer.
module.exports = {
  content: ['public/index.html', 'public/js/**/*.js', 'public/firebase-sync.js'],
  theme: {
    extend: {
      colors: {
        // Nötr: yeşile çalan gri; 800-900 orman yeşili (başlık, ana yazı, seçili sekme)
        slate: { 50: '#F5F7F2', 100: '#EAEFE6', 200: '#D8E0D2', 300: '#BAC6B3', 400: '#8B9985', 500: '#66745F', 600: '#4E5B48', 700: '#3C4937', 800: '#2B4335', 900: '#213529', 950: '#17261D' },
        // Satış ve ana eylemler: yaprak yeşili
        emerald: { 50: '#F1F8E9', 100: '#DFF0CB', 200: '#C3E29E', 300: '#A0CF6B', 400: '#7CB842', 500: '#5F9E2F', 600: '#4A8427', 700: '#3B6A21', 800: '#31561D', 900: '#28461A' },
        // Alış: hasat sarısı
        amber: { 50: '#FBF5E8', 100: '#F5E6C4', 200: '#EBCD8C', 300: '#DFB257', 400: '#D19A33', 500: '#BD8420', 600: '#A06D17', 700: '#7F5614', 800: '#634312', 900: '#4F3610' },
        // Gider: kiremit
        rose: { 50: '#FBF0EE', 100: '#F5DDD8', 200: '#EBBBB2', 300: '#DE9485', 400: '#D06F5C', 500: '#BF5640', 600: '#A84432', 700: '#8A3627', 800: '#6E2C21', 900: '#59251C' },
        // Alacak / cari: su yeşili
        indigo: { 50: '#EDF6F4', 100: '#D3EAE6', 200: '#A9D4CD', 300: '#79B9AF', 400: '#4F9C91', 500: '#3A847A', 600: '#2E6E66', 700: '#265953', 800: '#204844', 900: '#1B3B38' },
        // Kartlar: mürdüm
        violet: { 50: '#F6F0F4', 100: '#EBDCE6', 200: '#D7BACC', 300: '#BF92AE', 400: '#A46F91', 500: '#8C5679', 600: '#764666', 700: '#5F3953', 800: '#4C2F43', 900: '#3E2737' },
        // Borç: toprak turuncusu
        orange: { 50: '#FBF2EA', 100: '#F5E0CC', 200: '#EBC09A', 300: '#DE9C68', 400: '#CF7D43', 500: '#B9652C', 600: '#9C5223', 700: '#7D411D', 800: '#64351A', 900: '#512C17' },
      },
      fontFamily: {
        sans: ['Rubik', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
    },
  },
};
