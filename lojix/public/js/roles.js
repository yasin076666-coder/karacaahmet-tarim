// ================= ROLLER, ÇÖP KUTUSU, KULLANICILAR =================
// Roller (sync.js belirler): writer = yönetici, viewer = yalnızca görür, partner = iş ortağı (ör. Moonlog).
// İş ortağı yalnızca kendi eklediği sefer, gider ve yakıtı görür, düzenler ve siler; sildiği/düzenlediği kaydın
// eski hâli yöneticinin çöp kutusunda 15 gün durur. Bulut kuralları aynı sınırları ayrıca uygular.
(function () {
  const PARTNER_TABS = ['trips', 'fuel', 'expenses', 'settings'];
  const STAMP = ['trips', 'fuels', 'expenses'];
  const isPartner = () => window.LX_ROLE === 'partner';
  const wrap = (name, fn) => { const orig = window[name]; if (typeof orig === 'function') window[name] = function () { return fn.call(this, orig, arguments); }; };

  // ---- Yeni kayda "ekleyen" bilgisi (yalnız yeni kayıtlar; eski kayıtlar olduğu gibi kalır) ----
  const known = new Set();
  const remember = () => STAMP.forEach(k => state[k].forEach(r => known.add(k + '/' + r.id)));
  remember();
  wrap('__lxApplyData', (orig, args) => { const r = orig.apply(null, args); remember(); return r; });
  wrap('saveState', (orig, args) => {
    const uid = window.__lxUid;
    if (uid) STAMP.forEach(k => state[k].forEach(r => { if (!known.has(k + '/' + r.id) && !r.createdBy) { r.createdBy = uid; r.createdByName = window.__lxName || ''; } }));
    remember();
    return orig.apply(null, args);
  });

  // ---- İş ortağı: araç km'sine dokunmaz, Moonlog kilitli, yalnız izinli sayfalar ----
  wrap('bumpOdo', (orig, args) => isPartner() ? undefined : orig.apply(null, args));
  function lockCompany() {
    const sel = $('tripCompany'); if (!sel) return;
    if (isPartner() && window.LX_PARTNER && window.LX_PARTNER.company) { sel.value = window.LX_PARTNER.company; setTripCompany(); sel.disabled = true; }
    else sel.disabled = false;
  }
  wrap('openModal', (orig, args) => { const r = orig.apply(null, args); if (args[0] === 'tripModal') { lockCompany(); previewTrip(); } return r; });
  wrap('saveTrip', (orig, args) => { lockCompany(); return orig.apply(null, args); });
  // Asistan: iş ortağına yalnızca kendi navlun, sefer, gider ve yakıt bilgisi; kâr, cari ve filo bilgisi yok
  wrap('asstReport', (orig, args) => isPartner() && !['freight', 'trips', 'expense', 'fuel'].includes(args[0].metric) ? 'Bu bilgi yalnızca yönetici ekranında. Kendi seferleriniz için "bu ay kaç sefer" ya da "bu ay navlun ne kadar" diye sorabilirsiniz.' : orig.apply(null, args));
  wrap('switchTab', (orig, args) => orig.apply(null, isPartner() && !PARTNER_TABS.includes(args[0]) ? ['trips'] : args));
  window.onRoleChange = r => {
    const cur = (document.querySelector('.tab-content.active') || {}).id || '';
    if (r === 'partner' && !PARTNER_TABS.includes(cur.replace('tab-', ''))) switchTab('trips');
    if (r !== 'writer' && cur === 'tab-trash') switchTab(r === 'partner' ? 'trips' : 'dashboard');
    renderAll(); renderUsers();
  };


  // ---- Çöp kutusu ----
  const KIND = { trips: ['trips', 'Sefer', 'route'], fuels: ['fuels', 'Yakıt', 'fuel'], expenses: ['expenses', 'Gider', 'receipt'], payments: ['payments', 'Tahsilat', 'wallet'], vehicles: ['vehicles', 'Araç', 'truck'], clients: ['clients', 'Müşteri', 'users'], companies: ['intermediaryCompanies', 'Aracı şirket', 'building'] };
  const FIELD = { price: 'navlun', km: 'km', route: 'güzergâh', client: 'müşteri', cargo: 'yük', date: 'tarih', paid: 'tahsilat', due: 'vade', amount: 'tutar', category: 'kategori', note: 'açıklama', liters: 'litre', unitPrice: 'litre fiyatı', totalCost: 'toplam', odometerKm: 'gösterge km', station: 'istasyon', vehicleId: 'araç', invoiceNo: 'fatura no', extra: 'masraf', deduct: 'kesinti' };
  const money = new Set(['price', 'amount', 'totalCost', 'extra', 'deduct']);
  const show = (k, v) => k === 'vehicleId' ? vehObj(v).plate : money.has(k) ? fmtTL(v) : k === 'date' || k === 'due' ? fmtD(v) : esc(String(v ?? '—'));
  function summary(kind, d) {
    if (kind === 'trips') return `${esc(d.route || 'Sefer')} · ${esc(d.client || '')} · ${fmtTL(d.price)}`;
    if (kind === 'fuels') return `${esc({ CEKICI: 'Çekici mazotu', FRIGO: 'Frigo mazotu', ADBLUE: 'AdBlue' }[d.type] || 'Yakıt')} · ${fmtNum(d.liters, 0)} lt · ${fmtTL(d.totalCost)}`;
    if (kind === 'expenses') return `${esc(d.category || 'Gider')} · ${esc(d.note || '')} · ${fmtTL(d.amount)}`;
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
    }).join('') : emptyState('Çöp kutusu boş. Silinen kayıtlar ve iş ortağının düzenlediği kayıtların eski hâli 15 gün burada durur.');
  };
  window.trashRestore = function (id) {
    if (window.LX_ROLE !== 'writer') return toast('Yalnızca yönetici geri alabilir.', 'error');
    const t = (window.__lxTrash || []).find(x => x.id === id); if (!t || !KIND[t.kind]) return;
    const arr = state[KIND[t.kind][0]], i = arr.findIndex(r => String(r.id) === String(t.recordId));
    if (t.action === 'delete' && i >= 0) return toast('Bu kayıt zaten yerinde.', 'error');
    if (i >= 0) arr[i] = t.data; else arr.push(t.data);
    saveState(); window.lxTrashDelete(id); toast(t.action === 'delete' ? 'Kayıt geri alındı.' : 'Kayıt eski hâline döndürüldü.');
  };
  window.trashPurge = function (id) { if (confirm('Bu kayıt çöp kutusundan kalıcı olarak silinsin mi?')) { window.lxTrashDelete(id); toast('Kalıcı olarak silindi.'); } };

  // ---- Kullanıcılar ve yetkiler (yönetici) ----
  const partners = () => firebase.firestore().collection('fleets').doc('lojix').collection('partners');
  window.renderUsers = async function () {
    const el = $('users-list'); if (!el) return;
    if (window.LX_ROLE !== 'writer' || !window.__lxUid) { el.innerHTML = '<p class="text-sm text-slate-500">Kullanıcıları yönetmek için yönetici hesabıyla buluta giriş yapın.</p>'; return; }
    fill('partnerCompany', state.intermediaryCompanies.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''));
    if (!$('partnerCompany').dataset.set) { const m = state.intermediaryCompanies.find(c => /moonlog/i.test(c.name)); if (m) $('partnerCompany').value = m.id; $('partnerCompany').dataset.set = 1; }
    try {
      const snap = await partners().get(), rows = [];
      snap.forEach(d => rows.push({ email: d.id, ...d.data() }));
      el.innerHTML = rows.length ? rows.map(p => `<div class="flex items-center gap-3 py-2.5 border-b border-slate-200 last:border-0"><span class="sheet-ic bg-violet-100 text-violet-700">${ic('user')}</span><div class="min-w-0 flex-1"><b class="font-semibold">${esc(p.name || p.email)}</b><div class="text-[13px] text-slate-500 truncate">${esc(p.email)} · İş ortağı · ${esc((state.intermediaryCompanies.find(c => c.id === p.company) || {}).name || p.company)}</div></div><button class="btn btn-icon danger" title="Yetkiyi kaldır" aria-label="${esc(p.email)} yetkisini kaldır" onclick="removePartner('${esc(p.email)}')">${ic('trash')}</button></div>`).join('')
        : '<p class="text-sm text-slate-500">Henüz iş ortağı yok.</p>';
    } catch (e) { el.innerHTML = `<p class="text-sm text-rose-600">Kullanıcılar okunamadı: ${esc(e.message)}</p>`; }
  };
  window.addPartner = async function (e) {
    e.preventDefault();
    const email = val('partnerEmail').trim().toLowerCase(), name = val('partnerName').trim(), company = val('partnerCompany');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Geçerli bir e-posta yazın.', 'error');
    if (email === ((firebase.auth().currentUser || {}).email || '').toLowerCase()) return toast('Kendi hesabınızı iş ortağı yapamazsınız.', 'error');
    try { await partners().doc(email).set({ name: name || email, company, addedBy: window.__lxUid, addedAt: firebase.firestore.FieldValue.serverTimestamp() }); $('partnerForm').reset(); delete $('partnerCompany').dataset.set; toast(`${name || email} iş ortağı olarak eklendi.`); renderUsers(); }
    catch (err) { toast('Eklenemedi: ' + err.message, 'error'); }
  };
  window.removePartner = async function (email) {
    if (!confirm(email + ' iş ortağı yetkisi kaldırılsın mı? Eklediği kayıtlar silinmez.')) return;
    try { await partners().doc(email).delete(); toast('Yetki kaldırıldı.'); renderUsers(); } catch (err) { toast('Kaldırılamadı: ' + err.message, 'error'); }
  };
})();
