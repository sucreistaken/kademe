# Kademe İşe Alım: UX spesifikasyonu

Sürüm 1, 2026-10-04. Yazan: Sally (bmad UX) + airbnb-ux prensipleri, Kademe'nin kendi tasarım
diliyle (`docs/design/RULES.md`). Airbnb'nin görsel dili kopyalanmaz; yalnızca prensipler uyarlanır.

Kullanıcı bu belge yazılırken soru için ulaşılabilir değildi. Bu yüzden her kararı ben verdim ve
yanına tek satırlık nedenini yazdım. Karar yanlışsa nedeni de yanlıştır; tartışma oradan başlar.

Kaynaklar köşeli parantezle numaralı ([12]) ve en sonda listeli. Bir kaynağın *söylediği* ile benim
*çıkarımım* ayrı yazıldı: çıkarımlar "(çıkarım)" ile işaretli. "Doğrulanmadı" işaretli kaynaklar
yalnızca arama özetinde görüldü, sayfanın kendisi açılamadı.

Bölüm sırası: 0 kararlar, 1 insanlar, 2 benchmark ve "geçmeli" listesi, 3 değerlendirme tasarımı,
4 bilgi mimarisi, 5 yönetici ekranları, 6 aday ekranları, 7 gözetim, 8 görsel yön, 9 kapsam dışı,
10 açık sorular, 11 ekran kabul listesi, kaynaklar.

Bu belge sınav tarafını (`EXAM-UX.md`) değiştirmez. Ortak çekirdek (org, kullanıcılar, kişiler,
davet, `/a/[token]`, denemeler, gözetim, medya, transkript, AI) iki çözümde aynıdır; bu belge
işe alımın o çekirdeği nasıl kullandığını ve ortak varlıkları (pozisyon, yetkinlik, skala) nereye
koyduğunu sabitler. Kod bu belgeyle çelişirse belge güncellenir, sessizce sapılmaz.

## 0. Kararlar bir bakışta

| # | Karar | Tek satır neden |
|---|---|---|
| 1 | Puan **soru düzeyinde**, yetkinlik başına 1-5 davranışsal çapalı skala + "Kanıt yok" | Çapa sorunun iyi cevap örneğine bağlanır; aşama düzeyi puan hale etkisi üretir [28] [29] |
| 2 | Değerlendiriciler birbirinin puanını, kendi değerlendirmesini **gönderene kadar görmez**; değiştirilemez kural | Greenhouse verisi: bakınca puanlar benzeşiyor, tek olumsuz puan geçme oranını düşürüyor [1] |
| 3 | Genel puan **mekanik** hesaplanır (değerlendirici ortalaması, opsiyonel ağırlık); karar insanın, gerekçe zorunlu | Mekanik birleştirme bütüncül yargıdan daha iyi tahmin ediyor [33] |
| 4 | Görüş ayrılığı (aynı yetkinlikte ≥ 2 puan fark) her yerde görünür; ayrı "Ayrışmalar" görünümü | Ayrışma bilgidir; ortalama içinde kaybolursa kalibrasyon olmaz [28] |
| 5 | AI tasarlar, yazıya döker, insan notlarını özetler. **Adayı puanlamaz, sıralamaz, elemez, karar önermez** | AB'de işe alım AI'ı yüksek riskli [47]; insanların %71'i AI'nın son kararına karşı [44] |
| 6 | Bütünlük (gözetim) bilgisi değerlendirici **kendi puanını gönderene kadar gizli**; açarsa kayda geçer | Bütünlük ve cevap kalitesi ayrı sorular; önce gelen "şüphe" puanı sertleştirir (çıkarım) |
| 7 | İşe alımda gözetim varsayılanı **Temel** (sekme + yapıştırma kaydı); otomatik sonlandırma hiçbir seviyede yok | Hafif varsayılan aday kaybını önler; makine kararıyla bitirme istihdam kararıdır |
| 8 | **Pozisyon, yetkinlik, skala org seviyesinde** (Kütüphane); işe alım bunları *alım* üzerinden tüketir ve yayında kopyalar | Gelecek çözümler (pozisyon analizi, performans) aynı varlıkları okuyacak |
| 9 | Tek panel, **gruplanmış yan menü** (mod değiştirici yok), ortak "Bugün" | Aynı kişi iki çözümü aynı gün kullanıyor; mod işin yarısını gizler |
| 10 | Adaya: esnek düşünme süresi, varsayılan 1 tekrar çekim, gönderilmeyen ısınma sorusu, kendi seçtiği ek süre | Hazırlık ve tekrar çekim performansı artırıyor, sahteciliği artırmıyor [42]; uyarlama adalettir [18] |
| 11 | Kimlik gizleme **opsiyonel, varsayılan kapalı**, "adalet garantisi" diye sunulmaz | Anonimleştirme kanıtı karışık; Fransa ve Avustralya denemelerinde kadın/azınlık adayların listeye girmesini azalttı [36] [37] |
| 12 | shadcn/ui; marka `--primary`; shadcn'in `accent`'i `subtle` olarak yeniden adlandırılır; köşe 8/12/16 | Sınav ekranları bozulmadan "yumuşak" görünüm |

## 1. İki taraf, dört insan

İşe alımda "yönetici" tek kişi değil. Eski üründe hepsi aynı ekrana sıkışmıştı; burada ayrılıyor.

**Deniz, işe alım uzmanı (Recruiter, alım sahibi).** Aynı anda 3-4 alım yürütür. Sabah Bugün'ü açar:
"Kime link gitmedi, kimin linki doluyor, hangi aday karar bekliyor?" Değerlendirmeyi bir kere kurar
ve bir daha dokunmak istemez. Korkusu: iyi adayın süreçte kaybolması, değerlendiricilerin geç kalması.
*Birincil işi:* adayları akışta tutmak (davet et, takıldığı yerde aç, karara getir).

**Murat, ekip lideri (Karar veren).** Pozisyonun sahibi. Haftada iki kez 20 dakikası var. "Kimi ileri
alalım ve bunu bir yıl sonra savunabilir miyim?" diye sorar. Rakamlara bakar ama rakama körü körüne
güvenmez; ayrışma varsa nedenini görmek ister. *Birincil işi:* yeterli kanıtla, gerekçesini yazarak
karar vermek.

**Ece, ekipten değerlendirici (Reviewer).** Toplantıların arasında 15 dakikada 2 aday izler. İK
uzmanı değil; "4 puan ne demek?" sorusunun cevabını ekranın kendisinde görmeli. Başkasının puanını
görse etkilenir, bunu kendisi de bilmez. *Birincil işi:* her cevabı, çapaya bakarak, kanıtını yazarak,
bağımsız puanlamak.

**Elif, aday.** Bu ay altı yere başvurdu. Linki akşam telefonundan açabilir. Kameraya tek başına
konuşmak ona tuhaf gelir; "makine mi eleyecek beni?" diye düşünür. Süre ve kayıt onu gerer. Kötü bir
deneyim yaşarsa şirket hakkında konuşur [39]. *Birincil işi:* kendini en iyi haliyle, bir kerede,
sürprizsiz anlatmak; sonra ne olacağını bilmek.

Ana fikir: **iki taraf da aynı şeyi ister: kuralların baştan bilinmesi.** Aday ne kaydedildiğini,
kimin bakacağını, ne zaman cevap alacağını bilmeli; değerlendirici neye kaç puan vereceğini ekranda
okumalı. Ürün bu iki "baştan bilme" yüzeyini taşır.

### 1.1 Uyarlanan prensipler (airbnb-ux)

| Prensip | Kaynak | İşe alımdaki karşılığı |
|---|---|---|
| Birincil eylem en görünür yerde, ekranda tek dolu buton | playbook 1.1, 1.2; `visual-design-system.md` #10 | Bugün'de "Sırayla incelemeye başla"; inceleme ekranında "Sonraki soru" → "Değerlendirmemi gönder" |
| İçerik önde, krom geride | playbook 1.2 | İnceleme ekranında video ve transkript en büyük alan; aday ekranında soru metni en büyük öğe |
| Önce kısa ve yaklaşık, sonra tam ve kesin | playbook 1.3 | Aday detayında önce yetkinlik özeti, sonra cevaplar, sonra kayıt; iç alanlar katlı |
| Önce önle, sonra kurtar | playbook 1.6 | Çapası eksik değerlendirme yayınlanamaz; yayında olmayan alıma davet nedenli kapalı; cihaz kontrolü sorudan önce |
| Otomasyon + insan kapısı; gürültülü öneri yerine sus | playbook 1.7 | AI yalnızca öneri kartı; 5'ten az anket yanıtı varsa aday deneyimi bloğu görünmez |
| Çıkmaz sokak yok | playbook 1.9 | Her boş durum bir eylem; süresi dolan link "Yeni link iste"; bitiş ekranı tarih + insan |
| Güven sinyali dozu riske orantılı | playbook 3 | Bütünlük dot + metin, kırmızı yok; işaret "kanıt değil" |
| Mod geçişi örtüşmeyen roller için | `navigation-ia.md` #6 | **Uygulanmadı:** aynı kişi iki çözümü kullanıyor, gruplanmış menü seçildi (4.1) |

Taşınmayanlar: yıldız puan ve rozet yığını (puan enflasyonu, playbook 3), keşif carousel'leri ve
kişiselleştirme (değerlendirme ürünü keşif ürünü değil), çok adımlı checkout onayı (karar tek adım +
undo), pazar yeri mekanikleri. Airbnb'nin görsel dili (renk, pill arama, kalp) hiçbir yerde yok.

## 2. Benchmark

Kaynaklar 2026-10 itibarıyla okundu. Sütunlar: ne iyi yapıyor (kaynak söylüyor), ne alıyoruz,
bilerek neyi almıyoruz (çıkarım ve karar).

| Ürün | İyi yaptığı | Alıyoruz | Bilerek almıyoruz |
|---|---|---|---|
| **Greenhouse** | Puan kartı görünürlüğü "kendi puanını gönderene kadar gizli" varsayılan; kendi verisi: bakmak aynı puanları %3,6 artırıyor, tek olumsuz puanda geçme oranı %14'ten %6'nın altına düşüyor [1] [2]. Ödevlerde isimsiz puanlama [25] | Gizli-gönderene-kadar kuralı, **kapatılamaz** olarak. Ödev/yazılı için opsiyonel kimlik gizleme | Genel "Strong Yes / No" öneri skalası [55]: yetkinlik puanlarını atlayıp bütüncül yargıyı davet ediyor [33] |
| **Ashby** | Geri bildirim körlüğü diğer aşamaları da kapsıyor [3] [4]; nötr orta noktası olmayan 1-4 skala [5]; puan zorunlu, "3 ve üstü oranı" özeti [5] | Körlüğün aday detayı, karşılaştırma ve listeye kadar uzanması | 1-4 zorunlu seçim: çapalı 5 seviyede "Beklenen" (3) gerçek bir davranış tanımı, kaçış noktası değil (çıkarım) |
| **Spark Hire** | Cevap başına puan, başkalarının puanı sen gönderene kadar gizli (doğrulanmadı) [6]; pratik video, aşamalar arası duraklama, sınırlı ya da sınırsız düşünme süresi (doğrulanmadı) [7] | Cevap başına puanlama, ısınma sorusu, mola | 5 yıldız [6]: yıldız memnuniyet okunur, çapa taşımaz |
| **Willo** | Düşünme süresi "korkuluk": aşınca aday engellenmez [8]; kalan tekrar hakkı her an görünür [9]; WCAG ve 18+ dil iddiası [10] | Esnek düşünme süresi, görünür tekrar hakkı | AI ile sıralanmış kısa liste [10] |
| **Hireflix** | Uygulama yok, kayıt yok, her cihaz; soru başına düşünme/cevap/tekrar [11] | Soru başına süre ve hak ayarı (eski modelde zaten var) | - |
| **HireVue** | Sınırsız, kimsenin görmediği pratik; cihaz kontrolü; iOS uygulaması [12]. 2025 açıklanabilirlik belgesi: yalnızca söylenen söz, yüz/ses analizi yok, BARS, 4/5 kontrolü, adaya geri bildirim raporu [13] | Pratik, cihaz kontrolü, açık "AI ne yapar ne yapmaz" metni | AI puanlama (kendi açıklamasıyla bile); 2021'de yüz analizini bırakması [14] ve 2025 ACLU şikâyeti (işitme engelli adaya altyazı verilmedi, AI "iletişim" eleştirdi) [15] bu alanın riskini gösteriyor |
| **TestGorilla** | Gözetim sinyalleri üç kademe, her kademeye önerilen eylem, "kanıt değildir" dili (doğrulanmadı) [17]; işaretleri "başlangıç noktası" sayma tavsiyesi [16]; adayın kendi seçtiği ek süre (+%20 dil, +%50 durum), nedeni işverene gitmez (doğrulanmadı) [18] | Kademeli, suçlamasız bütünlük dili; **adayın kendisinin seçtiği ek süre** | Fare izleme, IP ile sıkı eşleme |
| **Canditech** | Ne izlendiği başta söyleniyor; olaylar zaman ekseninde; değerlendirici her olay için "gerçekten uygunsuz mu" kararı veriyor [21] [22] | Zaman ekseni + olay başına insan kararı (sınav tarafında zaten var) | Adaya canlı "ekip bilgilendirilecek" uyarısı [21] (7.2'de neden) |
| **Codility** | "Bu işaret hile kanıtı değildir, ev ağından mobil ağa geçmiş olabilir" dürüstlüğü; adayla doğrudan konuşma tavsiyesi [23]; WCAG 2.2 AA, oturum başına süre ayarı (doğrulanmadı) [24] | Yanlış pozitif dürüstlüğü; "Adaya sor" eylemi | Kod benzerlik taraması (kapsam dışı) |
| **Vervoe** | Elenen adaya bile kişisel geri bildirim; aşama aşama düşme hunisi [19]; satıcı vaka çalışması: %97 tamamlama, 4,6/5 memnuniyet [20] | Huni, adaya durum + kısa not | AI ile puanlayıp sıralama [19] |
| **Metaview** | AI olgusal kısımları doldurur ama "adayı değerlendirmez, görüşmecinin yargısını etkilemek istemiyoruz" diye öznel alanları boş bırakır [26] | AI kanıt toplar, insan puanlar ilkesi | - |

**Kanıt tabanından alınanlar (kısaca, 3. bölümde ayrıntı):** yapılandırılmış mülakat en güçlü
yordayıcılardan (Sackett 2022: .42) [27]; OPM: en az üç, tercihen 5-7 seviye, her seviyeye davranış
örneği, önce bağımsız puan sonra tartışma [28]; Google re:Work: her soru için zayıf/sınırda/iyi/çok
iyi cevabın neyi kapsadığını yaz [29]; panelde değerlendiriciler arası güvenirlik .74, ayrı ayrı .44
[31]; "çerçeve referans" değerlendirici eğitimi doğruluğu belirgin artırıyor [32]; günün diğer
adayları puanı çekiyor [49]; birlikte (yan yana) değerlendirme cinsiyet açığını kapattı [50].

### 2.1 "Kademe bunu geçmeli" kontrol listesi

Her madde test edilebilir. Kullanıcı ürünü bu listeyle yargılar. Yanında hangi rakibin seviyesini
geçmeyi hedeflediği yazılı.

**Aday tarafı**
- [ ] A1. Link açılışından ilk sorunun görünmesine kadar, ısınma atlanırsa ≤ 3 dakika; cihaz kontrolü
  ≤ 60 sn (tarayıcıda kronometreyle). *(Hireflix "kayıtsız, uygulamasız" seviyesi)*
- [ ] A2. iPhone Safari ve Android Chrome'da 3 dakikalık video cevap çökmeden kaydediliyor; kayıt
  sırasında 10 sn ağ kesilince parçalar sonradan yükleniyor, video sunucuda tam. *(HireVue mobil uygulama ister, biz istemeyiz)*
- [ ] A3. Karşılama ekranı, başla düğmesinden önce şunların hepsini söylüyor: süre, aşama sayısı, son
  tarih, kaç insanın değerlendireceği, AI'nın ne yaptığı ve ne yapmadığı, gözetim seviyesine göre
  kaydedilen her sinyal, saklama süresi, veri hakları bağlantısı. Kayıtta olup bu listede olmayan sinyal sayısı: 0.
- [ ] A4. Isınma sorusu var, sunucuya hiçbir parça gitmiyor (ağ kaydında doğrulanır).
- [ ] A5. Kalan tekrar hakkı her video sorusunda görünür; düşünme süresi bitince kayıt kendiliğinden
  başlamıyor (esnek mod). *(Willo seviyesi)*
- [ ] A6. Aday ek süreyi gerekçe yazmadan seçebiliyor; değerlendirici ekranlarında bu bilgi ve neden
  yok. *(TestGorilla seviyesi)*
- [ ] A7. Video yerine yazılı cevap yolu açık olan alımda aday bunu tek tıkla seçebiliyor ve
  değerlendiriciye "cezasız alternatif" olarak gidiyor. *(HireVue/ACLU vakasının tersi)*
- [ ] A8. Sayfa yenilenince süre sıfırlanmıyor, uzamıyor; aday "kaldığın yerden" ekranını görüyor.
- [ ] A9. Bitiş ekranı tarihli bir geri dönüş sözü ve bir insan e-postası gösteriyor; aday aynı linkten
  sonra durumunu görebiliyor.
- [ ] A10. Aday ekranlarında "ihlal", "hile", "şüpheli", "başarısız" kelimeleri geçmiyor (TR/EN metin
  dosyalarında arama ile).
- [ ] A11. Aday sayfaları axe ile 0 ciddi ihlal; tüm etkileşim klavyeyle; dokunma hedefleri ≥ 44px.
- [ ] A12. Pilot hedefi: bitiş anketi ortalaması ≥ 4,5/5; başlayanların ≥ %90'ı tamamlıyor; medyan
  süre gösterilen tahminin ±%20'si içinde. *(Vervoe vaka çalışması 4,6 ve %97 bildiriyor [20], satıcı verisi)*

**Değerlendirme tarafı**
- [ ] R1. Bir değerlendirici kendi değerlendirmesini göndermeden önce, başka değerlendiricilerin
  puanı, notu, genel puan ve bütünlük özeti **sunucudan hiç gelmiyor** (ağ yanıtlarında arama ile;
  liste, aday detayı, karşılaştırma ve inceleme ekranında). *(Greenhouse/Ashby seviyesi, ama
  kapatılamaz)*
- [ ] R2. Yayınlanan her değerlendirmede her yetkinliğin 1, 3 ve 5 seviyesi yazılı; eksikse "Yayınla"
  nedenli kapalı.
- [ ] R3. Puanlama ekranında seçili seviyenin çapa metni tam olarak, tooltip olmadan görünüyor.
- [ ] R4. 4 videolu bir aday sayfa değiştirmeden, yalnızca klavyeyle puanlanıp gönderilebiliyor.
- [ ] R5. Transkriptte bir kelimeye tıklamak videoyu o ana götürüyor; transkriptte arama var.
- [ ] R6. Aynı yetkinlikte ≥ 2 puan farkı aday detayında, karşılaştırmada ve Bugün'de "görüş ayrılığı"
  olarak çıkıyor.
- [ ] R7. Karşılaştırmada her hücre değerlendirici sayısını ve dağılımı gösteriyor; değerlendirmesi
  eksik adaylar sıralamaya girmiyor.
- [ ] R8. "Soru soru" görünümü var ve sıra değerlendirici başına rastgele.
- [ ] R9. Karar gerekçesiz kaydedilemiyor; her karar ve karar değişikliği kim/ne zaman/neden ile denetim
  kaydında.
- [ ] R10. Ağırlık değişikliği gönderilmiş hiçbir puanı kendiliğinden değiştirmiyor (eski
  `selectWeights` testleri korunur).
- [ ] R11. Kısmi tekrar: yalnızca seçili aşama yeniden açılıyor, eski deneme okunur kalıyor, yeni deneme
  kendiliğinden birincil olmuyor.
- [ ] R12. Ürün kodunda ve metninde AI'nın adayı puanladığı, sıraladığı, "işe al" dediği ya da
  videodan duygu/kişilik çıkardığı tek bir yer yok (kod ve metin araması + `ai_runs.purpose` enum'u).
- [ ] R13. Gözetim işaretleri hiçbir koşulda adayı elemiyor, değerlendirmeyi sonlandırmıyor, puanı
  değiştirmiyor.
- [ ] R14. Davet: Bugün'den link panoya ≤ 30 sn, ≤ 4 tıklama (eski altın yol).
- [ ] R15. Pilot hedefi: 4 video sorulu adayın medyan değerlendirme süresi ≤ 8 dk (1,5x hızla).

**Her ekran**
- [ ] E1. Tek dolu buton; kapalı buton nedenini yanında söylüyor.
- [ ] E2. Boş, yükleniyor, hata durumları tasarlı; boş durum bir sonraki eylemi gösteriyor.
- [ ] E3. TR ve EN anahtarları eşit (`messages.test.ts` benzeri test).
- [ ] E4. Accent yalnızca dolu buton, aktif durum ve sayaçta.
- [ ] E5. Hiçbir metinde em-dash yok.

## 3. Değerlendirme tasarımı

### 3.1 İlkeler (kanıt → karar)

| Kanıt (kaynak söylüyor) | Kademe kararı |
|---|---|
| Yapılandırılmış mülakat güncel meta-analizde en güçlü yordayıcılardan: .42; yapılandırılmamış çok daha düşük [27] | Her aday aynı soruları, aynı sürelerle, aynı çapalarla alır. Soru adaya özel değiştirilemez (sürüm kilidi) |
| OPM: en az üç, tercihen 5-7 seviye; tüm yetkinliklerde aynı aralık; her seviyeye örnek davranış [28] | 5 seviyeli tek org skalası; yetkinlik başına 1/3/5 davranış tanımı zorunlu, 2/4 önerilir (OPM her seviyeyi istiyor; 2 ve 4'ü zorunlu kılmamak benim sürtünme kararım, AI beşini birden taslak çıkarır) |
| re:Work: her soru için zayıf, sınırda, iyi, çok iyi cevabın neyi kapsadığını önceden yaz [29] | Kurucuda her aktivitenin "iyi cevap örnekleri" (1/3/5) alanı; puanlama rayında yetkinlik çapasının yanında görünür |
| OPM: panelistler önce tartışmadan bağımsız puanlar, sonra ayrışmaların nedenini konuşur [28]. Greenhouse: başkasının puanını görmek puanları benzeştirir, tek olumsuz puan geçişi düşürür [1] | Gönderene kadar körlük, kapatılamaz. Gönderimden sonra ayrışmalar görünür ve konuşulur |
| Kuncel 2013: bütüncül birleştirme, uzmanlar yapsa bile geçerlilik kaybettiriyor; mekanik birleştirme tahmini belirgin iyileştiriyor [33] | Genel puan formülle; karar veren puandan farklı karar verebilir ama gerekçe yazar (çıkarım: mekanik önce, insan sonra, sapma kayıtlı) |
| Panel güvenirliği .74, ayrı görüşmeler .44 [31]; çerçeve referans eğitimi doğruluğu artırıyor [32] | Varsayılan 2 değerlendirici; ilk incelemede "bu soruda 1, 3, 5 neye benziyor" kartı (hafif çerçeve referans) |
| Aynı gün görülen diğer adaylar puanı çekiyor [49]; yan yana değerlendirme cinsiyet açığını kapattı [50]; Bohnet soru soru yatay karşılaştırma öneriyor (doğrulanmadı) [51] | "Soru soru" görünümü, rastgele sıra. İşe alıma özgü doğrudan bir RCT bulunamadı; bu yüzden varsayılan değil, seçenek |
| Anonimleştirme: Fransa'da ve Avustralya BETA denemesinde azınlık/kadın lehine etkiyi azalttı [36] [37]; orkestra çalışması gürültülü [38] | Kimlik gizleme opsiyonel, varsayılan kapalı, "adalet garantisi" dili yok |
| ICO: isimden demografi tahmin etmek yanlılık izlemek için yeterince doğru değil [35]; 4/5 kuralı küçük örneklemde yanıltıcı olabilir [34] | v1'de demografi toplanmaz ve tahmin edilmez; 4/5 analizi kapsam dışı (9. bölüm) |

### 3.2 Nesneler ve akış

```
KÜTÜPHANE (org)            ALIM (işe alım)                         DEĞERLENDİRME (kişi başına)
Pozisyon ─ yetkinlik ──▶ Değerlendirme sürümü (yayında kilitli) ──▶ Değerlendirici A: soru × yetkinlik puanları
  profili (ağırlık)        aşama → aktivite                           + gözlem etiketleri + not
Yetkinlik ─ 1-5 çapa ──▶   aktivite ölçer: 1-2 yetkinlik           Değerlendirici B: ...
Skala                      iyi cevap örnekleri (1/3/5)                     │
                           puan kartı (ağırlık snapshot)                   ▼
                                                                    Birleşik görünüm (gönderenlere)
                                                                    yetkinlik puanı, dağılım, ayrışma
                                                                           │
                                                                           ▼
                                                                    Karar (karar veren, gerekçeli)
```

### 3.3 Skala ve çapalar

Org skalası 5 seviye, genel adlar (yetkinlik çapası bunların altını doldurur):

| Seviye | TR | EN |
|---|---|---|
| 1 | Belirgin eksik | Clear gap |
| 2 | Kısmen | Partly there |
| 3 | Beklenen düzeyde | Meets the bar |
| 4 | Güçlü | Strong |
| 5 | Örnek düzeyde | Exceptional |
| - | Kanıt yok | No evidence |

- **Kanıt yok ≠ 1.** Aday o yetkinliği gösterecek bir şey söylemediyse ya da soruyu boş bıraktıysa
  "Kanıt yok" seçilir; ortalamaya girmez (eski `null` = puanlanmadı kuralının görünür hali).
  Bir yetkinlik tüm sorularda "Kanıt yok" ise birleşik görünümde "değerlendirilemedi" yazar.
- **Çapa = gözlenebilir davranış.** Kütüphanedeki kural tabanlı kontrol sıfat ağırlıklı tanımı işaretler
  (5.10).
- **Soru düzeyi örnek cevap** yetkinlik çapasını o soruya indirir: "Seviye 3: düşüşü en az iki olası
  nedene ayırır ve hangisini önce ölçeceğini söyler."

### 3.4 Puanlama mekaniği

- Değerlendirici her aktivitede o aktivitenin ölçtüğü 1-2 yetkinliğe puan verir. Tipik bir alım: 4-6
  soru × 1-2 yetkinlik = 6-10 puan. Eski üründe aşama başına 2-3 yetkinlikti; sayı benzer kalır.
- Gözlem etiketleri (+/-) kanıtın hızlı yoludur; not alanı serbesttir.
- **Uç puan kanıt ister:** 1 ya da 5 için en az bir etiket ya da kısa not. Gönderim o satır için kapalı
  kalır, neden yanında. *Neden:* sonucu en çok uçlar oynatır; sürtünmeyi tam oraya koymak ucuz
  (çıkarım). OPM her puan için kanıt notu istiyor [28]; her puanda zorunlu kılmak 15 dakikalık
  değerlendiriciyi kaybettirir (çıkarım), bu yüzden yalnızca uçlarda.
- **Otomatik kayıt + açık gönderim.** Taslak otomatik; "Değerlendirmemi gönder" bilinçli bir eylem.
  Gönderim sonrası değişiklik gerekçe ister ve geçmişte "gönderimden sonra değişti" olarak görünür.
- **İlk inceleme kartı:** bir değerlendirici bir alımda ilk adayını açtığında, ilk sorudan önce o sorunun
  1/3/5 örneklerini tek kartta görür ("Bu soruda neye bakıyoruz"). Bir kez, kapatılabilir.

### 3.5 Bağımsızlık kuralı (sunucu tarafında)

Kural: **bir kullanıcı, bir adayın değerlendiricisiyse ve o aday için değerlendirmesini göndermediyse,
o adayın başka hiçbir değerlendirmesini, birleşik puanını, genel puanını, ayrışma bilgisini ve
bütünlük özetini alamaz.** Sunucu bu alanları yanıtlara koymaz; istemci tarafında gizlemek yetmez.

| Kim | Gönderimden önce görür | Gönderimden sonra görür |
|---|---|---|
| Değerlendirici | Cevaplar, transkript, kendi taslağı, iç alanlar (amaç, örnek cevaplar, kırmızı bayrak) | Diğer değerlendirmeler, birleşik puan, ayrışmalar, bütünlük |
| Karar veren (değerlendirici değilse) | Her şey, ama kararın gerekçe zorunluluğu değişmez | - |
| Karar veren (aynı zamanda değerlendiriciyse) | Değerlendirici gibi; kendi değerlendirmesini göndermeden karar alanı nedenli kapalı ("Önce kendi değerlendirmeni gönder.") | Her şey |
| Owner (atanmamış) | Her şey; ama puanlamaya başlarsa değerlendirici olur ve kural ona da uygulanır | - |

### 3.6 Birleştirme

1. Değerlendirici içi: yetkinlik puanı = o değerlendiricinin bu yetkinliğe verdiği soru puanlarının
   ortalaması ("Kanıt yok" hariç).
2. Değerlendiriciler arası: birleşik yetkinlik puanı = değerlendirici yetkinlik puanlarının ortalaması.
   Yanında n ve aralık ("3 kişi · 2-4").
3. Genel puan = birleşik yetkinlik puanlarının ortalaması; ağırlıklar açıksa ağırlıklı ortalama, puansız
   yetkinliğin ağırlığı düşülüp yeniden normalize edilir (eski `weightedScore` aynen).
4. Bilgi testi (otomatik puanlanan seçmeli sorular) **ayrı satır**, genel puana karışmaz (eski karar).
5. Gösterim: tek ondalık, virgül ("3,5"); asla yüzdelik dilim, sıra numarası ya da "ilk %10" rozeti yok.

*Neden yetkinlik bazında ortalama, soru bazında değil:* bir yetkinlik üç soruda ölçülüyorsa tek
soruda ölçülene oy üstünlüğü kurmaz (eski `summariseCompetencies` kuralı korunur).

### 3.7 Ayrışma ve kalibrasyon

- **Ayrışma tanımı:** aynı aday, aynı yetkinlikte değerlendirici puanları arasında fark ≥ 2 (5'lik
  skalada) ya da bir değerlendirici "Kanıt yok", diğeri ≥ 4 verdiyse.
- Görünür olduğu yerler: aday detayı Özet (satırda "görüş ayrılığı" metni + nokta şeridi), karşılaştırma
  hücresi, "Ayrışmalar" görünümü, Bugün'de karar verenin satırı ("Görüş ayrılığı: İletişim").
- **Kalibrasyon eylemi:** ayrışan satır açılınca iki değerlendiricinin puanı, etiketleri ve notu yan yana.
  Değerlendirici puanını değiştirebilir; gerekçe olarak "Kalibrasyon sonrası" hazır seçenek gelir ve
  geçmişte görünür. Eski puan silinmez.
- **Değerlendirici eğilimi:** ≥ 5 ortak aday sonrası, yalnızca karar veren ve Owner'a: bir değerlendiricinin
  ortalamasının panel ortalamasından farkı ("+0,6"). Sıralama yok, isim listesi yok; satır içinde nötr.
  *Neden:* kalibrasyon toplantısının en somut girdisi; ama kişileri sıralamak ekip içinde gerilim yaratır
  (çıkarım).

### 3.8 Kimlik gizleme

Alım ayarı, varsayılan kapalı. Açıkken değerlendirme ekranında ad yerine "Aday 14", e-posta/telefon/şehir,
yüklenen dosyaların adı ve meta verisi gizli; puan gönderilince açılır. Videoda yüz ve ses görünür ve
ayar metni bunu açıkça söyler. Ne zaman önerilir: yazılı ve dosya ağırlıklı değerlendirmelerde (Greenhouse
ödevlerde aynısını yapıyor [25]). Neden varsayılan değil: kanıt karışık [36] [37], ve recruiter adayı
adıyla takip etmek zorunda.

### 3.9 AI'nın rolü

| AI yapar | Nerede | Sınır |
|---|---|---|
| İlan metninden değerlendirme taslağı | 5.6 | Öneri kartı; kabul edilmeden hiçbir şey yazılmaz; çoktan seçmeli soru önermez (anahtar insanın) |
| Yetkinlik çapası taslağı (1-5) | 5.10 | Öneri kartı |
| Soru kontrolü | 5.5 şerit | Yönlendirici soru, iki soruyu birleştiren soru, korunan özelliğe dokunan soru ("Evli misin", "Kaç yaşındasın", "Nerelisin") ve belirsiz ifadeyi işaretler; yalnızca öneri |
| Transkripsiyon | inceleme | Sağlayıcı (ElevenLabs Scribe), yanlış olabilir; transkript başarısızsa açıkça söylenir |
| İnsan notlarının özeti | aday detayı Özet | Girdi **yalnızca** gönderilmiş değerlendirmelerin puanları, etiketleri, notları. Video/transkript girmez. Etiket: "Değerlendiricilerin notlarından özet (AI)". Gönderim yoksa gösterilmez |
| Adaya görünen not taslağı | karar rayı | Yalnızca karar veren isterse, insan notlarından; düzenlenmeden gönderilemez (e-posta yok, kopyalanır) |
| Gözetim "ikinci bakış" | bütünlük | Yalnızca kare içi olgu (kaç kişi, cihaz var mı); duygu, kişilik, kimlik yasak (PROCTORING.md) |

**AI yapmaz (kodda kısıt, `ai_runs.purpose` enum'unda karşılığı yok):** adayı puanlamak, puan önermek,
adayları sıralamak, kısa liste çıkarmak, işe al/alma önermek, videodan ya da sesten duygu, kişilik,
özgüven, dürüstlük çıkarmak (AB'de iş yerinde duygu tanıma 2 Şubat 2025'ten beri yasak [45] [46]).
Puanlama rayında hiçbir AI çıktısı yoktur, puan verilmeden önce de sonra da.

*Neden puan önerisi yok (sınav tarafında var):* işe alımda adayı değerlendiren AI, AB AI Act Ek III
madde 4 kapsamında yüksek risklidir [47]; bu yükümlülüklerin tarihi Digital Omnibus ile 2 Aralık
2027'ye ertelendi (K&L Gates özetine göre; Resmî Gazete metnini kendim okumadım) [48]. Ayrıca insanların
%71'i AI'nın nihai işe alım kararına karşı, %66'sı böyle bir işverene başvurmaz diyor [44]; ve AI
önerisi insan puanından önce görünürse onu çıpalar (çıkarım). Metaview de aynı nedenle öznel alanları
boş bırakıyor [26]. Sınav tarafında dil seviyesi CEFR tanımlarına karşı ölçülüyor ve öğretmen onaylıyor;
o karar bu belgede yeniden açılmıyor.

Adaya bildirim: AI'nın ne yaptığı ve ne yapmadığı karşılama ekranında başlamadan önce yazılır (6.1).
Bu, ABD'de Illinois AI Video Interview Act'in istediği "önceden bildir, nasıl çalıştığını anlat, rıza al,
talep halinde sil" sırasıyla da örtüşüyor [54]; Kademe şu an AB/TR odaklı, bu yalnızca ileriye dönük
bir uyum notu (hukuki görüş değil).

### 3.10 Karar

- Seçenekler: **İlerlet** · **Beklet** · **Devam etmiyor** (eski "Kısa liste / Beklemede / Ret"in
  yumuşak ve eyleme dönük hali). "Tekrar iste" bir karar değil, ayrı eylemdir.
- Gerekçe zorunlu: listeden en az biri + opsiyonel not. Liste org ayarıdır; varsayılanlar yetkinliğe bağlı
  ("<yetkinlik>: beklenen düzeyin altında / güçlü") ve süreçle ilgili ("Aday çekildi", "Pozisyon kapandı",
  "Daha uygun adaylar ilerledi", "Bütünlük sorusu").
- Kapı: alımın "en az N gönderilmiş değerlendirme" kuralı (varsayılan 2); karar veren aşabilir ama gerekçe
  metni zorunlu olur ve kayıtta görünür.
- Puandan sapma: genel puan alımın medyanının altında olan adayı "İlerlet" ya da üstünde olanı "Devam
  etmiyor" yapmak engellenmez; karar rayında nötr satır çıkar: "Genel puan bu alımın medyanının üstünde.
  Gerekçen bu farkı açıklasın." *Neden:* mekanik önce, insan sonra [33]; sapma serbest ama görünür.
- Geri alma: 8 sn undo; sonra her değişiklik yeni karar satırı, geçmiş korunur.
- Adaya: karar adayın linkindeki durum satırını değiştirmez, ta ki karar veren "Adaya durumu göster"
  diyene kadar (opsiyonel kısa not ile). Talent Board: belirli geri bildirim alan aday %46 daha fazla
  tavsiye etmeye istekli [39]; re:Work: yapılandırılmış mülakattan elenenler %35 daha memnun [29].

### 3.11 Tekrar

Eski model aynen (PLAN.md bölüm 4, `retake.ts`): yeni deneme, kapsam dışı aşamalar taşınır, hiçbir şey
silinmez, yeni deneme kendiliğinden birincil olmaz, aynı link. Eklenen: neden zorunlu, adaya görünen mesaj,
ve yeni denemenin değerlendirmesi yeni bir değerlendirme kaydıdır (eski puanlar eski denemede kalır).

### 3.12 Eski üründen ne değişti

| Eski (`610da60`) | Yeni | Neden |
|---|---|---|
| Yetkinlik aşamaya bağlı (`stage_competencies`), aşama başına puan | Aktiviteye bağlı (1-2), soru başına puan | Çapa soruya iner; hale etkisi azalır [29] |
| Yıldız (`star-rating.tsx`) | Numaralı segment + görünür çapa + "Kanıt yok" | Yıldız memnuniyet okunur; çapa görünmeli |
| Çoklu değerlendirici var ama liste/karşılaştırma *en dolu tek değerlendirmeyi* seçiyordu (`pickEvaluation`) | Tüm gönderilmiş değerlendirmeler birleşir, n ve dağılım gösterilir | Sessiz seçim diğer değerlendiricileri görünmez kılıyordu |
| Başkasının puanını görme kuralı yoktu | Gönderene kadar körlük, sunucuda | [1] [28] |
| Gönderim yarı örtük (`submittedAt`) | Açık "Değerlendirmemi gönder" | Körlüğün açılma anı net olmalı |
| Karar: Kısa liste / Beklemede / Ret, not opsiyonel | İlerlet / Beklet / Devam etmiyor, gerekçe zorunlu, karar veren alım başına | Savunulabilirlik |
| Ağırlıklar şablon sürümünde | Varsayılan pozisyon profilinden, alımda snapshot; eski pin/yeniden hesapla kuralı aynen | Ortak varlık; geçmiş puan değişmez |
| Karşılaştırma üst seviye, genel puana göre sıralı | Alım sekmesi; n + dağılım; eksikler ayrı grup; "Ayrışmalar" ve "Soru soru" görünümleri | Kısmi puan sıralamaya girmemeli |
| Bilgi skoru ayrı | Aynen | Seçmeli sorular mülakatı şişirmesin |
| Aşama notları (`stage_notes`) | Soru notları + yetkinlik notları; aşama notu kalkar | Not kanıttır, kanıt soruya bağlıdır |
| AI üç kullanım (taslak, transkript, özet) | + çapa taslağı, soru kontrolü, adaya not taslağı; puanlama yine yok | Tasarım yardımı genişler, değerlendirme insanın kalır |
| Teknik olaylar her zaman | Teknik kayıt her zaman; bütünlük sinyalleri gözetim seviyesine bağlı ve puanlamaya kadar gizli | 7. bölüm |
| Pozisyon = rol + işe alım süreci | Pozisyon (Kütüphane) + Alım | Ortak varlık |
| Tekrar | Aynen, + zorunlu neden ve adaya mesaj | - |

## 4. Bilgi mimarisi

### 4.1 Panel kabuğu: tek panel, gruplanmış yan menü

**Karar:** Çözüm değiştirici (mod) yok; sol yan menüde çözüm başına bir grup var. *Neden:* aynı
kişi iki çözümü aynı gün kullanıyor, "Bugün" ikisinin işini birleştiriyor ve Kütüphane ortak.
airbnb-ux `navigation-ia.md` #6'daki misafir/ev sahibi modu, menüleri örtüşmeyen iki ayrı *rol*
için doğru; burada rol aynı, sadece iş türü farklı. Mod koymak işin yarısını gizler ve "yanlış
moddayım" hatası üretir.

**Neden üst çubuk değil:** sınav tarafının bugünkü üst çubuğu 5 öğe taşıyor; iki çözüm + ortak
alanlar 9 öğe eder. Gruplanmış dikey liste 9 öğeyi 4 parçaya böler (Bugün / İşe alım / Sınav /
Kütüphane); üst çubukta bu gruplama okunmaz. Yeni çözüm (pozisyon analizi, performans) eklemek
yeni bir grup eklemek demektir, yerleşim bozulmaz.

```
+----------------------+---------------------------------------------------------+
| Kademe        [⌘K]   |  (sayfa başlığı)                     (tek dolu buton)   |
|                      |                                                         |
|  Bugün          3    |                                                         |
|                      |                                                         |
|  İŞE ALIM            |                                                         |
|  Adaylar             |                                                         |
|  Alımlar             |                                                         |
|                      |                                                         |
|  SINAV               |                                                         |
|  Öğrenciler          |                                                         |
|  Sınavlar            |                                                         |
|  Soru bankası        |                                                         |
|                      |                                                         |
|  KÜTÜPHANE           |                                                         |
|  Pozisyonlar         |                                                         |
|  Yetkinlikler        |                                                         |
|                      |                                                         |
|  ------------------  |                                                         |
|  Ayarlar             |                                                         |
|  TR / EN · Deniz A.  |                                                         |
+----------------------+---------------------------------------------------------+
```

- Yan menü 240px, açık zemin (`--sidebar`), aktif öğe: `--brand-soft` zemin + accent metin +
  solda 2px accent çizgi. Grup başlıkları 11.5px, büyük harf, `muted`.
- Org yalnızca bir çözümü açtıysa diğer grup ve grup başlıkları kaybolur; kimse kullanmadığı
  bir şeyin menüsünü görmez.
- "Bugün" yanındaki sayı yalnızca *bana atanmış* bekleyen iş sayısıdır (rozet değil, düz
  `tnum` metin). Diğer menü öğelerinde sayı yok (airbnb-ux `navigation-ia.md` #11: nokta/sayı
  yalnızca zamana duyarlı işte).
- ⌘K (shadcn `Command`): kişi, alım, sınav, pozisyon arar; "Aday davet et", "Öğrenci davet
  et" gibi eylemleri de listeler. Yeni bir menü öğesi eklemeden hız kazandırır.
- Mobil (< 1024px): yan menü `Sheet` olur, üstte hamburger + sayfa başlığı. Panelin mobil
  kullanımı "okumak ve karar vermek" içindir; kurucu ve inceleme ekranı masaüstü ister (5.14'te
  mobil davranış ayrıca yazılı).
- Kütüphane'nin altında bugün iki öğe var. "Puan skalaları" ayrı menü öğesi değil, Yetkinlikler
  sayfasının sekmesidir (nadiren dokunulur).

### 4.2 Ortak varlıklar: Kütüphane (org seviyesi)

Kullanıcının kapsam notu: pozisyon analizi ve performans değerlendirmesi gibi çözümler ileride
aynı platforma gelecek. Bu yüzden **pozisyon, yetkinlik ve puan skalası işe alımın malı değil,
organizasyonun malıdır.** İşe alım onları *tüketir*.

| Varlık | Ne | Kim yazar | İşe alım nasıl kullanır | İleride kim kullanır (tasarlanmadı) |
|---|---|---|---|---|
| **Pozisyon** (`/library/positions`) | Rolün tanımı: ad, ekip, kısa tanım, ilan metni, **yetkinlik profili** (yetkinlik + önem ağırlığı + opsiyonel beklenen seviye) | Owner, Recruiter | Bir *alım* her zaman bir pozisyona bağlanır; alımın puan kartı varsayılan olarak profilden gelir | Pozisyon analizi profili doldurur; performans çözümü çalışanı aynı profile göre değerlendirir |
| **Yetkinlik** (`/library/competencies`) | Ad, tanım, skala, 1-5 davranışsal çapalar, gözlem etiketleri (+/-) | Owner, Recruiter | Puan kartının satırları | Aynı yetkinlik performans formunda da satır olur |
| **Puan skalası** (`/library/competencies?tab=scales`) | Seviye sayısı ve genel seviye adları | Owner | Yetkinliklerin çapalarının iskeleti | Aynı |

Tüketim kuralları (çözümden bağımsız, şimdiden sabit):

1. **Anlık görüntü (snapshot).** Bir alımın değerlendirmesi yayınlandığında kullandığı
   yetkinliklerin çapaları, etiketleri ve ağırlıkları o sürüme kopyalanır. Kütüphanede sonradan
   yapılan değişiklik yayınlanmış hiçbir sürümü ve hiçbir verilmiş puanı değiştirmez. Kütüphane
   sayfası bunu söyler: "Bu değişiklik yeni sürümlere uygulanır. Yayındaki 2 değerlendirme eski
   tanımı kullanmaya devam eder." / "This change applies to new versions. 2 live assessments
   keep the previous definition."
2. **Kullanım görünür.** Her pozisyon ve yetkinlik sayfasında "Nerede kullanılıyor" bloğu:
   çözüm adıyla gruplanmış liste ("İşe alım · 2 alım"). Çözüm eklenince yeni grup belirir.
3. **Silme yok, arşiv var.** Kullanılan bir varlık arşivlenir; yeni yerde seçilemez, eskiler
   okunur kalır.
4. **Alım içinde yerinde oluşturma.** Recruiter alım açarken pozisyon yoksa aynı akışta oluşturur
   (ad + ilan metni yeterli); Kütüphane'ye gitmek zorunda kalmaz. Oluşan kayıt yine org
   seviyesindedir.
5. **Çözüme özel olan çözümde kalır.** Aşamalar, sorular, süreler, gözetim, değerlendiriciler,
   aday listesi, kararlar: hepsi *alım*a aittir (`/hiring/...`). Bir performans çözümü bunlara
   ihtiyaç duymaz.

**Pozisyon ve alım ayrımı (yeni):** Eski üründe "pozisyon" hem rol tanımı hem de işe alım süreci
idi. Artık iki nesne var: **Pozisyon** (kalıcı rol tanımı, Kütüphane) ve **Alım** (bu pozisyon
için açılmış, başı ve sonu olan bir işe alım süreci: değerlendirme, adaylar, değerlendiriciler,
son tarih). Aynı pozisyon için yılda iki alım açılabilir; ikincisi "Önceki alımın değerlendirmesini
kopyala" ile başlar. EN: Position / Opening. *Neden:* gelecek çözümler role bağlanacak, işe alım
sürecine değil; ve "pozisyon kapandı" ile "rol artık yok" farklı olaylar.

### 4.3 Yönetici site haritası (işe alım)

```
/dashboard                                   Bugün (ortak, iki çözümün işi)

/hiring/candidates                           Adaylar (tüm alımlar)
/hiring/candidates/[id]                      Aday detayı (özet, cevaplar, değerlendirmeler, karar)
/hiring/candidates/[id]/review               İnceleme ve puanlama (?attempt=, ?activity=)
/hiring/invite                               Aday davet et (Sheet; doğrudan URL de çalışır)

/hiring/openings                             Alımlar
/hiring/openings/new                         Alım aç (pozisyon seç/oluştur → başlangıç yolu)
/hiring/openings/[id]                        Alım: Genel bakış (sekme)
/hiring/openings/[id]/candidates             Alım: Adaylar (sekme, filtrelenmiş tablo)
/hiring/openings/[id]/compare                Alım: Karşılaştır (sekme; ayrışmalar dahil)
/hiring/openings/[id]/assessment             Alım: Değerlendirme (sekme; özet + sürüm geçmişi)
/hiring/openings/[id]/assessment/edit        Kurucu (aşama + aktivite)
/hiring/openings/[id]/assessment/ai          AI taslağı (ilan metninden öneri kartları)
/hiring/openings/[id]/assessment/scorecard   Puan kartı ve ağırlıklar
/hiring/openings/[id]/assessment/preview     Aday önizlemesi
/hiring/openings/[id]/settings               Alım: Ekip ve kurallar (değerlendiriciler, karar
                                             veren, kimlik gizleme, gözetim, son tarih, geri dönüş)

/library/positions                           Pozisyonlar (ortak)
/library/positions/[id]                      Pozisyon: tanım + yetkinlik profili + nerede kullanılıyor
/library/competencies                        Yetkinlikler (sekme: Yetkinlikler · Puan skalaları)
/library/competencies/[id]                   Yetkinlik: çapalar + gözlem etiketleri

/settings                                    Org, çözümler, kullanıcılar, saklama, gizlilik metinleri
/settings/hiring                             İşe alım varsayılanları (karar gerekçeleri, gözetim
                                             varsayılanı, geri dönüş süresi, aday iletişim adresi)
/settings/audit                              Denetim kaydı
```

Kaldırılanlar ve nedenleri:
- **Üst seviye `/compare` yok.** Karşılaştırma yalnızca aynı alımın adayları arasında anlamlı;
  eski ekran da zaten pozisyon çipi seçtiriyordu. Alımın sekmesine taşındı.
- **Şablon / sürüm URL'leri yok** (`/templates/[tid]/versions/[v]/...`). Bir alımın tek bir
  değerlendirmesi var; sürümler otomatik (yayınla = kilitle, düzenle = yeni taslak) ve
  "Sürüm geçmişi" bir açılır listede. Veri modeli birden çok şablonu taşımaya devam edebilir;
  arayüz bunu göstermez çünkü eski üründe hiç kimse ikinci şablon açmadı (doğrulanmadı: kullanım
  verisi yok, bu bir çıkarım) ve kavram yöneticiye bir katman daha yüklüyordu.
- **`/candidates/[id]/decision` ayrı sayfa yok.** Karar aday detayının sağ rayında ve inceleme
  ekranının sonunda.

### 4.4 Aday site haritası (token, giriş yok)

```
/a/[token]                 Karşılama + ne olacak + kayıt/gözetim bildirimi + rıza
/a/[token]/info            Kısa bilgi formu
/a/[token]/check           Cihaz kontrolü (+ gözetim açıksa gözetim adımları)
/a/[token]/practice        Isınma sorusu (gönderilmez, atlanabilir)
/a/[token]/stage/[n]       Aşama girişi → aktiviteler → aşama arası
/a/[token]/done            Bitti: ne olacak, ne zaman, kim
/a/[token]/rights          Veri hakları ve uyarlama (ek süre, farklı format) talebi
(aynı yolda durumlar)       geçersiz · henüz açılmadı · süresi doldu · tamamlandı ·
                           tekrar isteği var · alım kapandı · yalnızca bilgisayar (gözetim)
```

`/a/[token]` ortak çekirdektir: token hangi çözümün davetiyse o çözümün akışını yükler. Sınav
akışı (`/a/[token]/exam`) aynen kalır.

### 4.5 "Bugün" (ortak)

Bugün iki çözümün kuyruklarını tek listede birleştirir, her satır çözüm etiketini taşır
("İşe alım" / "Sınav", düz `muted` metin). Sıra: bana atanmış ve en uzun bekleyen önce.
Ayrıntı 5.1'de.

### 4.6 Roller

Global roller: `OWNER` · `MANAGER` (eski adıyla Recruiter; TR "Yönetici") · `REVIEWER`. Yeni olan **alım başına atama**:

| Alım rolü | Kim olabilir | Ne yapar |
|---|---|---|
| Değerlendirici (Reviewer) | Herkes | Kendisine atanan adayları bağımsız puanlar |
| Karar veren (Decision maker) | Owner, Recruiter (alım başına bir kişi, yedeği olabilir) | Değerlendirmeleri görür, kararı gerekçesiyle verir, tekrar ister |
| Alım sahibi (Opening owner) | Owner, Recruiter | Değerlendirmeyi kurar, davet eder, ekibi atar |

*Neden:* eski üründe kararı kim veriyor belirsizdi ("karar sahibi belli" deniyordu ama alan
yoktu). Değerlendiriciyi karar verenden ayırmak, OPM'nin "önce herkes bağımsız puanlar, sonra
ayrışmalar konuşulur" panel modelinin [28] hafif bir uygulamasıdır (çıkarım: OPM ayrı bir karar
veren rolü tanımlamıyor, bunu ben ekliyorum).

### 4.7 Derin bağlantılar

E-posta gönderimi bugün yok (STATUS.md). Yine de her bildirim tipinin hedefi sabit:
"Değerlendirmen bekleniyor" → `/hiring/candidates/[id]/review`; "Karar bekleniyor" →
`/hiring/candidates/[id]#decision`; "Uyarlama talebi" → Bugün'de talepler bölümü.

## 5. Yönetici ekranları

Her ekran için: soru (ekran hangi soruyu cevaplar), bölgeler, tek dolu buton, shadcn bileşenleri,
durumlar, anahtar metin (TR / EN). Görsel kurallar 8. bölümde ve RULES.md'de. Yükleme durumu her listede
`Skeleton` satırlarıdır (gerçek satır yüksekliğinde, en fazla 6 satır); "boş" ile "yükleniyor"
asla aynı görünmez (airbnb-ux `states-feedback.md` #1). Hata durumu her sayfada aynı: sayfa
hata sınırı, sakin metin, "Tekrar dene" (outline) ve "Bugün'e dön" (metin).

### 5.1 Bugün (`/dashboard`)

**Soru:** "Şimdi neye bakmalıyım?"

**Bölgeler:**
1. Başlık: "Günaydın Deniz. 4 iş seni bekliyor." / "Good morning Deniz. 4 things need you."
   Alt satır: en eski bekleyen ("En eskisi 2 gün önce tamamlandı.").
2. **Benim sıram** (ana bölge, tam genişlik liste): satır = ad (ya da kimlik gizliyse "Aday 14")
   · alım / sınav adı · çözüm etiketi · beklenen iş ("Değerlendirmen bekleniyor", "Karar
   bekleniyor · 3/3 değerlendirme", "Görüş ayrılığı: İletişim") · bekleme süresi · "İncele" metni.
   Satırın tamamı tıklanır. Altında: "Sırayla incele · 4 aday, tahmini 30 dk".
3. **Talepler** (ikincil, yalnızca varsa): uyarlama talepleri, "yeni link istiyorum", sorun
   bildirimleri, veri hakkı talepleri. Satır başına tek outline eylem ("Ek süre tanı", "Linki uzat").
4. **Linki dolmak üzere** (ikincil, katlanır): 48 saat içinde dolacak, başlamamış davetler,
   "3 gün uzat" (geri alınabilir, 8 sn undo).

Stat tile ızgarası yok, "son etkinlikler" akışı yok, grafik yok (airbnb-ux genel dashboard testi).

**Birincil eylem:** kuyruk doluysa **"Sırayla incelemeye başla"** / "Start reviewing"; boşsa
**"Aday davet et"**. Diğeri outline olarak durur ("Davet et ▾": Aday / Öğrenci, iki çözüm açıksa).

**Bileşenler:** `Card`, özel `QueueRow` (satır = `Link`), `Collapsible`, `Button`,
`DropdownMenu` (davet türü), `Sonner` (undo), `Skeleton`, `Empty`.

**Durumlar:**
- Boş: "Bekleyen işin yok. Değerlendirmede 2 aday sürüyor." / "Nothing is waiting for you. 2
  candidates are mid-assessment." + "Aday davet et" (dolu).
- Değerlendirici olarak hiç atanmamışsa: "Henüz bir alımda değerlendirici değilsin. Alım sahibi
  seni eklediğinde adaylar burada görünür." / "You are not on any hiring team yet..."

### 5.2 Alımlar (`/hiring/openings`)

**Soru:** "Hangi alımlar açık ve hangisi tıkanmış?"

**Bölgeler:** Başlık + sekmeler `Açık · Taslak · Kapalı`. Liste satırı: alım adı (pozisyon +
dönem: "Kıdemli Ürün Tasarımcısı · Ekim") · durum (dot+metin: Taslak / Yayında / Kapalı) ·
huni metni ("12 davet · 7 tamamladı · 3 karar bekliyor") · son tarih · alım sahibi.
Satır kart değil, tablo satırıdır: ayırt edici bilgi metindedir.

**Birincil eylem:** "Alım aç" / "Open a role".

**Bileşenler:** `Tabs`, `Table`, `Button`, `Empty`.

**Durumlar:** Boş (hiç alım yok): "İlk alımını aç. İlan metnini yapıştırman yeterli, gerisini
birlikte kuralım." / "Open your first role. Paste the job ad and we'll build the rest together."
+ dolu buton.

### 5.3 Alım aç (`/hiring/openings/new`)

Tek sayfa, iki adım; sihirbaz değil, aynı sayfada açılan iki blok.

1. **Pozisyon:** `Combobox` "Pozisyon seç ya da yeni yaz". Yeni ise: ad (zorunlu) + ilan metni
   (opsiyonel ama önerilir, "AI taslağı için 120 karakter yeter"). Kütüphanede var olan pozisyon
   seçilirse yetkinlik profili özet satırı görünür ("5 yetkinlik · ağırlıklar eşit").
2. **Nasıl başlayalım?** Üç büyük seçenek (`RadioGroup` kart görünümü, ikon + 1 cümle):
   - "İlan metninden AI taslağı" / "Draft from the job ad with AI" (önerilen; ilan yoksa nedenli kapalı:
     "İlan metni ekleyince açılır.")
   - "Önceki bir alımdan kopyala" / "Copy a previous opening" (yoksa gizli)
   - "Boş başla" / "Start blank"

**Birincil eylem:** "Alımı oluştur" → seçilen yola gider. Kapalıyken: "Pozisyon adını yaz."

### 5.4 Alım: Genel bakış (`/hiring/openings/[id]`)

**Soru:** "Bu alım nerede, sıradaki adımım ne?"

**Bölgeler:**
- Üst: alım adı, durum, son tarih, sekmeler `Genel bakış · Adaylar · Karşılaştır · Değerlendirme · Ekip ve kurallar`.
- **Hazırlık listesi** (yalnızca taslakta, en üstte): 4 satır, her biri dot + metin + eylem:
  Değerlendirme kuruldu · Puan kartında her yetkinliğin çapası var · Ekip atandı · Önizleme
  yapıldı. Tamamlanan satır tek satıra iner.
- **Huni** (yayındayken): yatay tek satır metin + ince çubuk: Davet 12 → Başladı 9 → Tamamladı 7
  → Değerlendirildi 5 → Karar 3. Her basamak Adaylar sekmesine filtreli gider. Ortalama tamamlama
  süresi ve tahmine oranı ("Ortalama 27 dk, tahmin 25 dk"). Bu bir dekor değil: tahminin tutup
  tutmadığı adaya verdiğimiz sözün doğruluğudur.
- **Aday deneyimi** (yalnızca ≥5 yanıt varsa): bitiş anketinin ortalaması ve son 3 yorum.
  Az veri varsa gösterilmez (playbook 1.7: kötü/gürültülü sinyal yerine sus).

**Birincil eylem:** taslakta **"Yayınla"** (hazırlık listesi eksikse nedenli kapalı:
"Puan kartında İletişim için 3. seviye çapası eksik."); yayındayken **"Aday davet et"**.

**Bileşenler:** `Tabs` (route sekmeleri), `Card`, `Progress` (huni), `Button`, `DisabledReason`.

### 5.5 Değerlendirme kurucu (`/hiring/openings/[id]/assessment/edit`)

Eski Y2 düzeni korunur; çalışıyordu.

**Bölgeler (üç sütun, 1360px):**
1. **Sol (280px): yapı ağacı.** Aşamalar ve aktiviteler, sürükle-bırak (`dnd-kit`), her satırda
   tip ikonu + süre. Altta toplam: "3 aşama · 24 dk". Toplam 30 dakikayı aşınca nötr not:
   "Adayın zamanına saygı: 30 dk altı önerilir." Kaynak notu: Modern Hire verisinde süreyi 15 dk
   kısaltmak tamamlamayı yalnızca %1-2 artırıyor, kayıpların yarıdan fazlası ilk 5-10 dakikada [40];
   ama "zamanıma saygı gösterilmedi" adayların süreçten çekilme nedenlerinin başında [39]. Bu yüzden
   uyarı tamamlama oranıyla değil saygıyla gerekçelendirilir ve asıl yatırım ilk dakikalara yapılır.
2. **Orta: "Adayın gördüğü"** (açık zemin): soru metni (TR/EN sekmeleri), adaya not, tip ayarları
   (video: düşünme süresi [varsayılan 60 sn, esnek], cevap süresi [varsayılan 2 dk], tekrar hakkı
   [varsayılan 1]; yazılı: karakter aralığı; seçmeli: seçenekler
   + doğru cevap; dosya: türler, boyut). "Yazılı alternatife izin ver" anahtarı (erişilebilirlik).
3. **Sağ: "Sadece ekip görür"** (koyu `vault`): amaç, ölçtüğü yetkinlikler (en fazla 2, çip),
   **bu soruya özel iyi cevap örnekleri** (yetkinlik çapasının soruya uyarlanmış hali, seviye
   1/3/5 için birer cümle), kırmızı bayraklar, değerlendiriciye not.

**Alt yapışkan şerit:** "Kaydedildi 14:02" · "Soru kontrolü: 1 öneri" (AI, 3.9) · "Önizle"
(outline) · **"Yayınla"** (dolu; eksik varsa nedenli kapalı).

**Kurallar:** her aktivite en az bir yetkinlik ölçer; her yetkinlik en az bir aktivitede ölçülür
(ikide ölçülmesi önerilir, nötr not). Yayınlı sürüm düzenlenemez: düzenlemeye başlamak yeni
taslak açar ve bunu satır içi söyler ("Yayındaki v2'ye 4 aday bağlı. Değişiklikler v3 olarak
kaydedilir, onları etkilemez.").

**Bileşenler:** `ResizablePanelGroup`, `Tabs` (TR/EN), `Input`, `Textarea`, `Select`,
`ToggleGroup` (aktivite tipi), `Switch`, `Popover`, `Sonner`, `Breadcrumb` (yalnızca burada:
Alımlar / Kıdemli Ürün Tasarımcısı / Değerlendirme).

**Durumlar:** Boş taslak: orta sütunda üç başlangıç ("AI taslağı", "Kopyala", "İlk aşamayı
ekle"). Kayıt hatası: şeritte "Kaydedilemedi, tekrar deniyoruz." + elle "Tekrar dene".

### 5.6 AI taslağı (`/hiring/openings/[id]/assessment/ai`)

Eski Y3 ve `AI-BUILDER.md` korunur: öneri kartları, hiçbiri kendiliğinden uygulanmaz, süre
bütçesi (15-30 dk, en fazla 4 aşama), çoktan seçmeli soru önerilmez.

**Değişenler:**
- Pozisyonun yetkinlik profili varsa AI önce onu kullanır; yeni yetkinlik önerisi ayrı kart
  türüdür ve kabul edilirse *Kütüphane'ye* eklenir (bunu kart söyler: "Kütüphaneye eklenir,
  diğer alımlar da kullanabilir.").
- Her aktivite kartı ölçtüğü yetkinliği ve **soruya özel 1/3/5 örnek cevaplarını** da önerir;
  yönetici bunları da kart üzerinde düzenler.
- Kart başına "Neden?" satırı: ilandaki hangi cümleden çıktığı (alıntı). Alıntı ilanda yoksa kart
  gösterilmez.

**Birincil eylem:** önce "Önerileri üret"; kartlar gelince "Kabul edilenlerle kurucuya geç".
Kart eylemleri outline/metin: Kabul et · Düzenle · Sil (hepsi geri alınabilir).

**Durumlar:** Bekleme: "Öneriler hazırlanıyor, genelde 20-40 sn." + iskelet kartlar. Hata:
"Öneri üretilemedi: <neden>. İlan metnin kayıtlı, tekrar deneyebilir ya da boş başlayabilirsin."
Bütçe aşımı: kartlar gösterilir, üstte nötr not ("Toplam 41 dk çıktı; 30 dk altına indirmek için
1 aşamayı silmeyi düşün.").

### 5.7 Puan kartı ve ağırlıklar (`/hiring/openings/[id]/assessment/scorecard`)

**Soru:** "Neyi, hangi soruyla, ne kadar önemseyerek ölçüyoruz?"

**Bölgeler:**
- **Matris** (ana): satır = yetkinlik, sütun = aktivite; hücrede nokta (ölçülüyor). Satır sonunda
  ölçüm sayısı. Tek soruyla ölçülen yetkinlik `muted` notla işaretli ("Tek soruyla ölçülüyor").
- **Çapa durumu:** her satırda "Çapalar tamam" ya da "Seviye 3 tanımı eksik" + "Düzenle" (çapalar
  Kütüphane'de yaşar; düzenleme `Sheet` içinde açılır, bu sayfadan çıkılmaz).
- **Ağırlıklar** (katlanır, varsayılan kapalı): "Ağırlıklar eşit" anahtarı açık gelir. Kapatınca
  her satırda yüzde girişi + yatay çubuk, toplam canlı ("Toplam %100"). Varsayılan değerler
  pozisyon profilinden gelir.
- **Karar kuralı** (salt okunur özet): "Genel puan = yetkinlik puanlarının (ağırlıklı)
  ortalaması. Her yetkinlik puanı = değerlendiricilerin ortalaması. Bilgi testi ayrı gösterilir."

**Birincil eylem:** "Puan kartını kaydet". Toplam ≠ 100 ise nedenli kapalı: "Toplam %95, %5
eksik." Yayından sonra ağırlık değişirse: kaydetmeden önce satır içi açıklama + zorunlu gerekçe
alanı; "Mevcut puanlar eski ağırlıklarla kalır. Yeniden hesaplamak ayrı bir adımdır."

**Bileşenler:** `Table`, `Switch`, `Input` (sayı), `Progress`, `Sheet`, `Collapsible`, `Textarea`.

### 5.8 Aday önizlemesi (`/hiring/openings/[id]/assessment/preview`)

Adayın göreceği akışın aynısı, gerçek bileşenlerle, üstte ince bir şerit: "Önizleme · cevaplar
kaydedilmez · kamera açılmaz" + "Mobil görünüm" geçişi (390px çerçeve) + "Kurucuya dön".
İç alanlar (`internal_*`) burada da yok; önizleme `candidateSafe()` çıktısını kullanır, böylece
"adayın gördüğü" bir iddia değil kanıt olur. Dolu buton adayın ekranındakidir; şeritte dolu buton yok.

### 5.9 Pozisyonlar (`/library/positions`, `/library/positions/[id]`)

**Liste:** ad · ekip · yetkinlik sayısı · nerede kullanılıyor ("İşe alım · 2"). Dolu buton:
"Pozisyon ekle".

**Detay bölgeleri:** tanım ve ilan metni (katlanır, ilk 500 karakter) · **Yetkinlik profili**
(satır: yetkinlik · önem ağırlığı · opsiyonel beklenen seviye 1-5) · **Nerede kullanılıyor**
(çözüme göre gruplanmış; işe alımda alım listesi). Dolu buton: "Bu pozisyon için alım aç".

**Boş:** "Pozisyon, bir rolün neyi gerektirdiğini tek yerde tutar. İşe alım ve ileride diğer
araçlar buradan okur." + "Pozisyon ekle".

### 5.10 Yetkinlikler ve skalalar (`/library/competencies`, `/[id]`)

Liste 8 hazır yetkinlikle gelir (eski karar korunur), her biri "Kademe başlangıç içeriği,
ekibiniz incelemedi" etiketiyle, ta ki biri düzenleyip "İncelendi" diyene kadar.

**Detay bölgeleri:**
- Ad, tanım (adaya hiç gösterilmez).
- **Çapalar:** 5 satır, seviye adı + davranışsal tanım. Seviye 1, 3, 5 zorunlu; 2 ve 4 opsiyonel
  ("1 ile 3 arası" diye gösterilir). Her satırın yanında iyi/kötü örnek ipucu.
  "AI ile çapa öner" (outline): yetkinlik adı ve tanımından 1/3/5 önerisi, kart olarak, kabul/
  düzenle.
- **Gözlem etiketleri:** olumlu ve olumsuz iki liste, en fazla 6'şar.
- **Çapa kalite kontrolü** (satır içi, otomatik, kural tabanlı): "Bu tanım bir davranış değil, bir
  sıfat ('iyi iletişimci'). Gözlenebilir bir davranış yaz: 'karşı tarafın sorusunu kendi
  cümleleriyle özetler'." Yalnızca öneri; kaydetmeyi engellemez.
- Nerede kullanılıyor.

**Birincil eylem:** "Kaydet" (otomatik kayıt yok burada: org varlığıdır, değişikliği bilinçli
olsun). Kapalıyken: "Seviye 3 tanımını yaz."

**Puan skalaları sekmesi:** varsayılan 5 seviyeli skala; seviye adları düzenlenebilir. Owner dışı
salt okunur. Yeni skala nadirdir; "Skala ekle" outline.

### 5.11 Aday davet et (`/hiring/invite`, `Sheet`)

Altın yol hedefi korunur: **30 saniye, 4 tıklama.** Her "Aday davet et" düğmesi sağdan `Sheet`
açar; doğrudan URL aynı formu sayfa olarak açar.

**Alanlar:** Alım (bulunduğun alım önceden seçili) · Ad soyad · E-posta · Arayüz dili (TR/EN) ·
"Birden fazla aday" bağlantısı (CSV yapıştır: ad, e-posta; satır içi doğrulama, hatalı satırlar
işaretli). Son tarih alımdan gelir, "Değiştir" ile açılır.

**Erken doğrulama:** alımın değerlendirmesi yayında değilse buton nedenli kapalı: "Önce
değerlendirmeyi yayınla." + "Değerlendirmeye git". Aynı e-posta bu alımda zaten varsa satır içi:
"Elif Kaya bu alımda zaten davetli (12 Eyl). Linkini yeniden göster?"

**Başarı:** link bir kez görünür, **"Linki kopyala"** (dolu), altında hazır mesaj metni (kopyalanır,
TR/EN, adayın adı ve son tarih dolu). "Bu link bir daha gösterilmez; kaybolursa yeni link
üretebilirsin." Sonra "Başka aday davet et" (metin) ve "Kapat".

**Bileşenler:** `Sheet`, `Form` + `Field`, `Input`, `Select`, `Textarea` (CSV), `Button`, `Sonner`.

### 5.12 Adaylar (`/hiring/candidates`)

**Soru:** "Kim nerede, kimin üzerinde iş var?"

**Bölgeler:**
- Sekmeler: `Benim sıram · Karar bekliyor · Devam ediyor · Davet edildi · Karar verildi · Tümü`.
  "Benim sıram" varsayılan (değerlendirici için); Recruiter varsayılanı "Karar bekliyor".
- Arama + filtre çipleri: alım, aşama, değerlendirici, karar, "görüş ayrılığı var".
  Sıfır sonuç: aktif filtreler kaldırılabilir çip + hangisini kaldırınca kaç sonuç çıkacağı
  ("Alım filtresini kaldır → 4 aday").
- Tablo sütunları: Aday · Alım · İlerleme ("3/3 aşama") · Değerlendirme ("2/3 değerlendirici")
  · Genel puan · Durum (dot+metin) · Bekleme.
- **Bağımsızlık kuralı tabloya da uyar:** bu adayda değerlendirici olup henüz göndermemiş
  kullanıcı genel puan sütununda sayı değil "Önce sen değerlendir" / "Score first" görür.

**Birincil eylem:** "Aday davet et".

**Bileşenler:** `Tabs`, `Input` (arama), `ToggleGroup`/`DropdownMenu` çipleri, `Table`
(TanStack ile sıralama), `Pagination` (50 satır), `Empty`.

**Boş (hiç aday):** "Henüz aday yok. Bir alım seç, linki oluştur, e-postayla gönder." + dolu
buton.

### 5.13 Aday detayı (`/hiring/candidates/[id]`)

**Soru:** "Bu kişi hakkında ne biliyoruz ve karar için ne eksik?"

**Bölgeler (iki sütun):**
- **Üst satır:** ad (ya da "Aday 14"), alım, davet/tamamlama tarihi, durum dot+metin, deneme
  seçici (`Select`: "Deneme 2 · geçerli", "Deneme 1 · bağlantı koptu").
- **Sol ana sütun, sekmeler** `Özet · Cevaplar · Değerlendirmeler · Kayıt`:
  - *Özet:* yetkinlik profili tablosu (satır: yetkinlik · birleşik puan · değerlendirici puanları
    nokta grafiği 1-5 ekseni · ayrışma işareti) + genel puan + bilgi testi (ayrı satır, "%80 · 10
    sorudan 8") + insan notlarının AI özeti (etiketli, 3.9).
  - *Cevaplar:* aşama aşama, her aktivite kısa önizleme (video süresi + transkriptin ilk cümlesi,
    yazılının ilk 240 karakteri) + "İnceleme ekranında aç".
  - *Değerlendirmeler:* değerlendirici başına kart: kim, ne zaman gönderdi, puanlar, notlar,
    bütünlüğü puanlamadan önce açtı mı. Bağımsızlık kuralına tabi.
  - *Kayıt:* teknik olaylar ve (gözetim açıksa) bütünlük sekmesi (7. bölüm); değişiklik geçmişi.
- **Sağ ray (yapışkan, 360px): Karar.** 5.17'de.

**Birincil eylem:** duruma göre tek: değerlendirmesi eksik değerlendirici için **"Değerlendir"**;
karar veren için **"Kararı kaydet"** (rayda). Diğerleri outline: "Tekrar iste", "Linki uzat".

**Bileşenler:** `Tabs`, `Card`, `Select`, `Collapsible`, `HoverCard` (puan noktası üstünde
değerlendirici adı ve notu), `ScrollArea`.

### 5.14 İnceleme ve puanlama (`/hiring/candidates/[id]/review`): kritik ekran

**Soru:** "Bu cevap bu yetkinlikte hangi seviyeye uyuyor ve kanıtım ne?"

```
+--------------------------------------------------------------------------------------+
| ‹ Adaylar   Elif Kaya · Kıdemli Ürün Tasarımcısı · Deneme 1        4 adaydan 2.  ‹ › |
| Aşama 1 ✓  ·  [Aşama 2: Vaka]  ·  Aşama 3 (tamamlanmadı)          Kaydedildi 14:02   |
+-----------------------------------------------------+--------------------------------+
| Soru 1/2 · Onboarding düşüşü · video 2:54           |  BU SORU NEYİ ÖLÇÜYOR          |
| [ video oynatıcı, 1x 1.25x 1.5x 2x, -15 +15 ]       |  Problem çerçeveleme           |
|                                                     |  [1][2][3][4][5]  [Kanıt yok]  |
| Transkript (tıkla, oraya git · ara)                 |  3 · Beklenen: "Sorunu en az   |
| 00:42 ...önce düşüşün gerçekten ikinci adımda...    |   iki olası nedene ayırır..."  |
| 01:07 ...iki farklı şey oluyor...                   |  + Net yapı  + Veriyle konuşur |
|                                                     |  - Varsayımı test etmiyor      |
| ▸ Sadece ekip görür: amaç, iyi cevap örnekleri,     |  Not: [....................]   |
|   kırmızı bayraklar (katlı)                         |                                |
|                                                     |  Ölçüm disiplini               |
|                                                     |  [1][2][3][4][5]  [Kanıt yok]  |
|                                                     |  ...                           |
|                                                     | ------------------------------ |
|                                                     |  Bu aday: 3/5 puan verildi     |
|                                                     |  [ Sonraki soru → ]            |
+-----------------------------------------------------+--------------------------------+
```

**Değişenler (eski Y5'e göre):**
1. **Puanlama soru düzeyinde.** Ray, aşamanın değil *açık olan sorunun* ölçtüğü 1-2 yetkinliği
   gösterir. "Sonraki soru" videoyu ve rayı birlikte ilerletir. *Neden:* çapa, sorunun "iyi cevap
   örneği"ne bağlı; aşama düzeyinde puan dört cevabı tek bir izlenime ezer (hale etkisi).
2. **Yıldız yok, numaralı segment var.** `ToggleGroup` 1-5 + ayrı "Kanıt yok" düğmesi. Seçili ya da
   üzerine gelinen seviyenin çapası segmentin hemen altında tam metin görünür (tooltip değil).
   *Neden:* yıldız tüketici memnuniyeti okunur ve skalanın tepesine yığılmayı davet eder
   (airbnb-ux playbook 3: puan enflasyonu); çapanın görünür olması BARS'ın kendisidir [28] [29].
3. **Uçlar kanıt ister.** 1 ya da 5 verildiğinde not alanı açılır: "1 ve 5 için kısa bir kanıt
   yaz ya da etiket seç." Kanıtsız uç puan kaydedilir ama "gönder" o yetkinlik için nedenli kapalı
   kalır. Diğer seviyelerde not opsiyonel.
4. **Açık gönderim.** Puanlar otomatik kaydedilir (taslak). Son sorudan sonra ray özet gösterir
   (yetkinlik başına birleşik puanın *kendi* hesabı) ve **"Değerlendirmemi gönder"** dolu butonu.
   Gönderince: diğer değerlendirmeler ve bütünlük özeti açılır (bağımsızlık kuralı, 3.5).
   Gönderdikten sonra değiştirmek mümkün, gerekçe ister ve geçmişe yazılır.
5. **Bütünlük puanlama bitene kadar kapalı** (7.3). Yerine tek satır: "Bütünlük özeti
   değerlendirmeni gönderince görünür." + "Şimdi göster" metin bağlantısı (açarsan bu
   değerlendirmende "puanlamadan önce bütünlüğü gördü" yazar).
6. **Kimlik gizleme açıksa** başlıkta ad yerine "Aday 14"; e-posta, şehir, dosya adları gizli.
   Video yüzü ve sesi gizlemez; bunu başlıktaki bilgi ikonu söyler.

**Klavye (korunur):** `1-5` puan, `0` kanıt yok, `J/K` yetkinlik, `N/P` sonraki/önceki soru,
`Space` oynat, `←/→` 5 sn, `?` kısayol listesi (`Dialog`, uygulamadaki tek dialog türü).

**Birincil eylem:** soru sırasında **"Sonraki soru"**, son soruda **"Değerlendirmemi gönder"**.
Kapalıyken: "Problem çerçeveleme için puan ver ya da 'Kanıt yok' seç."

**Durumlar:**
- Video hazırlanıyor: "Video işleniyor (genelde 1 dk). Transkript hazır olunca burada." 
- Kısmi kayıt: "Kayıt 1:12'de kesildi. Eldeki kısım oynatılıyor." (eski INCOMPLETE).
- Aday soruyu boş bıraktı: "Aday bu soruya cevap vermedi." Puan alanı yerine "Kanıt yok" seçili gelir.
- Transkript başarısız: "Transkript çıkarılamadı. Video tam." (sessizce boş alan yok).
- Hiç değerlendirici atanmamış ve sen Owner'sın: "Bu alımda değerlendirici değilsin. Yine de
  puanlarsan değerlendirici olarak eklenirsin." + "Değerlendirici ol" (outline).

**Mobil:** okunur ve izlenir; puanlama tablette çalışır (≥ 768px, ray video altına iner).
Telefonda puanlama yok, "Bilgisayarda puanla" notu; *neden:* çapa okumak + video izlemek + not
yazmak telefonda dikkatli değerlendirmeyi bozar.

**Bileşenler:** `ResizablePanelGroup`, özel `VideoPlayer` + `Transcript` (mevcut bileşenler),
`ToggleGroup`, `Toggle` (gözlem çipleri), `Textarea`, `Collapsible`, `Kbd`, `Dialog`, `Sonner`,
`Progress` (kaç puan verildi).

### 5.15 Karşılaştır (`/hiring/openings/[id]/compare`)

**Soru:** "Bu alımın adayları yetkinlik yetkinlik nasıl duruyor ve nerede anlaşamıyoruz?"

**Bölgeler:**
- Görünüm seçici `ToggleGroup`: **Tablo · Ayrışmalar · Soru soru**.
- **Tablo:** satır aday, sütun yetkinlik, son sütun genel puan. Hücre: birleşik puan (büyük) +
  altında değerlendirici sayısı ve dağılım ("3 kişi · 2-4"). Dağılım ≥ 2 ise hücrede ince alt
  çizgi ve "ayrışma" metni (renk değil). Sıralama: genel puan (varsayılan), her sütun tıklanır.
  **Eksik değerlendirmeler ayrı grupta, altta**: "Değerlendirmesi tamamlanmamış (2)". Kısmi
  puanla sıralamaya girilmez.
- **Ayrışmalar:** ayrışmalı (aday, yetkinlik) çiftleri listesi; satır açılınca değerlendiricilerin
  puanı + notu yan yana, "Kalibrasyon toplantısı için kopyala" (metin). Ayrıca değerlendirici
  eğilimi (≥5 ortak aday varsa, yalnızca karar veren ve Owner görür): "Ece ortalamanın 0,6
  üstünde puanlıyor." Nötr dille, sıralama yok.
- **Soru soru:** bir soru seçilir, o sorunun tüm adaylardaki cevapları sırayla açılır ("yatay
  inceleme"). Sıra her değerlendirici için rastgele. *Neden:* aynı soruyu art arda dinlemek
  karşılaştırma ölçütünü sabit tutar, adayın diğer cevaplarının hale etkisini azaltır [49] [50]
  [51]. İşe alıma özgü doğrudan bir deney bulunamadı; bu yüzden varsayılan değil, seçenek.
- Alt not: "Puan bir sıralama değil, konuşmanın başlangıcı. Kararı ekip verir." (eski Y6 metni korunur).

**Birincil eylem:** karar veren için **"Karar bekleyenleri aç"** (ilk karar bekleyen adayın
detayına gider). Diğer roller için dolu buton yok; bu bir okuma ekranı.

**Bağımsızlık:** bu sayfa, bu alımda gönderilmemiş değerlendirmesi olan kullanıcıya o adayların
satırlarını "Önce sen değerlendir" olarak gösterir.

**Boş:** "Karşılaştırmak için en az iki adayın değerlendirmesi tamamlanmalı. Şu an: 1." +
"Değerlendirme kuyruğuna git".

**Bileşenler:** `ToggleGroup`, `Table`, `HoverCard`, `Collapsible`, özel `DotStrip` (1-5 ekseninde
değerlendirici noktaları, SVG).

### 5.16 Tekrar iste (aday detayından `Sheet`)

Eski model aynen korunur (yeni deneme, kapsam dışı aşamalar taşınır, hiçbir şey silinmez, yeni
deneme otomatik birincil olmaz).

**Alanlar:** Kapsam (`RadioGroup`: "Tüm değerlendirme" / "Seçili aşamalar" + aşama
`Checkbox`'ları) · Neden (`Select`, zorunlu: Teknik sorun / Uyarlama / Bütünlük sorusu / Diğer)
· Adaya görünen mesaj (opsiyonel, hazır metin önerilir: "Bağlantın 2. aşamada koptu. Bu aşamayı
yeniden yapabilirsin.") · Son tarihi uzat (gün).

**Birincil eylem:** "Tekrar isteğini gönder". Sonrası: aynı link yeniden geçerli olur; aday
detayında yeni deneme "Deneme 2 · bekleniyor" olarak belirir; undo 8 sn.

### 5.17 Karar (aday detayının sağ rayı)

**Bölgeler (yukarıdan aşağı):**
1. Hazırlık satırı: "3/3 değerlendirme gönderildi" ya da "1 değerlendirme bekleniyor (Murat)".
2. Kısa özet: genel puan + n değerlendirici + ayrışma varsa "İletişim'de görüş ayrılığı var" bağlantısı.
3. Bütünlük satırı (gözetim açıksa): dot + metin + "İncele".
4. **Karar seçenekleri** (`RadioGroup`, büyük satırlar): **İlerlet** / Advance · **Beklet** /
   Hold · **Devam etmiyor** / Not moving forward.
5. **Gerekçe (zorunlu):** gerekçe listesinden en az biri (`Combobox`, çoklu): yetkinliğe bağlı
   ("İletişim beklenen düzeyin altında", "Problem çerçeveleme güçlü"), süreçle ilgili ("Aday
   çekildi", "Pozisyon kapandı", "Daha uygun adaylar ilerledi") + opsiyonel not.
6. **"Kararı kaydet"** (dolu). Undo 8 sn; sonra geçmişe yazılır, değiştirmek yeni karar satırıdır.

**Kapı:** alımın "en az N değerlendirme" kuralı (varsayılan 2, en az 1) dolmadan dolu buton kapalı:
"Karar için en az 2 değerlendirme gerekiyor, 1 var." Karar veren kuralı tek başına aşabilir ama
gerekçe metni zorunlu olur ve geçmişte "değerlendirme eksikken karar verildi" yazar. *Neden:*
gerçek hayatta değerlendirici izinde olabilir; engellemek yerine görünür kılmak.

**Asla:** AI'nın karar önerdiği, "işe al" dediği, adayı sıraladığı bir alan yok.

### 5.18 Ekip ve kurallar (`/hiring/openings/[id]/settings`)

Tek sayfa, dört blok, ayar labirenti yok:
1. **Ekip:** değerlendiriciler (`Combobox` çoklu), karar veren, "her adayı kaç kişi değerlendirsin"
   (1-5, varsayılan 2; atama dönüşümlü ve otomatik).
2. **Adil değerlendirme:** "Puanlamadan önce kimliği gizle" (`Switch`, varsayılan kapalı, açıklaması:
   "Ad, e-posta, şehir, dosya adları gizlenir. Videoda yüz ve ses görünür."), "Değerlendiriciler
   birbirinin puanını kendi puanlarını gönderince görür" (her zaman açık, değiştirilemez, kilit
   ikonu + neden: "Bağımsız değerlendirme bu ürünün temel kuralıdır.").
3. **Gözetim:** preset (7. bölüm) + adaya ne söyleneceğinin canlı önizlemesi.
4. **Aday iletişimi:** son tarih, geri dönüş sözü ("tamamlandıktan sonra 7 gün içinde"), iletişim
   e-postası, bitiş anketi açık/kapalı.

Dolu buton: "Kaydet". Yayında olan alımda gözetim değişirse: "Yeni davetlere uygulanır. 4 açık
davet eski kuralla devam eder."

### 5.19 Ayarlar (ortak, işe alıma dokunanlar)

- **Çözümler:** İşe alım / Sınav aç-kapa (Owner). Kapalı çözümün menüsü ve Bugün satırları gizlenir, veri durur.
- **Kullanıcılar ve roller:** mevcut ekran.
- **İşe alım varsayılanları** (`/settings/hiring`): karar gerekçe listesi (düzenlenebilir), varsayılan
  gözetim, varsayılan değerlendirici sayısı, varsayılan geri dönüş süresi, aday iletişim adresi.
- **Gizlilik ve saklama:** rıza metni sürümleri (TR/EN, sürümlü), video saklama (varsayılan 180 gün
  karardan sonra), aday kaydı (24 ay), kanıt kareleri (90 gün), alt işleyiciler listesi.
- **Denetim kaydı:** mevcut ekran; video izleme, dışa aktarma, karar, karar değişikliği, puan
  değişikliği (gönderim sonrası), "bütünlüğü puanlamadan önce açtı" olayları.

## 6. Aday ekranları

**Ortak kurallar:**
- Hitap **"sen"** (eski işe alım metinleriyle aynı; sıcak ve yumuşak). Sınav tarafı "siz" kalır.
  *Neden:* işe alımda aday bir yetişkin ve marka sesi samimi; sınav tarafında kurum dili yerleşik.
- Tek sütun. Okuma metni en fazla 640px, video ekranları 960px, çerçeve 1000px (RULES.md).
- Her ekranda tek dolu buton. Mobilde dolu buton altta sabit çubukta (güvenli alan payıyla).
- Üstte: küçük şirket adı (logo yoksa ad), dil seçici, "Yardım" (metin; açılınca SSS + "Sorun bildir").
  İlerleme yalnızca ince bir çubuk + "Aşama 2 / 3" metni; başka süs yok.
- Sayaçlar sakin: accent renk, `tnum`, yanıp sönmez, kırmızıya dönmez. Son 60 saniyede yalnızca
  metin değişir: "Son 1 dakika" / "Last minute".
- Hiçbir ekranda "uyarı", "ihlal", "şüpheli", "hile" kelimesi yok.
- Her metin TR ve EN; şablon içeriği adayın dilinde, yoksa diğer dilde ve `lang` etiketiyle.

### 6.1 Karşılama ve rıza (`/a/[token]`)

**Soru:** "Bu ne, ne kadar sürecek, beni kim ve nasıl değerlendirecek?"

**Bölgeler (yukarıdan aşağı):**
1. "Merhaba Elif" + şirket ve pozisyon. Bir cümle amaç: "Bu değerlendirme, seninle tanışmadan önce
   nasıl düşündüğünü anlamamız için hazırlandı. Kendi zamanında, tek başına yapacaksın."
2. Üç bilgi: Aşama 3 · Tahmini süre 24 dk · Son tarih 14 Eki.
3. **Nasıl işliyor** (3 adım, numaralı): cihazını kontrol ediyoruz (deneme kaydı kimseye gitmez) ·
   bir ısınma sorusu var, gönderilmez · sorular sırayla gelir, her soruda önce düşünme süresi var.
   Yanında **60 saniyelik "Nasıl işliyor" videosu** (opsiyonel, altyazılı, TR/EN, Kademe bir kez
   üretir; şirkete özel değil). *Neden:* kısa bir eğitim videosu adayın performansını ve sürecin
   tutarlı olduğu algısını artırdı [43]; Google da süreç bilgisinin aday memnuniyetinde payı olduğunu
   söylüyor [30].
4. **Seni kim değerlendirecek:** "Cevaplarını ekipten en az 2 kişi, aynı sorular ve aynı ölçütlerle,
   birbirinden bağımsız değerlendirir. Yapay zekâ seni puanlamaz, sıralamaz ya da elemez; yalnızca
   videolarını yazıya döker." / "At least 2 people on the team review your answers independently,
   using the same questions and criteria. AI does not score, rank or reject you; it only
   transcribes your videos." (Sayı, alımın ayarından gelir.)
5. **Ne kaydediliyor** kartı (gözetim seviyesine göre, 7.2): her satır bir ikon + bir cümle.
   "Ayrıntılar" açılır: tam liste, saklama süreleri, alt işleyiciler.
6. **İhtiyacın olanlar:** sessiz bir yer, kamera ve mikrofon (video sorusu varsa), ~25 dk kesintisiz
   zaman, bilgisayar (K2, 6.15).
7. **"Bir ihtiyacın mı var?"** satırı (`Collapsible`):
   - **Ek süre, kendin seç:** "+%25" / "+%50" (`RadioGroup`). Neden sorulmaz, onay beklenmez, hemen
     uygulanır. Değerlendiriciler bunu görmez; alım sahibi yalnızca "süre uyarlaması uygulandı" görür,
     nedenini değil. / "Need more time? Pick +25% or +50%. We won't ask why, and reviewers won't see it."
     *Neden:* TestGorilla benzerini yapıyor (+%20 / +%50, neden işverene gitmez; doğrulanmadı) [18];
     kötüye kullanım riski var, ama engelli adaya gerekçe yazdırmak daha büyük adaletsizlik (çıkarım).
     Org ayarıyla "onaya bağlı" yapılabilir.
   - **Başka düzenleme** (video yerine yazılı, insan altyazısı, farklı zaman): "Talebin ekibe gider,
     değerlendirmen bundan etkilenmez." → `/rights?type=accommodation`. HireVue/ACLU vakası [15] tam
     olarak bu yolun yokluğundan doğdu.
8. Onay kutusu: "Kaydı ve cevaplarımın bu başvuru için değerlendirilmesini kabul ediyorum."
9. **"Başlayalım"** / "Let's begin". Kapalıyken: "Başlamak için onay kutusunu işaretle."
10. Alt satır: "Yarıda bırakırsan aynı linkten kaldığın yerden devam edersin." + veri hakları bağlantısı.

**Sorular burada görünmez** (eski karar korunur).

### 6.2 Bilgiler (`/info`)

Ad soyad (davetten dolu) · e-posta (dolu, değiştirilebilir) · telefon (opsiyonel) · şehir
(opsiyonel). Başka alan yok. Başlık: "Seni doğru kaydedelim." Doğrulama alanı terk edince,
düzeltirken anında temizlenir. Dolu buton "Devam et".

### 6.3 Cihaz kontrolü (`/check`)

Aktif satır genişler, tamamlananlar tek satıra iner ("Hazır"). Yalnızca gereken satırlar görünür:
1. Kamera (önizleme, "kayıt yapılmıyor" etiketi) · 2. Mikrofon (seviye çubuğu) · 3. Deneme kaydı
(5 sn, dinle, istediğin kadar tekrar; "Bu kayıt hiçbir yere gönderilmez") · 4. Bağlantı (bilgi
amaçlı, düşükse öneri) · 5+. Gözetim satırları (7. bölüm: tam ekran, ekran paylaşımı, yüz görünüyor).

İzin reddedildiyse satır içinde tarayıcıya ve işletim sistemine özel "Nasıl düzeltirim?" (adım adım,
ekran görüntüsüz kısa metin) + "Sorun bildir" (ekibe gider, aday "Bildirimin iletildi. Genelde aynı
gün dönülür." görür). Ses ya da video sorusu olmayan, gözetimsiz değerlendirmede bu ekran atlanır.

**Dolu buton:** "Hazırım, ısınma sorusuna geç". Kapalıyken satır adıyla neden: "Deneme kaydını dinle,
sonra ilerleyelim."

### 6.4 Isınma sorusu (`/practice`) (yeni)

Gerçek bir video sorusu ile aynı bileşen, nötr bir soru ("Bugün nasıl geçti, kısaca anlat."),
düşünme 15 sn, cevap 30 sn, sınırsız tekrar. Üstte: "Isınma · gönderilmez, kimse görmez".
Bitince kendi kaydını izler. Dolu buton: **"Hazırım, değerlendirmeye başla"**; metin bağlantısı
"Isınmayı atla". *Neden ve dürüst not:* HireVue ve Spark Hire pratik soru sunar [12] [7] ve adaylar bunu bekler.
Ama bir deneyde pratik fırsatı tek başına performansı değiştirmedi; kısa bir "nasıl işliyor"
eğitim videosu ise performansı ve algılanan tutarlılığı artırdı [43]. Bu yüzden ısınma bir cihaz
alışkanlığı aracıdır, asıl yatırım 6.1'deki 60 saniyelik anlatımdır.

### 6.5 Aşama girişi (`/stage/[n]`)

"Aşama 2 / 3 · Vaka çalışması" · "12 dakika · 2 soru" · 2-3 kural (yalnızca geçerli olanlar):
"Her soruda 30 sn düşünme süresi var", "Her cevap için 1 tekrar hakkın var", "Bu aşamada geri
dönülmez". **"Aşamayı başlat"**. Saatin bu tıklamayla başladığı açıkça yazar: "Süre, başlata
bastığında işlemeye başlar." Aşamalar arası mola serbest; son tarih bilgisi altta.

### 6.6 Video ve ses aktivitesi

Eski A10 akışı korunur; dört durum, aynı ekran:
1. **Düşünme:** soru büyük (22px), "Düşünme süresi 0:18", kamera kapalı, not alınabilir alan.
   Dolu buton **"Hazırım, kaydı başlat"**. **Esnek düşünme süresi (varsayılan):** süre dolunca kayıt
   kendiliğinden *başlamaz*; metin değişir: "Düşünme süren doldu. Hazır olduğunda başlat." Aşınan süre
   cevap süresinden düşmez ama aşama süresi işlemeye devam eder. Aşım değerlendiriciye puanlama
   ekranında gösterilmez, yalnızca Kayıt sekmesinde. Kurucuda "Katı" seçilirse eski davranış (süre
   dolunca kayıt başlar) ve bu adaya baştan yazılır. *Neden:* Willo düşünme süresini "korkuluk"
   olarak kullanıyor, aşan aday engellenmiyor [8]; daha uzun hazırlık ve tekrar çekim performansı
   artırdı, sahteciliği artırmadı [42].
2. **Kayıt:** kendi görüntüsü (sağ üst, küçük), yumuşak nabız atan "Kayıtta" noktası (kırmızı değil,
   ink), kalan cevap süresi (accent), altında ince yükleme çubuğu "Cevabın arka planda yükleniyor".
   Dolu buton **"Cevabı bitir"**.
3. **Gözden geçir** (tekrar hakkı varsa): kaydı izle, **"Bu cevabı kullan"** (dolu), "Tekrar çek
   (1 hakkın kaldı)" (outline). Kalan hak düşünme ve kayıt durumlarında da görünür [9]. Hak yoksa bu
   durum atlanır ve bu baştan söylenmiştir. **Varsayılan: 1 tekrar hakkı** (eski varsayılan "yok"
   idi; [42] nedeniyle değişti).
4. **Yükleniyor/bitti:** "Kaydedildi." 1 sn sonra sonraki soru.

Yazılı alternatif açıksa düşünme ekranında metin bağlantısı: "Kamerada konuşmak yerine yazmam
gerekiyor" → aynı soru yazılı açılır, ekibe işaretli gider (cezasız).

### 6.7 Yazılı aktivite

Soru kartı, geniş alan, karakter sayacı ("738 / 2 000"), "Kaydedildi · 4 sn önce", "Sekmeyi
kapatsan bile yazdığın kalır." Dolu buton "Cevabı gönder ve devam et" (zorunlu ve boşsa nedenli kapalı).

### 6.8 Seçmeli aktivite

Büyük tıklanabilir satırlar (`RadioGroup` / `Checkbox`), klavye 1-4. "Birden fazla seçebilirsin"
yalnızca çoklu seçimde. Doğru/yanlış geri bildirimi verilmez.

### 6.9 Dosya aktivitesi

Sürükle-bırak alanı + "Dosya seç", kabul edilen türler ve boyut baştan yazılı ("PDF, DOCX ya da
PNG · en fazla 20 MB"), yükleme çubuğu, "Değiştir". Mobilde doğrudan dosya seçici/kamera.
Yanlış tür: alanın altında "Bu dosya türü kabul edilmiyor. PDF, DOCX ya da PNG yükle."

### 6.10 Aşama arası

"Aşama 1 tamamlandı. Cevapların kaydedildi." + sonraki aşamanın girişi (6.5) aynı ekranda.
Son aşamadan önce: "Son aşama. Bitirince cevapların ekibe gider ve değiştirilemez."
Son aşamayı bitirmek **geri alınamaz tek eylem**: 8 sn undo şeridi ile geciktirilir ("Gönderiliyor
· Geri al 8"), sonra gönderilir (EXAM-UX kural 6 ile aynı).

### 6.11 Süre

Sunucu otoriter, duvar saati (eski karar korunur). Aşama süresi biterse açık soru otomatik
gönderilir, kayıt durur, ekran: "Süre doldu. O ana kadarki cevabın kaydedildi." + sonraki aşama
girişi. Asla "başarısız" dili yok.

### 6.12 Kopma ve yeniden yükleme

- **Çevrimdışı:** üstte sakin şerit: "Bağlantın koptu. Kaydın duruyor, bağlantı gelince
  yüklemeye devam ediyoruz. Süre işlemeye devam ediyor." Kayıt sürerken bağlantı giderse kayıt
  sürer, parçalar sırada bekler (yüklenemeyen parça sayısı bilgisi ekibe gider).
- **Yeniden yükleme kapısı:** "Kaldığın yerden devam ediyorsun. Bu aşamada 7:40 kaldı." +
  yeniden alınması gereken izinler satır satır + **"Devam et"**.
- Aynı link iki sekmede açılırsa ikinci sekme: "Değerlendirmen başka bir sekmede açık. Orada devam et."

### 6.13 Bitti (`/done`)

"Tamamlandı, teşekkürler Elif." · "3 aşamanın hepsi kaydedildi ve ekibe iletildi." ·
**ne olacak, ne zaman, kim**: "Cevaplarını en az 2 kişi değerlendirecek. 21 Eki'ye kadar sana
dönülecek. Sorun olursa: deniz@ornek.com" (tarih alımın geri dönüş sözünden) · "Bu linki sakla:
durumun burada da görünecek." Karar veren "Adaya durumu göster" dediğinde (3.10) bu sayfanın üstüne
durum satırı gelir: "Değerlendiriliyor" → "Bir sonraki adıma geçtin, ekip seninle iletişime geçecek"
ya da "Bu sefer ilerlemiyoruz. Zaman ayırdığın için teşekkürler." + varsa karar verenin kısa notu.
Talent Board: süreç sonunda durum ve uyum bilgisi alan adaylar belirgin biçimde daha olumlu [39] · "Kamera ve mikrofon
kapatıldı." (doğrulanmış) · **Kısa deneyim anketi** (opsiyonel, 1-5 + tek metin alanı:
"Bu deneyim nasıldı?"; "Cevabın değerlendirmeni etkilemez, ekip yalnızca toplu sonucu görür.").
Dolu buton: **"Görüşünü gönder"** (anket doluysa); anket kapalıysa dolu buton yok, sayfa kapanış
sayfasıdır. Veri hakları bağlantısı en altta.

### 6.14 Link sorunları

Her biri bir sonraki somut adımla:

| Durum | TR | EN | Eylem |
|---|---|---|---|
| Geçersiz | "Bu link geçerli değil. E-postadaki linkin tamamını kopyaladığından emin ol." | "This link is not valid..." | iletişim adresi |
| Henüz açılmadı | "Değerlendirmen 14 Eki 09:00'da açılacak." | "Your assessment opens on..." | takvime ekle (.ics) |
| Süresi doldu | "Bu linkin süresi 14 Eki'de doldu. Kaydettiklerin duruyor." | "This link expired on..." | **"Yeni link iste"** (ekibe gider) |
| Tamamlandı | "Bu değerlendirmeyi 12 Eki'de tamamladın." + geri dönüş tarihi | "You completed..." | yok (kapanış) |
| Tekrar isteği | "Ekip 2. aşamayı yeniden yapmanı istedi: <mesaj>." | "The team asked you to redo stage 2..." | **"Başlayalım"** |
| Alım kapandı | "Bu pozisyon için değerlendirme kapandı. İlgin için teşekkürler." | "This role is no longer..." | iletişim adresi |

### 6.15 Cihaz (yerine geçti: HIRING-VISUAL-FLOW 3.0, kullanıcı kararı K2, 2026-10-05)

İşe alım aday akışı gözetim seviyesinden bağımsız olarak **yalnızca bilgisayardan** yapılır.
Telefon ve tablet `DesktopOnlyScreen` görür: neden (dürüst, gözetim iddiası yok), linki kopyala,
isteğe bağlı "linki e-postama gönder" (sunucu ucu ve e-posta gönderimi gelince; K11 ile şimdilik
yok). Masaüstü düzeni 1280 ve 1440 için tasarlanır, 1024'te bozulmaz; 1024'ten dar bir masaüstü
penceresi engellenmez, tek sütuna iner ve "Pencereni büyüt" şeridi görür. Eski 6.15'in "telefonda
tamamen yapılabilir", "alt sabit dolu buton" ve "video dikey çerçeve" maddeleri geçersiz. Dokunma
hedefi ≥ 44px ve yazı ≥ 16px kuralları kalır (dokunmatik dizüstü ve erişilebilirlik için). Klavyeli
tablet de engellenir (K11).

## 7. İşe alımda gözetim

Altyapı sınav tarafıyla ortaktır (`docs/PROCTORING.md`, `src/lib/proctor/policy.ts`). İşe alımda
fark şu: burada kişinin geçimi söz konusu, aday çoğu zaman tek bir şirkete değil on şirkete
başvuruyor; öğrenci örnekleminde çevrim içi gözetimi mahremiyet ihlali sayanlar çoğunlukta [52] ve
adaylar asenkron video mülakata zaten daha soğuk bakıyor [41] (işe alım adayına genelleme benim
çıkarımım). Bu yüzden
varsayılan hafiftir ve her seviye adaya *tam olarak* ne yaptığını söyler.

### 7.1 Seviyeler (değerlendirme başına)

| Seviye | Ne açık | Cihaz | Ne zaman önerilir |
|---|---|---|---|
| **Kapalı** / Off | Yalnızca teknik kayıt (bağlantı, yükleme boşlukları, sayfa yenileme). Bunlar bütünlük değil, adalet içindir: kopma yaşayan adaya tekrar hakkı verebilmek için | Yalnızca bilgisayar (K2) | Video ağırlıklı tanışma değerlendirmeleri |
| **Temel** / Basic (**işe alım varsayılanı**) | + sekme/pencere değişimi, uzun metin yapıştırma (engellenmez, kaydedilir), ikinci sekme | Yalnızca bilgisayar (K2) | Yazılı cevap içeren her değerlendirme |
| **Standart** / Standard | + yazılı/seçmeli sorularda kamera kareleri (30 sn), yüz yok / birden fazla kişi / telefon sinyali, tam ekran, AI ikinci bakış | Yalnızca bilgisayar (K2) | Bilgi testi ya da çözüm üretme aşaması olan değerlendirmeler |
| **Sıkı** / Strict | + tüm ekran paylaşımı, ikinci ekran kontrolü, yalnızca Chrome/Edge, yapıştırma engeli | Yalnızca bilgisayar (K2) | Teknik test, sertifika benzeri yüksek riskli aşama |

- **Cihaz sütunu (K2, 2026-10-05):** işe alım aday akışı her seviyede yalnızca bilgisayardan yapılır
  (6.15, HIRING-VISUAL-FLOW 3.0); seviye cihazı değiştirmez.
- **Temel yeni bir preset'tir** (`policy.ts`'de yok, eklenmeli): kamera, tam ekran, ekran paylaşımı
  kapalı; `clipboardBlock: false`; olay kaydı açık.
- **İşe alımda otomatik sonlandırma yoktur, hiçbir seviyede.** Sınav tarafındaki "okul açarsa"
  seçeneği burada sunulmaz. *Neden:* değerlendirmeyi makine kararıyla bitirmek, istihdamla ilgili
  otomatik bir karardır (GDPR m.22 riski) ve EU AI Act'te işe alım sistemleri yüksek risklidir
  [47] [48]. Codility'nin kendi ifadesiyle bir işaret hile kanıtı değildir [23]; yüz algılamanın
  ışık ve cihaza göre farklı çalışabildiği iddiası mahkemeye bile taşındı [53]. Bakış ve ses sinyali
  yalnızca Sıkı'da ve düşük ağırlıkla.
- Gözetim, video cevap kaydı sırasında ayrıca kamera karesi almaz (video zaten kanıttır).
- Kurucuda seviye seçilince sağda **adayın göreceği metin** canlı görünür. Yönetici neyi açtığını
  adayın cümleleriyle okur.

### 7.2 Adaya dürüst anlatım (karşılamadaki "Ne kaydediliyor" kartı)

Kart başlığı seviyeye göre: "Bu değerlendirmede neler kaydediliyor" / "What this assessment
records". Satırlar yalnızca açık olanlar:

| Sinyal | TR | EN |
|---|---|---|
| Video cevap | "Video sorularında görüntün ve sesin kaydedilir." | "Your video answers are recorded with sound." |
| Teknik | "Bağlantı ve yükleme sorunları kaydedilir; kopma yaşarsan ekip sana yeniden hak verebilir." | "Connection and upload problems are logged so the team can give you another go if something breaks." |
| Sekme | "Değerlendirme sırasında başka sekmeye ya da uygulamaya geçersen bu an kaydedilir." | "If you switch to another tab or app during the assessment, that moment is noted." |
| Yapıştırma | "Uzun bir metni yapıştırırsan bu kaydedilir. Kendi notlarından yararlanabilirsin; ekip bunu bilir." | "Pasting a long block of text is noted..." |
| Kamera | "Yazılı sorularda kameradan belirli aralıklarla kare alınır." | "During written questions, your camera takes a still every 30 seconds." |
| Ekran | "Tüm ekranın paylaşılır; değerlendirme sırasında ekranından kareler alınır." | "Your whole screen is shared and stills are taken." |
| AI | "Bazı anlar yapay zekâ ile işaretlenebilir (ör. karede ikinci bir kişi). Duygu, kişilik ya da yüz tanıma yapılmaz." | "Some moments may be flagged by AI (e.g. a second person in frame). No emotion, personality or face recognition." |

Her kartın son satırı sabittir: **"Hiçbir kayıt seni otomatik olarak elemez. İşaretlenen anlara
bir insan bakar ve sana sormadan aleyhine karar verilmez."** / "Nothing here rejects you
automatically. A person looks at anything flagged, and nothing counts against you without being
checked." Kamera kareleri ve ekran kareleri için saklama süresi yazılı ("90 gün sonra silinir").

Değerlendirme sırasında geri bildirim sınav tarafındaki (EXAM-UX 5.6) sakin şerit desenini kullanır;
işe alımda yalnızca kurtarılabilir durumlar şerit alır ("Tam ekrana dön"); "bu an kaydedildi"
bilgi şeritleri işe alımda **gösterilmez**. *Neden:* ne kaydedildiği baştan söylendi; her kaydı
anında yüzüne söylemek adayı gerer (çıkarım). Asenkron video mülakat deneyinde uyarıların ölçülebilir
bir etkisi bulunmadı [42] (o çalışmadaki uyarı sahteciliğe karşıydı; buraya taşımak çıkarım).
Canditech'in tersini yaptığını biliyoruz [21]; sınav tarafı da bilgi şeridi gösteriyor. İşe alımda
ilk pilotta aday anketinde gözetim yorumları izlenir, gerekirse açılır.

### 7.3 İnceleyiciye: puanı etkilemeden

1. **Puanlamadan önce gizli.** Değerlendirici kendi değerlendirmesini gönderene kadar bütünlük
   özeti, bayrak sayısı ve kareler sunucudan *gönderilmez* (yalnızca istemcide gizlemek yetmez).
   "Şimdi göster" ile açılabilir; açılırsa değerlendirmesinde ve denetim kaydında "puanlamadan önce
   bütünlüğü gördü" yazar. *Neden:* bütünlük sorusu ile cevap kalitesi sorusu ayrı sorulardır;
   "şüpheli" bilgisi önce gelirse cevaplar daha sert puanlanır (çıpalama ve doğrulama yanlılığı,
   bu bir çıkarım; işe alım bağlamında doğrudan çalışma bulmadım).
2. **Karar verene açık.** Karar rayında tek satır: dot + metin ("Belirgin bir şey yok" /
   "İncelemeniz önerilir" / "Dikkatle inceleyin") + kapsam ("Kamera %98 · ekran paylaşımı yok ·
   ikinci ekran doğrulanamadı"). Kırmızı yok; "Dikkatle inceleyin" yalnızca kalın metin.
3. **Bütünlük sekmesi** (aday detayı > Kayıt): sınav tarafındaki zaman ekseni + "an" kartları
   yeniden kullanılır (tür, saat, süre, kareler, AI'nın gördüğü olgu metni, "Onayla / Yoksay").
   Kelime seçimi: "an", "işaret"; asla "ihlal" ya da "hile".
4. **Bütünlük kararı ayrı ve gerekçeli:** "Geçerli" · "Adaya sor" · "Tekrar iste" · "Geçersiz say";
   varsayılan "Geçerli". "Adaya sor" kopyalanabilir, suçlamasız bir mesaj taslağı verir ("Değerlendirme
   sırasında bağlantında/ekranında bir kesinti gördük, ne olduğunu kısaca anlatır mısın?"). Codility ve
   TestGorilla da işareti bir sohbet ya da yeniden test başlangıcı olarak öneriyor [23] [16].
   "Geçersiz say" gerekçe ister ve karar rayında "Devam etmiyor" kararının gerekçe listesine
   "Bütünlük sorusu" olarak düşer; puanları silmez.
   Kademe sınıfı adları (TestGorilla'nın üç kademesine benzer [17]) ve her kademenin altında sabit satır:
   "Bu bir kanıt değil, bakılması gereken anların özeti." / "This is not proof, it is a summary of
   moments worth a look." 
5. **Temel seviyede** bütünlük satırı yalnızca sayıdır ("Değerlendirme sırasında 3 kez sekme
   değişti · 1 uzun yapıştırma") ve yapıştırılan metnin hangi cevapta olduğunu cevabın yanında
   küçük bir not olarak gösterir ("Bu cevabın 412 karakteri yapıştırıldı."). Bu not da gönderim
   sonrasına kadar gizlidir.

## 8. Görsel yön: "yumuşak"

> **Plan sırasında düzeltilenler (2026-10-04):** (1) shadcn'in `--muted` değişkeni bir zemin
> rengidir, Kademe'nin `text-muted`'ı gri metindir; shadcn'inki `muted-surface` adıyla açılır.
> (2) Geri alma için Sonner yerine mevcut `UndoStrip` kalır (8 sn, sunucu eylemi sözleşmesi).
> (3) Sınav ekranları yeni köşe ve gölgelere kendiliğinden geçmez; ekran ekran taşınır.
> Ayrıntı: `docs/superpowers/plans/2026-10-04-ui-foundation-shadcn.md`.

"Yumuşak" bu üründe dört şey demek: bol boşluk, yuvarlak ama gevşek olmayan köşeler, sıcak
nötrler ve alarm renginin yokluğu. Marka aynı: accent `#0E6A57`, font Figtree. RULES.md'nin
kuralları (tek dolu buton, nedenli kapalı buton, dot+metin durum, onay diyaloğu yok, gölge yalnızca
yapışkan panel ve katmanda) aynen geçerli.

### 8.1 shadcn/ui kurulum kararları

- shadcn bileşenleri `src/components/ui/` altına kopyalanır; mevcut `button`, `card`, `status-dot`,
  `undo-strip`, `inline-link`, `avatar` shadcn karşılıklarıyla birleştirilir (aynı dosya adı,
  `DisabledReason` korunur).
- **Ad çakışması (önemli):** shadcn'in `--accent` değişkeni "hover zemini" demek; Kademe'de
  `accent` marka rengi ve sınav kodu `bg-accent`, `text-accent` kullanıyor. Karar: Kademe
  `--color-accent` marka olarak **kalır**; kopyalanan shadcn bileşenlerindeki `accent` sınıfları
  kurulumda `subtle` olarak yeniden adlandırılır (`bg-accent` → `bg-subtle`,
  `text-accent-foreground` → `text-subtle-foreground`). Böylece sınav ekranları bozulmaz.
- Marka rengi shadcn tarafında `--primary`'dir. `--primary` = `--color-accent` (tek kaynak).
- Kullanılmayacak shadcn kalıpları: `Badge` durum için (dot+metin kuralı), `AlertDialog` ("emin
  misin" yok), `Tooltip` içinde kapalı buton nedeni (neden butonun yanında yazılır), `Chart`
  (gerekli tek görsel `DotStrip`, düz SVG).
- `Kbd`, `Empty`, `Field`, `Spinner` shadcn'e 2025 sonunda eklenen bileşenlerdir; kurulumda
  registry'de olduğu doğrulanmalı, yoksa küçük yerel bileşen yazılır (bunu canlı doğrulamadım).

### 8.2 Token eşlemesi

| shadcn değişkeni | Değer | Kademe adı / not |
|---|---|---|
| `--background` | `#F6F5F2` | `canvas` (panel zemini) |
| `--foreground` | `#131311` | `ink` |
| `--card`, `--popover` | `#FFFFFF` | `surface` |
| `--card-foreground`, `--popover-foreground` | `#131311` | |
| `--primary` | `#0E6A57` | `accent` (yalnızca dolu buton, aktif durum, sayaç) |
| `--primary-foreground` | `#FFFFFF` | kontrast 6,4:1 (AA) |
| `--secondary` | `#F1F0EC` | outline/ikincil zemin |
| `--secondary-foreground` | `#131311` | |
| `--muted` | `#F1F0EC` | |
| `--muted-foreground` | `#6E6E69` | `muted`; beyaz üstünde 5,1:1 |
| `--subtle` (yeniden adlandırılan shadcn `--accent`) | `#F1F0EC` | menü/satır hover zemini, nötr |
| `--brand-soft` (yeni) | `#EEF6F3` | aktif nav ve seçili satır zemini (eski `accent-soft` biraz koyulaştırıldı ki görünsün) |
| `--destructive` | `#8C2F2A` | yalnızca form doğrulama metni ve geri alınamaz silme; **gözetimde asla** |
| `--border` | `#E7E7E4` | `line` |
| `--input` | `#D8D8D3` | `line-strong` (alan sınırı bulunabilir olsun) |
| `--ring` | `#0E6A57` | odak halkası, 2px + 2px boşluk |
| `--sidebar` | `#FBFBF9` | `paper` |
| `--radius` | `0.75rem` | aşağıda |

Kontrast oranları hesapla verildi, tarayıcıda ölçülmedi; uygulamada axe ile doğrulanmalı.

Durum noktaları (değişmez): `neutral` `#A8A8A3`, `active` `#0E6A57`, `warn` ink + kalın metin,
`done` `#6E6E69`. Amber yok, trafik ışığı yok.

### 8.3 Köşe, gölge, boşluk

- **Köşe:** RULES.md'deki 6/10/14 ölçeği **8/12/16 + tam yuvarlak** olur (`--radius: 12px`;
  `sm` 8 = giriş alanı içi küçük öğeler, `md` 10 = buton ve alan, `lg` 12 = kart, `xl` 16 = aday
  tarafı ana kartı ve `Sheet` kenarı, `full` = gözlem çipi, durum noktası, avatar). *Neden:*
  "yumuşak" isteğinin en ucuz ve en görünür karşılığı; sınav ekranları token'dan okuduğu için
  kendiliğinden uyar. RULES.md madde 8 bu kararla güncellenmeli.
- **Gölge** (yalnızca yapışkan panel ve katman): `--shadow-panel: 0 1px 2px rgb(19 19 17 / .04),
  0 4px 16px rgb(19 19 17 / .05)`; `--shadow-overlay: 0 12px 40px rgb(19 19 17 / .12)`. Kartlar
  gölgesiz, 1px `border`.
- **Boşluk** (4px taban): panel sayfa kenarı 32, bölüm arası 32, kart içi 20 (panel) / 28 (aday),
  tablo satırı 52px yükseklik, form alanları arası 16. Aday tarafında dikey ritim 24/40.
- **Yoğunluk:** tek yoğunluk. "Kompakt mod" yok; tablo 52px satırla 1080p ekranda ~12 satır gösterir,
  bu yeterli.

### 8.4 Tipografi (Figtree 400/500/600, 700 yalnızca büyük sayı)

| Rol | Panel | Aday |
|---|---|---|
| Sayfa başlığı | 26/32, 600, -0.01em | 28/36, 600 |
| Bölüm başlığı | 16/24, 600 | 20/28, 600 |
| Soru metni | - | 22/32, 500 (video), 18/28 (yazılı) |
| Gövde | 14/22, 400 | 16/26, 400 |
| Meta, etiket | 13/20, 400, `muted` | 14/22 |
| Küçük | 12/16 | 13/20 |
| Büyük sayı (puan, sayaç) | 28/32, 700, `tnum` | 32/36, 600, `tnum` |

Her puan, sayaç, tarih ve sayı `tnum`. Türkçe ondalık virgül ("3,5").

### 8.5 Hareket

| Ne | Süre | Eğri |
|---|---|---|
| Hover, basma | 120 ms | `ease-out` |
| Aç/kapa (Collapsible, satır genişleme) | 180 ms | `cubic-bezier(.2,.8,.2,1)` |
| Sheet, Dialog | 240 ms giriş / 180 ms çıkış | aynı |
| "Kaydedildi" işareti | 160 ms solma | `ease-out` |
| Kayıt noktası | 1,6 sn yumuşak opaklık nabzı (1 → .45) | `ease-in-out` |

Kurallar: zıplama, yay (spring), sallama yok; sayaçta animasyon yok (yalnızca rakam değişir);
`prefers-reduced-motion` açıkken yalnızca opaklık geçişi kalır, nabız durur. Sayfa geçişlerinde
animasyon yok (hız hissi > süs).

### 8.6 İkon ve görsel

`lucide-react` (zaten bağımlılık), 16/20px, 1.5 çizgi. İllüstrasyon yok; boş durumlar metin + tek
eylemdir. Aday tarafında şirket logosu varsa tek görsel odur.

### 8.7 Erişilebilirlik

WCAG 2.2 AA hedefi. Odak her yerde görünür (accent halka). İnceleme ekranı klavyeyle baştan sona
kullanılabilir. Video cevaplarına transkriptten altyazı. Adayda tüm kontroller ≥ 44px, ekran okuyucu
için sayaç `aria-live="polite"` ve yalnızca dakika başı duyurulur (her saniye değil). Renk tek başına
anlam taşımaz (dot her zaman metinle).

## 9. Kapsam dışı (bilerek yapılmayanlar)

| Yapılmıyor | Neden |
|---|---|
| AI ile aday puanlama, puan önerisi, sıralama, kısa liste | 3.9. Yüksek risk sınıfı [47], aday güveni [44], insan puanını çıpalama |
| Videodan/sesten duygu, kişilik, özgüven, "kültür uyumu" çıkarımı | AB'de yasak [45]; HireVue bile bıraktı [14] |
| Otomatik eleme ve gözetim kaynaklı otomatik sonlandırma | 7.1; işaretler yanlış pozitif üretir [23], ışık ve cihaz farkı adaleti bozabilir [53] |
| Demografi toplama ve 4/5 etki analizi | İsimden tahmin güvenilmez [35]; gönüllü beyan modülü ayrı hukuki inceleme ister; küçük örneklemde 4/5 yanıltır [34]. v2 adayı: gönüllü beyan, yalnızca toplu, minimum grup büyüklüğüyle |
| Bütüncül "Strong Yes / No" öneri skalası | Yetkinlik puanlarını atlatır; mekanik birleştirme daha iyi [33] |
| E-posta gönderimi, otomatik hatırlatma | Altyapı yok (STATUS.md); mesaj metni kopyalanır, `message_outbox`'a yazılır |
| ATS entegrasyonu, aday havuzu, iş ilanı yayınlama | Kademe değerlendirme yapar, başvuru toplamaz |
| Canlı (eşzamanlı) mülakat ve takvim | Ayrı ürün; Metaview/Zoom alanı |
| Kod yazma ortamı ve kod benzerlik taraması | Codility alanı; derin yatırım |
| Hazır test kütüphanesi (TestGorilla tarzı psikometrik testler) | Geçerlilik çalışması ister; bizim gücümüz şirkete özel yapılandırılmış soru |
| Panel içinde "kompakt mod", karanlık tema | Tek yoğunluk yeterli; tokenlar karanlık temaya hazır, v1'de yok |
| Telefonda puanlama | 5.14; dikkatli değerlendirme ekran ister |
| Değerlendirici eğitimi modülü (tam çerçeve referans eğitimi) | v1'de yalnızca "ilk inceleme kartı"; tam eğitim örnek cevap kütüphanesi ister [32] |
| Pozisyon analizi ve performans çözümlerinin tasarımı | Kullanıcı kapsamı; yalnızca ortak varlıklar onlara hazır bırakıldı (4.2) |
| Şablon pazar yeri, birden çok org (SaaS) | Tek org varsayımı sürüyor (`org_id` şemada) |
| Adaya kişisel geri bildirim raporu (Vervoe/HireVue tarzı) | v1'de karar veren isterse kısa insan notu; otomatik rapor AI'nın adayı değerlendirmesi olurdu |

## 10. Açık sorular: kararlar (2026-10-04)

Kullanıcı ayrıntı kararlarını devretti ("hangisi mantıklıysa onu yap"); son benchmark turunda
hepsi yeniden açılabilir.

1. Karar için en az 2 değerlendirme: **kalır**, karar veren gerekçe yazarak aşabilir.
2. Adayın seçtiği ek süre (+%25 / +%50): **onaysız** uygulanır.
3. Aday tarafında hitap: **"sen"** (eski işe alım metinleriyle tutarlı). Sınav tarafı "siz" kalır.
4. Köşe ölçeği 8/12/16: **kabul**, iki çözümde de geçerli; `RULES.md` UI temeli adımında güncellenir.

## 11. Kabul kontrol listesi (her ekran)

- [ ] Tek dolu buton, etiketi fiil.
- [ ] Kapalı buton nedenini yanında söylüyor.
- [ ] Boş, yükleme, hata durumu tasarlı; boş durum sonraki eylemi gösteriyor.
- [ ] Accent yalnızca CTA / aktif / sayaç.
- [ ] Durum dot + metin.
- [ ] Bağımsızlık kuralı bu ekranın verisinde uygulanıyor (sunucu).
- [ ] AI çıktısı varsa etiketli ve puan/karar alanında değil.
- [ ] TR ve EN metin anahtarları eşit.
- [ ] Em-dash yok.

## Kaynaklar

Erişim: 2026-10. "(doğrulanmadı)": sayfa 403 döndü, iddia yalnızca resmî URL'nin arama özetinden.
Satıcı rakamları satıcının kendi beyanıdır.

1. Greenhouse, "How scorecard peeking can create bias in hiring". https://www.greenhouse.com/guidance/how-scorecard-peeking-can-create-bias-in-hiring
2. Greenhouse Support, "Scorecard visibility options". https://support.greenhouse.io/hc/en-us/articles/16187220652059-Scorecard-visibility-options
3. Ashby, Recruiting ATS (Feedback Blinding). https://www.ashbyhq.com/platform/recruiting/ats
4. Ashby, "More feedback visibility options". https://ashbyhq.com/product-updates/more-feedback-visibility-options
5. Ashby, "Form sections, question descriptions and scores"; Ashby Docs, "Candidate reviews". https://www.ashbyhq.com/product-updates/form-sections-question-descriptions-and-scores · https://docs.ashbyhq.com/candidate-reviews
6. Spark Hire Support, "5-star ratings on interviews" (doğrulanmadı). https://support.sparkhire.com/hc/en-us/articles/234664988-5-star-ratings-on-interviews
7. Spark Hire, "How a Spark Hire one-way video interview works"; "Set think time limits" (doğrulanmadı). https://candidates.sparkhire.com/hc/en-us/articles/48167885321755-How-a-Spark-Hire-one-way-video-interview-works · https://support.sparkhire.com/hc/en-us/articles/234665248-Set-think-time-limits-for-One-Way-Interview-questions
8. Willo Support, "Thinking time". https://support.willo.video/article/118-thinking-time
9. Willo Support, "Change the number of retakes". https://support.willo.video/article/14-change-the-number-of-retakes
10. Willo, ana sayfa ve Intelligence. https://www.willo.video/ · https://www.willo.video/intelligence
11. Hireflix, ana sayfa ve "Tailor the interview". https://hireflix.com/en · https://help.hireflix.com/article/g5fsqgumcw-tailor-the-interview
12. HireVue, "How to take a HireVue interview". https://www.hirevue.com/blog/candidates/how-to-take-a-hirevue-interview
13. HireVue, 2025 AI Explainability Statement. https://www.hirevue.com/wp-content/uploads/2025/10/HV_2025_AI-Explainability-Statement.pdf
14. AI Incident Database, olay 95 (HireVue yüz analizi). https://incidentdatabase.ai/cite/95/
15. HR Dive, ACLU v. Intuit/HireVue (2025). https://www.hrdive.com/news/ai-intuit-hirevue-deaf-indigenous-employee-discrimination-aclu/743273/
16. TestGorilla, "Holistic recruitment beats cheating detection". https://www.testgorilla.com/blog/holistic-recruitment-beats-cheating-detection/
17. TestGorilla Support, "Understanding anti-cheating measures and behavior tiers" (doğrulanmadı). https://support.testgorilla.com/hc/en-us/articles/9028797639451-Understanding-anti-cheating-measures-and-behavior-tiers
18. TestGorilla Candidates, "Accessibility and accommodations for assessments" (doğrulanmadı). https://candidates.testgorilla.com/hc/en-us/articles/28302003990427-Accessibility-and-accommodations-for-assessments
19. Vervoe, Candidate feedback. https://vervoe.com/features/candidate-feedback/
20. Vervoe, AFL vaka çalışması (satıcı verisi). https://vervoe.com/customers/afl/
21. Canditech Help, "Proctoring features". https://helpcenter.canditech.io/en/articles/8679988-proctoring-features
22. Canditech Help, "Reviewing proctoring insights". https://helpcenter.canditech.io/en/articles/8691663-reviewing-proctoring-insights
23. Codility, "Enhanced fraud prevention in CodeCheck with IP check". https://www.codility.com/blog/enhanced-fraud-prevention-in-codecheck-with-ip-check/
24. Codility Support, erişilebilirlik (doğrulanmadı). https://support.codility.com/hc/en-us/articles/360062264373-Is-the-Codility-testing-environment-accessible-to-test-takers-with-disabilities
25. Greenhouse Support, "Anonymize take-home tests". https://support.greenhouse.io/hc/en-us/articles/360017706471-Anonymize-take-home-tests
26. Metaview Support, Ashby entegrasyonu. https://support.metaview.ai/integrations/ats-integrations/ashby
27. Sackett, Zhang, Berry, Lievens (2022), JAP 107(11), özet. https://www.managementcraft.co/sources/sackett-et-al-personnel-selection
28. US OPM, Structured Interviews guide (2008). https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/guide.pdf
29. Google re:Work, "A guide to structured interviewing". https://rework.withgoogle.com/intl/en/guides/a-guide-to-structured-interviewing-for-better-hiring-practices
30. Google re:Work, "How to create a positive experience for candidates". https://rework.withgoogle.com/intl/en/guides/how-to-create-a-positive-experience-for-candidates
31. Huffcutt, Culbertson, Weyhrauch (2013), IJSA. https://onlinelibrary.wiley.com/doi/abs/10.1111/ijsa.12036
32. Roch, Woehr ve ark., rater training meta-analizi (özet). https://www.semanticscholar.org/paper/Rater-training-revisited:-An-updated-meta-analytic-Roch-Woehr/deee6cdacaedceb2c6630822f42f82da35b62198
33. Kuncel, Klieger, Connelly, Ones (2013), mechanical vs clinical combination. https://experts.umn.edu/en/publications/mechanical-versus-clinical-data-combination-in-selection-and-admi/
34. 29 CFR 1607.4(D), four-fifths rule. https://www.law.cornell.edu/cfr/text/29/1607.4
35. UK ICO, AI in recruitment outcomes report (Kasım 2024). https://ico.org.uk/media2/migrated/4031620/ai-in-recruitment-outcomes-report.pdf
36. J-PAL, "Unintended effects of anonymous resumes". https://www.povertyactionlab.org/case-study/unintended-effects-anonymous-resumes
37. BETA (Avustralya), "Going blind to see more clearly". https://behaviouraleconomics.pmc.gov.au/projects/going-blind-see-more-clearly-unconscious-bias-australian-public-service-aps-shortlisting
38. Reason, Gelman'ın orkestra çalışması eleştirisi. https://reason.com/2019/10/22/orchestra-study-blind-auditions-gelman/
39. Talent Board, 2023 Global CandE Benchmark Research Report. https://api.eremedia.com/wp-content/uploads/2024/02/2023-Global-CandE-Benchmark-Research-Report_FINAL.pdf
40. Modern Hire, applicant dropout araştırması (basın bülteni). https://www.prnewswire.com/news-releases/modern-hire-reveals-new-research-on-applicant-dropout-and-assessment-completion-rates-301192559.html
41. Lukacik, Bourdage, Roulin (2022), asenkron video mülakat incelemesi. https://ouci.dntb.gov.ua/en/works/loxZQmw9/
42. Lukacik & Bourdage (2025), IJSA. https://onlinelibrary.wiley.com/doi/10.1111/ijsa.12511
43. Roulin, Pham, Bourdage (2023), JVB. https://www.sciencedirect.com/science/article/abs/pii/S0001879123000726
44. Pew Research Center (2023), "Americans' views on use of AI in hiring". https://www.pewresearch.org/internet/2023/04/20/americans-views-on-use-of-ai-in-hiring/
45. Future of Privacy Forum, AI Act Art. 5(1)(f) iş yerinde duygu tanıma. https://fpf.org/blog/red-lines-under-eu-ai-act-unpacking-the-prohibition-of-emotion-recognition-in-the-workplace-and-education-institutions/
46. AI Act Service Desk, Madde 5 yasakları (2 Şubat 2025). https://ai-act-service-desk.ec.europa.eu/en/ai-act/faq/what-systems-are-prohibited-under-article-5-ai-act-eg-social-scoring-emotion-recognition
47. EU AI Act, Ek III. https://artificialintelligenceact.eu/annex/3/
48. K&L Gates, "EU Digital Omnibus on AI enters into force" (2026). https://www.klgates.com/EU-Digital-Omnibus-on-AI-Enters-Into-Force-7-31-2026
49. Simonsohn & Gino (2013), narrow bracketing. https://www.hbs.edu/faculty/Pages/item.aspx?num=42472
50. Bohnet, van Geen, Bazerman (2016), joint vs separate evaluation. https://scholar.harvard.edu/iris_bohnet/publications/when-performance-trumps-gender-bias-joint-versus-separate-evaluation
51. Bohnet, "How to take the bias out of interviews" (doğrulanmadı). https://irisbohnet.scholars.harvard.edu/sites/g/files/omnuum3081/files/iris_bohnet/files/how_to_take_the_bias_out_of_interviews.pdf
52. Online proctoring algıları (öğrenci örneklemi, arXiv 2106.05917; özet). https://arxiv.org/pdf/2106.05917
53. NL Times (2023), VU Amsterdam Proctorio kararı. https://nltimes.nl/2023/10/17/anti-cheating-software-biased-vu-students-skin-color-ruling
54. Illinois Artificial Intelligence Video Interview Act. https://www.ilga.gov/ftp/ILCS/Ch%200820/Act%200042/082000420K5.html
55. Greenhouse Support, "Interviewer guide: How to use interview kits". https://support.greenhouse.io/hc/en-us/articles/115002226826-Interviewer-guide-How-to-use-interview-kits
