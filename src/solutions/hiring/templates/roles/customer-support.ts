import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const customerSupport: HiringTemplate = {
  key: "customer-support",
  group: "GENERIC",
  name: t("Müşteri Destek Uzmanı", "Customer Support Specialist"),
  summary: t("Zor müşteri, net yazılı cevap ve sorun önceliklendirme.", "Difficult customers, clear written replies and issue triage."),
  jobAd: t(
    "Müşterilerimizin telefon, e-posta ve canlı destek taleplerini karşılayacak, sorunları ilk temasta çözmeye çalışacak ve çözülemeyenleri doğru ekibe aktaracak bir Müşteri Destek Uzmanı arıyoruz. Sakin, net yazan ve sorunun kökünü merak eden biri olmalısın.",
    "We are looking for a Customer Support Specialist who answers our customers by phone, e-mail and live chat, tries to solve issues on first contact and hands the rest to the right team. You stay calm, write clearly and want to find the root of a problem.",
  ),
  weights: { customer: 40, communication: 35, problem_solving: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("İki kısa video sorusu ve bir senaryo sorusu. Yaklaşık 10 dakika.", "Two short video questions and one scenario question. About 10 minutes."),
      purpose: "Gerçek bir zor müşteri deneyimi ve iade politikası muhakemesi.",
      minutes: 10,
      activities: [
        video({
          prompt: t(
            "Öfkeli ya da hayal kırıklığına uğramış bir müşteriyle konuştuğun son bir durumu anlat: müşteri neden kızgındı, sen tam olarak ne söyledin ve ne yaptın, sonuç ne oldu?",
            "Tell us about a recent time you spoke with an angry or disappointed customer: why were they upset, what exactly did you say and do, and what was the result?",
          ),
          competencies: ["customer", "communication"],
          expected: [
            "Müşterinin duygusunu adıyla karşılıyor",
            "Sorunu kendi sözleriyle özetleyip doğruluyor",
            "Somut bir sonraki adım ve zaman veriyor",
            "Sonucu ve kendi payını net söylüyor",
          ],
          redFlags: ["Müşteriyi suçluyor ya da küçümsüyor", "Somut bir olay yerine genel laflar ediyor"],
          examples: {
            1: "Müşteriler genelde abartıyor, kurallar neyse onu söylerim.",
            3: "Kargosu geciken bir müşteriyi dinledim, durumu kargo firmasından öğrenip aynı gün geri aradım, ürün ertesi gün ulaştı.",
            5: "Önce 'haklısınız, bu bekleme can sıkıcı' dedim, siparişi açıp gecikmenin nedenini buldum, saat vererek geri döneceğimi söyledim ve döndüm; sonra aynı sorunun tekrarlanmaması için ekibe not bıraktım.",
          },
        }),
        video({
          prompt: t(
            "Bir müşterinin sorusunun cevabını bilmediğin bir anı anlat. Nasıl ilerledin, kime ne sordun ve bu sürede müşteriye ne söyledin?",
            "Tell us about a moment when you did not know the answer to a customer's question. How did you proceed, whom did you ask what, and what did you tell the customer meanwhile?",
          ),
          competencies: ["problem_solving", "customer"],
          expected: ["Bilmediğini açıkça kabul ediyor", "Doğru kaynağa ya da kişiye gidiyor", "Müşteriye ne zaman döneceğini söylüyor"],
          redFlags: ["Tahminle yanlış bilgi verdiğini anlatıyor", "Müşteriyi bekletip haber vermiyor"],
          examples: {
            1: "Aklıma gelen bir şey söyledim, müşteri sonra tekrar aradı.",
            3: "Müşteriye kontrol edip döneceğimi söyledim, ürün ekibine sordum ve aynı gün cevap verdim.",
            5: "Bilmediğimi söyleyip 30 dakika içinde döneceğimi belirttim, bilgi tabanında ve ürün ekibinde kontrol ettim, cevabı verdikten sonra eksik bilgiyi bilgi tabanına ekletiyorum.",
          },
        }),
        single({
          prompt: t(
            "Bir müşteri, 30 günlük iade süresi 3 gün önce dolmuş bir ürünü iade etmek istiyor ve çok kızgın. Politikaya göre istisnayı yalnızca ekip lideri onaylayabiliyor. En doğru ilk adım hangisi?",
            "A customer wants to return a product whose 30-day return window ended 3 days ago, and they are very angry. By policy only the team lead can approve an exception. What is the best first step?",
          ),
          options: [
            t("Politikayı okuyup iadenin mümkün olmadığını söylemek", "Read out the policy and say a return is not possible"),
            t("Dinleyip durumu özetlemek, istisna için ekip liderine danışacağını ve ne zaman döneceğini söylemek", "Listen, summarise, say you will ask the team lead about an exception and when you will get back"),
            t("Müşteri memnun kalsın diye iadeyi hemen kabul etmek", "Accept the return at once so the customer is happy"),
            t("Müşteriyi hiçbir şey söylemeden ekip liderine aktarmak", "Transfer the customer to the team lead without saying anything"),
          ],
          correct: 1,
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t("Gerçek işe benzeyen iki yazılı görev. Yaklaşık 20 dakika.", "Two written tasks like the real job. About 20 minutes."),
      purpose: "Yazılı müşteri iletişimi ve birden çok şikayette önceliklendirme.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Aşağıdaki e-postaya müşteriye gidecek cevabı yaz.\n\n\"Üç gündür siparişim kargoda bekliyor, iki kez aradım kimse dönmedi. Yarın doğum günü hediyesi olarak vermem gerekiyordu. Paramı geri istiyorum!\"\n\nBildiklerin: kargo firması aktarma merkezinde gecikme bildirdi, tahmini teslim yarın 18:00. Ücretsiz kargo kodu verme yetkin var. İade ancak teslimattan sonra yapılabiliyor.",
            "Write the reply that goes to the customer for the e-mail below.\n\n\"My order has been stuck in shipping for three days, I called twice and nobody called back. It was meant to be a birthday present tomorrow. I want my money back!\"\n\nWhat you know: the carrier reported a delay at the transfer hub, estimated delivery tomorrow 18:00. You may give a free-shipping code. A refund is only possible after delivery.",
          ),
          competencies: ["customer", "communication"],
          expected: [
            "Özür ve anlayışla açılıyor, dönülmeyen aramaları sahipleniyor",
            "Tahmini teslim saatini ve iade kuralını açık söylüyor",
            "Yetkisi içindeki telafiyi (kargo kodu) sunuyor",
            "Kısa, kibar, kalıp cümlesiz bir dil kullanıyor",
          ],
          redFlags: ["Yetkisi olmayan bir iade ya da tarih sözü veriyor", "Kuralı müşteriyi suçlayan bir dille anlatıyor"],
          examples: {
            1: "Sayın müşterimiz, iade teslimattan sonra yapılır. İyi günler.",
            3: "Geciktiğimiz için özür dilerim. Kargo firması aktarma merkezinde gecikme bildirdi, siparişiniz yarın 18:00'e kadar elinizde olacak. Teslimattan sonra isterseniz iade başlatabilirim.",
            5: "Haklı olarak sinirlendiniz, aramalarınıza dönmediğimiz için de özür dilerim. Siparişiniz aktarma merkezinde gecikmiş, tahmini teslim yarın 18:00. Takibini ben yapacağım ve yarın öğlen size durumu yazacağım. Telafi olarak bir sonraki siparişiniz için ücretsiz kargo kodu ekledim. Ürün yetişmezse teslimatta iadeyi hemen başlatırım.",
          },
        }),
        longText({
          prompt: t(
            "Bu sabah üç müşteriden aynı şikayet geldi: mobil uygulamada ödeme adımında \"işlem başarısız\" hatası alıyorlar ama kartlarından para çekilmiş görünüyor. İlk 30 dakikada atacağın adımları sırayla yaz: kime neyi bildirirsin, müşterilere ne söylersin, neyi kayıt altına alırsın?",
            "This morning three customers sent the same complaint: the mobile app shows \"payment failed\" at checkout, but money seems to have left their card. Write the steps you take in the first 30 minutes, in order: whom do you tell what, what do you say to the customers, what do you record?",
          ),
          competencies: ["problem_solving", "communication"],
          expected: [
            "Bunu tekil değil olası bir sistem hatası olarak görüyor",
            "Teknik ekibe örneklerle (sipariş no, saat, cihaz) hızlı bildiriyor",
            "Müşterilere çift ödeme olmayacağını ya da iade edileceğini doğrulamadan söz vermiyor, ne zaman döneceğini söylüyor",
            "Gelen yeni şikayetler için ortak bir kayıt ya da hazır cevap açıyor",
          ],
          redFlags: ["Her müşteriye ayrı ayrı tekrar denemesini söyleyip bırakıyor", "Teknik ekibe haber vermiyor"],
          examples: {
            1: "Müşterilere tekrar denemelerini söylerim.",
            3: "Teknik ekibe üç örneği iletirim, müşterilere sorunu incelediğimizi ve gün içinde döneceğimizi yazarım.",
            5: "Önce son bir saatteki benzer talepleri tararım, üç örneği sipariş no ve saatle teknik ekibe acil diye açarım, ödeme ekibine çekilen tutarları sorarım. Müşterilere incelediğimizi, ödeme doğrulanınca iadenin otomatik olacağını ve saat 12'de güncelleme vereceğimi yazarım; ekip için tek bir kayıt ve hazır cevap açarım.",
          },
        }),
      ],
    }),
  ],
};
