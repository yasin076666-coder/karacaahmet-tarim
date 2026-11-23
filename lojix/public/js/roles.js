// ================= ROLLER, ÇÖP KUTUSU, KULLANICILAR =================
// Roller (sync.js belirler): writer = yönetici, viewer = yalnızca görür, partner = iş ortağı, driver = şoför.
// Sınırlı roller (iş ortağı, şoför) yalnızca kendi eklediği kayıtları görür, düzenler ve siler; sildiği/düzenlediği
// kaydın eski hâli yöneticinin çöp kutusunda 15 gün durur. Kullanıcıları yalnızca sahip (Yasin) yönetir.
// Bulut kuralları aynı sınırları ayrıca uygular.
(function () {
  const TABS_OF = { partner: ['home', 'trips', 'fuel', 'expenses', 'settings'], driver: ['home', 'fuel', 'expenses', 'settings'] };
  const MODALS_OF = { partner: ['tripModal', 'fuelModal', 'expenseModal'], driver: ['fuelModal', 'expenseModal'] };
  const STAMP = ['trips', 'fuels', 'expenses'];
  const R = () => window.LX_ROLE, limited = () => !!TABS_OF[R()];
  const ROLE_NAME = { admin: 'Yönetici', viewer: 'Görüntüleyici', partner: 'İş ortağı', driver: 'Şoför' };
  const ROLE_PILL = { admin: 'bg-blue-100 text-blue-700', viewer: 'bg-slate-100 text-slate-700', partner: 'bg-violet-100 text-violet-700', driver: 'bg-amber-100 text-amber-700' };
  const wrap = (name, fn) => { const orig = window[name]; if (typeof orig === 'function') window[name] = function () { return fn.call(this, orig, arguments); }; };

  // ---- Yeni kayda "ekleyen" bilgisi (yalnız yeni kayıtlar; eski kayıtlar olduğu gibi kalır) ----
  const known = new Set();
  const remember = () => STAMP.forEach(k => state[k].forEach(r => known.add(k + '/' + r.id)));
  remember();
  wrap('__lxApplyData', (orig, args) => { const r = orig.apply(null, args); remember(); return r; });
  wrap('saveState', (orig, args) => {
    const uid = window.__lxUid, role = { writer: 'admin', partner: 'partner', driver: 'driver' }[R()];
    if (uid && role) STAMP.forEach(k => state[k].forEach(r => { if (!known.has(k + '/' + r.id) && !r.createdBy) Object.assign(r, { createdBy: uid, createdByName: window.__lxName || '', createdByRole: role }); }));
    remember();
    return orig.apply(null, args);
  });

  // ---- Sınırlı roller: araç km'sine dokunmaz, şirket/araç kilidi, yalnız izinli sayfa ve formlar ----
  wrap('bumpOdo', (orig, args) => limited() ? undefined : orig.apply(null, args));
  function lockForm(id) {
    const u = window.LX_USER || {};
    const tc = $('tripCompany');
    if (tc) { const on = R() === 'partner' && u.company; if (on) { tc.value = u.company; setTripCompany(); } tc.disabled = !!on; }
    [['fuelVehicle', 'fuelDriver'], ['expVehicle', 'expDriver']].forEach(([v, d]) => {   // şoföre atanmış araç kilitli
      if (!$(v)) return;
      const on = R() === 'driver' && u.vehicleId && state.vehicles.some(x => x.id === u.vehicleId);
      if (on) { $(v).value = u.vehicleId; syncDriver(v, d); }
      $(v).disabled = !!on; $(d).disabled = !!on;
    });
  }
  wrap('openModal', (orig, args) => {
    if (limited() && /^(trip|fuel|expense|pay|vehicle|client|company)Modal$/.test(args[0]) && !MODALS_OF[R()].includes(args[0]))
      return toast(R() === 'driver' ? 'Şoför hesabı yalnızca yakıt ve gider girebilir.' : 'Bu hesap bu kaydı ekleyemez.', 'error');
    const r = orig.apply(null, args); lockForm(args[0]); if (args[0] === 'tripModal') previewTrip(); return r;
  });
  ['saveTrip', 'saveFuel', 'saveExpense'].forEach(n => wrap(n, (orig, args) => { lockForm(); return orig.apply(null, args); }));
  // Asistan: sınırlı kullanıcıya yalnızca kendi navlun, sefer, gider ve yakıt bilgisi; kâr, cari ve filo bilgisi yok
  wrap('asstReport', (orig, args) => limited() && !['freight', 'trips', 'expense', 'fuel'].includes(args[0].metric) ? 'Bu bilgi yalnızca yönetici ekranında. Kendi kayıtlarınız için "bu ay yakıt ne kadar" ya da "bu ay gider ne kadar" diye sorabilirsiniz.' : orig.apply(null, args));
  wrap('switchTab', (orig, args) => orig.apply(null, limited() && !TABS_OF[R()].includes(args[0]) ? [TABS_OF[R()][0]] : args[0] === 'users' && !window.LX_MANAGER ? ['dashboard'] : args));
  window.onRoleChange = r => {
    const cur = ((document.querySelector('.tab-content.active') || {}).id || '').replace('tab-', '');
    if (TABS_OF[r] && !TABS_OF[r].includes(cur)) switchTab(TABS_OF[r][0]);
    else if ((r !== 'writer' && cur === 'trash') || (cur === 'users' && !window.LX_MANAGER)) switchTab('dashboard');
    renderAll(); renderUsers();
  };

  // ---- Çöp kutusu ----
  const KIND = { trips: ['trips', 'Sefer', 'route'], fuels: ['fuels', 'Yakıt', 'fuel'], expenses: ['expenses', 'Gider', 'receipt'], payments: ['payments', 'Tahsilat', 'wallet'], vehicles: ['vehicles', 'Araç', 'truck'], clients: ['clients', 'Müşteri', 'users'], companies: ['intermediaryCompanies', 'Aracı şirket', 'building'] };
  const FIELD = { price: 'navlun', km: 'km', route: 'güzergâh', client: 'müşteri', cargo: 'yük', date: 'tarih', paid: 'tahsilat', due: 'vade', amount: 'tutar', category: 'kategori', note: 'açıklama', liters: 'litre', unitPrice: 'litre fiyatı', totalCost: 'toplam', odometerKm: 'gösterge km', station: 'istasyon', vehicleId: 'araç', invoiceNo: 'fatura no', extra: 'masraf', deduct: 'kesinti' };
  const money = new Set(['price', 'amount', 'totalCost', 'extra', 'deduct']);
  const show = (k, v) => k === 'vehicleId' ? esc(vehObj(v).plate) : money.has(k) ? fmtTL(v) : k === 'date' || k === 'due' ? fmtD(v) : esc(String(v ?? '—'));
  function summary(kind, d) {
    if (kind === 'trips') return `${esc(d.route || 'Sefer')} · ${esc(d.client || '')} · ${fmtTL(d.price)}`;
    if (kind === 'fuels') return `${esc(vehObj(d.vehicleId).plate)} · ${esc({ CEKICI: 'Çekici mazotu', FRIGO: 'Frigo mazotu', ADBLUE: 'AdBlue' }[d.type] || 'Yakıt')} · ${fmtNum(d.liters, 0)} lt · ${fmtTL(d.totalCost)}`;
    if (kind === 'expenses') return `${esc(vehObj(d.vehicleId).plate)} · ${esc(d.category || 'Gider')} · ${esc(d.note || '')} · ${fmtTL(d.amount)}`;
    if (kind === 'payments') return `${esc(d.client || '')} · ${fmtTL(d.amount)}`;
    return esc(d.plate || d.name || String(d.id));
  }
  window.renderTrash = function () {
    const el = $('trash-list'); if (!el) return;
    const items = window.__lxTrash || [];
    $('trash-count').textContent = items.length ? `${items.length} kayıt` : '';
    if (!window.__lxUid) { el.innerHTML = emptyState('Çöp kutusu bulut girişiyle çalışır. Ayarlar\'dan giriş yapın.'); return; }
    el.innerHTML = items.length ? items.map(t => {
      const [, label, icon] = KIND[t.kind] || [t.kind, t.kind, 'trash'], d = t.data || {}, left = Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 864e5));
      const when = t.at && t.at.toDate ? t.at.toDate().toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const diff = t.action === 'edit' && t.after ? Object.keys(FIELD).filter(k => JSON.stringify(d[k] ?? '') !== JSON.stringify(t.after[k] ?? '')).map(k => `${FIELD[k]}: <s>${show(k, d[k])}</s> → <b>${show(k, t.after[k])}</b>`).join(' · ') : '';
      return `<article class="mcard"><div class="mc-top"><div class="flex items-center gap-2 min-w-0"><span class="pill ${t.action === 'delete' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}">${t.action === 'delete' ? 'Silindi' : 'Düzenlendi'}</span><span class="truncate">${esc(t.byName || '')}</span></div><span class="shrink-0">${when}</span></div>
       <div class="mc-main"><div class="min-w-0"><div class="mc-title flex items-center gap-2">${ic(icon, 'ic-sm')}${label}</div><div class="mc-sub">${summary(t.kind, d)}</div>${diff ? `<div class="mc-sub mt-1">${diff}</div>` : ''}</div></div>
       <div class="mc-foot"><span>${left} gün sonra kalıcı silinir</span></div>
       <div class="mc-act gap-2"><button class="btn btn-quiet" onclick="trashRestore('${esc(t.id)}')">${ic('refresh')}${t.action === 'delete' ? 'Geri al' : 'Eski hâline döndür'}</button><button class="btn btn-icon danger" title="Kalıcı sil" aria-label="Kalıcı sil" onclick="trashPurge('${esc(t.id)}')">${ic('trash')}</button></div></article>`;
    }).join('') : emptyState('Çöp kutusu boş. Silinen kayıtlar ve iş ortağı ya da şoförün düzenlediği kayıtların eski hâli 15 gün burada durur.');
  };
  window.trashRestore = function (id) {
    if (R() !== 'writer') return toast('Yalnızca yönetici geri alabilir.', 'error');
    const t = (window.__lxTrash || []).find(x => x.id === id); if (!t || !KIND[t.kind]) return;
    const arr = state[KIND[t.kind][0]], i = arr.findIndex(r => String(r.id) === String(t.recordId));
    if (t.action === 'delete' && i >= 0) return toast('Bu kayıt zaten yerinde.', 'error');
    if (i >= 0) arr[i] = t.data; else arr.push(t.data);
    saveState(); window.lxTrashDelete(id); toast(t.action === 'delete' ? 'Kayıt geri alındı.' : 'Kayıt eski hâline döndürüldü.');
  };
  window.trashPurge = function (id) { if (confirm('Bu kayıt çöp kutusundan kalıcı olarak silinsin mi?')) { window.lxTrashDelete(id); toast('Kalıcı olarak silindi.'); } };

  // ---- Kullanıcılar ve yetkiler: yalnız sahip (Yasin) görür, ekler, rol değiştirir, kaldırır ----
  const users = () => firebase.firestore().collection('fleets').doc('lojix').collection('users');
  const OWNER_EMAIL = 'yasin07.6666@gmail.com';
  window.userRoleChanged = function () {   // seçilen role göre şirket / araç alanını göster
    const r = val('userRole');
    $('userCompanyBox').hidden = r !== 'partner'; $('userVehicleBox').hidden = r !== 'driver';
  };
  window.renderUsers = async function () {
    const el = $('users-list'); if (!el) return;
    // Sekme yalnız sahipte ve kullanıcı yöneticisinde görünür (CSS: data-manager); başkasında hiç çizilmez
    if (!window.LX_MANAGER) { el.innerHTML = ''; $('userForm').hidden = true; return; }
    const me = ((firebase.auth().currentUser || {}).email || '').toLowerCase(), can = p => window.LX_OWNER || p.email !== me;
    $('userForm').hidden = false; $('users-note').textContent = '';
    fill('userCompany', state.intermediaryCompanies.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''));
    if (!$('userCompany').dataset.set) { const m = state.intermediaryCompanies.find(c => /moonlog/i.test(c.name)); if (m) $('userCompany').value = m.id; $('userCompany').dataset.set = 1; }
    fill('userVehicle', '<option value="">Araç atanmasın (her araca girebilir)</option>' + state.vehicles.map(v => `<option value="${esc(v.id)}">${esc(v.plate)} · ${esc(v.driver)}</option>`).join(''));
    userRoleChanged();
    try {
      const snap = await users().get(), rows = [];
      snap.forEach(d => { if (window.LX_OWNER || d.id !== OWNER_EMAIL) rows.push({ email: d.id, ...d.data() }); });   // Aziz sahibi görmez
      rows.sort((a, b) => (b.email === me) - (a.email === me) || Object.keys(ROLE_NAME).indexOf(a.role) - Object.keys(ROLE_NAME).indexOf(b.role) || String(a.name).localeCompare(String(b.name), 'tr'));
      const extra = p => p.role === 'partner' ? ' · ' + esc((state.intermediaryCompanies.find(c => c.id === p.company) || {}).name || p.company || '') : p.role === 'driver' && p.vehicleId ? ' · ' + esc(vehObj(p.vehicleId).plate) : '';
      const sel = p => `<select class="sel !min-h-[34px] !py-1 text-[13px]" aria-label="${esc(p.email)} rolü" onchange="changeUserRole('${esc(p.email)}',this.value)">${Object.entries(ROLE_NAME).map(([k, v]) => `<option value="${k}" ${k === p.role ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
      el.innerHTML = (window.LX_OWNER ? `<div class="flex items-center gap-3 py-2.5 border-b border-slate-200"><span class="sheet-ic bg-blue-100 text-blue-700">${ic('shield')}</span><div class="min-w-0 flex-1"><b class="font-semibold">Yasin ÖZTÜRK</b><div class="text-[13px] text-slate-500">yasin07.6666@gmail.com · Sahip: kullanıcıları yönetir</div></div></div>` : '')
        + rows.map(p => !can(p) ? `<div class="flex items-center gap-3 py-2.5 border-b border-slate-200"><span class="sheet-ic bg-blue-100 text-blue-700">${ic('shield')}</span><div class="min-w-0 flex-1"><b class="font-semibold">${esc(p.name || p.email)}</b> <span class="text-[12px] text-slate-500">(siz)</span><div class="text-[13px] text-slate-500 break-all">${esc(p.email)} · Yönetici: kullanıcı ekler ve yönetir</div></div></div>` : `<div class="flex items-center gap-3 py-2.5 border-b border-slate-200 last:border-0 flex-wrap"><span class="sheet-ic ${ROLE_PILL[p.role] || ''}">${ic(p.role === 'driver' ? 'truck' : 'user')}</span><div class="min-w-0 flex-1 basis-[calc(100%-60px)] sm:basis-auto"><b class="font-semibold">${esc(p.name || p.email)}</b><div class="text-[13px] text-slate-500 break-all">${esc(p.email)}${extra(p)}</div></div>
          <div class="flex items-center gap-1 ml-auto">${can(p) ? sel(p) + `<button class="btn btn-icon" title="Parola bağlantısını yeniden gönder" aria-label="${esc(p.email)} için bağlantıyı yeniden gönder" onclick="resendUserLink('${esc(p.email)}')">${ic('send')}</button><button class="btn btn-icon danger" title="Erişimi kaldır" aria-label="${esc(p.email)} erişimini kaldır" onclick="removeUser('${esc(p.email)}')">${ic('trash')}</button>` : `<span class="pill ${ROLE_PILL[p.role] || ''}">${ROLE_NAME[p.role] || esc(p.role)}</span>`}</div></div>`).join('');
    } catch (e) { el.innerHTML = `<p class="text-sm text-rose-600">Kullanıcılar okunamadı: ${esc(e.message)}</p>`; }
  };
  window.addUser = async function (e) {
    e.preventDefault();
    if (!window.LX_MANAGER) return toast('Kullanıcıyı yalnızca Yasin ve Aziz ekleyebilir.', 'error');
    const email = val('userEmail').trim().toLowerCase(), name = val('userName').trim(), role = val('userRole');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Geçerli bir e-posta yazın.', 'error');
    if (email === ((firebase.auth().currentUser || {}).email || '').toLowerCase()) return toast('Kendi hesabınızın rolünü değiştiremezsiniz.', 'error');
    if (!window.LX_OWNER && email === OWNER_EMAIL) return toast('Bu hesap değiştirilemez.', 'error');
    const doc = { name: name || email, role, addedBy: window.__lxUid, addedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (role === 'partner') doc.company = val('userCompany');
    if (role === 'driver') doc.vehicleId = val('userVehicle');
    const btn = e.submitter || $('userForm').querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await users().doc(email).set(doc);
      const uid = await ensureAccount(email);
      if (uid) await users().doc(email).update({ uid });   // hesap yeni açıldıysa uid bağlanır
      $('userForm').reset(); delete $('userCompany').dataset.set;
      toast(`${name || email} ${ROLE_NAME[role].toLocaleLowerCase('tr')} olarak eklendi. ${uid ? 'Giriş hesabı açıldı; ' : ''}parola belirleme bağlantısı ${email} adresine gönderildi.`);
      renderUsers();
    } catch (err) { toast('Eklenemedi: ' + err.message, 'error'); }
    finally { btn.disabled = false; }
  };
  window.changeUserRole = async function (email, role) {
    if (!window.LX_MANAGER) return;
    const patch = { role };
    if (role === 'partner') patch.company = val('userCompany') || (state.intermediaryCompanies.find(c => /moonlog/i.test(c.name)) || {}).id || '';
    try { await users().doc(email).update(patch); toast(`${email} artık ${ROLE_NAME[role].toLocaleLowerCase('tr')}.`); renderUsers(); }
    catch (err) { toast('Rol değiştirilemedi: ' + err.message, 'error'); renderUsers(); }
  };
  // Giriş hesabını ikinci bir Firebase örneğiyle açar: sahibin oturumu kapanmaz. Parola rastgeledir ve
  // hiç gösterilmez; kişi e-postadaki bağlantıyla kendi parolasını belirler (bağlantı e-postayı da doğrular).
  async function ensureAccount(email) {
    const app = firebase.apps.find(a => a.name === 'lx-admin') || firebase.initializeApp(window.LOJIX_FIREBASE_CONFIG, 'lx-admin');
    const a2 = app.auth();
    if (window.LX_EMULATOR && !a2.__emu) { a2.useEmulator('http://localhost:9099'); a2.__emu = 1; }
    await a2.setPersistence(firebase.auth.Auth.Persistence.NONE);
    const pw = Array.from(crypto.getRandomValues(new Uint8Array(24)), x => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#%'[x % 59]).join('');
    let uid = '';
    try { const c = await a2.createUserWithEmailAndPassword(email, pw); uid = c.user.uid; await a2.signOut(); }
    catch (err) { if (err.code !== 'auth/email-already-in-use') throw err; }   // hesap zaten varsa yalnız bağlantı gider
    await firebase.auth().sendPasswordResetEmail(email);
    return uid;
  }
  window.resendUserLink = async function (email) {
    try { await firebase.auth().sendPasswordResetEmail(email); toast('Parola belirleme bağlantısı yeniden gönderildi: ' + email); }
    catch (err) { toast('Gönderilemedi: ' + err.message, 'error'); }
  };
  window.removeUser = async function (email) {
    if (!window.LX_MANAGER) return;
    if (!confirm(email + ' erişimi kaldırılsın mı? Kişi artık hiçbir kaydı göremez; eklediği kayıtlar silinmez.')) return;
    try { await users().doc(email).delete(); toast('Erişim kaldırıldı: ' + email); renderUsers(); } catch (err) { toast('Kaldırılamadı: ' + err.message, 'error'); }
  };
  // ---- Panelim: iş ortağı ve şoförün ana sayfası (yalnızca kendi kayıtları; kâr/net hiç gösterilmez) ----
  const short = v => v >= 1e6 ? fmtNum(v / 1e6, 1) + ' mn' : v >= 1e3 ? fmtNum(v / 1e3, 0) + ' b' : fmtNum(v, 0);
  function monthBars(valueOf, label) {   // son 6 ay, tek seri
    const ks = []; let [y, m] = today().slice(0, 7).split('-').map(Number);
    for (let i = 0; i < 6; i++) { ks.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m === 0) { m = 12; y--; } }
    const vals = ks.map(valueOf), max = Math.max(...vals, 1), W = 600, H = 190, top = 26, ch = 120, gw = W / 6, bw = 34;
    if (!vals.some(Boolean)) return `<p class="text-sm text-slate-500 py-4">Son 6 ayda kayıt yok.</p>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 6 ay ${label}">${ks.map((k, i) => { const x = i * gw + gw / 2, h = vals[i] / max * ch, cur = i === 5;
      return `<g><title>${MONTHS[+k.slice(5) - 1]}: ${fmtTL(vals[i])}</title><rect class="${cur ? 'bar-in' : 'bar-out'}" x="${x - bw / 2}" y="${top + ch - h}" width="${bw}" height="${Math.max(h, 2)}" rx="6"/>
        <text x="${x}" y="${top + ch - h - 8}" text-anchor="middle">${vals[i] ? short(vals[i]) : ''}</text><text x="${x}" y="${H - 18}" text-anchor="middle">${MONTHS[+k.slice(5) - 1].slice(0, 3)}</text></g>`; }).join('')}
      <line x1="0" x2="${W}" y1="${top + ch}" y2="${top + ch}" stroke="var(--line)"/></svg>`;
  }
  window.renderHome = function () {
    const el = $('tab-home'); if (!el || !limited()) return;
    const u = window.LX_USER || {}, P = R() === 'partner', now = new Date(), h = now.getHours();
    const first = String(u.name || '').trim().split(' ')[0], mk = today().slice(0, 7);
    const pmD = new Date(now.getFullYear(), now.getMonth() - 1, 1), pk = `${pmD.getFullYear()}-${String(pmD.getMonth() + 1).padStart(2, '0')}`;
    const inM = k => x => (x.date || '').startsWith(k);
    const co = state.intermediaryCompanies.find(c => c.id === u.company), veh = u.vehicleId ? state.vehicles.find(v => v.id === u.vehicleId) : null;
    const tM = state.trips.filter(inM(mk)), tP = state.trips.filter(inM(pk)), fM = state.fuels.filter(inM(mk)), eM = state.expenses.filter(inM(mk));
    const navM = sum(tM, 'price'), komM = tM.reduce((a, t) => a + tComm(t), 0), pend = state.trips.filter(t => t.paid !== 'Tahsil Edildi'), late = pend.filter(t => t.due && dayDiff(t.due) < 0).length;
    const litM = sum(fM, 'liters'), fuelM = sum(fM, 'totalCost'), expM = sum(eM, 'amount');
    const tile = (l, v, sub, c = '') => `<div class="card p-4 md:p-5"><div class="kpi-label">${l}</div><div class="kpi-value ${c}">${v}</div><div class="kpi-sub">${sub}</div></div>`;
    const qb = (m, icn, cls, txt) => `<button class="quick" onclick="openModal('${m}')"><span class="q-ic ${cls}">${ic(icn, 'ic-lg')}</span>${txt}</button>`;
    const quick = (P ? qb('tripModal', 'route', 'bg-emerald-100 text-emerald-700', 'Sefer ekle') : '') + qb('fuelModal', 'fuel', 'bg-sky-100 text-sky-700', 'Yakıt') + qb('expenseModal', 'receipt', 'bg-rose-100 text-rose-700', 'Gider')
      + `<button class="quick voice" onclick="asstListen()" aria-label="Sesle kayıt"><span class="q-ic">${ic('mic', 'ic-lg')}</span>Söyle</button>`;
    const recent = [...state.trips.map(r => ['trips', r]), ...state.fuels.map(r => ['fuels', r]), ...state.expenses.map(r => ['expenses', r])]
      .sort((a, b) => (b[1].date || '').localeCompare(a[1].date || '') || b[1].id - a[1].id).slice(0, 6);
    const KI = { trips: ['route', 'bg-emerald-100 text-emerald-700'], fuels: ['fuel', 'bg-sky-100 text-sky-700'], expenses: ['receipt', 'bg-rose-100 text-rose-700'] };
    const FT = { CEKICI: 'Çekici mazotu', FRIGO: 'Frigo mazotu', ADBLUE: 'AdBlue' };
    const row = ([k, r]) => { const [icn, cls] = KI[k], v = vehObj(r.vehicleId).plate;
      const t = k === 'trips' ? esc(r.route || 'Sefer') : k === 'fuels' ? `${FT[r.type] || 'Yakıt'} · ${fmtNum(r.liters, 0)} lt` : esc(r.category || 'Gider');
      const sub = [esc(v), k === 'trips' ? esc(r.client || '') : k === 'expenses' ? esc(r.note || '') : esc(r.station || '')].filter(Boolean).join(' · ');
      const amt = k === 'trips' ? r.price : k === 'fuels' ? r.totalCost : r.amount;
      return `<button class="home-row" onclick="editRecord('${k}',${r.id})"><span class="sheet-ic ${cls}">${ic(icn)}</span><span class="min-w-0 flex-1 text-left"><b class="block truncate font-semibold">${t}</b><small class="block truncate text-slate-500">${sub}</small></span><span class="text-right shrink-0"><b class="block tabular-nums">${fmtTL(amt)}</b><small class="text-slate-500">${fmtD(r.date)}</small></span></button>`; };
    const any = state.trips.length + state.fuels.length + state.expenses.length;
    const sentence = P ? (tM.length ? `Bu ay <b>${tM.length} sefer</b> girdiniz, toplam <b>${fmtTL(navM)}</b> navlun.` : 'Bu ay henüz sefer girmediniz.') + (late ? ` <b>${late}</b> seferin vadesi geçti.` : '')
      : (fM.length || eM.length ? `Bu ay <b>${fmtNum(litM, 0)} lt</b> yakıt ve <b>${fmtTL(expM)}</b> gider girdiniz.` : 'Bu ay henüz kayıt girmediniz.');
    el.innerHTML = `
     <div class="card kpi-hero home-hero p-5 md:p-7">
      <div class="flex items-center gap-3"><img class="logo-tile w-12 h-12 shrink-0" src="img/icon-192.png" alt=""><div class="min-w-0"><div class="kpi-label">${now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</div><h2 class="home-hi">${h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar'}${first ? ', ' + esc(first) : ''}</h2></div></div>
      <div class="flex flex-wrap items-center gap-2 mt-4"><span class="pill hero-pill">${ic(P ? 'building' : 'truck', 'ic-sm')}${P ? esc(co ? co.name : 'İş ortağı') + ' · İş ortağı' : 'Şoför'}</span>${!P && veh ? plate(veh.plate) : ''}</div>
      <p class="kpi-sub mt-3 text-[15px]">${sentence}</p>
     </div>
     <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">${P
       ? tile('Bu ay sefer', tM.length, `Geçen ay ${tP.length}`) + tile('Bu ay navlun', fmtTL(navM), `Geçen ay ${fmtTL(sum(tP, 'price'))}`) + tile(`${esc(co ? co.name.split(' ')[0] : 'Şirket')} komisyonu`, fmtTL(komM), `Bu ay · %${fmtNum(co ? co.rate : 0, 1)}`, 'text-violet-700') + tile('Bekleyen tahsilat', fmtTL(sum(pend, 'price')), `${pend.length} sefer${late ? ` · ${late} gecikmiş` : ''}`, late ? 'text-rose-600' : 'text-amber-700')
       : tile('Bu ay yakıt', `${fmtNum(litM, 0)} lt`, fmtTL(fuelM), 'text-sky-700') + tile('Bu ay gider', fmtTL(expM), `${eM.length} kayıt`, 'text-rose-600') + tile('Yakıt kaydı', fM.length, 'bu ay') + tile('Araç', veh ? esc(veh.plate) : '—', veh ? esc(veh.model || veh.driver || '') : 'Her araca girebilirsiniz')}</div>
     <div class="quick-grid" style="grid-template-columns:repeat(${P ? 4 : 3},minmax(0,1fr))">${quick}</div>
     ${any ? `<div class="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-5">
      <div class="card p-5 xl:col-span-3"><h3 class="font-semibold text-[17px] mb-2">Son 6 ay · ${P ? 'navlun' : 'yakıt ve gider'}</h3><div class="trend">${monthBars(k => P ? sum(state.trips.filter(inM(k)), 'price') : sum(state.fuels.filter(inM(k)), 'totalCost') + sum(state.expenses.filter(inM(k)), 'amount'), P ? 'navlun' : 'yakıt ve gider')}</div></div>
      <div class="card p-3 md:p-4 xl:col-span-2"><div class="flex items-center justify-between px-2 pb-1"><h3 class="font-semibold text-[17px]">Son kayıtlarım</h3><button class="text-sm font-semibold text-blue-600" onclick="switchTab('${P ? 'trips' : 'fuel'}')">Tümü</button></div>${recent.map(row).join('')}</div>
     </div>` : `<div class="card p-5 md:p-6"><h3 class="font-semibold text-[17px] mb-3">Nasıl başlarım?</h3><ol class="home-steps">
      <li><b>${P ? 'Seferi ekleyin' : 'Yakıt fişini girin'}</b><span>${P ? 'Yukarıdaki "Sefer ekle" ile güzergâh, müşteri ve navlunu yazın. ' + esc(co ? co.name : 'Şirketiniz') + ' kendiliğinden seçilir.' : 'Litre, fiyat ve gösterge km yeterli. Aracınız kendiliğinden seçilir.'}</span></li>
      <li><b>Ya da söyleyin</b><span>"Söyle"ye basıp ${P ? '"Antalya\'dan İstanbul\'a 45 bin navlun"' : '"400 litre mazot 44,5\'ten"'} deyin; form dolar, siz kaydedersiniz.</span></li>
      <li><b>Kayıt yöneticiye gider</b><span>Girdiğiniz kayıt anında yöneticinin ekranına düşer. Yalnızca kendi kayıtlarınızı görür ve düzenlersiniz.</span></li></ol></div>`}`;
  };
  wrap('renderAll', (orig, args) => { const r = orig.apply(null, args); renderHome(); return r; });
})();
