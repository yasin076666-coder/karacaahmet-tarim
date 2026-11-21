// Önce ağ, ağ yoksa önbellek: internet varken her zaman güncel dosya gelir,
// internet yokken uygulama son çalışan sürümüyle açılır.
const CACHE = 'lojix-v2';
const CDN = ['https://www.gstatic.com/firebasejs/'];  // Firestore/kimlik istekleri asla önbelleğe girmez
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const req = e.request, url = req.url;
  if (req.method !== 'GET') return;
  const same = new URL(url).origin === self.location.origin;
  if (!same && !CDN.some(p => url.startsWith(p))) return;
  e.respondWith(
    fetch(same ? new Request(req, { cache: 'no-store' }) : req)
      .then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('/index.html') : undefined)))
  );
});
