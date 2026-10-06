import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const executiveAssistant: HiringTemplate = {
  key: "executive-assistant",
  group: "GENERIC",
  name: t("Yönetici Asistanı", "Executive Assistant"),
  summary: t("Çakışan öncelikler, takvim, gelen kutusu sıralaması ve toplantı özeti.", "Clashing priorities, the calendar, inbox triage and a meeting summary."),
  jobAd: t(
    "Genel müdürümüzün takvimini, yazışmalarını, seyahatlerini ve toplantı takibini yönetecek bir Yönetici Asistanı arıyoruz. İşleri gerekçeyle önceliklendiren, kısa ve net yazan ve kendisine emanet edilen bilgiyi koruyan biri olmalısın.",
    "We are looking for an Executive Assistant who manages our general manager's calendar, correspondence, travel and meeting follow-up. You prioritise with a reason, write short and clear messages and protect the information you are trusted with.",
  ),
  weights: { organisation: 40, communication: 35, integrity: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("İki kısa video sorusu ve bir takvim sorusu. Yaklaşık 10 dakika.", "Two short video questions and one calendar question. About 10 minutes."),
      purpose: "Çakışan önceliklerde sıralama, gizli bilgi talebine cevap ve takvim çakışması muhakemesi.",
      minutes: 10,
      activities: [
        video({
          prompt: t(
            "Önceliklerin birbiriyle çakıştığı yoğun bir haftayı anlat: hangi işler aynı anda geldi, hangisini neden öne aldın, kime ne haber verdin ve hafta sonunda sonuç ne oldu?",
            "Tell us about a busy week when priorities clashed: which tasks came in at the same time, which did you put first and why, whom did you tell what, and what was the result at the end of the week?",
          ),
          competencies: ["organisation", "communication"],
          expected: [
            "Çakışan işleri somut sayıyor (ne, kimin için, hangi son tarih)",
            "Sıralamayı bir ölçüte bağlıyor (son tarih, etki, yalnızca kendisinin yapabileceği iş)",
            "Erteleyeceği işin sahibine önceden haber verdiğini ya da yöneticisiyle önceliği teyit ettiğini anlatıyor",
            "Takibi nasıl kurduğunu ve sonucu söylüyor",
          ],
          redFlags: ["Her şeyi aynı anda, fazla mesaiyle yetiştirdiğini anlatıyor; sıralama ve gerekçe yok", "Ertelediği işi kimseye haber vermeden geciktirmiş"],
          examples: {
            1: "Hep yoğunuz, ben de geç saate kadar kalıp hepsini bitiririm.",
            3: "Aynı hafta yönetim kurulu sunumu, yurt dışı seyahat ve ofis taşınması vardı. Sunum son tarihi en yakın olduğu için önce onu bitirdim, taşınma işini bir gün ertelediğimi ofis müdürüne söyledim.",
            5: "Pazartesi üç iş geldi: Perşembe'ye yönetim kurulu sunumu, Çarşamba sabahki Londra seyahatinin vize randevusu ve taşınma için tedarikçi teklifleri. Vize randevusunu yalnızca ben alabiliyordum ve kaçarsa seyahat iptal olurdu, ilk ona baktım. Sunumu saatlere böldüm, Salı akşamı taslağı yöneticime gönderdim. Teklif işini ofis müdürüyle konuşup Cuma'ya aldık. Herkesi Pazartesi öğlen bilgilendirdim; üç iş de zamanında bitti, o haftadan sonra Pazartesi sabahı yöneticimle 10 dakikalık bir öncelik görüşmesi koyduk.",
          },
        }),
        video({
          prompt: t(
            "Birinin senden, paylaşmaman gereken bir bilgiyi (yöneticinin takvimi, bir maaş bilgisi, gizli bir belge gibi) istediği bir durumu anlat: kişi ne istedi, sen tam olarak ne dedin, ne yaptın ve sonuç ne oldu?",
            "Tell us about a time someone asked you for information you should not share (your manager's calendar, salary information, a confidential document and so on): what did they ask for, what exactly did you say, what did you do, and what was the result?",
          ),
          competencies: ["integrity", "communication"],
          expected: [
            "Talebi ve kendi cevabını somut aktarıyor",
            "Bilgiyi paylaşmadan ama ilişkiyi bozmadan nazikçe reddettiğini söylüyor",
            "Kişiyi doğru kanala ya da yetkili kişiye yönlendirdiğini ya da durumu yöneticisine bildirdiğini anlatıyor",
          ],
          redFlags: ["Tanıdık olduğu için bilgiyi paylaştığını normal anlatıyor", "Somut bir olay yerine 'ben gizliliğe önem veririm' diyor"],
          examples: {
            1: "Arkadaşım olduğu için sadece ona söyledim, zaten kimseye söylemeyecekti.",
            3: "Bir müdür yöneticimin yeni yıl bütçe sunumunu istedi. 'Bunu paylaşamıyorum, Genel Müdür'den isteyebilirsiniz' dedim.",
            5: "Satıştan bir müdür, terfi listesinin çıkıp çıkmadığını ve kendi adının olup olmadığını sordu. 'Sizi anlıyorum ama bu listeyi paylaşmam mümkün değil, İK duyuracak' dedim. İsterse Genel Müdür'le 15 dakikalık bir görüşme ayarlayabileceğimi söyledim, ayarladım. Yöneticime de bu tür taleplerin geldiğini haber verdim; sonrasında gizli belgeleri ortak klasörden ayırıp yalnızca ikimizin erişebildiği bir klasöre taşıdık.",
          },
        }),
        single({
          prompt: t(
            "Yöneticinin Perşembe takvimi: 09:00-10:00 yönetim toplantısı, 14:00-14:30 Pazarlama Direktörü ile haftalık birebir (her hafta tekrarlanıyor), 15:00-16:00 boş. Önemli bir yatırımcı, saat farkı nedeniyle yalnızca Perşembe 14:00-15:00 arasında görüşebileceğini yazıyor ve yöneticin bu görüşmenin olmasını istiyor. En doğru adım hangisi?",
            "Your manager's Thursday: 09:00-10:00 management meeting, 14:00-14:30 weekly one-to-one with the Marketing Director (recurring), 15:00-16:00 free. An important investor writes that, because of the time difference, they can only meet on Thursday 14:00-15:00, and your manager wants this meeting to happen. What is the best step?",
          ),
          options: [
            t("Yatırımcı görüşmesini 14:00'e koymak, Pazarlama Direktörü'ne nedenini söyleyip birebiri 15:00'e almayı önermek", "Book the investor at 14:00, tell the Marketing Director why and offer to move the one-to-one to 15:00"),
            t("Yatırımcıya Perşembe 15:00'i önermek, çünkü o saat boş", "Offer the investor Thursday 15:00, because that slot is free"),
            t("İki toplantıyı da 14:00'te bırakıp yöneticinin o anda seçmesini beklemek", "Leave both meetings at 14:00 and let your manager choose on the spot"),
            t("Birebiri Pazarlama Direktörü'ne haber vermeden takvimden silmek", "Delete the one-to-one from the calendar without telling the Marketing Director"),
          ],
          correct: 0,
          internal: "Doğru cevap: yatırımcıyı 14:00'e koy, tekrarlanan iç toplantıyı haber vererek boş 15:00'e taşı. Yatırımcının tek uygun saati 14:00-15:00 (b bu kısıtı yok sayar), çift rezervasyon (c) kararı son ana bırakır, habersiz silmek (d) iç paydaşı bilgisiz bırakır.",
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t("Gerçek işe benzeyen iki yazılı görev: gelen kutusunu sıralamak ve toplantı özeti yazmak. Yaklaşık 20 dakika.", "Two written tasks like the real job: triaging an inbox and writing a meeting summary. About 20 minutes."),
      purpose: "Gerekçeli önceliklendirme, gizli bilgi talebini fark etme ve kararları eksiksiz, sahipli bir özete dökme.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Pazartesi 08:30. Yöneticin Elif Hanım bugün 14:00 uçağıyla Ankara'ya gidecek, akşam 19:00'da bir müşteri yemeği var. Gelen kutundaki 5 iletiyi ilgilenme sırana göre sırala; her biri için neden o sırada olduğunu ve ne yapacağını bir iki cümleyle yaz.\n\n1) Ofis yöneticisi: \"Yeni otopark kartın hazır, bu hafta istediğin zaman alabilirsin.\"\n2) Havayolu: \"14:00 Ankara uçuşunuz iptal edildi. Alternatifler: bugün 16:30 ya da yarın 07:00.\"\n3) Finans: \"Yönetim kurulu sunumunun Elif Hanım onaylı son hali Çarşamba 17:00'ye kadar bizde olmalı.\"\n4) Satış bölümünden bir müdür: \"Elif Hanım'ın ekip maaş artışı taslağını bana atar mısın? Sadece kendi ekibimi görmek istiyorum, kimseye söylemem.\"\n5) Bir sektör derneği: \"İki ay sonraki konferansımız için katılım bilgisini Cuma'ya kadar bekliyoruz.\"",
            "Monday 08:30. Your manager Elif is flying to Ankara on the 14:00 flight today and has a customer dinner there at 19:00. Rank the 5 messages in your inbox in the order you will handle them; for each, write in a sentence or two why it is in that place and what you will do.\n\n1) Office manager: \"Your new parking card is ready, you can pick it up any time this week.\"\n2) Airline: \"Your 14:00 Ankara flight has been cancelled. Alternatives: today 16:30 or tomorrow 07:00.\"\n3) Finance: \"We need the final board presentation approved by Elif by Wednesday 17:00.\"\n4) A manager from Sales: \"Could you send me Elif's draft of the team salary increases? I only want to see my own team, I won't tell anyone.\"\n5) An industry association: \"We need your attendance confirmation for our conference in two months by Friday.\"",
          ),
          competencies: ["organisation", "integrity"],
          expected: [
            "İptal edilen uçuşu ilk sıraya koyuyor; 16:30 uçuşunun 19:00 yemeğine yetişip yetişmediğini düşünüyor, Elif Hanım'a seçenekleri sunup yeri hemen tutuyor ya da yemeği haber vererek kaydırmayı öneriyor",
            "Maaş taslağı talebini paylaşmıyor; nazikçe reddedip talebi Elif Hanım'a ya da İK'ya yönlendiriyor ve Elif Hanım'ı bilgilendiriyor",
            "Sunum onayını Çarşamba 17:00 son tarihine göre takvime bağlıyor (ör. Elif Hanım'a Salı onay zamanı koyuyor)",
            "Dernek ve otopark kartını son sıralara koyup ne zaman yapacağını söylüyor",
          ],
          redFlags: ["Maaş taslağını, kısmen bile olsa, gönderiyor", "Uçuş iptalini ilk sıraya koymuyor ya da Elif Hanım'a sormadan karar verip haber vermiyor", "Sıralama veriyor ama gerekçe yazmıyor"],
          examples: {
            1: "1, 2, 3, 4, 5. Hepsine bugün dönerim. Maaş taslağını da sadece kendi ekibi olduğu için gönderirim.",
            3: "Önce uçuş: 16:30'a yer tutup Elif Hanım'a haber veririm. Sonra satış müdürüne taslağı paylaşamayacağımı yazarım. Sonra sunum için Elif Hanım'dan onay zamanı alırım. Dernek Cuma'ya kadar, otopark kartı en son.",
            5: "1) Uçuş (2): bugün, en acil. 16:30 uçuşu 19:00 yemeğine büyük olasılıkla yetişir; yeri hemen opsiyonlar, Elif Hanım'a iki seçeneği yazıp onay alır, transferi ayarlarım. 2) Maaş taslağı (4): kısa ama hassas. 'Bu taslağı paylaşamıyorum, Elif Hanım ya da İK'dan isteyebilirsiniz' yazarım, hiçbir kısmını göndermem, Elif Hanım'a bilgi veririm. 3) Sunum (3): son tarih Çarşamba 17:00; yarın 10:00'a 30 dakikalık onay zamanı koyarım. 4) Dernek (5): takvime bakıp Elif Hanım'a sorar, Cuma'dan önce cevaplarım. 5) Otopark kartı (1): hafta içinde alırım.",
          },
          internal: "Referans sıralama: 2 (uçuş, bugün, en acil) > 4 (gizli bilgi talebi, kısa sürede reddedilmeli) ya da 3 (Çarşamba 17:00 son tarih) > 5 (Cuma) > 1 (bu hafta, yalnızca adayı ilgilendiriyor). 4 ile 3'ün yeri gerekçeli olduğu sürece yer değiştirebilir. Kritik iki nokta: uçuş ilk sırada ve maaş taslağı hiçbir biçimde paylaşılmıyor. İstanbul çıkışı varsayılırsa 16:30 uçuşu yaklaşık 1 saat 10 dakika sürer, 19:00 yemeğine yetişmek mümkün; yarın 07:00 seçeneği yemeğin kaçırılması demek.",
        }),
        longText({
          prompt: t(
            "Aşağıdaki toplantı notlarından, toplantıya katılan herkese gidecek özet e-postasını yaz.\n\nNotlar (Elif Hanım'ın elinden, 6 Ekim, Q4 lansman toplantısı)\nKatılanlar: Elif (Genel Müdür), Can (Pazarlama), Deniz (Satış), Burak (Ürün)\n- lansman 14 Kasım'dan 21 Kasım'a, KESİN\n- lansman bütçesi 450 bin TL onaylandı (Elif)\n- Can: basın bülteni taslağı, 20 Ekim\n- Deniz: ilk 10 hedef müşteri listesi, \"gelecek hafta\"\n- Burak: beta hataları kapanacak, \"test bitince\"\n- fuar katılımı? karar 13 Ekim toplantısında\n- ÖZEL: Burak'ın ekibine 2 kişilik ek alım henüz duyurulmadı, e-postaya koyma",
            "From the meeting notes below, write the summary e-mail that goes to everyone who attended.\n\nNotes (handwritten by Elif, 6 October, Q4 launch meeting)\nAttendees: Elif (General Manager), Can (Marketing), Deniz (Sales), Burak (Product)\n- launch moves from 14 Nov to 21 Nov, FINAL\n- launch budget 450k TL approved (Elif)\n- Can: press release draft, 20 Oct\n- Deniz: first 10 target customers list, \"next week\"\n- Burak: beta bugs to be closed, \"when testing ends\"\n- trade fair attendance? decision at the 13 Oct meeting\n- PRIVATE: 2 extra hires for Burak's team not announced yet, keep out of the e-mail",
          ),
          competencies: ["communication", "organisation"],
          expected: [
            "Kararları (21 Kasım lansman tarihi, 450 bin TL bütçe), aksiyonları ve açık konuyu ayrı başlıklarda net yazıyor",
            "Her aksiyona sahip ve tarih koyuyor; belirsiz tarihleri ('gelecek hafta', 'test bitince') fark edip Deniz ve Burak'tan kesin tarih istiyor",
            "Fuar kararını 13 Ekim toplantısına açık konu olarak bağlıyor",
            "Özel notu e-postaya koymuyor",
          ],
          redFlags: ["Ek alım bilgisini e-postaya yazıyor", "Notları olduğu gibi kopyalıyor; karar ile aksiyon ayrılmamış", "Belirsiz tarihleri sorgulamadan bırakıyor"],
          examples: {
            1: "Merhaba, toplantı notları aşağıdadır: lansman 21 Kasım, bütçe 450 bin, Can basın bülteni, Deniz müşteri listesi, Burak beta hataları, fuar sonra konuşulacak, Burak'ın ekibine 2 kişi alınacak. İyi çalışmalar.",
            3: "Konu: Q4 lansman toplantısı özeti (6 Ekim). Kararlar: lansman 21 Kasım, bütçe 450 bin TL. Aksiyonlar: Can basın bülteni taslağı 20 Ekim; Deniz ilk 10 müşteri listesi gelecek hafta; Burak beta hataları. Açık konu: fuar katılımı 13 Ekim'de karara bağlanacak.",
            5: "Konu: Q4 lansman toplantısı özeti (6 Ekim). Merhaba, KARARLAR: Lansman 14 Kasım'dan 21 Kasım'a alındı, tarih kesin. Lansman bütçesi 450.000 TL onaylandı. AKSİYONLAR: Can, basın bülteni taslağı, 20 Ekim. Deniz, ilk 10 hedef müşteri listesi; 'gelecek hafta' dendi, 16 Ekim uygun mu? Burak, beta hatalarının kapanması; lansman 21 Kasım olduğuna göre test bitiş tarihini yazabilir misin? AÇIK KONU: Fuar katılımı 13 Ekim toplantısında karara bağlanacak. Eksik bir nokta varsa bu akşama kadar yazarsanız güncellerim.",
          },
          internal: "Notlarda yerleştirilmiş noktalar: (1) Deniz'in tarihi belirsiz ('gelecek hafta'), (2) Burak'ın tarihi yok ('test bitince'; ince, çünkü lansman tarihine bağlı bir risk), (3) ÖZEL not: ek alım bilgisi e-postada olmamalı. Güçlü cevap üçünü de ele alır; özel notu e-postaya koymak tek başına ciddi bir kırmızı bayraktır.",
        }),
      ],
    }),
  ],
};
