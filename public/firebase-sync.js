/* Karacaahmet Tarım bulut eşitlemesi.
   Her kayıt ayrı belgedir: users/{uid}/{tür}/{kayıtId} = { ownerUid, data, updatedAt }.
   Cihazdaki veri (yerel), buluttaki veri (sunucu) ve son eşitlenen hâl (taban) üçlü karşılaştırılır;
   böylece çevrimdışı eklenen kayıt yüklenir, öbür telefonda silinen kayıt burada da silinir. */
(function () {
  const $ = id => document.getElementById(id);
  const KINDS = ['sales', 'purchases', 'expenses', 'cards', 'cardPays', 'cashMoves'];
  const COLLS = KINDS.concat('meta');            // meta/settings = { biz, phones }
  const BULK_DELETE_CONFIRM = 10;                // bundan çok silme tek seferde onaysız gitmez
  const status = $('fb-status'), actions = $('fb-cloud-actions'), authFields = $('fb-auth-fields');
  let auth = null, db = null, user = null, unsubs = [], ready = false, busy = false, again = false;
  let base = {};    // anahtar 'tür/id' -> son eşitlenen kaydın kanonik JSON'u (cihazda saklanır)
  let remote = {};  // anahtar -> sunucudaki kanonik JSON

  function say(msg, tone) { status.textContent = msg; status.style.color = tone === 'ok' ? '#047857' : tone === 'error' ? '#b91c1c' : '#475569'; }
  function setBusyUi(v) { ['fb-signin', 'fb-signup', 'fb-google', 'fb-refresh', 'fb-signout'].forEach(id => { const el = $(id); if (el) el.disabled = v; }); }

  // Anahtar sırasından bağımsız JSON: Firestore haritaları başka sırada döndürebilir.
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function localMap() {
    if (!window.__ktGetData) throw new Error('Uygulama veri köprüsü bulunamadı.');
    const d = window.__ktGetData(), m = {};
    KINDS.forEach(k => d[k].forEach(r => { m[k + '/' + r.id] = canon(r); }));
    m['meta/settings'] = canon({ biz: d.biz || '', phones: d.phones || {} });
    return m;
  }
  // Anahtar->JSON haritasından uygulamanın beklediği veri nesnesi.
  function toAppData(m) {
    const d = { sales: [], purchases: [], expenses: [], cards: [], cardPays: [], cashMoves: [], biz: '', phones: {} };
    Object.keys(m).forEach(key => {
      const [k] = key.split('/'), v = JSON.parse(m[key]);
      if (k === 'meta') { d.biz = typeof v.biz === 'string' ? v.biz : ''; d.phones = v.phones && typeof v.phones === 'object' ? v.phones : {}; }
      else if (d[k]) d[k].push(v);
    });
    KINDS.forEach(k => d[k].sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    return d;
  }
  function loadBase(uid) { try { const s = JSON.parse(localStorage.getItem('tp_synced') || '{}'); return s.uid === uid && s.map ? s.map : {}; } catch (e) { return {}; } }
  function saveBase() { try { localStorage.setItem('tp_synced', JSON.stringify({ uid: user.uid, map: base })); } catch (e) {} }
  function ref(key) { const [k, id] = key.split('/'); return db.collection('users').doc(user.uid).collection(k).doc(id); }
  function count(m) { const c = {}; Object.keys(m).forEach(k => { const t = k.split('/')[0]; c[t] = (c[t] || 0) + 1; }); return `Satış ${c.sales || 0}, alış ${c.purchases || 0}, gider ${c.expenses || 0}`; }

  // Yazma listesini en fazla 450'lik toplu işlemlerle gönderir. ops: [{key, json|null}]
  async function commit(ops) {
    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      ops.slice(i, i + 450).forEach(o => {
        if (o.json === null) batch.delete(ref(o.key));
        else batch.set(ref(o.key), { ownerUid: user.uid, data: JSON.parse(o.json), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      ops.slice(i, i + 450).forEach(o => { if (o.json === null) delete base[o.key]; else base[o.key] = o.json; });
      saveBase();
    }
  }
  function confirmDeletes(ops) {
    const n = ops.filter(o => o.json === null).length;
    return n <= BULK_DELETE_CONFIRM || window.confirm(`Buluttan ${n} kayıt silinecek. Bu, arşivleme veya yedekten geri yükleme yaptıysanız normaldir. Devam edilsin mi? (Hayır derseniz kayıtlar bulutta kalır.)`);
  }

  // İlk açılış: yerel, sunucu ve taban üçlü birleştirilir.
  async function initialMerge() {
    const local = localMap(), keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);
    const merged = {}, ops = [];
    keys.forEach(k => {
      const L = local[k], S = remote[k], B = base[k];
      if (L === S) { if (L !== undefined) merged[k] = L; return; }
      if (L === undefined) {                       // cihazda yok
        if (B === undefined || S !== B) merged[k] = S;   // sunucuda yeni / değişmiş: al
        else ops.push({ key: k, json: null });           // bu cihazda silinmiş: buluttan sil
        return;
      }
      if (S === undefined) {                       // bulutta yok
        if (B !== undefined && L === B) return;          // öbür cihazda silinmiş: burada da sil
        merged[k] = L; ops.push({ key: k, json: L });    // yeni ya da çevrimdışı düzenlenmiş: yükle
        return;
      }
      if (L === B) merged[k] = S;                  // yalnızca bulut değişmiş
      else { merged[k] = L; ops.push({ key: k, json: L }); } // cihazda değişmiş: cihazdaki kazanır
    });
    // Taban = buluttaki hâl: gönderilemeyen yükleme/silme bir sonraki kayıtta kendiliğinden yeniden denenir.
    base = Object.assign({}, remote); saveBase();
    if (ops.length && !confirmDeletes(ops)) {   // silme reddedildi: kayıtlar cihaza geri gelir
      ops.filter(o => o.json === null).forEach(o => { merged[o.key] = remote[o.key]; });
      ops.splice(0, ops.length, ...ops.filter(o => o.json !== null));
    }
    window.__ktApplyData(toAppData(merged));
    ready = true;
    if (ops.length) { say(`${ops.length} değişiklik buluta gönderiliyor…`); await commit(ops); }
    say('Eşitlendi. ' + count(merged), 'ok');
  }

  // Yerel değişiklik sonrası: farkları gönder.
  async function pushLocal() {
    if (!user || !ready) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const local = localMap(), ops = [];
      Object.keys(local).forEach(k => { if (local[k] !== base[k]) ops.push({ key: k, json: local[k] }); });
      Object.keys(base).forEach(k => { if (local[k] === undefined) ops.push({ key: k, json: null }); });
      if (!ops.length) return;
      if (!confirmDeletes(ops)) {               // silme reddedildi: kayıtlar cihaza geri gelir
        ops.filter(o => o.json === null).forEach(o => { local[o.key] = base[o.key]; });
        window.__ktApplyData(toAppData(local));
        const keep = ops.filter(o => o.json !== null); ops.length = 0; ops.push(...keep);
        if (!ops.length) return;
      }
      say(navigator.onLine ? 'Buluta kaydediliyor…' : 'Çevrimdışı: kayıt cihazda, internet gelince buluta gidecek.');
      await commit(ops);
      say('Cihaza ve buluta kaydedildi.', 'ok');
    } catch (e) {
      say('Kayıt cihazda duruyor; bulut eşitlemesi tamamlanmadı: ' + (e.message || e), 'error');
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(pushLocal, 0); }
    }
  }

  // Öbür telefondan gelen değişiklikleri uygula.
  function onRemote(coll, snap) {
    let changed = false;
    snap.docChanges().forEach(ch => {
      const key = coll + '/' + ch.doc.id;
      if (ch.type === 'removed') { delete remote[key]; return; }
      const d = ch.doc.data();
      if (!d || d.ownerUid !== user.uid || !d.data || typeof d.data !== 'object') return;
      remote[key] = canon(d.data);
    });
    if (!ready || snap.metadata.hasPendingWrites) return;
    const local = localMap(), next = Object.assign({}, local);
    const keys = new Set([...Object.keys(remote).filter(k => k.startsWith(coll + '/')), ...Object.keys(base).filter(k => k.startsWith(coll + '/'))]);
    keys.forEach(k => {
      const S = remote[k], B = base[k], L = local[k];
      if (S === B) return;                                   // bu anahtarda bulutta değişiklik yok
      if (S === L) { if (S === undefined) delete base[k]; else base[k] = S; return; } // kendi yazdığımız
      if (L !== B) return;                                   // cihazda da değişmiş: cihazdaki gönderilecek
      if (S === undefined) { delete next[k]; delete base[k]; } else { next[k] = S; base[k] = S; }
      changed = true;
    });
    saveBase();
    if (changed) { window.__ktApplyData(toAppData(next)); say('Diğer telefondan yeni kayıtlar alındı.', 'ok'); }
  }

  function detach() { unsubs.forEach(u => u()); unsubs = []; ready = false; remote = {}; }
  function attach() {
    detach();
    base = loadBase(user.uid);
    let pending = COLLS.length;
    say('Bulut kayıtları okunuyor…');
    COLLS.forEach(coll => {
      let first = true;
      unsubs.push(db.collection('users').doc(user.uid).collection(coll).onSnapshot(snap => {
        onRemote(coll, snap);
        if (first) { first = false; if (--pending === 0) initialMerge().catch(e => say('Bulut birleştirilemedi; cihazdaki kayıtlar korunuyor: ' + (e.message || e), 'error')); }
      }, err => say('Canlı bulut bağlantısı kesildi; cihazdaki kayıtlar korunuyor: ' + err.message, 'error')));
    });
  }

  function authChanged(u) {
    user = u || null;
    if (!user) { detach(); authFields.style.display = 'grid'; actions.style.display = 'none'; say('Giriş yapılmadı. Uygulama bu cihazda yerel çalışıyor.'); return; }
    authFields.style.display = 'none'; actions.style.display = 'flex';
    $('fb-upload').style.display = 'none'; $('fb-refresh').style.display = 'inline-block';
    attach();
  }
  function init() {
    const cfg = window.KARACAAHMET_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || !cfg.projectId) { say('Firebase yapılandırması eksik. Şu an yalnızca yerel kayıt çalışır.'); return; }
    if (!window.firebase || !firebase.apps) { say('Firebase SDK yüklenemedi. İnternet bağlantısını kontrol edin. Yerel kayıtlar korunuyor.', 'error'); return; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth(); db = firebase.firestore();
      if (window.KT_EMULATOR) { auth.useEmulator('http://localhost:9099'); db.useEmulator('localhost', 8080); } // yalnız testte
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => say('Oturum kalıcılığı ayarlanamadı: ' + e.message, 'error'));
      auth.getRedirectResult().catch(e => say('Google yönlendirmesi tamamlanamadı: ' + (e.message || e), 'error'));
      auth.onAuthStateChanged(authChanged);
      // Kaydetme ve işletme bilgisi değişince buluta da gönder.
      ['saveAll', 'saveBiz', 'savePhone'].forEach(name => {
        const orig = window[name];
        if (typeof orig === 'function') window[name] = function () { const r = orig.apply(this, arguments); setTimeout(pushLocal, 0); return r; };
      });
      say('Firebase hazır. Giriş yapabilir veya yerel kullanıma devam edebilirsiniz.');
    } catch (e) { say('Firebase başlatılamadı: ' + (e.message || e), 'error'); }
  }

  async function guarded(fn) { setBusyUi(true); try { await fn(); } finally { setBusyUi(false); } }
  $('fb-signin').addEventListener('click', () => guarded(() => auth.signInWithEmailAndPassword($('fb-email').value.trim(), $('fb-password').value).catch(e => say('E-posta ile giriş başarısız: ' + e.message, 'error'))));
  $('fb-signup').addEventListener('click', () => guarded(() => auth.createUserWithEmailAndPassword($('fb-email').value.trim(), $('fb-password').value).catch(e => say('Hesap oluşturulamadı: ' + e.message, 'error'))));
  $('fb-google').addEventListener('click', () => guarded(() => auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()).catch(e => say('Google girişi başarısız: ' + e.message, 'error'))));
  $('fb-refresh').addEventListener('click', () => { if (user) attach(); });
  $('fb-signout').addEventListener('click', () => auth.signOut().catch(e => say('Çıkış yapılamadı: ' + e.message, 'error')));
  function setCloudPanelOpen(open) {
    const panel = $('firebase-panel'), toggle = $('fb-settings-toggle');
    panel.style.display = open ? 'block' : 'none';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.style.background = open ? '#334155' : '#0f172a';
    if (open) panel.scrollTop = 0;
  }
  $('fb-settings-toggle').addEventListener('click', () => setCloudPanelOpen($('firebase-panel').style.display === 'none'));
  $('fb-minimize').addEventListener('click', () => setCloudPanelOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setCloudPanelOpen(false); });
  window.addEventListener('online', () => { if (user) { say('İnternet geri geldi, eşitleniyor…'); pushLocal(); } });
  window.addEventListener('offline', () => say('Çevrimdışı: kayıtlar bu cihazda tutulur, internet gelince buluta gider.'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
