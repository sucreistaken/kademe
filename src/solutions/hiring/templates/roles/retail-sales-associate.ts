import { single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const retailSalesAssociate: HiringTemplate = {
  key: "retail-sales-associate",
  group: "GENERIC",
  name: t("Mağaza Satış Danışmanı", "Retail Sales Associate"),
  summary: t("Kararsız müşteri, kasada iade, tamamlayıcı ürün önerisi ve yoğun bir cumartesi.", "An undecided customer, a return at the till, an add-on suggestion and a busy Saturday."),
  jobAd: t(
    "Mağazamızda müşterileri karşılayacak, ihtiyaçlarını sorarak doğru ürünü önerecek, kasa ve iade işlemlerini yapacak bir Mağaza Satış Danışmanı arıyoruz. Müşteriyi dinleyen, ürünü ihtiyaca bağlayarak anlatan ve yoğun saatlerde ekip arkadaşlarıyla birlikte çalışan biri olmalısın.",
    "We are looking for a Retail Sales Associate who welcomes customers in our store, asks about their needs to suggest the right product, and handles the till and returns. You listen to the customer, explain a product in terms of their need and work hand in hand with your teammates at busy times.",
  ),
  weights: { customer: 40, commercial: 35, teamwork: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Bir kasa sorusu ve iki kısa video sorusu. Yaklaşık 13 dakika.",
        "One till question and two short video questions. About 13 minutes.",
      ),
      purpose: "Kampanyalı iadede kasa hesabı; kararsız müşteriye ihtiyaç sorarak satış; yoğunlukta ekip arkadaşıyla iş paylaşımı.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Bir müşteri dün \"ikinci ürüne %50 indirim\" kampanyasıyla iki tişört aldı: biri 600 TL, diğeri 400 TL. İndirim ucuz olana uygulandı, toplam 800 TL'yi kredi kartıyla ödedi. Bugün fişiyle gelip 600 TL'lik tişörtü iade ediyor, 400 TL'lik tişört onda kalıyor.\n\nMağaza kuralları: kampanyalı alışverişte bir ürün iade edilirse kalan ürün kampanyasız fiyatından hesaplanır; iade, ödemenin yapıldığı yönteme yapılır.\n\nKasada ne yaparsın?",
            "Yesterday a customer bought two T-shirts with a \"50% off the second item\" offer: one at 600 TL and one at 400 TL. The discount went on the cheaper one, and they paid 800 TL in total by credit card. Today they come back with the receipt and return the 600 TL T-shirt; they keep the 400 TL one.\n\nStore rules: if one item from an offer purchase is returned, the item kept is charged at its full price; refunds go back to the payment method used.\n\nWhat do you do at the till?",
          ),
          options: [
            t("Kredi kartına 600 TL iade yaparım", "I refund 600 TL to the credit card"),
            t("Nakit olarak 400 TL iade yaparım", "I refund 400 TL in cash"),
            t("Kredi kartına 400 TL iade yaparım", "I refund 400 TL to the credit card"),
            t("Kredi kartına 300 TL iade yaparım", "I refund 300 TL to the credit card"),
          ],
          correct: 2,
          internal:
            "Doğru cevap: kredi kartına 400 TL. Kalan tişört kampanyasız 400 TL; ödenen 800 TL, iade 800 - 400 = 400 TL, ödeme yöntemine (karta). Çeldiriciler: 600 TL karta (kampanya kuralını yok sayıp iade edilen ürünün etiket fiyatını vermek), 400 TL nakit (tutar doğru, yöntem yanlış), 300 TL karta (indirimin iade edilen ürüne uygulandığını sanmak: 600 x %50).",
        }),
        video({
          prompt: t(
            "Ne alacağına karar veremeyen bir müşteriyle ilgilendiğin bir durumu anlat: müşteri neden kararsızdı, ona neler sordun, ne önerdin ve neden, sonuç ne oldu?",
            "Tell us about a time you helped a customer who could not decide what to buy: why were they undecided, what did you ask them, what did you suggest and why, and what was the result?",
          ),
          competencies: ["customer", "commercial"],
          expected: [
            "Kararsızlığın nedenini sorularla bulduğunu anlatıyor (kullanım amacı, bütçe, iki ürün arasındaki tereddüt)",
            "Seçenekleri ikiye indirip her birini müşterinin ihtiyacına bağlayarak anlattığını söylüyor",
            "Müşteriyi zorlamadan karar vermesine yardım ettiğini, gerekirse almamasını da kabul ettiğini anlatıyor",
            "Sonucu somut söylüyor (ne aldı, geri geldi mi, iade oldu mu)",
          ],
          redFlags: ["Müşteriyi en pahalı ürüne ya da hemen almaya zorladığını başarı olarak anlatıyor", "Soru sormadan ürün özelliklerini saydığını anlatıyor", "Somut bir müşteri yerine genel satış sözleri ediyor"],
          examples: {
            1: "Kararsız müşteriye kampanyayı söylerim, bugün almazsa kaçıracağını anlatırım. Genelde alıyorlar.",
            3: "İki mont arasında kalan bir müşteriye nerede giyeceğini sordum. Her gün işe yürüyerek gittiğini söyleyince daha hafif ve su geçirmeyen modeli önerdim, onu aldı.",
            5: "Bir müşteri yarım saattir iki koşu ayakkabısı arasında gidip geliyordu. Ne sıklıkla ve nerede koştuğunu, önceki ayakkabısında neyi sevmediğini sordum. Asfaltta haftada üç gün koştuğunu ve eski ayakkabısının sert geldiğini öğrenince daha yastıklı modelin neden uygun olduğunu anlatıp ikisini de mağazada denemesini istedim. Pahalı olanı değil, kendisine uyanı aldı; iki hafta sonra arkadaşını getirdi. O günden beri 'nerede, ne sıklıkla' sorusunu hep ilk soruyorum.",
          },
        }),
        video({
          prompt: t(
            "Mağazada ya da başka bir ekipte yoğun bir anda bir iş arkadaşınla işi paylaşmanız ya da bir konuda anlaşamadığınız bir durumu anlat: ne oldu, sen tam olarak ne söyledin ve ne yaptın, sonuç ne oldu?",
            "Tell us about a time, in a store or another team, when you had to share the work with a teammate at a busy moment or the two of you disagreed about something: what happened, what exactly did you say and do, and what was the result?",
          ),
          competencies: ["teamwork"],
          expected: [
            "Arkadaşının katkısını ya da haklı olduğu noktayı adıyla söylüyor",
            "İşin nasıl bölündüğünü ya da anlaşmazlığın konuşarak nasıl çözüldüğünü somut anlatıyor",
            "Müşteriye yansıyan sonucu ve sonradan ekipçe değiştirdikleri bir şeyi söylüyor",
          ],
          redFlags: ["Sorunu tamamen arkadaşına yüklüyor", "Anlaşmazlığı müşterinin önünde tartıştığını anlatıyor", "Çatışmadan kaçıp işi tek başına yaptığını başarı sayıyor"],
          examples: {
            1: "Arkadaşım hep yavaştı, ben de onun işini yapıyordum. Müdüre söyledim, o halletti.",
            3: "Kampanya günü arkadaşım hem kasada hem katta olmaya çalışıyordu. Ona kasada kalmasını, katı benim almamı önerdim, kabul etti ve kuyruk azaldı.",
            5: "İndirim haftası Mert'le kimin kasaya geçeceği konusunda gerildik. Müşterilerin yanından çekilip kısa konuştuk: o hızlı kasa yapıyordu, ben ürün bilgisinde iyiydim. Mert kasada kaldı, ben katta beden ve stok sorularını aldım; kuyruk 10 kişiden 3'e indi. Akşam müdürümüze yoğun günlerde görevleri sabahtan bölmeyi önerdik, artık her cumartesi panoya yazıyoruz.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Mağazada geçen iki durum: bir müşteriye tamamlayıcı ürün önerisi ve yoğun bir cumartesi. Videoyla cevap vereceksin. Yaklaşık 13 dakika.",
        "Two situations from the shop floor: suggesting an add-on to a customer and a busy Saturday. You answer on video. About 13 minutes.",
      ),
      purpose: "İhtiyaca bağlı, zorlamayan tamamlayıcı ürün önerisi; kuyruk ve şikayet aynı anda geldiğinde önceliklendirme ve ekibi yönlendirme.",
      minutes: 13,
      activities: [
        video({
          prompt: t(
            "Bir müşteri 4.500 TL'lik bir koşu ayakkabısını almaya karar verdi ve kasaya doğru yürüyor. Denerken sana şunları söylemişti: yeni başlıyor, haftada üç gün sabah erken parkta koşacak ve iki ay sonra 10 km'lik bir yarışa katılmak istiyor.\n\nRafta şunlar var:\n- Koşu çorabı: 250 TL (3'lü paket 600 TL)\n- Ayakkabı su geçirmezlik spreyi: 300 TL\n- Akıllı koşu saati: 3.200 TL\n- Reflektörlü koşu yeleği: 450 TL\nKampanya: ayakkabıyla alınan ikinci aksesuara %30 indirim.\n\nMüşteriye kasaya varmadan ne söylerdin? Ona söyleyeceğin cümlelerle anlat. Yaklaşık 2 dakikan var.",
            "A customer has decided on a 4,500 TL running shoe and is walking towards the till. While trying it on they told you: they are just starting, will run three mornings a week early in the park and want to run a 10 km race in two months.\n\nOn the shelf:\n- Running socks: 250 TL (pack of 3: 600 TL)\n- Waterproofing spray for shoes: 300 TL\n- Smart running watch: 3,200 TL\n- Reflective running vest: 450 TL\nOffer: 30% off the second accessory bought with the shoe.\n\nWhat would you say to the customer before they reach the till? Answer with the sentences you would say to them. You have about 2 minutes.",
          ),
          competencies: ["commercial", "customer"],
          expected: [
            "Öneriyi müşterinin söylediklerine bağlıyor: haftada üç gün koşu için çorap paketi, sabah erken karanlıkta görünürlük için reflektörlü yelek",
            "En fazla bir iki ürün öneriyor, ihtiyaca uymayanı (sprey, yeni başlayan için pahalı saat) zorlamıyor ya da ancak sorulursa anlatıyor",
            "Kampanyayı doğru anlatıyor: ikinci aksesuar %30 indirimli, örneğin çorap paketi 600 TL ve yelek 450 x 0,70 = 315 TL",
            "Kararı müşteriye bırakıyor ve 'hayır' cevabını rahatça kabul ediyor",
          ],
          redFlags: ["Rafın tamamını ya da en pahalı ürünü ihtiyaçla bağlamadan öneriyor", "Kampanyayı yanlış hesaplıyor ya da baskı aracı olarak kullanıyor ('bugün almazsanız kaçar')"],
          examples: {
            1: "Saatimiz de var, çok güzel, 3.200 TL. Bir de sprey alın, ayakkabınız uzun gider. Bugün kampanya var, kaçırmayın.",
            3: "Haftada üç gün koşacaksanız çorabınız çok önemli, 3'lü paket 600 TL ve terletmez. İkinci aksesuara %30 indirim de var, isterseniz bir şey daha bakabiliriz.",
            5: "Haftada üç gün koşacaksınız, nasır ve su toplamaması için koşu çorabı önemli; 3'lü paket 600 TL, haftanın her koşusuna bir çift. Sabah erken parkta koşacağınızı söylediniz, o saatte hava karanlık olabiliyor; bu reflektörlü yelek sizi bisikletli ve araçlara görünür kılar. İkinci aksesuar %30 indirimli, yelek 315 TL'ye düşüyor. Saati şimdilik önermem, yarışa yaklaşırken ihtiyaç duyarsanız bakarız. İsterseniz yalnızca ayakkabıyla da devam edebiliriz, siz nasıl isterseniz.",
          },
          internal: "Referans: ihtiyaçla en uyumlu öneri koşu çorabı (sıklık, yeni başlayan) ve reflektörlü yelek (sabah erken, park). %30 indirim ikinci aksesuara: çorap paketi 600 + yelek 450 x 0,70 = 315 TL (toplam aksesuar 915 TL); ucuz olana indirim uygulanırsa çorap tekli 250 x 0,70 = 175 TL. Saat ihtiyaca göre ileride, sprey bu kullanım için gereksiz.",
        }),
        video({
          prompt: t(
            "Cumartesi saat 14:30, mağaza çok kalabalık. İki kasadan yalnızca biri açık ve orada sen varsın; kasada 6 kişilik bir kuyruk var. Arkadaşın Burak 15:00'e kadar molada, Selin depoda bir müşteri için beden arıyor. Mağaza müdürü bugün izinli; değişim ve iadeler kasadan yapılıyor.\n\nBu sırada bir müşteri kuyruğun önüne gelip yüksek sesle, geçen hafta aldığı montun fermuarının ilk giyişte bozulduğunu, hemen ilgilenilmesini ve parasını geri istediğini söylüyor. Kuyruktakiler söylenmeye başladı.\n\nNe yaparsın, kime ne söylersin? Sırasıyla anlat. Yaklaşık 2 dakikan var.",
            "It is Saturday 14:30 and the store is packed. Only one of the two tills is open and you are on it; there is a queue of 6 people. Your teammate Burak is on break until 15:00, Selin is in the stockroom looking for a size for a customer. The store manager is off today; exchanges and refunds are done at the till.\n\nJust then a customer comes to the front of the queue and says loudly that the zip of the coat they bought last week broke the first time they wore it, that they want someone to deal with it right now and that they want their money back. People in the queue start to grumble.\n\nWhat do you do, and what do you say to whom? Walk us through it in order. You have about 2 minutes.",
          ),
          competencies: ["customer", "teamwork"],
          expected: [
            "Şikayetçi müşteriyi sakin karşılıyor, sorunu kısaca doğruluyor ve ne zaman ilgileneceğini net söylüyor (kuyruğu bozmadan, kısa bir süre ve yer vererek)",
            "Ekibi harekete geçiriyor: Selin'den ikinci kasayı açmasını ya da müşteriyle ilgilenmesini istiyor ya da Burak'tan molasını kısa kesmesini rica ediyor, kimin ne yapacağını açık söylüyor",
            "Kuyruktaki müşterilere durumu bir cümleyle açıklıyor ve sırayı adil tutuyor",
            "İade ya da değişim kararını kurala göre veriyor: fiş ve ürünü kontrol ediyor, değişim ya da iade seçeneklerini sunuyor, müdür yoksa yetkisini aşan sözü vermiyor",
          ],
          redFlags: ["Şikayetçi müşteriyi kuyruğa geri gönderip bekletiyor ya da tartışmaya giriyor", "Ekip arkadaşlarından yardım istemeden her şeyi tek başına yapmaya çalışıyor", "Fiş ve ürün kontrolü yapmadan hemen iade sözü veriyor"],
          examples: {
            1: "Müşteriye sıraya girmesini söylerim, herkes bekliyor. Sırası gelince bakarım.",
            3: "Müşteriye üzgün olduğumu söyler, kuyruktakileri bitirince hemen ilgileneceğimi söylerim. Selin'i çağırıp ikinci kasayı açmasını isterim. Sonra fişe bakıp montu değiştiririm ya da iade ederim.",
            5: "Müşteriye: 'Haklısınız, ilk giyişte bozulması kabul edilemez. Size hemen yardımcı olacağız.' Selin'e telsizden ikinci kasayı açıp bu müşterinin değişim ya da iadesini yapmasını, depodaki işi bekletmesini rica ederim; Burak'a mesaj atıp 5 dakika erken dönmesinin mümkün olup olmadığını sorarım. Kuyruğa: 'İkinci kasa açılıyor, sıranız korunuyor.' Selin fişi ve fermuarı kontrol edip değişim ya da iade seçeneğini müşteriye sunar. Akşam müdüre o modelin fermuarını bildiririm ve cumartesi molalarını yoğun saatin dışına kaydırmayı öneririm.",
          },
        }),
      ],
    }),
  ],
};
