# Kademe Sınav: UX spesifikasyonu

Sürüm 1, 2026-09-30. Yazan: Sally (bmad UX) + airbnb-ux prensipleri, Kademe'nin kendi tasarım
diliyle (`docs/design/RULES.md`). Airbnb'nin görsel dili kopyalanmaz; yalnızca prensipler uyarlanır.

Bu belge bütün yeni ekranların bölgelerini, hiyerarşisini, tek birincil eylemini ve boş / yükleme /
hata durumlarını sabitler. Kod bu belgeyle çelişirse belge güncellenir, sessizce sapılmaz.

## 1. İki insan, iki iş

**Öğretmen (okul yöneticisi, sınav sorumlusu).** Sabah kahvesiyle paneli açar. Tek sorusu:
"Bugün kimin sonucuna bakmam lazım ve ne kadar emin olabilirim?" Kırk öğrencinin kırk ayrı
ekranına dalmak istemez. AI'ın söylediğine körü körüne güvenmez, ama her şeyi sıfırdan
dinlemek için de vakti yoktur. İhtiyacı: AI'ın önerisi + önerinin kanıtı + tek tıkla onay ya da
gerekçeli değişiklik.

**Öğrenci.** Türkiye'de ya da Avrupa'da, Almanca kursuna yazılacak ya da "B1'im" dediği için
doğrulanıyor. Gergin: sınav, kamera, ekran paylaşımı. Kötü bir teknik deneyim onu "sistem beni
haksız yere işaretleyecek" korkusuna sokar. İhtiyacı: ne olacağını baştan, dürüstçe bilmek; her
ekranda tek bir şey yapmak; bir şey ters gittiğinde suçlanmadan nasıl düzelteceğini görmek.

Birincil işler:
- Öğretmen: bekleyen sonuçları kanıta bakarak onaylamak ya da düzeltmek.
- Öğrenci: sınavı kesintisiz, tek başına, doğru koşullarda bitirmek.

## 2. Uyarlanan prensipler (airbnb-ux)

| Prensip | Kaynak | Kademe'deki karşılığı |
|---|---|---|
| Birincil eylem gizlenmez, ekranın en görünür noktasıdır | playbook 1.1 | Her ekranda tek dolu buton; öğretmen tarafında "Bugün" kuyruğu ana sayfa |
| Arayüz kromu cimri, içerik önde | playbook 1.2 | Accent sadece CTA, aktif durum, saat. Sınav ekranında soru en büyük öğe |
| Önce kısa ve yaklaşık, sonra tam ve kesin | playbook 1.3 | Sonuç ekranında önce karar satırı, sonra beceri, sonra soru soru döküm |
| Önce önle, sonra kurtar | playbook 1.6 | Banka kapsamı yetmiyorsa yayınla/davet kapalı + neden; sistem kontrolü sınavdan önce |
| Otomasyon + insan kapısı, kötü öneri yerine susma | playbook 1.7 | AI önerir, öğretmen onaylar; kanıtı doğrulanamayan alıntı gösterilmez |
| Çıkmaz sokak yok | playbook 1.9 | Mobil engel ekranı "linki kopyala"; bitiş ekranı okulun iletişimi; boş banka "AI ile üret" |
| Güven sinyali dozu riske orantılı | playbook 3 | Bütünlük özeti dot+metin, kırmızı alarm yok; "doğrulanamadı" hile sayılmaz |

Taşınmayacaklar: rozet/doğrulama yığını, 5 yıldız puanı (seviye zaten ölçek), çok adımlı
checkout onayı, pazar yeri mekanikleri, keşif carousel'leri, kişiselleştirme. Kurs önerisi
hiçbir koşulda yok.

## 3. Genel kurallar (RULES.md üstüne)

1. Seviyeler her zaman `A1 A2 B1 B2 C1 C2` yazımıyla, `.tnum` ile, aynı genişlikte gösterilir.
2. Her seviyenin yanında kaynağı yazar: "Motor", "AI önerisi", "AI önerdi, Ayşe onayladı",
   "Ayşe değiştirdi: gerekçe". Kaynaksız seviye yoktur.
3. AI'dan gelen hiçbir şey dolu/accent renkte gösterilmez; öneri, karar değildir.
4. Sınav içeriği `lang="de" translate="no"`; arayüz metni TR/EN.
5. Sınav ekranında sayfa kaydırma yalnızca okuma metninde ve uzun yazma alanında.
6. Modal yok. Onay yok. Geri alınabilir eylem + 8 sn undo şeridi. Geri alınamaz tek eylem
   (sınav bölümünü bitirme) undo şeridiyle GECİKTİRİLİR: şerit bitince gönderilir.

## 4. Öğretmen paneli

Genişlik 1360px. Üst çubuk: logo, 5 nav öğesi, dil, kullanıcı.

**Nav (5, iş odaklı):** Bugün · Öğrenciler · Sınavlar · Soru bankası · Ayarlar.
Eski "Pozisyonlar / Kütüphane / Karşılaştır" kalkar; karşılaştırma öğrenci tablosunun sıralamasıdır.

### 4.1 Bugün (`/dashboard`)

Soru: "Neye bakmalıyım?"

- **Başlık:** "3 sonuç incelemenizi bekliyor" (sayı gerçekse). Alt satır: "En eskisi 2 gün önce bitti."
- **Tek dolu buton:** "Öğrenci davet et".
- **Birincil bölge: inceleme kuyruğu** (en eski önce). Satır: ad · mod (Seviye tespiti / B1 doğrulama)
  · motorun ön seviyesi · bekleyen iş ("2 AI önerisi onay bekliyor") · bütünlük (dot+metin) ·
  "İncele" metin bağlantısı. Satırın tamamı tıklanır.
- **İkincil bölge:** "Süren sınavlar" (canlı, kaç bölümde) ve "Linki 48 saatte dolacaklar" (uzat + undo).
- Stat tile ızgarası YOK.
- **Boş:** "Bekleyen sonuç yok." + "Öğrenci davet et" ikincil bağlantısı + kaç sınavın sürdüğü.
- **Hata:** sayfa hata sınırı, "Tekrar dene".

### 4.2 Öğrenciler (`/students`)

- Sekmeler: Tümü · İnceleme bekleyen · Süren · Kesinleşen.
- Arama + filtre çipleri (mod, sınav, seviye, bütünlük). Sıfır sonuç: aktif filtreler kaldırılabilir çip, "filtreleri temizle".
- Tablo sütunları: Öğrenci · Sınav / mod · Beyan (sadece doğrulamada) · Sonuç (seviye + kaynak
  kısaltması) · Durum (dot+metin) · Bütünlük (dot+metin) · Tarih.
- **Tek dolu buton:** "Öğrenci davet et".
- **Boş (hiç öğrenci):** "İlk öğrencinizi davet edin. Link tek kullanımlıktır." + dolu buton.

### 4.3 Davet (`/students/new`)

Tek sütun form: Ad soyad · E-posta · Sınav (yayınlı blueprint listesi, modu yazar) · Beyan
seviyesi (sadece doğrulama modunda görünür, A1-C2 segment) · Arayüz dili (TR/EN).

- Blueprint seçilince altında: "Tahmini 75 dk · 5 bölüm · gözetim: Sıkı".
- **Erken doğrulama:** seçilen sınav + beyan için banka kapsamı yetmiyorsa buton kapalı,
  DisabledReason: "B2 dinleme için 2 onaylı metin gerekiyor, bankada 1 var." + "Soru bankasına git".
- **Başarı:** aynı sayfada link bir kez gösterilir, "Kopyala" (dolu), "Bu link bir daha gösterilmez."
  Altında "Başka öğrenci davet et" ve "Öğrenciler listesine dön".

### 4.4 Sonuç ekranı (`/students/[id]`) : kritik ekran

Soru: "Bu seviyeye güvenebilir miyim, ve imzamı atayım mı?"

**Üst karar satırı (tam genişlik):**
Ad · mod · tarih | Büyük seviye "B1" + kaynak | Doğrulamada: "Beyan B1 · Sonuç: Doğrulandı /
Doğrulanmadı / Karar için kanıt yetersiz" + "Tutma olasılığı %82" | Durum dot+metin
("Öğretmen incelemesi bekliyor").

**Sol ana sütun: sekmeler** `Özet · Dilbilgisi · Okuma · Dinleme · Yazma · Konuşma · Bütünlük`
(yalnızca sınavda olan bölümler).
- *Özet:* beceri başına bir satır: beceri · seviye · kaynak · kısa dayanak ("14 soru, %71 doğru,
  ölçüm hassasiyeti iyi"). Seviye çizgisi: A1..C2 ekseni üzerinde her becerinin noktası ve
  belirsizlik aralığı (tek görsel, dekorasyon değil).
- *Objektif bölüm:* önce özet ("12 soru · 9 doğru · son tahmin B1"), sonra soru listesi
  (seviye, soru kökü kısa, öğrencinin cevabı, doğru cevap, puan). "Tümünü göster" ile açılır.
  Okuma/dinleme soruları metin başlığı altında gruplanır. Dinleme: kaç kez dinlendi.
- *Yazma:* sol: görev + öğrencinin metni (kanıt alıntıları metin içinde hafif alt çizgi).
  Sağ: AI kriter kartı: kriter · seviye · 1 cümle gerekçe · kanıt alıntıları; genel öneri;
  bayraklar ("çok kısa", "konu dışı"). Eylemler: "Öneriyi onayla" (outline) · "Seviyeyi değiştir"
  (outline, açılınca seviye segmenti + zorunlu gerekçe alanı + kaydet).
- *Konuşma:* görev başına video oynatıcı (mevcut) + tıklanabilir transkript + metrikler
  (kelime/dk, uzun duraklama) + AI kriter kartı. Telaffuz: "Transkriptten değerlendirilemez,
  videodan siz verin" + seviye segmenti.
- *AI başarısız:* kart yerine "AI önerisi üretilemedi: <neden>. Seviyeyi siz verin." + segment.
- *AI bekliyor:* "AI önerisi hazırlanıyor (genelde 1 dakika)". Sayfa kendini yenilemez; "Yenile" bağlantısı.

**Sağ sticky ray (kısa):**
- Beceri seviyeleri listesi (kaynağıyla), genel seviye (kural: beceri seviyelerinin alt medyanı,
  değiştirilebilir, gerekçe zorunlu).
- **Tek dolu buton** duruma göre: "Sonucu kesinleştir" → sonra "Öğrenciye göster".
  Kapalıyken DisabledReason: "Yazma için AI önerisini onaylayın ya da değiştirin."
- Bütünlük özeti satırı + "Bütünlüğü incele" bağlantısı.
- En altta "Değişiklik geçmişi" (açılır): kim, ne, önce → sonra, gerekçe, ne zaman.

**Bütünlük sekmesi:**
- Üst satır: seviye (dot+metin: Belirgin bir şey yok / İncelemeniz önerilir / Dikkatle inceleyin),
  1-3 gerekçe cümlesi, kapsam satırı ("Ekran paylaşımı kesintisiz · kamera %98 · AI modeli açık ·
  ikinci ekran: doğrulanamadı").
- Zaman ekseni: sınav süresi boyunca bölüm bantları, olay işaretleri (ciddiyete göre yükseklik,
  mürekkep rengi; seçili olan accent).
- Liste (varsayılan: açık orta + yüksek): bayrak kartı: tür, saat, süre, bölüm, önce/an kareleri
  (kamera + ekran), Gemini gözlemi metin olarak ("Karede 2 kişi görünüyor"), eylemler "Onayla" /
  "Yoksay" (outline, undo). "Tümünü göster" düşük ve bilgi olaylarını açar.
- Kısayollar: J/K sonraki/önceki, C onayla, D yoksay.
- Kapanış kararı: "Geçerli" · "Tekrar sınav (yeni davet)" · "Geçersiz say" (üçü de outline;
  seçilen aktif durum).
- **Boş:** "Bu sınavda gözetim kapalıydı." ya da "Hiç olay yok. Kapsam: ...".

### 4.5 Sınavlar (`/exams`, `/exams/[id]`)

Liste: ad · mod · bölümler · tahmini süre · durum (dot+metin) · kullanım sayısı. Dolu buton:
"Yeni sınav" (mod seçimi: iki büyük seçenek kartı "Seviye tespiti" / "Seviye doğrulama", her birinde
bir cümlelik açıklama).

Editör (Y2 düzeni, iki sütun):
- **Sol (öğrencinin gördüğü):** ad, açıklama, bölüm listesi (sürükle-bırak sıra, aç/kapa,
  süre dk, soru sayısı ya da "uyarlanabilir 8-15").
- **Sağ koyu "vault" (yalnızca öğretmen):** her bölüm için: uyarlanabilir aç/kapa, dağılım
  (seviye başına sayı ya da beyana göre -1/0/+1), hedef hassasiyet; yazma/konuşma: görev sayısı,
  kelime aralığı, düşünme/cevap süresi, deneme hakkı; genel: zorluk kaydırma, sonuç görünürlüğü
  (Hiç / Sadece genel seviye / Tam), otomatik yayın, geçme kuralları (doğrulama), dinleme çalma hakkı,
  gözetim preset (Kapalı / Standart / Sıkı) + "Özelleştir" (modül anahtarları, sonlandırma kuralları
  varsayılan kapalı ve açıklamalı).
- **Alt sticky şerit:** canlı banka kapsamı ("Tüm bölümler için yeterli soru var" ya da eksik
  listesi + "Bankaya git") · tahmini süre · "Önizle" (outline) · **"Yayınla"** (dolu, kapsam yoksa
  nedenli kapalı).
- Yayınlı sınav düzenlenemez; "Kopyasını düzenle". Autosave, "kaydedildi 14:02".

### 4.6 Soru bankası (`/bank`)

- Varsayılan görünüm: "Onay bekleyen" (AI taslakları). Sekmeler: Onay bekleyen · Onaylı · Reddedilen.
- Filtre çipleri: bölüm, seviye, tip, köken (Başlangıç / Öğretmen / AI).
- Üstte kapsam tablosu (bölüm × seviye, onaylı sayısı; eksik hücre mürekkep, dolu hücre soluk).
  Tıklanınca o filtre.
- Satır: soru kökü (kısa) · bölüm · seviye · tip · köken · durum.
- Detay (`/bank/[id]`): öğrencinin göreceği önizleme (sol) + anahtar, açıklama, zorluk, beceri
  etiketi (sağ vault). Eylemler: "Onayla" (dolu, taslakta) · "Reddet" · "Düzenle". Dinleme:
  ses oynatıcı + "Sesi yeniden üret"; ses yoksa onay kapalı + neden.
- **"AI ile üret"** (dolu buton, liste sayfasında): bölüm, seviye, tip, adet (≤10), konu (ops.).
  Gönderince "Üretiliyor, 20-40 sn" satırı; bitince taslaklar listenin başında vurgulu. Hata:
  "Üretilemedi: <neden>. Tekrar dene."
- **Boş (onay bekleyen yok):** "Onay bekleyen soru yok." + "AI ile üret".
- Başlangıç içeriği etiketi: "Kademe başlangıç içeriği, okulunuz incelemedi".

## 5. Öğrenci akışı

Genişlik 1000px, tek sütun. Üstte küçük logo, okul adı, dil seçici. Her ekranda tek dolu buton.

### 5.1 Giriş (`/a/[token]`)
- Başlık: "Almanca seviye sınavı" / "Almanca B1 seviye doğrulama". Kurum adı.
- Bölüm listesi: bölüm · süre · soru (Fact satırları). Toplam tahmini süre.
- "Bu sınav gözetimlidir" kartı: kamera ve mikrofon açık kalır · tüm ekranınız paylaşılır ·
  tam ekranda yapılır · pencere/sekme değişiklikleri kaydedilir · şüpheli anlar AI ile işaretlenir
  ve **öğretmeniniz inceler, sistem kimseyi otomatik başarısız saymaz** · kayıtlar N gün saklanır.
  "Ayrıntılar" açılır (tam liste + onay metni).
- "İhtiyacınız olanlar": bilgisayar (Chrome/Edge), kamera, mikrofon, sessiz oda, ~75 dk.
- Onay kutusu + **"Kabul ediyorum, başlayalım"**.
- Mobil cihazda bu ekran yerine: "Bu sınav bilgisayarda yapılır" + neden (ekran paylaşımı
  telefonda mümkün değil) + **"Linki kopyala"** + "E-postanızdaki linki bilgisayarda açın".

### 5.2 Bilgiler (mevcut form, değişmez).

### 5.3 Sistem kontrolü (`/a/[token]/check`)
Sıralı kontrol listesi. Aktif satır genişler, tamamlananlar tek satıra iner (dot + "Hazır").
1. Tarayıcı uygun (otomatik)
2. Tek ekran (otomatik; ikinci ekran varsa "Ek ekranı çıkarın ya da kapatın", canlı yeniden kontrol)
3. Kamera (önizleme)
4. Mikrofon (seviye çubuğu + "3 saniye sessiz kalın" kalibrasyonu)
5. Yüzünüz görünüyor (tek yüz; ışık önerisi)
6. Ekran paylaşımı ("Ekranı paylaş": "Tüm ekran"ı seçin; pencere seçilirse satır içi açıklama)
7. Bağlantı (bilgi amaçlı)

Her satırın kendi outline eylemi. Kırmızı satırda "Nasıl düzeltirim?" (macOS: Sistem Ayarları >
Gizlilik > Ekran Kaydı > Chrome, sonra Chrome'u yeniden başlat; ilerlemeniz kayıtlı) + "Sorun bildir".
**Tek dolu buton:** "Tam ekrana geç ve sınavı başlat" (hepsi yeşil değilse kapalı + hangi satır).

### 5.4 Bölüm girişi
"Bölüm 2 / 5 · Okuma" · "25 dakika · yaklaşık 12 soru" · 2-3 kural ("Metin solda, sorular sağda",
"Cevabı kaydettikten sonra geri dönülmez", dinlemede "Her kayıt en fazla 2 kez çalınır").
**"Bölümü başlat"**. Saat bu tıklamayla başlar (açıkça yazılır).

### 5.5 Soru ekranı
- Başlık şeridi (sticky): bölüm adı · "Soru 3 / 12" (uyarlanabilirde "Soru 3") · sunucu saati
  (accent, .tnum; son 2 dk "Son 2 dakika" metni) · "Kamera ve ekran kaydı açık" (dot+metin).
- Sağ altta 120×90 kendi görüntüsü (girdileri örtmez).
- İçerik:
  - Seçmeli: kök + seçenekler (büyük tıklanabilir satırlar, klavye 1-4).
  - Boşluk doldurma: metin içinde satır içi alanlar; altında ä ö ü ß Ä Ö Ü şeridi.
  - Doğru/Yanlış/Metinde yok: ifade başına üç segment.
  - Eşleştirme: sol öğe başına seçim listesi.
  - Okuma: metin solda (kendi kaydırması), soru sağda; 1000px altı üstte.
  - Dinleme: özel oynatıcı (oynat butonu, ilerleme çubuğu tıklanamaz, "1 / 2 dinleme"),
    çalma hakkı bitince "Dinleme hakkınız doldu" metni.
  - Yazma: görev kartı, geniş alan (yazım denetimi kapalı), kelime sayacı "142 / 120-180",
    umlaut şeridi, "Kaydedildi" işareti.
  - Konuşma: mevcut kayıt bileşeni (düşünme süresi, kayıt, deneme hakkı), kamera zaten açık.
- **Dolu buton:** "Cevabı kaydet ve devam et" (cevapsızken kapalı + "Bir seçenek işaretleyin";
  ama "Boş bırak ve devam et" metin bağlantısı her zaman var).
- Bölümün son sorusundan sonra: bölüm özeti ("12 sorudan 11'ini cevapladınız") + **"Bölümü bitir"**
  → 8 sn undo şeridi → gönderim.
- Süre dolunca: otomatik gönderim, "Süre doldu, cevaplarınız kaydedildi" ve sonraki bölüm girişi.

### 5.6 İhlal geri bildirimi
Modal değil. Başlık şeridinin altında yapışkan şerit, sakin dil, suçlamasız.
- **Kurtarılabilir** (tam ekrandan çıkış, paylaşım durdu, kamera kayboldu): içerik bulanık ve
  `inert`; şeritte tek dolu buton "Tam ekrana dön" / "Paylaşımı yeniden başlat" / "Kamerayı aç".
  "Süre işlemeye devam ediyor." Sonlandırma açıksa kalan süre gösterilir.
- **Eylem gerektiren** (yüz yok, konuşma): "Yüzünüz kamerada görünmüyor" / "Bu bölümde sesli
  konuşmayın". Kendiliğinden kalkar.
- **Bilgi** (telefon, ikinci kişi, sekme değişti): "Bu an kaydedildi, öğretmeniniz inceleyecek." 6 sn.
- Bakış için canlı uyarı yok (fazla gürültülü).
- Yapıştırma/sağ tık engellendiğinde: ekranda iz yok, sadece kayıt (öğrenciyi rahatsız etmeden).

### 5.7 Yeniden yükleme kapısı
"Sınavınız kaldığı yerden devam ediyor." Yalnızca yeniden alınması gerekenler (ekran paylaşımı,
tam ekran) satır olarak. "Süre bu sırada işledi: 21:40 kaldı." **"Devam et"**.

### 5.8 Bitiş (`/a/[token]/done`)
- "Sınavınız tamamlandı." + "Kamera, mikrofon ve ekran paylaşımı kapatıldı." (doğrulanmış olarak).
- Sonuç görünürlüğüne göre:
  - Hiç: "Sonucunuzu okulunuz size iletecek."
  - Genel / Tam ve sonuç kesin: seviye (büyük) + (tam ise) beceri satırları.
  - AI puanlı bölüm var ve kesinleşmedi: "Yazma ve konuşma bölümlerini öğretmeniniz
    değerlendiriyor. Sonuç kesinleşince bu linkten görebilirsiniz."
- Kurs önerisi yok. Sonraki adım: okulun iletişim e-postası + "Verilerimle ilgili talep".
- Sonlandırılmış varyant: neden (ör. "Ekran paylaşımı 30 saniyeden uzun kapalı kaldı") + "Okulunuzla iletişime geçin".

### 5.9 Link sorunları (mevcut LinkProblem): geçersiz / henüz değil / süresi doldu / tamamlandı.
Tamamlandı varyantı sonucu görünürlüğe göre gösterir.

## 6. Durum dili

| Durum | Öğretmen metni | Dot |
|---|---|---|
| Link gönderildi | Başlamadı | neutral |
| Sürüyor | Sınavda (Okuma, 2/5) | active |
| AI bekleniyor | AI değerlendiriyor | neutral |
| İnceleme bekliyor | İncelemenizi bekliyor | warn |
| Kesin | Kesinleşti | done |
| Yayınlandı | Öğrenciye gösterildi | done |
| Bütünlük temiz | Belirgin bir şey yok | done |
| Bütünlük incele | İncelemeniz önerilir | warn |
| Bütünlük dikkat | Dikkatle inceleyin | warn (metin kalın) |

## 7. Kabul kontrol listesi (her ekran için)

- [ ] Tek dolu buton, etiketi fiil.
- [ ] Kapalı buton nedenini yanında söylüyor.
- [ ] Boş, yükleme, hata durumu tasarlı; boş durum sonraki eylemi gösteriyor.
- [ ] Accent yalnızca CTA / aktif / saat.
- [ ] Durum dot + metin.
- [ ] TR ve EN metin anahtarları eşit.
- [ ] Em-dash yok.
