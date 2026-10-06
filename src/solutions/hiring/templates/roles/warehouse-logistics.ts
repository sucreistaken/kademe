import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const warehouseLogistics: HiringTemplate = {
  key: "warehouse-logistics",
  group: "GENERIC",
  name: t("Depo ve Lojistik Sorumlusu", "Warehouse and Logistics Lead"),
  summary: t("Sevkiyat krizi, FEFO ve sayım farkı, geciken tedarikçi planı ve iş güvenliği ihlali.", "A shipment crisis, FEFO and a count difference, a late-supplier plan and a safety violation."),
  jobAd: t(
    "Depomuzun mal kabul, stok, toplama ve sevkiyat süreçlerini yönetecek, vardiya ekibini yönlendirecek bir Depo ve Lojistik Sorumlusu arıyoruz. Önceliği gerekçeyle belirleyen, stok kaydını rafla tutturmadan rahat etmeyen ve sevkiyat baskısı altında bile iş güvenliğinden taviz vermeyen biri olmalısın.",
    "We are looking for a Warehouse and Logistics Lead who runs goods-in, stock, picking and dispatch in our warehouse and directs the shift team. You set priorities with a reason, are not at ease until the stock record matches the shelf, and never trade safety for a dispatch deadline.",
  ),
  weights: { organisation: 40, accuracy: 35, problem_solving: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "İki kısa bilgi sorusu ve iki video sorusu. En fazla 14 dakika.",
        "Two short knowledge questions and two video questions. At most 14 minutes.",
      ),
      purpose: "FEFO ve sayım farkı bilgisi; gerçek bir sevkiyat krizinde önceliklendirme; stok farkında belirtiyi nedenden ayırma ve önlemi süreç olarak kurma.",
      minutes: 14,
      activities: [
        single({
          prompt: t(
            "Depoda aynı yoğurt ürününden üç parti var:\n- Parti A: 1 Ekim'de geldi, son kullanma tarihi 20 Ekim\n- Parti B: 3 Ekim'de geldi, son kullanma tarihi 15 Ekim\n- Parti C: 5 Ekim'de geldi, son kullanma tarihi 25 Ekim\n\nDepo, son kullanma tarihli ürünlerde FEFO (ilk son kullanma tarihi ilk çıkar) kuralını uyguluyor. Mağazanın kalan raf ömrü şartı yok. Bugün 8 Ekim ve bir mağaza siparişi geldi. Siparişi hangi partiden toplarsın?",
            "The warehouse holds three batches of the same yoghurt:\n- Batch A: arrived 1 October, expiry date 20 October\n- Batch B: arrived 3 October, expiry date 15 October\n- Batch C: arrived 5 October, expiry date 25 October\n\nFor dated products the warehouse follows FEFO (first expired, first out). The store has no minimum shelf-life requirement. Today is 8 October and a store order comes in. Which batch do you pick it from?",
          ),
          options: [
            t("Parti A, çünkü depoya ilk giren parti o", "Batch A, because it is the batch that arrived first"),
            t("Parti B, çünkü son kullanma tarihi en yakın olan o", "Batch B, because its expiry date is the nearest"),
            t("Parti C, çünkü mağazada en uzun satılabilecek olan o", "Batch C, because it can stay on sale in the store the longest"),
            t("Parti A, çünkü Parti B'nin tarihi mağazaya göndermek için fazla yakın", "Batch A, because Batch B's date is too close to send to a store"),
          ],
          correct: 1,
          internal:
            "Doğru cevap: Parti B. FEFO'da geliş tarihine değil son kullanma tarihine bakılır; en yakın tarih 15 Ekim (B). Çeldiriciler: A, ilk giren (FIFO ile karıştırmak, en sık hata); C, en uzun raf ömrü (mağazayı düşünüp kuralı ters uygulamak); A, B'nin tarihi fazla yakın (yakın tarihli partiyi mağazaya gönderilemez sanmak; prompt mağazanın kalan raf ömrü şartı olmadığını söylüyor, B'nin 7 günü var).",
        }),
        single({
          prompt: t(
            "Sistemde 240 adet görünen bir üründe sayımda rafta 216 adet saydın. Sayımdan sonra iki şey öğreniyorsun:\n- Bir müşteriden iade gelen 24 adet rafa konmuş ve sayıma dahil, ama iade sisteme henüz girilmemiş.\n- Bir sevkiyat için toplanan 36 adet rampada bekliyor; sayım alanının dışında olduğu için sayılmadı ve sistemden henüz düşülmedi.\n\nBu iki bilgiyi hesaba kattıktan sonra açıklanamayan fark ne kadar?",
            "The system shows 240 units of a product, and your count finds 216 units on the shelf. After the count you learn two things:\n- 24 units returned by a customer were put on the shelf and are included in your count, but the return has not been entered in the system yet.\n- 36 units picked for a shipment are waiting at the dock; they were outside the count area, so they were not counted, and they have not been deducted from the system yet.\n\nAfter taking both facts into account, what is the unexplained difference?",
          ),
          options: [
            t("24 adet eksik", "24 units short"),
            t("48 adet eksik", "48 units short"),
            t("12 adet fazla", "12 units over"),
            t("12 adet eksik", "12 units short"),
          ],
          correct: 3,
          internal:
            "Doğru cevap: 12 adet eksik. Olması gereken sistem stoğu 240 + 24 (girilmemiş iade) = 264. Fiziksel stok 216 (raf) + 36 (rampada, sayılmamış) = 252. 252 - 264 = 12 adet eksik. Çeldiriciler: 24 eksik (ham fark, iki bilgiyi de yok saymak), 48 eksik (iadeyi ekleyip rampadakileri unutmak: 216 - 264), 12 fazla (rampadakileri ekleyip iadeyi unutmak: 252 - 240).",
        }),
        video({
          prompt: t(
            "Bir sevkiyat krizini çözdüğün bir durumu anlat (geciken araç, yanlış yükleme, eksik stok, sistem arızası gibi): ne oldu, ilk ne yaptın, kime ne söyledin, hangi siparişi neden öne aldın, sonuç ne oldu ve sonra neyi değiştirdin?",
            "Tell us about a shipment crisis you solved (such as a late truck, a wrong load, missing stock or a system failure): what happened, what did you do first, whom did you tell what, which order did you put first and why, what was the result, and what did you change afterwards?",
          ),
          competencies: ["problem_solving", "organisation"],
          expected: [
            "Krizi somut anlatıyor (hangi sipariş, kaç palet ya da adet, hangi saat, hangi müşteri)",
            "Önceliği bir gerekçeyle belirlediğini söylüyor (teslim saati, ceza, müşteri etkisi) ve ekibi nasıl yönlendirdiğini anlatıyor",
            "Müşteriye ya da satış ekibine kötü haberi zamanında ve ne zaman çözüleceğiyle birlikte verdiğini anlatıyor",
            "Sonradan eklediği bir önlemi söylüyor (yedek tedarikçi, yükleme kontrol listesi, araç onayı saati)",
          ],
          redFlags: ["Krizi başkasına (şoföre, tedarikçiye) yükleyip kendi adımını söylemiyor", "Müşteriyi son ana kadar habersiz bıraktığını anlatıyor", "Somut bir olay yerine genel laflar ediyor"],
          examples: {
            1: "Araç gelmediğinde nakliye firmasını aradım, onlar geç gönderdi. Bizim yapabileceğimiz bir şey yoktu, müşteri biraz bekledi.",
            3: "Bir sabah 14:00 aracı iptal oldu. Önce o araçtaki siparişleri listeledim, cezalı olan market siparişini başka firmanın aracıyla çıkardım, diğer müşterilere satış ekibiyle bir gün gecikme bilgisini verdik.",
            5: "Kampanya haftası sabah 09:30'da 14:00'te çıkacak 18 paletlik aracın arızalandığı haberi geldi. Önce siparişleri teslim saati ve ceza durumuna göre sıraladım: 10 palet cezalı market siparişiydi. İkinci nakliyeciden 10 paletlik araç buldum, ekibi önce bu paletleri hazırlamaya yönlendirdim. Kalan 8 palet için satış ekibine 10:00'da haber verdim, müşterilere ertesi sabah 08:00 teslim sözü verdik ve tuttuk. Sonrasında iki nakliyeciyle yedek araç anlaşması yaptık ve araç onayını bir gün önce 16:00'da almayı kural haline getirdik.",
          },
        }),
        video({
          prompt: t(
            "Stok kaydının rafla tutmadığı ya da yanlış ürünün sevk edildiği bir durumu anlat: farkı nasıl fark ettin, nedenini nasıl buldun, kaydı ve ürünü nasıl düzelttin ve tekrarlanmaması için sonra neyi değiştirdin?",
            "Tell us about a time the stock record did not match the shelf, or the wrong product was shipped: how did you notice, how did you find the cause, how did you correct the record and the goods, and what did you change afterwards so it would not happen again?",
          ),
          competencies: ["problem_solving", "organisation"],
          expected: [
            "Belirtiyi (sistemde kaç, rafta kaç ya da hangi müşteriye ne gitti) nedenden ayırıyor ve olası nedenleri sayıyor (girilmemiş iade, yanlış lokasyon, barkod karışıklığı)",
            "Nedeni hangi bilgiyi toplayarak bulduğunu söylüyor (hareket kayıtları, okutma geçmişi, ilgili kişiyle konuşma) ve elediği varsayımı anlatıyor",
            "Düzeltmeyi adımlara bölüyor: kaydı onayla düzeltme, ürünü yerine alma, etkilenen müşteriye ya da satış ekibine haber verme",
            "Tekrarı önlemek için kurduğu süreci ve takibi söylüyor (döngüsel sayım takvimi, okutma zorunluluğu, lokasyon etiketi) ve işe yarayıp yaramadığını nasıl kontrol ettiğini anlatıyor",
          ],
          redFlags: ["Farkı nedenini aramadan sistemde düzeltip kapattığını anlatıyor", "Hatayı ekipten birine yükleyip kendi adımını söylemiyor", "Bir önlem ya da takip adımı söylemiyor"],
          examples: {
            1: "Sayımda fark çıkınca sistemi rafa göre düzeltiyoruz, zaten küçük farklar hep olur.",
            3: "Bir üründe sistem 120, raf 96 gösteriyordu. Önce iade ve sevkiyat kayıtlarına baktım, oradan bir şey çıkmadı; okutma geçmişinde 24 adetin yanlış lokasyona okutulduğunu buldum. Ürünleri doğru yere taşıyıp şefimin onayıyla kaydı düzelttim, ekibe lokasyonu okutmayı hatırlattım.",
            5: "Haftalık döngüsel sayımda bir şampuan için sistem 480, raf 432 gösterdi. Fark 48, yani tam 4 koli; bu bana tek tek kayıp değil koli bazlı bir hata olduğunu düşündürdü. Hareketleri inceleyince benzer barkodlu başka bir ürünün 4 koli olarak bu ürüne okutulduğunu buldum. Şefimin onayıyla iki ürünün kaydını da düzelttim, yanlış sevk edilen müşteriyi satışla birlikte aradık. Sonra benzer barkodlu ürünleri ayrı koridorlara taşıdık, mal kabulde ürün adının ekranda onaylanmasını zorunlu yaptık ve bu ürünleri bir ay haftalık saydık; fark tekrar etmedi.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki yazılı görev: geciken bir tedarikçi ile acil siparişleri planlamak ve sahada bir iş güvenliği ihlaline müdahale etmek. En fazla 20 dakika.",
        "Two written tasks like the real job: planning urgent orders around a late supplier, and acting on a safety violation on the floor. At most 20 minutes.",
      ),
      purpose: "Kısıtlı stokla siparişleri önceliklendirme, stok bilgisini doğrulama ve zaman hesabı; iş güvenliği ihlalinde anında müdahale, kök neden ve takip.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Bugün pazartesi, saat 09:00. Tedarikçi aradı: bugün 10:00'da gelecek 400 adet K-200 ürünü çarşamba 14:00'te gelecek.\n\nSistemde K-200 stoğu: 260 adet. Gece vardiyasının notu: \"K-200'den 20 adet hasarlı, iade alanına ayrıldı.\" Bu 20 adetin sistemden düşülüp düşülmediğini bilmiyorsun.\n\nAcil siparişler (hepsi K-200):\n1) Market zinciri: 150 adet. Araç bugün 16:00'da kalkıyor; geç teslimde sözleşme cezası var.\n2) E-ticaret: 80 adet. Kargo firması bugün 17:00'de alıyor; müşterilere ertesi gün teslim sözü verildi.\n3) Ankara bayisi: 120 adet. Teslim çarşamba 10:00; yol 6 saat sürüyor.\n\nYedek tedarikçi: salı 15:00'te en fazla 100 adet teslim edebilir; fiyatı %8 daha yüksek ve satın alma müdürünün onayı gerekiyor.\n\nBugün ve yarın için planını yaz: önce neyi kontrol edersin, hangi siparişe ne zaman kaç adet ayırırsın, kime neyi ne zaman bildirirsin ve işler daha da kayarsa ne yaparsın?",
            "It is Monday 09:00. The supplier calls: the 400 units of product K-200 due today at 10:00 will arrive on Wednesday at 14:00.\n\nSystem stock of K-200: 260 units. The night shift's note says: \"20 units of K-200 damaged, moved to the returns area.\" You do not know whether those 20 units have been deducted in the system.\n\nUrgent orders (all K-200):\n1) Supermarket chain: 150 units. The truck leaves today at 16:00; late delivery carries a contract penalty.\n2) E-commerce: 80 units. The carrier collects today at 17:00; customers were promised next-day delivery.\n3) Ankara dealer: 120 units. Delivery Wednesday 10:00; the drive takes 6 hours.\n\nBackup supplier: can deliver at most 100 units on Tuesday at 15:00; the price is 8% higher and the purchasing manager must approve.\n\nWrite your plan for today and tomorrow: what do you check first, how many units do you allocate to which order and when, whom do you tell what and when, and what do you do if things slip further?",
          ),
          competencies: ["organisation", "accuracy"],
          expected: [
            "Önce K-200'ü fiziksel olarak sayıp kullanılabilir stoğu doğruluyor (260 mı 240 mı) ve planı buna göre kuruyor",
            "Sipariş 1 (150) ve sipariş 2 (80) bugün tam çıkıyor (230 adet) ve sıranın gerekçesini veriyor (saat, ceza, verilmiş söz)",
            "Sipariş 3'ün en geç çarşamba 04:00'te yola çıkması gerektiğini, çarşamba 14:00 teslimatının bu sipariş için geç olduğunu görüyor ve yedek tedarikçi onayını bugün istiyor",
            "240 durumunda 10 adet açığı görüyor (10 + 100 = 110) ve bayiye bugün kısmi teslim ya da kalan 10 adet için yeni tarih seçeneğiyle haber veriyor; salı sabahı her iki tedarikçiyi tekrar teyit ediyor",
          ],
          redFlags: ["Hasarlı 20 adeti hesaba katmadan 260 üzerinden söz veriyor", "Sipariş 3'ü çarşamba 14:00 teslimatından karşılamayı planlıyor", "Bayiye ya da satış ekibine son ana kadar haber vermiyor"],
          examples: {
            1: "Stok 260, siparişler 350. Önce gelen sipariş önce çıkar; 1 ve 2'yi gönderirim, 3'ü çarşamba mal gelince gönderirim. Tedarikçiye de bir daha geç kalmamasını söylerim.",
            3: "260 adetle 1 ve 2'yi bugün çıkarırım (230). Kalan 30 adet var, Ankara için 120 lazım. Yedek tedarikçiden 100 adet için satın alma müdüründen onay isterim, salı 15:00'te gelince 130 adet olur, salı akşamı Ankara aracını yükleriz. Bayiye de durumu bugün bildiririm.",
            5: "09:15'te K-200'ü sayarım: 20 hasarlı sistemden düşülmemişse kullanılabilir 240'tır. 1 (150, 16:00, cezalı) ve 2 (80, 17:00, söz verilmiş) bugün tam çıkar: 230. 3 için çarşamba 14:00 malı geç, araç en geç çarşamba 04:00'te çıkmalı. 10:00'a kadar satın alma müdüründen yedek 100 adet onayı isterim. 240 ise 10 + 100 = 110, 10 adet açık: bayiyi bugün arayıp 110'u zamanında, 10'u perşembe sabahı önerir, kararını alırım. Salı 09:00'da iki tedarikçiyi teyit eder, gecikirse bayiye aynı gün haber veririm.",
          },
          internal:
            "Yerleştirilmiş tuzaklar (4):\n1) İnce: hasarlı 20 adet sistemden düşülmemiş olabilir; kullanılabilir stok 260 ya da 240. Önce fiziksel sayım gerekir.\n2) İnce: sipariş 3 için çarşamba 14:00 teslimatı geç; 6 saat yol, en geç çarşamba 04:00 çıkış. Kaynak: eldeki kalan + yedek tedarikçi (salı 15:00).\n3) Belirgin: toplam talep 350, stok en fazla 260.\n4) Belirgin: yedek tedarikçi en fazla 100 adet ve satın alma onayı gerekiyor; onay bugün istenmeli.\nReferans: 1 ve 2 bugün tam (230). 260 ise 30 + 100 = 130, sipariş 3 tam. 240 ise 10 + 100 = 110, 10 adet açık; bayiyle bugün kısmi teslim ya da yeni tarih konuşulur.",
        }),
        longText({
          prompt: t(
            "Salı 15:40, yoğun sevkiyat saati. Depoda yürürken iki şey görüyorsun:\n1) Forklift operatörü Emre iki paleti üst üste yüklemiş, yük yukarıda, hızlıca geri geri gidiyor. Arkasındaki yaya yolunda kulaklık takmış yeni bir geçici çalışan yürüyor.\n2) Acil çıkış kapısının önüne üç palet konmuş, üzerinde \"geçici, 17:00 sevkiyatı\" yazıyor.\n\nEmre deneyimli ve en hızlı operatörün. 17:00 aracı yetişmezse müşteri ceza kesiyor.\n\nNe yaparsın? Hemen, gün içinde ve sonraki günlerde yapacaklarını sırayla yaz.",
            "Tuesday 15:40, peak dispatch time. Walking through the warehouse you see two things:\n1) Forklift driver Emre has stacked two pallets on the forks, the load is raised high and he is reversing fast. A new temporary worker wearing headphones is walking in the pedestrian lane behind him.\n2) Three pallets have been placed in front of the emergency exit door, labelled \"temporary, 17:00 dispatch\".\n\nEmre is experienced and your fastest driver. If the 17:00 truck misses its slot, the customer charges a penalty.\n\nWhat do you do? Write, in order, what you do right away, during the day and in the following days.",
          ),
          competencies: ["problem_solving", "organisation"],
          expected: [
            "Önce yakın tehlikeyi durduruyor: Emre'yi güvenli şekilde durdurup yükü indirmesini istiyor ve yaya çalışanı uyarıp yoldan çıkarıyor; sevkiyat baskısını gerekçe saymıyor",
            "Acil çıkışın önünü hemen açtırıyor ve paletler için 17:00'ye yetişecek başka bir hazırlık alanı belirliyor",
            "Kök nedeni arıyor: hazırlık alanının yetersizliği, zaman baskısı, geçici çalışanın eğitimi ve kulaklık kuralı; kişiyi suçlamakla yetinmiyor",
            "Olayı ramak kala olarak kayda alıyor, iş güvenliği uzmanına ve yöneticisine bildiriyor, ekiple kısa bir güvenlik konuşması ve takip adımı (yaya yolu işareti, hazırlık alanı planı) belirliyor",
          ],
          redFlags: ["17:00 aracı yetişsin diye ihlallerin devam etmesine izin veriyor ya da sonraya bırakıyor", "Emre'yi herkesin önünde azarlamakla yetinip kök nedene ve kayda bakmıyor", "İki tehlikeden yalnızca birini ele alıyor"],
          examples: {
            1: "Emre deneyimli, ona güvenirim; 17:00 aracı çıktıktan sonra konuşurum. Paletler zaten bir saat sonra gidecek, sorun olmaz.",
            3: "Emre'ye hemen durmasını, yükü indirip paletleri tek tek taşımasını söylerim, geçici çalışanı yaya yolundan uyarırım. Acil çıkışın önündeki paletleri rampaya aldırırım. Akşam Emre ile konuşur, olayı İSG uzmanına bildiririm.",
            5: "Hemen: Emre'ye el işaretiyle durmasını söyler, yükü indirtirim; geçici çalışanı kenara alıp kulaklığı çıkarmasını ve yaya kuralını anlatırım. Acil çıkışın önünü açtırır, paletleri 3 numaralı rampanın önüne taşıtırım. Gün içinde: Emre'yle yalnız konuşur, neden acele ettiğini sorarım; 17:00 için bir kişiyi daha yüklemeye veririm. Olayı ramak kala olarak kayda alıp İSG uzmanına ve müdüre bildiririm. Sonraki günler: geçici çalışanlara sahaya çıkmadan güvenlik eğitimi, acil çıkış önüne zemin işareti, yoğun saatler için ayrılmış hazırlık alanı.",
          },
          internal:
            "Referans: iki ayrı tehlike var ve ikisi de hemen ele alınmalı. (1) Forklift: yük yukarıda ve çift palet, hızlı geri manevra, arkada dikkati dağınık yaya; yakın ölüm ya da ağır yaralanma riski. (2) Acil çıkışın kapatılması; yangın ya da tahliye anında hayati risk, sevkiyat gerekçesi kabul edilemez. Güçlü cevap: önce tehlikeyi durdurur, sonra sevkiyatı başka yoldan kurtarır, kök nedene bakar (zaman baskısı, hazırlık alanı, eğitim), ramak kala kaydı ve İSG bildirimi yapar, takip adımı koyar. Kişiyi suçlamak yerine sistemi düzeltir.",
        }),
      ],
    }),
  ],
};
