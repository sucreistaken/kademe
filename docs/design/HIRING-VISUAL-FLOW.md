# Kademe İşe Alım: görsel akış planı ("Airbnb gibi")

Sürüm 3, 2026-10-05 (sürüm 1 aynı gün, telefon öncelikliydi; sürüm 2 kullanıcı kararlarıyla
masaüstüne döndü; sürüm 3 yönetici panelini ekledi, K7). Yazan: Sally (bmad UX designer) + `airbnb-ux` skill'i (Redesign modu).
Bu bir tasarım planıdır: uygulama kodu değişmedi. Mockup:
`/private/tmp/claude-501/-Users-sucreistaken-Desktop-Projects-recruitement/8546a935-34ac-48f1-8695-daba2a52b158/scratchpad/visual-flow-mockup.html`
(geçici scratchpad dosyası; kalıcı olsun istenirse `docs/design/` altına kopyalanmalı).

**Kullanıcının isteği:** "Burada çok metin olunca insan ne yapacağını bilmiyor. Airbnb'nin mobil ve
site akışı gibi olsun: biraz görsellik, en sade insanın bile anlayacağı akış."

## 0. Kullanıcı kararları 2026-10-05

Kullanıcı sürüm 1'in mockup'ını Chrome'da gördü ve şunlara karar verdi (koordinatör üzerinden iletildi):

| # | Karar | Bu belgedeki karşılığı |
|---|---|---|
| K1 | **Çizimler: evet, önerildiği gibi sınırlı.** Yalnızca karşılama, onay, cihaz izni, bitti, sorun ekranları ve "bilgisayardan aç" ekranı; soru ekranlarında asla. Doygun accent çizimde yok, yalnızca açık tonlar. | 2.2. `HIRING-UX.md` 8.6 "İllüstrasyon yok" bu belgeyle **yerine geçildi**; V1'de 8.6 ve `RULES.md` kural 1 güncellenir. |
| K2 | **Aday akışı yalnızca bilgisayardan** ("bu uygulama desktoptan kullanılacak unutma, tam güvenlik adına o şekilde ayarla"). Masaüstü öncelikli: 1280 / 1440 birincil, 1024 en küçük. Telefon ve tablet tek bir dostça, dürüst ekran görür: "Bu değerlendirme bilgisayardan yapılır" + ne yapacağı. Tespit sunucuda UA + istemcide (`pointer: coarse` + yetenek); gerçek bir masaüstü ya da dizüstü **asla** yanlışlıkla engellenmez (dokunmatik dizüstü, küçük pencere: engel değil "pencereni büyüt" durumu). | 3.0 (kapı ve tespit kuralları), 3.1-3.12 masaüstü tel çerçeveleri, 6 dilim VG. `HIRING-UX.md` 6.15 bu belgeyle **yerine geçildi** (aşağıda). |
| K3 | **Karşılama ve onay iki ekran:** evet. | 3.1, 3.2. |
| K4 | **Düşünme ve cevap sayacı halka:** evet. Aşama sayacı sayısal kalır. | 3.4, 3.8, `TimerRing`. |
| K5 | **Zamanlama:** plan 2'nin Görev 19-21'inden sonra, plan 3'ten önce, "plan 2b" olarak. Adaylar sekmesinin yeniden tasarımı (sürüm 1 numarasıyla V8) **plan 3'ün içine** girer. | 6.1. |
| K6 | Koordinatör hükmü: masaüstü zorunluluğu **yalnızca işe alım aday akışı** için. Dil sınavı (exam) değişmez; onun `MobileBlock`'u ve "siz" dili olduğu gibi kalır. | 3.0. |
| K7 | **Yönetici paneli de aynı görsel dille** (kullanıcı: "evet yapalım"). Masaüstü öncelikli (1280 / 1440, en küçük 1024). Plan 3'ün yeniden kurduğu Adaylar sekmesi ve inceleme ekranlarının tasarımı bu belgede, uygulaması plan 3'te. Canlı sınavın yönetici ekranları yalnızca tutarlılık için ve düşük öncelikle. | 4. bölüm, 5 (panel bileşenleri), 6 (M dilimleri). |
| K8 | Sınavın "aynı gün dönülür / e-posta ile dönecek" metni **şimdilik kalır**; e-posta ve talep altyapısı sonra kurulacak. | 4.12. |

**`HIRING-UX.md` 6.15'in yerine geçen metin (V1'de oraya yazılır):**
> İşe alım aday akışı gözetim seviyesinden bağımsız olarak **yalnızca bilgisayardan** yapılır
> (kullanıcı kararı K2, 2026-10-05). Telefon ve tablet `DesktopOnlyScreen` görür: neden (dürüst,
> gözetim iddiası yok), linki kopyala, isteğe bağlı "linki e-postama gönder" (sunucu ucu ve e-posta
> gönderimi gelince). Masaüstü düzeni 1280 ve 1440 için tasarlanır, 1024'te bozulmaz; 1024'ten dar
> bir masaüstü penceresi engellenmez, tek sütuna iner ve "Pencereni büyüt" şeridi görür. Eski 6.15'in
> "telefonda tamamen yapılabilir", "alt sabit dolu buton" ve "video dikey çerçeve" maddeleri geçersiz.
> Dokunma hedefi ≥ 44px ve yazı ≥ 16px kuralları kalır (dokunmatik dizüstü ve erişilebilirlik için).

Ayrıca geçersiz olanlar: `HIRING-UX.md` 6 "Ortak kurallar"daki "Mobilde dolu buton altta sabit
çubukta" (yerine masaüstü `StepFooter`, 2 G9); `hiringFrame.faqPhoneA` ("Evet. Telefonu dik tut")
ve `hiringLanding.needDevice` ("Telefon ya da bilgisayar") metinleri (3.1, V3).

**Bu belge neyi değiştirir:** `HIRING-UX.md` 6.x (aday ekranları), 5.x (yönetici ekranları, K7) ve
4.1'in (panel kabuğu) *görünümünü*, 6.15'i (cihaz politikası) ve 8.6'yı (çizim); sunucu kurallarını, sızıntı kurallarını ve
dürüstlük sözlerini değiştirmez.

**Kaynak notu (dürüstlük):** "Airbnb'nin ev sahibi olma akışı adım adım, illüstrasyonlu, altta
ilerleme çubuğu ve Geri / İleri çubuğu olan bir akış" bilgisi `airbnb-ux` referanslarında **yok**;
benim eğitim verimden geliyor ve bu oturumda doğrulanmadı. Masaüstü `StepFooter` deseni (alt kenarda
ilerleme parçaları, solda Geri, sağda tek dolu buton) bu doğrulanmamış hatıraya dayanır; gerekçesi
ise Kademe'nin kendi kuralı: dolu buton her ekranda aynı yerde. Referanslarda doğrulanmış olanlar:
tek dolu buton ve cimri marka rengi (`visual-design-system.md` #2, #10), "daha fazla göster" ile
kısaltma (`listing-detail.md` #7, kısmen doğrulanmış), önce kısa sonra tam (playbook 1.3), çıkmaz
sokak yok (playbook 1.9), web ve mobil anlamda aynı mekanikte farklı (playbook 1.4). Airbnb'nin
görsel ağırlığı **gerçek fotoğraftan** gelir (`visual-design-system.md` #7, çıkarım). Kademe'de
gösterilecek fotoğraf yok; "görsellik" burada adayın kendi kamera görüntüsü, anlam taşıyan ikonlar ve
yalnızca karar ve durum ekranlarında küçük çizimle karşılanır. Airbnb'nin rengi, pill arama çubuğu,
kalbi yok.

---

## 1. Teşhis: ekran ekran ne zorlaştırıyor

**Not (sürüm 2):** teşhis telefon (390) ve masaüstü (1280) görüntülerinden yapıldı. K2 ile aday akışı
masaüstüne döndü; sorunların hepsi masaüstünde de geçerli (örneğin `p2t11-01`'de 1280'de bile onay
kartı ilk ekranın altında başlıyor, onay kutusu yaklaşık iki ekran aşağıda; ekran görüntülerinden tahmin). Telefona özgü olanlar (390'da
sabit kapalı buton, tablo taşması) artık aday tarafında telefon ekranıyla (3.0) çözülüyor; yönetici
paneli için geçerliliğini koruyor.

**Birincil iş (rol başına bir cümle):**
- **Elif (aday):** "Şimdi ne yapmam gerekiyor?" sorusunun cevabını her ekranda tek bakışta görüp, kendini
  sürprizsiz anlatmak.
- **Deniz (alım sahibi):** adayı 30 saniyede davet edip linki göndermek; sonra kimin takıldığını görmek.

**Ölçüm yöntemi:** görünen metin, `candidate.tr.json` / `hiring.tr.json` anahtarlarından ve
`consent-default.ts`'ten, ekran görüntüsünde görünen durum için sayıldı (üst çubuk dahil: şirket adı
2, dil 2, Yardım 1 = 5 kelime). Sorunun kendisi ve şirketin metinleri ekran görüntüsündeki örnekle
sayıldı. Sayım betikle yapıldı, elle değil; ±3 kelime oynayabilir.

| Ekran (görüntü) | Görünen kelime | Rakip eylem | İlerleme işareti | En büyük sorun |
|---|---|---|---|---|
| Karşılama + rıza (`p2t11-01`, `-08`, `-09`, `-04`) | **191** kapalı; "Ayrıntılar" açıkken **323**; "Bir ihtiyacın mı var?" de açıkken **362** | 4: Ayrıntılar, Bir ihtiyacın mı var?, onay kutusu, Başlayalım (+ dil, Yardım, Veri hakların, e-posta) | Yok. Adayın 4 ekranlık bir hazırlıkta olduğunu söyleyen hiçbir şey yok | 7 bölüm tek sayfada (amaç, 3 bilgi, Nasıl işliyor, Kim değerlendirecek, Ne kaydediliyor, İhtiyacın olanlar, Bir ihtiyacın mı var?). 390px'te onay kutusu ~5 ekran aşağıda, ama sabit çubuktaki **kapalı "Başlayalım" ilk ekranda** görünüyor (`p2t11-08`): aday "neden basamıyorum?" diye düşünüyor, nedeni okuyup kutuyu aramak için kaydırıyor. 114 kelimelik rıza paragrafı küçük gri metin (`p2t11-02`). |
| Cihaz kontrolü (`p2t12-08`, `-09`, `-03`, `-06`) | **60**; izin reddinde **111** | 2 ve yanlış ağırlıkta: gerçek sonraki adım "Kamerayı ve mikrofonu aç" **outline**, tek dolu buton "Hazırım, ısınma sorusuna geç" ise **kapalı** | Satırlarda "Sırada / Hazır" var, ama sayfa düzeyinde yok | Dolu buton hiçbir zaman o anki eylem değil; aday gri butona bakıp bekliyor. Dört satır (Kamera, Mikrofon, Deneme, Bağlantı) aynı ağırlıkta liste; önizleme boşken büyük gri kutu (`p2t12-08`). Red durumunda kamera kutusu, izin metni, "Nasıl düzeltirim?" kutusu, "Sorun bildir", "Tekrar dene" ve kapalı dolu buton aynı anda (`p2t12-03`). |
| Isınma (`p2t14-01`, `-15`) | **44** | 2 (Hazırım, kaydı başlat / Isınmayı atla) + not alanı | Yok | Düşünme sayacı küçük bir sayı; not alanı her zaman açık ve gözü sorudan çekiyor. |
| Aşama girişi (`p2t13-01`, `-14`) | **70** | 1 | "Aşama 1 / 2" metni | Görsel olarak iyi durumda; ama 2-3 kural madde imli düz metin, süre ve soru sayısı tek satır gri. Son tarih bilgisi butonun altında, dikkat çalıyor. |
| Yazılı soru (`p2t13-03`) | **36** | 1 | İnce çubuk + "Aşama 1 / 2 · Soru 1 / 3" | İyi. Küçük iyileştirme: soru türü etiketi gri ve küçük, "Kaydedildi" ikon yok. |
| Seçmeli soru (`p2t13-18`) | **42** | 1 | aynı | Satırda hem numara (1) hem radyo dairesi var: iki işaret aynı işi yapıyor. Telefonda "Klavyede 1-3 tuşlarıyla" ipucu anlamsız. Kapalı nedenin dili uzun ("Bu soru zorunlu. Cevaplayınca devam edebilirsin."). |
| Video soru, düşünme (`p2t14-18`, `p2t14-04`) | **52** | 2 + not alanı | aynı | Ekranın en büyük öğesi soru değil, boş not kutusu. "Kamera şu an kapalı." metin; görsel karşılığı yok. |
| Video soru, kayıt (`p2t14-19`) | **50** | 1 | aynı | Kendi görüntün sağda küçük bir kutu; ekranın yarısı boş. "Cevabın arka planda yükleniyor · %100" ve "Süre dolunca kayıt kendiliğinden biter..." her saniye göz önünde. |
| Video soru, gözden geçir (`p2t14-20`, `-21`) | ~40 | 2 (doğru: dolu + outline) | aynı | İyi. Video tam genişlik. Korunur. |
| Dosya (`p2t15-01`) | **47** | 2 ve yanlış ağırlıkta: "Dosya seç" outline, kapalı "Sonraki soru" dolu | aynı | Cihaz kontrolündeki hatanın aynısı: dolu buton o anki eylem değil. |
| Bitti + anket (`p2t16-01`, `-10`) | **82** | 2 (puan + gönder) + yorum alanı | Yok ("bitti" duygusu yalnızca başlıkta) | Sonuç kartı düz metin; "ne olacak, ne zaman" bir zaman çizgisi olarak okunmuyor. Yorum alanı her zaman açık. |
| Link sorunu (`p2t11-11`) | ~35 | 1 | - | İyi kurgulu (tek eylem). Görsel olarak çok boş, sayfanın üst köşesinde küçük "!" dairesi. |
| Yönetici: davet sheet'i (`p2t17-08`, `-13`) | İlk alana kadar **~45**; form toplam **75** | 3 mod/radyo grubu + "Ekip ve kurallara git" + "Değiştir" + kapalı dolu buton | - | İlk alan (Ad soyad) sheet'in ortasında; üstte 32 kelimelik ekip uyarısı. |
| Yönetici: davet hazır (`p2t17-03`) | **~99** (hazır mesaj ~60) | 4 (Linki kopyala, Mesajı kopyala, Başka aday, Adaylara git) | - | Hazır mesaj kutusu linkin kendisinden büyük; asıl iş (linki kopyala) ikinci planda. |
| Yönetici: Adaylar sekmesi (`p2t18-11`, `-06`, `-13`) | Satır başına **~28**; 4 satır + uyarı **~140** | Satır başına 2 outline buton + talep kartında "Tamam" | Metin "1/2 aşama" | Her satırda aynı 10 kelimelik yardım cümlesi ("Eski link hemen çalışmaz olur..."). 390px'te tablo taşıyor, Durum sütunu kesik ("Du...", `p2t18-13`). Talepler ad hücresinin içine kart olarak giriyor, satır yüksekliği 3 katına çıkıyor. |
| Yönetici: Genel bakış, taslak (`f1-03`, `17-phone-390`) | ~60 | 1 (Yayınla) + 4 satır bağlantısı | Satır başına dot | Hazırlık listesi "2/4 hazır" gibi bir özet vermiyor; telefonda kapalı "Publish" butonu listeden önce. |

**Beş büyük sorun (sıralı):**
1. **Dolu buton o anki eylem değil** (cihaz kontrolü, dosya, karşılama). Ekranın en görünür nesnesi
   kapalı ve gri; gerçek eylem outline bir butonda ya da 5 ekran aşağıda. Bu, "ne yapacağımı
   bilmiyorum" hissinin bir numaralı nedeni.
2. **Karşılama tek sayfada 7 bölüm, 191-362 kelime.** Kişi, süre ve rıza aynı yüzeyde yarışıyor.
3. **Yolculukta nerede olduğun belli değil.** Karşılama, cihaz, ısınma ekranlarında ilerleme işareti yok;
   aday "daha kaç ekran var?" bilmiyor. (Soru ekranlarındaki "Aşama / Soru" başlığı iyi çalışıyor.)
4. **Hiçbir şey görsel değil:** tüm bilgi madde imli gri metin; ikonlar yalnızca "Ne kaydediliyor"
   kartında ve 16px. Sayaç, kamera kapalı durumu, "sırada ne var" gibi doğası gereği görsel olan şeyler
   metinle anlatılıyor.
5. **Yönetici Adaylar tablosu** her satırda yardım metnini ve iki butonu tekrar ediyor, telefonda
   taşıyor.

**Korunacaklar (çalışıyor, dokunma):** soru ekranlarının üst başlığı (Aşama / Soru / Kalan süre,
accent sayaç, `tnum`), gözden geçir ekranının dolu + outline buton ikilisi, sakin dil ve "sen" hitabı,
kapalı butonun nedeni yanında (`DisabledReason`), her ekranda tek dolu buton kuralı, sakin şerit
desenleri (çevrimdışı, ikinci sekme), 8 sn geri alma şeridi, Yardım paneli, link sorunu ekranlarının
tek eylemli kurgusu, cihaz kontrolünün işletim sistemine özel "Nasıl düzeltirim?" metinleri.

---

## 2. Hedef desen: Kademe için "Airbnb grameri" (masaüstü)

Her aday ekranı aynı iskelete oturur. Birincil genişlik 1280 ve 1440, en küçük 1024. Aday çerçevesi
`RULES.md` kural 9'daki gibi en fazla 1000px. Bir ekranı tasarlarken sırayla şunlar sorulur:

| # | Kural | Kademe'deki karşılığı |
|---|---|---|
| G1 | **Bir ekran, bir soru.** Ekranın başlığı adayın o an cevapladığı soru ya da yaptığı iş. | Karşılama ikiye bölünür (Karşılama / Onay). Cihaz kontrolü alt adımlara bölünür. |
| G2 | **Dolu buton her zaman bir sonraki gerçek eylem.** Kapalı dolu buton yalnızca adayın o ekranda yapabileceği başka bir şey kalmadığında görünür (örn. zorunlu soru boş). | "Kamerayı aç" → "Deneme kaydını başlat" → "Evet, devam et"; dosya sorusunda "Dosya seç" → "Sonraki soru". |
| G3 | **Görünür yolculuk.** Hazırlık boyunca 4 parçalı ilerleme: Hazırlık · Cihaz · Isınma · Sorular; `StepFooter`'ın üst kenarında tam genişlik. Soru ekranlarında mevcut üst başlık (Aşama / Soru / Kalan süre) + soru parçaları. | `JourneyProgress`. Isınması ve cihaz kontrolü olmayan değerlendirmede parça sayısı düşer (2 ya da 3). |
| G4 | **Büyük, dostça başlık; tek cümlelik alt satır.** Hazırlık ve bitti ekranlarında başlık 40/48, 600 (yeni rol "adım başlığı"); soru metni 24/34, 500; alt satır en fazla 12 kelime. 1024-1279 arasında başlık 34/42. | Uzun metin yalnızca açılır alanda. |
| G5 | **İkon anlam taşır, süs değildir.** Nötr kutu içinde (40px, `bg-secondary`, `text-ink`), 20px lucide, 1.75 çizgi. | `IconRow`, `FactTiles`. |
| G6 | **Seçim kartla yapılır.** Radyo daireleri yerine tıklanır kart; seçili kart = aktif durum (accent kenar + `brand-soft` zemin). Klavye kısayolları masaüstünde görünür. | Seçmeli soru, ek süre, anket puanı, davette dil ve mod. |
| G7 | **Detay ve hukuk metni açılır alanın arkasında, bir tık uzaklıkta.** Kaldırılmaz, gizlenmez: etiketi ne olduğunu söyler. | `Disclosure`. Rıza metni ve saklama süreleri burada. |
| G8 | **Varsayılan, soru yerine.** | Ek süre "yok" seçili; dil davetten gelir; anket yorumu kapalı. |
| G9 | **Masaüstü `StepFooter`: dolu buton hep aynı yerde.** Görünüm alanının altına yapışık, 84px; üst kenarında `JourneyProgress`; içerik 1000px çerçevede: solda metin "Geri" (varsa), sağda kapalı neden + tek dolu buton (en az 200px genişlik, 52px yükseklik). Kısayol: Enter dolu butonu tetiklemez (yazı alanında yanlış gönderim riski); yalnızca odak butondayken. | Mevcut `ActionBar`'ın yerini alır. İçerik `padding-bottom` ve `scroll-padding-bottom` ile örtülmez. |
| G10 | **Hazırlık ve bitti ekranları iki bölgeli; soru ekranları tek odaklı.** Karşılama, Onay, Cihaz, Bitti: solda başlık bölgesi (kicker, başlık, alt satır, çizim, ~400px), sağda içerik bölgesi (~520px). Soru ekranları: yazılı ve seçmeli tek sütun 760px; video ve ses iki bölge (soru + sayaç solda, önizleme sağda). | `StepScreen` (`layout: "split" \| "single"`). `RULES.md` kural 9'daki "tek sütun" ifadesi "tek karar" olarak güncellenir; 1024'ten dar pencerede her ekran tek sütuna iner. |
| G11 | **Durum ve sorun ekranları çizimle başlar.** Soru ekranlarında çizim **yok**. | `StatusScreen` + `Illustration`. |

### 2.1 İkon dili (lucide-react 1.42, isimler `node_modules`'ta doğrulandı)

| Anlam | İkon | Nerede |
|---|---|---|
| Süre | `clock` | Karşılama bilgisi, aşama girişi |
| Aşama sayısı | `layers` | Karşılama, aşama girişi |
| Son gün | `calendar-days` | Karşılama, davet |
| Soru sayısı | `list-checks` | Aşama girişi |
| Tekrar hakkı | `rotate-ccw` | Aşama girişi, video soru |
| Düşünme süresi | `hourglass` | Aşama kuralı |
| Geri dönülmez | `corner-up-left` (üstü çizik değil; metin söyler) | Aşama kuralı |
| Video kaydı | `video` | Onay, soru türü |
| Ses kaydı | `mic` | Onay, soru türü |
| Bağlantı | `wifi` | Onay, cihaz |
| İzlenmez | `eye-off` | Onay |
| Yapay zekâ yalnızca yazıya döker | `audio-lines` | Onay |
| İnsanlar karar verir | `users-round` | Karşılama adım 4 |
| Ek süre / düzenleme | `accessibility` | Karşılama açılır satırı |
| Sessiz yer | `headphones` | Karşılama "yanına al" |
| Yazılı soru | `pen-line` | Soru türü |
| Seçmeli soru | `list-checks` | Soru türü |
| Dosya | `file-up`, yüklendi `file-check` | Soru türü, dosya kartı |
| Not al | `notebook-pen` | Isınma ve video açılır alanı |
| Kaydedildi | `check` | Yazılı soru durum satırı |
| Kamera kapalı | `camera` (gri) | Düşünme ekranı önizleme yeri |
| Yardım | `circle-help` | Üst çubuk |
| Link | `link`, kopyala `copy` | Davet |
| Kişi ekle | `user-round-plus` | Davet |
| Liste yapıştır | `clipboard-paste` | Davet modu |
| Talepler | `inbox` | Adaylar sekmesi |
| Satır menüsü | `ellipsis` | Adaylar sekmesi |


### 2.2 Çizim (illüstrasyon) dili (K1: kabul edildi)

- **Biçim:** düz, sakin "spot" çizimler. 1.5px ink çizgi, yuvarlak uçlar, 2-3 dolgu tonu, yüz ve
  insan figürü **yok** (stok fotoğraf da yok). Nesneler: masa ve dizüstü, kalkan, zarf, kum saati,
  kapalı kapı, iki pencere, telefon ve dizüstü. Kaynak: elle çizilmiş satır içi SVG,
  `src/components/hiring/visual/illustrations.tsx`. Harici dosya yok, `<img>` yok.
- **Renk:** çizimler **doygun accent kullanmaz**. `RULES.md` kural 1 (accent yalnızca CTA, aktif,
  sayaç) aynen kalır; çizimler için adı konmuş tonlar: `--color-illus-line: #131311` (ink),
  `--color-illus-fill: #EEF6F3` (= brand-soft), `--color-illus-tint: #CFE3DA`,
  `--color-illus-sage: #9DC6B6`, `--color-illus-warm: #F1F0EC`. Ekrandaki tek doygun yeşil yine
  dolu buton.
- **Boyut:** masaüstünde başlık bölgesinde en fazla 400x220; 1024-1279 arasında 340x190; sorun
  ekranlarında 160x120; "bilgisayardan aç" telefon ekranında 342x140. Ekranın üçte birini geçmez.
- **Erişilebilirlik:** her çizim `aria-hidden="true"` ve `focusable="false"`; anlamı başlık taşır.
- **Set (V1'de 11 çizim):** `welcome` (masa, dizüstü, bitki, fincan), `consent` (kalkan + tik),
  `permission` (adres çubuğu ve vurgulu simge, *anlam taşır*), `warmup` (fincan, buhar),
  `stage` (iki bayraklı patika), `done` (zarf + tik + kâğıt uçak izi), `expired` (kum saati + takvim),
  `closed` (kapalı kapı), `otherTab` (iki pencere), `desktopOnly` (telefondan dizüstüne ok),
  `inviteReady` (zincir + kâğıt uçak). Panel için (K7) dört boş durum çizimi daha: `emptyToday`
  (fincan ve tamamlanmış liste), `emptyOpenings` (boş pano ve iğne), `emptyCandidates` (boş kutu),
  `emptyLibrary` (raf). Toplam 15.

### 2.3 Hareket

`HIRING-UX.md` 8.5 aynen geçerli; eklenenler:

| Ne | Süre | Not |
|---|---|---|
| Adım geçişi (Karşılama → Onay, cihaz alt adımları) | 200 ms opaklık + 8px yukarı kayma | `prefers-reduced-motion`: yalnızca opaklık |
| İlerleme parçasının dolması | 240 ms genişlik | Reduced motion: anında |
| `TimerRing` | Her saniye halka biraz kısalır; geçiş animasyonu **yok** (8.5: sayaçta animasyon yok, rakam ve halka adım adım değişir) | Reduced motion'da da aynı |
| Mikrofon seviyesi çubukları | Gerçek seviyeyi gösterir (süs değil) | Reduced motion'da da gösterir; veri |
| Çizimler | **Hareketsiz.** Lottie yok. | |

Odak her adım değişiminde yeni başlığa gider (mevcut `headingRef` deseni); sayfa geçişlerinde
animasyon yok kuralı korunur, adım geçişi aynı sayfa içinde olduğu için kısa opaklık kabul edilir.

---

## 3. Aday akışı: ekran ekran (masaüstü öncelikli)

Format: masaüstü tel çerçeve (1280 görünüm alanı, 1000px aday çerçevesi), 1024 notu, yeni metin
(TR / EN), önce / sonra kelime, açılır alana taşınan, ikon / çizim, hukuk ve rıza nedeniyle kalan.
Kelime sayıları üst çubuk (5 kelime) dahil; ölçüm yöntemi 1. bölümde. Metin telefon sürümüyle aynı
kaldı; değişen yerleşim.

**Ortak kabuk (her ekran):**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│        Örnek A.Ş.                                               Türkçe · English   (?) Yardım│ HiringFrame, 64px
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│        ┌─────────── 1000px aday çerçevesi ───────────────────────────────────────────┐       │
│        │  içerik (StepScreen: split ya da single)                                    │       │
│        └─────────────────────────────────────────────────────────────────────────────┘       │
│                                                                                              │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤ JourneyProgress (4px)
│        ‹ Geri                                   neden (kapalıysa)   [  Dolu buton  ]          │ StepFooter, 84px
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Soru ekranlarında `JourneyProgress` yerine üstte mevcut koşu başlığı durur:
`Aşama 1 / 2 · Soru 1 / 3` solda, `Kalan süre 9:44` (accent, `tnum`) sağda, altında soru parçaları.

### 3.0 Masaüstü kapısı ve "Bilgisayardan aç" ekranı (yeni, K2)

**Ne zaman görünür:** işe alım aday akışının her rotasında (`/a/[token]` ve altı), sorulardan,
rızadan ve her kayıttan **önce**. Dil sınavı rotalarında görünmez (K6).

**Tespit kuralları** (saf fonksiyon `classifyDevice`, sunucu ve istemci aynı kodu kullanır):

| Sinyal | Nerede | Sonuç |
|---|---|---|
| `Sec-CH-UA-Mobile: ?1` ya da UA'da `iPhone`, `iPod`, `Android ... Mobile`, `Windows Phone` | Sunucu (istek başlığı) | **Telefon** → sunucu doğrudan `DesktopOnlyScreen` render eder. Hiçbir dizüstü bu başlıkları göndermez (istisna: DevTools cihaz öykünmesi; bilerek engellenir). |
| UA'da `iPad`, `Android` ama `Mobile` yok, ya da `Macintosh` + `navigator.maxTouchPoints > 1` (masaüstü modundaki iPad) | Sunucu "belirsiz" der, istemci karar verir | **Tablet** → istemci `DesktopOnlyScreen`'e geçer. |
| İstemci: `(pointer: coarse)` **ve** `(any-pointer: fine)` yok **ve** `navigator.mediaDevices.getDisplayMedia` yok | İstemci, hidrasyondan sonra | Dokunmatik tek girişli cihaz → `DesktopOnlyScreen`. |
| Dokunmatik dizüstü: `(any-pointer: fine)` var ya da `getDisplayMedia` var | İstemci | **Masaüstü** → geçer. Dokunmatik ekran tek başına asla engel değildir. |
| Masaüstü, pencere genişliği < 1024 | İstemci, `resize` ile canlı | **Engel yok.** Düzen tek sütuna iner, üstte sakin şerit: "Pencere dar. Daha rahat görmek için pencereni büyüt." Pencere büyüyünce şerit kendiliğinden kalkar; durum ve süre kaybolmaz. |
| Masaüstü, pencere < 640 (yarım ekranın da yarısı) | İstemci | Yine engel yok; aşama **başlamadan önce** "Aşamayı başlat" butonu nedenli kapalı olur: "Pencereni büyüt, sonra başla." Başlamış bir aşamada asla kapatılmaz (süre işler, aday cezalandırılmaz). |

**İlkeler:** (1) Telefon kararı ya sunucunun kesin UA sinyaline ya da istemcinin iki sinyalinin
birleşimine dayanır; tek bir zayıf sinyal (dokunmatik, dar pencere) kimseyi engellemez. (2) Pencere
genişliği hiçbir zaman cihaz sınıfını belirlemez. (3) Kapıyı aşma düğmesi yok (güvenlik kararı);
yanlış tespit için "Bilgisayardayım ama bu ekranı görüyorum" metin bağlantısı mevcut sorun bildirme
ucuna (`/api/c/[token]/problem`) UA ile birlikte gider, ekip görür. (4) Kapı hiçbir yeni veri
kaydetmez; mevcut `firstSeenUserAgent` kaydı zaten var (`candidate-context.ts`). (5) Dil sınavının
`isMobileDevice` + `MobileBlock`'u (`src/components/candidate/MobileBlock.tsx`) yetenek tabanlı aynı
fikri kullanıyor; işe alım `classifyDevice`'ı ondan ayrı yazar (sınav davranışı değişmesin), ama aynı
test matrisini paylaşabilir.

**Dürüstlük kuralı (önemli):** Onay ekranı plan 2'de "Ekranın, sekmelerin ve pencerelerin
izlenmez" diyor ve bu doğru. Bu yüzden telefon ekranı **gözetim, tam ekran ya da sekme kontrolü
iddia etmez**. Neden cümlesi kurumun tercihini söyler. Plan 4'te alımın gözetim seviyesi tam ekran
ya da ekran paylaşımı isterse, neden cümlesi o seviyeye göre değişir (ayrı anahtar).

**Telefon tel çerçevesi (390, tek telefon ekranı bu):**

```
┌────────────────────────────────────┐
│ Örnek A.Ş.          Türkçe EN  (?) │
│ ╭────────────────────────────────╮ │
│ │ [desktopOnly çizimi: telefon → │ │  342x140
│ │  dizüstü, kesik ok]            │ │
│ ╰────────────────────────────────╯ │
│ Bu değerlendirme bilgisayardan     │  h1 28/36
│ yapılır                            │
│ İşe alım ekibi, değerlendirmenin   │  lead
│ bilgisayardan yapılmasını istiyor. │
│ (◷ ~15 dk) (▦ 19 Eki'ye kadar)     │  çipler: planlayabilsin
│ ① Linki kopyala ya da e-postanı    │  PathSteps
│   bilgisayarda aç.                 │
│ ② Bilgisayarındaki tarayıcıda      │
│   linki aç.                        │
│ Bilgisayardayım ama bu ekranı      │  metin bağlantısı → sorun bildir
│ görüyorum                          │
├────────────────────────────────────┤
│ [          Linki kopyala         ] │  dolu
│ [    Linki e-postama gönder      ] │  outline, YALNIZCA sunucu ucu varsa
└────────────────────────────────────┘
```

| Öğe | TR | EN |
|---|---|---|
| Başlık | Bu değerlendirme bilgisayardan yapılır | This assessment is done on a computer |
| Neden | İşe alım ekibi, değerlendirmenin bilgisayardan yapılmasını istiyor. | The hiring team asks for this assessment to be done on a computer. |
| Adımlar | Linki kopyala ya da e-postanı bilgisayarda aç. / Bilgisayarındaki tarayıcıda linki aç. | Copy the link or open your e-mail on a computer. / Open the link in your computer's browser. |
| Dolu buton / sonrası | Linki kopyala / Kopyalandı | Copy the link / Copied |
| Öneri (plan) | Linki e-postama gönder / Gönderildi: {email maskeli} | E-mail me the link / Sent to {masked email} |
| Yanlış tespit | Bilgisayardayım ama bu ekranı görüyorum | I'm on a computer but I see this screen |

- **Kelime:** 42 (yeni ekran; e-posta düğmesi olmadan 38).
- **"Linki e-postama gönder" bir plan seçeneğidir, bugün yapılamaz:** davette e-posta varsa
  gösterilir, ama yeni bir sunucu ucu (`POST /api/c/[token]/send-link`, token başına oran sınırı,
  e-posta adresi istemciye açık yazılmaz, maskeli gösterilir) ve gerçek e-posta gönderimi gerekir.
  STATUS'a göre e-posta gönderimi yok (yalnızca `message_outbox`'a yazılıyor). Bu yüzden VG'de
  **yalnızca "Linki kopyala"** yapılır; e-posta düğmesi e-posta altyapısı geldiğinde (açık soru 1).
- **Kopyalanan link:** adayın açtığı linkin kendisi (`/a/[token]`); başka token üretilmez.
- **Yönetici tarafı etkisi:** telefondan açılan link Adaylar sekmesinde "Linki açtı" görünür; plan 3'te
  "Telefondan açtı, bilgisayara geçmedi" ipucu düşünülebilir (bu belgede tasarlanmadı).
- **Dar masaüstü penceresi şeridi:** `NarrowWindowStrip`, ikon `app-window`, metin
  "Pencere dar. Daha rahat görmek için pencereni büyüt." / "Your window is narrow. Make it
  wider to see everything comfortably." Kapatılabilir değil, ama hiçbir şeyi örtmez.

### 3.1 Karşılama (`/a/[token]`, adım 1a)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Örnek A.Ş.                                                      Türkçe · English   (?) Yardım│
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│   Örnek A.Ş. · Ürün Tasarımcısı              ┌───────────┐┌───────────┐┌───────────┐         │
│   Merhaba Elif                               │ ◷ ~15 dk  ││ ≋ 2 aşama ││ ▦ 19 Eki  │         │ FactTiles
│   (40/48)                                    │ tahmini   ││ ara verebi││ son gün   │         │
│   Tanışmadan önce nasıl düşündüğünü          └───────────┘└───────────┘└───────────┘         │
│   görmek istiyoruz. Kendi zamanında          Nasıl gidecek                                   │
│   yapacaksın.                                ① Cihazını dene · Kimse görmez.                 │ PathSteps
│   ╭──────────────────────────────╮           │                                               │
│   │  [welcome çizimi 400x220:    │           ② Isın · Gönderilmez.                           │
│   │   masa, dizüstü, bitki,      │           │                                               │
│   │   fincan]                    │           ③ Soruları cevapla · Süre, sen başlatınca işler.│
│   ╰──────────────────────────────╯           │                                               │
│                                              ④ Ekip değerlendirir · Ekipten bir kişi, aynı ölç│
│                                              (🎧 Sessiz bir yer) (▭ Kamera ve mikrofon)      │
│                                              (▢ Bilgisayar)                                  │
│                                              ♿ Ek süre ya da başka bir düzenleme          ⌄  │ Disclosure
│                                              Yarıda bırakırsan aynı linkten devam edersin.   │
├▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤
│                                                     Hazırlık · Adım 1 / 4   [  Devam et  ]   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**1024:** sol bölge 340px, çizim 340x190, sağ bölge 520px; 1000px altına iner ve tek sütun olur
(başlık, çizim, içerik). Bilgi kutuları 3 yan yana kalır.

| Öğe | TR | EN |
|---|---|---|
| Başlık | Merhaba {name} | Hello {name} |
| Alt satır | Tanışmadan önce nasıl düşündüğünü görmek istiyoruz. Kendi zamanında yapacaksın. | We'd like to see how you think before we meet. Do it in your own time. |
| Bilgiler | ~{minutes} dk · tahmini / {count} aşama · ara verebilirsin / {date} · son gün | ~{minutes} min · estimated / {count} stages · take breaks between / {date} · last day |
| Yol | Cihazını dene · Kimse görmez. / Isın · Gönderilmez. / Soruları cevapla · Süre, sen başlatınca işler. / Ekip değerlendirir · {whoShort} | Test your device · Nobody sees it. / Warm up · Not sent. / Answer the questions · The clock starts when you do. / The team reviews · {whoShort} |
| `whoShort` (yeni, çoğul) | =0 İşe alım ekibi, aynı ölçütlerle. =1 Ekipten bir kişi, aynı ölçütlerle. other En az # kişi, birbirinden bağımsız. | =0 The hiring team, same criteria. =1 One person on the team, same criteria. other At least # people, independently. |
| Yanına al | Sessiz bir yer · Kamera ve mikrofon (yalnız ses sorusu varsa "Mikrofon") · Bilgisayar | A quiet place · Camera and mic · A computer |
| Açılır satır | Ek süre ya da başka bir düzenleme | Extra time or another adjustment |
| Alt not | Yarıda bırakırsan aynı linkten devam edersin. | If you stop, the same link brings you back. |
| Dolu buton | Devam et | Continue |

- **Kelime:** önce 191 (tek ekran, kapalı) → sonra **78** (Karşılama) + **86** (Onay). Toplam az düşer
  (191 → 164); kazanç ekran başına yükün yarıya inmesi ve sıranın kararı izlemesi. Kelime sayısını
  asıl düşüren, "Ayrıntılar"ın artık varsayılan kapalı ve ayrı ekranda olması.
- **Açılır alana taşınan:** ek süre seçimi ve "başka düzenleme iste" (`Disclosure` içinde
  `ChoiceCard` x3; `extraBody` kısaltılmış: "Neden sorulmaz, onay beklenmez. Değerlendiriciler
  görmez."). "Video ve ses sorularında önce düşünme süren var" aşama girişine taşınır.
- **Değişen metin anahtarları (K2):** `needDevice` "Telefon ya da bilgisayar" → "Bilgisayar";
  Yardım SSS `faqPhoneQ/A` "Telefonla yapabilir miyim? Evet..." → "Telefonla yapabilir miyim?
  Hayır, bu değerlendirme bilgisayardan yapılır. Linki bilgisayarında aç."
- **Kalan (zorunlu):** "Sorular burada görünmez" (sızıntı); ek süre bu ekranda kalır çünkü aşama
  başlayınca değişmez (`extraLocked`).
- **Test etkisi:** `hiringLanding.whoPeople` sabitlenmiş; metni değişmez, yeri Onay ekranının
  "Ayrıntılar" alanı olur. `whoShort` için yeni test (dürüstlük: "en az n, bağımsız").

### 3.2 Onay (`/a/[token]`, adım 1b, aynı URL, istemci adımı)

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│   [consent çizimi 160x120:                  ┌──────────────────────────────────────────────┐ │
│    kalkan + tik]                            │ KAYDEDİLİR                                   │ │
│                                             │ [▭] Video sorularında görüntün ve sesin      │ │ IconRow
│   Neler kaydediliyor?                       │ [🎙] Ses sorularında sesin                    │ │
│   (40/48)                                   │ [≋] Bağlantı ve yükleme sorunları            │ │
│                                             │     Kopma olursa ekip yeni hak verebilir.    │ │
│   Hiçbir kayıt seni otomatik olarak         │ ─────────────────────────────────────────── │ │
│   elemez; kararı cevaplarına bakan          │ KAYDEDİLMEZ                                  │ │
│   insanlar verir.                           │ [⊘] Ekranın, sekmelerin ve pencerelerin      │ │
│   (söz: sabit metin, 18/28 600)             └──────────────────────────────────────────────┘ │
│                                             ┌──────────────────────────────────────────────┐ │
│                                             │ [∿] Yapay zekâ seni puanlamaz                │ │
│                                             │     Sıralamaz, elemez; yalnızca video ve ses │ │
│                                             │     cevaplarını yazıya döker.                │ │
│                                             └──────────────────────────────────────────────┘ │
│                                             Ayrıntılar ve saklama süreleri               ⌄  │ Disclosure
│                                             ┌──────────────────────────────────────────────┐ │
│                                             │ ☑ Kaydı ve cevaplarımın bu başvuru için      │ │ tüm kart tıklanır
│                                             │   değerlendirilmesini kabul ediyorum.        │ │
│                                             └──────────────────────────────────────────────┘ │
│   Veri hakların · Bir sorun olursa: deniz@ornek.test                                         │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤
│   ‹ Geri                                    Önce kutuyu işaretle.   [ Kabul et ve başla ]     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Yerleşim kararı:** söz cümlesi (sabit metin) sol bölgede alt satır olarak durur; adayın en büyük
korkusuna ("makine mi eleyecek?") ekranın en okunur yerinde cevap verir. **1024:** aynı, sağ kart
520px; tek sütunda söz başlığın altında.

| Öğe | TR | EN |
|---|---|---|
| Başlık | Neler kaydediliyor? | What gets recorded? |
| Grup etiketleri | Kaydedilir / Kaydedilmez | Recorded / Not recorded |
| Satırlar | Video sorularında görüntün ve sesin / Ses sorularında sesin / Bağlantı ve yükleme sorunları · Kopma olursa ekip yeni hak verebilir. / Ekranın, sekmelerin ve pencerelerin | Your picture and voice in video questions / Your voice in audio questions / Connection and upload problems · If something breaks, the team can give you another go. / Your screen, tabs and windows |
| Söz (sabit, test) | Hiçbir kayıt seni otomatik olarak elemez; kararı cevaplarına bakan insanlar verir. | Nothing here rejects you automatically; people who look at your answers make the decision. |
| AI kartı | Yapay zekâ seni puanlamaz · Sıralamaz, elemez; yalnızca video ve ses cevaplarını yazıya döker. | AI does not score you · It doesn't rank or reject you; it only transcribes your video and audio answers. |
| Açılır | Ayrıntılar ve saklama süreleri | Details and how long we keep things |
| Onay kutusu | (aynen) Kaydı ve cevaplarımın bu başvuru için değerlendirilmesini kabul ediyorum. | (aynen) |
| Dolu buton / neden | Kabul et ve başla / Önce kutuyu işaretle. | Agree and start / Tick the box first. |
| İkincil | Geri | Back |

- **Kelime:** **86** (eski tek ekranın rıza kısmı Ayrıntılar açıkken 323'tü).
- **Açılır alanda (kaldırılmaz):** `whoPeople` (sabit metin), rıza metninin tamamı (114 kelime,
  `consent-default.ts`, aynen), saklama süreleri, alt işleyici (ElevenLabs) satırı.
- **Kalan (hukuk):** her kaydedilen sinyal ikonuyla görünür (7.2); söz ve onay kutusu metni
  değişmez (`consent_text_id`); veri hakları ve iletişim altta. Plan 4 gözetim satırları (sekme,
  yapıştırma, kamera kareleri, tam ekran) aynı listeye "Kaydedilir" grubuna eklenir ve o zaman
  "Kaydedilmez" satırı seviyeye göre değişir.

### 3.3 Cihaz kontrolü (`/check`, adım 2): üç alt adım

Sol bölge adımın kendisini anlatır ve ilerlemeyi dikey liste olarak gösterir; sağ bölge adayın kendi
görüntüsüdür (bu ürünün "fotoğrafı").

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│   5 saniyelik bir deneme yap               ┌──────────────────────────────────────────────┐  │
│   (40/48)                                  │ (⊘ Önizleme · kayıt yok)                     │  │
│   Kendini izle ve dinle. Bu kayıt kimseye  │                                              │  │
│   gitmez.                                  │          canlı kamera görüntüsü              │  │ 520x390 (4:3)
│                                            │                                              │  │
│   ✓ Kamera          Hazır                  │                                              │  │
│   ✓ Mikrofon        Sesin geliyor ▂▄▆▄▂    │ (▂▄▆▄▂ Sesin geliyor)                        │  │
│   ● Deneme kaydı    Şimdi                  └──────────────────────────────────────────────┘  │
│   ○ Bağlantı        İyi                                                                      │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤
│                                                    Cihaz · Adım 2 / 4  [ Deneme kaydını başlat ]│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**İzin reddi** (sağ bölgede önizlemenin yerine `permission` çizimi: adres çubuğu, solda vurgulu
simge, yanında "1"; sol bölgede başlık "Kamera izni kapalı", iki numaralı adım, "Hâlâ olmuyor mu?"
açılır alanı içinde işletim sistemi adımları ve "Sorun bildir"; dolu buton "Tekrar dene").

**1024:** önizleme 440x330; tek sütunda önizleme başlığın altında.

| Alt adım | Başlık TR / EN | Alt satır TR / EN | Dolu buton TR / EN |
|---|---|---|---|
| A izin | Kameranı açalım / Let's turn on your camera | Önizleme yalnızca sende. Kayıt yapılmaz. / Only you see the preview. Nothing is recorded. | Kamerayı ve mikrofonu aç / Turn on camera and mic |
| B deneme | 5 saniyelik bir deneme yap / Make a 5 second test | Kendini izle ve dinle. Bu kayıt kimseye gitmez. / Watch and listen to yourself. This goes to no one. | Deneme kaydını başlat / Start the test |
| C dinle | Kendini görüp duyabiliyor musun? / Can you see and hear yourself? | (yok) | Evet, devam et / Yes, continue; ikincil: Tekrar kaydet / Record again |
| Ses yok | Sesini duyamadık / We could not hear you | `trialQuiet` aynen (sabit metin) | Deneme kaydını başlat (geçişe izin verilir, mevcut kural) |
| Red | Kamera izni kapalı / Camera access is off | İki adımda açabilirsin. / Two steps to turn it on. | Tekrar dene / Try again |

- **Kelime:** önce 60 (red 111) → sonra **28** (A), **34** (B), **36** (red).
- **Açılır alana taşınan:** işletim sistemi ayarları paragrafı (`fixchrome`, `fixfirefox` ikinci
  satırı; testler macOS ve Windows'u sabitliyor, metin aynen), "Sorun bildir", bağlantı hızı rakamı.
- **Masaüstü sonucu:** telefona özel düzeltme metinleri (`fixios`, `fixandroid`, `fixinApp`,
  `fixiosOther`) normal akışta artık görünmez, çünkü telefon bu ekrana ulaşmaz (3.0). Silinmez:
  kapının yanlış sınıflayıp içeri aldığı nadir bir tablet için yedek kalırlar.
- **Kalan:** "kayıt yapılmıyor" etiketi önizlemenin üstünde; deneme kaydının gitmediği cümlesi;
  "dinlemeden geçilmez" kuralı. `device-rows.ts` modeli aynen; görünen alt adım modelin ilk "hazır
  olmayan" satırıdır.

### 3.4 Isınma (`/practice`, adım 3)

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│   (☕ Isınma · kimse görmez)                ┌──────────────────────────────────────────────┐  │
│   Bugün nasıl geçti, kısaca anlat.         │                                              │  │
│   (24/34)                                  │        [▢ kamera ikonu, gri zemin]           │  │ önizleme yeri
│      ╭───────╮                             │        Kamera, sen başlatınca açılır.        │  │
│      │ 0:15  │  Düşünme süren              │                                              │  │
│      │düşünme│  İstediğin kadar dene.      └──────────────────────────────────────────────┘  │
│      ╰───────╯                                                                               │ TimerRing 128px
│   ✎ Not al                              ⌄                                                    │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤
│   Isınmayı atla                                        Isınma · Adım 3 / 4  [ Kaydı başlat ]  │
```

- **Metin:** çip "Isınma · kimse görmez" / "Warm-up · nobody sees it"; dolu "Kaydı başlat" / "Start
  recording"; ikincil (Geri yerinde) "Isınmayı atla" / "Skip the warm-up".
- **Kelime:** 44 → **28**. **Açılır:** not alanı ve `notesHint`. **Çizim:** yok (soru ekranı).

### 3.5 Aşama girişi (`/stage/[n]`)

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                 AŞAMA 1 / 2                                                                  │ single, 640px
│                 Tanışma                                     (40/48, şirketin aşama adı)      │
│                 Kısa bir tanışma.                                                            │
│                 ┌─────────────┐┌─────────────┐┌─────────────┐                                │
│                 │ ◷ 10 dk     ││ ☑ 3 soru    ││ ↺ 1 tekrar  │                                │ FactTiles
│                 └─────────────┘└─────────────┘└─────────────┘                                │
│                 [⧗] Her soruda önce düşünme süren var.                                       │ IconRow
│                     Süre dolsa da kayıt sen başlatınca başlar.                               │
│                 [↰] Önceki sorulara dönülmez.                                                │
│                 Son gün 19 Eki · Aşamalar arasında ara verebilirsin.                         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                              Süre, bastığında başlar.  [ Aşamayı başlat ]    │
```

- **Kelime:** 70 → **49**. Son aşamada `lastStage` üstte tek satır (`flag` ikonu). Önceki aşama özeti
  (`previousDone`) üstte sakin şerit. Pencere < 640 ise buton nedenli kapalı (3.0).
- **Kalan:** "Süre, başlata bastığında işlemeye başlar" sözü butonun hemen solunda.

### 3.6 Yazılı soru

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Aşama 1 / 2 · Soru 1 / 3                                                 Kalan süre  9:44   │ koşu başlığı (aynı)
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭         │ QuestionProgress
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│             (✎ Yazılı)                                                                       │ single, 760px
│             Son projende bir sorunu nasıl çözdüğünü anlat.                     (24/34)       │
│             ┌──────────────────────────────────────────────────────────────────┐             │
│             │ Ekipte tasarım kararlarının geç onaylanması teslimi...           │             │ Textarea 280px
│             │                                                                  │             │
│             │ ✓ Kaydedildi                                        121 / 2.000  │             │
│             └──────────────────────────────────────────────────────────────────┘             │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                        [ Sonraki soru ]      │ StepFooter
```

- **Kelime:** 36 → **29**. `keeps` Yardım SSS'ine taşınır. Çevrimdışı şeridi aynen.

### 3.7 Seçmeli soru

Aynı tek sütun (760px). Seçenekler `ChoiceCard` (harf kutusu A, B, C; radyo dairesi yok; seçili
kart accent kenar + `brand-soft`); 4'ten fazla seçenek varsa 2 sütunlu ızgara. Masaüstünde kısayol
ipucu kartın sağında `kbd` olarak ("1"), ayrıca açıklama satırı yok.

- **Kelime:** 42 → **33**. `requiredReason` → "Bir seçenek seç." / "Pick an option." (footer'da
  butonun solunda).
- *Not:* harf görsel etiket, tuş 1-4 kısayol; eşleşme `kbd`'de görünür. Kullanıcı testinde bakılır
  (doğrulamadım).

### 3.8 Video ve ses sorusu (K4: halka)

```
 Düşünme
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Aşama 1 / 2 · Soru 2 / 3                                                 Kalan süre  8:58   │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│   (▭ Video · 1 tekrar hakkın var)          ┌──────────────────────────────────────────────┐  │
│   Kendini kısaca tanıt ve bu role neden    │                                              │  │
│   başvurduğunu anlat.          (24/34)     │        [▢ kamera ikonu, gri zemin]           │  │ 520x390
│      ╭────────╮                            │        Kamera, sen başlatınca açılır.        │  │
│      │  0:18  │  Düşünme süren             │                                              │  │
│      │düşünme │  Süre dolsa da kayıt sen   └──────────────────────────────────────────────┘  │
│      ╰────────╯  başlatınca başlar.                                                          │ TimerRing 128px
│   ✎ Not al                              ⌄                                                    │
│   Yazarak cevaplamam gerekiyor                                                               │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                        [ Kaydı başlat ]      │

 Kayıt: sağ bölge canlı görüntü + üstünde "(● Kayıtta)" çipi; sol bölgede halka cevap süresini
 gösterir ("0:53 kaldı"), altında "Süre bitince kayıt kendiliğinden durur."; altta ince yükleme
 çizgisi (yalnız yavaşlarsa metin). Dolu buton "Cevabı bitir".
 Gözden geçir: sağda kendi kaydı (oynatıcı), dolu "Bu cevabı kullan", footer'ın solunda outline
 "Tekrar çek (1 hakkın kaldı)". (Mevcut ikili korunur.)
```

- **Metin:** dolu "Kaydı başlat" / "Start recording"; erişim bağlantısı "Yazarak cevaplamam
  gerekiyor" / "I need to answer in writing"; `thinkOverFlexible` halkanın yanında aynen.
- **Kelime:** düşünme 52 → **41**, kayıt 50 → **39**.
- **Halka:** düşünmede ve cevapta aynı `TimerRing` (128px, accent, `tnum`); saniyede bir adım kısalır,
  kayan animasyon yok, kırmızıya dönmez; son 10 saniyede yalnızca etiket değişir ("Son saniyeler").
  Esnek düşünmede süre dolunca halka boş kalır, metin "Düşünme süren doldu. Hazır olduğunda başlat."
  Ekran okuyucu: mevcut dakika başı duyuru korunur, halka `role="img"` + `aria-label`.
- **Kalan:** tekrar hakkı her durumda görünür; yazılı alternatif bağlantısı açılır alana **girmez**;
  "Kayıtta" noktası ink.
- **Ses sorusu:** sağ bölgede canlı seviye çubukları (gerçek veri).
- **1024:** önizleme 440x330; tek sütunda önizleme sorunun altında, halka önizlemenin sol üstünde.

### 3.9 Dosya sorusu

Tek sütun 760px. Sürükle-bırak alanı (dosya ikonu, "Dosyanı buraya bırak", çipler `PDF` ·
`en fazla 1 MB`). **G2:** dosya yokken footer'daki dolu buton "Dosya seç" (seçiciyi açar); yüklenince
alan dosya kartına döner (`file-check`, ad, boyut, "Değiştir" metin bağlantısı) ve dolu buton
"Sonraki soru" olur.

- **Kelime:** 47 → **32**. `keepsPrevious`, `keptPrevious`, `cut` aynen.

### 3.10 Bitti ve anket (`/done`)

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│   ╭──────────────────────────────╮         Bu deneyim nasıldı?                               │
│   │ [done çizimi 400x200: zarf,  │         ┌────┐┌────┐┌────┐┌────┐┌────┐                     │ ChoiceCard x5 (64px)
│   │  tik, kâğıt uçak izi]        │         │ 1  ││ 2  ││ 3  ││ 4 ✓││ 5  │                     │
│   ╰──────────────────────────────╯         └────┘└────┘└────┘└────┘└────┘                     │
│   Tamamlandı, teşekkürler Elif.            Hiç iyi değildi            Çok iyiydi             │
│   Aşaman tamamlandı ve ekibe iletildi.     ✎ Yorum ekle                              ⌄       │
│   ┌──────────────────────────────┐         Cevabın değerlendirmeni etkilemez. Ekip adını      │
│   │ SIRADA NE VAR                │         görmez; yalnızca ortalamayı ve isimsiz yorumları   │
│   │ ● Bugün · Aşaman ekibe       │         görür.                                             │
│   │   iletildi.                  │                                                            │
│   │ ○ Ekipten bir kişi           │                                                            │
│   │   değerlendirecek.           │                                                            │
│   │ ○ 12 Eki tarihine kadar sana │                                                            │
│   │   dönülecek.                 │                                                            │
│   └──────────────────────────────┘                                                            │
│   (✓ Kamera ve mikrofon kapatıldı) · Sorun olursa: deniz@ornek.test                           │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬┤
│   Veri hakların                                                     [ Görüşünü gönder ]       │
```

- **Kelime:** 82 → **67** (sabit metinler `saved`, `next`, `surveyNote`, `title` aynen).
- **Kalan:** tarih sözü yalnızca alımda geri dönüş günü varsa; anket kapalıysa sağ bölge yok, sol
  bölge ortalanır ve dolu buton yok (kapanış sayfası).

### 3.11 Sorun kartları (`StatusScreen`)

Tek sütun 560px, ortada: çizim 160x120 + başlık (32/40) + bir cümle + footer'da bir eylem.

| Durum | Çizim | Başlık (mevcut metin, kısaltılmış) | Eylem |
|---|---|---|---|
| Link süresi doldu (`p2t11-11`) | `expired` | Bu linkin süresi dolmuş | Yeni link iste (dolu) |
| Alım kapandı (`hiringClosed`) | `closed` | Bu pozisyon için değerlendirme kapandı | iletişim adresi (metin) |
| İkinci sekme | `otherTab` | Değerlendirmen başka bir sekmede açık | Sayfayı yenile |
| Yeniden yükleme kapısı | yok | Kaldığın yerden devam ediyorsun | Devam et |
| Geçersiz link / henüz açılmadı | `expired` | (mevcut) | iletişim / takvime ekle |
| Telefon ya da tablet | `desktopOnly` | 3.0 | Linki kopyala |

Çevrimdışı, "süre doldu" ve "pencere dar" ekran değil **şerit** olarak kalır (`cloud-off`,
`app-window` ikonları); soru ekranının ortasında dikkat çalmamalı.

### 3.12 Bilgiler (`/info`, yalnızca e-posta eksikse)

`StepScreen` split; başlık "Seni doğru kaydedelim", sağda iki alan, footer'da "Devam et". İlerleme
"Adım 1 / 4". V3 ile birlikte.

---

## 4. Yönetici paneli (K7: aynı görsel dil, masaüstü öncelikli)

Yöneticiler bilgisayardan çalışır: birincil genişlik 1280 ve 1440, en küçük 1024. 1024'ün altındaki
mevcut davranış (yan menü üst çubuktaki düğmeyle açılan `Sheet`'e döner, `layout.tsx`) kalır ama
ayrıca tasarlanmaz; geniş tablolar kendi kartı içinde yatay kayar. Yönetici ekranı bir iş aracıdır:
çizim yalnızca boş durumlarda ve iki başarı anında (davet hazır, yayınlandı). Accent, tek dolu buton,
dot + metin durum, onay diyaloğu yok ve 8 sn geri alma kuralları (`RULES.md`) aynen geçerli.

### 4.0 Envanter (HEAD'deki her yönetici ekranı)

Kaynak: `src/app/(manager)/**/page.tsx` ve `src/app/(auth)/**/page.tsx` (36 sayfa, `find` ile sayıldı).
"Plan" sütunu bu belgedeki dilimi, "Görüntü" mevcut ekran görüntüsünü gösterir.

| Ekran | Rota | Çözüm | Görüntü | Öncelik / plan |
|---|---|---|---|---|
| Bugün (davet menüsüyle) | `/dashboard` | ortak | `p2t21-24`, `t14-today-tr`, `p2t20-*` | Yüksek · M2 (sınava dokunur) |
| Alımlar listesi | `/hiring/openings` | işe alım | `t14-openings-tr`, `f1-01`, `13`, `14` | Yüksek · M3 |
| Alım aç | `/hiring/openings/new` | işe alım | `02`, `03`, `04`, `f1-05`, `f1-10` | Yüksek · M4 |
| Alım genel bakış (huni, hazırlık, yayın) | `/hiring/openings/[id]` | işe alım | `p2t19-overview-*`, `f1-03`, `t15-03`, `ff-10` | Yüksek · M5 |
| Değerlendirme özeti | `/hiring/openings/[id]/assessment` | işe alım | `t15-11`, `t15-19` | Orta · M6 (Genel bakışa katılır) |
| Kurucu | `/hiring/openings/[id]/assessment/edit` | işe alım | `t15-05`, `t15-f1-03`, `t18-*` | Yüksek · M6 |
| AI taslağı | `/hiring/openings/[id]/assessment/ai` | işe alım | `t17-*` | Orta · M6 |
| Puan kartı ve ağırlıklar | `/hiring/openings/[id]/assessment/scorecard` | işe alım | `t16-*` | Orta · M6 |
| Aday önizlemesi | `/hiring/openings/[id]/assessment/preview` | işe alım | `p2t19-preview-*`, `t19-*` | Orta · M6 |
| Adaylar sekmesi | `/hiring/openings/[id]/candidates` | işe alım | `p2t18-*`, `p2t21-28`, `-33`, `-34` | Yüksek · **plan 3 uygular** (4.8) |
| Ekip ve kurallar | `/hiring/openings/[id]/settings` | işe alım | `p2t19-settings-survey-off` | Orta · M7 |
| Aday davet et (sayfa ve `Sheet`) | `/hiring/invite` + Sheet | işe alım | `p2t17-*`, `p2t19-overview-invite-sheet`, `p2t21-25..27`, `-31` | Yüksek · M8 |
| Pozisyonlar listesi / yeni / detay | `/library/positions`, `/new`, `/[id]` | ortak kütüphane | `screenshot-…-67`, `-73`, `07` | Düşük · M9 |
| Yetkinlikler listesi / yeni / detay | `/library/competencies`, `/new`, `/[id]` | ortak kütüphane | `t14-competency-en`, `ff-01`, `ff-02` | Orta · M9 |
| Skalalar | ayrı rota **yok** (`libScales` metinleri var; yetkinlik ekranının içinde olduğunu varsaydım, açmadım) | ortak | - | M9 içinde |
| Ayarlar (organizasyon, kullanıcılar, roller, denetim özeti) | `/settings` | ortak | `ff-01`, `ff-02` (AI kullanımı) | Düşük · M10 |
| Denetim kaydı | `/settings/audit` | ortak | yok | Düşük · M10 (yoğun kalır) |
| Kullanıcı davet et | `/settings/users/new` | ortak | yok | Düşük · M10 |
| Giriş | `/login` | ortak | yok | Düşük · M10 |
| Hesap kurulumu (davet linki) | `/setup/[token]` | ortak | yok | Düşük · M10 |
| Öğrenciler listesi / yeni / sonuç | `/exam/students`, `/new`, `/[id]` | **sınav (canlı)** | koddan (görüntü yok) | Düşük · E1 |
| Sınavlar listesi / yeni / detay | `/exam/exams`, `/new`, `/[id]` | **sınav (canlı)** | koddan | Düşük · E1 |
| Soru bankası / soru | `/exam/bank`, `/[id]` | **sınav (canlı)** | koddan | Düşük · E1 |
| Geliştirici UI sayfası | `/dev/ui` | iç | - | Kapsam dışı |

Plan 3'ün ekleyeceği ekranlar (aday detayı, inceleme ve puanlama, karşılaştır, karar) henüz yok;
görsel tasarımları 4.8'de, uygulaması plan 3'te.

### 4.1 Teşhis

Kelime sayıları metin anahtarlarından ve ekran görüntülerinden yaklaşık sayıldı (yan menü ~17 kelime
her ekranda ortak, sayıya dahil değil).

| Ekran | Görünen kelime | Rakip eylem | İnsan nerede kayboluyor |
|---|---|---|---|
| Bugün (`p2t21-24`, `t14-today-tr`) | Başlık ~9, satır başına ~12; 10 satır ~130 | Davet menüsü + her satırda "İncele" | **İşe alımdan hiçbir şey yok:** başlık "145 sonuç incelemenizi bekliyor" yalnızca sınav kuyruğu; işe alım modülünün `today()` fonksiyonu boş dizi döndürüyor (`src/solutions/hiring/module.ts:33`, testi `module.test.ts:45`). Alım yürüten biri "bugün ne yapmalıyım?" sorusunun cevabını burada bulamıyor. Ayrıca sınav metni "siz" ("incelemenizi", "davet edin"), işe alım metni "sen" ("Rolün alım açamaz"): aynı panelde iki hitap. |
| Alımlar listesi (`f1-01`, `t14-openings-tr`) | 1 satırla ~41 | 1 (Alım aç) | Tablo, 3-4 alımlık bir liste için soğuk; huni yalnızca "Henüz davet yok" ya da tek metin; hangi alımın ilgi istediği satırdan okunmuyor. Boş durum iyi (tek eylem) ama görselsiz ve küçük. |
| Alım aç (`04`) | ~74 | 3 başlangıç seçeneği + pozisyon + ilan | İki numaralı kart tek sayfada; ilan metni "isteğe bağlı" ama AI seçeneği ona bağlı; aday tarafındaki "bir ekran bir karar" yok. |
| Genel bakış, taslak (`f1-03`, `t15-03`) | ~55 | Kapalı "Yayınla" + 4 satır bağlantısı | "Kaç adım kaldı?" özeti yok; kapalı Yayınla en görünür nesne (aday tarafındaki 1 numaralı sorunun aynısı). |
| Genel bakış, yayında (`p2t19-overview-above/below`) | ~58 + yorumlar | Aday davet et + Tüm adaylar | Huni üç sayı, aralarında akış hissi yok; "dikkat isteyen" (talep, dolan link) burada değil, Adaylar sekmesinin içinde. |
| Değerlendirme (`t15-11`, `t15-05`, `t17-03`, `t16-f1-08`, `p2t19-preview-bar`) | Kurucuda alan başına TR + EN çifti; puan kartı ~110 | **İki kat sekme:** üstte 4 (Genel bakış, Adaylar, Değerlendirme, Ekip ve kurallar), altta 5 (Özet, Kurucu, AI taslağı, Puan kartı, Önizleme) | 9 sekme etiketi; kullanıcı hangi kattaki sekmede olduğunu kaybediyor. Önizleme çubuğunda "Mobil görünüm" anahtarı var; K2 ile aday telefonda yapamadığı için artık yanlış bir vaat. |
| Adaylar sekmesi (`p2t21-28`, `p2t18-11`) | Satır ~28, 4 satır + uyarı ~140 | Satır başına 2 outline + talep kartı | 1. bölümde anlatıldı: yardım metni her satırda, talepler ad hücresinde. |
| Ekip ve kurallar (`p2t19-settings-survey-off`) | ~150 (anahtarların toplamı 314) | Kaydet (sayfa ortasında) + Alımı kapat | "Kaydet" bloklardan birinin altında; hangi blokları kaydettiği belirsiz; sabit kural (bağımsız değerlendirme) ayarla aynı görünüyor. |
| Davet sayfası (`p2t21-25`) | ~75 | 3 radyo grubu + kapalı buton | Alım seçilmeden "Son gün" satırında yalnızca "Değiştir" görünüyor, değer boş (ekran görüntüsünde); neyi değiştirdiği okunmuyor. |
| Yetkinlik detayı (`t14-competency-en`, `ff-01`) | 14 alan (ad, tanım, 5 çapa; her biri TR + EN) | Kaydet + Arşivle + AI çapa öner | Yan yana TR/EN kutuları ekranı bir form duvarına çeviriyor; 1-5 skalası görsel bir merdiven değil, düz liste. |
| Pozisyonlar (`screenshot-…-67`, `-73`) | ~25 | 1 | Boş durum ve arşiv çipi iyi; görsel yok. |
| Ayarlar (`/settings`) | 4 bölüm tek sayfada (koddan) | Bölüm başına kendi eylemi | Uzun tek sayfa, bölümler arası atlama yok. |
| Sınav ekranları | Koddan (görüntü yok) | - | Panel kabuğu ve `PageHead` ortak; işe alımda yapılacak kabuk değişikliği bunları da değiştirir. |

**Beş büyük panel sorunu:** (1) Bugün işe alım için boş ve iki hitap karışık; (2) alım içinde iki kat
sekme (9 etiket); (3) taslak alımda kapalı "Yayınla" ekranın en görünür nesnesi, "kaç adım kaldı"
yok; (4) dikkat isteyen işler (talepler, dolan linkler) kendi sekmesinin derininde; (5) form
ekranları (alım aç, ekip ve kurallar, yetkinlik) tek sayfada çok blok, kaydet düğmesinin kapsamı
belirsiz.

**Korunacaklar:** gruplanmış yan menü (HIRING-UX karar 9, mod değiştirici yok); "Bugün"de stat
kutusu olmaması; her satırın bir eyleme gitmesi; dot + metin durum; geri alma şeridi; kurucunun
"Sadece ekip görür" koyu kasası (`vault`) ve soru kontrol çubuğu; puan kartı matrisi (yoğun, doğru);
davetin "bir daha gösterilmez" uyarısı; kör mod kuralları.

### 4.2 Hedef desen: panelin grameri

| # | Kural | Karşılığı |
|---|---|---|
| P1 | **Kabuk: aynı gruplanmış yan menü, ikonlu.** 240px; her öğede 18px lucide ikon (`sun` Bugün, `briefcase` Alımlar, `users` Öğrenciler, `file-text` Sınavlar, `library` Soru bankası, `id-card` Pozisyonlar, `target` Yetkinlikler, `settings` Ayarlar); sağda yalnızca iş bekleyen sayısı (düz sayı, rozet değil, `text-muted`). Aktif öğe `brand-soft` zemin + accent metin (aktif durum). Grup başlıkları kalır. | `ManagerNav` (`src/components/manager/nav`). İkon adları `node_modules/lucide-react` içinde doğrulandı. |
| P2 | **Sayfa başlığı: kicker, başlık, tek satır meta, tek dolu eylem, "⋯" menü.** Meta dot + metin ("● Yayında · Son gün yok · v1"). İkincil eylemler (Alımı kapat, Kopyala, Arşivle) `⋯` menüsünde. | `PanelHeader` (mevcut `PageHead`'in yerine, `components/panel/bits.tsx`). |
| P3 | **En fazla bir kat sekme.** Alımda 4 sekme kalır; "Değerlendirme"nin alt sekmeleri kalkar: Kurucu ve Puan kartı aynı sekmede iki parçalı seçici; "AI taslağı" ve "Önizleme" sekme değil **eylem** (tam sayfa akış / tam ekran katman, çıkış yeri belli); "Özet" Genel bakışa katılır. | 9 etiket → 4 sekme + 2 parçalı seçici. |
| P4 | **Boş durum = çizim + başlık + bir cümle + bir dolu eylem.** İkincil bir metin bağlantısı olabilir. | `EmptyState` (`Illustration` kullanır): `emptyOpenings`, `emptyToday`, `emptyCandidates`, `emptyLibrary`. |
| P5 | **Kart mı tablo mu:** karar isteyen ve az sayıda olan nesne (alımlar, Bugün'deki "sıradaki iş", talepler) kart; çok sayıda ve karşılaştırılan nesne (adaylar, inceleme kuyruğu, denetim kaydı, soru bankası, öğrenciler) **bilerek yoğun tablo**: 52px satır, satır başına tek görünür eylem, diğerleri `⋯`. | `OpeningCard`; tablolar `Table` + `RowMenu`. |
| P6 | **Kurulum adım adım.** "Alım aç" aday tarafıyla aynı `StepScreen` + `StepFooter` akışı (3 adım). Oluşturulduktan sonra rehber Genel bakıştaki **Kurulum** listesidir (`PathSteps`: Değerlendirmeyi kur → Puan kartı → Ekip → Önizle → Yayınla); her satırın tek eylemi var, başlıkta "Kurulum 2 / 5". | `NewOpeningFlow`, `SetupSteps`. |
| P7 | **Gelişmiş kurallar açılır alanda.** Görünen: ekip, son gün, geri dönüş günü. Açılır "Gelişmiş kurallar": en az değerlendirme sayısı, kimlik gizleme, anket, iletişim e-postası. Değişmez kurallar (bağımsız değerlendirme) ayar gibi değil, kilit ikonlu `IconRow` olarak. | `Disclosure`, `IconRow`. |
| P8 | **Kaydetme kapsamı görünür.** Çok alanlı formlarda sayfa ortasında "Kaydet" yerine, değişiklik olunca altta beliren `DirtyBar`: "2 değişiklik kaydedilmedi · Geri al · [Kaydet]". Otomatik kaydeden ekranlarda (kurucu) yalnızca "Kaydedildi" durumu. | `DirtyBar` (`StepFooter`'ın panel varyantı). |
| P9 | **Tek durum sözlüğü.** Her yerde aynı dot tonu ve kelime: Taslak (gri), Yayında (accent), Kapalı (muted); aday: Davet edildi, Linki açtı, Devam ediyor (accent), Tamamladı, Link doldu (ink + kalın, `warn`). Rozet yok. | `status-dot.tsx` + tek `statusVocabulary` haritası. |
| P10 | **İki dil alanı sekmeyle, yan yana değil.** TR ve EN çiftleri `TR | EN` dil seçicisiyle tek alan gösterir; eksik dilde seçicide nokta ("EN ●"). | `LanguageTabs` (kurucu, yetkinlik, pozisyon). |
| P11 | **Aynı bileşenler:** `StepScreen`, `StepFooter`, `Disclosure`, `IconRow`, `FactTiles`, `PathSteps`, `ChoiceCard`, `Illustration` aday tarafıyla aynı dosyalar; panel yalnızca `PanelHeader`, `EmptyState`, `OpeningCard`, `DirtyBar`, `RowMenu`, `LanguageTabs`, `NextTaskCard` ekler. | 5. bölüm. |

### 4.3 Bugün (`/dashboard`)

**Soru:** "Bugün neye bakmalıyım?" İki çözüm aynı ekranda, her satırda küçük çözüm etiketi.

```
┌────────────┬─────────────────────────────────────────────────────────────────────────────────┐
│ Kademe     │  Bugün                                                    [ Davet et ⌄ ]        │ PanelHeader (outline menü)
│ ☀ Bugün  6 │  3 iş seni bekliyor. En eskisi 30 Eyl.                                          │
│ İŞE ALIM   │  ┌───────────────────────────────────────────────────────────────────────────┐  │
│ ▣ Alımlar 2│  │ SIRADAKİ İŞ                                                    İşe alım   │  │ NextTaskCard
│ SINAV      │  │ Ece Bal bir uyarlama istedi                                                │  │
│ ◎ Öğrenci  │  │ "Video yerine yazılı cevap verebilir miyim?" · Ürün Tasarımcısı · 2 dk önce│  │
│ ▤ Sınavlar │  │                                                  [ Talebe bak ]           │  │ tek dolu buton
│ ▥ Soru b.  │  └───────────────────────────────────────────────────────────────────────────┘  │
│ KÜTÜPHANE  │  Dikkat isteyenler                                                              │
│ ▢ Pozisyon │  ┌───────────────────────────────────────────────────────────────────────────┐  │
│ ◎ Yetkinlik│  │ [inbox] 2 açık talep            Ürün Tasarımcısı        İşe alım   Aç ›    │  │ IconRow satırları
│            │  │ [clock] 3 link 48 saatte doluyor 2 alım, 1 sınav        Karışık    Aç ›    │  │
│            │  │ [file]  Taslak v2 yayın bekliyor Destek Uzmanı          İşe alım   Aç ›    │  │
│            │  └───────────────────────────────────────────────────────────────────────────┘  │
│            │  İnceleme kuyruğu · Sınav (145)                                    Tümü ›       │ yoğun tablo (değişmez)
│            │  ┌───────────────────────────────────────────────────────────────────────────┐  │
│            │  │ Zeynep Arslan  Seviye doğrulama · B1   ● 1 AI önerisi onay bekliyor  İncele│  │
│            │  │ ...                                                                        │  │
│ ⚙ Ayarlar  │  └───────────────────────────────────────────────────────────────────────────┘  │
│ EN Kadir KA│  Süren işler (2) ⌄                                                              │ Disclosure
└────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

- **Değişiklik:** başlık sınava özgü "N sonuç incelemenizi bekliyor" yerine ortak "Bugün" + bir cümle
  özet; en önemli tek iş `NextTaskCard`'da ve ekranın tek dolu butonu onda. "Davet et" outline menü
  olur (dolu buton sıradaki işin). İş yoksa: `emptyToday` çizimi + "Bugün bekleyen iş yok." +
  "Davet et" dolu.
- **Veri (yeni, VG değil M2):** işe alım `today()` şu satırları üretir: açık talepler (uyarlama, yeni
  link, veri hakkı), 48 saatte dolan linkler, yayın bekleyen taslak, (plan 3) değerlendirme ve karar
  bekleyenler. "Sıradaki iş" seçimi: veri hakkı talebi > uyarlama talebi > karar bekleyen > en eski
  inceleme (öneri; açık soru değil, M2'de ekiple bakılır).
- **Sınav kuyruğu satırları aynen kalır** (içerik, sütunlar, "İncele"); yalnızca başlıkları ve bölüm
  sırası değişir. **Bayrak:** bu ekran canlı sınavın günlük ekranı; M2 sınav rolündeki kullanıcıda
  satırların birebir aynı kaldığını gösteren bir ekran görüntüsü karşılaştırmasıyla çıkar.
- **Kelime:** başlık bölgesi 9 → ~14 (özet cümlesi), kuyruk aynı; kazanç yönlendirmede.

### 4.4 Alımlar listesi (`/hiring/openings`)

```
│  Alımlar                                                              [ Alım aç ]        │
│  Her alım bir pozisyon için, başı ve sonu olan bir süreç.                                │
│  ( Açık 3 ) ( Taslak 2 ) ( Kapalı 0 )                                                    │ çip filtre
│  ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐   │
│  │ Ürün Tasarımcısı · Ekim       ⋯        │ │ Destek Uzmanı · Ekim          ⋯        │   │ OpeningCard (2 sütun)
│  │ ● Yayında · v1 · son gün 19 Eki        │ │ ● Yayında · v1 · Taslak v2 bekliyor    │   │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭             │ │ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭             │   │ mini huni
│  │ 9 davet · 8 başladı · 8 tamamladı      │ │ Henüz davet yok                        │   │
│  │ [inbox] 2 açık talep                   │ │                                        │   │ yalnızca varsa
│  │ (KA) Kadir Ay                  Aç ›    │ │ (KA) Kadir Ay                  Aç ›    │   │
│  └────────────────────────────────────────┘ └────────────────────────────────────────┘   │
```

- Kart bütünüyle tıklanır (Genel bakışa); kartta tek görünür eylem yok, `⋯` (Kopyala, Kapat).
- **Boş:** `emptyOpenings` çizimi + "İlk alımını aç." + "İlan metnini yapıştırman yeterli, gerisini
  birlikte kuralım." (mevcut metin) + "Alım aç".
- 20'den fazla alımda kart ızgarası aynı sütunlarla tabloya döner (sayıya göre, anahtar yok).
- **Kelime:** 1 kartla ~35; kazanç, ilgi isteyen alımın (talep, bekleyen taslak) karttan okunması.

### 4.5 Alım genel bakış (`/hiring/openings/[id]`)

```
 Yayında
│  Alımlar › Ürün Tasarımcısı                                                              │
│  Ürün Tasarımcısı · Ekim                                     ⋯   [ Aday davet et ]       │ PanelHeader
│  ● Yayında · Son gün 19 Eki · v1                                                         │
│  Genel bakış   Adaylar 9   Değerlendirme   Ekip ve kurallar                              │ tek kat sekme
│  ┌──────────────┐ › ┌──────────────┐ › ┌──────────────┐ › ┌──────────────┐               │ FunnelTiles
│  │ Davet      9 │   │ Başladı    8 │   │ Tamamladı  8 │   │ Değerlendi- │               │ (4. kutu plan 3)
│  │              │   │ ▬▬▬▬▬▬▬▬▭    │   │ ▬▬▬▬▬▬▬▬▭    │   │ rildi    -   │               │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘               │
│  Ortanca 25 dk · tahmin 10 dk. Adaylar tahminden belirgin uzun sürüyor.                   │ tek cümle
│  ┌ Dikkat isteyenler ─────────────────────┐  ┌ Aday deneyimi ──────────────────────────┐ │
│  │ [inbox] 2 açık talep          Aç ›     │  │ 3,9 / 5 · 7 cevap                       │ │
│  │ [clock] 1 link yarın doluyor  Aç ›     │  │ Yorumlar (3)                          ⌄ │ │ Disclosure
│  └────────────────────────────────────────┘  └─────────────────────────────────────────┘ │
│  Yayındaki değerlendirme: v1 · 2 aşama · 8 soru · 20 dk          Değerlendirmeye git ›  │ tek satır

 Taslak
│  ● Taslak · Son gün yok                                      ⋯   [ Yayınla ] (kapalı)    │
│  Kurulum 2 / 5                                                    "3 adım kaldı."        │
│  ① ✓ Değerlendirmeyi kur                              8 soru · 20 dk                     │ SetupSteps (PathSteps)
│  ② ✓ Puan kartında çapalar                            3 yetkinlik                        │
│  ③ ● Ekibi ata                                        Önerilir     [ Ekibe git ] outline│ şu anki adım
│  ④ ○ Adayın göreceğini önizle                         Önerilir                           │
│  ⑤ ○ Yayınla                                                                             │
```

- **Taslakta tek dolu eylem "Yayınla"**; kapalıyken nedeni yanında (mevcut kural) **ve** kurulum
  listesinin şu anki adımında outline bir eylem durur, böylece "şimdi ne yapmalıyım?" sorusunun
  cevabı kapalı butonda değil listede.
- Yayınlandığında `inviteReady` benzeri küçük başarı anı değil, mevcut `ff-10` bildirimi kalır
  (yayın sık olmayan ama önemli an: tek satır + "Aday davet et" dolu).
- Huninin dördüncü ve beşinci kutusu (Değerlendirildi, Karar) plan 3'ün verisiyle dolar; o zamana
  kadar gösterilmez (sus, gürültü değil: playbook 1.7).
- **Kelime:** yayında ~58 → ~50; taslak ~55 → ~45.

### 4.6 Alım aç: rehberli kurulum (`/hiring/openings/new`)

Aday tarafındaki `StepScreen` (split) + `StepFooter`; panelin içinde, yan menü görünür kalır.

```
│  Alım aç                                                                                 │
│  ┌─────────────────────────────┐   ┌──────────────────────────────────────────────────┐ │
│  │ Hangi pozisyon için?        │   │ [ Destek Uzmanı                              ⌄ ] │ │ adım 1
│  │ (34/42)                     │   │  Profil: 3 yetkinlik · ağırlıklar eşit            │ │
│  │ Kütüphanedeki bir pozisyonu │   │  ya da yeni bir ad yaz: "Destek Uzmanı II" ile   │ │
│  │ seç ya da yeni bir ad yaz.  │   │  yeni pozisyon                                   │ │
│  └─────────────────────────────┘   └──────────────────────────────────────────────────┘ │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤
│  ‹ Alımlara dön                                         Adım 1 / 3   [ Devam et ]         │

 Adım 2 "İlan metnin var mı?": büyük metin alanı; altında "AI taslağı için 120 karakter yeter."
   İkincil: "İlan metni olmadan devam et".
 Adım 3 "Nasıl başlayalım?": üç ChoiceCard, ikonlu ve tek satırlık açıklamalı:
   [sparkles] İlan metninden AI taslağı · Önerilen (ilan metni yoksa nedenli kapalı)
   [copy]     Önceki bir alımdan kopyala (seçilince altında alım seçici açılır)
   [file]     Boş başla
   Dolu buton: "Alımı oluştur". Sonra: AI seçildiyse AI taslağı akışına, değilse Genel bakışın
   Kurulum listesine (4.5) gider.
```

- **Kelime:** tek sayfa ~74 → adım başına 20-30.
- **Kalan:** pozisyon arama ve "yeni pozisyon" davranışı, `addJobAd` ("İlan metnini pozisyona
  ekle") seçeneği adım 2'de onay kutusu olarak, tüm hata metinleri aynen.
- **Neden sihirbaz burada da doğru:** alım açmak seyrek, her seferinde baştan düşünülen bir iş;
  kurucu ise sık ve serbest düzenlenen bir iş, sihirbaz olmaz (4.7).

### 4.7 Değerlendirme: kurucu, puan kartı, AI taslağı, önizleme

```
│  Genel bakış   Adaylar   Değerlendirme   Ekip ve kurallar                                │
│  [ Kurucu | Puan kartı ]                 ✓ Kaydedildi   [AI ile öner]   [ Önizle ]       │ tek dolu: Önizle
│  ┌──────────────────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1 Tanışma     10 dk  │  │ (▭ Video)  Soru 1 / 3 · Tanışma                    ⋯     │  │
│  │  ▭ Bize kendinden... │  │ [ TR | EN ● ]                                            │  │ LanguageTabs
│  │  ◉ Hangisi CRM...    │  │ Soru metni                                               │  │
│  │  🎙 Zor bir müşteri.. │  │ [ Bize kendinden bahset.                             ]   │  │
│  │  + Soru ekle         │  │ Ölçtüğü yetkinlik: (İletişim ×) (+ ekle)                 │  │
│  │ 2 Derinlik    10 dk  │  │ Süre ve haklar: 30 sn düşünme · 2 dk cevap · 1 tekrar  ⌄ │  │ Disclosure
│  │  + Soru ekle         │  │ ┌ SADECE EKİP GÖRÜR (vault) ────────────────────────────┐ │  │ mevcut koyu kasa
│  │ + Aşama ekle         │  │ │ Amaç · iyi cevap örnekleri · kırmızı bayraklar       │ │  │
│  │ 2 aşama · 20 dk      │  │ └──────────────────────────────────────────────────────┘ │  │
│  └──────────────────────┘  └──────────────────────────────────────────────────────────┘  │
│  Soru kontrolü: 2 öneri  Göster ›                                         (mevcut çubuk) │
```

- **Sekme katı:** "Özet" kalkar (içeriği Genel bakıştaki "Yayındaki değerlendirme" satırı ve
  kurucunun sol rayının altındaki "2 aşama · 20 dk" özeti); "AI taslağı" sağ üstte outline eylem,
  açınca tam sayfa akış (öneri kartları birer birer, "3 / 7 öneri incelendi", `StepFooter`'da
  "Kabul et" / "Atla"); "Önizleme" dolu eylem, tam ekran katman, üst çubukta "Önizlemeden çık".
- **Önizleme (K2 etkisi):** çubuktaki "Mobil görünüm" anahtarı kaldırılır (aday telefonda
  yapamıyor); yerine "1024 genişlik" anahtarı (aday için en küçük masaüstü). Ayrıca telefon
  "bilgisayardan aç" ekranı önizlemede bir adım olarak görülebilir.
- **Kurucu:** TR/EN yan yana alanlar `LanguageTabs` ile tek alana iner (görünen alan sayısı yarıya);
  süre, düşünme, tekrar hakkı, zorunluluk tek satırlık özetin arkasında açılır alan. Aşama taşıma ve
  silme eylemleri `⋯` menüsünde (silme 8 sn geri alma ile, mevcut).
- **Puan kartı:** matris aynen (yoğun, doğru); "Ağırlıklar" kartı tek satır özet + açılır alan
  ("Eşit: genel puan düz ortalama"); "Karar kuralı" `IconRow` (`lock` ikonu, ayar değil bilgi).
  Taslak/yayındaki seçici sağ üstte kalır. "Puan kartını kaydet" yerine `DirtyBar`.
- **Kelime:** sekme etiketleri 9 → 4 + 2; kurucu düzenleyicisinde görünen alan ~7 → ~4.

### 4.8 Adaylar sekmesi, aday detayı ve inceleme (tasarım burada, **uygulama plan 3**, K5)

Plan 3 bu ekranları yeniden kuruyor (HIRING-UX 5.12-5.17); davranış oradaki gibi, görsel katman
bu belgeden. Plan 3 başlamadan önce bu bölüm plan 3'ün girdisi olarak verilir.

**Adaylar sekmesi (`/hiring/openings/[id]/candidates`):**

```
│  Genel bakış   Adaylar 9   Değerlendirme   Ekip ve kurallar                              │
│  ▣ Açık talepler (2)                                                        Göster ⌄     │ RequestsStrip
│  ( Tümü 9 ) ( Karar bekliyor 2 ) ( Devam ediyor 3 ) ( Davet edildi 2 )   [ Ara...     ]  │ çip filtre (5.12)
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Aday               Durum            İlerleme   Değerlendirme  Genel puan  Son hareket │ │ yoğun tablo
│  │ (EK) Elif Kaya     ● Devam ediyor   ▬▬▭ 1/2    -              -           6 dk önce ⋯│ │
│  │      Süre uyarlaması                                                                  │ │
│  │ (CD) Can Demir     ● Tamamladı      ▬▬▬ 2/2    1/2            Önce sen    şimdi     ⋯│ │ bağımsızlık kuralı
│  │                                                               değerlendir             │ │
│  │ (DA) Deniz Ak      ● Link doldu     ▭▭▭ 0/2    -              -           -         ⋯│ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│  ⋯: Yeni link üret (altında: "Eski link hemen çalışmaz olur; aday kaldığı yerden devam    │
│     eder.") · 7 gün uzat                                                                  │
```

- Satır başına kelime 28 → ~11; satır tıklanınca aday detayı (plan 3). Boş: `emptyCandidates` +
  "Henüz aday yok." + "Aday davet et". Kör modda ad yerine "Aday 14", e-posta yok (mevcut kural).

**Aday detayı (`/hiring/candidates/[id]`, plan 3):** `PanelHeader` (ad, alım, durum, deneme seçici);
solda tek kat sekme `Özet · Cevaplar · Değerlendirmeler · Kayıt`; sağda yapışkan 360px **Karar rayı**:
üstte `PathSteps` ile "Karar için: ✓ 2/2 değerlendirme · ● Karar" hazırlığı, ortada karar seçenekleri
`ChoiceCard` (İlerlet / Beklet / Devam etmiyor, büyük satırlar), gerekçe, tek dolu "Kararı kaydet"
(undo 8 sn). Yetkinlik özeti `DotStrip` (SVG, 1-5 ekseni), ayrışma dot + metin.

**İnceleme ve puanlama (`/hiring/candidates/[id]/review`, plan 3):**

```
│  ‹ Adaylar  Elif Kaya · Ürün Tasarımcısı               4 adaydan 2.  ‹ ›   ✓ Kaydedildi 14:02 │
│  Aşama 1 ✓ · [Aşama 2: Vaka] · Aşama 3                                                     │
│  ┌──────────────────────────────────────────────────┐ ┌───────────────────────────────────┐ │
│  │ Soru 1 / 2 · video 2:54                          │ │ BU SORU NEYİ ÖLÇÜYOR              │ │
│  │ [ video oynatıcı ]                               │ │ Problem çerçeveleme               │ │
│  │ Transkript (ara)                                 │ │ [1][2][3][4][5]   [Kanıt yok]     │ │ ChoiceCard square
│  │ 00:42 ...                                        │ │ 3 · Beklenen: "Sorunu en az iki   │ │ çapa tam metin
│  │ Sadece ekip görür: amaç, iyi cevap örnekleri   ⌄ │ │ olası nedene ayırır..."           │ │
│  └──────────────────────────────────────────────────┘ │ Not                               │ │
│                                                       │ Bu aday: 3 / 5 puan verildi       │ │
│                                                       │ [ Sonraki soru → ]                │ │
│                                                       └───────────────────────────────────┘ │
```

Yeni olan yalnızca görsel dil: puan segmentleri `ChoiceCard` kare varyantı (seçili = aktif durum),
çapanın tam metni segmentin altında, "Sadece ekip görür" `Disclosure`, ilerleme `QuestionProgress`.
Klavye kısayolları, bağımsızlık ve bütünlük kuralları HIRING-UX 5.14'teki gibi.

**Karşılaştır (plan 3):** HIRING-UX 5.15 aynen; tablo yoğun kalır (P5), görünüm seçici
iki parçalı seçici, boş durum `EmptyState`.

### 4.9 Aday davet et (Sheet ve `/hiring/invite` sayfası)

```
 Form                                        Hazır
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│ Aday davet et                  ✕ │        │ [inviteReady çizimi 96px]        │
│ Ürün Tasarımcısı · Kontrol       │        │ Link hazır                       │
│ [ Tek aday | Liste yapıştır ]    │        │ Elif Kaya için · son gün 25 Eki  │
│ Ad soyad                         │        │ ┌──────────────────────────────┐ │
│ [                              ] │        │ │ https://…/a/Rl7fS-f…         │ │
│ E-posta                          │        │ └──────────────────────────────┘ │
│ [                              ] │        │ [        Linki kopyala         ] │
│ Adayın dili                      │        │ Hazır mesajı gör               ⌄ │
│ [ Türkçe ✓ ] [ English ]         │        │ Bu link bir daha gösterilmez;    │
│ ▦ Son gün 19 Eki       Değiştir  │        │ kapatmadan önce kopyala. ...     │
│ ● Ekipte 1 değerlendirici var,   │        │ Başka aday davet et · Adaylara git│
│   kural 2 istiyor.   Ekibe ekle  │        └──────────────────────────────────┘
├──────────────────────────────────┤
│ [       Linki oluştur          ] │
│  Adayın adını yaz.               │
└──────────────────────────────────┘
```

- **Kelime:** form 75 → **38**; hazır ~99 → **35** (mesaj metni açılır alanda, "Mesajı kopyala"
  orada).
- **Değişenler:** `lead` kaldırılır (bir kez gösterilme bilgisi hazır ekranında); `panelShort`
  (32 kelime) tek satır dot + metin + "Ekibe ekle"; mod seçimi iki parçalı seçici; dil iki kart;
  birincil buton altta yapışkan (`StepFooter` sheet varyantı).
- **`/hiring/invite` sayfası:** aynı form `StepScreen` single içinde; alım seçilmeden "Son gün"
  satırı değer yerine "Önce alım seç" der (bugün yalnızca "Değiştir" görünüyor, `p2t21-25`).
- **Kalan:** "bir daha gösterilmez" uyarısı tam metin; erken doğrulama nedenleri; çoklu yapıştırma
  ön izlemesi (yalnızca kabuğu değişir).

### 4.10 Ekip ve kurallar (`/hiring/openings/[id]/settings`)

```
│  Genel bakış   Adaylar   Değerlendirme   Ekip ve kurallar                                │
│  ┌ Ekip ─────────────────────────────────────────────────────────────────────────────┐   │
│  │ (KA) Kadir Ay · Sahip   (EY) Ece Yıldız · Değerlendirici   [ + Değerlendirici ekle ]│   │ avatar listesi
│  │ Her adayı 2 kişi değerlendirir.                                          Değiştir  │   │
│  └───────────────────────────────────────────────────────────────────────────────────┘   │
│  ┌ Aday iletişimi ───────────────────────────────────────────────────────────────────┐   │
│  │ Son gün [19.10.2026]   Geri dönüş sözü [7] gün   İletişim [deniz@ornek.test]       │   │
│  └───────────────────────────────────────────────────────────────────────────────────┘   │
│  [lock] Değerlendiriciler birbirinin puanını kendi puanlarını gönderince görür.          │ IconRow, ayar değil
│  Gelişmiş kurallar                                                                    ⌄  │ Disclosure: en az değ.
│                                                                                          │ sayısı, kimlik gizleme,
│  Alımı kapat  (metin eylem; 8 sn geri alma)                                              │ anket
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  2 değişiklik kaydedilmedi                               Geri al   [ Kaydet ]            │ DirtyBar (yalnız değişince)
```

- **Kelime:** ~150 → ~70 görünen (gelişmiş kurallar kapalıyken).
- **Kalan:** anket açıklaması (ekibin neyi gördüğü, 5 cevap kuralı) açılır alanda aynen; "Alımı
  kapat" onay diyaloğu olmadan, geri alma şeridiyle (RULES kural 4).

### 4.11 Daha hafif notlar

- **Kütüphane, yetkinlik detayı:** `LanguageTabs` (TR | EN); çapalar 1-5 dikey bir "merdiven"
  (`AnchorLadder`: 1, 3, 5 zorunlu işaretli, 2 ve 4 açık gri "isteğe bağlı"); "AI ile çapa öner"
  outline; "Nerede kullanılıyor" sağ kartı aynen; "Arşivle" `⋯` menüsünde.
- **Kütüphane, pozisyonlar ve yetkinlikler listesi:** tablolar kalır (kütüphane bir başvuru listesi);
  boş durum `emptyLibrary` çizimiyle; "Arşivdekiler (n)" çipi aynen.
- **Ayarlar:** tek sayfa kalır ama solda yapışkan bölüm gezintisi (Organizasyon · Kullanıcılar ·
  Roller · Denetim); her bölümün kendi `DirtyBar`'ı yok, sayfa tek `DirtyBar`. Denetim kaydı ayrı
  sayfada yoğun tablo (P5), değişmez. Kullanıcı davet sayfası `StepScreen` single.
- **Giriş ve hesap kurulumu:** ortalanmış tek kart, Kademe adı, tek dolu buton; çizim **yok**
  (güvenlik ekranı sade kalır). Hata metinleri aynen.

### 4.12 Sınavın yönetici ekranları (düşük öncelik, canlı)

Sınav canlıda (MEMORY: 2026-09-30'dan beri main ve prod). Bu ekranlar için yalnızca **tutarlılık**
önerilir, yeniden tasarım değil:

- Ortak kabuk (P1 yan menü ikonları), `PanelHeader` (P2), `EmptyState` (P4) ve durum sözlüğü (P9)
  ortak bileşenlerden gelir; bunlar değişince sınav ekranları **kendiliğinden** değişir. Her biri
  için bayrak: M1 sınav ekranlarına dokunur.
- Sınava özgü içerik (öğrenci sonucu sekmeleri, AI önerisi onayı, bütünlük, soru bankası düzenleyicisi,
  sınav oluşturma formu) bu planda **değişmez**. Sınav metinlerinin "siz" hitabı değişmez (açık soru 3).
- K8: sınavın aday tarafındaki "Genelde aynı gün dönülür" / "e-posta ile dönülecek" metinleri
  şimdilik kalır; e-posta ve talep işleme altyapısı sonra kurulacak.
- E1 dilimi (isteğe bağlı, en son): sınav listelerinin boş durumları ve sayfa başlıkları, yalnızca
  sınav penceresi dışında ve önce/sonra ekran görüntüsü karşılaştırmasıyla.

---

## 5. Yeni paylaşılan bileşenler

Hepsi `src/components/hiring/visual/` altında (işe alıma özel); ikinci bir çözüm isterse `ui/`'ye
taşınır. Kademe-owned dosyalar `// kademe-owned` başlığı taşır (RULES.md shadcn bölümü).

| Bileşen | Props (öz) | Yerini aldığı / kullanıldığı yer |
|---|---|---|
| `classifyDevice` (saf fonksiyon) | `({ ua, chMobile, coarse, anyFine, hasDisplayMedia, maxTouchPoints }) => "desktop" \| "phone" \| "tablet" \| "unknown"` | Yeni. Sunucuda `headers()`'tan (UA, `Sec-CH-UA-Mobile`), istemcide `matchMedia` ve `navigator`'dan çağrılır. Dil sınavının `isMobileDevice`'ına dokunmaz. |
| `DesktopGate` | `{ serverClass; children }`; `phone` ise sunucuda doğrudan `DesktopOnlyScreen`; `unknown`/`tablet` ise istemci karar verir; `desktop` ise `children` + `NarrowWindowStrip` | Yeni. `src/app/a/[token]/` işe alım dalının layout'unda, sorulardan ve rızadan önce. |
| `DesktopOnlyScreen` | `{ token; facts: { minutes; deadline }; emailOption?: boolean }` (aşama adı, soru **almaz**) | Yeni (3.0). |
| `NarrowWindowStrip` | `{}`; `resize` dinler, < 1024'te görünür | Yeni. Engel değil. |
| `StepFooter` | `{ primary: ReactNode; reason?: string; secondary?: ReactNode; back?: { label; onClick }; progress?: ReactNode }` | `action-bar.tsx` (`ActionBar`). Görünüm alanına yapışık; içerik altına eşit `padding-bottom`. |
| `JourneyProgress` | `{ steps: number; current: number; label: string }` (yalnızca sayı; aşama adı **almaz**) | Yeni; `StepFooter`'ın `progress` yuvasında. `<ol>` + `aria-current="step"` + görünür "Hazırlık · Adım 1 / 4". |
| `QuestionProgress` | `{ total: number; current: number }` | `stage-runner.tsx` içindeki sürekli çubuk. |
| `StepScreen` | `{ layout: "split" \| "single"; illustration?: IllustrationName; kicker?; title; titleRef; lead?; aside?: ReactNode; children }` | `landing.tsx`, `device-check.tsx`, `practice.tsx`, `stage-intro.tsx`, `done.tsx` içindeki elle kurulan başlık blokları. `split` < 1000px'te tek sütuna iner. |
| `Disclosure` | `{ label; icon?: LucideIcon; defaultOpen?: boolean; variant: "row" \| "inline"; children }` | `Collapsible`'ın landing'deki iki kullanımı, not alanları, "Hâlâ olmuyor mu?", anket yorumu, davet mesajı. |
| `IconRow` | `{ icon: LucideIcon; title; detail?; tone?: "default" \| "negative" }` | Onay listesi, aşama kuralları, cihaz kontrolü sol listesi. |
| `FactTiles` | `{ items: { icon: LucideIcon; value: string; label: string }[] }` (2-3 öğe) | Karşılama, aşama girişi, yönetici huni (Görev 19). |
| `PathSteps` | `{ steps: { title; detail?; state?: "done" \| "current" \| "todo" }[] }` | Karşılama "Nasıl gidecek", Bitti "Sırada ne var", telefon ekranı adımları, yönetici hazırlık listesi. |
| `ChoiceCard` / `ChoiceCardGroup` | `{ type: "single" \| "multi"; value; onChange; items: { value; label; marker?: string \| LucideIcon; shortcut?: string; description? }[]; size?: "md" \| "square" }` | `choice-activity.tsx`, ek süre, anket 1-5, davet dili ve modu. |
| `TimerRing` | `{ remaining: number; total: number; label: string; size?: 96 \| 128 }`; `tnum`; `role="img"` | Isınma, video ve ses düşünme ve cevap sayacı (K4). Aşama sayacı sayısal kalır. |
| `Illustration` | `{ name: IllustrationName; size?: "hero" \| "spot" }`; `aria-hidden` | Yeni; 11 çizim (2.2). |
| `StatusScreen` | `{ illustration; title; body; action?; footer? }` | `closed.tsx`, link sorunu sayfaları, ikinci sekme ekranı. |
| `MediaStage` | `{ state: "think" \| "record" \| "review"; preview; aside }` | `recorded-activity.tsx` içindeki yerleşim (mantık aynı dosyada kalır). |

**Panel bileşenleri (K7, 4. bölüm):**

| Bileşen | Props (öz) | Yerini aldığı / kullanıldığı yer |
|---|---|---|
| `PanelHeader` | `{ kicker?; title; meta?: ReactNode; primary?: ReactNode; menu?: MenuItem[] }` | `components/panel/bits.tsx` içindeki `PageHead`. **Sınav ekranları da kullanır (bayrak).** |
| `ManagerNav` v2 | mevcut props + öğe başına `icon` ve `count?` | `components/manager/nav`. **Sınav menüsünü de çizer (bayrak).** |
| `EmptyState` | `{ illustration: IllustrationName; title; body; action; secondary? }` | Alımlar, Bugün, Adaylar, kütüphane boş durumları; `ui/empty.tsx`'in üstüne. |
| `NextTaskCard` | `{ solution: string; title; detail; action: { label; href } }` | Bugün'ün "Sıradaki iş" kartı. |
| `OpeningCard` | `{ opening; funnel: { invited; started; completed }; attention?: string; owner }` | Alımlar tablosu (20 alıma kadar). |
| `FunnelTiles` | `FactTiles` varyantı, kutular arasında `chevron-right` | Genel bakış hunisi. |
| `SetupSteps` | `PathSteps` + her satırda tek eylem ve "Kurulum n / 5" | Taslak alım hazırlık listesi. |
| `DirtyBar` | `{ changes: number; onSave; onReset; saving? }` | Ekip ve kurallar, puan kartı, ayarlar, yetkinlik formu. |
| `LanguageTabs` | `{ value: { tr; en }; onChange; required?: ("tr" \| "en")[] }` | Kurucu, yetkinlik, pozisyon alan çiftleri. |
| `AnchorLadder` | `{ levels: { n; required; tr; en }[] }` | Yetkinlik çapaları. |
| `RowMenu` | `{ items: { label; detail?; onSelect; disabledReason? }[] }` (`DropdownMenu`) | Aday satırı eylemleri, alım kartı, kurucu aşama eylemleri. |
| `RequestsStrip` | `{ requests; canClose }` | Adaylar sekmesi (plan 3), Genel bakış "Dikkat isteyenler". |
| `CandidateRow` | `{ candidate; blind; canAct }` | Adaylar tablosu (plan 3). |

**Yeni token'lar** (globals.css `@theme`): `--color-illus-fill`, `--color-illus-tint`,
`--color-illus-sage`, `--color-illus-warm` (değerler 2.2). Başka renk yok.

---

## 6. Uygulama dilimleri ("plan 2b")

Her dilim tek başına yayınlanabilir ve test edilebilir; tablo uygulama sırasıdır. Numara eşlemesi
(sürüm 1 → sürüm 2): V0 → V1, V1 → V2, V2 → V3, V3 → V4, V4 → V5, V5 → V6, V6 → V7, V7 → V7b;
sürüm 1'in V8'i (Adaylar sekmesi) ve V9'u (genel bakış) plan 3'e gitti (K5); VG yeni. Boyut: S ≈ yarım
gün, M ≈ 1 gün, L ≈ 2 gün (tek geliştirici + inceleme; tahmin, ölçülmedi).

| # | Dilim | Boyut | Bitti sayılır | Risk |
|---|---|---|---|---|
| **VG** | **Masaüstü kapısı (ilk, tek başına):** `classifyDevice`, `DesktopGate`, `DesktopOnlyScreen` (yalnız "Linki kopyala"), `NarrowWindowStrip`, pencere < 640'ta "Aşamayı başlat" nedeni; `faqPhoneA` ve `needDevice` metinleri; `HIRING-UX.md` 6.15 yerine geçen metin | M | `classifyDevice` için UA matrisi testi: iPhone Safari, Android Chrome telefon, Android tablet, iPad (iPadOS masaüstü UA + dokunma), Mac Safari, Windows Chrome dokunmatik dizüstü (`any-pointer: fine` var), Chromebook, dar masaüstü penceresi (engellenmez), DevTools öykünmesi. Sızıntı testi: telefon ekranının props'unda aşama adı ve soru yok. Elle: gerçek telefonda ve gerçek dokunmatik dizüstünde (Claude in Chrome yalnızca masaüstü tarafını görür; telefon testi kullanıcı ya da cihaz gerektirir) | **Yanlış engel** en büyük risk: kural "iki sinyal ya da kesin UA" (3.0). Dil sınavı rotalarına dokunulmamalı (K6) |
| V1 | Belgeler + token + çizim seti: `HIRING-UX.md` 8.6, 6 "Ortak kurallar", `RULES.md` kural 1 ve 9 güncellenir; `illustrations.tsx` (11 SVG) | S | Birim test: her çizim `aria-hidden`, `<image>`/`href` yok, renkler yalnız `var(--color-illus-*)`; `theme.test.ts` yeni token'ları görür | Düşük |
| V2 | Paylaşılan bileşenler (5. bölüm) + `ActionBar` → `StepFooter` göçü | M | Saf fonksiyon testleri (ilerleme, halka oranı); mevcut ekranlar geçiyor; footer içeriği örtmüyor (1280x720'de son alan görünür) | `shadcn-vendored.test.ts`; odak halkası; 44px |
| V3 | Karşılama → Karşılama + Onay (istemci adımı, aynı URL; geri tuşu Karşılama'ya döner) + Bilgiler | M | Rıza kaydı yalnızca "Kabul et ve başla"da; TR/EN eşit; `hiring-candidate-copy.test.ts` geçiyor; `whoShort` testi | Sabit metin testleri (`promise`, `whoPeople`): metin aynı, yer değişir. Geri dönüşte ek süre seçimi korunur |
| V4 | Cihaz kontrolü alt adımları (split, büyük önizleme) + izin reddi çizimi | L | `device-rows.test.ts` değişmeden geçiyor; dolu buton her alt adımda etkin bir eylem; gerçek kamerayla Chrome, Edge ve Safari'de (otomasyon sekmesi kamerayı kanıtlamaz) | 568 satırlık bileşen; tarayıcıya göre izin akışı |
| V5 | Isınma + video/ses (split, `TimerRing`, not açılır alanı, kayıt yerleşimi) | M | `practice.test.ts`, `take.test.ts`, `runner-model.test.ts` geçiyor; reduced motion'da nabız durur | Kayıt ve yükleme mantığına dokunulmaz |
| V6 | Aşama girişi + yazılı + seçmeli + dosya (G2: "Dosya seç" dolu) | M | Soru parçaları; klavye 1-4; dosya yokken dolu buton seçiciyi açar | Sızıntı testi (`pages.test.ts`): `QuestionProgress` yalnız sayı alır |
| V7 | Bitti + anket + `StatusScreen` | S-M | `done-model.test.ts` geçiyor; sabit metinler aynen | Anket kapalıyken dolu buton yok |

**Yönetici dilimleri (K7), aday dilimlerinden sonra.** Sürüm 2'nin V7b'si (davet sheet'i) burada M8.
"Sınav" sütunu: dilim canlı sınav ekranlarına dokunuyor mu.

| # | Dilim | Boyut | Bitti sayılır | Sınav | Risk |
|---|---|---|---|---|---|
| M1 | Panel kabuğu: `ManagerNav` ikon ve sayılar, `PanelHeader` (`PageHead` yerine), `EmptyState`, tek durum sözlüğü, `RowMenu` | M | Menü testi (registry ile sayfa dosyası eşleşmesi) geçiyor; her sayfa başlığında en fazla bir dolu eylem; sınav sayfalarında önce/sonra ekran görüntüsü | **Evet** (kabuk ve `PageHead` ortak) | Sınav ekranlarının görünümü değişir; içerik değişmez. Sınav penceresi dışında çıkar |
| M2 | Bugün: işe alım `today()` (talepler, dolan linkler, yayın bekleyen taslak), `NextTaskCard`, "Dikkat isteyenler", çözüm etiketi, davet outline menü | M | `module.test.ts`'in "boş dizi" beklentisi yeni satırlarla güncellenir; sınav kuyruğu satırları birebir aynı (ekran görüntüsü karşılaştırması); rol başına (sahip, değerlendirici, sınav yöneticisi) doğru satırlar | **Evet** (ortak ekran) | Yetki: değerlendirici talepleri görmemeli (kör mod kuralı, STATUS 321) |
| M3 | Alımlar listesi kartları + boş durum çizimi | S | Açık/Taslak/Kapalı sayıları aynı; boş sekme metinleri aynı | Hayır | Düşük |
| M4 | Rehberli "Alım aç" (3 adım, `StepScreen` + `StepFooter`) | M | Mevcut oluşturma eylemi ve hata kodları aynen; AI yolunda 120 karakter kuralı; kopyalama yolu | Hayır | Form durumu adımlar arasında korunmalı (geri tuşu) |
| M5 | Alım genel bakış: `SetupSteps` (taslak), `FunnelTiles` + "Dikkat isteyenler" (yayında), `⋯` menü | S-M | Yayınla kapısı ve nedenleri aynen; anket bloğu 5 cevap kuralı aynen | Hayır | Görev 19'un huni testleri |
| M6 | Değerlendirme çalışma alanı: tek kat sekme (Kurucu \| Puan kartı), AI taslağı ve Önizleme eylem; kurucuda `LanguageTabs` ve "Süre ve haklar" açılır alanı; önizlemede "Mobil görünüm" yerine "1024" | L | Kurucu kaydetme kuyruğu ve geri alma testleri geçiyor; derin linkler (`/assessment/edit`, `/ai`, `/scorecard`, `/preview`) çalışmaya devam ediyor (yönlendirme ya da aynı sayfa) | Hayır | En büyük panel dilimi; sekme rotaları test ediliyor (registry), derin link kırılmamalı |
| M7 | Ekip ve kurallar: kartlar, kilitli kural `IconRow`, "Gelişmiş kurallar", `DirtyBar`, "Alımı kapat" geri almalı | S-M | `opening-rules` testleri geçiyor; kaydedilmemiş değişiklikle sayfadan çıkarken uyarı yok, değişiklik `DirtyBar`'da kalır | Hayır | Kaydetmenin kapsamı tek eylemde toplanmalı (bugün iki ayrı form olabilir; doğrulanmadı) |
| M8 | Davet sheet'i ve `/hiring/invite` sayfası (4.9) | S-M | `form-rules.test.ts` geçiyor; 30 sn / 4 tık elle ölçülür; alım seçilmeden "Son gün" boş görünmüyor | Hayır (davet menüsü Bugün'de ortak, M2'de) | Çoklu yapıştırma (700 satır) görünümü |
| M9 | Kütüphane: `LanguageTabs`, `AnchorLadder`, boş durumlar | M | Kütüphane testleri geçiyor; "Kademe başlangıç içeriği" notu aynen | Hayır (kütüphane ortak ama sınav kullanmıyor; doğrulanmadı) | Çapa zorunluluk kuralı (1, 3, 5) görünür kalmalı |
| M10 | Ayarlar (bölüm gezintisi, `DirtyBar`), kullanıcı davet, giriş ve kurulum düzeni | S | Ayarlar ve denetim testleri geçiyor | **Evet** (ayarlar ve giriş ortak) | Giriş ekranı: güvenlik metinleri aynen |
| P3-a | Adaylar sekmesi (4.8 tasarımı) | M | Plan 3'ün kabulüyle | Hayır | **Plan 3 uygular** (K5) |
| P3-b | Aday detayı + karar rayı (4.8) | L | Plan 3 | Hayır | **Plan 3 uygular** |
| P3-c | İnceleme ve puanlama görsel katmanı (4.8) | M | Plan 3 | Hayır | **Plan 3 uygular** |
| P3-d | Karşılaştır (HIRING-UX 5.15 + P5) | M | Plan 3 | Hayır | **Plan 3 uygular** |
| E1 | Sınav listelerinde `EmptyState` ve başlık düzeni (isteğe bağlı) | S | Önce/sonra ekran görüntüsü, sınav akışı doğrulama betiği (`verify-exam-flow.ts`) | **Evet** | Canlı ürün; en son ve yalnızca sınav penceresi dışında |

**Her dilimde ortak kontrol:** tek dolu buton; kapalı buton nedeni yanında; em-dash yok; TR/EN anahtar
eşitliği; `hiring-candidate-copy.test.ts`'in yasak kelimeleri ("uyarı", "hile", "başarısız",
"lütfen", "siz"); odak her adım değişiminde başlığa; 1280, 1440 ve 1024 ekran görüntüsü (Claude in
Chrome, kullanıcı kuralı); `scripts/verify-hiring-flow.ts` API üzerinden çalışıyor görünüyor (satır
215 civarı `call(...)`; tamamını okumadım, VG ve V3'te çalıştırılarak doğrulanmalı; sunucu kapısı
API çağrılarını değil yalnızca sayfaları etkiler).

### 6.1 Ne zaman (K5)

**Plan 2'nin Görev 19-21'i bitince, plan 3 başlamadan önce, "plan 2b" olarak: VG, V1-V7 (aday),
sonra M1-M5 ve M8 (panelin en çok kullanılan yüzleri).** M6, M7, M9, M10 plan 3 ile paralel ya da
hemen sonra yapılabilir (plan 3'ün ekranlarıyla çakışmaz). P3-a..d plan 3'ün içinde, bu belgenin 4.8
bölümü girdi olarak. E1 en son ve isteğe bağlı.

**M1 neden panelde ilk:** `PanelHeader`, `EmptyState`, `RowMenu` ve durum sözlüğü plan 3'ün
ekranlarının da yapı taşları; plan 3 onları hazır bulursa ekranlar tek seferde doğru dille kurulur.
M1 ve M2 canlı sınav ekranlarına dokunduğu için sınav penceresi dışında ve ekran görüntüsü
karşılaştırmasıyla çıkar.

**VG neden ilk:** K2 bir güvenlik kararı ve diğer dilimlerden bağımsız; ayrıca diğer dilimlerin
tasarımını sadeleştiriyor (telefon düzeni artık test edilmek zorunda değil, yalnızca 1024-1440).
Plan 4 (gözetim: tam ekran, sekme odağı) bu kapının üstüne kurulur.

---

## 7. Açık sorular (önerilen cevaplarıyla)

Sürüm 1'in beş sorusu K1-K5 ile cevaplandı ve kaldırıldı. Kalanlar:

1. **"Linki e-postama gönder" ne zaman?**
   *Öneri:* e-posta gönderimi geldiğinde (bugün yalnızca `message_outbox` var). VG yalnızca "Linki
   kopyala" ile çıkar; düğme bir bayrakla sonradan açılır. Gerekenler: yeni uç, token başına oran
   sınırı, maskeli adres, gönderimin kaydı.
2. **Klavyeli tablet (iPad + Magic Keyboard ya da Android tablet + fare) engellensin mi?**
   *Öneri: Evet, engellensin.* Bu tarayıcılarda ekran paylaşımı yok ve plan 4 bunu isteyebilir;
   `any-pointer: fine` tek başına yeterli değil, `getDisplayMedia` yokluğu ve tablet UA'sı birlikte
   karar verir. Metin dürüst kalır ("ekip bilgisayardan yapılmasını istiyor"), yanlış tespit için
   "Bilgisayardayım ama..." bağlantısı var.
3. **Panelde tek hitap mı?** Bugün ekranı sınav metniyle "siz" ("incelemenizi", "davet edin"),
   işe alım metinleri "sen" ("Rolün alım açamaz") diyor; ikisi aynı ekranda.
   *Öneri:* ortak ekranlar (Bugün, menü, Ayarlar, Kütüphane) **"sen"**; sınava özgü yönetici
   ekranları sınav canlı olduğu için şimdilik "siz" kalır, dokunuldukları ilk planda "sen"e geçer.
   Aday tarafı hitapları (işe alım "sen", sınav "siz") değişmez.
4. **Bugün'de "Sıradaki iş" seçimi kimin önceliği?**
   *Öneri:* veri hakkı talebi (yasal süre) > uyarlama talebi (aday bekliyor) > karar bekleyen
   aday (plan 3) > en eski sınav incelemesi. Kullanıcı bunu bir sıralama ayarı olarak istemezse
   sabit kalır.

---

## 8. Kabul listesine eklenenler (HIRING-UX 11'e)

- [ ] Dolu buton o anki gerçek eylem; kapalı dolu buton yalnızca ekranda yapılacak başka şey yokken.
- [ ] Dolu buton her aday ekranında aynı yerde (`StepFooter` sağı).
- [ ] Hazırlık ekranlarında `JourneyProgress`, soru ekranlarında `QuestionProgress` görünüyor.
- [ ] Ekran 1280 ve 1440'ta tasarlandığı gibi, 1024'te bozulmadan; 1024'ten dar masaüstü penceresi
      engellenmiyor, şerit görüyor.
- [ ] Telefon ve tablet `DesktopOnlyScreen` görüyor; dokunmatik dizüstü görmüyor.
- [ ] Ekranın başlığı tek soru/iş; alt satır en fazla 12 kelime.
- [ ] Uzun ya da hukuki metin `Disclosure` içinde, etiketi ne olduğunu söylüyor.
- [ ] Çizim yalnızca izinli ekranlarda, `aria-hidden`, doygun accent yok.
- [ ] Yeni görsel öğe ve kapı sızıntı testinden geçti (aşama adı, soru metni hazırlık ve telefon
      ekranlarının props'unda yok).
- [ ] Panel: sayfa başlığında en fazla bir dolu eylem, ikincil eylemler `⋯` menüsünde.
- [ ] Panel: bir alımın içinde en fazla bir kat sekme.
- [ ] Panel: boş durum çizim + başlık + bir cümle + bir eylem.
- [ ] Panel: çok alanlı formda kaydetmenin kapsamı `DirtyBar`'da görünüyor.
- [ ] Panel: dilim sınav ekranlarına dokunuyorsa önce/sonra ekran görüntüsü eklendi ve sınav
      penceresi dışında çıktı.
