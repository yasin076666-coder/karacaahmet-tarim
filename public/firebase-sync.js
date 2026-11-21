/* Hesap Defterim bulut eşitlemesi.
   Her kayıt ayrı belgedir: users/{uid}/{tür}/{kayıtId} = { ownerUid, data, updatedAt }.
   Cihazdaki veri (yerel), buluttaki veri (sunucu) ve son eşitlenen hâl (taban) üçlü karşılaştırılır;
   böylece çevrimdışı eklenen kayıt yüklenir, öbür telefonda silinen kayıt burada da silinir. */
(function () {
  const $ = id => document.getElementById(id);
  const KINDS = ['sales', 'purchases', 'expenses', 'cards', 'cardPays', 'cashMoves', 'wastes'];
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
    const d = { sales: [], purchases: [], expenses: [], cards: [], cardPays: [], cashMoves: [], wastes: [], biz: '', phones: {} };
    Object.keys(m).forEach(key => {
      const [k] = key.split('/'), v = JSON.parse(m[key]);
      if (k === 'meta') { d.biz = typeof v.biz === 'string' ? v.biz : ''; d.phones = v.phones && typeof v.phones === 'object' ? v.phones : {}; }
      else if (d[k]) d[k].push(v);
    });
    KINDS.forEach(k => d[k].sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    return d;
  }
  function loadBase(uid) { try { const s = JSON.parse(localStorage.getItem('tp_synced') || '{}'); return s.uid === uid && s.map ? s.map : {}; } catch (e) { return {}; } }
  let baseWarned = false;
  function saveBase() {
    try { localStorage.setItem('tp_synced', JSON.stringify({ uid: user.uid, map: base })); }
    catch (e) { if (!baseWarned) { baseWarned = true; alert('Telefon belleği dolu: eşitleme bilgisi kaydedilemedi. Lütfen "Yedek Al" ile yedek alın ve eski kayıtları arşivleyin.'); } }
  }
  function ref(key) { const [k, id] = key.split('/'); return db.collection('users').doc(user.uid).collection(k).doc(id); }
  function count(m) { const c = {}; Object.keys(m).forEach(k => { const t = k.split('/')[0]; c[t] = (c[t] || 0) + 1; }); return `Satış ${c.sales || 0}, alış ${c.purchases || 0}, gider ${c.expenses || 0}`; }

  // Üç yönlü alan birleştirme: değişen taraf kazanır; kimlikli diziler (tahsilatlar) öğe öğe birleşir.
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge3(L, S, B) {
    B = isObj(B) ? B : {};
    const out = {};
    new Set([...Object.keys(L), ...Object.keys(S)]).forEach(k => {
      const l = L[k], s = S[k], b = B[k];
      let v;
      if (canon(l) === canon(s)) v = l;
      else if (isObj(l) && isObj(s)) v = merge3(l, s, b);
      else if (Array.isArray(l) && Array.isArray(s) && [...l, ...s].every(x => isObj(x) && x.id)) v = mergeById(l, s, Array.isArray(b) ? b : []);
      else v = canon(l) !== canon(b) ? l : s;
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  function mergeById(l, s, b) {
    const M = a => new Map(a.map(x => [x.id, x])), Lm = M(l), Sm = M(s), Bm = M(b);
    return [...new Set([...Lm.keys(), ...Sm.keys()])]
      .filter(id => !(Bm.has(id) && (!Lm.has(id) || !Sm.has(id))))   // bir tarafta silinmiş
      .map(id => { const x = Lm.get(id), y = Sm.get(id); return !x ? y : !y ? x : canon(x) !== canon(Bm.get(id)) ? x : y; });
  }
  // meta: hiç eşitlenmemiş tarafta boş alanlar dolu olanı ezmez, telefonlar birleşir
  function mergeRec(key, L, S, B) {
    if (key === 'meta/settings' && !B) return { biz: S.biz || L.biz || '', phones: Object.assign({}, L.phones, S.phones) };
    const m = merge3(L, S, B), r2 = x => Math.round(x * 100) / 100;
    if (Array.isArray(m.payments) && Array.isArray(L.payments) && Array.isArray(S.payments)) {
      // İki telefon da "ödenen tutarı şuna getir" düzeltmesi eklediyse biri yeter (yoksa ödeme iki kez sayılır)
      const bIds = new Set((B && Array.isArray(B.payments) ? B.payments : []).map(p => p.id));
      const adj = a => a.filter(p => !bIds.has(p.id) && p.note === 'Düzeltme').map(p => p.id);
      const l = adj(L.payments), s = new Set(adj(S.payments));
      if (l.length && s.size) m.payments = m.payments.filter(p => !s.has(p.id));
    }
    if (Array.isArray(m.payments)) m.paid = r2(m.payments.reduce((a, p) => a + (+p.amount || 0), 0));
    // Kalemler iki tarafta farklı değiştiyse toplam, birleşen kalemlerden yeniden hesaplanır
    if (Array.isArray(m.items) && Array.isArray(L.items) && Array.isArray(S.items) && canon(L.items) !== canon(S.items))
      m.total = r2(m.items.reduce((a, i) => a + (+i.total || r2((+i.qty || 0) * (+i.price || 0))), 0));
    return m;
  }

  // Yazmadan önce buluttaki güncel hâli okur (işlem): arada öbür telefon değiştirdiyse birleştirip yazar.
  // ops: [{key, json|null}]. İnternet yoksa hata verir; kayıt cihazda kalır, bağlantı gelince yeniden denenir.
  async function commit(ops) {
    const fixLocal = {}, sent = {};
    ops.forEach(o => { sent[o.key] = o.json; });
    for (let i = 0; i < ops.length; i += 200) {
      const chunk = ops.slice(i, i + 200);
      const out = await db.runTransaction(async tx => {
        const snaps = await Promise.all(chunk.map(o => tx.get(ref(o.key))));
        return chunk.map((o, j) => {
          const d = snaps[j].exists ? snaps[j].data() : null, S = d && isObj(d.data) ? canon(d.data) : undefined, B = base[o.key];
          let json = o.json;
          if (S !== B && S !== json) {
            if (json === null) json = S === undefined ? null : S;           // biz sildik, öbürü düzenledi: onunki kalır
            else if (S !== undefined) json = canon(mergeRec(o.key, JSON.parse(json), JSON.parse(S), B === undefined ? null : JSON.parse(B)));
          }
          if (json === null) { if (snaps[j].exists) tx.delete(ref(o.key)); }
          else if (json !== S) tx.set(ref(o.key), { ownerUid: user.uid, data: JSON.parse(json), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          return { key: o.key, json, mine: o.json };
        });
      });
      out.forEach(r => { if (r.json === null) delete base[r.key]; else base[r.key] = r.json; if (r.json !== r.mine) fixLocal[r.key] = r.json; });
      saveBase();
    }
    if (Object.keys(fixLocal).length) {               // birleşen hâli cihaza da yaz
      const m = localMap(); let again2 = false;
      Object.keys(fixLocal).forEach(k => {
        const cur = m[k], mine = sent[k], v = fixLocal[k];
        if (cur === mine) { if (v === null) delete m[k]; else m[k] = v; }
        else if (cur !== undefined && v !== null) {   // yazma sürerken bu cihazda yine düzenlenmiş: üçünü birleştir, sonra gönder
          m[k] = canon(mergeRec(k, JSON.parse(cur), JSON.parse(v), mine == null ? null : JSON.parse(mine))); again2 = true;
        } else again2 = true;                         // bu arada silinmiş: silme sonra gönderilir
      });
      window.__ktApplyData(toAppData(m));
      if (again2) setTimeout(pushLocal, 0);
      say('Öbür telefonda aynı anda yapılan değişiklikle birleştirildi.', 'ok');
      return true;
    }
    return false;
  }
  function confirmDeletes(ops) {
    const n = ops.filter(o => o.json === null).length;
    return n <= BULK_DELETE_CONFIRM || window.confirm(`Buluttan ${n} kayıt silinecek. Bu, arşivleme veya yedekten geri yükleme yaptıysanız normaldir. Devam edilsin mi? (Hayır derseniz kayıtlar bulutta kalır.)`);
  }

  // İlk açılış: yerel, sunucu ve taban üçlü birleştirilir.
  async function initialMerge() {
    const local = localMap(), keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);
    const merged = {}, ops = [], orphans = [], fresh = !Object.keys(base).length; // fresh: bu cihaz hiç eşitlenmemiş
    keys.forEach(k => {
      const L = local[k], S = remote[k], B = base[k];
      if (L === S) { if (L !== undefined) merged[k] = L; return; }
      if (k === 'meta/settings' && L !== undefined && S !== undefined) {
        const m = canon(mergeRec(k, JSON.parse(L), JSON.parse(S), B === undefined ? null : JSON.parse(B)));
        merged[k] = m; if (m !== S) ops.push({ key: k, json: m }); return;
      }
      if (L === undefined) {                       // cihazda yok
        if (B === undefined || S !== B) merged[k] = S;   // sunucuda yeni / değişmiş: al
        else ops.push({ key: k, json: null });           // bu cihazda silinmiş: buluttan sil
        return;
      }
      if (S === undefined) {                       // bulutta yok
        if (B !== undefined && L === B) return;          // öbür cihazda silinmiş: burada da sil
        merged[k] = L;
        if (fresh) orphans.push(k); else ops.push({ key: k, json: L }); // yeni ya da çevrimdışı düzenlenmiş: yükle
        return;
      }
      if (fresh || L === B) merged[k] = S;         // yalnızca bulut değişmiş ya da cihaz hiç eşitlenmemiş: bulut esas
      else if (S === B) { merged[k] = L; ops.push({ key: k, json: L }); } // yalnızca cihazda değişmiş
      else { const m = canon(mergeRec(k, JSON.parse(L), JSON.parse(S), JSON.parse(B))); merged[k] = m; ops.push({ key: k, json: m }); } // iki tarafta da değişmiş
    });
    if (orphans.length) {                          // hiç eşitlenmemiş cihazda bulutta olmayan kayıtlar
      const cloudEmpty = !Object.keys(remote).some(k => !k.startsWith('meta/'));
      if (cloudEmpty || window.confirm(`Bu telefonda bulutta olmayan ${orphans.length} kayıt var. Öbür telefonda silinmiş ya da bu telefonda internetsiz girilmiş olabilirler. Buluta eklensin mi? (Hayır derseniz önce yedek dosyası indirilir, sonra bu telefondan kaldırılır.)`))
        orphans.forEach(k => ops.push({ key: k, json: local[k] }));  // bulut boşsa ilk eşitlemedir: sormadan yükle
      else { try { window.exportData(); } catch (e) {} orphans.forEach(k => { delete merged[k]; }); }
    }
    // Taban = buluttaki hâl: gönderilemeyen yükleme/silme bir sonraki kayıtta kendiliğinden yeniden denenir.
    base = Object.assign({}, remote); saveBase();
    if (ops.length && !confirmDeletes(ops)) {   // silme reddedildi: kayıtlar cihaza geri gelir
      ops.filter(o => o.json === null).forEach(o => { merged[o.key] = remote[o.key]; });
      ops.splice(0, ops.length, ...ops.filter(o => o.json !== null));
    }
    window.__ktApplyData(toAppData(merged));
    ready = true;
    if (ops.length) {
      say(`${ops.length} değişiklik buluta gönderiliyor…`); busy = true;
      try { await commit(ops); } finally { busy = false; if (again) { again = false; setTimeout(pushLocal, 0); } }
    }
    window.__ktCloudOk = true; if (window.updateBackupBanner) updateBackupBanner();
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
    if (!snap.metadata.fromCache) setTimeout(pushLocal, 0); // bağlantı geri geldiyse bekleyen değişiklikleri gönder
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

  function detach() { unsubs.forEach(u => u()); unsubs = []; ready = false; remote = {}; window.__ktCloudOk = false; if (window.updateBackupBanner) updateBackupBanner(); }
  function attach() {
    detach();
    base = loadBase(user.uid);
    let pending = COLLS.length;
    say('Bulut kayıtları okunuyor…');
    COLLS.forEach(coll => {
      let first = true;
      // Önbellekten gelen (internetsiz) cevap bulutun gerçek içeriği değildir: sunucu cevabı gelene kadar birleştirme yapılmaz.
      unsubs.push(db.collection('users').doc(user.uid).collection(coll).onSnapshot({ includeMetadataChanges: true }, snap => {
        onRemote(coll, snap);
        if (first && snap.metadata.fromCache && !ready) say('Bulut bağlantısı bekleniyor; cihazdaki kayıtlarla çalışılıyor.');
        if (first && !snap.metadata.fromCache) { first = false; if (--pending === 0) initialMerge().catch(e => say('Bulut birleştirilemedi; cihazdaki kayıtlar korunuyor: ' + (e.message || e), 'error')); }
      }, err => {
        say('Canlı bulut bağlantısı kesildi; cihazdaki kayıtlar korunuyor: ' + err.message, 'error');
        setTimeout(() => { if (user && !ready) attach(); }, 15000);
      }));
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
