import { longText, single, stage, t, video } from "../build";
import { germanProficiencyStage } from "../german-proficiency-stage";
import type { HiringTemplate } from "../types";

export const onlineGermanTeacher: HiringTemplate = {
  key: "online-german-teacher",
  group: "LANGUAGE_SCHOOL",
  name: t("Online Almanca Öğretmeni", "Online German Teacher"),
  summary: t(
    "Online grubu aktif tutma, araç seçimi, kamerada etkileşimli bir ders açılışı, sessiz öğrenci planı ve C1 hedefli Almanca yeterlik.",
    "Keeping an online group active, choosing a tool, an interactive lesson opening on camera, a plan for a silent learner and a German check aimed at C1.",
  ),
  jobAd: t(
    "Video konferansla yürüttüğümüz online Almanca kurslarımızda yetişkin gruplara ders verecek bir Online Almanca Öğretmeni arıyoruz. Ekranın karşısındaki herkesi ilk dakikadan derse katan, araçları amaca göre seçen ve kamerası kapalı, sessiz öğrenciyi de kaybetmeyen biri olmalısın. Almancan en az C1 düzeyinde olmalı.",
    "We are looking for an Online German Teacher for our adult groups taught by video conference. You involve everyone on the other side of the screen from the first minute, choose tools to suit the aim and do not lose the quiet learner whose camera stays off. Your German is at least at C1 level.",
  ),
  weights: { didactics: 40, german_proficiency: 35, communication: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("Bir senaryo sorusu ve bir video sorusu. En fazla 7 dakika.", "One scenario question and one video question. At most 7 minutes."),
      purpose: "Online derste amaca uygun araç seçimi; bir online grubu gerçekte nasıl aktif tuttuğu.",
      minutes: 7,
      activities: [
        single({
          prompt: t(
            "Video konferansla yürüyen bir A2 dersinde (10 öğrenci) sınav tarzı bir dinleme çalışması yapacaksın. Kendi bilgisayarındaki 2 dakikalık ses kaydını herkes aynı anda ve iyi kalitede duymalı; sen de kaydı bölüm bölüm durdurup soru sorabilmelisin. Hangisi bu amaca en uygun?",
            "In an A2 lesson held by video conference (10 learners) you run an exam-style listening task. Everyone must hear the 2-minute recording on your computer at the same time and in good quality, and you must be able to pause it section by section to ask questions. Which option fits this aim best?",
          ),
          options: [
            t("Kaydı bilgisayarın hoparlöründen çalıp sesin mikrofondan gruba gitmesini sağlamak", "Play the recording through the computer speakers so the microphone carries it to the group"),
            t("Ekran paylaşımını bilgisayar sesini paylaşma seçeneği açık olarak başlatıp kaydı çalmak", "Start screen sharing with the share-computer-sound option switched on and play the recording"),
            t("Ses dosyasını sohbete yükleyip herkesin aynı anda kendi cihazında başlatmasını istemek", "Upload the audio file to the chat and ask everyone to start it on their own device at the same time"),
            t("Yalnızca ses oynatıcının penceresini ekran paylaşımıyla paylaşıp kaydı çalmak", "Share only the audio player's window with screen sharing and play the recording"),
          ],
          correct: 1,
          internal:
            "Doğru cevap: ekran paylaşımını bilgisayar sesi seçeneği açık başlatmak (Zoom'da 'Share sound', Teams'te 'Include computer sound' gibi). Ses doğrudan gider, mikrofon ve gürültü bastırma kaliteyi bozmaz, öğretmen durdurup soru sorabilir. Çeldiriciler: hoparlörden mikrofona (yankı ve gürültü; gürültü bastırma sesi keser; en sık hata); dosyayı herkese verip aynı anda başlatmak (eşzamanlılık ve bölüm bölüm durdurma kontrolü kaybolur); yalnızca pencereyi paylaşmak (görüntü gider, bilgisayar sesi seçeneği açılmadan ses gitmez).",
        }),
        video({
          prompt: t(
            "Online bir grubu derse katmakta zorlandığın bir dersi anlat (kurs, okul, özel ders ya da staj sırasında): ne oldu, hangi araç ya da yöntemle öğrencileri yeniden derse kattın, sonraki derslerde neyi değiştirdin ve sonuç ne oldu?",
            "Tell us about an online lesson where you struggled to get the group involved (in a course, a school, private lessons or a teaching placement): what happened, which tool or method did you use to bring the learners back in, what did you change in the following lessons, and what was the result?",
          ),
          competencies: ["didactics", "communication"],
          expected: [
            "Durumu somut anlatıyor (grup, düzey, hangi anda sessizlik oldu)",
            "Amaca uygun bir araç ya da yöntemi gerekçesiyle seçtiğini anlatıyor (ikili oda, sohbet şelalesi, ortak belge, isimle soru)",
            "Sonraki derslerde kalıcı bir düzen kurduğunu söylüyor (kısa bloklar, düzenli etkileşim aralığı, rol dağıtımı)",
            "Sonucu ve katılımı nasıl izlediğini söylüyor",
          ],
          redFlags: ["Etkileşimi yalnızca 'soru sorarım' ya da 'kameraları açtırırım' ile sınırlıyor", "Somut bir ders yerine genel laflar ediyor"],
          examples: {
            1: "Online derste öğrenciler zaten pasif olur. Ben anlatırım, sorusu olan sorar.",
            3: "B1 online grubunda ilk 20 dakika kimse konuşmuyordu. Öğrencileri ikişerli odalara gönderip üç soru verdim, dönüşte her ikiliden bir cevap aldım. Sonraki derslerde her dersi ikili odayla başlattım, katılım arttı.",
            5: "A2 akşam grubunda sunum aşamasında herkes sessizdi, kameralar kapalıydı. O an sohbet şelalesi yaptım: herkes cevabını yazıp bekler, ben 'jetzt' deyince birlikte gönderir; kimse ötekini beklemedi. Sonra rol kartlarıyla ikili odalara gönderdim. Sonraki derslerde akışı 10 dakikalık bloklara böldüm, her blokta bir sohbet ya da oda etkinliği koydum, konuşmayanları not edip ilk soruyu onlara yönelttim. Bir ay sonra herkes her derste en az bir kez mikrofonla konuşuyordu.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Önce kameraya iki dakikalık bir ders açılışı, sonra sessiz bir öğrenci için yazılı bir plan. En fazla 18 dakika.",
        "First a two-minute lesson opening to the camera, then a written plan for a silent learner. At most 18 minutes.",
      ),
      purpose: "Kamerada A2'ye uygun öğretmen dili ve ilk dakikadan etkileşim; kamerası kapalı, sessiz bir öğrenciyi baskı kurmadan derse katma planı. Video önce, çünkü süresi sınırlı.",
      minutes: 18,
      activities: [
        video({
          prompt: t(
            "Online bir A2 dersinin ilk 2 dakikası: video konferansta 8 yetişkin öğrenci var, bugünün hedefi „Im Restaurant bestellen und reklamieren“. Kameraya, karşında bu öğrenciler varmış gibi Almanca konuş: dersi aç, hedefi söyle ve ilk 2 dakikada herkesi aktif hâle getir (ör. sohbet, tepki düğmeleri, isimle soru). Hangi aracı kullandığını ve öğrencilerden ne beklediğini söyleyerek göster.",
            "The first 2 minutes of an online A2 lesson: 8 adult learners are in the video conference, today's aim is „Im Restaurant bestellen und reklamieren“. Speak German to the camera as if these learners were in front of you: open the lesson, state the aim and get everyone active within the first 2 minutes (for example chat, reaction buttons, questions by name). Show it by saying which tool you use and what you expect the learners to do.",
          ),
          competencies: ["didactics", "communication"],
          expected: [
            "A2'ye uygun, kısa ve yavaş bir Almanca konuşuyor; yönergeyi adım adım ve gösterir gibi veriyor",
            "İlk 2 dakikada herkesin katıldığı bir etkinlik kuruyor (sohbet şelalesi, tepki, isimle soru) ve kameraya doğrudan, sıcak bir dille hitap ediyor",
            "Dersin hedefini öğrencinin hayatından bir durumla bağlıyor (Was bestellen Sie gern?)",
            "Cevapları nasıl toplayacağını ve kimi nasıl söze davet edeceğini gösteriyor",
          ],
          redFlags: ["İlk 2 dakikayı tek yönlü anlatımla geçiriyor", "Düzeyin üstünde, hızlı ya da karmaşık bir Almanca kullanıyor"],
          examples: {
            1: "„Hallo zusammen. Heute ist das Thema Restaurant. Öffnen Sie bitte das Buch auf Seite 54. Wir lesen den Text.“ Etkileşim yok.",
            3: "„Guten Abend! Schön, dass Sie da sind. Heute: im Restaurant bestellen. Frage: Was essen Sie gern? Schreiben Sie ein Wort in den Chat.“ Birkaç cevabı okuyup isimle soruyor: „Ayşe, Pizza? Mit oder ohne Käse?“",
            5: "„Guten Abend! Heute gehen wir ins Restaurant, aber online. Zuerst: Schreiben Sie Ihr Lieblingsessen in den Chat, aber schicken Sie es noch nicht ab. Ich sage: drei, zwei, eins, jetzt!“ Cevapları okuyup iki kişiyi isimle çağırıyor: „Murat, Suppe! Bestellen Sie oft Suppe?“ Sonra tepkiyle: „Waren Sie schon einmal im Restaurant unzufrieden? Daumen hoch oder runter.“ Hedefi bağlıyor: „Heute lernen wir bestellen und reklamieren, zum Beispiel: Die Suppe ist leider kalt.“",
          },
        }),
        longText({
          prompt: t(
            "Online A2 grubunda (8 kişi, haftada iki akşam) beşinci haftadasın. Öğrencin Selin ilk dersten beri kamerasını hiç açmadı ve mikrofonla hiç konuşmadı. Ödevlerini düzenli ve çoğunlukla doğru gönderiyor; birkaç kez soruların cevabını sana özel mesajla yazdı. Okulun kuralı kamerayı zorunlu tutmuyor.\n\nÖnümüzdeki iki hafta için planını yaz: Selin'e ilk ne yazarsın (mesajın kendisini de yaz), derste onu hangi adımlarla dahil edersin, neyi kesinlikle yapmazsın ve ilerlemeyi nasıl takip edersin?",
            "You are in week five with an online A2 group (8 learners, two evenings a week). Your learner Selin has never switched her camera on and has never spoken on the microphone since the first lesson. She sends her homework regularly and mostly correct; a few times she wrote answers to you in a private message. The school does not require cameras.\n\nWrite your plan for the next two weeks: what do you write to Selin first (include the message itself), in which steps do you involve her in class, what will you definitely not do, and how do you follow her progress?",
          ),
          competencies: ["communication", "didactics"],
          internal:
            "Mesajın dili ve hitabı (Türkçe ya da Almanca, du ya da Sie) okulun yetişkin gruplardaki alışkanlığına göre değişir; puanlamada hitap değil mesajın tonu ve planın içeriği belirleyicidir.",
          minChars: 400,
          maxChars: 3000,
          expected: [
            "Selin'e özel, yargılamayan, kısa bir mesaj yazıyor; ödevlerini olumlu karşılıyor ve onun için neyin daha kolay olacağını soruyor",
            "Katılımı küçük adımlarla kuruyor (önce sohbet, sonra ikili odada sesli, sonra grupta önceden haber verilmiş kısa bir cevap)",
            "Kamerayı zorunlu kılmıyor, onu grup önünde köşeye sıkıştırmıyor ve kameranın neden kapalı olduğunu sorgulamıyor",
            "İki hafta için gözlem ve geri bildirim zamanı belirliyor",
          ],
          redFlags: [
            "Kamerayı açmasını ya da grup önünde konuşmasını şart koşuyor",
            "Kameranın neden kapalı olduğunu özel hayatına girerek soruyor",
            "Hiç konuşmamasını kabullenip hiçbir şey yapmıyor",
          ],
          examples: {
            1: "Kuralları hatırlatırım: derste kamera ve mikrofon açık olmalı. Bir sonraki derste ona doğrudan soru sorarım, konuşmazsa derse katılmamış sayarım.",
            3: "Selin'e özel mesaj yazarım: „Merhaba Selin, ödevlerin çok iyi. Derste konuşmak sana zor geliyorsa birlikte bir yol bulabiliriz.“ Derste önce sohbetten cevap vermesini, sonra ikili odada konuşmasını isterim. Kamerayı zorunlu tutmam.",
            5: "Mesaj: „Liebe Selin, Ihre Hausaufgaben sind wirklich gut, danke! Im Kurs möchte ich Sie gern öfter hören. Was ist für Sie leichter: zuerst im Chat schreiben oder zu zweit in einem kleinen Raum sprechen? Die Kamera können Sie gern ausgeschaltet lassen.“ 1. hafta: sohbet cevaplarını adıyla değerlendiririm, ikili odayı sakin bir eşle kurarım. 2. hafta: odada bir rol kartını sesli okur; grupta önceden haber verdiğim kısa bir cevap isterim. Grup önünde kamera istemem, nedenini sormam. Her dersten sonra not alır, iki hafta sonunda ona kısa bir geri bildirim yazarım.",
          },
        }),
      ],
    }),
    germanProficiencyStage("communication"),
  ],
};
