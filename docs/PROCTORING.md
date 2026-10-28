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
| Sekme/uygulama değişimi | `visibilitychange`, 2 sn toleranslı pencere `blur`, 500 ms'lik `document.hasFocus()` yoklaması (`leave-detector.ts`) | yüksek, ama ikinci cihaz görünmez |
| İkinci ekran | `screen.isExtended` + `change` | yalnızca Chromium; aynalama, HDMI bölücü görünmez |
| Kopyala/yapıştır/sağ tık/kısayol | olay engelleme + kayıt | işletim sistemi kısayolları engellenemez, sadece fark edilir |
| Tek seferde uzun metin | `beforeinput insertText` > 30 karakter | orta |
| Çeviri/yazım eklentisi | DOM'a enjekte edilen işaretler | düşük, bilinen eklentiler |
| İkinci sekme | `BroadcastChannel` + sunucuda eşzamanlı oturum | orta |
| Yüz yok / birden fazla kişi | MediaPipe FaceLandmarker, 2 fps, histerezis; birden fazla kişi ayrıca EfficientDet "person" (2 sn'de bir; zayıf, minik ve iç içe kutular sayılmaz) ve 2 sn'lik pencerede karelerin %60'ı (2026-10-29) | iyi ışıkta iyi; arkası dönük ya da yarım görünen ikinci kişi artık gövdeden sayılır |
| Bakış | baş açısı + göz blendshape'leri, yazarken aşağı bakış muaf | gürültülü, düşük ağırlık, canlı uyarı yok |
| Telefon | EfficientDet "cell phone", 3 karede 2 | kamera açısındaysa; kadraj dışı telefon görünmez |
| Konuşma sesi | bant enerjisi + spektral düzlük, sessizlik kalibrasyonu; 1,5 sn'lik pencerede örneklerin %60'ı (heceler arası boşluk kesmez), taban son 30 sn sürekli yüksek kalırsa yükselir, kalibrasyonun altına inmez (2026-10-29) | orta; konuşma ve dinleme sırasında kapalı; sürekli açık TV/klima bir kez işaretlenir, sonra susar |

Kanıt: başlangıç (kimlik için göz karşılaştırması) karesi, periyodik kamera (30 sn) ve
ekran (45 sn) kareleri, her ihlalde anlık kareler, ve 2026-10-14'ten beri **sınavın
tamamının kaydı** (aşağıda "Sürekli kayıt"). İhlal klipleri ayrıca yazılmadı; kayıtta
işaretin anına atlamak onların yerini tutuyor.

## Sekmeden ve pencereden ayrılma

`src/lib/proctor/leave-detector.ts` (saf, testli) neyin kaydedildiğine ve neyin büyük
uyarıyı ("Sınav sekmesinden ayrıldınız") açtığına karar verir; motor tarayıcı
olaylarını ona verir. 2026-10-19'da yanlış uyarılar üzerine yeniden yazıldı:

- **Yalnız pencerenin kendi `blur`/`focus` olayları.** Eskiden dinleyici capture
  aşamasındaydı: sayfa içinde bir alanın odağı bırakması (metin kutusundan okuma
  metnine tıklamak, bir şıktan boş yere tıklamak) da pencereden geçiyordu, 2 sn sonra
  `FOCUS_LOST` başlıyor, sonraki tıklamada öğrenci hiç çıkmadan uyarı açılıyordu.
  Chrome'da bir test sayfasıyla gösterildi (eski mantık uyarı verdi, yenisi hiçbir şey
  kaydetmedi) ve gerçek sınav sayfasında aynı tıklamalar artık olay üretmiyor.
- **Kendi pencerelerimiz ayrılma değildir.** Ekran paylaşımı seçicisi, tam ekran,
  kamera izni ve ekranlar izni açıkken ve kapandıktan sonraki 2,5 sn içinde başlayan
  odak kaybı sayılmaz; odak bundan sonra da dönmezse uyarısız kaydedilir
  (`meta.afterPrompt`).
- **Girdi olmadan gelen kayıp uyarı açmaz.** Bilerek ayrılmak sayfa içinde bir girdiyle
  başlar (fare tam ekran sayfanın üstünden geçer, Cmd/Alt/Win basılır). Son girdiden
  10 sn'den uzun sonra gelen kayıp (ekranın uyuması, kendiliğinden öne gelen bir arama
  ya da güncelleme penceresi) kaydedilir ama uyarı açmaz. Her olayda
  `meta.inputGapMs` öğretmene bu boşluğu söyler. Kalan risk: 10 sn hiç dokunmadan
  dört parmakla başka masaüstüne geçen biri uyarı görmez, olay ve ekran karesi yine
  kaydedilir.
- **Kaçan olaylar.** 500 ms'de bir `document.hasFocus()` okunur: gelmeyen `focus`
  ya da `visible` olayının açık bıraktığı kaydı kapatır, gelmeyen `blur`'u yakalar.
  Eski kodda art arda iki `blur` bir zamanlayıcıyı kaybettiriyor, uyarı öğrenci
  döndükten sonra açılabiliyordu.
- **Ekran uyumaz.** Sınav boyunca Screen Wake Lock tutulur (sekme gizlenince tarayıcı
  bırakır, dönüşte yeniden istenir). Reddedilirse uyuyan ekran yukarıdaki kuralla
  uyarısız kaydedilir.
- **Çeviri teklifi kapalı.** `/a/*` sayfaları `<meta name="google" content="notranslate">`
  taşır: Chrome Almanca sınava çeviri balonu açmaz.

## Başka bir yerde ekran paylaşımı (Meet, Zoom)

Bir web sayfası, ekranının başka bir uygulama ya da sekme tarafından da
yakalandığını öğrenemez. Capture Handle yalnız yakalayan tarafa bilgi verir, Chrome
yakalanan sayfaya söylemez (developer.chrome.com/blog/capture-handle). Sınav sekmesi
tam ekranda ve odakta kaldıkça Meet'in arka plandaki paylaşımı hiçbir olay üretmez.
Yapılanlar:

- Giriş ekranı kuralı: görüntülü görüşmede olmamak, ekranı başka uygulamada
  paylaşmamak (`exam.proctoredNoCalls`).
- Gözetim mikrofonunda yankı iptali kapalı: yankı iptali hoparlörden çalınanı
  mikrofondan siler, bir görüşmedeki yardımcının sesi de buna dahil. Artık konuşma
  sesi algılaması bu sesi duyar (kulaklıkla gelen sesi duyamaz).
- AI ikinci bakış ekran karelerinde ikinci bir "ekranınızı paylaşıyor" çubuğunu
  (meet.google.com gibi başka bir siteyi adlandıran) ve görüşme pencerelerini sınav dışı
  içerik sayar. **Doğrulanmadı:** Chrome'un paylaşım çubuğunun tüm ekran kaydında
  görünüp görünmediği. Bir kez elle denenmeli (Meet'te tüm ekranı paylaş, sonra
  sınavda paylaş, kayıtta iki çubuk var mı). Görünüyorsa, işaret beklemeden periyodik
  ekran karelerine bakan bir tarama eklemek anlamlı olur (yeni olay türü, göç ve
  maliyet kararı).

## Sürekli kayıt

Gözetimli bir sınav silahlandığı andan (sistem kontrolünden sonra) bitene kadar
kaydedilir: politika kamerayı izliyorsa kamera ve mikrofon (`policy.camera`, ses
`policy.microphone` ile), ekranı paylaştırıyorsa ekran (`policy.screenShare`).
STANDARD yalnız kamera+ses, STRICT kamera+ses+ekran kaydeder. Yeni izin istenmez:
motorun zaten tuttuğu akışlar kullanılır. **Yalnız öğrencinin kabul ettiği onay metni
kaydı söylüyorsa** (aşağıda "Onay metni"); oturum cevabındaki `recording` alanı
tarayıcıya bunu söyler, yükleme ucu da ayrıca kontrol eder. Kayıt sürerken sınavın
üst çubuğu ne kaydedildiğini yazar ("Kamera ve ses kaydediliyor", STRICT'te "Kamera,
ses ve ekran kaydediliyor").

**Tarayıcı** (`src/lib/client/proctor/recording.ts`). Her tür için motorun izinin bir
klonu küçültülür (kamera 640x360, 10 fps; ekran en çok 1280x800, 2 fps; modeller ve
kareler tam çözünürlükte kalır) ve kendi `MediaRecorder`'ı ile kaydedilir. Her 15 sn'de
yeni bir kaydedici açılır, sonra eskisi kapatılır: her parça (segment) **kendi başına
oynayan tam bir dosyadır** (WebM VP8+Opus; Safari'de MP4), geçişte birkaç ms örtüşme
olur, boşluk olmaz. Parça kesimi hem zamanlayıcıyla hem kaydedicinin kendi 1 sn'lik
vuruşuyla tetiklenir (gizli sekmede zamanlayıcılar dakikada bire düşebilir). Kare
içermeyen dosyalar (yalnız başlık, ~110 bayt) yüklenmez. Parçalar sırayla, tek tek
yüklenir (`recording-queue.ts`): bağlantı yoksa artan aralıkla yeniden denenir
(1, 2, 4, 8, sonra 15 sn; parça başına en çok 60 deneme), kuyruk 48 MB'ı aşarsa en eski
bekleyen parça düşer. Sunucu kalıcı reddederse (4xx) parça bırakılır. Sınav bitince
(`engine.stop()`) son parçalar kesilir, izler kapanır; son ekran kuyruğun boşalmasını
en çok 60 sn bekler (`engine.drainRecording`) ve o sürece "Kayıt gönderiliyor, lütfen
bu sekmeyi kapatmayın (n parça)" der. Süre dolarsa kalan parçaların bağlantı gelince
gönderileceğini söyler; kuyruk sekme açık kaldıkça boşalmaya devam eder, bitince
"Sınav kaydı gönderildi" yazar. Sayfa yenilenirse ya da kamera kopup geri gelirse yeni
bir "run" başlar; aradaki süre kayıtta boşluk olarak görünür.

**Kuyruk yalnız sekmenin belleğindedir.** Kopan bağlantı yalnız kuyruğu uzatır; ama
yenilenen, kapatılan ya da çöken sekme o an kaydedilen parçayı ve kuyrukta bekleyen her
şeyi kaybeder (kötü bağlantıda 48 MB'a kadar, yaklaşık 10 dakika). Bunu sessiz olmaktan
çıkarmak için bekleyen parça varken sayfadan çıkmak ya da yenilemek tarayıcının kendi
"sayfadan ayrılınsın mı?" sorusunu açar (`guardUnload`). Parçalar IndexedDB'de
saklanıp yeniden yüklenmiyor: öğrencinin görüntüsü ve sesi, okulun saklama ve silme
kurallarının dışında, çoğu zaman paylaşılan bir laboratuvar bilgisayarının tarayıcısında
kalırdı. Bu bir ürün ve hukuk kararı; verilmeden eklenmedi.

**Sunucu.** `PUT /api/c/[token]/proctor/recording`: kanıt ucuyla aynı token, politika
ve deneme kontrolleri; kabul edilen onay metni kaydı söylemiyorsa gövde okunmadan 403
`CONSENT_REQUIRED` (tarayıcı yeniden denemez); kapsayıcı ilk baytlardan doğrulanır (WebM EBML, MP4 `ftyp`),
depolama anahtarı sunucuda türetilir
(`proctor/<org>/<assessment>/rec/<attempt>/<tür>-<run>-<sıra>.webm`), aynı parçanın
tekrarı aynı satıra düşer. Deneme bittikten sonra 15 dk daha parça kabul edilir (son
parça ve çevrimdışı kalan kuyruk için), sonra 409. Parça sınırı 16 MB (aşağıdaki
taşma ölçümü yüzünden geniş tutuldu). Tablo: `proctor_recordings` (deneme, tür
CAMERA|SCREEN, run, sıra, başlangıç, süre, boyut, anahtar, `purge_after`).

**Panel.** Öğrenci sonucu > Bütünlük sekmesinde "Sınavın kaydı": kamera ve ekran yan
yana, tek saat; altta bölüm sınırları, gözetim işaretleri (tıklayınca o anın 3 sn
öncesine gider), kaydın olduğu yerler, 1x/2x/4x. Her işaretin yanında "Kayıtta izle".
Parçalar `GET /api/panel/recordings/[id]` üzerinden akar: oturum + `media:view`
yetkisi + kendi kurumu her istekte kontrol edilir, Range desteklenir; imzalı ya da
herkese açık URL yok. İlk oynatmada denetim kaydına `media.view` yazılır (kişi ve
deneme başına yarım saatte bir).

Oynatma yolu: **parçaları sırayla oynatmak** (her bölmede iki `<video>`; biri oynarken
öteki sıradakini yükler, sınırda yer değiştirir), MediaSource değil. Gerekçe: her parça
tam bir dosya olduğu için kodek dizgisi gerekmez, WebM ve MP4 aynı yoldan oynar, bozuk
ya da eksik bir parça yalnız kendi 15 sn'sini kaybettirir. MediaSource "sequence"
kipinde boşlukları kapatır ve ilk kayıp parçadan sonra kamera, ekran ve işaretler
birbirinden kayardı. Saat sınavın duvar saatidir; bir bölmenin o an kaydı yoksa
"kayıt yok" yazar, iki bölmede de yoksa oynatma sıradaki kayıtlı ana atlar.

**Saklama.** Her parça `purge_after = başlangıç + min(organizations.evidence_retention_days, 30)`
ile yazılır: kayıt, kanıt süresini (varsayılan 90) hiç aşmaz ve en çok 30 gün kalır
(`MAX_RECORDING_RETENTION_DAYS`). `purge-retention` işi süresi geçen parçaları önce depodan,
sonra satırdan siler, deneme başına bir `retention.recording.purge` denetim satırı
yazar. Diğer silmeler gibi iki anahtar ister (`RETENTION_PURGE_ENABLED=true` ve
`?apply=1`); yoksa yalnız rapor verir. `?batch=` verilmezse 2000'lik turlarla biter
(bir sınav saati ~480 parça). Aday kalıcı silinirken (`src/lib/retention.ts`) kayıt
parçaları ve kareler de depodan silinir, satırlar cascade ile gider.

**Onay metni.** Sürüm 1 yalnız "aralıklarla kareler" diyordu. Sürüm 2 sınavın tamamının
kaydedildiğini söyler (`src/db/consent-text.ts`); `*_exam_consent_recording.sql`
göçü, en yeni sınav metni değiştirilmemiş sürüm 1 olan kurumlara sürüm 2'yi ekler.
Giriş ekranındaki maddeler de kaydı söylüyor.

Davet, kabul edildiği metinde kalır. Bu yüzden kayıt **kabul edilen metne** bağlı:
`consent_texts.covers_recording` (`*_consent_covers_recording.sql` göçü, metni harfi
harfine güncel metin olan her satırı işaretler; seed ve üretim kurulumu yazarken
işaretler). Sürüm numarasına bakılmaz: numara kurum başına sayılır ve yeni bir kurum
güncel metinle sürüm 1'den başlar. Eski metni kabul etmiş bir öğrenci kaydedilmez
(tarayıcı başlatmaz, sunucu parça kabul etmez); panelde Bütünlük sekmesi "Bu öğrenci
kayıt içermeyen eski onay metnini kabul etti" der. Böyle bir öğrenciye yeniden onay
sordurmak yok; gerekirse ayrı karar.

### Depolama tahmini (öğrenci-saat başına)

Hedef bit hızlarından (`RECORDING_PROFILE`):

| | Bit hızı | Saat başına |
|---|---|---|
| Kamera + ses (10 fps) | 150 + 16 kbit/sn | ~75 MB |
| Ekran (2 fps) | 150 kbit/sn | ~68 MB |
| STANDARD (yalnız kamera) | | **~75 MB** |
| STRICT (kamera + ekran) | | **~143 MB** |

Örnek: 64 dakikalık yerleştirme şablonu, STRICT, 30 öğrenci ≈ 30 x 1,07 sa x 143 MB ≈
**4,6 GB** tek bir grup için; 30 gün saklama ve haftada bir grup ≈ 4-5 grup ≈
**20-23 GB**. Bağlantı: öğrenci başına sürekli ~0,17 (STANDARD) ile ~0,32 (STRICT)
Mbit/sn yükleme; 30 kişilik bir laboratuvarda okulun çıkışı ~5-10 Mbit/sn.

2026-10-14 maliyet düşürmesi: önceki profil (kamera 15 fps 250+32 kbit/sn, ekran 5 fps
400 kbit/sn, 90 gün) aynı örnekte grup başına ~10 GB ve toplam ~130 GB tutardı.

Chrome'da ölçülen (2026-10-14, sentetik kaynak, gerçek kamera değil): düzgün bir
640x360 sahne VP8'de ~110-120 kbit/sn (hedefin altında); metin dolu 1280x800 ekran
5 fps'de ~350 kbit/sn. **Bit hızı tavan değil hedeftir**: her karesi rastgele gürültü
olan bir kaynakta VP8 250 kbit/sn hedefle 4,9 Mbit/sn (VP9 3,6) üretti, yani parça
başına ~9 MB. Gerçek bir kamera buna yaklaşmaz ama karanlık ve gürültülü bir görüntü
tahmini birkaç katına çıkarabilir. Gerçek cihazlarla ölçülmedi.

### Risk: üretim deposu VM diski

Üretimde R2 yok; kayıtlar `STORAGE_ALLOW_LOCAL=true` ile VM diskine
(`/var/lib/kademe/storage`) yazılıyor. Konuşma cevapları, gözetim kareleri ve dinleme
sesleri de aynı diskte. Disk dolarsa yeni parçalar 5xx alır, tarayıcı kuyruğu dolup
eski parçaları düşürür, **ve konuşma cevaplarının yüklenmesi de durur**. Kullanmadan
önce: VM'de `df -h /var/lib/kademe/storage` ile boş alanı görün, beklenen grup
sayısıyla yukarıdaki tabloyu karşılaştırın, disk doluluğu için bir uyarı kurun; çok
grup varsa R2 kararını öne alın ya da kanıt saklama süresini kısaltın. Saklama işinin
üretimde gerçekten silme yapıp yapmadığı (iki anahtar) bu oturumda doğrulanmadı;
yapmıyorsa kayıtlar hiç silinmez.

## AI ikinci bakış

Şüpheli olayın kareleri Gemini vision'a gider (`src/server/proctor-review-job.ts`).
Model yalnızca görülen olguları söyler: kaç kişi, yüz görünüyor mu, cihaz var mı, ekranda
sınav dışı içerik var mı. **Duygu, niyet, kimlik, yaş, cinsiyet çıkarımı istemde açıkça
yasaktır** (AB Yapay Zeka Yasası, eğitimde duygu tanıma yasağı). Modelin kararı kendi
bildirdiği olgularla çelişirse UNCLEAR'a düşürülür. Deneme başına bütçe var.

Bir işaret yalnız iddiasını gösterecek kare alınıyorsa kuyruğa girer
(`src/lib/proctor/review-gate.ts`): ekran iddiaları (TAB_HIDDEN, FOCUS_LOST,
SECOND_SCREEN_DETECTED) yalnız ekran paylaşılıyorsa, kişi iddiaları (NO_FACE,
MULTIPLE_FACES, PHONE_DETECTED) yalnız kamera açıksa. Bütçeden yalnız model çağrısı
yapmış ya da yapacak incelemeler (QUEUED, DONE, FAILED) düşer; SKIPPED biten (o an için
kare yok, vision modeli yok) bütçeyi sonraki işaretlere bırakır. Kalan risk: STRICT'te
çok sayıda gerçek ekran işareti (ör. sık FOCUS_LOST) bütçeyi yine bitirebilir; kişi
iddialarına ayrılmış pay yok.

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
- Kareler ve klipler `organizations.evidence_retention_days` (varsayılan 90) sonrası
  için `purge_after` ile yazılır ve `purge-retention` işi süresi geçenleri önce depodan,
  sonra satırdan siler (`purgeEvidence`, deneme başına bir `retention.evidence.purge`
  denetim satırı; aynı iki anahtar). Sürekli kaydın parçaları en çok 30 günle aynı iş
  tarafından silinir (yukarıda).

## Test

Otomasyon sekmesinde kamera ve gerçek tam ekran yoktur. Geliştirmede
`PROCTOR_DEV_FAKE=1` sunucu tarafından açılır (üretimde asla; `.env`'e yazılmaz, yalnızca
dev sunucusunun kabuğunda verilir ve iş bitince bayraksız yeniden başlatılır): sahte kamera/ekran
akışı, yüz sayısı `window.__proctorDev.setFaces(n)`, olaylar `__proctorDev.emit(type)`.
Gerçek cihaz ve tarayıcı matrisi elle denenmeli (STATUS.md'deki liste).

Sürekli kayıt (2026-10-14): `PROCTOR_DEV_FAKE=1` ile (yalnız kabukta) Chrome'da bir
STRICT sınav uçtan uca koşuldu: kamera ve ekran parçaları 15 sn'de bir yüklendi, iki
yeniden yüklemede yeni run başladı, bitişte son parçalar (4,4 ve 4,0 sn) geldi. Panel
oynatıcısı aynı parçalarla görünür bir pencerede denendi: iki bölme aynı saatte oynadı,
15 sn sınırında hazır bekleyen elemana geçti, parça ortasına atlama (WebM, cue yok)
çalıştı, kayıtsız aralık atlandı, 4x, işaret ve "Kayıtta izle" atlamaları çalıştı.
Sahte kamera `requestAnimationFrame` ile çizdiği için otomasyon sekmesi arka plandayken
kare üretmedi ve kare içermeyen parçalar oluştu (bu yüzden artık yüklenmiyorlar).
Gerçek kamera, gerçek ekran paylaşımı, Safari/MP4 ve uzun (1 sa+) bir sınav denenmedi.
