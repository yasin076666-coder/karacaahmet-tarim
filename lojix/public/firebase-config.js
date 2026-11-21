// Firebase web istemci yapılandırması (gizli değildir); erişim denetimi firestore.rules ile yapılır.
window.LOJIX_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAdVZ1ughHtV941Uq38mbCWzTBxLSpoiDg",
  authDomain: "lojix-pro.firebaseapp.com",
  projectId: "lojix-pro",
  storageBucket: "lojix-pro.firebasestorage.app",
  messagingSenderId: "1092996236980",
  appId: "1:1092996236980:web:dd6c49169081794ad079e1"
};
// Sahip (UID): kullanıcıları ve rolleri yönetir. firestore.rules içindeki owner() ile aynı tutun.
// Diğer herkesin rolü Ayarlar > Kullanıcılar'dan verilir (fleets/lojix/users).
window.LOJIX_OWNER = 'yBvvM9DhzXaOzq77zh64mwIdF3l2';
