// ================= YEDEKLEME =================
function updateBackupBanner() {
  const banner = document.getElementById('backup-banner');
  if (!banner) return;
  const hasData = sales.length + purchases.length + expenses.length > 0;
  let last = 0;
  try { last = Number(localStorage.getItem('tp_last_backup') || 0); } catch (e) {}
  const days = last ? (Date.now() - last) / 86400000 : Infinity;
  if (hasData && days >= 7) {
    document.getElementById('backup-banner-text').textContent =
      last ? `Son yedek ${Math.floor(days)} gün önce alındı. Verilerinizi korumak için yedek alın.`
           : 'Henüz yedek almadınız. Tarayıcı verisi silinirse kayıtlar kaybolabilir.';
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function exportData() {
  const backup = { version: 2, exportedAt: new Date().toISOString(), sales, purchases, expenses, cards, cardPays, cashMoves };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dl = document.createElement('a');
  dl.href = url;
  dl.download = `ticaret_tam_yedek_${getTodayString()}.json`;
  document.body.appendChild(dl);
  dl.click();
  document.body.removeChild(dl);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  try { localStorage.setItem('tp_last_backup', String(Date.now())); } catch (e) {}
  updateBackupBanner();
}

function importData(event) {
  const input = event.target;
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && (imported.sales || imported.purchases || imported.expenses)) {
        if (!confirm('Mevcut tüm veriler yedekteki verilerle DEĞİŞTİRİLECEK. Devam edilsin mi?')) return;
        sales = normList(imported.sales, normSale);
        purchases = normList(imported.purchases, normPurchase);
        expenses = normList(imported.expenses, normExpense);
        cards = normList(imported.cards, normCard);
        cardPays = normList(imported.cardPays, normCardPay);
        cashMoves = normList(imported.cashMoves, normMove);
        saveAll();
        applyFilters();
        alert('Yedek başarıyla yüklendi!');
      } else {
        alert('Bilinmeyen yedek dosyası formatı.');
      }
    } catch (err) {
      alert('Dosya okunurken bir hata oluştu.');
    } finally {
      input.value = ''; // aynı dosya tekrar seçilebilsin
    }
  };
  reader.readAsText(file);
}
