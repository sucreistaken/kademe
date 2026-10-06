import { audio, longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const fieldSalesRepresentative: HiringTemplate = {
  key: "field-sales-representative",
  group: "EXTRA",
  name: t("Saha Satış Temsilcisi", "Field Sales Representative"),
  summary: t(
    "Geri kazanılan müşteri, rota önceliği, bayiye sesli ürün sunumu ve hedefe göre haftalık ziyaret planı.",
    "A customer won back, route priority, a spoken product pitch to a dealer and a weekly visit plan against target.",
  ),
  jobAd: t(
    "Bölgemizdeki bayi ve yapı marketleri düzenli ziyaret edecek, yeni ürünlerimizi tanıtacak ve aylık satış hedefini tutturacak bir Saha Satış Temsilcisi arıyoruz. Haftanı hedefe göre planlayan, kaybedilen müşterinin peşini bırakmayan ve ürünü bayinin kazancıyla anlatan biri olmalısın.",
    "We are looking for a Field Sales Representative who visits the dealers and building-supply stores in our region regularly, introduces our new products and hits the monthly sales target. You plan your week against the target, do not give up on a lost customer and sell the product in terms of what the dealer earns.",
  ),
  weights: { commercial: 40, initiative: 35, organisation: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Kısa bir rota sorusu ve iki video sorusu. En fazla 13 dakika.",
        "One short route question and two video questions. At most 13 minutes.",
      ),
      purpose: "Zaman pencerelerine göre rota önceliği; kaybedilen bir müşteriyi geri kazanma; kimse istemeden bölgede yeni fırsat yaratma.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Bugün sahadasın ve ofisten 09:00'da çıkıyorsun. Her ziyaret 1 saat, herhangi iki nokta arası (ofis dahil) 30 dakika sürüyor. Gün 17:00'de bitiyor. Erken varırsan bekleyebilirsin. Dört ziyaret var:\n- A Bayi: aylık en büyük müşterin, stoğu bugün bitiyor. Sahibi yalnızca 11:00'e kadar dükkanda.\n- B Market: yeni aday. Satın alma müdürü yalnızca bugün 15:30-17:00 arasında görüşebiliyor, sonra iki hafta izinde.\n- C Bayi: yanlış teslimat şikayeti var. Müdürü yalnızca 14:00-16:00 arasında dükkanda.\n- D Bayi: rutin ziyaret, ofise en yakın nokta, gün boyu açık.\n\nDört ziyaretin hepsini bugün, her biri kişinin orada olduğu saat içinde başlayıp bitecek şekilde yapmak istiyorsun. Hangi sıra bunu sağlar?",
            "You are in the field today and leave the office at 09:00. Each visit takes 1 hour, and travel between any two points (including the office) takes 30 minutes. The day ends at 17:00. You may wait if you arrive early. There are four visits:\n- Dealer A: your biggest monthly customer, out of stock today. The owner is in the shop only until 11:00.\n- Store B: a new prospect. The purchasing manager can meet only today between 15:30 and 17:00 and is then on leave for two weeks.\n- Dealer C: has a wrong-delivery complaint. The manager is in the shop only between 14:00 and 16:00.\n- Dealer D: routine visit, the closest point to the office, open all day.\n\nYou want to make all four visits today, each starting and ending while the person is there. Which order achieves this?",
          ),
          options: [
            t("D, A, C, B", "D, A, C, B"),
            t("A, C, B, D", "A, C, B, D"),
            t("A, B, C, D", "A, B, C, D"),
            t("A, D, C, B", "A, D, C, B"),
          ],
          correct: 3,
          internal:
            "Doğru cevap: A, D, C, B. A 09:30-10:30 (11:00'den önce), D 11:00-12:00, C'ye 12:30'da varılır ve 14:00'e kadar beklenir, C 14:00-15:00, B 15:30-16:30. Çeldiriciler: D, A, C, B (en yakından başlamak; D 09:30-10:30, A'ya 11:00'de varılır, sahibi gitmiş); A, C, B, D (şikayeti öne almak; C 14:00-15:00, B 15:30-16:30, D'ye 17:00'de varılır, gün bitmiş); A, B, C, D (yeni müşteriyi öne almak; B 15:30-16:30, C'ye 17:00'de varılır, müdür 16:00'da çıkmış).",
        }),
        video({
          prompt: t(
            "Kaybettiğin ya da rakibe geçen bir müşteriyi geri kazandığın ya da geri kazanmaya çalıştığın bir durumu anlat: müşteri neden gitti, bunu nasıl öğrendin, kimse senden istemeden hangi adımı attın, ona ne teklif ettin ve sonuç ne oldu?",
            "Tell us about a time you won back, or tried to win back, a customer you had lost or who moved to a competitor: why did they leave, how did you find out, which step did you take without anyone asking you to, what did you offer them, and what was the result?",
          ),
          competencies: ["commercial", "initiative"],
          expected: [
            "Müşterinin gitme nedenini müşteriden öğrendiğini ve somut söylüyor (fiyat, teslimat, ilgi eksikliği)",
            "Kendi başlattığı adımı ve zamanlamasını açıkça ayırıyor",
            "Teklifini müşterinin kazancına bağlıyor (kâr marjı, teslim güvencesi, raf devri) ve yalnızca indirime dayanmıyor",
            "Sonucu sayıyla söylüyor ve kaybetmemek için sonradan neyi değiştirdiğini anlatıyor",
          ],
          redFlags: ["Kaybı yalnızca rakibin fiyatına bağlayıp kendi payına bakmıyor", "Tek çözüm olarak yetkisi dışında indirim verdiğini anlatıyor", "Somut bir olay yerine genel laflar ediyor"],
          examples: {
            1: "Müşteri rakibe geçti çünkü onlar daha ucuzdu. Biz de fiyatı düşüremeyince yapacak bir şey kalmadı.",
            3: "Bir bayi iki aydır sipariş vermiyordu. Gidip sorduğumda teslimatların geciktiğini söyledi. Lojistikle konuşup haftalık sabit teslim günü ayarladım, bayi tekrar sipariş vermeye başladı.",
            5: "Aylık 90.000 TL'lik bir bayi sipariş vermeyi bırakmıştı. Kimse istemeden gidip sahibiyle konuştum: iki kez yanlış ürün gelmiş, rakip de ilk sipariş indirimi vermiş. Hatayı sahiplendim, iade ürünleri aynı hafta değiştirdim ve satış müdürümün onayıyla üç ay sabit teslim günü ve raf düzenlemesi önerdim. Rakibin indirimi bitince bayi döndü; üçüncü ayda aylık 80.000 TL'ye çıktı. Sonra bu bayiye her ay ilk hafta düzenli ziyaret koydum.",
          },
        }),
        video({
          prompt: t(
            "Kimse senden istemeden kendi bölgende yeni bir müşteri ya da satış fırsatı bulduğun bir durumu anlat (iş, okul ya da gönüllü bir işte): fırsatı nasıl fark ettin, bunu günlük işlerinin arasına nasıl sığdırdın, hangi adımları attın ve sonuç ne oldu?",
            "Tell us about a time you found a new customer or sales opportunity in your area without anyone asking you to (at work, school or volunteering): how did you spot it, how did you fit it around your daily work, which steps did you take, and what was the result?",
          ),
          competencies: ["initiative", "organisation"],
          expected: [
            "Fırsatı nasıl fark ettiğini somut anlatıyor (bir gözlem, bir müşteri sözü, veri)",
            "İlk adımı kendisinin attığını ve kimseyi beklemediğini açıkça söylüyor",
            "Mevcut işlerini aksatmadan bunu nasıl planladığını söylüyor (hangi gün, ne kadar süre, rota)",
            "Sonucu sayıyla veriyor ve takip adımını söylüyor",
          ],
          redFlags: ["Fırsatı başkası bulmuş, kendisi yalnızca katılmış", "Yeni işe zaman ayırırken mevcut müşterileri ihmal ettiğini sorun görmeden anlatıyor"],
          examples: {
            1: "Müdürüm bana yeni bir bayi listesi verdi, ben de gidip görüştüm.",
            3: "Rutin rotamda yeni açılan bir yapı marketi gördüm. Bir sonraki hafta rotamı ona uğrayacak şekilde değiştirdim, numune bıraktım ve bir ay sonra ilk siparişi aldık.",
            5: "Bayilerimden biri, yakındaki yeni sitenin boya işini küçük ustaların aldığını söyledi. Kendi başıma site yönetimini aradım, ustaların listesini çıkardım. Salı öğleden sonralarını iki hafta bunlara ayırdım, rutin ziyaretleri sabaha topladım. Ustaları bayiye yönlendirip bayiye ilk sipariş için özel kampanya önerdim. İki ayda bayinin aylık satışı 35.000 TL arttı ve ustaları aylık bir listeyle takibe aldım.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Bir bayiye 2 dakikalık sesli ürün sunumu ve hedefe göre haftalık ziyaret planı. En fazla 22 dakika.",
        "A 2-minute spoken product pitch to a dealer and a weekly visit plan against the target. At most 22 minutes.",
      ),
      purpose: "Yeni ürünü bayinin kazancıyla anlatma ve fiyat itirazını karşılama; açık hedefe göre gerçekçi, bölge ve kural kısıtlarına uyan haftalık plan.",
      minutes: 22,
      activities: [
        audio({
          prompt: t(
            "Yıldız Yapı'nın sahibi Hasan Bey'e yeni dış cephe boyamız Kalkan Pro'yu 2 dakikada sesli olarak tanıt ve görüşmeyi somut bir sonraki adımla bitir. Hasan Bey şu an rakip ürünü satıyor ve \"Rafım dolu, rakip de daha ucuz\" diyor.\n\nBilgiler (15 litrelik kova):\n- Kalkan Pro: bayi fiyatı 1.800 TL, önerilen satış fiyatı 2.250 TL, bir kova 120 m² boyar.\n- Rakip ürün: bayi fiyatı 1.650 TL, önerilen satış fiyatı 2.000 TL, bir kova 90 m² boyar.\n- Lansman: ilk siparişi en az 20 kova olan bayiye %5 ek indirim (bayi fiyatı 1.710 TL) ve ücretsiz tanıtım standı.\n\nHasan Bey'le konuşuyormuş gibi anlat.",
            "Pitch our new exterior paint Kalkan Pro to Mr Hasan, owner of Yıldız Yapı, in a 2-minute spoken answer, and end the conversation with a concrete next step. Mr Hasan currently sells the competitor's product and says \"My shelf is full, and the competitor is cheaper.\"\n\nFacts (15-litre bucket):\n- Kalkan Pro: dealer price 1,800 TL, recommended retail price 2,250 TL, one bucket covers 120 m².\n- Competitor: dealer price 1,650 TL, recommended retail price 2,000 TL, one bucket covers 90 m².\n- Launch offer: a dealer whose first order is at least 20 buckets gets an extra 5% discount (dealer price 1,710 TL) and a free display stand.\n\nSpeak as if you were talking to Mr Hasan.",
          ),
          note: t("Sesli cevap: 90 saniye düşünme, 2 dakika konuşma, bir kez yeniden kayıt hakkı.", "Spoken answer: 90 seconds to think, 2 minutes to speak, one retake allowed."),
          think: 90,
          competencies: ["commercial"],
          expected: [
            "Fiyat itirazını bayinin kazancıyla karşılıyor: kova başı kâr 450 TL'ye karşı 350 TL, lansmanla 540 TL",
            "Son müşteri için metrekare maliyetini kullanıyor (yaklaşık 18,75 TL'ye karşı 22,22 TL) ve ustaya anlatılabilir bir cümle kuruyor",
            "Raf itirazına bir çözüm sunuyor (tanıtım standı, rakibi çıkarmadan küçük bir deneme)",
            "Somut bir kapanışla bitiriyor (20 kovalık ilk sipariş, stand kurulum tarihi ya da belirli bir takip günü)",
          ],
          redFlags: ["Yalnızca ürün özelliklerini sayıp bayinin kazancını söylemiyor", "Fiyat itirazına yetkisi dışında ek indirimle cevap veriyor", "Sonraki adım ya da kapanış yok"],
          examples: {
            1: "Hasan Bey, Kalkan Pro çok kaliteli bir boya, renkleri de güzel. Rakipten daha iyi. Almak isterseniz bana haber verin.",
            3: "Hasan Bey, rakip ürün kovada 150 TL daha ucuz, doğru. Ama Kalkan Pro'yu 2.250 TL'ye sattığınızda kova başına 450 TL kazanıyorsunuz, rakipte bu 350 TL. Üstelik bir kova 120 metrekare boyuyor. 20 kova alırsanız %5 ek indirim ve ücretsiz stand var. İlk siparişi deneme olarak verelim mi?",
            5: "Hasan Bey, rafınız dolu, rakip de ucuz, haklısınız. İki rakam: Kalkan Pro'da kova başı kârınız 450 TL, rakipte 350 TL; ilk siparişte bayi fiyatı 1.710 TL, kârınız 540 TL. Ustanız için de metrekaresi yaklaşık 18,75 TL, rakipte 22 TL; daha az kova taşıyor. Rafı boşaltmanızı istemiyorum: ücretsiz standı kasanın yanına kuralım, 20 kovayla deneyin. Perşembe 10:00'da standı kurmaya gelsem, siparişi şimdi yazalım mı?",
          },
          internal:
            "Referans hesap: Kalkan Pro kova başı bayi kârı 2.250 - 1.800 = 450 TL (satışın %20'si); lansman fiyatıyla 2.250 - 1.710 = 540 TL. Rakip 2.000 - 1.650 = 350 TL (%17,5). Son müşteri metrekare maliyeti: Kalkan Pro 2.250 / 120 = 18,75 TL; rakip 2.000 / 90 = yaklaşık 22,22 TL. 20 kovalık ilk sipariş 20 x 1.710 = 34.200 TL. Güçlü cevap itirazı bayi kârı ve metrekare maliyetiyle karşılar, raf sorununa stand ya da küçük deneme önerir ve tarihli bir kapanış ister.",
        }),
        longText({
          prompt: t(
            "Ay perşembe günü bitiyor. Pazartesiden perşembeye 4 saha günün var; cuma ofiste ay kapanışı yapılıyor. Günde en fazla 4 ziyaret yapabilirsin; Kuzey ve Güney bölgeleri arası 1,5 saat, aynı gün iki bölgeye gidersen o gün en fazla 2 ziyaret yapabilirsin. Aylık hedefin 1.200.000 TL, portföyünün tamamında gerçekleşen 930.000 TL. Kural: vadesi 30 günü geçmiş alacağı olan müşteriye yeni sevkiyat yapılmaz.\n\nMüşteri | Bölge | Aylık ortalama | Bu ay | Not\nYıldız Yapı | Kuzey | 180.000 | 60.000 | 3 haftadır ziyaret yok; yeni ürün için deneme kararı bekliyor\nDemir Yapı Market | Kuzey | 120.000 | 125.000 | geçen hafta ziyaret edildi\nKaya Hırdavat | Kuzey | 0 | 0 | yeni aday, numune istedi\nMavi Yapı | Kuzey | 40.000 | 45.000 | rutin\nEkin Boya | Güney | 90.000 | 0 | 2 aydır sipariş yok, rakibe geçtiği söyleniyor\nUsta Yapı | Güney | 60.000 | 0 | 85.000 TL alacağın vadesi 45 gün geçmiş\nPark Yapı | Güney | 200.000 | 150.000 | siparişini genelde ayın son günü verir\nOva Market | Güney | 25.000 | 20.000 | rutin\n\nDört günlük planını gün gün yaz: hangi müşteriyi hangi gün ziyaret edersin, her ziyaretin hedefi ve beklediğin sipariş tutarı ne, kimi bu hafta ziyaret etmeyip telefonla ya da gelecek haftaya bırakırsın ve neden? Son olarak hedefe ne kadar yaklaşacağını hesapla.",
            "The month ends on Thursday. You have 4 field days, Monday to Thursday; on Friday the month is closed in the office. You can make at most 4 visits a day; North and South are 1.5 hours apart, and if you visit both regions on the same day you can make at most 2 visits that day. Your monthly target is 1,200,000 TL; across your whole portfolio you have achieved 930,000 TL. Rule: no new shipment goes to a customer with a receivable more than 30 days overdue.\n\nCustomer | Region | Monthly average | This month | Note\nYıldız Yapı | North | 180,000 | 60,000 | not visited for 3 weeks; deciding on a trial of the new product\nDemir Yapı Market | North | 120,000 | 125,000 | visited last week\nKaya Hırdavat | North | 0 | 0 | new prospect, asked for samples\nMavi Yapı | North | 40,000 | 45,000 | routine\nEkin Boya | South | 90,000 | 0 | no order for 2 months, said to have moved to a competitor\nUsta Yapı | South | 60,000 | 0 | 85,000 TL receivable 45 days overdue\nPark Yapı | South | 200,000 | 150,000 | usually orders on the last day of the month\nOva Market | South | 25,000 | 20,000 | routine\n\nWrite your four-day plan day by day: which customer you visit on which day, the goal and the order value you expect from each visit, whom you will not visit this week but phone or leave for next week, and why. Finally, calculate how close to the target you expect to get.",
          ),
          competencies: ["organisation", "commercial"],
          expected: [
            "Açığı doğru hesaplıyor (270.000 TL) ve en büyük potansiyeli sayılarla seçiyor: Yıldız (ortalamaya göre yaklaşık 120.000 TL eksik), Park (yaklaşık 50.000 TL, perşembe), Ekin (geri kazanma)",
            "Günleri bölgeye göre grupluyor, aynı gün iki bölgeye gitmiyor ve Park'ı ayın son günü olan perşembeye koyuyor",
            "Usta Yapı'da önce tahsilatı hedefliyor, tahsilat olmadan bu ay sevkiyat beklemiyor; Demir ve Mavi gibi ortalamanın üstündekileri telefona ya da gelecek haftaya bırakıyor",
            "Ziyaret başına tahmini tutarları toplayıp gerçekçi bir tahmin veriyor ve hedefe ulaşmanın hangi siparişlere bağlı olduğunu söylüyor",
          ],
          redFlags: ["Usta Yapı'dan tahsilat olmadan bu ay sipariş bekliyor", "Her gün iki bölge arasında gidip gelen ve ziyaret kapasitesini aşan bir plan yazıyor", "Tahmin vermiyor ya da her müşteriden en yüksek tutarı alacağını varsayıp hedefi kolayca tutturuyor"],
          examples: {
            1: "Her gün iki müşteri ziyaret ederim, hepsine uğrarım. Herkes biraz sipariş verirse hedef tutar. Usta Yapı'ya da büyük sipariş için giderim.",
            3: "Açık 270.000 TL. Pazartesi Kuzey: Yıldız (120.000 hedef), Kaya (numune). Salı Güney: Ekin, Usta (tahsilat), Ova. Çarşamba Kuzey: Yıldız takip, Mavi. Perşembe Güney: Park (50.000). Demir'i telefonla ararım. Tahminim Yıldız 100.000, Park 50.000, Ekin 30.000, Ova 5.000: 185.000, hedefin 85.000 altı.",
            5: "Açık 270.000. Pzt Kuzey: Yıldız (deneme kararı, hedef 120.000), Kaya (numune, küçük ilk sipariş 15.000), Mavi kısa. Sal Güney: Ekin (geri kazanma, 30.000), Usta (85.000 tahsilat; ödemezse sevkiyat yok), Ova (5.000). Çar Kuzey: Yıldız takip. Per Güney: Park (son gün, 50.000), Usta tahsilat sonrası sipariş. Demir telefon. Tahmin: 120 + 50 + 30 + 15 + 5 = 220.000, açık 50.000. Usta öderse ve 50.000 sipariş verirse hedef tutar; müdürüme çarşamba bildiririm.",
          },
          internal:
            "Referans: açık 1.200.000 - 930.000 = 270.000 TL. Potansiyel (ortalamaya göre): Yıldız yaklaşık 120.000, Park yaklaşık 50.000 (perşembe, ayın son günü), Ekin en fazla 90.000 ama geri kazanma belirsiz, Usta en fazla 60.000 yalnızca 85.000 TL tahsil edilirse (kural), Ova yaklaşık 5.000, Kaya küçük ilk sipariş. Demir ve Mavi ortalamanın üstünde, ziyaret önceliği düşük. Kısıtlar: günde 4 ziyaret, iki bölge aynı gün en fazla 2 ziyaret. Makul plan: bölge günleri (örneğin Pzt Kuzey, Sal Güney, Çar Kuzey, Per Güney ve Park). Gerçekçi tahmin genelde 180.000-250.000 arası; güçlü cevap hedefin hangi siparişlere bağlı olduğunu ve riski söyler.",
        }),
      ],
    }),
  ],
};
