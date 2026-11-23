// Önce ağ, ağ yoksa ya da çok yavaşsa önbellek: internet iyiyken her zaman güncel dosya gelir,
// internet yokken veya 3 sn içinde cevap gelmezse uygulama son çalışan sürümüyle açılır.
const CACHE = 'kt-v3'; // sürüm yükselince eski dosyalar silinir
const TIMEOUT = 3000;      // ağı bu kadar bekle
const SLOW_WINDOW = 15000; // ağ bir kez yavaş kaldıysa bu süre boyunca önbellekten hemen ver
// Önbelleğe alınacak dış kaynaklar (Firebase SDK, ikonlar). Firestore/kimlik istekleri asla önbelleğe girmez.
const CDN = ['https://www.gstatic.com/firebasejs/', 'https://cdnjs.cloudflare.com/'];
let slowUntil = 0;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const req = e.request, url = req.url;
  if (req.method !== 'GET') return;
  const same = new URL(url).origin === self.location.origin;
  if (!same && !CDN.some(p => url.startsWith(p))) return;
  const net = fetch(same ? new Request(req, { cache: 'no-store' }) : req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    slowUntil = 0;
    return res;
  });
  const cached = () => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('/index.html') : undefined));
  e.respondWith((async () => {
    try {
      if (Date.now() < slowUntil) { const c = await cached(); if (c) { e.waitUntil(net.catch(() => {})); return c; } }
      const first = await Promise.race([net, new Promise(r => setTimeout(() => r('timeout'), TIMEOUT))]);
      if (first !== 'timeout') return first;
      slowUntil = Date.now() + SLOW_WINDOW;
      const c = await cached();
      if (c) { e.waitUntil(net.catch(() => {})); return c; } // güncel sürüm arka planda iner
      return await net;
    } catch (err) {
      const c = await cached(); if (c) return c;
      throw err;
    }
  })());
});
