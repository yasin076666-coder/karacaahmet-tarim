#!/usr/bin/env bash
# Android TV hızlandırma (ADB, aynı Wi-Fi). Kullanım:
#   ./tv-optimize.sh 192.168.1.50          -> uygula
#   ./tv-optimize.sh 192.168.1.50 restore  -> geri al
# Uygulamalar silinmez, sadece devre dışı bırakılır (disable-user), geri alınabilir.
set -euo pipefail
IP="${1:?TV IP adresini ver: ./tv-optimize.sh 192.168.1.50}"
MODE="${2:-apply}"

# Çoğu kişinin kullanmadığı Google eklentileri. Kullandığını listeden çıkar.
PKGS=(
  com.google.android.videos            # Play Filmler
  com.google.android.music             # Play Müzik (eski)
  com.google.android.play.games        # Play Oyunlar
  com.google.android.youtube.tvmusic   # YouTube Music (kullanmıyorsan)
  com.google.android.feedback          # Geri bildirim
  com.android.printspooler             # Yazdırma
  com.google.android.backdrop          # Ambient ekran koruyucu
  com.android.dreams.basic             # Basit ekran koruyucu
)

adb connect "$IP:5555"
A="adb -s $IP:5555 shell"

if [ "$MODE" = restore ]; then
  for p in "${PKGS[@]}"; do $A pm enable "$p" >/dev/null 2>&1 && echo "açıldı: $p" || true; done
  for k in window_animation_scale transition_animation_scale animator_duration_scale; do
    $A settings put global "$k" 1
  done
  echo "Geri alındı."; exit 0
fi

INSTALLED="$($A pm list packages)"
for p in "${PKGS[@]}"; do
  grep -qx "package:$p" <<<"$INSTALLED" || continue
  $A pm disable-user --user 0 "$p" >/dev/null && echo "kapatıldı: $p"
done

# Animasyonları kısalt: menüler belirgin şekilde hızlı hissettirir.
for k in window_animation_scale transition_animation_scale animator_duration_scale; do
  $A settings put global "$k" 0.5
done

$A pm trim-caches 999G   # tüm uygulama önbelleklerini temizle
$A am kill-all           # arka plan süreçlerini kapat
echo "Bitti. TV'yi bir kez yeniden başlat: adb -s $IP:5555 reboot"
