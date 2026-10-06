import { audio, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const callCenterAgent: HiringTemplate = {
  key: "call-center-agent",
  group: "GENERIC",
  name: t("Çağrı Merkezi Temsilcisi", "Call Centre Agent"),
  summary: t("Yoğun çağrı günü, fatura itirazı ve bekletip aktarma.", "A heavy call day, a disputed invoice and hold-and-transfer."),
  jobAd: t(
    "Gün boyu gelen müşteri çağrılarını karşılayacak, kimlik doğrulamadan kapanışa kadar çağrıyı doğru sırayla yönetecek ve çözemediği talebi doğru ekibe eksiksiz aktaracak bir Çağrı Merkezi Temsilcisi arıyoruz. Art arda zor çağrılarda bile tonunu koruyan ve müşteriye net konuşan biri olmalısın.",
    "We are looking for a Call Centre Agent who answers customer calls all day, runs each call in the right order from verification to close and hands what they cannot solve to the right team with nothing missing. You keep your tone even after several hard calls in a row and speak clearly to the customer.",
  ),
  weights: { customer: 40, resilience: 35, communication: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("İki kısa video sorusu ve bir çağrı akışı sorusu. Yaklaşık 10 dakika.", "Two short video questions and one call-flow question. About 10 minutes."),
      purpose: "Art arda zor çağrılar sonrası toparlanma, çağrıda çözülemeyen talebin takibi ve çağrı akışı bilgisi.",
      minutes: 10,
      activities: [
        video({
          prompt: t(
            "Art arda birçok zor çağrı aldığın bir günü anlat: en zor çağrıda müşteri ne dedi, sen tam olarak ne cevap verdin, bir sonraki çağrıya geçmeden toparlanmak için ne yaptın ve sonrasında çalışma biçiminde neyi değiştirdin?",
            "Tell us about a day when you took many hard calls in a row: on the hardest call what did the customer say, what exactly did you reply, what did you do to recover before the next call, and what did you change in how you work afterwards?",
          ),
          competencies: ["resilience", "customer"],
          expected: [
            "En zor çağrıda müşterinin ve kendisinin söylediğini somut aktarıyor",
            "Çağrılar arasında toparlanmak için yaptığı somut bir şeyi söylüyor (kısa not, nefes, ekip liderine danışma)",
            "Müşteriye yine çözüm ya da net bir sonraki adım sunduğunu anlatıyor",
            "Sonradan değiştirdiği bir alışkanlığı ya da yöntemi söylüyor",
          ],
          redFlags: ["Somut bir gün yerine 'ben hep sakinimdir' diyor", "Müşterilere kızdığını ya da çağrıyı yüzüne kapattığını normal anlatıyor", "Zorluğu tamamen müşterilere ya da sisteme yüklüyor"],
          examples: {
            1: "Bu iş zaten stresli, müşteriler bağırınca ben de sesimi yükseltirdim, sonra geçiyordu.",
            3: "Kesinti günüydü, bir müşteri bana 'beceriksiz' dedi. 'Sizi anlıyorum, kesintiyi şu an teknik ekip çözüyor, saat 15'te kontrol edip SMS atacağız' dedim. Çağrıdan sonra bir dakika mola tuşuna basıp su içtim, sonraki çağrıya öyle girdim.",
            5: "Kesinti günü 60'tan fazla çağrı aldım. Bir müşteri işini kaybedeceğini söyleyip bağırdı; sözünü kesmeden dinledim, 'işinizin aksaması gerçekten ciddi, size mobil veri tanımlayabilirim' dedim ve tanımladım. Sonra 30 saniye not alıp nefes verdim. O günden sonra kesinti günlerinde ekip liderinden hazır bir durum metni istiyorum ve her beş çağrıda bir kısa not molası veriyorum; sonraki kesintide ortalama çağrı sürem düştü.",
          },
        }),
        video({
          prompt: t(
            "Çağrı sırasında çözemediğin bir müşteri talebini anlat: müşteriye çağrıyı kapatmadan önce ne söyledin, takibi nasıl yaptın ve sonuç ne oldu?",
            "Tell us about a customer request you could not solve during the call: what did you tell the customer before ending the call, how did you follow up, and what was the result?",
          ),
          competencies: ["customer", "communication"],
          expected: [
            "Çözemediğini açıkça söyleyip müşteriye ne olacağını ve ne zaman döneceğini anlattığını aktarıyor",
            "Talebi kayda geçirip ilgili ekibe eksiksiz aktardığını söylüyor",
            "Söz verdiği zamanda müşteriye döndüğünü ya da takibi kendisinin yaptığını anlatıyor",
          ],
          redFlags: ["Müşteriye 'biz sizi ararız' deyip takip etmiyor", "Yetkisi olmayan bir çözüm sözü verdiğini anlatıyor"],
          examples: {
            1: "Teknik ekibe aktardım, sonrası onların işi.",
            3: "Müşteriye fatura düzeltmesini muhasebenin yapacağını, iki iş günü içinde SMS geleceğini söyledim, kayıt açtım. Düzeltme yapıldı.",
            5: "Bunu çağrıda çözemeyeceğimi, kaydı açıp muhasebeye bugün ileteceğimi ve iki iş günü içinde sonucu SMS ile alacağını söyledim, kayıt numarasını verdim. İkinci gün kaydı kontrol ettim, hâlâ açıktı; muhasebeye yazıp müşteriyi aradım, durumu anlattım. Üçüncü gün kapandı.",
          },
        }),
        single({
          prompt: t(
            "Bir müşteri faturasıyla ilgili arıyor. Çağrıyı yönetmek için en doğru sıra hangisi?",
            "A customer calls about their invoice. What is the right order for handling the call?",
          ),
          options: [
            t("Kimlik doğrula, selamla, sorunu çöz, kapat, özetle", "Verify identity, greet, solve the issue, close, summarise"),
            t("Selamla, sorunu çöz, kimlik doğrula, özetle, kapat", "Greet, solve the issue, verify identity, summarise, close"),
            t("Selamla, kimlik doğrula, sorunu çöz, kapat, özetle", "Greet, verify identity, solve the issue, close, summarise"),
            t("Selamla, kimlik doğrula, sorunu dinleyip çöz, yapılanı özetle, kapat", "Greet, verify identity, listen to and solve the issue, summarise what was done, close"),
          ],
          correct: 3,
          internal: "Doğru sıra: selamlama, kimlik doğrulama (fatura bilgisi paylaşılmadan önce), sorunu dinleme ve çözme, yapılanı ve sonraki adımı özetleme, kapanış. (b) kimliği doğrulamadan hesap bilgisi konuşur, (a) ve (c) özeti kapanıştan sonraya bırakır.",
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t("Gerçek çağrılara benzeyen iki sesli görev. Yaklaşık 12 dakika.", "Two spoken tasks like real calls. About 12 minutes."),
      purpose: "Fatura itirazında açıklama ve beklenti yönetimi, bekletip sıcak aktarma.",
      minutes: 12,
      activities: [
        audio({
          prompt: t(
            "Kimliği doğrulanmış bir müşteri arıyor ve şunu söylüyor:\n\n\"Bu ay faturam 689 TL gelmiş! Ben 399 TL'lik paketteyim. Ek bir şey almadım, bunu kabul etmiyorum. Düzeltmezseniz aboneliğimi iptal edeceğim!\"\n\nEkranında gördüklerin:\n- Paket ücreti: 399 TL\n- 10 GB ek internet paketi: 190 TL (12 Eylül 21:14, müşterinin hattından SMS onayıyla alınmış)\n- Modem taksiti (12 taksitin 5.si): 100 TL\n- Toplam: 689 TL\n\nYetkin: fatura kalemlerini açıklamak ve itiraz kaydı açmak (sonuç 3 iş günü içinde SMS ile bildirilir). İade yetkin yok; iptal talepleri müşteri ilişkileri ekibine aktarılır.\n\nMüşteriye vereceğin cevabı, telefonda konuşur gibi sesli kaydet.",
            "A verified customer calls and says:\n\n\"My bill this month is 689 TL! I am on the 399 TL plan. I did not buy anything extra and I do not accept this. If you do not fix it I will cancel my subscription!\"\n\nWhat you see on your screen:\n- Plan fee: 399 TL\n- 10 GB extra data pack: 190 TL (12 September 21:14, bought from the customer's line with SMS approval)\n- Modem instalment (5th of 12): 100 TL\n- Total: 689 TL\n\nYour authority: explain the invoice lines and open a dispute (the result is sent by SMS within 3 working days). You cannot give refunds; cancellation requests go to the customer relations team.\n\nRecord your reply to the customer as you would say it on the phone.",
          ),
          answer: 180,
          competencies: ["customer", "communication"],
          expected: [
            "Önce müşterinin tepkisini karşılıyor, savunmaya geçmeden kalemleri tek tek açıklıyor (399 + 190 + 100 = 689)",
            "Ek paketi müşteriyi suçlamadan anlatıyor (tarih, saat, SMS onayı) ve müşteri almadığını söylüyorsa itiraz kaydı açmayı öneriyor",
            "Modem taksitini hatırlatıyor ve yetkisi dışında iade sözü vermiyor",
            "İptal tehdidine baskı yapmadan cevap veriyor, yapılanı ve 3 iş günü süresini özetleyip kapatıyor",
          ],
          redFlags: ["'Siz almışsınız, sistem yanlış yapmaz' gibi suçlayıcı bir dil kullanıyor", "Yetkisi olmadığı halde 190 TL'yi iade edeceğini söylüyor", "Kalemleri açıklamadan çağrıyı iptal ekibine aktarıyor"],
          examples: {
            1: "Efendim, sistemde 689 TL görünüyor, ek paket almışsınız. Yapacak bir şey yok, isterseniz iptal ekibine aktarayım.",
            3: "Faturanın beklediğinizden yüksek gelmesi can sıkıcı, hemen bakalım. 399 TL paketiniz, 100 TL modem taksitiniz ve 12 Eylül'de alınmış 190 TL'lik 10 GB ek paket var. Bu paketi siz almadıysanız itiraz kaydı açabilirim, 3 iş günü içinde SMS ile sonuç gelir.",
            5: "Beklemediğiniz bir tutar görmek insanı kızdırır, birlikte kalem kalem bakalım. 399 TL paket ücretiniz. 100 TL, 12 taksitli modeminizin 5. taksiti. Kalan 190 TL, 12 Eylül 21:14'te hattınızdan SMS onayıyla alınmış 10 GB ek paket. Siz onaylamadıysanız şimdi itiraz kaydı açıyorum; iadeye o ekip karar veriyor, ben söz veremem. İptali yine de isterseniz sizi müşteri ilişkilerine aktarırım ama önce itirazın sonucunu görmenizi öneririm. Özetle: itiraz kaydınız açıldı, sonuç 3 iş günü içinde SMS ile gelecek. Başka bir konuda yardımcı olabilir miyim?",
          },
          internal: "Referans: toplam 399 + 190 + 100 = 689 TL, fatura matematiği doğru. Güçlü cevapta üç kalem açıklanır, ek paket suçlamadan (tarih, saat, SMS onayı) anlatılır, itiraz kaydı önerilir, iade sözü verilmez, iptal baskısız ele alınır, sonunda özet ve 3 iş günü süresi söylenir.",
        }),
        audio({
          prompt: t(
            "Kimliğini doğruladığın müşteri Ahmet Yılmaz'ın (abone no 4471 2290) evinde bu sabah 09:30'dan beri internet yok. Modemin ışığı kırmızı yanıyor; uzaktan yeniden başlattın, değişmedi. Arıza teknik destek ekibine sıcak aktarmayla devredilmeli, aktarma yaklaşık 2 dakika sürecek.\n\nÖnce müşteriye bekletme ve aktarma için söyleyeceklerini, ardından hattı devralan teknik destek arkadaşına söyleyeceklerini sesli kaydet.",
            "You have verified the customer Ahmet Yılmaz (subscriber no 4471 2290). His home internet has been down since 09:30 this morning. The modem light is red; you restarted it remotely and nothing changed. The fault must go to the technical support team by warm transfer, which takes about 2 minutes.\n\nRecord first what you say to the customer about the hold and the transfer, then what you say to the technical support colleague who takes over the line.",
          ),
          competencies: ["communication", "customer"],
          expected: [
            "Müşteriden bekletme için izin istiyor, nedenini ve yaklaşık 2 dakikalık süreyi söylüyor",
            "Müşteriye kime ve neden aktarıldığını, aynı şeyleri tekrar anlatmak zorunda kalmayacağını söylüyor",
            "Teknik destek arkadaşına kimliğin doğrulandığını, abone numarasını, arızanın başlangıcını, modem ışığını ve denenen adımı eksiksiz aktarıyor",
          ],
          redFlags: ["Habersiz bekletiyor ya da soğuk aktarma yapıyor", "Devirde bilgiyi eksik veriyor, müşteri baştan anlatmak zorunda kalıyor", "Arızanın ne zaman düzeleceğine dair söz veriyor"],
          examples: {
            1: "Sizi teknik desteğe aktarıyorum, iyi günler. (Arkadaşa:) İnternet sorunu var.",
            3: "Ahmet Bey, arızayı teknik destek ekibimiz çözecek, sizi şimdi onlara aktarıyorum, iki dakika kadar bekleyebilir misiniz? (Arkadaşa:) Ahmet Yılmaz, abone 4471 2290, sabahtan beri internet yok, modem kırmızı yanıyor.",
            5: "Ahmet Bey, modemi uzaktan yeniden başlattım ama ışık hâlâ kırmızı, bu yüzden arızayı teknik destek uzmanımız inceleyecek. Sizi hatta tutarak onlara aktarmam gerekiyor, yaklaşık 2 dakika sürecek; bekleyebilir misiniz? Anlattıklarınızı ona ben aktaracağım, baştan anlatmanıza gerek kalmayacak. (Arkadaşa:) Merhaba, hatta Ahmet Yılmaz var, kimliği doğrulandı, abone no 4471 2290. Bugün 09:30'dan beri internet yok, modem ışığı kırmızı, uzaktan yeniden başlattım, değişmedi. Hattı sana bağlıyorum. (Müşteriye:) Ahmet Bey, teknik destek uzmanımız hatta, iyi günler dilerim.",
          },
        }),
      ],
    }),
  ],
};
