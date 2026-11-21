// ================= OTOMATİK YARDIMLAR =================
// 1) Yalnızca görebilen hesapta kayıt değiştiren her işlem durdurulur (bulut kuralı da yazmaya izin vermez).
// 2) Son değerleri doldurma: güzergâh/müşteri → son navlun, km, yük, aracı şirket; yakıt → son litre fiyatı ve istasyon.
// 3) Bulut ve yedek uyarısı.  4) Yarım kalan form telefonda saklanır, tekrar açılınca geri gelir.
(function () {
  const RO_MSG = 'Bu hesap yalnızca görüntüleyebilir. Kayıt eklemek ya da değiştirmek için yetkili hesapla giriş yapın.';
  const RECORD_MODALS = ['tripModal', 'fuelModal', 'expenseModal', 'payModal', 'vehicleModal', 'clientModal', 'companyModal'];
  const wrap = (name, fn) => { const orig = window[name]; if (typeof orig === 'function') window[name] = function () { return fn.call(this, orig, arguments); }; };

  // ---- 1) Salt okunur koruma ----
  ['togglePaid', 'delItem', 'saveFleet', 'saveMaint', 'markService', 'deleteVehicle', 'deleteIntermediaryCompany', 'saveIntermediaryCompany', 'importJSON', 'resetAll', 'createReceivable', 'createClient', 'addIntermediaryCompany', 'openVehicleModal']
    .forEach(n => wrap(n, (orig, args) => window.LX_READONLY ? toast(RO_MSG, 'error') : orig.apply(null, args)));

  // ---- 4) Yarım form ----
  const DRAFT_MODALS = ['tripModal', 'fuelModal', 'expenseModal', 'payModal'];
  const dKey = id => 'LOJIX_DRAFT_' + id;
  const fields = id => [...$(id).querySelectorAll('input:not([type=file]),select,textarea')].filter(el => el.id);
  const clearDraft = id => { try { localStorage.removeItem(dKey(id)); } catch (e) {} const bar = $(id).querySelector('.draft-bar'); if (bar) bar.remove(); };
  let noDraft = false;   // asistan formu doldururken eski taslak karışmasın
  wrap('runAssistant', (orig, args) => { noDraft = true; try { return orig.apply(null, args); } finally { noDraft = false; } });
  document.addEventListener('input', saveDraft, true);
  document.addEventListener('change', saveDraft, true);
  function saveDraft(e) {
    const m = e.target.closest && e.target.closest('.modal-wrap'); if (!m || !DRAFT_MODALS.includes(m.id) || editTarget || !e.isTrusted && e.type === 'input') return;
    const snap = {}; fields(m.id).forEach(el => snap[el.id] = el.value);
    try { localStorage.setItem(dKey(m.id), JSON.stringify({ at: Date.now(), v: snap })); } catch (err) {}
  }
  function restoreDraft(id) {
    let d; try { d = JSON.parse(localStorage.getItem(dKey(id)) || 'null'); } catch (e) {}
    if (!d || Date.now() - d.at > 7 * 864e5) return clearDraft(id);
    Object.entries(d.v).forEach(([k, v]) => { const el = $(k); if (el && v !== '') el.value = v; });
    if (id === 'tripModal') previewTrip();
    const form = $(id + '-form'), bar = document.createElement('div');
    bar.className = 'draft-bar'; bar.innerHTML = `<span>Yarım kalan kayıt geri getirildi.</span><button type="button">Temizle</button>`;
    bar.querySelector('button').onclick = () => { clearDraft(id); form.reset(); closeModal(id); openModal(id); };
    form.prepend(bar);
  }
  // Kayıt başarıyla kaydedilince ya da "Vazgeç" ile kapatılınca taslak silinir; dışarı dokunup kapatmak taslağı korur.
  ['saveTrip', 'saveFuel', 'saveExpense', 'savePayment'].forEach((n, i) => wrap(n, (orig, args) => { const r = orig.apply(null, args); if (!$(DRAFT_MODALS[i]).classList.contains('flex')) clearDraft(DRAFT_MODALS[i]); return r; }));
  document.addEventListener('click', e => { const b = e.target.closest('.modal-wrap form button[type=button]'); if (b && /Vazgeç/.test(b.textContent)) clearDraft(b.closest('.modal-wrap').id); }, true);

  // openModal: salt okunur kontrolü, taslağı geri yükle, son değerleri doldur
  wrap('openModal', (orig, args) => {
    const id = args[0];
    if (window.LX_READONLY && RECORD_MODALS.includes(id)) return toast(RO_MSG, 'error');
    document.querySelectorAll('.sheet-wrap.open').forEach(x => closeSheet(x.id));   // alttan açılan sayfa formun üstünde kalmasın
    const editing = !!editTarget, r = orig.apply(null, args);
    const opened = document.querySelector('.modal-wrap.flex');
    if (!editing && opened && DRAFT_MODALS.includes(opened.id)) { opened.querySelectorAll('.draft-bar').forEach(x => x.remove()); if (!noDraft) restoreDraft(opened.id); if (opened.id === 'fuelModal') fillFuel(); }
    return r;
  });

  // ---- 2) Son değerleri doldurma ----
  const empty = id => { const v = $(id).value; return v === '' || v === '0'; };
  const latest = (list, pred) => list.filter(pred).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)[0];
  function fillTrip(src) {
    if (editTarget) return;
    const route = nameKey(val('tripRoute')), client = nameKey(val('tripClient'));
    const t = src === 'route' && route ? latest(state.trips, x => nameKey(x.route) === route && (!client || nameKey(x.client) === client)) || latest(state.trips, x => nameKey(x.route) === route)
      : src === 'client' && client ? latest(state.trips, x => nameKey(x.client) === client) : null;
    if (!t) return;
    const got = [];
    if (src === 'client' && !route && t.route) { $('tripRoute').value = t.route; got.push('güzergâh'); }
    if (empty('tripPrice') && t.price) { $('tripPrice').value = t.price; got.push('navlun'); }
    if (empty('tripKm') && t.km) { $('tripKm').value = t.km; got.push('km'); }
    if (!val('tripCargo') && t.cargo) { $('tripCargo').value = t.cargo; got.push('yük'); }
    if (src === 'route' && !val('tripClient') && t.client) { $('tripClient').value = t.client; got.push('müşteri'); }
    if (!val('tripCompany') && t.intermediaryCompanyId && state.intermediaryCompanies.some(c => c.id === t.intermediaryCompanyId)) { $('tripCompany').value = t.intermediaryCompanyId; setTripCompany(); got.push('aracı şirket'); }
    if (got.length) { previewTrip(); hint('tripModal', `Son seferden dolduruldu (${fmtD(t.date)}): ${got.join(', ')}. Gerekirse değiştirin.`); }
  }
  function fillFuel() {
    if (editTarget) return;
    const type = val('fuelType'), vid = val('fuelVehicle');
    const lp = latest(state.fuels, x => x.type === type && Number(x.unitPrice) > 0), ls = latest(state.fuels, x => x.vehicleId === vid && x.station);
    const got = [];
    if (empty('fuelUnitPrice') && lp) { $('fuelUnitPrice').value = lp.unitPrice; calcFuel(); got.push(`litre fiyatı ${fmtNum(lp.unitPrice, 2)} ₺`); }
    if (!val('fuelStation') && ls) { $('fuelStation').value = ls.station; got.push('istasyon'); }
    if (got.length) hint('fuelModal', 'Son kayıttan dolduruldu: ' + got.join(', ') + '.');
  }
  function hint(id, msg) { const f = $(id + '-form'); let h = f.querySelector('.auto-hint'); if (!h) { h = document.createElement('p'); h.className = 'auto-hint'; f.querySelector('.pt-4').before(h); } h.textContent = msg; }
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'tripRoute') fillTrip('route'); else if (id === 'tripClient') fillTrip('client');
    else if (id === 'fuelType' || id === 'fuelVehicle') fillFuel();
  });
  document.addEventListener('click', e => { if (e.target.closest('.modal-wrap button[type=button]')) document.querySelectorAll('.auto-hint').forEach(h => h.remove()); }, true);

  // ---- 3) Bulut ve yedek uyarısı ----
  const LAST_BK = 'LOJIX_LAST_BACKUP';
  wrap('exportJSON', (orig, args) => { try { localStorage.setItem(LAST_BK, String(Date.now())); } catch (e) {} const r = orig.apply(null, args); renderCloudBanner(); return r; });
  window.renderCloudBanner = function () {
    const el = $('cloud-banner'); if (!el) return;
    const st = window.__lxCloud || 'off', days = (() => { const t = +(localStorage.getItem(LAST_BK) || 0); return t ? (Date.now() - t) / 864e5 : Infinity; })();
    let dismissed = false; try { dismissed = sessionStorage.getItem('LOJIX_BK_LATER') === '1'; } catch (e) {}
    let html = '';
    if (st === 'off') html = `<span class="cb-dot off"></span><span class="flex-1">Bulut bağlı değil: kayıtlar yalnızca bu telefonda.${days > 7 ? ' Yedek de alınmadı.' : ''}</span><button class="cb-btn" onclick="switchTab('settings');setTimeout(()=>$('lojix-cloud-email')&&$('lojix-cloud-email').focus(),50)">Giriş yap</button>${days > 7 ? '<button class="cb-btn ghost" onclick="exportJSON()">Yedek al</button>' : ''}`;
    else if (st === 'error') html = `<span class="cb-dot err"></span><span class="flex-1">Bulut eşitlemesinde sorun var; kayıtlar telefonda korunuyor.</span><button class="cb-btn" onclick="switchTab('settings')">Ayrıntı</button>`;
    else if (days > 30 && !dismissed && state.trips.length) html = `<span class="cb-dot warn"></span><span class="flex-1">${days === Infinity ? 'Hiç JSON yedeği alınmadı.' : 'Son JSON yedeği ' + Math.floor(days) + ' gün önce.'} Bulut açık; yine de ayda bir yedek önerilir.</span><button class="cb-btn" onclick="exportJSON()">Yedek al</button><button class="cb-btn ghost" onclick="try{sessionStorage.setItem('LOJIX_BK_LATER','1')}catch(e){};renderCloudBanner()">Sonra</button>`;
    el.innerHTML = html; el.hidden = !html;
    const chip = $('cloud-chip'); if (chip) { chip.dataset.state = st; chip.textContent = window.LX_READONLY && st === 'ok' ? 'Görüntüleme' : { ok: 'Bulut', busy: 'Eşitleniyor', error: 'Sorun', off: 'Bağlı değil' }[st]; }
  };
  renderCloudBanner();
})();
