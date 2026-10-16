# Renk konumlandırma incelemesi: psikoloji, toplum, kültür

Hazırlayan: Sally (UX tasarımcı) | Tarih: 2026-10-16 | Konu: "Kolay = camgöbeği, Orta = sarı, Zor = kırmızı" doğru mu, ve renkler başka nerede nasıl durmalı?

## Kısa cevap

- **Zor = kırmızı yanlış.** Zorluk bir sınav ayarı; kırmızı ise "tehlike, hata, dur, başarısız" diye okunur. Öğretmenin seçimini de, öğrencinin adının yanındaki etiketi de yanlış yönde yüklüyor.
- **Zorluğu renk değil, basamak simgesi + kelime taşısın** (tasarımda zaten var). Önerim: nötr krem çip. Alternatif: tek renk, üç ton.
- **Kırmızı markada kalsın** (işaret, maskot, konfeti) ve soru ekranında tek bir anlam taşısın: KAYIT noktası.
- **Mevcut doğru seçimler korunsun:** uyarı = sarı (kırmızı değil), ana düğme = camgöbeği + mürekkep yazı, ilerleme = koyu camgöbeği.
- **Seviye ve sonuç ekranlarında kırmızı ve sarı yok.** "Doğrulanamadı" bile nötr kalır.

## Neyi doğruladım, neyi doğrulamadım

Etiketler: **[K]** araştırma bulgusu, **[G]** tasarım geleneği (kanıt değil), **[Ç]** benim çıkarımım (emin değilim, test edilmedi).

Doğruladım (kod ve dosya okuyarak):
- Öğrenci metinlerinde (`candidate.tr.json`) "Zorluk" ayarını anlatan bir cümle yok. Geçenler soruları anlatıyor: "Sorular cevaplarınıza göre zorlaşır ya da kolaylaşır", "kolaydan zora". Öğretmenin seçtiği Kolay/Orta/Zor öğrenciye gösterilmiyor.
- `src/lib/candidate-safe.ts` `difficulty` alanını öğrenci yanıtlarından zaten sıyırıyor.
- Öğrenci sonuç sayfası bugün "doğrulanamadı" cümlesini nötr gri-mürekkep metinle yazıyor (`Finished.tsx:173`). Yeniden tasarımda bu bozulmamalı.
- Mockup'ta (`direction-sicak-yumusak.html`) Elif Yılmaz satırındaki "Kolay" çipi sarı (Orta) zeminle çizilmiş (`zc o`). Yani yalnız renge dayanan eşleme tasarımcının elinde bile karışıyor.
- Kodda "Zorluk" iki ayrı şey: bankadaki soru etiketi (Kolay/Orta/Zor, seviye içi) ve davetteki seviye kaydırma ("bir seviye aşağı/yukarı"). Mockup ikisini "seviyenin zor ucu" diye birleştiriyor. Bu inceleme için fark etmiyor: ikisi de yalnız öğretmen tarafında.

Yapmadım: kullanıcı testi; hiring ekranlarının kodunu okumak (orayı ilke düzeyinde yazdım); Türk lise/üniversite öğrencilerinde renk-başarı çalışması aramak (bildiğim bir tane yok, uydurmuyorum).

## 1. Psikoloji

**Kırmızı ve başarı bağlamı.**
- [K] Elliot, Maier ve arkadaşlarının çalışmaları (2007, *J. Exp. Psychol: General*; özet: Elliot & Maier 2014, *Annual Review of Psychology*): sınav benzeri görevden hemen önce kırmızıyı kısa süre görmek performansı düşürdü; yazarlar bunu kırmızının başarı bağlamında "kaçınma" motivasyonunu tetiklemesiyle açıklıyor.
- [K] Aynı alanda Mehta & Zhu (2009, *Science*): kırmızı ayrıntı odaklı görevlerde iyi, mavi yaratıcı görevlerde iyi. Yani kırmızı "her zaman kötü" değil; etki bağlama bağlı.
- Dürüst sınır: etkiler küçük, çoğu laboratuvarda ve ağırlıkla Batılı üniversite örneklemleriyle bulunmuş, renk psikolojisinde tekrarlanabilirlik tartışması var. Bunu kesin kural değil, **ihtiyatlı eğilim** olarak okuyun. Burada asıl dayanağım araştırma değil, aşağıdaki öğrenilmiş çağrışımlar.
- [G] Kırmızı = hata / yasak / dur çağrışımı bağlamdan öğrenilir (kırmızı kalem, hata kutusu, yasak levhası). Sınav sırasında kameraya ve ekran kaydına maruz kalan bir öğrenci için her ek tehdit işareti toplam kaygıya eklenir.

**Sarı.**
- [G] Dikkat / uyarı rengi (trafik ışığı sarısı, tehlike bantları). "Dikkat et" der ama "reddedildin" demez. En parlak (yüksek parlaklıklı) tondur; geniş alanda yorucu, küçük alanda dikkat çekicidir.

**Camgöbeği / mavi.**
- [G] Soğuk tonlar ve mavi ailesi genelde sakin, güvenilir okunur; mavi birçok ankette en sevilen renk çıkar (Palmer & Schloss 2010, tercih çalışmaları).
- [K] Önemli nüans: Valdez & Mehrabian (1994) duygusal tepkide tondan çok **doygunluk ve parlaklığın** belirleyici olduğunu bulmuş. Logo camgöbeği (#0BBFDF) çok doygun ve parlak; küçük alanda (düğme) iyi, geniş alanda uyarıcı. Mevcut kural zaten doğru: büyük yüzeyler nötr/soft, doygun renk yalnız düğmede.

**Sıralı veri nasıl renklenir.**
- [G] Kartografi ve veri görselleştirmede (ör. ColorBrewer) sıralı kategoriler **tek renk, artan koyuluk** ile gösterilir; farklı tonlar (camgöbeği, sarı, kırmızı) sırasız kategori içindir ve her tonun kendi duygu yükü vardır. Zorluk sıralı veridir ve zaten 1/2/3 basamak simgesi sırayı taşıyor; ton hiçbir bilgi eklemiyor, yalnız değer yükü ekliyor.
- [G] Zorluk-renk eşlemesi evrensel değil: kayak pistlerinde bile Avrupa ve Kuzey Amerika farklı renk sırası kullanır. Yani kimse "kırmızı = en zor" diye öğrenmiş değil; yeşil-sarı-kırmızı trafik ışığı okumasını borç alıyoruz, o da "git / dikkat / dur" der.

## 2. Türkiye'de sosyoloji ve kültür

Hepsi [G] veya [Ç] düzeyinde; kaynak göstermiyorum.

**Kırmızı (al): iki yüzlü renk.**
- Olumlu, hatta kutsal yük: al bayrak, ulusal gurur, bayram, düğün (gelinin kırmızı kuşağı). Bu yüzden kırmızıyı "tehlike" olarak kullanmak ve bir "bayrak" simgesini kırmızı yapmak Türkiye'de ekstra yüklü (bayrak simgesi + kırmızı = ulusal bayrak; gençlerde İngilizce "red flag" kalıbı da yaygın sanırım [Ç]).
- Olumsuz yük okulda en güçlü: **kırmızı kalem** (öğretmenin düzeltmesi), karnede **kırık / zayıf not** (kırmızı yazılır diye biliyorum, e-karne için doğrulamadım), **kırmızı kart** (futbol), yasak ve dur levhaları.

**Sarı.**
- **Sarı kart** = "uyarıldın ama oyundasın". Gözetim uyarısı için tam doğru metafor: yarışmaya devam ediyorsun. Kırmızı kart ise "oyundan atıldın" demek; bu yüzden uyarıyı kırmızıya kaydırmak, öğrenciye "atıldım" sinyali verir.
- Trafik ışığı sarısı da "dikkat". Olumsuz yan çağrışım: "sarardı" (korkudan/hastalıktan) [Ç]; küçük alanda sorun değil.

**Mavi / turkuaz.**
- Nazar boncuğu (koruma, kötülükten uzak), deniz ve "Turkuaz Sahil" (tatil, ferahlık). "Turquoise" kelimesi de Fransızca "Türk" kökenli. Turkuaz Türkiye'de ağırlıklı olumlu: sakin, güvenli, pozitif. Logo camgöbeği buna yakın; ana düğmede kullanmak kültürel olarak da sağlam.

**Trafik ışığı okuması.**
- Camgöbeği-sarı-kırmızı yeşil kullanmıyor ama sarı ve kırmızı yine "dikkat" ve "dur" okunur; camgöbeği "sakin / güvenli" okunur. Sonuç: Kolay = güvenli, Orta = dikkat, Zor = tehlike. Bu, sınav ayarına uymayan bir değer yargısı.

**Sınav kültürü.**
- YKS/LGS gibi merkezi, yüksek riskli sınavlar Türkiye'de yaygın bir kaygı kaynağı. Kademe yerleştirme sınavı daha düşük riskli, ama öğrenci "sınav haliyle" geliyor ve üstüne kamera + ekran kaydı var. [Ç] Her ek tehdit işareti bu hazır gerilime biner.

**Takım renkleri (düşük risk).**
- [Ç] Sarı + kırmızı yan yana büyük alan, bazı kullanıcılarda bir futbol takımını çağrıştırabilir. Marka zaten kırmızı/sarı/camgöbeği olduğu için sorun değil; ama sarı ve kırmızıyı büyük, bitişik alan olarak kullanmayalım (Orta|Zor çip sıralaması tam buna benziyor).

## 3. Kim nerede hangi rengi görüyor

| Ekran | Kim görüyor | Renk nasıl okunur | Risk |
|---|---|---|---|
| Sınav sırasında (soru, üst çubuk, uyarı, zamanlayıcı) | Öğrenci, kaygılı | Her kırmızı = hata/tehdit; her sarı = uyarı | Yüksek: kaygı doğrudan performansa yansır |
| Karşılama, bölüm arası, bitiş | Öğrenci, rahatlama anı | Marka renkleri = sıcaklık, kutlama | Düşük; kırmızı burada olumlu kullanılabilir |
| Sistem kontrolü, form hatası | Öğrenci | Kırmızı = "yanlış yaptım" | Orta: kamera bozuksa suç öğrencinin değil |
| Sonuç sayfası | Öğrenci (+ veli, sonradan) | Kırmızı/sarı = kaldı/zayıf | Yüksek: seviye bir not değil |
| Öğretmen paneli (davet, sonuç listesi) | Öğretmen, okul görevlisi | Kırmızı = "düzeltilecek şey" (kırmızı kalem alışkanlığı) | Orta: öğrenci adının yanındaki kırmızı "öğrenci sorunlu" okunur |
| Panel yansıtılırsa | Öğrenci/sınıf (olasılık, doğrulamadım [Ç]) | Çip öğrenci etiketi gibi okunur | Orta |
| Basılı rapor | Okul, veli | Çoğu okulda siyah-beyaz yazıcı [Ç]; kırmızı = zayıf not | Orta: renkle taşınan bilgi kaybolur |
| İşe alım listesi | İK, okul sahibi | Kırmızı = olumsuz / ret | Yüksek: renkli aday = önyargı, karar bağlanması |

Sonuç: öğretmen için "idare eder" bir eşleme, öğrenci ekranına ya da basılı çıktıya taşınınca zarar verir. Bu yüzden anlam taşıyan hiçbir renk tek başına bilgi olmamalı ve öğrenci/rapor yüzeyleri en temkinli kurala göre çizilmeli.

## 4. Öneriler

### 4.1 Zorluk çipleri (öğretmen paneli)

**Karar: kırmızıyı bırak; zorlukta renge de gerek yok.** Gerekçe:
1. Kırmızı çip öğrenci adının yanında durunca **öğrencinin etiketi** gibi okunur ("sorunlu / riskli"), oysa bu davetin ayarı.
2. [Ç] Öğretmen "Zor"u seçerken kırmızıya basma çekincesi duyabilir; doğrulama sınavında Zor meşru bir seçim, renk onu cezalandırmamalı.
3. Zorluk sıralı veri; ton değişimi sıra bilgisi taşımıyor, yalnız tehlike çağrışımı ekliyor. Sıra zaten 1/2/3 basamak + kelimeyle veriliyor.
4. **Marka işaretiyle çelişiyor:** işarette basamak sırası camgöbeği (kısa), kırmızı (orta), sarı (en uzun). Zorluk simgesi aynı basamak dilini kullanıyor ama "3. basamak" orada sarı, çipte kırmızı. Marka kendi renk sırasını zaten vermiş ve eşleme ona uymuyor.
5. Camgöbeği-soft "Kolay" zemini, aynı sihirbaz adımında "seçili" zemini (camgöbeği-soft seçili kart) ile aynı. İki farklı anlam aynı renkte.
6. Pastel pembeye (red-soft) yumuşatmak çağrışımı kaldırmaz, yalnız azaltır.

**Seçenekler:**

| | Seçenek | Görünüm | Artı | Eksi |
|---|---|---|---|---|
| **A (önerim)** | Nötr çip + basamak simgesi + kelime | Krem hap, mürekkep yazı (13.99:1), açık basamaklar mürekkep, kapalılar mürekkep %20 | Değer yükü sıfır; "çok renk renk" kuralına tam uyum; sihirbazda seçili-zemin çakışması yok; siyah-beyaz çıktıda aynı | Listede renkle "göz gezdirme" yok |
| **B** | Tek renk, üç ton + simge + kelime | Camgöbeği-soft `#DFF5FA` / orta `#75DAEC` / logo camgöbeği `#0BBFDF`; hepsinde mürekkep yazı (14.3 / 10.0 / 7.34:1) | Marka dokunuşu korunur; sıralı veri için doğru kodlama; yükü yok | Camgöbeği "eylem + seçili + cevaplandı" anlamlarıyla paylaşılır (seyreltir); tonlar arası fark azdır (1.43:1), sırayı simge taşır |
| C | Mevcut: camgöbeği / sarı / kırmızı | | Canlı | Yukarıdaki 6 gerekçe; önermiyorum |

- Başka bir alternatif (Kolay camgöbeği, Orta sarı, Zor koyu mürekkep) eleniyor: sarı ve camgöbeği parlaklıkça sıralı değil, "koyu = ağır" da öğrenci adının yanında en gür öğe olur.
- Bonus [Ç]: Bir davetteki herkes aynı zorlukta (bu davetteki öğrenciler için ayar). Her satırda 12 kez tekrar eden çip hem gürültü hem "öğrenci etiketi" okuması. Davet/grup başlığında bir kez göstermek daha temiz olabilir; sonuç listesi davet bazında gruplanıyor mu, bilmiyorum.

### 4.2 Diğer öğeler

- **Ana eylem (camgöbeği + mürekkep yazı): koru.** Soğuk, olumlu kültürel yük (turkuaz), "devam et" kolay okunur. Kural: doygun logo camgöbeği yalnız düğmede ve cevaplandı hücresinde; çizgi, ilerleme, bağlantı koyu camgöbeği; geniş alan soft.
- **Gözetim uyarısı: sarı simge karosu + mürekkep başlık + camgöbeği "Anladım", koru.** "Sarı kart" okuması tam doğru. Ek: (a) uyarı sayısı arttıkça tonu sarıdan turuncu/kırmızıya **kaydırma**; ton sabit kalsın, kaygı sarmalı olmasın; (b) sayaç hapını sarı-soft yerine nötr krem yap, çünkü sarı zaten simgede ve iki sarı öğe sesi yükseltiyor (tasarım yargısı); (c) titreme/yanıp sönme yok.
- **"Sınav sonlandırıldı" ekranı:** tek gerçek "kırmızı kart" anı, yine de kırmızı değil. Nötr kart, mürekkep yazı, tek net sonraki adım ("Okulunuzla iletişime geçin"). Kırmızı utancı artırır, bilgi katmaz; ağırlığı metin taşır.
- **Kayıt göstergesi: kırmızı noktayı koru.** "REC" kırmızısı kamera, canlı yayın ve ekran kaydında evrensel gelenek; başka renge çevirmek şeffaflığı bulandırır (kayıt var, açıkça görülsün). Kurallar: küçük (11 px), statik ya da çok yavaş (2-3 sn) nabız, her zaman cümleyle ("Kamera, ses ve ekran kaydediliyor"), halo parlak değil. #FF3B3B beyazda 3.53:1, kremde 3.06:1 (UI için 3:1 sınırının üstünde, ama sınıra yakın; koyu zeminde kullanma). **Kural: soru ekranında kırmızı yalnız "kaydediliyor" demektir.**
- **Bayrak (İşaretle): sarı + bayrak şekli, koru.** Kırmızı bayrak olmasın (ulusal bayrak ve "red flag" yükü). Sarı burada "dikkat" değil "geri dönülecek" işlevi; şekil birincil sinyal, sarı ikincil.
- **İlerleme: koyu camgöbeği, koru.** Süre azalırken sarı/kırmızıya dönmesin; zamanlayıcı da zaten renk değiştirmiyor, öyle kalsın. Gerekirse son 5 dakikada bir kez, metinle ve nötr hapla bildir ("Son 5 dakika"), renkle değil.
- **Maskot: sarı gövde, camgöbeği ve kırmızı basamaklar, koru.** Kırmızı burada sıcak, canlı bir detay (yanak, basamak, konfeti); bayram/düğün çağrışımı olumlu. Kırmızının öğrenci ekranındaki "olumlu evi" burası. Soru ve uyarı ekranlarında yok (kural zaten böyle).
- **Kademe işareti: tam renkli koru (kırmızı basamak marka).** Üst çubukta küçük (32 px) ve REC noktasından uzak köşede, kabul edilebilir. Ekle: yazıcı, küçük boyut ve fotokopi için **tek renk (mürekkep) sürüm**.
- **Seviye ve sonuç (öğrenci):** "B1" nötr krem hap ya da camgöbeği-soft, **asla kırmızı/sarı**. Seviye bir not değil, merdivende durulan yer; işaretin basamak metaforunu kullan: ulaşılan basamak camgöbeği, üstündekiler nötr (kırmızı değil, "henüz" demek). Doğrulandı = camgöbeği-soft + onay işareti; **Doğrulanamadı** = nötr krem + bilgi simgesi ("bu sınavda doğrulanamadı" cümlesi zaten yumuşak); Kanıt yetersiz = nötr kesikli çizgi. Beceri çubukları tek renk (koyu camgöbeği), trafik ışığı derecelendirmesi yok.
- **Öğretmen panelinde "doğrulanamadı":** öğretmenin dikkatine ihtiyaç var, ama kırmızı değil: sarı-soft + "Gözden geçir" kelimesi. Çünkü aynı sonuç sayfası öğrenciyle paylaşılabilir/yansıtılabilir [Ç].
- **Hatalar:** kırmızı burada meşru ve işlevsel, ama küçük: alan çerçevesi kırmızı (`#D92B2B`, beyazda 4.85:1), `!` simgesi, mesaj metni mürekkep ya da mevcut danger tonu (`#B23A30`, 5.93:1); mesaj "nasıl düzeltilir"i söylesin, "ne yanlış yaptın"ı değil. Öğrenci tarafında bugünkü `bg-danger-soft` + kırmızı metin kutuları (`IntroConsent.tsx:244`, `SystemCheck.tsx:275`) yeniden tasarımda **sarı-soft + mürekkep metin**e dönsün: kamera bulunamadı öğrencinin hatası değil.
- **İşe alım (ilke düzeyinde, kodu okumadım):** aday puanında/listesinde kırmızı-sarı-yeşil yok; sayı + nötr çubuk. Kırmızı yalnız yıkıcı eylem onayında (sil) ve hata durumunda. "Ret" eylemi sözcükle, çerçeveli düğmeyle; renkli rozetle değil (önyargı ve karar bağlama riski).
- **Basılı rapor:** renk "isteğe bağlı" kalsın; zorluk kelime + simge, seviye kelime, işaret tek renk sürüm. Siyah-beyaz çıktıda hiçbir bilgi kaybolmamalı.

### 4.3 Kırmızının evi (tek paragraf kural)

Kırmızı üç yerde yaşar: (1) **marka**: işaret, maskot, konfeti, imza satırındaki yaprak glifi (olumlu); (2) **KAYIT noktası** (soru ekranının tek kırmızısı); (3) **hata/yıkıcı eylem**, yalnız küçük çerçeve ve simge olarak, öğretmen paneli ve formlarda. Hiçbir zaman: düğme dolgusu, zorluk, seviye veya sonuç, zamanlayıcı, gözetim uyarısı, aday puanı.

## 5. Özet tablo

| Öğe | Kim görüyor | Şimdiki renk | Önerilen renk / işlem | Neden (tek satır) |
|---|---|---|---|---|
| Zorluk çipi ve kutucuğu | Öğretmen | Camgöbeği / sarı / kırmızı soft | Nötr krem + 1/2/3 basamak + kelime (A); ya da tek renk üç ton (B) | Zorluk ayar, hüküm değil; sıra simgede, kırmızı tehlike okutur |
| Ana düğme | Herkes | Camgöbeği + mürekkep yazı | Aynı | Soğuk, olumlu (turkuaz), 7.34:1 |
| Cevaplandı hücresi | Öğrenci | Camgöbeği + onay rozeti | Aynı; hiçbir hücre doğru/yanlış renklenmez | Cevaplandı ilerlemedir, hüküm değil |
| İlerleme şeridi | Öğrenci | Koyu camgöbeği | Aynı; süre azalırken renk değişmez | Kaygıyı artıran renk kayması yok |
| Zamanlayıcı | Öğrenci | Nötr hap | Aynı; son 5 dk metinle bildir | Kırmızı geri sayım paniği tetikler [Ç] |
| Kayıt göstergesi | Öğrenci | Kırmızı nokta + cümle | Aynı, küçük ve statik/yavaş | "REC" evrensel gelenek; şeffaflık |
| Bayrak / işaretli hücre | Öğrenci | Sarı + bayrak rozeti | Aynı; asla kırmızı bayrak | Ulusal bayrak ve "red flag" yükünden kaçın |
| Gözetim uyarısı | Öğrenci | Sarı simge + mürekkep + camgöbeği düğme | Aynı; tonu uyarı sayısıyla değiştirme | "Sarı kart": devam ediyorsun, atılmadın |
| Uyarı sayacı | Öğrenci | Sarı-soft hap | Nötr krem hap | Sarı zaten simgede; ses yükselmesin |
| Sınav sonlandırıldı | Öğrenci | (tanımsız) | Nötr kart, mürekkep, tek sonraki adım | Kırmızı kart yok, utanç eklemez |
| Sistem kontrolü sorunu | Öğrenci | Kırmızı-soft + kırmızı metin (kodda) | Sarı-soft + mürekkep metin + ne yapılacağı | Kamera hatası öğrencinin hatası değil |
| Form hatası | Herkes | Kırmızı çerçeve + `!` | Kırmızı çerçeve + `!` + mürekkep mesaj | Kırmızı burada işlevsel, küçük kalsın |
| Maskot | Öğrenci | Sarı gövde, camgöbeği + kırmızı basamak | Aynı; soru/uyarı ekranında yok | Kırmızının olumlu evi: sıcaklık, kutlama |
| Kademe işareti | Herkes | Üç renk basamak | Aynı + tek renk sürüm (yazıcı, küçük boy) | Markayı koru; B/W çıktıda bozulmasın |
| Seviye rozeti ("B1") | Öğrenci, veli | Krem hap | Krem hap / camgöbeği-soft, ulaşılan basamak vurgulu | Seviye bir not değil, durulan yer |
| "Doğrulanamadı" | Öğrenci | Gri-mürekkep metin (kod) | Öğrenci: nötr krem + bilgi simgesi; öğretmen: sarı-soft "Gözden geçir" | Asla kırmızı = kaldı |
| Beceri çubukları | Öğrenci, öğretmen | (tanımsız) | Tek renk (koyu camgöbeği) | Trafik ışığı derecesi yok |
| Basılı rapor | Okul, veli | (varsayım) | Kelime + simge birincil, renk isteğe bağlı | B/W yazıcıda bilgi kaybı olmasın |
| Aday puanı / liste | İK, okul sahibi | (okumadım) | Sayı + nötr çubuk; kırmızı yalnız sil/hata | Renkli aday önyargıyı bağlar |

## Kararlar için sorular

1. **Zorluk çipi: A mı B mi?** A (nötr krem + basamak simgesi, önerim) ya da B (tek renk, üç ton camgöbeği)? Her ikisinde de kırmızı gider; mevcut eşleme (C) önerilmiyor.
2. **Kırmızı kuralı onayı:** "Kırmızı yalnız marka, KAYIT noktası ve (küçük) hata içindir; zorluk, uyarı, sonuç, zamanlayıcıda hiç kırmızı yok" kuralı tasarım şartnamesine yazılsın mı?
3. **Zorluk etiketi nerede dursun?** Sonuç listesinde her öğrenci satırında mı, yoksa davet/grup başlığında bir kez mi? (Satırda durması öğrenci etiketi gibi okunur ve renk gürültüsü yapar.)

Not: Bu inceleme kullanıcı testi yapılmadan yazıldı. En ucuz doğrulama: 5 öğretmen + 5 öğrenciyle 5 saniyelik "bu çip/ekran sana ne söylüyor?" testi.
