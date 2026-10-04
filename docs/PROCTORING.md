# Gözetim (proctoring)

Tamamen tarayıcıda çalışır: kurulum, kilitli tarayıcı, eklenti yok. Bu yüzden
**caydırıcı ve kanıt toplayıcıdır, kurcalamaya dayanıklı değildir.** Belirlenmiş bir
kişi tarayıcı kodunu değiştirebilir; sunucunun kendi gördükleri (sinyal kesilmesi, iki
oturum, IP) bunu kısmen yakalar. Hiçbir işaret öğrenciyi otomatik başarısız saymaz.

## Ne kaydedilir ve nasıl

| Sinyal | Teknik | Güvenilirlik |
|---|---|---|
| Kamera, mikrofon | `getUserMedia`, iz `ended` olayı | yüksek |
| Tüm ekran paylaşımı | `getDisplayMedia` + `getSettings().displaySurface === "monitor"` | Chromium'da yüksek; Firefox/Safari'de "doğrulanamadı" |
| Paylaşım durdu | iz `ended` | yüksek |
| Tam ekran | `requestFullscreen` + `fullscreenchange`, `keyboard.lock(["Escape"])` | yüksek (Esc Chromium'da basılı tutulmalı) |
| Sekme/uygulama değişimi | `visibilitychange`, 2 sn toleranslı `blur` | yüksek, ama ikinci cihaz görünmez |
| İkinci ekran | `screen.isExtended` + `change` | yalnızca Chromium; aynalama, HDMI bölücü görünmez |
| Kopyala/yapıştır/sağ tık/kısayol | olay engelleme + kayıt | işletim sistemi kısayolları engellenemez, sadece fark edilir |
| Tek seferde uzun metin | `beforeinput insertText` > 30 karakter | orta |
| Çeviri/yazım eklentisi | DOM'a enjekte edilen işaretler | düşük, bilinen eklentiler |
| İkinci sekme | `BroadcastChannel` + sunucuda eşzamanlı oturum | orta |
| Yüz yok / birden fazla kişi | MediaPipe FaceLandmarker, 2 fps, histerezis | iyi ışıkta iyi |
| Bakış | baş açısı + göz blendshape'leri, yazarken aşağı bakış muaf | gürültülü, düşük ağırlık, canlı uyarı yok |
| Telefon | EfficientDet "cell phone", 3 karede 2 | kamera açısındaysa; kadraj dışı telefon görünmez |
| Konuşma sesi | bant enerjisi + spektral düzlük, sessizlik kalibrasyonu | orta; konuşma ve dinleme sırasında kapalı |

Kanıt: başlangıç (kimlik için göz karşılaştırması) karesi, periyodik kamera (30 sn) ve
ekran (45 sn) kareleri, her ihlalde anlık kareler. Sürekli ekran kaydı yok (depolama ve
bağlantı maliyeti). İhlal klipleri henüz yazılmadı.

## AI ikinci bakış

Şüpheli olayın kareleri Gemini vision'a gider (`src/server/proctor-review-job.ts`).
Model yalnızca görülen olguları söyler: kaç kişi, yüz görünüyor mu, cihaz var mı, ekranda
sınav dışı içerik var mı. **Duygu, niyet, kimlik, yaş, cinsiyet çıkarımı istemde açıkça
yasaktır** (AB Yapay Zeka Yasası, eğitimde duygu tanıma yasağı). Modelin kararı kendi
bildirdiği olgularla çelişirse UNCLEAR'a düşürülür. Deneme başına bütçe var.

## Bütünlük özeti

`src/lib/proctor/integrity.ts`: ciddiyete göre ağırlık, aynı türün tekrarında azalan
getiri (40 odak kaybı bir telefonu geçemez), AI doğruladıysa ×1.5, görmediyse ×0.3,
öğretmen yoksaydıysa 0. Kapsam boşlukları ("doğrulanamadı") seviyeyi en fazla
"İncelemeniz önerilir"e çıkarır, asla "Dikkatle inceleyin"e değil. Metinler hüküm
içermez.

## Sonlandırma

Varsayılan kapalı. Okul açarsa yalnızca iki kural: ekran paylaşımı N saniyeden uzun
kapalı, ya da tam ekrandan M kereden fazla çıkış. AI işaretleri asla sonlandırmaz.

## Uyum notları (hukuki görüş değildir)

- Eğitimde seviye belirleme ve sınav gözetimi AB Yapay Zeka Yasası'nda yüksek risk
  kategorisinde (Ek III, madde 3). Bu yüzden: insan her kararı verir, her AI çağrısı
  `ai_runs`'ta, öğrenciye önceden açık bildirim yapılır.
- Yüz sayma biyometrik tanımlama değildir; kimlik eşleştirme bilerek yapılmıyor.
- Reşit olmayan öğrenciler için veli onayı akışı yok; eklenmeli.
- Kareler `organizations.evidence_retention_days` (varsayılan 90) sonra silinmek üzere
  işaretlenir; saklama işine bağlanması henüz yapılmadı.

## Test

Otomasyon sekmesinde kamera ve gerçek tam ekran yoktur. Geliştirmede
`PROCTOR_DEV_FAKE=1` sunucu tarafından açılır (üretimde asla; `.env`'e yazılmaz, yalnızca
dev sunucusunun kabuğunda verilir ve iş bitince bayraksız yeniden başlatılır): sahte kamera/ekran
akışı, yüz sayısı `window.__proctorDev.setFaces(n)`, olaylar `__proctorDev.emit(type)`.
Gerçek cihaz ve tarayıcı matrisi elle denenmeli (STATUS.md'deki liste).
