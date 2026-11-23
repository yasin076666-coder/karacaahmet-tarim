/* Lojix ortak filo eşitlemesi.
   Her kayıt ayrı belgedir: fleets/lojix/{tür}/{kayıtId} = { data, updatedAt, updatedBy }.
   Ekipteki herkes aynı filoyu görür. Cihazdaki veri (yerel), buluttaki veri (sunucu) ve son eşitlenen hâl (taban)
   üçlü karşılaştırılır: çevrimdışı eklenen kayıt yüklenir, öbür telefonda silinen kayıt burada da silinir. */
(function () {
  const $ = id => document.getElementById(id);
  const FLEET = 'lojix';
  // bulut koleksiyonu -> uygulama durumundaki dizi
  const KINDS = { vehicles: 'vehicles', clients: 'clients', trips: 'trips', fuels: 'fuels', expenses: 'expenses', payments: 'payments', companies: 'intermediaryCompanies' };
  const COLLS = Object.keys(KINDS);
  const BULK_DELETE_CONFIRM = 10;   // bundan çok silme tek seferde onaysız gitmez
  const BASE_KEY = 'LOJIX_SYNCED_V1';
  const LIMITS = { partner: ['trips', 'expenses', 'fuels'], driver: ['expenses', 'fuels'] };   // sınırlı rollerin kendi kayıt türleri
  const TRASH_DAYS = 15;
  const role = () => window.LX_ROLE || 'writer';
  const limits = () => LIMITS[role()] || null;
  const allowed = key => !limits() || limits().includes(key.slice(0, key.indexOf('/')));
  let auth = null, db = null, user = null, unsubs = [], ready = false, busy = false, again = false;
  let base = {};    // 'tür/id' -> son eşitlenen kaydın kanonik JSON'u (cihazda saklanır)
  let remote = {};  // 'tür/id' -> sunucudaki kanonik JSON
  // Artımlı eşitleme: açılışta yalnızca son eşitlemeden (imleç) beri değişen kayıtlar okunur; silinenler 'deleted' işaretiyle gelir.
  const SKEW = window.LX_SYNC_SKEW || 120000, FULL_AFTER = 40 * 864e5, TOMB_DAYS = 60;
  let cursor = 0, maxSeen = 0, remoteAt = {}, dirty = new Set();

  function say(msg, tone) {
    const el = $('lojix-cloud-status'); if (el) { el.textContent = msg; el.dataset.tone = tone || ''; }
    const st = !user ? 'off' : tone === 'error' ? 'error' : tone === 'ok' ? 'ok' : 'busy';
    const pill = $('sync-pill'); if (pill) { pill.dataset.state = st; pill.title = msg; }
    window.__lxCloud = st; if (window.renderCloudBanner) window.renderCloudBanner();
  }

  // Anahtar sırasından bağımsız JSON: Firestore haritaları başka sırada döndürebilir.
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function localMap() {
    const m = {};
    COLLS.forEach(k => state[KINDS[k]].forEach(r => { if (r && r.id !== undefined && r.id !== '') m[k + '/' + r.id] = canon(r); }));
    return m;
  }
  function toAppData(m) {
    const d = {}; Object.values(KINDS).forEach(k => d[k] = []);
    Object.keys(m).forEach(key => { const k = key.slice(0, key.indexOf('/')); if (KINDS[k]) d[KINDS[k]].push(JSON.parse(m[key])); });
    d.vehicles.sort((a, b) => String(a.id).localeCompare(String(b.id), 'tr', { numeric: true }));
    return d;
  }
  function apply(m) { window.__lxApplyData(toAppData(m)); }
  function loadBase(uid) { try { const s = JSON.parse(localStorage.getItem(BASE_KEY) || '{}'); return s.uid === uid && s.map ? s : { map: {} }; } catch (e) { return { map: {} }; } }
  // İmleç yalnızca gelen her değişiklik cihaza işlendiyse ilerler (arada kapanırsa bir sonraki açılışta yeniden okunur).
  function saveBase() { if (ready && !dirty.size) cursor = Math.max(cursor, maxSeen); try { localStorage.setItem(BASE_KEY, JSON.stringify({ uid: user.uid, map: base, cursor })); } catch (e) {} }
  const tombRef = key => coll('deleted').doc(key.replace('/', '_'));
  function coll(k) { return db.collection('fleets').doc(FLEET).collection(k); }
  function ref(key) { const i = key.indexOf('/'); return coll(key.slice(0, i)).doc(key.slice(i + 1)); }
  function count(m) { const c = {}; Object.keys(m).forEach(k => { const t = k.split('/')[0]; c[t] = (c[t] || 0) + 1; }); return `${c.vehicles || 0} araç, ${c.trips || 0} sefer, ${c.fuels || 0} yakıt, ${c.expenses || 0} gider`; }

  // Yazma listesini en fazla 450'lik toplu işlemlerle gönderir. ops: [{key, json|null}]
  async function commit(ops) {
    for (let i = 0; i < ops.length; i += 450) {
      const part = ops.slice(i, i + 450), batch = db.batch();
      part.forEach(o => {
        const old = base[o.key];
        // Silinen kaydın ve iş ortağının düzenlediği kaydın eski hâli çöp kutusuna (15 gün)
        if (old !== undefined && (o.json === null || limits())) {
          const i = o.key.indexOf('/'), at = Date.now();
          batch.set(coll('trash').doc(`${o.key.slice(0, i)}_${o.key.slice(i + 1)}_${at}`), {
            kind: o.key.slice(0, i), recordId: o.key.slice(i + 1), action: o.json === null ? 'delete' : 'edit',
            data: JSON.parse(old), after: o.json === null ? null : JSON.parse(o.json),
            by: user.uid, byName: window.__lxName || user.email || '', at: firebase.firestore.FieldValue.serverTimestamp(), expiresAt: at + TRASH_DAYS * 864e5 });
        }
        if (o.json === null) {   // silme işareti: kapalı telefonlar da açılışta silineni öğrensin
          const i = o.key.indexOf('/');
          batch.set(tombRef(o.key), { kind: o.key.slice(0, i), recordId: o.key.slice(i + 1), createdBy: (old && JSON.parse(old).createdBy) || '', by: user.uid, at: firebase.firestore.FieldValue.serverTimestamp() });
        } else if (old === undefined && role() === 'writer') batch.delete(tombRef(o.key));   // geri alınan / yeniden eklenen kaydın işareti kalkar
        if (o.json === null) batch.delete(ref(o.key));
        else batch.set(ref(o.key), { data: JSON.parse(o.json), updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: user.uid });
      });
      await batch.commit();
      part.forEach(o => { if (o.json === null) delete base[o.key]; else base[o.key] = o.json; });
      saveBase();
    }
  }
  function confirmDeletes(ops) {
    const n = ops.filter(o => o.json === null).length;
    return n <= BULK_DELETE_CONFIRM || window.confirm(`Buluttan ${n} kayıt silinecek; bu silme ekipteki herkesin telefonuna yansır. Devam edilsin mi? (Hayır derseniz kayıtlar bulutta kalır.)`);
  }

  // İlk açılış: yerel, sunucu ve taban üçlü birleştirilir.
  async function initialMerge() {
    const first = !Object.keys(base).length;
    if (window.LX_READONLY) {   // yalnızca görebilen hesap: bulut esastır, buluta hiçbir şey yazılmaz
      if (first) { try { localStorage.setItem(KEY + '_PRE_SYNC_BACKUP', JSON.stringify(state)); } catch (e) {} }
      base = Object.assign({}, remote); apply(remote); ready = true; dirty.clear(); saveBase();
      return say('Eşitlendi (yalnızca görüntüleme) • ' + count(remote), 'ok');
    }
    const server = remote;
    if (first) { try { localStorage.setItem(KEY + '_PRE_SYNC_BACKUP', JSON.stringify(state)); } catch (e) {} }
    let local = localMap();
    if (limits()) {   // sınırlı rol: izinli türler cihazdan, diğerleri yalnızca buluttan
      const l = {}; Object.keys(local).forEach(k => { if (allowed(k)) l[k] = local[k]; }); Object.keys(server).forEach(k => { if (!allowed(k)) l[k] = server[k]; }); local = l;
    }
    const keys = new Set([...Object.keys(local), ...Object.keys(server), ...Object.keys(base)]);
    const merged = {}, ops = [];
    keys.forEach(k => {
      const L = local[k], S = server[k], B = base[k];
      if (L === S) { if (L !== undefined) merged[k] = L; return; }
      if (L === undefined) {                               // cihazda yok
        if (B === undefined || S !== B) merged[k] = S;
        else ops.push({ key: k, json: null });             // bu cihazda silinmiş: buluttan sil
        return;
      }
      if (S === undefined) {                               // bulutta yok
        if (B !== undefined && L === B) return;            // öbür cihazda silinmiş: burada da sil
        merged[k] = L; ops.push({ key: k, json: L });      // yeni ya da çevrimdışı düzenlenmiş: yükle
        return;
      }
      // İki tarafta da var ve farklı. İlk eşitlemede bulut kazanır (cihazdaki hâl _PRE_SYNC_BACKUP'ta durur).
      if (L === B || first) merged[k] = S;
      else { merged[k] = L; ops.push({ key: k, json: L }); } // cihazda değişmiş: cihazdaki kazanır
    });
    base = Object.assign({}, remote); saveBase();
    ops.splice(0, ops.length, ...ops.filter(o => allowed(o.key)));
    if (ops.length && !confirmDeletes(ops)) {
      ops.filter(o => o.json === null).forEach(o => { merged[o.key] = server[o.key]; });
      ops.splice(0, ops.length, ...ops.filter(o => o.json !== null));
    }
    apply(merged);
    ready = true; dirty.clear(); saveBase();   // ilk birleştirme bitti: imleç kaydedilir
    if (ops.length) { say(`${ops.length} değişiklik buluta gönderiliyor…`); await commit(ops); }
    say('Eşitlendi • ' + count(merged), 'ok');
  }

  // Yerel değişiklik sonrası: farkları gönder.
  async function pushLocal() {
    if (!user || !ready || window.LX_READONLY) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const local = localMap(), ops = [];
      Object.keys(local).forEach(k => { if (local[k] !== base[k]) ops.push({ key: k, json: local[k] }); });
      Object.keys(base).forEach(k => { if (local[k] === undefined) ops.push({ key: k, json: null }); });
      ops.splice(0, ops.length, ...ops.filter(o => allowed(o.key)));
      if (!ops.length) return;
      if (!confirmDeletes(ops)) {
        ops.filter(o => o.json === null).forEach(o => { local[o.key] = base[o.key]; });
        apply(local);
        const keep = ops.filter(o => o.json !== null); ops.length = 0; ops.push(...keep);
        if (!ops.length) return;
      }
      say(navigator.onLine ? 'Buluta kaydediliyor…' : 'Çevrimdışı: kayıt cihazda, internet gelince buluta gidecek.');
      await commit(ops);
      say('Kaydedildi ve eşitlendi', 'ok');
    } catch (e) {
      say('Kayıt cihazda duruyor; bulut eşitlemesi tamamlanmadı: ' + (e.message || e), 'error');
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(pushLocal, 0); }
    }
  }

  // Öbür telefondan gelen değişiklikleri uygula.
  function onRemote(k, snap) {
    window.__lxReads = (window.__lxReads || 0) + snap.docChanges().filter(ch => ch.type !== 'removed' && !ch.doc.metadata.hasPendingWrites).length;
    snap.docChanges().forEach(ch => {
      const key = k + '/' + ch.doc.id;
      if (ch.type === 'removed') { delete remote[key]; delete remoteAt[key]; return; }
      const d = ch.doc.data({ serverTimestamps: 'none' });
      if (!d || !d.data || typeof d.data !== 'object') return;
      remote[key] = canon(d.data);
      if (d.updatedAt && d.updatedAt.toMillis) { remoteAt[key] = d.updatedAt.toMillis(); maxSeen = Math.max(maxSeen, remoteAt[key]); }
    });
    if (!ready || snap.metadata.hasPendingWrites) { dirty.add(k); return; }
    reconcile(k);
  }
  // Silme işaretleri: kayıt işaretten sonra yeniden eklenmediyse buluttan silinmiş sayılır
  function onTomb(snap) {
    const kinds = new Set();
    snap.docChanges().forEach(ch => {
      if (ch.type === 'removed') return;
      const t = ch.doc.data({ serverTimestamps: 'none' }); if (!t || !t.at || !KINDS[t.kind]) return;
      const key = t.kind + '/' + t.recordId, at = t.at.toMillis(); maxSeen = Math.max(maxSeen, at);
      if ((remoteAt[key] || 0) <= at) { delete remote[key]; delete remoteAt[key]; kinds.add(t.kind); }
    });
    if (!ready) { kinds.forEach(k => dirty.add(k)); return; }
    kinds.forEach(reconcile); if (!kinds.size) saveBase();
  }
  function reconcile(k) {
    dirty.delete(k);
    const local = localMap(), next = Object.assign({}, local);
    let changed = false;
    const keys = new Set([...Object.keys(remote), ...Object.keys(base)].filter(x => x.startsWith(k + '/')));
    keys.forEach(x => {
      const S = remote[x], B = base[x], L = local[x];
      if (S === B) return;                                           // bulutta değişiklik yok
      if (S === L) { if (S === undefined) delete base[x]; else base[x] = S; return; } // kendi yazdığımız
      if (L !== B && !window.LX_READONLY && allowed(x)) return;      // cihazda da değişmiş: cihazdaki gönderilecek (yazma izni olan türde)
      if (S === undefined) { delete next[x]; delete base[x]; } else { next[x] = S; base[x] = S; }
      changed = true;
    });
    saveBase();
    if (changed) { apply(next); say('Ekipten yeni kayıtlar alındı • ' + count(next), 'ok'); }
  }

  function detach() { unsubs.forEach(u => u()); unsubs = []; ready = false; remote = {}; remoteAt = {}; dirty = new Set(); }
  function attach(full) {
    detach();
    const saved = loadBase(user.uid);
    base = saved.map; cursor = full ? 0 : (saved.cursor || 0); maxSeen = cursor; window.__lxReads = 0;
    const L = limits(), list = L ? ['vehicles', 'clients', 'companies', ...L] : COLLS;
    // Artımlı: tam ekip üyesi, cihazda önceki eşitleme var ve 40 günden yeni. Aksi hâlde tam okuma.
    const inc = !L && Object.keys(base).length > 0 && cursor > 0 && Date.now() - cursor < FULL_AFTER;
    window.__lxIncremental = inc;
    if (inc) remote = Object.assign({}, base);
    const since = inc ? firebase.firestore.Timestamp.fromMillis(cursor - SKEW) : null;
    let pending = list.length + (inc ? 1 : 0), failed = false;
    const done = () => { if (--pending === 0 && !failed) initialMerge().catch(e => say('Bulut birleştirilemedi; cihazdaki kayıtlar korunuyor: ' + (e.message || e), 'error')); };
    say('Bulut kayıtları okunuyor…');
    if (role() === 'writer') { watchTrash(); cleanTombs(); }
    if (inc) { let f = true; unsubs.push(coll('deleted').where('at', '>=', since).onSnapshot(snap => { onTomb(snap); if (f) { f = false; done(); } }, () => { failed = true; })); }
    list.forEach(k => {
      let first = true;
      const q = L && L.includes(k) ? coll(k).where('data.createdBy', '==', user.uid) : inc ? coll(k).where('updatedAt', '>=', since) : coll(k);
      unsubs.push(q.onSnapshot(snap => {
        onRemote(k, snap);
        if (first) { first = false; done(); }
      }, err => {
        failed = true;
        say(err.code === 'permission-denied' ? 'Bu hesabın Lojix filo verisine erişim izni yok. Yöneticiden hesabınızın eklenmesini isteyin.' : 'Canlı bulut bağlantısı kesildi; cihazdaki kayıtlar korunuyor: ' + err.message, 'error');
      }));
    });
  }

  // 60 günden eski silme işaretlerini temizler (40 günden uzun açılmayan cihaz zaten tam okur)
  function cleanTombs() {
    coll('deleted').where('at', '<', firebase.firestore.Timestamp.fromMillis(Date.now() - TOMB_DAYS * 864e5)).get()
      .then(s => s.forEach(d => d.ref.delete().catch(() => {}))).catch(() => {});
  }
  // Çöp kutusu (yalnız yönetici): canlı liste; süresi dolanlar silinir
  function watchTrash() {
    unsubs.push(coll('trash').onSnapshot(snap => {
      const now = Date.now(), items = [];
      snap.forEach(d => { const x = d.data(); if (x.expiresAt < now) d.ref.delete().catch(() => {}); else items.push({ id: d.id, ...x }); });
      window.__lxTrash = items.sort((a, b) => b.expiresAt - a.expiresAt);
      if (window.renderTrash) window.renderTrash();
    }, () => {}));
  }
  window.lxTrashDelete = id => db && coll('trash').doc(id).delete();

  function ui(signedIn) {
    $('lojix-cloud-fields').style.display = signedIn ? 'none' : 'grid';
    $('lojix-cloud-actions').style.display = signedIn ? 'flex' : 'none';
    const who = $('lojix-cloud-user'); if (who) who.textContent = signedIn ? (user.email || '') : '';
  }
  function setRole(r, info) {
    window.LX_ROLE = r; window.LX_READONLY = r === 'viewer' || r === 'none'; window.LX_USER = info || null;
    window.LX_OWNER = !!user && user.uid === window.LOJIX_OWNER; window.LX_MANAGER = window.LX_OWNER || (!!user && (window.LOJIX_MANAGERS || []).includes(user.uid) && !!info && info.role === 'admin'); window.LX_PARTNER = r === 'partner' ? info : null;
    window.__lxUid = user ? user.uid : ''; window.__lxName = info && info.name || (user && user.email) || '';
    const c = document.body.classList;
    c.toggle('ro', window.LX_READONLY); c.toggle('limited', r === 'partner' || r === 'driver'); c.toggle('partner', r === 'partner'); c.toggle('driver', r === 'driver'); c.toggle('owner', window.LX_OWNER); c.toggle('manager', window.LX_MANAGER);
    if (window.onRoleChange) window.onRoleChange(r);
  }
  // Rol: sahip (LOJIX_OWNER) | users/{e-posta} belgesindeki rol: admin → yönetici, viewer, partner, driver | belge yoksa erişim yok
  const ROLE = { admin: 'writer', viewer: 'viewer', partner: 'partner', driver: 'driver' };
  async function authChanged(u) {
    user = u || null;
    ui(!!user);
    if (!user) { detach(); setRole('writer'); say('Giriş yapılmadı. Kayıtlar yalnızca bu cihazda tutuluyor.'); return; }
    if (user.uid === window.LOJIX_OWNER) { setRole('writer', { name: 'Yasin ÖZTÜRK', role: 'admin' }); return attach(); }
    let p = null;
    try { const d = await db.collection('fleets').doc(FLEET).collection('users').doc((user.email || '').toLowerCase()).get(); p = d.exists ? d.data() : null; } catch (e) {}
    if (!p || !ROLE[p.role]) { detach(); setRole('none'); return say('Bu hesabın Lojix\'e erişim izni yok. Yöneticiden (Yasin) sizi Kullanıcılar listesine eklemesini isteyin.', 'error'); }
    if (p.uid !== user.uid && !user.emailVerified) {
      detach(); setRole('none', p);
      if (!authChanged.sent) { authChanged.sent = 1; user.sendEmailVerification().catch(() => {}); }
      return say('E-posta adresiniz henüz doğrulanmadı. Doğrulama bağlantısı e-postanıza gönderildi; bağlantıya tıklayıp çıkış yapın ve yeniden giriş yapın.', 'error');
    }
    setRole(ROLE[p.role], p); attach();
  }
  function init() {
    const cfg = window.LOJIX_FIREBASE_CONFIG;
    if (!window.firebase || !firebase.apps) { say('Firebase yüklenemedi (internet yok olabilir). Kayıtlar bu cihazda korunuyor.', 'error'); return; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth(); db = firebase.firestore();
      if (window.LX_EMULATOR) { auth.useEmulator('http://localhost:9099'); db.useEmulator('localhost', 8080); } // yalnız testte
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      auth.onAuthStateChanged(authChanged);
      const orig = window.saveState;
      window.saveState = function () { const r = orig.apply(this, arguments); setTimeout(pushLocal, 0); return r; };
    } catch (e) { say('Firebase başlatılamadı: ' + (e.message || e), 'error'); }
  }

  $('lojix-cloud-login').addEventListener('click', async () => {
    const email = $('lojix-cloud-email').value.trim(), pw = $('lojix-cloud-password').value;
    if (!auth) return say('Firebase hazır değil. İnternet bağlantısını kontrol edin.', 'error');
    if (!email || !pw) return say('E-posta ve parola girin.', 'error');
    $('lojix-cloud-login').disabled = true;
    try { await auth.signInWithEmailAndPassword(email, pw); $('lojix-cloud-password').value = ''; }
    catch (e) { say('Giriş başarısız: ' + (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'e-posta veya parola hatalı.' : e.message), 'error'); }
    finally { $('lojix-cloud-login').disabled = false; }
  });
  $('lojix-cloud-reset').addEventListener('click', async () => {
    const email = $('lojix-cloud-email').value.trim();
    if (!email) return say('Önce e-posta adresinizi yazın.', 'error');
    try { await auth.sendPasswordResetEmail(email); say('Parola sıfırlama bağlantısı e-postanıza gönderildi.', 'ok'); }
    catch (e) { say('Gönderilemedi: ' + e.message, 'error'); }
  });
  $('lojix-cloud-refresh').addEventListener('click', () => { if (user) attach(true); });   // her zaman tam eşitleme
  $('lojix-cloud-logout').addEventListener('click', () => auth.signOut());
  window.addEventListener('online', () => { if (user) { say('İnternet geri geldi, eşitleniyor…'); pushLocal(); } });
  window.addEventListener('offline', () => say('Çevrimdışı: kayıtlar bu cihazda tutulur, internet gelince buluta gider.'));
  init();
})();
