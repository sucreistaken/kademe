# Kademe İşe Alım: görsel akış planı ("Airbnb gibi")

Sürüm 4, 2026-10-06. **Sürüm 4 ne değiştirir:** yönetici paneli sihirbaz önceliklidir (her çok alanlı
iş bir rehberli akış, adım başına bir karar, sonunda tek dolu butonlu özet) ve her şeyin tek bakışta
görüldüğü bir kontrol görünümü vardır (K12); 4. bölüm, 5'in panel tablosu, 6'nın yönetici dilimleri
ve 8 buna göre yeniden yazıldı, aday tarafı (1-3) değişmedi.
(Sürüm 1, 2026-10-05, telefon öncelikliydi; sürüm 2 kullanıcı kararlarıyla masaüstüne döndü; sürüm 3
yönetici panelini ekledi, K7.) Yazan: Sally (bmad UX designer) + `airbnb-ux` skill'i (Redesign modu).
Bu bir tasarım planıdır: uygulama kodu değişmedi. Mockup (sürüm 2-3'ün; sürüm 4'ün paneli için mockup yok):
`/private/tmp/claude-501/-Users-sucreistaken-Desktop-Projects-recruitement/8546a935-34ac-48f1-8695-daba2a52b158/scratchpad/visual-flow-mockup.html`
(geçici scratchpad dosyası; kalıcı olsun istenirse `docs/design/` altına kopyalanmalı).

**Kullanıcının isteği:** "Burada çok metin olunca insan ne yapacağını bilmiyor. Airbnb'nin mobil ve
site akışı gibi olsun: biraz görsellik, en sade insanın bile anlayacağı akış."

## 0. Kullanıcı kararları 2026-10-05 ve 2026-10-06

Kullanıcı sürüm 1'in mockup'ını Chrome'da gördü ve şunlara karar verdi (koordinatör üzerinden iletildi).
K9-K11 plan 2b'nin başlığında kayıtlıydı (`docs/superpowers/plans/2026-10-06-hiring-visual-flow.md:15-21`),
burada bir arada dursun diye tabloya eklendi; K12 sürüm 4'ün nedeni.

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
| K9 | Ortak panel ekranları (Bugün, menü, panelin hata sayfası, Ayarlar, Kütüphane) **"sen"** der; yalnızca sınava ait yönetici ekranları bir plan onlara dokunana kadar "siz" kalır. | 4.2 (W9), 4.3, 4.11; 7. bölümdeki eski 3. soru cevaplandı. |
| K10 | Bugün'ün "Sıradaki iş" önceliği: veri hakkı talebi > uyarlama talebi > karar bekleyen > en eski sınav incelemesi. | 4.3. **Hüküm C6 ve kullanıcı onayı (2026-10-05, "yok plan 3 te gelsin"):** plan 2b'de yalnızca uyarlama talebi "Sıradaki iş" olur; veri hakkı talepleri alımın dikkat satırında sayılır, işlendikleri yer ve en üst sıraları plan 3 ile gelir (sıra `RANK`'te saklı). |
| K11 | "Linki e-postama gönder" gerçek e-posta gönderimi gelene kadar yok (VG yalnızca "Linki kopyala"); klavyeli tabletler tablet gibi engellenir. | 3.0; 7. bölümdeki eski 1. ve 2. soru cevaplandı. |
| K12 | **"yönetici paneli adım adım olsa daha iyi, çok fazla alan var, kullanması çok karışık, wizard guide şeklinde no brainer bir yönetici paneli, her şeye hakim olabileceğim"** (2026-10-06, kelimesi kelimesine). Defterdeki okuma: panel sihirbaz önceliklidir (adım başına bir karar, her çok alanlı iş için rehberli akış) ve yöneticinin her şeyi tek bakışta gördüğü bir kontrol görünümü vardır. | 4.2 (W1-W10, KG1-KG5), 4.3-4.11, 5 (panel tablosu), 6 (dilimler), 8. Bu belgenin K12 hükümleri aşağıda (H1-H9). |

**K12 için bu belgede verilen hükümler** (kullanıcı adına alındı; her birinin yanlışsa maliyeti
`.superpowers/sdd/2026-10-06-hiring-visual-flow/design-v4-delta.md` dosyasında):

- **H1. Kontrol görünümü `/hiring/openings`'tir (menüde yine "Alımlar").** Yeni rota yok, Bugün de
  değil. Bugün iki çözümün ortak "şimdi ne yapmalıyım?" ekranı ve canlı sınavın günlük sayfası (K10
  sırası onun işi); işe alımın "her şey nerede?" sorusu alımlar listesinin yerini alır (4.4). Tek
  bir alımın kontrol görünümü onun Genel bakışıdır (4.5).
- **H2. Sihirbaz çok alanlı işler içindir.** Tek bir değeri değiştiren iş tek adımdır (adın
  değişmesi, organizasyon adı); sık ve serbest düzenlenen editörler (değerlendirme kurucusu, puan
  kartı matrisi) sihirbaz olmaz, onlara kurulum yolu rehberlik eder (4.5, 4.7).
- **H3. Özet adımı:** kayıtlı bir şeyi değiştiren her akışta ve dört ya da daha fazla adımlı
  oluşturma akışında ayrı bir özet adımı vardır; daha kısa oluşturma akışında son adım bir özet
  satırı taşır (W5).
- **H4. `DirtyBar` kalkar.** Çok alanlı düzenleme özet adımında "Kaydet" ile biter; sayfa altında
  "n değişiklik kaydedilmedi" çubuğu kurulmaz (W6). Satır içi düzenleme yalnızca editörlerde kalır.
- **H5. Ekip ve kurallar (M7) plan 2b'ye girer**, çünkü kurulum yolunun "Ekibi ata" adımı onun
  akışıdır. Değerlendirme çalışma alanı (M6), Kütüphane (M9) ve Ayarlar (M10) sonraki plana kalır;
  tasarımları bu belgede (4.7, 4.11).
- **H6. Akıştan çıkış onay sormaz** (RULES kural 4): kaydedilmemiş değer varken çıkış bağlantısı
  "Kaydetmeden çık" der, yoksa "Çık". Akış durumu sekmede tutulmaz; bu bilerek basit tutuldu.
- **H7. Taslak alımın tek dolu butonu "Kuruluma devam et"**, kapalı "Yayınla" değil (G2'nin panel
  karşılığı). "Yayınla" kurulum yolunun son adımında dolu butondur (4.5).
- **H8. Plan kararı 11 değişir:** Alımlar sayfasının Açık / Taslak / Kapalı rota sekmeleri yerine
  tek kontrol listesi (Kurulumda, Yayında, kapalılar açılır alanda); `?tab=` bağlantıları çalışmaya
  devam eder (4.4). Plan kararı 13 (ilan adımı yalnızca yeni pozisyon adında) ve 14 (`⋯` yalnız
  bağlantı) aynen kalır.
- **H9. Değerlendirici (REVIEWER) kontrol görünümünde yalnızca sayı görür:** üyesi olduğu alımların
  hunisi ve dolan link sayısı; talep yok, isim yok, kurulum eylemi yok (STATUS 321 atfı, bugünkü
  dosyada `docs/STATUS.md:337`; hüküm C6). Satırın tek eylemi "Aç".

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
dürüstlük sözlerini değiştirmez. Sürüm 4 ile (K12) ayrıca `HIRING-UX.md` 5.3'ün "Tek sayfa, iki adım;
sihirbaz değil" cümlesi, 5.18'in "Tek sayfa, dört blok ... Dolu buton: Kaydet" düzeni, 5.9 ve
5.10'un form sayfaları ve 5.19'un kullanıcı davet formu *etkileşim biçimi olarak* yerine geçildi
(4.6, 4.10, 4.11); bu bölümlerin kuralları, alanları ve metinleri geçerli.

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
  `src/components/visual/illustrations.tsx` (plan kararı 1 ve hüküm C12 ile bu yola taşındı; Görev 3'te
  kuruldu). Harici dosya yok, `<img>` yok.
- **Renk:** çizimler **doygun accent kullanmaz**. `RULES.md` kural 1 (accent yalnızca CTA, aktif,
  sayaç) aynen kalır; çizimler için adı konmuş tonlar: `--color-illus-line: #131311` (ink),
  `--color-illus-fill: #EEF6F3` (= brand-soft), `--color-illus-tint: #CFE3DA`,
  `--color-illus-sage: #9DC6B6`, `--color-illus-warm: #F1F0EC`. Ekrandaki tek doygun yeşil yine
  dolu buton.
- **Boyut (Görev 3'te kurulan dört boy, `illustrations.tsx` `SIZE`):** `hero` en fazla 400 genişlik
  (masaüstünde başlık bölgesinde 400x220), 1024-1279 arasında 340; `spot` 160 (sorun ekranları ve boş
  durumlar, 160x120); `phone` 342 ("bilgisayardan aç" telefon ekranı, 342x140); `small` 96 (davetin
  hazır ekranındaki `inviteReady`, 96x96). Ekranın üçte birini geçmez.
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

## 4. Yönetici paneli (K7: aynı görsel dil; K12: sihirbaz öncelikli ve bir kontrol görünümü)

Yöneticiler bilgisayardan çalışır: birincil genişlik 1280 ve 1440, en küçük 1024. 1024'ün altındaki
mevcut davranış (yan menü üst çubuktaki düğmeyle açılan `Sheet`'e döner, `layout.tsx`) kalır ama
ayrıca tasarlanmaz; geniş tablolar kendi kartı içinde yatay kayar. Yönetici ekranı bir iş aracıdır:
çizim yalnızca boş durumlarda ve iki başarı anında (davet hazır, yayınlandı). Accent, tek dolu buton,
dot + metin durum, onay diyaloğu yok ve 8 sn geri alma kuralları (`RULES.md`) aynen geçerli.

**Sürüm 4'te panelin iki yüzü var (K12):**
1. **Kontrol görünümü** ("her şeye hakim olabileceğim"): yönetici tek ekranda her alımın nerede
   olduğunu, neyin ilgi istediğini ve sıradaki adımı görür. İşe alımın tamamı için `/hiring/openings`
   (4.4), tek bir alım için onun Genel bakışı (4.5). Bugün (4.3) çözümler arası "şimdi ne?" ekranı
   olarak kalır ve kontrol görünümüne bağlanır.
2. **Rehberli akışlar** ("adım adım, wizard guide şeklinde no brainer"): birden fazla alanı olan her
   iş, ekran başına tek karar soran, geri dönünce değerleri tutan ve tek dolu butonlu bir özetle
   biten bir akıştır (4.2 W1-W10). Kontrol görünümündeki her satırın tek eylemi, o satırı düzelten
   akışın doğru adımını açar (KG3).

### 4.0 Envanter (HEAD'deki her yönetici ekranı)

Kaynak: `src/app/(manager)/**/page.tsx` ve `src/app/(auth)/**/page.tsx` (36 sayfa, sürüm 3'te `find`
ile sayıldı; sürüm 4'te `src/app/(manager)` altındaki sayfa listesi yeniden okundu, yeni sayfa yok).
"Biçim" sütunu sürüm 4'teki karşılığı, "Plan" sütunu bu belgedeki dilimi gösterir.

| Ekran | Rota | Çözüm | Biçim (v4) | Öncelik / plan |
|---|---|---|---|---|
| Bugün (davet menüsüyle) | `/dashboard` | ortak | "Şimdi ne?" ekranı, kontrol görünümüne bağlanır | Yüksek · M2 (sınava dokunur), plan 2b |
| Alımlar | `/hiring/openings` | işe alım | **Kontrol görünümü** (4.4) | Yüksek · M3, plan 2b |
| Alım aç | `/hiring/openings/new` | işe alım | Rehberli akış (4.6) | Yüksek · M4, plan 2b |
| Alım genel bakış (huni, kurulum, yayın) | `/hiring/openings/[id]` | işe alım | Alımın kontrol görünümü + kurulum yolu + yayın özeti (4.5) | Yüksek · M5, plan 2b |
| Değerlendirme özeti | `/hiring/openings/[id]/assessment` | işe alım | Genel bakışa katılır | Orta · M6, sonraki plan |
| Kurucu | `/hiring/openings/[id]/assessment/edit` | işe alım | **Editör kalır** (H2, 4.7); kurulum yolu şeridi M5'te | Yüksek · M6, sonraki plan |
| AI taslağı | `/hiring/openings/[id]/assessment/ai` | işe alım | Zaten kart kart ilerleyen akış; görünümü M6 | Orta · M6 |
| Puan kartı ve ağırlıklar | `/hiring/openings/[id]/assessment/scorecard` | işe alım | Matris editör kalır; ağırlık tek karar adımı, çapalar akışı (4.7) | Orta · M6 |
| Aday önizlemesi | `/hiring/openings/[id]/assessment/preview` | işe alım | Kurulum yolunun bir adımı (4.5) | Orta · M6 (yol bağlantısı M5) |
| Adaylar sekmesi | `/hiring/openings/[id]/candidates` | işe alım | Yoğun tablo (P5) | Yüksek · **plan 3 uygular** (4.8) |
| Ekip ve kurallar | `/hiring/openings/[id]/settings` | işe alım | **Kuralların özeti + dört kısa akış + kapat (geri almalı)** (4.10) | Yüksek · **M7, plan 2b'ye alındı** (H5) |
| Aday davet et (sayfa ve `Sheet`) | `/hiring/invite` + Sheet | işe alım | Rehberli akış, iki adım + hazır (4.9) | Yüksek · M8, plan 2b |
| Pozisyonlar listesi / yeni / detay | `/library/positions`, `/new`, `/[id]` | ortak kütüphane | Liste yoğun; yeni = akış; detay = özet + akışlar (4.11) | Düşük · M9, sonraki plan |
| Yetkinlikler listesi / yeni / detay | `/library/competencies`, `/new`, `/[id]` | ortak kütüphane | Aynı desen; çapalar kendi akışı (4.11) | Orta · M9 |
| Skalalar | ayrı rota yok: `ScaleForm`, `src/app/(manager)/library/competencies/page.tsx:69` | ortak | Tek adımlı düzenleme (4.11) | M9 içinde |
| Ayarlar (organizasyon, kullanıcılar, roller, denetim özeti) | `/settings` | ortak | Organizasyon: özet + tek adımlı düzenlemeler; kullanıcılar tablo (4.11) | Düşük · M10, sonraki plan |
| Denetim kaydı | `/settings/audit` | ortak | Yoğun tablo, değişmez | Düşük · M10 |
| Kullanıcı davet et | `/settings/users/new` | ortak | Rehberli akış (4.11) | Düşük · M10 |
| Giriş | `/login` | ortak | Tek kart, değişmez düzen | Düşük · M10 |
| Hesap kurulumu (davet linki) | `/setup/[token]` | ortak | Tek kart | Düşük · M10 |
| Öğrenciler, Sınavlar, Soru bankası | `/exam/**` | **sınav (canlı)** | Değişmez (4.12) | Düşük · E1 |
| Geliştirici UI sayfası | `/dev/ui` | iç | - | Kapsam dışı |

Plan 3'ün ekleyeceği ekranlar (aday detayı, inceleme ve puanlama, karşılaştır, karar) henüz yok;
görsel tasarımları 4.8'de, uygulaması plan 3'te.

### 4.1 Teşhis

Kelime sayıları metin anahtarlarından ve ekran görüntülerinden yaklaşık sayıldı (yan menü ~17 kelime
her ekranda ortak, sayıya dahil değil). Sürüm 4'te "alan" sütunu eklendi: ekranda aynı anda
doldurulabilen kontrol sayısı, koddan sayıldı (K12'nin "çok fazla alan var" cümlesinin karşılığı).

| Ekran | Görünen kelime | Aynı anda alan | Rakip eylem | İnsan nerede kayboluyor |
|---|---|---|---|---|
| Bugün (`p2t21-24`, `t14-today-tr`) | Başlık ~9, satır başına ~12; 10 satır ~130 | 0 | Davet menüsü + her satırda "İncele" | **İşe alımdan hiçbir şey yok:** başlık yalnızca sınav kuyruğu; işe alım modülünün `today()` fonksiyonu boş dizi döndürüyor (`src/solutions/hiring/module.ts:33`). Ayrıca sınav metni "siz", işe alım metni "sen" (K9 ile çözüldü). |
| Alımlar listesi (`f1-01`) | 1 satırla ~41 | 0 | 1 (Alım aç) | Üç rota sekmesi (Açık / Taslak / Kapalı, `src/app/(manager)/hiring/openings/page.tsx:20-22`): bir taslağın kaç adım kaldığı, bir alımın talebi ya da dolan linki, ekibin eksik olduğu hiçbir sekmede görünmüyor. "Her şey nerede?" sorusunun cevabı için her alımı tek tek açmak gerekiyor. |
| Alım aç (`04`) | ~74 | 4-5 (pozisyon, ilan, başlangıç, kopya kaynağı) | 3 başlangıç seçeneği + pozisyon + ilan | İki kart tek sayfada (`src/components/hiring/new-opening-form.tsx:105-249`, dosyanın kendi yorumu: "one page, two blocks, not a wizard", `:25`). |
| Genel bakış, taslak (`f1-03`, `t15-03`) | ~55 | 0 | Kapalı "Yayınla" + 4 satır bağlantısı | Kapalı "Yayınla" en görünür nesne (`[id]/page.tsx:154-163`); hazırlık satırları farklı sayfalara dağılmış bağlantılar, bir "yol" değil. |
| Genel bakış, yayında | ~58 + yorumlar | 0 | Aday davet et + Tüm adaylar | Dikkat isteyen (talep, dolan link) burada değil, Adaylar sekmesinin içinde. |
| Değerlendirme (`t15-11`, `t15-05`) | Kurucuda alan başına TR + EN çifti | Kurucu: soru başına ~7 | **İki kat sekme:** 4 + 5 = 9 etiket (`opening-header.tsx:65-92`) | Önizlemedeki "Mobil görünüm" K2 ile yanlış vaat. |
| Ekip ve kurallar (`p2t19-settings-survey-off`) | ~150 | **10** (ad, değerlendiriciler, karar veren, yedek, en az değerlendirme, kimlik gizleme, son gün, geri dönüş günü, iletişim e-postası, anket; `opening-settings-form.tsx:116-301`) | Kaydet (sayfa ortasında) + Alımı kapat | Tek "Kaydet" on alanın hepsini birden gönderiyor (`saveOpeningRulesAction`, `settings/actions.ts:37`); hangi alanın sorunlu olduğu düğmenin yanındaki ilk sorunla söyleniyor (`opening-settings-form.tsx:65`). |
| Davet sayfası (`p2t21-25`) | ~75 | 4-5 (alım, mod, ad, e-posta, dil, son gün) | 3 radyo grubu + kapalı buton | Alım seçilmeden "Son gün" satırında yalnızca "Değiştir". |
| Pozisyon detayı | ~40 | **6 + profil satırı başına 2** (ad, ekip, kısa tanım, ilan, beceriler, diller; `position-form.tsx:137-244`) | Kaydet + Arşivle | Tek uzun form. |
| Yetkinlik detayı (`t14-competency-en`) | ~120 | **14+** (ad ve tanım TR/EN, 5 çapa TR/EN, etiketler TR/EN; `competency-form.tsx:109-177`) | Kaydet + Arşivle + AI çapa öner | Yan yana TR/EN kutuları bir form duvarı. |
| Ayarlar (`/settings`) | 4 bölüm tek sayfada | 3 + rol seçicileri | Bölüm başına kendi eylemi | Uzun tek sayfa. |
| Sınav ekranları | Koddan | - | - | Kabuk ve `PageHead` ortak (4.12). |

**Beş büyük panel sorunu (sürüm 4 sırası):** (1) **çok alanlı formlar** (ekip ve kurallar 10 alan,
yetkinlik 14+, pozisyon 6+) tek sayfada ve tek "Kaydet"le: K12'nin asıl şikâyeti; (2) **her şeyi
gören bir yer yok**: alımın durumu, dikkat isteyen iş ve sıradaki adım her alımın içine dağılmış;
(3) taslak alımda kapalı "Yayınla" ekranın en görünür nesnesi ve "kaç adım kaldı" yok; (4) Bugün işe
alım için boş; (5) alım içinde iki kat sekme (9 etiket).

**Korunacaklar:** gruplanmış yan menü (HIRING-UX karar 9, mod değiştirici yok); "Bugün"de stat
kutusu olmaması; her satırın bir eyleme gitmesi; dot + metin durum; geri alma şeridi; kurucunun
"Sadece ekip görür" koyu kasası (`vault`), otomatik kaydı ve soru kontrol çubuğu; puan kartı matrisi
(yoğun, doğru); davetin "bir daha gösterilmez" uyarısı; kör mod kuralları; formların bugünkü
erken doğrulama kuralları (`openingRulesProblems`, `inviteReason`, `createWait` mantığı): sürüm 4
onları siler değil, adımlara dağıtır.

### 4.2 Hedef desen: panelin grameri

**Panel kuralları (P).** Sürüm 3'ün P1-P11'i; sürüm 4'te değişenler işaretli.

| # | Kural | Karşılığı |
|---|---|---|
| P1 | **Kabuk: aynı gruplanmış yan menü, ikonlu.** 240px; her öğede 18px lucide ikon (`sun` Bugün, `briefcase` Alımlar, `users` Öğrenciler, `file-text` Sınavlar, `library` Soru bankası, `id-card` Pozisyonlar, `target` Yetkinlikler, `settings` Ayarlar). Aktif öğe `brand-soft` zemin + accent metin. Menü sayıları plan 3'e ertelendi (plan kararı 6). | `ManagerNav` (`src/components/manager/nav.tsx`). |
| P2 | **Sayfa başlığı: kicker, başlık, tek satır meta, tek dolu eylem, "⋯" menü.** İkincil eylemler `⋯` menüsünde; menü yalnızca bağlantı taşır (plan kararı 14). | `PanelHeader` (`PageHead`'in yerine, `src/components/panel/bits.tsx:39`). |
| P3 | **En fazla bir kat sekme.** Alımda 4 sekme kalır; Değerlendirme'nin alt sekmeleri M6'da kalkar. | 9 etiket → 4 sekme + 2 parçalı seçici (M6). |
| P4 | **Boş durum = çizim + başlık + bir cümle + bir dolu eylem.** | `EmptyState`. |
| P5 | **Kart mı tablo mu:** karar isteyen ve az sayıda olan nesne kart ya da kontrol satırı; çok sayıda ve karşılaştırılan nesne (adaylar, inceleme kuyruğu, denetim kaydı, soru bankası, öğrenciler, kütüphane listeleri) bilerek yoğun tablo: 52px satır, satır başına tek görünür eylem. | `ControlRow` (v4), tablolar `Table` + `RowMenu`. |
| P6 | **(v4, değişti) Çok alanlı iş = rehberli akış.** Bir işin birden fazla alanı varsa sayfada form değil, `GuidedFlow` vardır: adım başına bir karar, sonunda özet ve tek dolu "Oluştur / Kaydet". Ayrıntı W1-W10. Sürüm 3'teki "kurulum listesi rehberdir" yerine taslağın **kurulum yolu** (4.5) gelir. | `GuidedFlow`, `SummaryStep`, `SetupPath`. |
| P7 | **Gelişmiş kurallar açılır alanda değil, kendi kısa akışında.** Değişmez kural (bağımsız değerlendirme) ayar gibi değil, kilit ikonlu `IconRow` olarak özette. | 4.10. |
| P8 | **(v4, değişti) Kaydetmenin kapsamı özet adımında görünür.** `DirtyBar` yok (H4). Özette değişen her satır "değişti" diye işaretlenir; dolu buton "Kaydet" yalnızca değişiklik varken etkin, yoksa "Değişiklik yok." nedeniyle bekler. Otomatik kaydeden editörlerde (kurucu) yalnızca "Kaydedildi" durumu. | `SummaryStep`. |
| P9 | **Tek durum sözlüğü.** Taslak (gri), Yayında (accent), Kapalı (muted; plan kararı 12); aday durumları aynı tonlarla. Rozet yok. | `status-vocabulary.ts`. |
| P10 | **İki dil alanı sekmeyle, yan yana değil** (`TR | EN`, eksik dilde nokta). | `LanguageTabs` (M6, M9). |
| P11 | **Aynı bileşenler:** `StepScreen`, `StepFooter`, `JourneyProgress`, `Disclosure`, `IconRow`, `FactTiles`, `PathSteps`, `ChoiceCardGroup`, `Illustration` aday tarafıyla aynı dosyalar (`src/components/visual/`); panel `PanelHeader`, `EmptyState`, `RowMenu`, `NextTaskCard`, `GuidedFlow`, `SummaryStep`, `ControlRow`, `SetupPath` ekler. | 5. bölüm. |

**Sihirbaz kuralları (W, K12).** Her rehberli akış bunlara uyar.

| # | Kural | Ayrıntı |
|---|---|---|
| W1 | **Adım başına bir karar.** Adımın başlığı yöneticinin o an cevapladığı soru ("Kim değerlendirecek?"). Bir adımda yalnızca o sorunun alanı ve ona doğrudan bağlı, varsayılanı olan bir alt seçim olabilir (örn. "Önceki bir alımdan kopyala" seçilince altında kaynak seçici; karar verenin altında "Yedek karar veren" açılır alanı). | Ad ve e-posta "kişi" kararıdır, aynı adımda durur. |
| W2 | **Kabuk:** panelin içinde, yan menü görünür kalır (aday akışındaki gibi tam ekran değil). Üstte `FlowHeader`: kicker akışın adı ("Ekip ve kurallar · Ekip"), sağda çıkış bağlantısı (W7). İçerik `StepScreen` single 640px (alan adımları) ya da split 1000px (seçim kartları ve özet). Altta `StepFooter` `placement="sticky"`: solda "‹ Geri", ortada `JourneyProgress` ("Adım 2 / 4"), sağda tek dolu buton. | `StepFooter`'ın `placement: "viewport" \| "sticky"` seçeneği Görev 4'te kuruldu (`src/components/visual/step-footer.tsx:73`). |
| W3 | **Adım adres çubuğunda (hash).** Tarayıcının geri tuşu bir adım geri gider, yeniden yüklemede aynı adım açılır; bir kontrol görünümü bağlantısı doğrudan bir adıma gider (`#team-decider`). Önceki adım geçersizse (örn. pozisyon seçilmemiş) akış ilk eksik adıma döner. | Görev 19'un `newOpeningStepOf` deseni genelleşir. |
| W4 | **Geri değerleri korur.** Tüm akış tek bileşen, tek durum; "Geri" ve tarayıcı geri tuşu hiçbir değeri silmez. Bir alt seçimi kaldıran değişiklik (kopya yerine boş başla) alt değeri bellekte tutar ama göndermez. | |
| W5 | **Özet (H3).** Kayıtlı bir şeyi değiştiren her akış ve dört ya da daha fazla adımlı oluşturma akışı ayrı bir **özet adımıyla** biter: her karar bir satır (etiket, değer, "Değiştir"); "Değiştir" o adımı açar ve oradaki dolu buton "Özete dön" olur. Kısa oluşturma akışının son adımı tek satırlık bir özet taşır ("Destek Uzmanı · ilan metni var · AI taslağı"). | `SummaryStep`, `SummaryLine`. |
| W6 | **Tek dolu buton sonda.** Ara adımlarda dolu buton "Devam et" (o adımın kararı eksikse mevcut nedenle bekler, G2); yalnızca özette (ya da kısa akışın son adımında) "Alımı oluştur", "Kaydet", "Linki oluştur", "Yayınla". Gönderim sürerken buton accent kalır, etiketi işi söyler (plan kararı 4). | `FooterAction`. |
| W7 | **Çıkış onaysız (H6, RULES kural 4).** `FlowHeader`'ın sağında metin bağlantısı: değer değişmemişse "Çık", değişmişse "Kaydetmeden çık". Akıştan çıkış nereye: geldiği kontrol görünümü (alımın Genel bakışı, ekip ve kurallar özeti, Alımlar). Sheet içindeki akışta köşe ✕ ve "Kapat" aynı işi yapar; bir link gösterilirken Sheet Escape ile kapanmaz (`sheetLocked`, mevcut). | |
| W8 | **Erken doğrulama adıma dağılır, sunucu sözleri aynen.** Her adımın "Devam et" nedeni mevcut kural fonksiyonundan gelir (`openingRulesProblems`, `inviteReason`, `createWait`), yalnızca o adımın alanlarına süzülür. Sunucunun reddi (sorun kodu) bir **sorun → adım** haritasıyla o adımı açar, mevcut cümleyi (`hiringSettings.p<KOD>`, `hiringInvite.err<KOD>`, `hiringNew` reddi) adımın dolu butonunun yanında gösterir. Adıma düşmeyen ret (yetki, kapalı alım, bağlantı) özette, mevcut metniyle, tek bir sonraki eylemle durur. | Sunucu eylemleri ve kodları **değişmez**. |
| W9 | **Dil ve hitap.** Akış metinleri "sen" der (K9); adım başlığı soru, alt satır en fazla 12 kelime; uzun açıklama (`blindModeHint`, `finishSurveyHint`, anket kuralı) adımın içinde `Disclosure`'da değil, adımın tek açıklaması olarak görünür (artık ekranda başka şey yok). | `flow` (yeni ortak metin ad alanı) + mevcut ad alanları. |
| W10 | **Erişilebilirlik.** Her adım değişiminde odak yeni başlığa (`useStepFocus`, `src/hooks/use-step-focus.ts`); "Adım 2 / 4" polite bölgede; 44px hedef; kapalı butonun nedeni yanında `id` + `-why`; hareket aday tarafıyla aynı (200 ms opaklık, reduced motion'da yalnız opaklık). | |

**Kontrol görünümü kuralları (KG, K12).**

| # | Kural | Ayrıntı |
|---|---|---|
| KG1 | **Bir nesne, bir satır, sıradaki tek adım.** Kontrol görünümü stat kutusu ızgarası değildir (airbnb-ux genel dashboard testi): her alım bir `ControlRow`'dur; satırda durum (dot + metin), ilerleme (taslakta "Kurulum n / N", yayında mini huni), dikkat (yalnız varsa), son gün, ekip ve **tek** metin eylemi ("Sıradaki: Ekibi ata ›"). | `ControlRow`. |
| KG2 | **Sıradaki adım tek bir kuraldan gelir.** Saf fonksiyon `openingNextStep` (4.4) her satır için bir adım seçer; Bugün'ün "Sıradaki iş"i (K10) çözümler arası, bu ise alım içi; ikisi çakışmaz, Bugün kontrol görünümüne bağlanır. | `src/components/hiring/opening-next-step.ts` (yeni). |
| KG3 | **Her satır onu düzelten akışa açılır.** Satırın eylemi bir sayfaya değil, düzelten akışın doğru adımına gider (`/hiring/openings/[id]/settings#team-members`, kurulum yolunun şu anki adımı, davet akışı). Akış bitince kontrol görünümüne döner ve satır güncellenir. | W3. |
| KG4 | **Sayılar gerçek ve sakin.** Sayım yoksa satır susar ("Henüz davet yok"), sıfırları dizmez (playbook 1.7). Değerlendirici (REVIEWER) yalnızca sayı görür (H9): huni sayıları ve dolan link sayısı; talep, aday adı, kurulum eylemi yok; satırın tek eylemi "Aç". | STATUS 321 (bugün `docs/STATUS.md:337`), hüküm C6. |
| KG5 | **Bir ekranda bir dolu buton.** Kontrol görünümünün dolu butonu sayfanın asıl işi (Alımlar'da "Alım aç"; taslak alımın Genel bakışında "Kuruluma devam et"; yayındaki alımda "Aday davet et"); satır eylemleri metin. | P2, RULES kural 2. |

**Rehberli akış kataloğu (özet; ayrıntı ilgili bölümde).** "Eylem" sütunundaki sunucu eylemleri
değişmeden çağrılır.

| Akış | Nerede | Adımlar (bir karar) | Özet / son | Sunucu eylemi (değişmez) | Dilim |
|---|---|---|---|---|---|
| Alım aç | 4.6 | Pozisyon → İlan (yalnız yeni ad) → Nasıl başlayalım | Son adımda özet satırı, "Alımı oluştur" | `createOpeningAction`, `src/app/(manager)/hiring/openings/new/actions.ts:22` | M4 (2b) |
| Kurulum yolu → Yayınla | 4.5 | Değerlendirmeyi kur → Çapalar → (Ağırlıklar) → Ekibi ata → Önizle → Yayınla | Yayın özeti, "Yayınla" | `publishOpeningAction`, `[id]/actions.ts:25`; `markPreviewedAction`, `assessment/preview/actions.ts:17` | M5 (2b) |
| Aday davet et | 4.9 | (Alım, sayfada ve birden çoksa) → Kişi ya da liste | Özet (dil, son gün varsayılanlı), "Linki oluştur" → Hazır | `inviteCandidateAction` `:94`, `inviteManyAction` `:114` (`src/app/(manager)/hiring/invite/actions.ts`) | M8 (2b) |
| Ekip | 4.10 | Değerlendiriciler → Karar veren (+ yedek) → Kaç değerlendirme | Özet, "Kaydet" | `saveOpeningRulesAction`, `[id]/settings/actions.ts:37` | M7 (2b) |
| Aday iletişimi | 4.10 | Son gün → Geri dönüş sözü → İletişim e-postası | Özet, "Kaydet" | aynı | M7 (2b) |
| Adil değerlendirme ve anket | 4.10 | Kimlik gizleme → Bitiş anketi | Özet (kilitli kural dahil), "Kaydet" | aynı | M7 (2b) |
| Alımın adı | 4.10 | Tek adım (H2) | "Kaydet" | aynı | M7 (2b) |
| Alımı kapat | 4.10 | **Akış değil:** tek eylem + 8 sn geri alma (RULES 4) | - | `closeOpeningAction` `:62`, `reopenOpeningAction` `:75` | M7 (2b) |
| Pozisyon ekle | 4.11 | Ad → Ekip (isteğe bağlı) → İlan metni (isteğe bağlı) | Son adımda özet satırı, "Pozisyonu oluştur" | `createPositionAction`, `src/app/(manager)/library/actions.ts:126` | M9 |
| Pozisyonu düzenle | 4.11 | Özetten tek adım: Ad, Ekip, Kısa tanım, İlan, Beceriler, Diller, Yetkinlik profili | Özet, "Kaydet" | `savePositionAction` `:135` | M9 |
| Yetkinlik ekle | 4.11 | Ad → Ne ölçer | Son adımda özet satırı, "Yetkinliği oluştur" | `createCompetencyAction` `:60` | M9 |
| Yetkinliği düzenle (çapalar dahil) | 4.11 | Özetten: Ad, Tanım, Çapalar (1 → 3 → 5 → ara seviyeler), Etiketler | Özet, "Kaydet" | `saveCompetencyAction` `:69`, `draftAnchorsAction` `:160` | M9 |
| Kullanıcı davet et | 4.11 | Ad → E-posta → Rol | Son adımda özet satırı, "Davet linkini oluştur" → Hazır | `inviteUser`, `src/app/(manager)/settings/actions.ts:176` | M10 |
| Organizasyon ayarları | 4.11 | Özetten tek adım: Ad, medya saklama, aday kaydı saklama | "Kaydet" | `saveOrgSettings` `:31` | M10 |
| Puan kartı ağırlıkları | 4.7 | Tek karar adımı: Eşit / Kendim ayarlayacağım | "Ağırlıkları kaydet" | `saveDraftWeightsAction`, `assessment/scorecard/actions.ts:49` | M6 |
| Çapalar (puan kartından) | 4.7 | Yetkinlik çapa akışının aynısı, Sheet içinde | "Çapaları kaydet" | `saveAnchorsAction` `:93` | M6 |
| **Kurucu** | 4.7 | **Editör kalır** (H2) | Otomatik kayıt | mevcut kurucu eylemleri | M6 |

**Kaynak notu (sürüm 4).** `airbnb-ux` referanslarında doğrulanmış olanlar: tek dolu buton ve
"azaltarak başla" (SKILL kuralları; `visual-design-system.md` #10); önce kısa sonra tam
(playbook 1.3); erken doğrulama, hatadan sonra kurtarmadan güçlüdür (playbook 1.6, W8'in dayanağı);
çıkmaz sokak yok (playbook 1.9, KG3); "genel AI dashboard testi" (stat kutusu ızgarası, eşit
ağırlıklı kartlar; `audit-checklist.md`, KG1'in dayanağı); playbook 3: çok adımlı "gözden geçir ve
onayla" ekranı **yüksek riskli ya da çok parametreli** bir kararda anlamlı, tek tıklık basit bir işte
yalnızca sürtünme (H2 ve H3'ün dayanağı: tek alanlı işe sihirbaz yok, kısa akışta ayrı özet yok).
"Review and pay" özet ekranının kendisi `booking-checkout.md` #7'de **doğrulanmadı** diye işaretli;
W5'in özet adımı ondan değil, Kademe'nin "kaydetmenin kapsamı görünür" kuralından (P8) çıkıyor.
Kontrol görünümünün bir alımı tek satırda özetlemesi ve satırın "sıradaki adım"ı benim çıkarımım,
referanslarda böyle bir desen yok.

### 4.3 Bugün (`/dashboard`)

**Soru:** "Şimdi neye bakmalıyım?" İki çözüm aynı ekranda. Sürüm 4'te değişmeyen: sürüm 3'ün
yerleşimi, `NextTaskCard`, K10 sırası, sınav kuyruğunun birebir aynı kalması. Değişen: dikkat
satırlarının eylemi düzelten akışa gider ve bölümün altında kontrol görünümüne bağlantı var.

```
┌────────────┬─────────────────────────────────────────────────────────────────────────────────┐
│ Kademe     │  Bugün                                                    [ Davet et ⌄ ]        │ PanelHeader (outline menü)
│ ☀ Bugün    │  3 iş seni bekliyor. En eskisi 30 Eyl.                                          │
│ İŞE ALIM   │  ┌───────────────────────────────────────────────────────────────────────────┐  │
│ ▣ Alımlar  │  │ SIRADAKİ İŞ                                                    İşe alım   │  │ NextTaskCard
│ SINAV      │  │ Ece Bal bir uyarlama istedi                                                │  │
│ ◎ Öğrenci  │  │ "Video yerine yazılı cevap verebilir miyim?" · Ürün Tasarımcısı · 2 dk önce│  │
│ ▤ Sınavlar │  │                                                  [ Talebe bak ]           │  │ tek dolu buton
│ ▥ Soru b.  │  └───────────────────────────────────────────────────────────────────────────┘  │
│ KÜTÜPHANE  │  Dikkat isteyenler                                                              │
│ ▢ Pozisyon │  ┌───────────────────────────────────────────────────────────────────────────┐  │
│ ◎ Yetkinlik│  │ [inbox] 2 açık talep            Ürün Tasarımcısı        İşe alım   Aç ›    │  │ IconRow satırları
│            │  │ [clock] 3 link 48 saatte doluyor Destek Uzmanı          İşe alım   Aç ›    │  │
│            │  │ [file]  Taslak v2 yayın bekliyor Destek Uzmanı          İşe alım   Kuruluma│  │
│            │  │                                                         devam et ›         │  │
│            │  └───────────────────────────────────────────────────────────────────────────┘  │
│            │  Tüm alımların durumu ›                                                          │ kontrol görünümüne (4.4)
│            │  İnceleme kuyruğu · Sınav (145)                                    Tümü ›       │ yoğun tablo (değişmez)
│ ⚙ Ayarlar  │  ...                                                                             │
│ EN Kadir KA│  Süren işler (2) ⌄                                                              │ Disclosure
└────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

- **Satırlar ve hedefleri:** açık talepler → Adaylar sekmesi (uyarlama talebinin "Tamam"ı orada,
  `markRequestAction`, `candidates/actions.ts:80`); dolan linkler → Adaylar sekmesi; yayın bekleyen
  taslak → alımın Genel bakışı, eylem metni "Kuruluma devam et" (kurulum yolunun şu anki adımı, 4.5).
- **Veri hakkı talepleri (C6, kullanıcı onayı):** plan 2b'de "Sıradaki iş" olmaz; alımın "açık
  talep" sayısında sayılır. C6'nın düz notu (işlendikleri yer plan 3 ile gelir) satırın gittiği yerde
  durur, çıkmaz bir düğme yok; notun tam yeri ve metni plan yeniden yazılırken belirlenir (bugünkü
  plan metni C6'dan önce yazıldı, `docs/superpowers/plans/2026-10-06-hiring-visual-flow.md:7216`).
  En üst sıraları plan 3'te.
- **Kim görür:** işe alım satırları yalnızca alım yürütenlere (Sahip, Yönetici; plan kararı 7);
  değerlendirici Bugün'de işe alım satırı görmez (STATUS 321). Değerlendiricinin işe alım yüzü
  kontrol görünümündeki sayılardır (H9).
- **Okumalar:** `hiringToday` okumaları birbiri ardına çalışır (hüküm C21, havuz 5 bağlantı).
- **Bayrak:** bu ekran canlı sınavın günlük ekranı; M2 sınav kuyruğunun satırlarını önce/sonra metin
  karşılaştırmasıyla kanıtlar (plan Görev 17, C17'nin düzeltmesiyle).
- **Neden kontrol görünümü burada değil (H1):** Bugün iki çözümün kuyruğunu K10 sırasıyla birleştirir
  ve sınav kullanıcısı da buraya iner. Her alımın satırını buraya koymak sınav kullanıcısına işe alım
  listesi göstermek ve canlı sınav ekranını büyütmek olurdu; "her şeye hakim" isteği işe alımın kendi
  ekranında karşılanır, Bugün ona tek bağlantıyla gider.

### 4.4 Kontrol görünümü: Alımlar (`/hiring/openings`)

**Soru:** "İşe alımda her şey nerede, neresi benden bir şey bekliyor?" (K12: "her şeye hakim
olabileceğim").

```
│  Alımlar                                                                 [ Alım aç ]      │ PanelHeader, tek dolu
│  5 alım sürüyor. 2'si kurulumda, 3'ünde senden bir şey bekleniyor.                        │ tek cümle özet
│                                                                                          │
│  KURULUMDA (2)                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Destek Uzmanı · Ekim         ● Taslak   Kurulum 2 / 5  ▬▬▭▭▭                         │ │ ControlRow (taslak)
│  │ Ekip: yalnız sen · son gün yok                            Sıradaki: Ekibi ata ›       │ │
│  ├──────────────────────────────────────────────────────────────────────────────────────┤ │
│  │ Veri Analisti · Ekim         ● Taslak   Kurulum 5 / 6  ▬▬▬▬▬▭                         │ │
│  │ Ekip: 3 kişi · son gün 30 Eki                             Sıradaki: Yayınla ›         │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│  YAYINDA (3)                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Alım                     Huni                   Dikkat                     Son gün   │ │ sütun başlıkları
│  │ Ürün Tasarımcısı · Ekim  9 › 8 › 8              [inbox] 2 açık talep       19 Eki    │ │ ControlRow (yayında)
│  │ ● Yayında · v1           ▬▬▬▬▬▬▬▬▭              [clock] 1 link yarın doluyor          │ │
│  │ Ekip: 2 kişi                                                   Taleplere bak ›       │ │ tek metin eylem
│  ├──────────────────────────────────────────────────────────────────────────────────────┤ │
│  │ Destek Uzmanı II · Ekim  Henüz davet yok        ● Ekip 1 kişi, kural 2 istiyor  -    │ │
│  │ ● Yayında · v1                                                 Ekibe ekle ›          │ │
│  ├──────────────────────────────────────────────────────────────────────────────────────┤ │
│  │ Saha Satış · Eylül       12 › 10 › 7            [file] Taslak v3 yayın bekliyor 5 Eki│ │
│  │ ● Yayında · v2           ▬▬▬▬▬▬▭                               Kuruluma devam et ›   │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│  Kapalı alımlar (4)                                                                   ⌄  │ Disclosure
```

- **Gruplar:** "Kurulumda" (DRAFT) ve "Yayında" (OPEN; altında yeni bir taslak sürüm olsa da)
  aynı sayfada, sırası bu; "Kapalı alımlar (n)" kapalı bir açılır alanda, satırları aynı biçimde ve
  eylemleri "Aç" (sahip ve yöneticiye ayrıca "Yeniden aç ›" ekip ve kurallar özetine gider). Grup
  boşsa başlığıyla birlikte görünmez. **H8:** üç rota sekmesi kalkar; `?tab=draft|open` ilgili
  gruba kaydırır, `?tab=closed` açılır alanı açık getirir (eski bağlantılar ve Görev 18'in rota
  testleri kırılmaz, testin beklentisi buna göre güncellenir).
- **Satır (`ControlRow`), taslak:** ad, dot + "Taslak", `Kurulum n / N` ve ince ilerleme parçaları
  (`readinessRows` + yayın adımı, plan Görev 20'nin `setupProgress`'i), ekip özeti (üye sayısı;
  yalnızca oluşturan varsa "yalnız sen"), son gün; eylem "Sıradaki: <kurulum yolunun şu anki adımı> ›"
  (4.5).
- **Satır, yayında:** ad, dot + "Yayında · v1", mini huni (davet › başladı › bitti; Görev 18'in
  `openingCardFacts`'ı), dikkat sütunu yalnızca varsa (açık talep, 48 saatte dolan link, yayın
  bekleyen taslak, ekip kuralın altında), son gün; eylem `openingNextStep`'ten.
- **`openingNextStep` sırası (KG2, saf fonksiyon, testli):** taslak: kurulum yolunun ilk bitmemiş
  adımı, hepsi bittiyse "Yayınla". Yayında: (1) açık talep varsa "Taleplere bak ›" (Adaylar sekmesi;
  veri hakkı talebi burada da yalnız sayılır, C6); (2) aktif ekip `minEvaluations`'ın altındaysa
  "Ekibe ekle ›" (`#team-members`; `panelShortfall` kuralı, `src/components/hiring/invite/form-rules.ts:50`);
  (3) 48 saatte dolan link varsa "Linklere bak ›" (Adaylar sekmesi); (4) yayın bekleyen taslak sürüm
  varsa "Kuruluma devam et ›"; (5) hiç davet yoksa "Aday davet et ›" (davet akışı, Sheet); (6) aksi
  halde "Adaylara bak ›". Kapalı: "Aç ›".
- **Değerlendirici (H9, KG4):** yalnızca üyesi olduğu alımlar listelenir (`listOpenings` bugün de
  böyle süzer, `src/solutions/hiring/server/openings.ts:46-85`); satırda huni sayıları ve dolan link
  sayısı; talep sayısı, ekip uyarısı ve kurulum ilerlemesi yok; eylem "Aç ›". Dolu "Alım aç" yerine
  mevcut nedenli kapalı buton (`hiringOpenings.noPermission`).
- **Özet cümlesi:** sayılardan kurulur ("5 alım sürüyor. 2'si kurulumda, 3'ünde senden bir şey
  bekleniyor."); değerlendiricide "Üyesi olduğun 2 alım var." Stat kutusu yok (KG1).
- **Boş:** `emptyOpenings` çizimi + "İlk alımını aç." + "İlan metnini yapıştırman yeterli, gerisini
  birlikte kuralım." (mevcut metin) + "Alım aç".
- **Yoğunluk:** satır yüksekliği taslakta 72px, yayında 88px; 1280x800'de katlamanın üstünde ~6 alım.
  20'den fazla süren alımda gruplar sayfalanmaz, satırlar aynı kalır (tablo değil: sütunlar zaten
  hizalı). Bu, sürüm 3'ün iki sütunlu kart ızgarasının (Görev 18) yerine geçer: kart ızgarasında
  ilerleme ve dikkat yan yana karşılaştırılamıyordu.
- **Okumalar:** `listOpenings` iki kez (DRAFT, OPEN) + kapalılar açılır alan açılınca değil sayfa
  yüklenirken (sayım için); `openingCardFacts` yayındakiler için; taslakların kurulum ilerlemesi için
  her taslağa `workingState` (`src/solutions/hiring/server/working.ts`: sürüm listesi, içerik,
  yetkinlik gerçekleri) ve bir kez `loadPanelUsers`. Hepsi birbiri ardına (C21). **Doğrulanmadı:**
  10 taslakta kaç milisaniye sürdüğü; Görev 18'de ölçülür, 300 ms'yi aşarsa taslak satırı sayıyı
  değil "Kuruluma devam et ›"i gösterir.
- **Kelime:** 5 alımla ~95 (sürüm 3 kart ızgarasında 5 kartla ~175); kazanç, her alımın tek satırda
  okunması ve sekme değiştirmeden her şeyin görünmesi.

### 4.5 Alımın kontrol görünümü ve kurulum yolu (`/hiring/openings/[id]`)

Genel bakış tek bir alımın kontrol görünümüdür: "Bu alım nerede, sıradaki adımım ne, kurallar ne?"

```
 Yayında
│  Alımlar › Ürün Tasarımcısı                                                              │
│  Ürün Tasarımcısı · Ekim                                     ⋯   [ Aday davet et ]       │ PanelHeader
│  ● Yayında · Son gün 19 Eki · v1                                                         │
│  Genel bakış   Adaylar 9   Değerlendirme   Ekip ve kurallar                              │ tek kat sekme
│  ┌──────────────┐ › ┌──────────────┐ › ┌──────────────┐                                  │ FunnelTiles (3 kutu;
│  │ Davet      9 │   │ Başladı    8 │   │ Tamamladı  8 │                                  │  4. ve 5. plan 3)
│  └──────────────┘   └──────────────┘   └──────────────┘                                  │
│  Ortanca 25 dk · tahmin 10 dk. Adaylar tahminden belirgin uzun sürüyor.                   │
│  ┌ Dikkat isteyenler ─────────────────────┐  ┌ Bu alımın kuralları ─────────────────────┐ │
│  │ [inbox] 2 açık talep   Taleplere bak › │  │ [users] 2 değerlendirici · karar: Kadir  │ │ SummaryRows (salt
│  │ [clock] 1 link yarın doluyor  Bak ›    │  │ [calendar-days] Son gün 19 Eki · 7 gün   │ │  okunur özet)
│  └────────────────────────────────────────┘  │ [eye-off] Kimlik açık · anket açık       │ │
│                                              │                       Kuralları değiştir ›│ │
│                                              └──────────────────────────────────────────┘ │
│  Aday deneyimi: 3,9 / 5 · 7 cevap                                    Yorumlar (3) ⌄      │ Disclosure
│  Yayındaki değerlendirme: v1 · 2 aşama · 8 soru · 20 dk          Değerlendirmeye git ›  │

 Taslak
│  ● Taslak · Son gün yok                                     ⋯   [ Kuruluma devam et ]   │ H7: dolu, etkin
│  Kurulum 2 / 5 · 3 adım kaldı                                                            │
│  ① ✓ Değerlendirmeyi kur                              8 soru · 20 dk                     │ SetupPath (PathSteps)
│  ② ✓ Puan kartında çapalar                            3 yetkinlik                        │
│  ③ ● Ekibi ata                                        Yalnız sen varsın. Ekibe ekle ›    │ şu anki adım
│  ④ ○ Adayın göreceğini önizle                         Önerilir                           │
│  ⑤ ○ Yayınla                                                                             │
```

- **Taslakta dolu buton "Kuruluma devam et" (H7):** kurulum yolunun ilk bitmemiş adımını açar. Sürüm
  3'teki kapalı "Yayınla" bu ekrandan kalkar; yayın yolun son adımıdır. Kapalı alımda dolu buton yok,
  mevcut "Kapalı" notu ve sahip/yöneticiye "Yeniden aç ›" (ekip ve kurallar özeti).
- **Kurulum yolu (`SetupPath`, G3'ün panel karşılığı):** adımlar `readinessRows`'tan gelir
  (`src/app/(manager)/hiring/openings/[id]/readiness.ts:33`: değerlendirme, çapalar, ağırlıklar
  yalnız açıkken, ekip, önizleme) + "Yayınla". Her adımın gittiği yer ve biçimi:

  | Adım | Nereye | Biçim | Bitti sayılır (mevcut kural) |
  |---|---|---|---|
  | Değerlendirmeyi kur | `/assessment/edit` (AI yolu ve içerik boşsa `/assessment/ai`) | Editör (4.7) | `STRUCTURE_PROBLEMS` boş |
  | Puan kartında çapalar | gate'in kendi düzeltme bağlantısı (`rowHref`, `readiness.ts:68`): puan kartı ya da kütüphane yetkinliği | Editör / çapa akışı (M6, M9) | `ANCHOR_PROBLEMS` boş |
  | Ağırlıklar (yalnız açıkken) | `/assessment/scorecard` | Tek karar adımı (M6) | `WEIGHT_PROBLEMS` boş |
  | Ekibi ata | `/settings#team-members` | **Ekip akışı** (4.10) | üye > 0 ve aktif karar veren |
  | Adayın göreceğini önizle | `/assessment/preview` | Tam ekran katman | önizleme işaretli (`markPreviewedAction`) |
  | Yayınla | `/hiring/openings/[id]#publish` | **Yayın özeti** | - |

  Ekip ve önizleme öneridir, yayını engellemez (mevcut kural, STATUS kararı 7); yolda "Önerilir"
  der ve "Atla ›" ile bir sonraki adıma geçilebilir.
- **Yol şeridi (`SetupPath` şerit varyantı):** taslak alımın sayfalarında (kurucu, puan kartı,
  önizleme, ekip ve kurallar) sekmelerin altında tek satır: "Kurulum 2 / 5 · Sıradaki: Ekibi ata ›".
  Yalnız metin bağlantısı; editörün kendi dolu butonuyla yarışmaz. `OpeningHeader`'da çizilir (tek
  dosya, `opening-header.tsx`), editörlerin içine girmez.
- **Yayın özeti (`#publish`, son adım):** `StepScreen` split. Solda "Yayına hazır mı?", sağda
  özet satırları: yayımlanacak değerlendirme (v1 · 2 aşama · 8 soru · ~20 dk), ekip (2 değerlendirici,
  karar veren), son gün, önizleme yapıldı mı; her satırda "Değiştir ›" ilgili adıma. Gate sorunu
  varsa dolu "Yayınla" mevcut nedenle bekler (`describeProblem`, `[id]/page.tsx:141-149`) ve sorunun
  adımına "Düzelt ›" durur. Dolu "Yayınla" → `publishOpeningAction` (değişmez; dönüş Genel bakışa,
  mevcut `?published=` / `?publish=` bildirimleri ve metinleri aynen, `[id]/actions.ts:15`). Yayın
  sonrası mevcut tek satır bildirim + dolu "Aday davet et".
- **Yayındayken:** dikkat kartı (Görev 20) ve yeni **"Bu alımın kuralları"** kartı: ekip, son gün ve
  geri dönüş, kimlik gizleme ve anket tek satırlık özetler; tek eylem "Kuralları değiştir ›" (ekip
  ve kurallar özeti, 4.10). Değerlendirici kartı salt okur, eylem yok.
- **`⋯` menüsü** (plan kararı 14, yalnız bağlantı): Önizle, Ekip ve kurallar, Kopyala (yalnız
  `canWrite`, C9).
- **Kelime:** yayında ~58 → ~62 (kurallar kartı eklendi, dört sekmeyi açma ihtiyacı kalktı); taslak
  ~55 → ~45.

### 4.6 Alım aç: rehberli akış (`/hiring/openings/new`)

Sürüm 3'ün üç adımı W kurallarına oturur; plan Görev 19'un modeli (`new-opening-steps.ts`) aynen
kalır, kabuğu `GuidedFlow` olur.

```
│  Alım aç                                                                     Çık         │ FlowHeader
│  ┌─────────────────────────────┐   ┌──────────────────────────────────────────────────┐ │
│  │ Hangi pozisyon için?        │   │ [ Destek Uzmanı                              ⌄ ] │ │ adım 1 (split)
│  │ Kütüphanedeki bir pozisyonu │   │  Profil: 3 yetkinlik · ağırlıklar eşit            │ │
│  │ seç ya da yeni bir ad yaz.  │   │                                                  │ │
│  └─────────────────────────────┘   └──────────────────────────────────────────────────┘ │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤
│  ‹ Alımlara dön                          Adım 1 / 3                    [ Devam et ]       │ StepFooter sticky
```

| Adım | Soru | Gösterilen | "Devam et" bekler (mevcut neden) | Sunucu reddi bu adıma |
|---|---|---|---|---|
| 1 Pozisyon | "Hangi pozisyon için?" | Mevcut pozisyon seçici (`new-opening-form.tsx:109-171`), seçilince profil özeti (`profileSummary`) | `needPosition` | `POSITION_NAME_REQUIRED` (`needPosition`), `POSITION_NOT_FOUND` (`positionGone`) |
| 2 İlan (yalnız yeni ad, plan kararı 13) | "İlan metnin var mı?" | Metin alanı, `jobAdHint`; ikincil "İlan metni olmadan devam et" | yok | - |
| 3 Nasıl başlayalım | "Nasıl başlayalım?" | Üç `ChoiceCard` (AI, Kopyala, Boş); Kopyala seçilince kaynak seçici; ilan yoksa AI kartı nedenli kapalı (`startAiDisabled`) + kütüphane pozisyonunda "İlan metnini pozisyona ekle" bağlantısı. Altında özet satırı: "Destek Uzmanı · ilan metni var · AI taslağı" | `needCopySource` | `JOB_AD_REQUIRED` (`startAiDisabled`), `COPY_SOURCE_NOT_FOUND` (`copySourceGone`), `INVALID` / `FAILED` (`failed`) |

- **Dolu buton:** adım 1-2 "Devam et", adım 3 "Alımı oluştur" (`createOpeningAction`, değişmez).
  Sonra sunucunun `next`'i (`src/solutions/hiring/server/openings.ts:122`): AI ise AI taslağı, değilse
  kurucu; ikisinde de yol şeridi "Kurulum 1 / 5" der.
- **Çıkış:** "Çık" / "Kaydetmeden çık" (W7) Alımlar'a; adım 1'de "‹ Alımlara dön" footer'ın Geri
  yuvasında.
- **Özet adımı neden yok (H3):** üç adım ve son adım bütün kararları tek satırda zaten gösteriyor;
  ayrı bir özet bir tık ekler, bir şey yakalamaz (playbook 3).
- **Kelime:** tek sayfa ~74 → adım başına 20-30.

### 4.7 Değerlendirme: kurucu editör kalır (H2), puan kartı, AI taslağı, önizleme

**Karar: kurucu sihirbaz olmaz.** K12 "adım adım" istiyor; kurucu ise sık, serbest ve sırasız
düzenlenen bir iş: aşama ekleme, soruyu taşıma, metni düzeltme, geri alma. Onu adımlara bölmek
yöneticiyi her düzeltmede baştan yürütür, otomatik kayıt kuyruğunu ve 8 sn geri almayı (`builder/save-queue.ts`,
`edit/actions.ts:119-193`) bir özet adımına bağlamaya zorlar ve "bir alanı değiştirmek için beş ekran"
üretir: K12'nin "no brainer" sözünün tersi. K12'nin kurucudaki karşılığı üç şey:
1. **Yol:** kurulumda kurucuya kurulum yolu getirir, yol şeridi "Kurulum 1 / 5 · Sıradaki: Puan
   kartı ›" der (4.5). Yöneticinin "şimdi ne yapmalıyım?" sorusu kurucunun içinde de cevaplı.
2. **Rehberli başlangıç zaten var:** "İlan metninden AI taslağı" kart kart ilerleyen bir akış
   (öneriyi kabul et / atla); boş başlayan yönetici için "Soru ekle" tek karar: soru türü beş
   `ChoiceCard` (Video, Ses, Yazılı, Seçmeli, Dosya; `addActivityAction(type)`).
3. **Ekranda bir soru:** sağda yalnızca seçili soru, `LanguageTabs` ile tek dil, süre ve haklar tek
   satırlık özetin arkasında (sürüm 3'teki gibi).

Tel çerçeve sürüm 3'teki gibi (tek kat sekme, `[ Kurucu | Puan kartı ]`, dolu "Önizle"):

```
│  Genel bakış   Adaylar   Değerlendirme   Ekip ve kurallar                                │
│  Kurulum 1 / 5 · Sıradaki: Puan kartında çapalar ›                                       │ yol şeridi (yalnız taslak)
│  [ Kurucu | Puan kartı ]                 ✓ Kaydedildi   [AI ile öner]   [ Önizle ]       │ tek dolu: Önizle
│  ┌──────────────────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1 Tanışma     10 dk  │  │ (▭ Video)  Soru 1 / 3 · Tanışma                    ⋯     │  │
│  │  ▭ Bize kendinden... │  │ [ TR | EN ● ]                                            │  │ LanguageTabs
│  │  + Soru ekle         │  │ Soru metni                                               │  │
│  │ + Aşama ekle         │  │ Ölçtüğü yetkinlik: (İletişim ×) (+ ekle)                 │  │
│  │ 2 aşama · 20 dk      │  │ Süre ve haklar: 30 sn düşünme · 2 dk cevap · 1 tekrar  ⌄ │  │ Disclosure
│  └──────────────────────┘  └──────────────────────────────────────────────────────────┘  │
```

- **Puan kartı:** matris aynen (yoğun, doğru; editör). İki çok alanlı iş akışa döner:
  **Ağırlıklar** tek karar adımı ("Yetkinlikler eşit mi önemli?": `Eşit` / `Kendim ayarlayacağım`;
  ikincisi aynı adımda yüzde alanlarını ve canlı toplamı açar; kaydet `saveDraftWeightsAction`,
  `scorecard/actions.ts:49`, ret kodları `scorecard/result.ts:18-33` aynen, `NOT_100` toplamın
  yanında); **Çapalar** (bir yetkinliğin 1-5 seviyesi) bugünkü `anchor-sheet.tsx` Sheet'inde,
  kütüphanedeki çapa akışının (4.11) aynısı: seviye 1 → 3 → 5 → ara seviyeler → özet → "Çapaları
  kaydet" (`saveAnchorsAction`, `:93`; `LIBRARY_FORBIDDEN`, `ARCHIVED`, `ANCHORS_REQUIRED` mevcut
  cümleleriyle). Yayındaki ağırlık değişikliği (gerekçeli, `addWeightSetAction` `:68`) aynı adımın
  sonuna "Neden değiştiriyorsun?" alanı ekler.
- **AI taslağı:** sağ üstte outline eylem; mevcut akış (öneri kartları birer birer) aynen, görünümü
  M6'da `StepFooter` ile.
- **Önizleme:** dolu eylem, tam ekran katman; "Mobil görünüm" yerine "1024 genişlik" (K2).
- **Dilim:** M6, sonraki plan (H5). Plan 2b'de kurucuya yalnızca yol şeridi gelir (M5, `OpeningHeader`
  üzerinden; kurucunun dosyalarına dokunulmaz).

### 4.8 Adaylar sekmesi, aday detayı ve inceleme (tasarım burada, **uygulama plan 3**, K5)

Plan 3 bu ekranları yeniden kuruyor (HIRING-UX 5.12-5.17); davranış oradaki gibi, görsel katman
bu belgeden. Plan 3 başlamadan önce bu bölüm plan 3'ün girdisi olarak verilir. **K12 notu:** plan
3'ün çok alanlı işleri W kurallarına uyar: "Tekrar iste" (HIRING-UX 5.16) Sheet içinde iki adım
(ne tekrar edilecek → neden) + özet; karar rayı zaten tek karar (İlerlet / Beklet / Devam etmiyor) +
gerekçe ve tek dolu "Kararı kaydet", akış değil. Adaylar tablosu yoğun kalır (P5), kontrol görünümü
değildir: alımın kontrol görünümü Genel bakıştır (4.5).

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
Klavye kısayolları, bağımsızlık ve bütünlük kuralları HIRING-UX 5.14'teki gibi. İnceleme ekranı
zaten soru soru ilerleyen bir akıştır; K12 burada ek bir şey istemez.

**Karşılaştır (plan 3):** HIRING-UX 5.15 aynen; tablo yoğun kalır (P5), görünüm seçici
iki parçalı seçici, boş durum `EmptyState`.

### 4.9 Aday davet et: rehberli akış (Sheet ve `/hiring/invite` sayfası)

Davetin işi "adayı 30 saniyede davet edip linki göndermek" (1. bölüm, Deniz). Akış bu yüzden kısa:
**kişi adımı + özet**; dil ve son gün özette varsayılanlarıyla durur (G8), değiştirmek isteyen
"Değiştir" ile kendi adımını açar.

```
 1 Kişi                                 2 Özet                                Hazır
┌──────────────────────────────────┐   ┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ Aday davet et              Çık ✕ │   │ Aday davet et              Çık ✕ │  │ [inviteReady çizimi 96px]        │
│ Ürün Tasarımcısı                 │   │ Özet                             │  │ Link hazır                       │
│ Kimi davet ediyorsun?            │   │ Kişi   Elif Kaya ·  Değiştir     │  │ Elif Kaya için · son gün 25 Eki  │
│ [ Tek aday | Liste yapıştır ]    │   │        elif@ornek.test           │  │ ┌──────────────────────────────┐ │
│ Ad soyad                         │   │ Dil    Türkçe         Değiştir   │  │ │ https://…/a/Rl7fS-f…         │ │
│ [ Elif Kaya                    ] │   │ Son gün 19 Eki (alımın) Değiştir │  │ └──────────────────────────────┘ │
│ E-posta                          │   │ ● Ekipte 1 değerlendirici var,   │  │ Hazır mesajı gör               ⌄ │
│ [ elif@ornek.test              ] │   │   kural 2 istiyor.  Ekibe ekle › │  │ Bu link bir daha gösterilmez;    │
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤   ├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬┤  │ kapatmadan önce kopyala. ...     │
│ Adım 1 / 2         [ Devam et ]  │   │ ‹ Geri          [ Linki oluştur ]│  │ [        Linki kopyala         ] │
│  Adayın adını yaz.               │   │                                  │  │ Başka aday davet et · Adaylara git│
└──────────────────────────────────┘   └──────────────────────────────────┘  └──────────────────────────────────┘
```

| Adım | Soru | Gösterilen | Bekler (mevcut `inviteReason`, `form-rules.ts:18`) | Sunucu reddi bu adıma (`InviteRefusal`, `invitations.ts:88-98`) |
|---|---|---|---|---|
| 0 Alım (yalnız sayfada ve birden çok davet edilebilir alım varsa) | "Hangi alım için?" | `ChoiceCard` satırları (alım adı, son gün) | `noOpening` | `NOT_FOUND` |
| 1 Kişi | "Kimi davet ediyorsun?" | İki parçalı seçici (Tek aday / Liste yapıştır); tek adayda ad ve e-posta; listede yapıştırma alanı ve satır önizlemesi (mevcut) | `name`, `email`; listede `noRows`, `rows` | `NAME`, `EMAIL`, `DUPLICATE` (mevcut "yine de davet et" yolu adımın altında, `allowDuplicate`) |
| Dil (özetten) | "Aday hangi dilde görsün?" | İki kart: Türkçe / English (varsayılan Türkçe) | yok | - |
| Son gün (özetten) | "Link ne zamana kadar açık kalsın?" | `deadlineRow` (plan Görev 21): alımın günü varsayılan; tarih alanı | `deadline` | `DEADLINE_INVALID`, `DEADLINE_PAST` |
| 2 Özet | - | Kişi, dil, son gün satırları ve "Değiştir"; ekip kuralın altındaysa dot + metin + "Ekibe ekle ›" (`panelShortfall`); alımla ilgili engeller | `notPublished`, `noEvaluators`, `openingDeadline` | `CLOSED`, `NOT_PUBLISHED`, `OPENING_DEADLINE_PASSED`, `NO_EVALUATORS`, `FORBIDDEN`, `FAILED`: özette mevcut `err*` metniyle |

- **Dolu buton:** adım 1 "Devam et", özette "Linki oluştur" (`inviteCandidateAction` ya da
  `inviteManyAction`, değişmez). Hazır ekranında dolu "Linki kopyala"; hazır mesajı `Disclosure`
  arkasında ("Mesajı kopyala" orada); "Başka aday davet et" (akışı adım 1'e döndürür, alım ve dil
  korunur) ve "Adaylara git" (C13) metin.
- **Tık sayısı:** ad ve e-posta yazılır, "Devam et", "Linki oluştur", "Linki kopyala": 3 tık
  (sürüm 3 hedefi 4 tıktı). Görev 22'nin "30 sn / 4 tık" ölçümü aynen geçerli.
- **Kabuk:** alımın sayfalarında `Sheet` (480px) içinde `GuidedFlow` (StepFooter Sheet'in altına
  yapışık); `/hiring/invite` sayfasında tam `GuidedFlow`, ilk satırı alımın adı (C19). Sheet kilidi
  (`sheetLocked`, `form-rules.ts:60`) aynen: istek sürerken ya da link gösterilirken Escape ve dışarı
  tık kapatmaz.
- **Kalan:** "bir daha gösterilmez" uyarısı tam metin; çoklu yapıştırma ön izlemesi ve satır
  sonuçları (yalnızca kabuğu değişir); `lead`, `panelShort`, `onceNote*`, `err*`, `reason*` metinleri.
- **Kelime:** adım 1 ~20, özet ~30, hazır ~35 (sürüm 3: form 38, hazır 35).

### 4.10 Ekip ve kurallar: özet + kısa akışlar + kapat (`/hiring/openings/[id]/settings`)

Bugün on alan tek sayfada, tek "Kaydet"le (4.1). Sürüm 4'te sekme bir **kuralların özeti**dir
(salt okunur kontrol görünümü); her grup kendi kısa akışıyla değişir. Akışlar aynı sayfada, adres
çubuğundaki hash ile açılır (W3; yeni rota yok, menü ve rota testleri değişmez).

```
 Özet (sekmenin varsayılanı)
│  Genel bakış   Adaylar   Değerlendirme   Ekip ve kurallar                                │
│  Kurulum 3 / 5 · Sıradaki: Ekibi ata ›                                (yalnız taslakta)  │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ [users]  Ekip            Kadir Ay (karar veren) · Ece Yıldız          Değiştir ›     │ │ SummaryRows
│  │                          Her adayı 2 kişi değerlendirir.                             │ │
│  │ [mail]   Aday iletişimi  Son gün 19 Eki · 7 günde dönüş · deniz@ornek  Değiştir ›     │ │
│  │ [eye-off] Adil değerlendirme  Kimlik açık · bitiş anketi açık          Değiştir ›     │ │
│  │ [lock]   Değerlendiriciler birbirinin puanını kendi puanlarını gönderince görür.     │ │ IconRow, ayar değil
│  │ [tag]    Alımın adı      Ürün Tasarımcısı · Ekim                       Değiştir ›     │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
│  Alımı kapat                                                                             │ metin eylem
│  Kapalı alıma yeni davet yapılamaz; değerlendirme ve kayıtlar okunur kalır.              │ closeBody (mevcut)

 Ekip akışı, adım 1 (#team-members)
│  Ekip ve kurallar · Ekip                                                    Çık          │ FlowHeader
│  Kim değerlendirecek?                                                                    │
│  Her adayı burada seçtiklerin değerlendirir.                                             │
│  [✓ (KA) Kadir Ay · Sahip ] [✓ (EY) Ece Yıldız · Değerlendirici ] [ (MÖ) Mert Öz · ... ]│ ChoiceCardGroup multi
├▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭┤
│  ‹ Özete dön                         Adım 1 / 4                         [ Devam et ]      │
```

**Akışlar** (hepsi `saveOpeningRulesAction(openingId, değerlerin tamamı)`, `settings/actions.ts:37`;
dokunulmayan alanlar yüklendiği gibi geri gider, eylem ve tam değiştirme davranışı bugünküyle aynı):

| Akış (hash) | Adımlar: soru · alan · bekler | Özet |
|---|---|---|
| **Ekip** (`#team-members`, `#team-decider`, `#team-min`, `#team-review`) | 1 "Kim değerlendirecek?" · `memberIds`, çoklu kart; pasif kişi listede yalnızca ekipteyse, çıkarılabilir, eklenemez (`opening-settings-form.tsx:126-135`) · `MEMBER_UNKNOWN`. 2 "Kararı kim verecek?" · `decisionMakerId` tekli kart (yalnızca karar verebilenler; artık karar veremeyen kayıtlı kişi işaretli ve seçilemez, `:69-80`), altında "Yedek karar veren" açılır alanı `backupDecisionMakerId` ("Yedek yok" varsayılan) · `DECISION_MAKER_REQUIRED`, `DECISION_MAKER_ROLE`, `BACKUP_SAME`, `BACKUP_ROLE`. 3 "Her adayı kaç kişi değerlendirsin?" · `minEvaluations` 1-5 kare kart; ekip küçükse `minEvaluationsShort`, altında `minEvaluationsOverride` · `MIN_EVALUATIONS` | 4 Özet, "Kaydet" |
| **Aday iletişimi** (`#contact-deadline`, `#contact-feedback`, `#contact-email`, `#contact-review`) | 1 "Son gün ne zaman?" · `deadline` iki kart: "Son gün yok" / "Bir gün seç" + tarih (geçmiş gün yalnız değişirse reddedilir, `opening-rules.ts:62-66`), `deadlineHint` saat dilimiyle · `DEADLINE_INVALID`, `DEADLINE_PAST`. 2 "Adaya kaç günde dönmeyi söz veriyorsun?" · `feedbackDays` 1-60 sayı alanı + 3 / 7 / 14 hızlı seçim, `feedbackHint` · `FEEDBACK_DAYS`. 3 "Aday sorusunu kime yazsın?" (isteğe bağlı) · `candidateContactEmail` · `EMAIL` | 4 Özet, "Kaydet" |
| **Adil değerlendirme ve anket** (`#fair-blind`, `#fair-survey`, `#fair-review`) | 1 "Değerlendiriciler adayın kimliğini görsün mü?" · `blindMode` iki kart (Görsün / Gizle), `blindModeHint` adımın açıklaması. 2 "Aday bitince kısa bir anket görsün mü?" · `finishSurveyEnabled` iki kart, `finishSurveyHint` | 3 Özet (+ kilitli kural `IconRow`, `independence` / `independenceLocked`), "Kaydet" |
| **Alımın adı** (`#name`) | Tek adım (H2) "Alımın adı ne olsun?" · `name` · `NAME_REQUIRED`; kayıt sonrası başka alımda aynı ad varsa mevcut `savedRenamed` | Ayrı özet yok, dolu "Kaydet" adımda |

- **Özet adımı (P8):** satırlar o akışın kararları; değişen satırın yanında "değişti" (ink, kalın
  değil, dot yok); dolu "Kaydet" değişiklik yokken "Değişiklik yok." nedeniyle bekler. Kayıt sonrası
  sekmenin özetine döner, üstte mevcut `saved` / `savedRenamed` cümlesi `role="status"`.
- **Sorun → adım (W8):** `NAME_REQUIRED` → ad; `MEMBER_UNKNOWN` → ekip 1; `DECISION_MAKER_*`,
  `BACKUP_*` → ekip 2; `MIN_EVALUATIONS` → ekip 3; `DEADLINE_*` → iletişim 1; `FEEDBACK_DAYS` →
  iletişim 2; `EMAIL` → iletişim 3. Başka bir akışın alanında sorun varsa (bugün kaydedilmiş geçersiz
  bir değer, örn. pasifleşmiş karar veren) kayıt o akışın ilgili adımını açar ve mevcut cümleyi
  gösterir. Kodlar `NOT_FOUND`, `FORBIDDEN`, `CLOSED`, `INVALID` (`settings/result.ts:11-14`) ve
  yakalanmamış hata (`saveFailed`) özette, mevcut `err*` cümlesiyle. Saf fonksiyon `rulesStepOf(problem)`,
  testli.
- **Alımı kapat (akış değil):** özetin altında metin eylem "Alımı kapat" ve altında mevcut tek cümle
  (`hiringSettings.closeBody`). Tıklanınca hemen kapanır (`closeOpeningAction`, `:62`), sayfa
  `?closed=1` ile döner ve 8 sn `UndoStrip` "Alım kapatıldı." + "Geri al" (`reopenOpeningAction`,
  `:75`). Onay diyaloğu yok (RULES kural 4). Kapalı alımda özet salt okunur, dolu "Yeniden aç".
- **Değerlendirici:** özeti salt okur (bugünkü kural: yalnızca alımdaki kişileri görür,
  `settings/page.tsx:39-43`), "Değiştir" ve "Alımı kapat" yok.
- **Kurulum yolundan gelince:** ekip akışının özetindeki "Kaydet" sonrası yol şeridinin sıradaki
  adımına ("Adayın göreceğini önizle") bir metin bağlantısı görünür; otomatik yönlendirme yok
  (kaydın sonucu görülsün).
- **Kelime:** özet ~70 görünen (sürüm 3 sayfası ~150); akış adımı başına 15-30.

### 4.11 Kütüphane, Ayarlar, kullanıcı davet, giriş (M9, M10; sonraki plan)

Hepsi W kurallarına uyar; tasarım burada, uygulama sonraki planda (H5).

- **Pozisyon ekle (`/library/positions/new`):** 1 "Pozisyonun adı ne?" (`name`, `nameRequired`) →
  2 "Hangi ekipte?" (isteğe bağlı, "Atla") → 3 "İlan metnin var mı?" (isteğe bağlı, `jobDescriptionHint`)
  + özet satırı; dolu "Pozisyonu oluştur" (`createPositionAction`, `src/app/(manager)/library/actions.ts:126`,
  değişmez; başarıda detay sayfasına yönlendirir; ret `NAME_REQUIRED` → adım 1, diğerleri
  `saveFailed`).
- **Pozisyon detayı = pozisyonun kontrol görünümü:** satırlar Ad, Ekip, Kısa tanım, İlan metni,
  Beceriler, Diller, Yetkinlik profili (n yetkinlik · ağırlıklar); her satır "Değiştir ›" ile tek
  adımlık düzenleme, sonra özet ve dolu "Kaydet" (`savePositionAction` `:135`; `PositionWriteError`
  `src/server/library-write.ts:288`: `NAME_REQUIRED` → ad, `COMPETENCY` → profil, `ARCHIVED` /
  `NOT_FOUND` özette). Yetkinlik profili adımı tek karar ("Bu pozisyon hangi yetkinlikleri ister?"):
  satır ekle / çıkar, ağırlık ve beklenen seviye o adımın içinde (liste editörü; `profileLimit`,
  `weightInvalid` aynen). Sayfanın dolu eylemi "Bu pozisyonla alım aç" (`/hiring/openings/new?position=`,
  mevcut ön seçim, `new/page.tsx:26`); "Arşivle" `⋯` menüsünde, mevcut arşiv ve geri alma akışıyla.
- **Yetkinlik ekle:** 1 "Yetkinliğin adı ne?" (`LanguageTabs`, `nameRequired`) → 2 "Ne ölçer?"
  (tanım) + özet satırı; dolu "Yetkinliği oluştur" (`createCompetencyAction` `:60`; başarıda detaya
  yönlendirir). Detayda ilk eksik iş "Çapaları yaz ›".
- **Yetkinlik detayı = kontrol görünümü + çapa akışı:** satırlar Ad, Tanım, Çapalar (`3 / 3 zorunlu ·
  2 / 2 isteğe bağlı`), Etiketler, "İncelendi" durumu. **Çapa akışı:** 1 "1. seviye neye benzer?" →
  2 "3. seviye?" → 3 "5. seviye?" → 4 "Ara seviyeler" (2 ve 4, isteğe bağlı, "Atla") → 5 Özet, dolu
  "Kaydet" (`saveCompetencyAction` `:69`). Adım 1'de outline "AI ile çapa öner" (`draftAnchorsAction`
  `:160`): öneri bütün seviyeleri doldurur, yönetici adım adım okur ve düzeltir (öneri yazılmaz,
  mevcut kural). Ret: `ANCHORS_REQUIRED` → ilk eksik seviyenin adımı (`anchorRequired`), `NAME_REQUIRED`
  → ad, `TOO_MANY_TAGS` → etiketler, `ARCHIVED` → özette `archivedNoSave`. `AnchorLadder` özetteki
  merdivendir (1, 3, 5 zorunlu işaretli). Puan kartındaki çapa Sheet'i aynı akışı kullanır (4.7).
- **Skala etiketleri (`ScaleForm`):** beş kısa etiket tek karardır ("Seviyelerin adları"); tek
  adımlık düzenleme, `LanguageTabs`, dolu "Kaydet" (`saveScaleAction` `:103`). Akış değil (H2).
- **Kütüphane listeleri:** yoğun tablo kalır (P5); boş durum `emptyLibrary`; "Arşivdekiler (n)" çipi
  aynen.
- **Ayarlar (`/settings`):** organizasyon bölümü özet satırları (Ad, Medya saklama n gün, Aday kaydı
  saklama n gün); her satır tek adımlık düzenleme + "Kaydet" (`saveOrgSettings`,
  `src/app/(manager)/settings/actions.ts:31`; FormData ile diğer iki değer gizli alan olarak aynen
  gider; `?error=name` ad adımını, `?error=retention` ilgili saklama adımını mevcut metniyle açar).
  Kullanıcılar ve roller yoğun tablo kalır (rol değişikliği mevcut 8 sn geri almalı). Denetim kaydı
  değişmez. Solda yapışkan bölüm gezintisi (sürüm 3) kalır.
- **Kullanıcı davet et (`/settings/users/new`):** 1 "Kimi davet ediyorsun?" (ad) → 2 "E-postası ne?"
  → 3 "Rolü ne olsun?" (üç `ChoiceCard`, açıklamaları mevcut `settings.roleHelp.*`) + özet satırı;
  dolu "Davet linkini oluştur" (`inviteUser`, `:176`, değişmez). Ret: `NAME_REQUIRED` → 1;
  `EMAIL_INVALID`, `EMAIL_TAKEN` → 2; `ROLE_INVALID` → 3. Hazır ekranı link bir kez, mevcut
  `noEmailSent`, `readyHint`, "Başka kişi davet et".
- **Giriş ve hesap kurulumu:** ortalanmış tek kart, tek dolu buton, çizim yok; metinler aynen.

### 4.12 Sınavın yönetici ekranları (düşük öncelik, canlı)

Sınav canlıda (MEMORY: 2026-09-30'dan beri main ve prod). Bu ekranlar için yalnızca **tutarlılık**
önerilir, yeniden tasarım değil; K12 sınavın formlarına **uygulanmaz** (K6'nın ruhu: canlı sınav
değişmez):

- Ortak kabuk (P1 yan menü ikonları), `PanelHeader` (P2), `EmptyState` (P4) ve durum sözlüğü (P9)
  ortak bileşenlerden gelir; bunlar değişince sınav ekranları **kendiliğinden** değişir. Her biri
  için bayrak: M1 sınav ekranlarına dokunur.
- Sınava özgü içerik (öğrenci sonucu sekmeleri, AI önerisi onayı, bütünlük, soru bankası düzenleyicisi,
  öğrenci ve sınav oluşturma formları) bu planda **değişmez**. Sınav metinlerinin "siz" hitabı
  değişmez (K9). `GuidedFlow` sınav sayfalarında kullanılmaz.
- K8: sınavın aday tarafındaki "Genelde aynı gün dönülür" / "e-posta ile dönülecek" metinleri
  şimdilik kalır.
- E1 dilimi (isteğe bağlı, en son): sınav listelerinin boş durumları ve sayfa başlıkları, yalnızca
  sınav penceresi dışında ve önce/sonra ekran görüntüsü karşılaştırmasıyla. Sınav formlarının
  akışa dönmesi ayrı bir kullanıcı kararı ister (7. bölüm, soru 8).

---

## 5. Yeni paylaşılan bileşenler

**Yer (sürüm 4 düzeltmesi):** paylaşılan görsel parçalar `src/components/visual/` altındadır (plan
kararı 1, hüküm C12: ESLint'in çekirdek kuralı `eslint.config.mjs:11-35` çekirdek dosyaların
`@/components/hiring/*` içe aktarmasını yasaklıyor ve Bugün çekirdek). Sürüm 3'teki
`src/components/hiring/visual/` yolu eskidi. Aday ekranlarına özel parçalar (kapı, ekranlar)
`src/components/hiring/candidate/`, panel parçaları `src/components/manager/` ve işe alıma özel
olanlar `src/components/hiring/`. Panel parçaları `src/components/panel/`'de değil (plan 2b Bölüm 2'nin
yerleşim kuralı, Görev 23'te düzeltildi): `src/solutions/boundary.test.ts` `src/components/panel/`'i
sınavın paneli sayar ve onu içe aktaran her işe alım dosyasını reddeder; `src/components/manager/`
çekirdektir ve işe alım onu zaten kullanıyordu. Kademe-owned dosyalar `// kademe-owned` başlığı taşır (RULES.md
shadcn bölümü).

**Aday tarafı ve ortak görsel parçalar.** "Durum" sütunu: Görev 3-4'te kuruldu mu (HEAD 3c2e2e2'de
`src/components/visual/` listelendi; bileşen imzaları yalnızca `step-screen.tsx`, `step-footer.tsx`,
`footer-action.ts`, `path-steps.tsx`, `choice-card.tsx` için okundu, diğerleri doğrulanmadı).

| Bileşen | Props (öz) | Durum | Kullanıldığı yer |
|---|---|---|---|
| `classifyDevice` (saf fonksiyon) | `({ ua, chMobile, coarse, anyFine, hasDisplayMedia, maxTouchPoints }) => "desktop" \| "phone" \| "tablet" \| "unknown"` | Kuruldu (Görev 1, `src/components/hiring/candidate/device-class.ts`) | Sunucu ve istemci kapısı |
| `DesktopGate`, `DesktopOnlyScreen`, `NarrowWindowStrip` | 3.0 | Kuruldu (Görev 2, `hiring/candidate/desktop-gate.tsx`, `desktop-only.tsx`) | `renderHiringPage` (plan kararı 2) |
| `StepScreen` | `{ layout: "split" \| "single"; illustration?; illustrationSize?; kicker?; title; titleRef?; lead?; aside?; width?: 640 \| 760 \| 1000; enter?: boolean; children }` | Kuruldu (`visual/step-screen.tsx:15-38`) | Aday ekranları; **panelde `GuidedFlow`'un adımları** |
| `StepFooter` | `{ primary?: FooterAction; secondary?: FooterAction; back?: { label; onClick?; href? }; journey?: { steps; current; label }; hint?; placement?: "viewport" \| "sticky" }` | Kuruldu (`visual/step-footer.tsx:58-73`) | Aday ekranları (`viewport`); **panel akışları (`sticky`)** |
| `FooterAction` (tip) | `button` (`busy`, `busyLabel`, `waitReason`) ya da `link` | Kuruldu (`visual/footer-action.ts`) | Tek dolu buton, nedenli bekleme (plan kararı 4) |
| `JourneyProgress`, `QuestionProgress` | yalnızca sayı | Kuruldu | Footer üst kenarı; panelde "Adım n / N" |
| `Disclosure`, `IconRow`, `FactTiles` | sürüm 3'teki gibi | Kuruldu | Aday ekranları; panelde kilitli kural, huni |
| `PathSteps` | `{ steps: { title; detail?; state?: "done" \| "current" \| "todo"; action? }[] }` | Kuruldu (`visual/path-steps.tsx:18-23`) | Aday; **panelde `SetupPath`** |
| `ChoiceCardGroup` | `{ type: "single" \| "multi"; value: string[]; onChange; items: { value; label; marker?; shortcut?; description?; disabled? }[] }` | Kuruldu (`visual/choice-card.tsx:9-36`) | Aday; **panelde akış adımlarının seçimleri** (ekip çoklu seçimi dahil) |
| `TimerRing`, `StatusScreen`, `MediaStage`, `Illustration` (15 çizim) | sürüm 3'teki gibi | Kuruldu | Aday ekranları; panelde yalnızca `Illustration` (boş durum, davet hazır) |

**Panel bileşenleri (K7 + K12).** Kurulan dosyalar (Görev 14-22): `src/components/manager/`
altında `panel-header.tsx`, `row-menu.tsx`, `empty-state.tsx`, `guided-flow.tsx` (`GuidedFlow`,
`FlowHeader`, `useFlowStep`; `GuidedFlow`'un gerçek props'u `{ kicker; step; journey; back; exit?;
enter?; arrive?; container? }`, adımın durumunu çağıranın `useFlowStep`'i tutar), saf model `flow-model.ts` (`flowStepOf`, `flowHashFix`, `flowJourney`,
`exitKey`, `summaryRows`, `isDirty`, `stepOfProblem`, `saveWait`, `flowFocusKey`), `summary-rows.tsx`
(`SummaryRows`; ayrı bir `SummaryStep` bileşeni yok, özet adımı gövdesi `SummaryRows` olan sıradan bir adım),
`control-row.tsx`, `next-task-card.tsx`; `openingNextStep` `src/components/hiring/opening-next-step.ts`.
`SetupPath` ayrı bir bileşen değil: `PathSteps` + `setupProgress` / `setupNext`
(`src/app/(manager)/hiring/openings/[id]/setup-steps.ts`), şerit varyantı `OpeningHeader`'ın kurulum
satırı; `FunnelTiles` Genel bakışta yerinde çizildi. Aşağıdaki tablo sürüm 4'ün planıdır; ad farkı
olan yerde bu paragraf geçerli.

| Bileşen | Props (öz) | Yerini aldığı / kullanıldığı yer | Dilim |
|---|---|---|---|
| `PanelHeader` | `{ kicker?; title; meta?; primary?; menu?: { label; items: RowMenuItem[] } }` | `PageHead` (`components/panel/bits.tsx:39`) ve `PageTitle`. **Sınav ekranları da kullanır (bayrak).** | M1 |
| `ManagerNav` v2 | öğe başına `icon` | `components/manager/nav.tsx`. **Sınav menüsünü de çizer (bayrak).** | M1 |
| `RowMenu` | `{ label; items: { label; detail?; href?; onSelect?; disabledReason? }[] }` | Alım satırı, Genel bakış `⋯`, aday satırı (plan 3) | M1 |
| `EmptyState` | `{ illustration; title; body; action; secondary? }` | Alımlar, Bugün, Adaylar, kütüphane | M1 |
| **`GuidedFlow`** (yeni, K12) | `{ flow: string; steps: FlowStep[]; step: string; onStep; exit: { href; dirty: boolean }; summary?: ReactNode; container?: "page" \| "sheet" }`; `FlowStep = { id; title; lead?; layout: "single" \| "split"; body: ReactNode; primary: FooterAction; secondary?: FooterAction; optional?: boolean }` | Her panel akışı; `StepScreen` + `StepFooter placement="sticky"` + `FlowHeader` üstüne kurulur; odak `useStepFocus`, adım hash'te (W3) | M-W (plan 2b) |
| **`flow-model.ts`** (saf model, yeni; `src/components/manager/flow-model.ts`, sürüm 4'teki adı `guided-flow.ts`) | `flowStepOf(hash, { steps, firstInvalid })`, `flowJourney(steps, current)`, `exitKey(dirty)`, `summaryRows(before, after, fields)` (değişti işareti), `stepOfProblem(map, problem)` | `GuidedFlow`'un ve her akışın testli çekirdeği | M-W |
| **`FlowHeader`** (yeni) | `{ kicker; exit: { href; label } }` | Akışın üst satırı (W2, W7) | M-W |
| **`SummaryStep` / `SummaryRows`** (yeni) | `{ rows: { label; value; changed?: boolean; editHref?: string; problem?: string }[]; readOnly?: boolean }` | Akışların özeti (W5, P8); ekip ve kurallar özeti, Genel bakışın "Bu alımın kuralları" kartı, yayın özeti | M-W |
| **`ControlRow`** (yeni) | `{ title; status: ReactNode; progress?: ReactNode; attention?: { icon; text }[]; facts?: ReactNode; next: { label; href } \| null }` | Alımlar kontrol görünümü (4.4); Görev 18'in `OpeningCard`'ının yerine | M3 |
| **`openingNextStep`** (saf, yeni) | `(input: { status; setup?: { current; key } ; facts?: OpeningCardFacts; shortfall?: boolean; draftWaiting?: boolean; runs: boolean }) => { kind; href } \| null` | KG2, `src/components/hiring/opening-next-step.ts` | M3 |
| `NextTaskCard` | `{ solution; title; detail; action: { label; href } }` | Bugün'ün "Sıradaki iş"i | M2 |
| `FunnelTiles` | `FactTiles` varyantı, kutular arasında `chevron-right` | Genel bakış hunisi (Görev 20 yerinde çizer) | M5 |
| **`SetupPath`** (sürüm 3'teki `SetupSteps`'in yerine) | `PathSteps` + `setupProgress` (plan Görev 20'de yazıldı; v4'te Görev 18'e taşınır, kontrol görünümü önce ister) + şerit varyantı `{ variant: "list" \| "strip" }` | Taslağın kurulum yolu ve sayfalardaki yol şeridi | M5 |
| `LanguageTabs` | `{ value: { tr; en }; onChange; required? }` | Kurucu, yetkinlik, pozisyon, skala | M6, M9 |
| `AnchorLadder` | `{ levels: { n; required; tr; en }[] }` | Yetkinlik özetindeki çapa merdiveni | M9 |
| `RequestsStrip`, `CandidateRow` | sürüm 3'teki gibi | Adaylar sekmesi | plan 3 |
| ~~`DirtyBar`~~ | - | **Kaldırıldı (H4):** yerine `SummaryStep` | - |
| ~~`OpeningCard`~~ | - | **Yerine `ControlRow` (H8);** Görev 18'in `funnelShare`'i ve `openingCardFacts`'ı (`invitations.ts`) kalır | - |

**Yeni token yok.** Sürüm 3'ün `--color-illus-*` tokenları Görev 3'te eklendi.

---

## 6. Uygulama dilimleri ("plan 2b")

Her dilim tek başına yayınlanabilir ve test edilebilir; tablo uygulama sırasıdır. Numara eşlemesi
(sürüm 1 → sürüm 2): V0 → V1, V1 → V2, V2 → V3, V3 → V4, V4 → V5, V5 → V6, V6 → V7, V7 → V7b;
sürüm 1'in V8'i (Adaylar sekmesi) ve V9'u (genel bakış) plan 3'e gitti (K5); VG yeni. Boyut: S ≈ yarım
gün, M ≈ 1 gün, L ≈ 2 gün (tek geliştirici + inceleme; tahmin, ölçülmedi).

| # | Dilim | Boyut | Bitti sayılır | Risk |
|---|---|---|---|---|
| **VG** | **Masaüstü kapısı (ilk, tek başına):** `classifyDevice`, `DesktopGate`, `DesktopOnlyScreen` (yalnız "Linki kopyala"), `NarrowWindowStrip`, pencere < 640'ta "Aşamayı başlat" nedeni; `faqPhoneA` ve `needDevice` metinleri; `HIRING-UX.md` 6.15 yerine geçen metin | M | `classifyDevice` için UA matrisi testi: iPhone Safari, Android Chrome telefon, Android tablet, iPad (iPadOS masaüstü UA + dokunma), Mac Safari, Windows Chrome dokunmatik dizüstü (`any-pointer: fine` var), Chromebook, dar masaüstü penceresi (engellenmez), DevTools öykünmesi. Sızıntı testi: telefon ekranının props'unda aşama adı ve soru yok. Elle: gerçek telefonda ve gerçek dokunmatik dizüstünde (Claude in Chrome yalnızca masaüstü tarafını görür; telefon testi kullanıcı ya da cihaz gerektirir) | **Yanlış engel** en büyük risk: kural "iki sinyal ya da kesin UA" (3.0). Dil sınavı rotalarına dokunulmamalı (K6) |
| V1 | Belgeler + token + çizim seti: `HIRING-UX.md` 8.6, 6 "Ortak kurallar", `RULES.md` kural 1 ve 9 güncellenir; `illustrations.tsx` (15 SVG) | S | Birim test: her çizim `aria-hidden`, `<image>`/`href` yok, renkler yalnız `var(--color-illus-*)`; `theme.test.ts` yeni token'ları görür | Düşük |
| V2 | Paylaşılan bileşenler (5. bölüm) + `ActionBar` → `StepFooter` göçü | M | Saf fonksiyon testleri (ilerleme, halka oranı); mevcut ekranlar geçiyor; footer içeriği örtmüyor (1280x720'de son alan görünür) | `shadcn-vendored.test.ts`; odak halkası; 44px |
| V3 | Karşılama → Karşılama + Onay (istemci adımı, aynı URL; geri tuşu Karşılama'ya döner) + Bilgiler | M | Rıza kaydı yalnızca "Kabul et ve başla"da; TR/EN eşit; `hiring-candidate-copy.test.ts` geçiyor; `whoShort` testi | Sabit metin testleri (`promise`, `whoPeople`): metin aynı, yer değişir. Geri dönüşte ek süre seçimi korunur |
| V4 | Cihaz kontrolü alt adımları (split, büyük önizleme) + izin reddi çizimi | L | `device-rows.test.ts` değişmeden geçiyor; dolu buton her alt adımda etkin bir eylem; gerçek kamerayla Chrome, Edge ve Safari'de (otomasyon sekmesi kamerayı kanıtlamaz) | 568 satırlık bileşen; tarayıcıya göre izin akışı |
| V5 | Isınma + video/ses (split, `TimerRing`, not açılır alanı, kayıt yerleşimi) | M | `practice.test.ts`, `take.test.ts`, `runner-model.test.ts` geçiyor; reduced motion'da nabız durur | Kayıt ve yükleme mantığına dokunulmaz |
| V6 | Aşama girişi + yazılı + seçmeli + dosya (G2: "Dosya seç" dolu) | M | Soru parçaları; klavye 1-4; dosya yokken dolu buton seçiciyi açar | Sızıntı testi (`pages.test.ts`): `QuestionProgress` yalnız sayı alır |
| V7 | Bitti + anket + `StatusScreen` | S-M | `done-model.test.ts` geçiyor; sabit metinler aynen | Anket kapalıyken dolu buton yok |

**Yönetici dilimleri (sürüm 4, K12), aday dilimlerinden sonra.** "Sınav" sütunu: dilim canlı sınav
ekranlarına dokunuyor mu. "Plan" sütunu: hangi planın hangi görevi.

| # | Dilim | Boyut | Bitti sayılır | Sınav | Plan |
|---|---|---|---|---|---|
| M1 | Panel kabuğu: `ManagerNav` ikonları, `PanelHeader` (`PageHead` ve `PageTitle` arkasında), `RowMenu`, hata sayfası "sen" (K9); `EmptyState`, tek durum sözlüğü | M | Menü testi (registry ile sayfa dosyası) geçiyor; her sayfa başlığında en fazla bir dolu eylem; sınav sayfalarında önce/sonra metin ve ekran görüntüsü | **Evet** | 2b Görev 14 (değişmez) + Görev 15'in ilk yarısı |
| **M-W** | **Rehberli akış kabuğu (yeni):** `GuidedFlow`, `FlowHeader`, `SummaryStep` / `SummaryRows`, saf `flow-model.ts` (sürüm 4'te `guided-flow.ts`); ortak `flow` metinleri ("Devam et", "Geri", "Özete dön", "Çık", "Kaydetmeden çık", "Değiştir", "değişti", "Adım {n} / {total}", "Değişiklik yok.") | S-M | Model testleri: hash → adım (geçersiz önceki adımda ilk eksiğe döner), geri değerleri korur, çıkış etiketi kirliyken "Kaydetmeden çık", özet "değişti" işareti, sorun → adım haritası; render testi: tek dolu buton, odak başlığa, `JourneyProgress` sayıları; `panel-copy.test.ts` "sen" | Hayır | 2b Görev 15'in ikinci yarısı |
| M2 | Bugün: işe alım `today()` (C6 ile yalnızca uyarlama "Sıradaki iş"; veri hakkı dikkat satırında sayılır), `NextTaskCard`, "Dikkat isteyenler" (taslak satırı "Kuruluma devam et"), "Tüm alımların durumu ›" bağlantısı | M | `module.test.ts` güncellenir; okumalar ardışık (C21); sınav kuyruğu satırları birebir aynı (C17: yalnız satırlar karşılaştırılır); rol başına doğru satırlar, değerlendiriciye işe alım satırı yok | **Evet** | 2b Görev 16-17 |
| M3 | **Kontrol görünümü** `/hiring/openings`: `ControlRow`, gruplar (Kurulumda, Yayında, Kapalılar açılır alanda), `openingNextStep`, özet cümlesi, değerlendirici yalnız sayı (H9), `?tab=` geri uyumu, boş durum | M | `openingNextStep` testi (her dal); değerlendirici satırında talep sayısı ve kurulum eylemi yok (sızıntı testi: değerlendirici için üretilen satır verisinde `openRequests` yok); `?tab=closed` açılır alanı açar; okumalar ardışık; 10 taslakta süre ölçülür | Hayır | 2b Görev 18 (yeniden yazılır) |
| M4 | "Alım aç" `GuidedFlow` üstünde (3 adım, son adımda özet satırı) | S-M | `createOpeningAction` ve ret kodları aynen, her ret doğru adımı açar; geri değerleri korur; `?copy=` ve `?position=` ön seçimleri | Hayır | 2b Görev 19 (kabuğu değişir) |
| M5 | Alımın kontrol görünümü: taslakta `SetupPath` + dolu "Kuruluma devam et" + yol şeridi (`OpeningHeader`) + yayın özeti (`#publish`, "Yayınla"); yayında `FunnelTiles`, dikkat kartı, "Bu alımın kuralları" kartı; `⋯` menü | M | Yayın kapısı ve nedenleri aynen (`publishOpeningAction` ve bildirimleri); "Kuruluma devam et" ilk bitmemiş adıma gider; ekip ve önizleme "Atla" ile geçilir; yol şeridi yalnız taslakta ve yalnız `access.edit`; anket bloğu 5 cevap kuralı aynen | Hayır | 2b Görev 20 (genişler) |
| M7 | Ekip ve kurallar: özet + Ekip, Aday iletişimi, Adil değerlendirme ve anket, Ad akışları + "Alımı kapat" geri almalı | M | `opening-rules` testleri değişmeden geçiyor; `rulesStepOf` her `RulesProblem`'i bir adıma eşler (test); dokunulmayan alanlar yüklendiği gibi gider (test); kapat → 8 sn geri al, diyalog yok; değerlendirici salt okur | Hayır | **2b Görev 21 (yeni)** |
| M8 | Davet: kişi adımı + özet (dil, son gün özetten) + hazır; Sheet ve sayfa | S-M | `form-rules.test.ts` (+ `deadlineRow`) geçiyor; her `InviteRefusal` doğru adıma ya da özete; 30 sn / 3-4 tık elle ölçülür; Sheet kilidi aynen | Hayır | 2b Görev 22 (eski 21, kabuğu değişir) |
| M6 | Değerlendirme çalışma alanı: tek kat sekme, AI taslağı ve Önizleme eylem, `LanguageTabs`, "Soru ekle" tür kartları, ağırlık tek karar adımı, puan kartında çapa akışı, önizlemede "1024" | L | Kurucu kaydetme kuyruğu ve geri alma testleri geçiyor; derin linkler çalışıyor | Hayır | Sonraki plan (plan 3 ile paralel ya da hemen sonra) |
| M9 | Kütüphane: pozisyon ve yetkinlik akışları, kontrol görünümü detayları, çapa akışı, `AnchorLadder`, skala tek adım, boş durumlar, Kütüphane metni "sen" (K9) | M-L | Kütüphane testleri; çapa zorunluluğu (1, 3, 5) görünür; her `CompetencyWriteError` / `PositionWriteError` doğru adıma | Hayır (doğrulanmadı: sınav kütüphaneyi kullanmıyor) | Sonraki plan |
| M10 | Ayarlar özet + tek adımlı düzenlemeler, kullanıcı davet akışı, giriş ve kurulum düzeni, Ayarlar metni "sen" (K9) | S-M | Ayarlar ve denetim testleri; `inviteUser` ret kodları doğru adıma | **Evet** (ayarlar ve giriş ortak) | Sonraki plan |
| P3-a..d | Adaylar sekmesi, aday detayı + karar rayı, inceleme, karşılaştır (4.8; "Tekrar iste" W kurallarıyla) | M-L | Plan 3'ün kabulüyle | Hayır | **Plan 3 uygular** (K5) |
| E1 | Sınav listelerinde `EmptyState` ve başlık düzeni (isteğe bağlı) | S | Önce/sonra ekran görüntüsü, `verify-exam-flow.ts` | **Evet** | En son, isteğe bağlı |

**Plan 2b'nin yönetici kısmı (9 görev, sınır 10):**

| Görev | Dilim | İçerik |
|---|---|---|
| 14 | M1 a | Menü ikonları, `PanelHeader`, `RowMenu`, hata sayfası "sen" (yazıldığı gibi) |
| 15 | M1 b + M-W | `EmptyState`, durum sözlüğü (yazıldığı gibi) + **`GuidedFlow` kabuğu ve modeli** |
| 16 | M2 a | Bugün'ün şeritleri ve işe alım satırları (C6, C21 uygulanmış) |
| 17 | M2 b | Bugün ekranı + kontrol görünümü bağlantısı, taslak satırı "Kuruluma devam et" |
| 18 | M3 | **Kontrol görünümü** (kart ızgarası yerine `ControlRow`) |
| 19 | M4 | Alım aç `GuidedFlow` üstünde |
| 20 | M5 | Alımın kontrol görünümü + kurulum yolu + yayın özeti + kurallar kartı |
| 21 | M7 | **Ekip ve kurallar özeti ve dört akış + kapat (yeni görev)** |
| 22 | M8 | Davet akışı (eski Görev 21) |
| 23 | - | Plan 2b'yi kapat (eski Görev 22) |

**Her dilimde ortak kontrol:** tek dolu buton; kapalı buton nedeni yanında; em-dash yok; TR/EN anahtar
eşitliği; `hiring-candidate-copy.test.ts`'in yasak kelimeleri ("uyarı", "hile", "başarısız",
"lütfen", "siz") aday ekranlarında, `panel-copy.test.ts`'in "sen" kuralı ortak panel ekranlarında
(K9); odak her adım değişiminde başlığa; 1280, 1440 ve 1024 ekran görüntüsü (Claude in Chrome,
kullanıcı kuralı); sunucu eylemlerinin imzası ve ret kodları değişmez (her akış görevinde
`git diff` ile eylem dosyasının değişmediği gösterilir); `scripts/verify-hiring-flow.ts` API
üzerinden çalışıyor görünüyor (tamamını okumadım; VG ve V3'te çalıştırılarak doğrulanmalı).

### 6.1 Ne zaman (K5, K12)

**Plan 2'nin Görev 19-21'i bitince, plan 3 başlamadan önce, "plan 2b" olarak: VG, V1-V7 (aday,
Görev 1-13), sonra yönetici Görev 14-22 (M1, M-W, M2, M3, M4, M5, M7, M8) ve kapanış Görev 23.**
Aday görevleri (7-13) K12'den bağımsız ilerleyebilir; yönetici görevleri ancak plan bu sürüme göre
yeniden yazılınca başlar (defter: "design doc v4 to revise section 4 and slices M1-M10 before the
manager tasks (14-21) run"). M6, M9, M10 plan 3 ile paralel ya da hemen sonra (plan 3'ün ekranlarıyla
çakışmaz; M-W'yi hazır bulurlar). P3-a..d plan 3'ün içinde, 4.8 girdi olarak. E1 en son ve isteğe bağlı.

**Sıra gerekçesi:** M1 ve M-W yapı taşı (her sonraki ekran onları kullanır); Bugün (M2) en sık açılan
ekran ama canlı sınava dokunduğu için kabuktan hemen sonra, sınav penceresi dışında; kontrol
görünümü (M3) K12'nin "her şeye hakim" yarısı; Alım aç (M4), Genel bakış ve kurulum yolu (M5) ve
ekip akışı (M7) bir alımı açıp yayına götüren yolun tamamı; davet (M8) yolun sonundaki iş. M7'nin
2b'ye girmesi (H5) kurulum yolunun "Ekibi ata" adımını eski on alanlı forma göndermemek için.

**M1 neden panelde ilk:** `PanelHeader`, `EmptyState`, `RowMenu` ve durum sözlüğü plan 3'ün
ekranlarının da yapı taşları. M1 ve M2 canlı sınav ekranlarına dokunduğu için sınav penceresi dışında
ve ekran görüntüsü karşılaştırmasıyla çıkar.

**VG neden ilk:** K2 bir güvenlik kararı ve diğer dilimlerden bağımsız; ayrıca diğer dilimlerin
tasarımını sadeleştiriyor (telefon düzeni artık test edilmek zorunda değil, yalnızca 1024-1440).
Plan 4 (gözetim: tam ekran, sekme odağı) bu kapının üstüne kurulur.

---

## 7. Açık sorular (önerilen cevaplarıyla)

Sürüm 1'in beş sorusu K1-K5 ile, sürüm 3'ün 1-4. soruları K9-K11 ile cevaplandı ve kaldırıldı
(numaralar sürüm 4'te yeniden verildi). Kalanlar ve K12'nin açtıkları:

5. **Kontrol görünümü Alımlar sayfasının yerini mi almalı, ayrı bir "Kontrol" sayfası mı olmalı?**
   *Öneri (H1, uygulandı):* Alımlar sayfası kontrol görünümü olur; menüde yeni öğe yok. Ayrı bir
   sayfa "Alımlar" ile aynı listeyi ikinci kez gösterirdi (dashboard testinin "aynı bilgi iki kez").
6. **Akış sırasında yan menü görünsün mü?** *Öneri (W2, uygulandı):* görünsün; panelin içinde
   kalmak "nerede olduğumu" kaybettirmez ve ayrı bir rota grubu gerektirmez. Kullanıcı Airbnb'nin
   ev sahibi akışı gibi tam ekran isterse yalnızca `GuidedFlow`'un kabuğu değişir.
7. **Ekip ve kurallar dört kısa akış mı, tek uzun akış mı?** *Öneri (4.10, uygulandı):* dört kısa akış;
   on adımlık tek akış bir alanı değiştirmek için on ekran demek. Kullanıcı yeni alım kurarken
   hepsini sırayla görmek isterse kurulum yolu yalnızca Ekip akışını içerir, diğerleri varsayılanla
   gelir (kimlik açık, 7 gün, anket açık: `src/db/schema/hiring.ts:120-127`'deki varsayılanlar;
   son gün ve iletişim e-postasının boş başladığını okumadım, doğrulanmadı).
8. **Sınavın formları (öğrenci ekle, sınav oluştur) da akışa dönsün mü?** *Öneri:* şimdilik hayır
   (canlı ürün, K6'nın ruhu); K12'nin sınava uzanıp uzanmadığını kullanıcı söyler.

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
- [ ] Panel (K12): birden fazla alanı olan her yönetici işi bir rehberli akış; ekranda aynı anda tek
      karar; tek alanlı iş tek adım; kurucu ve puan kartı matrisi editör.
- [ ] Panel (K12): akış geri tuşuyla (footer ve tarayıcı) geri gider ve hiçbir değeri silmez; adım
      adres çubuğunda, yeniden yüklemede aynı adım açılır.
- [ ] Panel (K12): kayıtlı bir şeyi değiştiren akış özet adımıyla biter; özette değişen satırlar
      işaretli, tek dolu buton "Kaydet" ve değişiklik yokken nedeniyle bekliyor.
- [ ] Panel (K12): akıştan çıkış onay sormuyor; kaydedilmemiş değer varken bağlantı "Kaydetmeden çık".
- [ ] Panel (K12): sunucunun reddi ilgili adımı açıyor ve mevcut cümleyi gösteriyor; sunucu eylemleri
      ve ret kodları değişmedi.
- [ ] Panel (K12): kontrol görünümünde her alım tek satır, satırda tek sıradaki adım; adım düzelten
      akışın doğru adımını açıyor; stat kutusu ızgarası yok.
- [ ] Panel (K12): değerlendirici kontrol görünümünde yalnızca sayı görüyor (talep, aday adı, kurulum
      eylemi yok).
- [ ] Panel: taslak alımın dolu butonu "Kuruluma devam et"; "Yayınla" yalnızca yayın özetinde dolu.
- [ ] Panel: alımı kapatmak onay diyaloğu açmıyor; 8 sn geri alma şeridi çıkıyor.
- [ ] Panel: dilim sınav ekranlarına dokunuyorsa önce/sonra ekran görüntüsü eklendi ve sınav
      penceresi dışında çıktı.
