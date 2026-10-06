import { audio, longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const salesRepresentative: HiringTemplate = {
  key: "sales-representative",
  group: "GENERIC",
  name: t("Satış Temsilcisi", "Sales Representative"),
  summary: t("Hedef, itiraz karşılama ve ilk soğuk e-posta.", "Targets, objection handling and the first cold e-mail."),
  jobAd: t(
    "Yeni müşteri bulacak, ilk görüşmeden sözleşmeye kadar satış sürecini yürütecek ve hedefini kendi planıyla tutturacak bir Satış Temsilcisi arıyoruz. Müşterinin işini anlamak için soru soran, değeri rakamla anlatan ve itirazdan kaçmayan biri olmalısın.",
    "We are looking for a Sales Representative who finds new customers, runs the sale from the first call to the signed contract and hits the target with their own plan. You ask questions to understand the customer's business, express value in numbers and do not run from an objection.",
  ),
  weights: { commercial: 40, communication: 35, initiative: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("İki kısa video sorusu ve bir senaryo sorusu. Yaklaşık 10 dakika.", "Two short video questions and one scenario question. About 10 minutes."),
      purpose: "Gerçek bir hedef aşma deneyimi, kendiliğinden fırsat yaratma ve itiraz türünü tanıma.",
      minutes: 10,
      activities: [
        video({
          prompt: t(
            "Bir satış hedefini aştığın bir dönemi anlat: hedef neydi, ne kadar aştın, bunu sağlayan kendi adımların nelerdi ve sonuç ne oldu?",
            "Tell us about a period when you beat a sales target: what was the target, by how much did you beat it, what were your own steps that made it happen, and what was the result?",
          ),
          competencies: ["commercial", "initiative"],
          expected: [
            "Hedefi ve gerçekleşeni rakamla söylüyor (adet, ciro ya da yüzde)",
            "Sonucu getiren kendi planını ve adımlarını ayırt ediyor (hangi müşteri grubu, hangi yaklaşım)",
            "Başarıyı müşterinin kazancına ya da ihtiyacına bağlıyor",
            "Neyin işe yaramadığını ve ne değiştirdiğini de söylüyor",
          ],
          redFlags: ["Rakam vermeden 'hep hedefin üstündeydim' diyor", "Başarıyı yalnızca kampanyaya, şansa ya da ekibe bağlıyor; kendi adımı yok"],
          examples: {
            1: "Genelde hedefimi tuttururdum, o dönem kampanya da vardı, satışlar iyi gitti.",
            3: "Çeyrek hedefim 1,2 milyon TL'ydi, 1,45 milyon yaptım. Eski müşterileri tek tek arayıp yeni paketi anlattım, beş tanesi yükseltme yaptı.",
            5: "Çeyrek hedefim 40 yeni sözleşmeydi, 52 yaptım. Kayıp tekliflerime baktığımda küçük işletmelerin kurulum ücretinde takıldığını gördüm; yöneticimle kurulumu ilk faturaya yayan bir teklif kurdum ve önce bu segmenti aradım. 12 ek sözleşmenin 9'u buradan geldi. Kurumsal tarafta aynı yaklaşım işe yaramadı, orada karar vericiye erken ulaşmaya geçtim.",
          },
        }),
        video({
          prompt: t(
            "Kimse senden istemeden yeni bir müşteri kaynağı ya da satış fırsatı bulduğun bir durumu anlat: fırsatı nasıl fark ettin, ilk adımı ne oldu ve sonuç ne oldu?",
            "Tell us about a time you found a new source of customers or a sales opportunity without anyone asking you to: how did you spot it, what was your first step, and what was the result?",
          ),
          competencies: ["initiative"],
          expected: [
            "Fırsatı kendisinin fark ettiği somut bir işaret söylüyor (bir haber, bir müşteri cümlesi, bir veri)",
            "Belirsizken nasıl karar verip ilk adımı attığını anlatıyor",
            "Sonucu rakamla ya da somut bir çıktıyla söylüyor ve sahipleniyor",
          ],
          redFlags: ["İşi başkası başlatmış, aday yalnızca katılmış", "Fırsat var ama hiçbir adım atılmamış"],
          examples: {
            1: "Yöneticim bir fuar listesi verdi, ben de oradaki firmaları aradım.",
            3: "Bir müşterim yeni şube açtığını söyledi; kimse istemeden diğer şubelere de teklif hazırladım, iki şube sözleşme imzaladı.",
            5: "Ticaret odası duyurularında bölgemizde yeni açılan üç lojistik deposu gördüm. Elimizde bu sektörden bir referans vardı; onun sonuçlarını iki sayfalık bir örnek olaya çevirip depo müdürlerine yazdım. Altı görüşme, iki sözleşme çıktı; bu kaynağı ekibe aylık bir tarama olarak önerdim, şimdi herkes kullanıyor.",
          },
        }),
        single({
          prompt: t(
            "Bir potansiyel müşteri şöyle diyor: \"Ürününüz ilgimi çekti ama mevcut tedarikçimizle sözleşmemiz Mart'ta bitiyor, o zamana kadar bir şey değiştiremeyiz.\" Bu hangi tür itiraz ve en doğru karşılık hangisi?",
            "A prospect says: \"Your product interests me, but our contract with the current supplier ends in March and we cannot change anything until then.\" What type of objection is this, and what is the best response?",
          ),
          options: [
            t("Fiyat itirazı: Mart'ı beklememesi için hemen bir indirim teklif etmek", "A price objection: offer a discount at once so they do not wait for March"),
            t("Rakip tercihi: mevcut tedarikçinin zayıf yönlerini anlatmak", "A competitor preference: point out the current supplier's weaknesses"),
            t("Zamanlama itirazı: karar sürecini ve kimlerin katılacağını sorup Mart öncesine bir değerlendirme görüşmesi koymak", "A timing objection: ask about the decision process and who is involved, and book an evaluation meeting before March"),
            t("İhtiyaç yok itirazı: ürünün özelliklerini daha ayrıntılı yeniden anlatmak", "A no-need objection: explain the product's features again in more detail"),
          ],
          correct: 2,
          internal: "Doğru cevap: zamanlama itirazı. Müşteri ilgisini söylüyor, engel yalnızca sözleşme bitiş tarihi. Doğru hamle fırsatı takvime bağlamak: karar sürecini, katılanları ve Mart öncesi değerlendirme tarihini netleştirmek. İndirim (a) ve rakibi kötülemek (b) zayıf adayların sık seçtiği şıklar.",
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t("Gerçek işe benzeyen iki görev: bir soğuk e-posta ve sesli bir itiraz cevabı. Yaklaşık 15 dakika.", "Two tasks like the real job: a cold e-mail and a spoken reply to an objection. About 15 minutes."),
      purpose: "Kişiye özel ilk temas ve fiyat itirazını değerle karşılama.",
      minutes: 15,
      activities: [
        longText({
          prompt: t(
            "Bir filo takip ve rota planlama yazılımı satıyorsun. Aşağıdaki kişiye ilk soğuk e-postanı yaz (konu satırı ve gövde, en fazla 150 kelime).\n\nKişi: Selin Arslan, Ege Lojistik Operasyon Müdürü, İzmir. Şirketin 120 aracı var.\nBildiklerin: Selin Hanım geçen hafta bir sektör söyleşisinde araç başı aylık yakıt giderinin 9.000 TL'yi geçtiğini ve geciken teslimat şikayetlerinin arttığını söyledi.\nÜrünün: araç başı aylık 450 TL; canlı konum, rota optimizasyonu, gecikme uyarısı.\nReferansın: Marmara Nakliyat (85 araç) ilk 6 ayda yakıt giderini %12 azalttı.",
            "You sell fleet tracking and route planning software. Write your first cold e-mail to the person below (subject line and body, at most 150 words).\n\nPerson: Selin Arslan, Operations Manager at Ege Lojistik, Izmir. The company runs 120 vehicles.\nWhat you know: last week at an industry talk Ms Arslan said monthly fuel cost per vehicle has passed 9,000 TL and complaints about late deliveries have grown.\nYour product: 450 TL per vehicle per month; live location, route optimisation, delay alerts.\nYour reference: Marmara Nakliyat (85 vehicles) cut its fuel cost by 12% in the first 6 months.",
          ),
          competencies: ["commercial", "communication"],
          expected: [
            "Açılışı Selin Hanım'ın söyleşide dile getirdiği yakıt ve gecikme sorununa bağlıyor, kişiye özel",
            "Referansı rakamıyla ama söz vermeden kullanıyor ('benzer bir filoda %12' gibi, 'size de %12 kazandırırız' değil)",
            "Özellik listesi yerine müşterinin kazancını anlatıyor",
            "Tek ve küçük bir sonraki adım istiyor (ör. iki saat seçeneğiyle 15 dakikalık görüşme), kısa ve okunur",
          ],
          redFlags: ["Herkese gidebilecek kalıp bir e-posta, özellik listesi", "Referans sonucunu müşteriye garanti gibi sunuyor ya da uydurma rakam ekliyor", "150 kelimeyi çok aşıyor ya da birden fazla istek içeriyor"],
          examples: {
            1: "Konu: Filo takip çözümümüz. Merhaba, firmamız sektörün lider filo takip yazılımını sunmaktadır. Canlı konum, rota optimizasyonu, gecikme uyarısı gibi birçok özelliğimiz var. Fiyat teklifi için bize dönebilirsiniz.",
            3: "Konu: Yakıt giderleriniz hakkında. Selin Hanım merhaba, söyleşide yakıt giderinin araç başı 9.000 TL'yi geçtiğini söylediniz. Rota optimizasyonumuzla Marmara Nakliyat yakıtta %12 tasarruf etti. Size de anlatmak isterim, uygun olduğunuz bir zaman var mı?",
            5: "Konu: Araç başı 9.000 TL yakıt ve geciken teslimatlar. Selin Hanım merhaba, geçen haftaki söyleşide bu iki sorundan söz ettiniz. 85 araçlık Marmara Nakliyat rota optimizasyonu ve gecikme uyarısıyla ilk altı ayda yakıt giderini %12 azalttı. Ege Lojistik'te sonucun ne olacağını bilmiyorum ama birlikte kaba bir hesap yapabiliriz. Perşembe 10:00 ya da Cuma 15:00'te 15 dakikalık bir görüşme size uyar mı?",
          },
          internal: "Kontrol: referans %12 başka bir firmanın sonucu, müşteriye vaat edilmemeli. Kaba potansiyel: 120 araç x 9.000 TL = 1.080.000 TL aylık yakıt; %12 olursa yaklaşık 129.600 TL. Bu hesabın e-postada kullanılması şart değil; kullanılıyorsa 'olası' diye sunulmalı.",
        }),
        audio({
          prompt: t(
            "Selin Hanım'la ikinci görüşmedesin. Sana şunu söylüyor: \"Fiyatınız çok pahalı. Şu an kullandığımız basit takip sistemi araç başı 300 TL, siz 450 TL istiyorsunuz.\"\n\nYukarıdaki bilgileri kullanabilirsin (120 araç, araç başı aylık yakıt 9.000 TL, referans müşteride %12 yakıt tasarrufu). Ona telefonda vereceğin cevabı sesli kaydet. Yaklaşık 2 dakikan var.",
            "You are on the second call with Ms Arslan. She tells you: \"Your price is too high. The basic tracking system we use now costs 300 TL per vehicle, you are asking 450 TL.\"\n\nYou may use the facts above (120 vehicles, 9,000 TL monthly fuel per vehicle, 12% fuel saving at the reference customer). Record the reply you would give her on the phone. You have about 2 minutes.",
          ),
          competencies: ["commercial", "communication"],
          expected: [
            "İtirazı geçiştirmeden kabul ediyor ve neyle karşılaştırdığını netleştiren bir soru soruyor",
            "Farkı rakamla koyuyor (araç başı 150 TL, 120 araçta aylık 18.000 TL) ve bunu olası yakıt ve gecikme kazancıyla karşılaştırıyor",
            "Sonucu garanti etmiyor; ölçülebilir bir deneme ya da pilot öneriyor",
            "Hemen indirime gitmiyor, net bir sonraki adımla kapatıyor",
          ],
          redFlags: ["İlk cümlede indirim teklif ediyor", "Referans sonucunu kesin söz gibi veriyor", "Rakibi kötülüyor ya da müşteriyle tartışıyor"],
          examples: {
            1: "Haklısınız ama bizim ürünümüz çok daha kaliteli. İsterseniz yöneticime sorup size %20 indirim yapabilirim.",
            3: "Anlıyorum, fark araç başı 150 TL. Ama bizde rota optimizasyonu var, mevcut sisteminizde yok. Marmara Nakliyat bununla yakıtta %12 tasarruf etti, bu farkı fazlasıyla karşılar.",
            5: "Çok haklı bir soru, fark araç başı 150 TL, 120 araçta ayda 18.000 TL ediyor. Size bir şey sorayım: şu anki sistem rota öneriyor mu, gecikmeyi önceden uyarıyor mu? Aylık yakıtınız kabaca 1 milyon TL'nin üstünde; yüzde 2'lik bir iyileşme bile farkı karşılıyor. Marmara Nakliyat'ta %12 oldu ama sizde ne olacağını ikimiz de bilmiyoruz. Önerim şu: 20 araçla 30 günlük bir pilot yapalım, yakıtı ve gecikmeyi ölçelim, rakam ortadayken karar verin. Pilotu başlatmak için gelecek hafta kısa bir toplantı koyalım mı?",
          },
          internal: "Referans hesap: fark 450 - 300 = 150 TL/araç; 120 araçta aylık 18.000 TL. Aylık yakıt 120 x 9.000 = 1.080.000 TL. Farkı karşılamak için gereken tasarruf 18.000 / 1.080.000 = yaklaşık %1,7. Referanstaki %12 (yaklaşık 129.600 TL) olası bir sonuç, garanti değil. Güçlü cevap bu oranı kullanır ve ölçülebilir bir pilot önerir.",
        }),
      ],
    }),
  ],
};
