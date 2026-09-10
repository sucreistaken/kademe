# Recruitment Assessment Platform - Uygulama Planı

## Context

Elde 32 bölümlük bir ürün brief'i var: yöneticinin bir pozisyon için aşamalı ve süreli bir
değerlendirme tasarladığı, adayın kişisel bir linkle bunu tek başına tamamladığı, yöneticinin
sonra video/yazılı cevapları tek ekranda izleyip yetkinlik bazlı puanladığı bir platform.
Ürün "AI video mülakat aracı" değil, "yapılandırılmış aday değerlendirme platformu". AI sadece
değerlendirmeyi *tasarlamaya* yardım eder, adayı elemez.

Brief iyi yazılmış ama 23 karar boşluğu vardı. Bu plan onları kapatıyor, piyasa araştırmasının
sonuçlarını mimariye gömüyor ve 20 maddelik tam MVP'yi fazlara bölüyor.

### Onaylanan kararlar

| Karar | Sonuç |
|---|---|
| Kiracılık | Tek şirket. Şemada `org_id` yine de duruyor, ileride SaaS'a dönmek kolay olsun diye |
| Aday cihazı | Her yerden, mobil dahil. Bu video mimarisini belirliyor (aşağıda) |
| Süre otoritesi | Sunucu, duvar saati. Ayrıntı: bölüm "Timer" |
| Retake kapsamı | Attempt + StageRun modeli, hem tam hem aşama bazlı. Ayrıntı: bölüm "Retake" |
| Link gönderimi | MVP'de yönetici linki kopyalar, Outlook'tan atar. Mailer arayüzü baştan kurulur |
| AI'ya aday verisi | Gidebilir. Ama AI Act sınırları içinde, aşağıda tanımlı 3 kullanım dışına çıkmaz |
| Dil | Yönetici ve aday tarafı tam TR+EN |
| MVP | Brief'teki 20 maddenin tamamı, yaklaşık 10 hafta |
| Hosting | Google Cloud Run `europe-west3` + Neon Postgres (Frankfurt) + Cloudflare R2 (EU) |

---

## 1. Araştırmadan gelen ve tasarımı değiştiren 4 bulgu

**1. Süre aşamada değil, aktivitede.** Hireflix, Willo ve Spark Hire'ın hepsi soru başına
*düşünme süresi* + *cevap süresi* + *izin verilen tekrar sayısı* veriyor. Brief süreyi sadece
aşama seviyesinde tanımlıyordu. Model iki seviyeyi birden taşıyacak: aşama toplam bütçesi bir
tavan, aktivite kendi süresini taşıyor.

**2. Puan skalasının yazılı çapası olmalı.** Serbest mülakatın tahmin gücü 0.20; davranışsal
çapalı (BARS) puan kartıyla 0.51. Yani "1=Çok zayıf, 5=Mükemmel" yetmez, her yetkinliğin her
puan seviyesi için ayrı bir tanım yazılacak. `scale_levels` tablosu bunun için var.

**3. AB AI Act iki sert sınır koyuyor.**
- Video veya sesten adayın duygusunu/kişiliğini/özgüvenini okuduğunu iddia eden özellik
  **yasaklı uygulama**. Ceza 35M EUR veya cironun %7'si. Bu özellik ürüne hiç girmeyecek.
- AI'nın eleme kararına katılması sistemi *yüksek riskli* sınıfa sokar (uyum tarihi Aralık 2027).
  Brief zaten AI'yı karardan uzak tutuyor; bu mimari korunacak ve kodda kısıtlanacak.

**4. iOS Safari 1 dakikayı geçen MediaRecorder kaydında sayfayı çökertiyor.** "Aday her yerden
girebilir" kararı, kaydı parça parça çekip anında yüklemeyi **zorunlu** kılıyor. Kaydı bellekte
tutup sonda tek seferde yükleyen klasik tasarım mobilde patlar.

---

## 2. Veri modeli

Postgres. Ana kural: **yayınlanan bir şablon versiyonu değişmez.** Aday her zaman bir
`template_version` id'sine bağlanır, o versiyon dondurulmuştur.

### Kimlik ve organizasyon
- `organizations` (tek satır olacak ama şema hazır)
- `users` - rol: `OWNER` | `RECRUITER` | `REVIEWER`. Reviewer puanlar, siler ve dışa aktaramaz
- `sessions`, `audit_logs`

### Pozisyon ve şablon
- `positions` - ad, kısa açıklama, tam ilan metni, zorunlu/tercih edilen yetenekler, diller
- `templates` - pozisyona bağlı, adı olan kapsayıcı
- `template_versions` - `status: DRAFT | PUBLISHED | ARCHIVED`, `locale_set: ['tr','en']`.
  **PUBLISHED olduktan sonra yazılamaz** (DB trigger ile zorlanır). Düzenleme yeni DRAFT açar
- `stages` - versiyona bağlı, `order`, süre, ek süre, geri navigasyon, zaman aşımı davranışı
- `activities` - aşamaya bağlı, `type` enum, `config` jsonb, `is_required`,
  `think_seconds`, `answer_seconds`, `max_takes`
- `activity_types`: `VIDEO` | `AUDIO` | `LONG_TEXT` | `SHORT_TEXT` | `SINGLE_CHOICE` |
  `MULTI_CHOICE` | `FILE_UPLOAD` | `SCENARIO`. Yeni tip eklemek sadece bir `config` şeması
  ve bir React bileşeni demek, şema göçü gerekmez

### İçerik ayrımı (brief'in 10. bölümü, ürünün ana farkı)
Her `activity` iki ayrı alan grubu taşır:
- **Adaya görünen:** `candidate_prompt`, `candidate_instructions` (bilingual jsonb: `{tr, en}`)
- **Sadece yöneticiye:** `internal_question`, `internal_objective`, `expected_behaviours`,
  `red_flags`, `manager_notes`

Aday API'si `internal_*` alanları **hiçbir sorguda seçmez**. Bu tek bir `candidateSafe()`
projeksiyon fonksiyonuyla merkezileşir, her endpoint'te elle filtrelenmez.

### Yetkinlik ve puanlama kütüphanesi
- `competencies` - organizasyon seviyesinde, pozisyonlar arası tekrar kullanılır
- `rating_scales` + `scale_levels` - her seviyenin yazılı tanımı (BARS çapası)
- `evaluation_options` - tıklanabilir gözlem etiketleri, `polarity: POSITIVE | NEGATIVE`
- `stage_competencies` - hangi aşamada hangi yetkinlik ölçülüyor
- `weight_sets` + `weights` - versiyona **snapshot** alınır. Ağırlık değişirse yeni set açılır,
  eski skorlar aynen kalır. Yönetici isterse "yeniden hesapla" der, kendiliğinden olmaz

### Aday ve deneme
- `candidates` - ad, e-posta, telefon, konum, ek alanlar
- `assessments` - `candidate_id` x `template_version_id`. Davetin kendisi
- `assessment_links` - `token_hash` (sha256), `expires_at`, `not_before`, `attempts_allowed`,
  `status`. Ham token sadece URL'de, DB'de asla
- `attempts` - `assessment_id`, `scope: FULL | PARTIAL`, `is_primary`, `created_reason`
- `stage_runs` - `attempt_id` x `stage_id`, `started_at`, `deadline_at`, `submitted_at`,
  `carried_from_stage_run_id`, `completion: COMPLETE | PARTIAL | SKIPPED | EXPIRED`
- `responses` - `stage_run_id` x `activity_id`, `payload` jsonb, `answered_at`
- `media_assets` - `storage_key`, `mime`, `duration_ms`, `bytes`, `checksum`,
  `status: UPLOADING | READY | INCOMPLETE | FAILED`, `upload_id` (multipart), `parts` jsonb
- `transcripts` - `media_asset_id`, `text`, `words` jsonb (kelime zaman damgaları), `language`

### Değerlendirme ve karar
- `evaluations` - `attempt_id` x `evaluator_id`. Her değerlendiricinin kendi kaydı,
  sessizce ortalanmaz
- `evaluation_items` - `evaluation_id` x `competency_id`, `score`, `selected_option_ids[]`, `note`
- `stage_notes` - aşama başına serbest not
- `decisions` - `assessment_id`, `status`, `note`, `decided_by`, `decided_at`. Geçmiş korunur
- `retake_requests` - `scope_stage_ids[]`, `reason`, `requested_by`

### Uyum ve operasyon
- `consents` - `consent_text_version`, `accepted_at`, `ip`, `user_agent`. Metnin o günkü hali
  ayrı tabloda versiyonlu durur, 1 yıl sonra "neyi kabul etti" ispatlanabilir
- `technical_events` - `stage_run_id`, `type`, `at`, `meta` jsonb
- `ai_runs` - `purpose`, `model`, `prompt_hash`, `input_ref`, `output_ref`, `cost`.
  AI Act izlenebilirliği için, ayrıca hata ayıklama için
- `message_outbox` - gönderilecek/gönderilen mesajlar. MVP'de sadece yazılır ve panelde
  "kopyala" olarak gösterilir
- `deletion_requests` - adayın erişim/silme talebi, yöneticinin kuyruğuna düşer

### Çok dillilik
Adaya giden her metin alanı `jsonb {tr: "...", en: "..."}`. Şablon versiyonu hangi dilleri
desteklediğini `locale_set` ile taşır. Aday linki `?lang=` ile açılır veya tarayıcı dilinden
seçer, üstte değiştirilebilir. Yönetici paneli `next-intl` ile TR/EN.

---

## 3. Timer mimarisi (B3 cevabı)

**Karar: sunucu otoriter, duvar saati.**

Aktif süre (sekme kapalıyken duran sayaç) reddedildi çünkü sömürülebilir: aday sekmeyi kapatır,
düşünür veya araştırır, geri gelir. Piyasadaki tüm platformlar duvar saati kullanıyor.

Akış:
1. `POST /api/candidate/stage/:id/start` -> sunucu `started_at` yazar,
   `deadline_at = started_at + duration + grace` hesaplar, `{server_now, deadline_at}` döner
2. İstemci bir kere saat farkını (offset) hesaplar, geri sayımı yerel çizer
3. Her 15 saniyede `POST /heartbeat` -> `remaining_ms` döner, aynı zamanda varlık kaydı tutar
4. Yenileme (F5) -> `GET /stage/:id/state` aynı `deadline_at`'ı döner. Süre ne sıfırlanır ne uzar
5. `deadline_at + 5sn` sonrası gelen yazma isteklerini sunucu reddeder
6. Her dakika çalışan bir cron işi, süresi geçmiş açık `stage_run`'ları `EXPIRED` yapıp
   kısmi cevapları kaydeder

**Aktivite seviyesi süre:** video aktivitesinde `think_seconds` (soru okunur, kayıt başlamaz) ve
`answer_seconds` (kayıt otomatik durur) ayrı. İstemcide MediaRecorder kendini durdurur,
sunucuda ayrıca `answer_seconds * 1.1`'den uzun medya reddedilir.

**Kopma:** bağlantı kesintileri `technical_events`'e yazılır, süre **otomatik uzatılmaz**.
Yönetici logu görür, haksızlık olduğuna kanaat getirirse retake verir. Brief'in "sistem loglar,
yönetici karar verir" ilkesiyle tutarlı.

---

## 4. Retake mimarisi (B4 cevabı)

**Karar: `Attempt` + `StageRun` + taşıma (carry-forward).**

Yönetici "Tekrar iste" der ve kapsam seçer: tüm değerlendirme veya seçili aşamalar.

- Yeni bir `attempt` açılır (`scope = FULL` veya `PARTIAL`)
- Kapsam **dışındaki** aşamalar için `stage_run` satırı açılır ama
  `carried_from_stage_run_id` önceki çalışmayı işaret eder. Veri kopyalanmaz
- Aday **aynı URL'yi** kullanır, sadece kapsamdaki aşamaları görür
- Hiçbir şey silinmez. Yönetici bir denemeyi `is_primary` işaretler
- Karşılaştırma tablosu ve genel skor **sadece primary attempt'ı** okur

Neden bu: tek modelle hem "her şeyi baştan çeksin" hem "sadece 2. aşamayı çeksin" senaryosunu
karşılıyor, geçmişi bozmadan. Tam retake = kapsamda tüm aşamalar var demek, özel durum yok.

---

## 5. Video mimarisi

iOS bulgusu yüzünden bu pazarlık konusu değil: **kayıt sırasında parça parça yükleme.**

1. **Cihaz kontrolü ekranı:** `enumerateDevices` + `getUserMedia`, canlı önizleme, mikrofon
   seviye göstergesi, 5 saniyelik deneme kaydı ve geri oynatma, "hazırım" onayı
2. **Kayıt:** `new MediaRecorder(stream, {timeslice: 5000})`. Her `ondataavailable` parçası
   anında S3 multipart part olarak presigned URL ile R2'ye gider. Bellekte büyük blob tutulmaz
3. **Tamamlama:** `stop` sonrası istemci `complete-upload` çağırır, sunucu
   `CompleteMultipartUpload` yapar, `media_assets.status = READY`
4. **Tarayıcı ölürse:** yüklenmiş parçalar duruyor. Sunucu kısmi kaydı tamamlar,
   `INCOMPLETE` işaretler. Yönetici eldeki kadarını görür, boş ekran görmez
5. **Codec:** önce `video/mp4;codecs=h264` denenir (Safari), olmazsa `video/webm;codecs=vp9`,
   sonra `vp8`. Seçilen mime kaydedilir
6. **Oynatma:** kısa ömürlü (5 dk) presigned GET. Bucket asla public değil
7. **Transkripsiyon:** READY olunca kuyruğa girer, ElevenLabs Scribe'a gider
   (saatlik 0,22 USD, 90+ dil, kelime zaman damgalı). Yönetici izlemek yerine okuyabilir,
   metinde arama yapabilir, bir kelimeye tıklayıp videoda o ana atlayabilir.
   Bu yönetici tarafındaki en büyük hız kazancı

**Kaba maliyet:** aday başına 4 aşama x 3 dk x 720p yaklaşık 150-250 MB.
R2 ücretsiz katmanı 10 GB, yani yaklaşık 50 aday bedava. Sonrası GB başına aylık 0,015 USD,
çıkış trafiği ücretsiz. Transkripsiyon aday başına yaklaşık 0,05 USD.

---

## 6. AI mimarisi (AI Act güvenli)

**Sadece üç kullanım. Her biri `ai_runs` tablosuna kaydedilir.**

1. **İş ilanı -> değerlendirme taslağı.** Girdi: ilan metni. Çıktı: şemalı JSON (aşamalar,
   aktiviteler, yetkinlikler, kriterler, adaya görünecek metinler). Zod ile doğrulanır, bozuk
   çıktı için bir onarım denemesi yapılır. **Hiçbir öneri kendiliğinden uygulanmaz**, yönetici
   madde madde kabul/düzenle/sil/sırala yapar
2. **Transkripsiyon.** ElevenLabs Scribe
3. **Değerlendirme özeti.** Girdi: **sadece yöneticinin kendi puanları, seçtiği gözlem
   etiketleri ve notları.** Video ve transkript bu isteme hiç girmez. Çıktı "Yöneticinin
   değerlendirmesinin özeti" etiketiyle gösterilir

**Kodda ve ürün metninde yasak:** adayı puanlamak, adayları sıralamak, videodan veya sesten
duygu/kişilik/özgüven çıkarmak, işe al/alma önermek. Sonuncular sadece politika değil, duygu
çıkarımı AI Act'te yasaklı uygulama.

Sağlayıcı `AiProvider` arayüzünün arkasında. OpenRouter ile başlanır, model konfigürasyondan
değişir. Aday verisi bir alt işleyiciye gittiği için OpenRouter ve ElevenLabs gizlilik
bildiriminde alt işleyici olarak listelenir.

---

## 7. Yönetici değerlendirme ekranı (brief'in 25. bölümü, kritik UX)

Tek ekran, sayfa değişmez:

```
+--------------------------------------+  +---------------------------+
|  Aşama 2 - Satış Senaryosu           |  |  YETKİNLİKLER (bu aşama)  |
|  [ video oynatıcı ]                  |  |  İletişim      * * * * *  |
|                                      |  |  Satış Bakışı  * * * * o  |
|  [ transkript, videoyla senkron ]    |  |                           |
|  tıklanabilir kelimeler              |  |  GÖZLEMLER                |
|                                      |  |  [+] Net ve yapılandırılmış|
|  ---- sadece yönetici görür ----     |  |  [+] Müşteri odaklı        |
|  İç amaç: itiraz karşılama           |  |  [-] Zayıf takip           |
|  Kırmızı bayrak: fiyat üzerinden...  |  |                           |
|                                      |  |  Not: [_______________]   |
|                                      |  |  (otomatik kaydedilir)    |
+--------------------------------------+  +---------------------------+
        [ < Önceki aşama ]  [ Sonraki aşama > ]  [ Karar ekranına git ]
```

- Yıldızın üstüne gelince o seviyenin **yazılı tanımı** görünür (BARS çapası)
- Klavye: `1-5` odaktaki yetkinliğe puan, `J/K` yetkinlik değiştir, `Space` oynat/duraklat,
  ok tuşları ileri/geri sarma
- Otomatik kayıt, "Kaydet" düğmesi aramaya gerek yok
- "Sonraki aşama" videoyu ve puanlama panelini birlikte ilerletir

---

## 7A. "No brainer" - altın yol

Sistemin başarı ölçütü şu: **yönetici günlük işini düşünmeden yapabilmeli.** Kurulum bir kere
olur, günlük iş iki şeye iner.

**Günlük iş 1 - aday davet et (hedef: 30 saniye, 4 tıklama)**
```
Dashboard -> [Aday davet et] -> isim + e-posta + şablon seç -> [Link kopyala]
```
Link panoya kopyalanır, Outlook'a yapıştırılır. Başka hiçbir adım yok.

**Günlük iş 2 - adayı değerlendir (hedef: aday başına 5 dakika, sıfır sayfa geçişi)**
```
Dashboard "3 aday değerlendirme bekliyor" -> tıkla
-> video oynar, sağda puanlama paneli
-> 1-5 tuşlarıyla puanla, gözlem etiketlerine tıkla
-> "Sonraki aşama" -> ... -> "Karar ver"
```
Kaydet düğmesi aramak yok, sekme değiştirmek yok, ayrı sayfa açmak yok.

**Kurulum işi (bir kere, sonra tekrar dokunulmaz)**
```
Pozisyon oluştur -> ilan metnini yapıştır -> AI taslak çıkarır
-> gözden geçir, düzelt -> yayınla
```

**Bunu bozmamak için bilinçli olarak YAPILMAYACAKLAR:**
- Kurulum sihirbazı yok. Boş dashboard doğrudan "İlk pozisyonunu oluştur" diyor
- Ayrı "ayarlar" labirenti yok. Ayar sayısı tek ekrana sığacak kadar az tutulur
- Yetkinlik kütüphanesi boş başlamaz, 8 hazır yetkinlik (İletişim, Problem Çözme, İnisiyatif,
  Satış Bakışı, Teknik Bilgi, Organizasyon, Takım Çalışması, Müşteri Odağı) yazılı seviye
  tanımları ve gözlem etiketleriyle **hazır gelir.** Yönetici sıfırdan yazmak zorunda kalmaz
- Onay diyaloğu ("emin misiniz?") yok. Geri alma var
- Ağırlıklı skorlama varsayılan olarak KAPALI. Basit ortalama yeterli. Açmak isteyen açar
- Aday tarafında ilerleme çubuğu dışında hiçbir süs yok

---

## 7B. Sitemap ve tam ekran listesi

```
/  (yönetici, giriş yapılmamışsa /login'e)
|
+-- /login                        giriş
+-- /login/2fa                    TOTP
|
+-- /dashboard                    bekleyen işler, hızlı davet
|
+-- /positions                    pozisyon listesi
|   +-- /positions/new
|   +-- /positions/[id]           detay + şablon listesi
|       +-- /templates/new
|       +-- /templates/[id]                 versiyon listesi
|           +-- /versions/[v]/builder       şablon builder (aşama + aktivite)
|           +-- /versions/[v]/ai            AI builder
|           +-- /versions/[v]/preview       ADAY ÖNİZLEMESİ
|
+-- /candidates                   aday tablosu, filtre, arama
|   +-- /candidates/new           davet et (link üret)
|   +-- /candidates/[id]          aday detay, deneme geçmişi
|       +-- /review               İNCELEME VE PUANLAMA (kritik ekran)
|       +-- /decision             karar
|
+-- /compare                      karşılaştırma tablosu
|
+-- /library                      yetkinlik kütüphanesi
|   +-- /library/competencies/[id]   skala seviyeleri + gözlem etiketleri
|
+-- /settings                     saklama süresi, kullanıcılar, roller, org
+-- /settings/audit               audit log ve teknik olaylar

ADAY TARAFI (giriş yok, sadece token)
/a/[token]
|
+-- /a/[token]                    giriş sayfası (pozisyon, süreç, rıza)
+-- /a/[token]/info               kişisel bilgi formu
+-- /a/[token]/check              cihaz kontrolü
+-- /a/[token]/stage/[n]          aşama (içinde aktiviteler sırayla)
+-- /a/[token]/done               tamamlandı
+-- /a/[token]/rights             veri hakları / silme talebi

HATA DURUMLARI (aynı token yolunda)
  link süresi dolmuş / henüz açılmadı / zaten tamamlandı / geçersiz link
```

**Ekran sayısı:** yönetici 17, aday 6, hata 4. Toplam 27.
Tasarım canvas'ında bunların en kritik 12'si çiziliyor, kalanı aynı bileşenlerden türüyor.

---

## 7C. İki yolculuk

**Aday yolculuğu (tek oturum, ortalama 25 dakika)**
```
E-postadaki linke tıklar
  -> Giriş sayfası: pozisyon adı, 4 aşama, ~25 dk, video kaydedileceği bildirimi,
     rıza kutusu.  SORULAR GÖRÜNMÜYOR.
  -> [Başla]
  -> Kişisel bilgi formu (ad, e-posta, telefon, konum)
  -> Cihaz kontrolü: kamera önizleme, mikrofon çubuğu, 5 sn deneme kaydı
  -> Aşama 1: soru gösterilir, düşünme süresi akar, kayıt otomatik başlar,
     cevap süresi biter, kayıt durur, parçalar zaten yüklenmiş
  -> Aşama 2, 3, 4 (yazılı / çoktan seçmeli / dosya / senaryo olabilir)
     Geri dönüş varsayılan olarak KAPALI
  -> Tamamlandı: teşekkür, ne olacağı, veri hakları bağlantısı
```
Kesinti olursa: sayfayı yenilediğinde kaldığı yerden devam eder, süre ne sıfırlanır ne uzar.

**Yönetici yolculuğu**
```
KURULUM (bir kere)
  Pozisyon oluştur -> ilan metnini yapıştır -> AI taslak üretir
  -> önerileri madde madde kabul/düzenle/sil -> aşama süreleri ayarla
  -> aday önizlemesinde kontrol et -> YAYINLA (versiyon kilitlenir)

GÜNLÜK
  Aday davet et -> link kopyala -> Outlook'tan gönder
  Dashboard'da "değerlendirme bekliyor" rozeti
  -> İnceleme ekranı: video + transkript solda, puanlama sağda
  -> 4 aşamayı sayfa değiştirmeden puanla
  -> genel skor otomatik çıkar
  -> karar ver (Kabul / Ret / Kısa liste / Beklemede / Tekrar iste)
  -> Karşılaştırma tablosunda adayları yan yana gör
```

---

## 7D. API mimarisi

Next.js route handlers. İki ayrı yüzey, ayrı yetkilendirme.

**Yönetici API (`/api/m/*`) - oturum çerezi + rol kontrolü**

| Uç | İş |
|---|---|
| `positions` GET/POST/PATCH/DELETE | pozisyon CRUD |
| `templates` GET/POST | şablon oluştur |
| `templates/:id/versions` POST | yeni taslak versiyon aç |
| `versions/:v` PATCH | taslak düzenle (PUBLISHED ise 409 döner) |
| `versions/:v/publish` POST | versiyonu kilitle |
| `versions/:v/stages` POST/PATCH/DELETE/`reorder` | aşama işlemleri |
| `stages/:id/activities` POST/PATCH/DELETE/`reorder` | aktivite işlemleri |
| `versions/:v/preview` GET | adayın göreceği hali, iç alanlar temizlenmiş |
| `ai/draft` POST | ilan metni -> şemalı taslak |
| `competencies`, `scales`, `options` CRUD | kütüphane |
| `candidates` GET/POST | liste, filtre, davet oluştur |
| `candidates/:id/link` POST | link üret, ham token bir kere döner |
| `attempts/:id` GET | deneme detayı, aşama çalışmaları, medya, transkript |
| `attempts/:id/primary` POST | birincil deneme seç |
| `media/:id/url` GET | 5 dk ömürlü presigned oynatma URL'si, audit'e yazılır |
| `evaluations` POST/PATCH | puan, gözlem etiketleri, not (otomatik kayıt) |
| `evaluations/:id/summary` POST | AI özet (sadece yöneticinin kendi girdisinden) |
| `decisions` POST | karar + not |
| `retakes` POST | kapsam seçerek tekrar iste |
| `compare` GET | karşılaştırma matrisi |
| `settings/*`, `audit` GET | ayar ve denetim |

**Aday API (`/api/c/*`) - sadece token, çerez yok**

Kritik kural: istemci hiçbir zaman id göndermez. Sunucu token'dan `assessment`'ı çözer,
sıradaki aşamayı kendisi belirler. Böylece aday başka bir kaydı adresleyemez.

| Uç | İş |
|---|---|
| `state` GET | link geçerli mi, hangi ekrandayım, kalan süre |
| `consent` POST | rıza kaydı (metin versiyonu + zaman + IP) |
| `info` POST | kişisel bilgi |
| `stage/start` POST | sunucu `started_at` ve `deadline_at` yazar, ikisini döner |
| `stage/heartbeat` POST | her 15 sn, `remaining_ms` döner, varlık kaydı |
| `response` PUT | cevap taslağı (otomatik kayıt) |
| `stage/submit` POST | aşamayı kapat, sıradakine geç |
| `media/init` POST | multipart yükleme başlat, parça URL'leri |
| `media/part` PUT | doğrudan R2'ye (sunucudan geçmez) |
| `media/complete` POST | parçaları birleştir, transkripsiyon kuyruğa girer |
| `event` POST | teknik olay logu (sekme değişimi vb.) |
| `rights` POST | erişim veya silme talebi |

**Cron (`/api/cron/*`, paylaşılan sır ile korumalı)**

`close-expired` (dakikalık), `purge-retention` (günlük), `expire-links` (günlük).

---

## 7E. Veri akışı (metin diyagramı)

```
İŞ İLANI
   |
   v
[AI taslak]  --ai_runs'a kayıt-->  yönetici madde madde onaylar
   |
   v
TEMPLATE_VERSION (yayınlanınca DEĞİŞMEZ)
   |  stages -> activities
   |     activities iki içerik taşır:
   |        candidate_prompt   -> adaya gider
   |        internal_*         -> ASLA aday API'sinden çıkmaz
   v
ASSESSMENT (candidate x template_version)
   |
   +--> ASSESSMENT_LINK (token_hash; ham token sadece URL'de)
              |
              v
        aday linki açar
              |
              v
        CONSENT kaydı (metin versiyonu + zaman + IP)
              |
              v
        ATTEMPT #1
              |
              +--> STAGE_RUN (started_at, deadline_at sunucudan)
                       |
                       +--> RESPONSE (metin, seçim, dosya)
                       |
                       +--> MEDIA_ASSET
                              |   kayıt sırasında 5 sn'lik parçalar
                              |   presigned URL ile doğrudan R2'ye
                              |   (sunucudan geçmez)
                              v
                            R2 (EU, public değil)
                              |
                              v
                            TRANSCRIPT (ElevenLabs Scribe, kelime zaman damgalı)
                       |
                       +--> TECHNICAL_EVENT (sekme değişimi, kopma, kamera kapandı)
              |
              v
        yönetici inceleme ekranı
              |  video (5 dk presigned URL) + transkript + iç kriterler
              v
        EVALUATION (değerlendirici başına ayrı)
              |  EVALUATION_ITEM: yetkinlik, puan, gözlem etiketleri, not
              v
        genel skor  =  ortalama  (ağırlık seti varsa ağırlıklı)
              |         + ayrı "Bilgi Skoru" (otomatik puanlanan sorulardan)
              v
        DECISION (yönetici, tek başına)
              |
              +--> RETAKE gerekirse -> ATTEMPT #2 (kapsam seçilir,
              |      kapsam dışı aşamalar carried_from ile taşınır, hiçbir şey silinmez)
              |
              v
        KARŞILAŞTIRMA TABLOSU (sadece is_primary attempt okunur)

ARKA PLAN
   dakikalık : süresi geçmiş stage_run'ları kapat, kısmi cevabı sakla
   günlük    : saklama temizliği (video 180 gün, aday 24 ay), link süresi
```

---

## 7F. Sabit durum listeleri (brief'ten birebir)

**Link durumu:** `NOT_STARTED` | `IN_PROGRESS` | `COMPLETED` | `EXPIRED` |
`RETAKE_REQUESTED` | `RETAKE_AVAILABLE`

**Karar durumu:** `NEW` | `IN_REVIEW` | `SHORTLISTED` | `INTERVIEW` | `RETAKE_REQUESTED` |
`ACCEPTED` | `REJECTED` | `ON_HOLD`

**Aşama zaman aşımı davranışı:** `AUTO_SUBMIT` (varsayılan) | `AUTO_CLOSE` |
`ALLOW_GRACE` (ek süre tanı) | `ALLOW_LATE` (süre bitse de tamamlamaya izin ver, geç işaretle)

**Aktivite tipleri:** `VIDEO` | `AUDIO` | `LONG_TEXT` | `SHORT_TEXT` | `SINGLE_CHOICE` |
`MULTI_CHOICE` | `FILE_UPLOAD` | `SCENARIO`

**Roller:** `OWNER` | `RECRUITER` | `REVIEWER`

---

## 8. Kapatılan boşluklar (brief'te eksik olan 23 madde)

| # | Boşluk | Karar |
|---|---|---|
| 1 | Aday yarıda bırakırsa | Yeni durum `EXPIRED_INCOMPLETE`. Kısmi cevaplar görünür ve puanlanabilir, "eksik" rozetiyle |
| 2 | Yükleme yarıda kalırsa | Parçalı yükleme + `INCOMPLETE` medya durumu. Eldeki kadarı oynatılır |
| 3 | Otomatik puanlanan sorular | **Ayrı bir "Bilgi Skoru"** olarak durur, yetkinlik ortalamasına karışmaz. Yan yana gösterilir |
| 4 | Ağırlıklar nerede yaşıyor | `weight_sets` versiyona snapshot. Değişiklik yeni set açar, eski skorlar sabit kalır |
| 5 | Aşama vs aktivite süresi | İkisi de var. Aşama tavan, aktivite kendi `think`/`answer` süresini taşır |
| 6 | Çoklu değerlendirici | Her değerlendiricinin kendi `evaluation` kaydı. Sessiz ortalama yok, ayrı ayrı gösterilir, karar sahibi belli |
| 7 | Rol farkı | `OWNER` (her şey) / `RECRUITER` (oluştur, davet et, puanla) / `REVIEWER` (sadece puanlar, silemez, dışa aktaramaz) |
| 8 | Zorunlu/opsiyonel aktivite | `activities.is_required`. Zorunlu boşsa aşama gönderilemez |
| 9 | Saklama süresi | Video 180 gün (karardan sonra), aday kaydı 24 ay (son temastan). Ayarlanabilir, gecelik silme işi, 7 gün yumuşak silme penceresi |
| 10 | Rıza versiyonlama | `consent_texts` tablosu versiyonlu, `consents` hangi versiyonun kabul edildiğini + zaman + IP tutar |
| 11 | Erişilebilirlik | Her video aktivitesinin açılabilir "yazılı alternatif"i var. Ayrıca transkriptten altyazı |
| 12 | Cihaz kontrolü başarısızsa | Sesli-yanıt veya yazılı yedek akış (yönetici açarsa) + "sorun bildir" düğmesi, yöneticinin kuyruğuna düşer |
| 13 | Builder'da önizleme | **Zorunlu özellik.** Yönetici gizli kriter yazarken adayın tam olarak ne gördüğünü ayrı sekmede görür |
| 14 | Bildirim | MVP'de panelde "Değerlendirme bekleyenler" kuyruğu. E-posta bildirimi mailer arayüzü hazır, sonra açılır |
| 15 | Anti-cheat dürüstlüğü | Sadece tarayıcının gerçekten raporladığı olaylar loglanır (aşağıda liste). İkinci ekran, telefon kullanımı, odadaki başka kişi gibi **tespit edilemeyen şeyler iddia edilmez** |
| 16 | Anti-cheat bildirimi | Giriş ekranında, başlamadan önce, açıkça yazılır |
| 17 | Hukuki dayanak | Değerlendirme için meşru menfaat, video kaydı için ayrıca açık rıza (istihdamda güç dengesizliği yüzünden tek başına rıza zayıf dayanak) |
| 18 | Aday hakları | Giriş sayfasında erişim/silme talebi bağlantısı, `deletion_requests` kuyruğu |
| 19 | Alt işleyiciler | OpenRouter ve ElevenLabs gizlilik bildiriminde listelenir |
| 20 | Aday kimlik doğrulama | Token tek kimlik. Tarayıcı değişse çalışır ama ilk açılışta cihaz parmak izi + IP loglanır, farklıysa yöneticiye rozet gösterilir. Engellemez, bildirir |
| 21 | Ölçek | Tek şirket, yılda 2000 adayın altı varsayımı. Cloud Run sıfıra ölçekleniyor |
| 22 | Yedekleme | Neon nokta-zaman geri yükleme (7 gün), R2 versiyonlama açık, haftalık şema dökümü |
| 23 | Audit | Video izleme, dışa aktarma, silme, karar değiştirme, link oluşturma kayda geçer |

**Loglanan teknik olaylar (gerçekten tespit edilebilenler):** `visibilitychange`, pencere
`blur`/`focus`, `fullscreenchange`, `MediaStreamTrack.onmute`/`onunmute` (kamera veya mikrofon
kapatıldı), `navigator.onLine` değişimi, sayfadan ayrılma, yükleme boşlukları.

---

## 9. Teknoloji seçimleri

| Katman | Seçim | Neden |
|---|---|---|
| Uygulama | Next.js 15 App Router + TypeScript, tek uygulama, `(manager)` ve `(candidate)` route grupları | Aday tarafı sunucu tarafında render edilip hızlı açılmalı, yönetici tarafı zengin istemci. İkisi tek kod tabanı |
| DB erişimi | Drizzle ORM | Bu şemada çok sayıda jsonb, kısmi indeks ve değişmezlik kısıtı var, ham SQL kontrolü lazım. Ayrıca serverless'ta ekstra motor ikilisi istemiyor |
| Veritabanı | Neon Postgres, Frankfurt | Ücretsiz katman (0,5 GB, 100 CU-saat/ay) metadata için fazlasıyla yeter, video DB'de durmuyor. Dallanma ile test veritabanı bedava |
| Depolama | Cloudflare R2, EU yargı ipucu, S3 uyumlu | 10 GB bedava, çıkış trafiği sıfır. `StorageProvider` arayüzü arkasında, Scaleway veya Hetzner'e geçmek konfigürasyon değişikliği |
| Hosting | Google Cloud Run `europe-west3` (Docker) | Sende zaten bu bölgede gcloud var, sıfıra ölçekleniyor, bölge açıkça AB. Vercel Hobby ticari kullanıma kapalı, Pro 20 USD/ay |
| Zamanlanmış işler | Cloud Scheduler -> korumalı `/api/cron/*` uçları | Ayrı worker konteyneri gerekmiyor, ücretsiz katmanda kalıyor. Dakikalık: süre aşımı kapatma. Günlük: saklama temizliği, link süresi |
| Kuyruk | `pg-boss`, aynı Postgres'te | Transkripsiyon ve toplu iş için. Ek altyapı yok |
| Yönetici auth | E-posta + parola (argon2id) + `OWNER` için zorunlu TOTP | Aday verisi ve video var, ikinci faktör pazarlık konusu değil |
| Aday auth | 32 baytlık rastgele token, DB'de sha256 hash'i | Tahmin edilemez, sıralanamaz. Hız sınırı var |
| UI | Tailwind + shadcn/ui, `dnd-kit` (builder sürükle-bırak) | Hızlı, erişilebilir tabanlı (Radix) |
| Form | react-hook-form + zod | Aynı zod şemaları sunucu doğrulamasında tekrar kullanılır |
| Çok dil | next-intl (panel), bilingual jsonb (aday içeriği) | Şablon içeriği veri, arayüz metni kaynak dosyası. İkisi farklı problem |
| AI | OpenRouter, `AiProvider` arayüzü arkasında | Model değiştirmek konfigürasyon. Yapılandırılmış çıktı zod ile doğrulanır |
| Transkripsiyon | ElevenLabs Scribe | Saatlik 0,22 USD, 90+ dil, kelime zaman damgası. Türkçe ve İngilizce ikisi de kapsamda |
| E-posta | `Mailer` arayüzü. MVP: `OutboxMailer` (yaz + panelde kopyala) | Şimdi manuel, sonra Resend'e geçmek tek satır |
| Test | Vitest (birim) + **Claude in Chrome** (uçtan uca, gerçek tarayıcıda) | Kritik olanlar: süre matematiği, skor hesabı, versiyon değişmezliği. Uçtan uca akış gerçek Chrome'da sürülür, Playwright kullanılmaz |

**Kod dili İngilizce** (değişken, fonksiyon, dosya, yorum, commit). Kullanıcıya giden metinler
TR ve EN.

---

## 10. Geliştirme fazları

### Faz -1 - TASARIM (ilk iş, koddan önce)

Kod yazılmadan önce Claude Design canvas'ında 12 artboard çizilir. Onaylanmadan Faz 0'a
geçilmez.

**Tasarım dili:** `github.com/sucreistaken/airbnb-UI-UX-pattern` deposundaki 12 bölümlük
pattern kütüphanesinden **yapısal** ilkeler alınır, Airbnb'nin rengi ve tipografisi kopyalanmaz.
Alınacak beş ilke:

1. **Tek vurgu rengi, cimri kullanım.** Marka rengi sadece birincil CTA, aktif durum ve süre
   sayacında. Kart kenarlığı, arka plan bloğu, ikincil buton asla renkli değil. Geri kalan
   nötr gri/siyah/beyaz. Bir ekranda tek dolu buton olur
2. **İçerik önde, krom geride.** Adayın videosu ve cevabı ekranın en canlı unsuru;
   arayüz onunla yarışmaz
3. **Kademeli açma.** Önce az bilgi, "daha fazla göster" isteğe bağlı. Yöneticinin iç
   kriterleri katlanmış durur, aday tarafı zaten hiç görmez
4. **Erken doğrulama > sonradan kurtarma.** Cihaz kontrolü kayıttan önce, süresi dolmuş
   link daha açılışta söylenir, zorunlu alan boşken "gönder" düğmesi neden pasif olduğunu
   söyler. "Hata verip geri gönder" en son çare
5. **Otomasyon her zaman insan kapısıyla gelir.** AI önerisi kendiliğinden uygulanmaz;
   her öneri kartında kabul/düzenle/sil var. Veri yetmiyorsa AI kötü öneri vermek yerine susar

Ek olarak "hiçbir sayfa çıkmaz sokak olmaz": boş aday listesi, sıfır sonuçlu filtre,
tamamlanmış değerlendirme, hepsi bir sonraki somut adımı gösterir.

**Çizilecek 12 artboard**

Yönetici (7):
1. Dashboard - bekleyen işler kuyruğu, süresi dolan linkler, değerlendirme bekleyenler
2. Şablon builder - aşama/aktivite ağacı, sürükle-bırak, iç içerik vs aday içeriği ayrımı
3. AI builder - ilan yapıştır, öneri kartları, madde madde kabul/düzenle/sil
4. Aday tablosu - filtreler, arama, durum, skor, karar
5. **İnceleme ve puanlama** - solda video + transkript, sağda yapışkan puanlama paneli
6. Karşılaştırma tablosu - yetkinlik x aday, sıralanabilir
7. Aday detay - deneme geçmişi, aşama aşama cevaplar, karar

Aday (5):
8. Giriş sayfası - pozisyon, süreç, kayıt bildirimi, rıza, başla
9. Cihaz kontrolü - kamera önizleme, mikrofon seviyesi, deneme kaydı
10. Video aktivitesi - soru, düşünme süresi, kayıt durumu, geri sayım, yükleme göstergesi
11. Yazılı aktivite - soru, karakter sayacı, otomatik kayıt işareti, geri sayım
12. Tamamlandı - teşekkür, ne olacağı, veri hakları bağlantısı

Aday tarafı sakin, minimal ve az bileşenli; yönetici tarafı bilgi yoğun ama net hiyerarşili.
Her artboard TR metinle çizilir (EN karşılığı uygulamada i18n dosyasından gelir).

**Kim yapıyor:** Tasarımı Kadir kendisi Claude Design'da yapıyor. Ben kısa prompt'u veriyorum,
canvas hazır olunca URL'yi alıp artboard'ları oradan çekiyorum ve kodlarken referans alıyorum.

**Bitti sayılır:** 12 artboard canvas'ta duruyor, onaylanıyor, canvas URL'si bana veriliyor.
Bundan sonra kod fazları başlar.

### Faz 0 - İskelet (3-4 gün)
Repo, Docker, Drizzle şeması ve ilk göç, yönetici auth + TOTP, next-intl TR/EN iskeleti,
Cloud Run'a deploy hattı, R2 bucket ve presigned URL denemesi, Neon bağlantısı.
**Bitti sayılır:** boş uygulama Cloud Run'da açılıyor, giriş yapılıyor, R2'ye test dosyası inip çıkıyor.

### Faz 1 - Kütüphaneler (1 hafta)
Pozisyon CRUD, yetkinlik kütüphanesi, puan skalaları ve seviye tanımları (BARS),
gözlem etiketleri, kriter tekrar kullanımı.
**Bitti sayılır:** "İletişim" yetkinliği 5 seviyesi yazılı tanımlı ve 7 gözlem etiketiyle duruyor.

### Faz 2 - Şablon builder (1,5 hafta)
Aşama ve aktivite CRUD, sürükle-bırak sıralama, iç içerik / aday içeriği ayrımı,
sekiz aktivite tipinin editörleri, süre ayarları, yayınlama ve versiyonlama (değişmezlik trigger'ı),
**aday önizleme sekmesi**.
**Bitti sayılır:** 4 aşamalı bir şablon yayınlanıyor, v2 açılıyor, v1 hiç değişmiyor.

### Faz 3 - AI builder (1 hafta)
İlan yapıştır -> şemalı taslak, madde madde kabul/düzenle/sil/sırala, `ai_runs` kaydı,
zod doğrulama ve onarım denemesi.
**Bitti sayılır:** gerçek bir ilan metninden 4 aşamalı taslak çıkıyor ve düzenlenip yayınlanıyor.

### Faz 4 - Aday akışı (1,5 hafta)
Link üretimi ve durumları, giriş sayfası, rıza, aday bilgi formu, cihaz kontrolü,
süreli aşamalar, sunucu otoriter timer, tüm aktivite tipleri, otomatik taslak kaydı,
tekrar gönderim engeli, geri navigasyon ayarı.
**Bitti sayılır:** bir link uçtan uca dolduruluyor, F5 süreyi ne sıfırlıyor ne uzatıyor.

### Faz 5 - Video hattı (1,5 hafta)
Parçalı kayıt ve eşzamanlı yükleme, kopma ve devam, codec geri düşüşü, kısmi kayıt kurtarma,
presigned oynatma, ElevenLabs transkripsiyon kuyruğu, kelime zaman damgalı oynatıcı.
**Bitti sayılır:** gerçek bir iPhone'da 3 dakikalık video kaydediliyor, çökmüyor,
transkripti çıkıyor.

### Faz 6 - Değerlendirme (1,5 hafta)
Yan yana inceleme ekranı, klavye kısayolları, otomatik kayıt, yetkinlik puanlama,
gözlem etiketleri, ağırlıklı genel skor, ayrı bilgi skoru, AI değerlendirme özeti.
**Bitti sayılır:** bir aday 4 aşama boyunca sayfa değiştirmeden puanlanıyor.

### Faz 7 - Karar ve karşılaştırma (1 hafta)
Aday tablosu, filtreler, arama, karşılaştırma tablosu ve sıralama, karar durumları,
retake talebi ve kapsam seçimi, attempt taşıma, primary attempt seçimi.
**Bitti sayılır:** iki aday karşılaştırılıyor, birine aşama bazlı retake veriliyor,
eski deneme duruyor.

### Faz 8 - Uyum ve sertleştirme (1 hafta)
Teknik olay loglama ve görüntüleme, audit log, saklama temizliği işi, aday hakları akışı,
gizlilik metinleri (TR/EN), hız sınırı, güvenlik testleri, Playwright uçtan uca senaryolar.
**Bitti sayılır:** doğrulama bölümündeki her madde geçiyor.

---

## 11. Doğrulama

**Birim testleri (Vitest)**
- Timer: yenileme, saat kayması, gecikmeli istek, `deadline_at` sonrası yazma reddi
- Skor: ağırlıksız ortalama, ağırlıklı ortalama, eksik puan, bilgi skorunun ayrı kalması
- Versiyon değişmezliği: v2 yayınlandıktan sonra v1'e bağlı bir `assessment`'ın render edilen
  içeriği bit bit aynı kalıyor
- Retake taşıma: `PARTIAL` attempt'ta taşınan aşamaların yanıtları doğru okunuyor

**Uçtan uca (Claude in Chrome, gerçek tarayıcıda)**

Playwright kullanılmaz. Akışlar gerçek Chrome oturumunda sürülür; kamera ve mikrofon izinleri,
gerçek MediaRecorder davranışı ve konsol/ağ kayıtları böylece gerçek koşulda görülür.

1. Aday: link aç -> rıza -> bilgi -> cihaz kontrolü -> 4 aşama (video + yazılı + çoktan seçmeli
   + dosya) -> gönder. Kayıt sırasında `read_network_requests` ile parça yüklemelerinin
   gerçekten aktığı doğrulanır, `read_console_messages` ile MediaRecorder hataları izlenir.
   Chrome'un fake device bayrağı (`--use-fake-device-for-media-stream`) ile kamera simüle edilir
2. Yönetici: giriş -> adayı aç -> 4 aşamayı puanla -> genel skor doğru -> karar ver ->
   karşılaştırma tablosunda görün. Kritik akışlar `gif_creator` ile kaydedilir, regresyon
   karşılaştırması ve dokümantasyon için saklanır
3. Güvenlik: A adayının token'ıyla B adayının medyası okunamıyor, presigned URL süresi doluyor,
   `internal_*` alanları aday API yanıtlarının hiçbirinde geçmiyor (ağ sekmesinde yanıt
   gövdelerinde string araması)

Not: tarayıcı diyalogları (`alert`, `confirm`) uygulamada kullanılmayacak, çünkü hem kötü UX hem
de otomasyonu kilitliyor. Onay gerektiren yerlerde satır içi onay deseni kullanılır.

**Elle doğrulama (otomatikleştirilemeyen, ama en riskli olan)**
- Gerçek bir iPhone Safari'de 3 dakikalık video cevabı. Araştırmanın ortaya çıkardığı somut risk
- Gerçek bir Android Chrome'da aynı senaryo
- Zayıf bağlantıda (throttle) yükleme davranışı

**Uyum kontrolü**
- Ürünün hiçbir yerinde AI'nın adayı puanladığı, sıraladığı veya duygusunu okuduğu bir özellik
  veya metin yok
- Rıza metni versiyonu kaydediliyor, silme işi gerçekten siliyor (R2 nesnesi dahil)

---

## 12. Brief kapsam kontrolü

Brief'in 32 bölümü ve 32. bölümdeki 25 maddelik blueprint listesi tek tek karşılandı.

| Brief bölümü | Nerede karşılandı |
|---|---|
| 1 Ürün konsepti | Context |
| 2 Roller | 7F, boşluk #7 (OWNER/RECRUITER/REVIEWER + aday hesapsız) |
| 3 Pozisyon yönetimi | Veri modeli, Faz 1 |
| 4 AI destekli builder | Bölüm 6, Faz 3 |
| 5 Şablon builder | Veri modeli, Faz 2, 7B sitemap |
| 6 Aşama zaman yönetimi | Bölüm 3 (Timer), 7F zaman aşımı davranışları |
| 7 Aday akışı | 7C aday yolculuğu, artboard 8 |
| 8 Aday bilgileri | 7C, aday API `info` |
| 9 Benzersiz linkler | 7F link durumları, `assessment_links` |
| 10 Soru görünürlüğü (iç/dış ayrım) | Veri modeli "İçerik ayrımı", `candidateSafe()`, 7E akış |
| 11 Video kayıt | Bölüm 5 |
| 12 Anti-cheat / loglama | Boşluk #15, #16, teknik olay listesi |
| 13 Aşama navigasyonu | `stages.back_navigation`, varsayılan kapalı |
| 14 Retake | Bölüm 4 |
| 15 Değerlendirme sistemi | Bölüm 7, Faz 6 |
| 16 Değerlendirme nesneleri (gözlem etiketleri) | `evaluation_options`, 7A hazır kütüphane |
| 17 Özel kriterler | `competencies` + `rating_scales` + `scale_levels`, Faz 1 |
| 18 Aday karşılaştırma | Faz 7, `/compare`, artboard 6 |
| 19 Genel değerlendirme ve ağırlık | `weight_sets`, boşluk #4, varsayılan kapalı |
| 20 Yönetici kararı | 7F karar durumları |
| 21 AI özet (opsiyonel) | Bölüm 6, kullanım #3 (sadece yöneticinin kendi girdisinden) |
| 22 Dashboard | Artboard 1, 7A altın yol |
| 23 Aday tablosu | Artboard 4, `/candidates` |
| 24 Aday detay sayfası | Artboard 7, `/candidates/[id]` |
| 25 Video inceleme deneyimi | Bölüm 7, artboard 5 |
| 26 Gizlilik ve güvenlik | Bölüm 9 stack, boşluk #9-#19, 7D yetkilendirme |
| 27 Veritabanı yapısı | Bölüm 2 |
| 28 Teknik mimari | Bölüm 9 |
| 29 MVP | Faz 0-8, hepsi kapsamda |
| 30 UX ilkeleri | Faz -1 tasarım dili, 7A no-brainer |
| 31 Ürün farklılaştırıcı | Context, bölüm 6 (AI karar vermiyor) |
| 32 İstenen 25 çıktı | 1-2 Context/7F, 3-4 7C, 5 7B, 6-7 7B+Faz -1, 8 Faz 2, 9 Bölüm 6, 10 7C, 11 Bölüm 5, 12 Bölüm 3, 13 Bölüm 4, 14-15 Bölüm 7, 16 Faz 7, 17 Bölüm 2, 18 7D, 19 Bölüm 9, 20 boşluk #9-19, 21 Bölüm 9, 22 Bölüm 5, 23 Faz 0-8, 24 Bölüm 13, 25 Bölüm 10, veri akışı 7E |

Brief'te olup **bilinçli olarak MVP dışına alınan** tek şey yok. 20 maddelik MVP listesinin
tamamı fazlara dağıtıldı.

---

## 13. Sonraki faz (MVP dışı)

Otomatik e-posta gönderimi ve hatırlatma, ATS entegrasyonu, canlı mülakat, aday havuzu,
gelişmiş analitik (dönüşüm hunisi, aşama bazlı düşme oranı), çoklu organizasyon (SaaS),
şablon pazar yeri, aday geri bildirim anketi.
