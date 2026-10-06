import { longText, single, stage, t, video } from "../build";
import { germanProficiencyStage } from "../german-proficiency-stage";
import type { HiringTemplate } from "../types";

export const examPrepTeacher: HiringTemplate = {
  key: "exam-prep-teacher",
  group: "LANGUAGE_SCHOOL",
  name: t("Sınav Hazırlık Öğretmeni (Goethe/telc/ÖSD)", "Exam Preparation Teacher (Goethe/telc/ÖSD)"),
  summary: t(
    "Goethe B1 geçme kuralı, telc ölçütleriyle B1 yazma puanlama, okuma stratejisi ve C1 hedefli Almanca yeterlik.",
    "The Goethe B1 pass rule, scoring B1 writing against telc criteria, a reading strategy and a German check aimed at C1.",
  ),
  jobAd: t(
    "Goethe, telc ve ÖSD sınavlarına hazırlanan öğrencilerimizle çalışacak bir Sınav Hazırlık Öğretmeni arıyoruz. Sınavların biçimini ve değerlendirme ölçütlerini bilen, öğrencinin yazısını bu ölçütlerle puanlayıp anlaşılır geri bildirim veren ve hazırlığı öğrencinin eksiklerine göre planlayan biri olmalısın. Almancan en az C1 düzeyinde olmalı.",
    "We are looking for an Exam Preparation Teacher for our learners preparing for Goethe, telc and ÖSD exams. You know the exam formats and assessment criteria, score a learner's writing against them with clear feedback and plan the preparation around each learner's gaps. Your German is at least at C1 level.",
  ),
  weights: { exam_expertise: 40, didactics: 30, german_proficiency: 30 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("Bir bilgi sorusu ve bir video sorusu. En fazla 7 dakika.", "One knowledge question and one video question. At most 7 minutes."),
      purpose: "Goethe B1 geçme kuralı bilgisi; bir öğrenciyi sınava nasıl hazırladığı, tanıdan sonuca.",
      minutes: 7,
      activities: [
        single({
          prompt: t(
            "Bir öğrencin Goethe-Zertifikat B1'in dört modülüne aynı gün girdi. Sonuçları (her modül 100 puan üzerinden):\n- Lesen: 73\n- Hören: 57\n- Schreiben: 81\n- Sprechen: 75\n\nSonuç için hangisi doğru?",
            "A learner of yours took all four modules of the Goethe-Zertifikat B1 on the same day. Results (each module out of 100 points):\n- Lesen: 73\n- Hören: 57\n- Schreiben: 81\n- Sprechen: 75\n\nWhich statement about the result is correct?",
          ),
          options: [
            t("Sınavın tamamını geçti, çünkü dört modülün ortalaması 71,5 puan", "Passed the whole exam, because the average of the four modules is 71.5 points"),
            t("Sınavın tamamını geçti, çünkü yazılı modüllerin ortalaması ve Sprechen 60 puanın üzerinde", "Passed the whole exam, because the written modules' average and Sprechen are above 60 points"),
            t("Hören dışındaki üç modülü geçti, çünkü yalnızca Hören 60 puanın altında", "Passed the three modules other than Hören, because only Hören is below 60 points"),
            t("Dört modülün hepsini geçti, çünkü modül başına geçme sınırı 50 puan", "Passed all four modules, because the pass mark per module is 50 points"),
          ],
          correct: 2,
          internal:
            "Doğru cevap: Hören dışındaki üç modülü geçti. Goethe-Zertifikat B1'de her modül ayrı değerlendirilir; modül başına geçme sınırı 100 üzerinden 60. Hören 57 ile geçmedi. Çeldiriciler: ortalama almak (modüller birbirini telafi etmez); telc Deutsch B1'in yazılı ve sözlü bölüm için ayrı ayrı %60 kuralını Goethe'ye uygulamak (yazılı ortalama 70,3); geçme sınırını 50 sanmak.",
        }),
        video({
          prompt: t(
            "Bir öğrenciyi belirli bir dil sınavına (Goethe, telc, ÖSD ya da başka bir sınav) hazırladığın bir durumu anlat: başta öğrencinin seviyesini ve eksiklerini nasıl belirledin, hazırlığı sınavın hangi bölümlerine ve ölçütlerine göre planladın, yol boyunca neyi değiştirdin ve sonuç ne oldu?",
            "Tell us about a time you prepared a learner for a specific language exam (Goethe, telc, ÖSD or another exam): how did you establish the learner's level and gaps at the start, which exam parts and criteria did you plan the preparation around, what did you change along the way, and what was the result?",
          ),
          competencies: ["exam_expertise", "didactics"],
          expected: [
            "Sınavı ve bölümlerini doğru adlandırıyor; hazırlığı o sınavın ölçütlerine bağlıyor (ör. yazmada içerik noktaları, sözlüde görevi yerine getirme)",
            "Başta bir tanı yaptığını söylüyor (deneme sınavı, örnek yazı) ve eksikleri somut sayıyor",
            "Planı eksiklere göre nasıl ağırlıklandırdığını ve ilerlemeyi ara deneme ya da geri bildirimle nasıl ölçtüğünü anlatıyor",
            "Sonucu (puan, geçti ya da kaldı) ve sonradan değiştirdiği bir şeyi dürüstçe söylüyor",
          ],
          redFlags: ["Hazırlığı 'bol test çözdürdüm' gibi genel tavsiyeye indiriyor", "Sınavın biçimini ya da kurallarını yanlış ya da karışık anlatıyor"],
          examples: {
            1: "Öğrenciye bol bol test çözdürdüm, kelime ezberlettim, sınavı geçti.",
            3: "Bir öğrenciyi telc Deutsch B1'e hazırladım. İlk derste bir deneme yazısı ve kısa bir sözlü yaptırdım; yazıda içerik noktalarını atlıyordu. Her yazıda dört noktayı işaretleme alışkanlığı kazandırdım, her hafta bir e-posta yazdırıp ölçütlere göre geri bildirim verdim. Yazılı ve sözlü bölümü geçti.",
            5: "Goethe-Zertifikat B1'e sekiz haftası olan bir öğrencim vardı. Önce tam bir deneme yaptırdım: Lesen ve Schreiben iyiydi, Hören 50 civarındaydı. Modüller ayrı ayrı 60 puanla geçildiği için ağırlığı Hören'e verdim: haftada üç kısa dinleme, önce soruları okuyup anahtar kelime bulma, yanlışları nedenleriyle inceleme. İki haftada bir deneme yaptık, Hören 50'den 66'ya çıktı ve dört modülü geçti. O günden beri tanı denemesini ilk derse koyuyorum.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Önce iki dakikalık bir video strateji anlatımı, sonra bir öğrenci yazısını puanlama ve geri bildirim. En fazla 18 dakika.",
        "First a two-minute video strategy talk, then scoring a learner's text and writing feedback. At most 18 minutes.",
      ),
      purpose: "Okuma bölümü için sınav stratejisi öğretme; B1 yazısını telc tarzı ölçütlerle puanlama ve öğrenciye geri bildirim. Video önce, çünkü süresi sınırlı.",
      minutes: 18,
      activities: [
        video({
          prompt: t(
            "B1 sınavına hazırlanan bir gruba okuma bölümünün 2. kısmı için 2 dakikalık bir strateji anlatımı yap: Goethe-Zertifikat B1'de Lesen Teil 2 ya da telc Deutsch B1'de Leseverstehen Teil 2; hangisini seçtiğini başta söyle. Kameraya, karşında öğrenciler varmış gibi konuş: bu kısmın görev tipini kısaca tanıt, adım adım bir çözüm yolu ver ve öğrencilerin sık puan kaybettiği bir tuzağı örnekle göster. Gerçek dersinde nasıl yapıyorsan, Almanca ya da Türkçe anlatabilirsin.",
            "Give a group preparing for a B1 exam a 2-minute strategy talk on part 2 of the reading section: Lesen Teil 2 in the Goethe-Zertifikat B1 or Leseverstehen Teil 2 in telc Deutsch B1; say which one you chose at the start. Speak to the camera as if the learners were in front of you: briefly introduce the task type of this part, give a step-by-step way to solve it and show with an example a trap where learners often lose points. You may speak German or Turkish, as you would in your real lesson.",
          ),
          competencies: ["exam_expertise", "didactics"],
          expected: [
            "Seçtiği sınavı ve kısmı adlandırıp görev tipini kısaca ve doğru tanıtıyor",
            "Sıralı bir çözüm yolu veriyor (önce görev ve sorular, anahtar kelime, metinde ilgili yeri bulma, seçenekleri metinle karşılaştırma)",
            "Sık bir tuzağı örnekle gösteriyor (metindeki kelimeyi tekrar eden ama anlamı tutmayan seçenek; nicht, kein, nur, erst gibi sözcükler)",
            "Süre yönetimine ve stratejinin derste nasıl prova edileceğine değiniyor",
          ],
          redFlags: ["Biçimi açıkça yanlış anlatıyor ya da iki sınavı karıştırıyor", "'Dikkatli okuyun' gibi genel öğütte kalıyor"],
          examples: {
            1: "Metni dikkatlice okuyun, bilmediğiniz kelimelere takılmayın ve acele etmeyin. Bol bol pratik yapın.",
            3: "Seçtiği kısmın görev tipini tanıtıyor, sonra: önce soruları okuyun, anahtar kelimenin altını çizin, metinde o yeri bulun. Dikkat: metinde aynı kelime geçiyor diye o seçenek doğru değildir. Bir örnek veriyor ve süreyi kontrol etmelerini söylüyor.",
            5: "Görev tipini tanıtıp üç adım veriyor: 1) soruyu oku, anahtar kelimeyi çiz, 2) metinde aynı bilgiyi başka sözcüklerle ara, 3) her seçeneği metindeki cümleyle karşılaştır. Tuzak örneği: metin „Der Kurs ist nicht nur für Anfänger“ derken seçenek „Der Kurs ist nur für Anfänger“; aynı kelimeler, ters anlam. Süreyi bölümlere paylaştırmayı ve her derste bir metni süreyle çözüp yanlışları nedenleriyle konuşmayı öneriyor.",
          },
          internal:
            "Bu şablon iki sınavın Teil 2 biçimini (metin sayısı, madde sayısı, soru tipi) doğrulanmış bilgi olarak vermiyor; adayın söylediği biçimi güncel resmi model sınavla (Goethe ya da telc Übungstest) karşılaştır. Biçimden bağımsız güçlü strateji: önce görevi ve soruları okumak, anahtar kelimeyi metinde bulmak, aynı bilginin başka sözcüklerle ifade edildiğini tanımak, metindeki kelimeyi tekrar eden yanlış seçenek tuzağı, olumsuzluk ve kısıtlama sözcükleri (nicht, kein, nur, erst), süre yönetimi.",
        }),
        longText({
          prompt: t(
            "Aşağıda telc Deutsch B1 tarzında bir yazma görevi ve bir öğrencinin cevabı var.\n\nGörev: „Ihre Freundin Anna hat Sie zu ihrer Geburtstagsfeier am Samstag eingeladen. Sie können leider nicht kommen. Schreiben Sie Anna eine E-Mail: Bedanken Sie sich für die Einladung. Erklären Sie, warum Sie nicht kommen können. Schlagen Sie ein anderes Treffen vor. Fragen Sie, was Anna sich zum Geburtstag wünscht.“\n\nÖğrencinin e-postası:\n„Liebe Anna,\nvielen Dank für deine Einladung! Leider ich kann am Samstag nicht kommen, weil ich muss den ganzen Tag arbeiten. Das tut mir sehr leid. Vielleicht wir können uns nächste Woche treffen? Am Mittwoch habe ich frei. Wir könnten zusammen in Kino gehen. Ich wünsche dir eine schöne Party mit deine Freunde!\nViele Grüße\nDeniz“\n\n1) E-postayı telc'in üç yazma ölçütüyle puanla:\n- I Berücksichtigung der Leitpunkte (içerik noktaları): A = 4 noktanın hepsi işlenmiş, B = 3, C = 2, D = 1 ya da hiç.\n- II Kommunikative Gestaltung: A = voll angemessen, B = im Großen und Ganzen angemessen, C = kaum noch akzeptabel, D = insgesamt nicht ausreichend.\n- III Formale Richtigkeit: A, B, C ya da D; C = merkezi noktalarda anlamayı önemli ölçüde bozan hatalar.\nHer ölçüt için A, B, C ya da D ver ve gerekçeni metinden örnekle yaz.\n2) Öğrenciye, anlayacağı bir dille kısa bir geri bildirim yaz: neyi iyi yaptı, bir sonraki yazıda neye dikkat etmeli.",
            "Below is a writing task in the style of telc Deutsch B1 and a learner's answer.\n\nTask: „Ihre Freundin Anna hat Sie zu ihrer Geburtstagsfeier am Samstag eingeladen. Sie können leider nicht kommen. Schreiben Sie Anna eine E-Mail: Bedanken Sie sich für die Einladung. Erklären Sie, warum Sie nicht kommen können. Schlagen Sie ein anderes Treffen vor. Fragen Sie, was Anna sich zum Geburtstag wünscht.“\n\nThe learner's e-mail:\n„Liebe Anna,\nvielen Dank für deine Einladung! Leider ich kann am Samstag nicht kommen, weil ich muss den ganzen Tag arbeiten. Das tut mir sehr leid. Vielleicht wir können uns nächste Woche treffen? Am Mittwoch habe ich frei. Wir könnten zusammen in Kino gehen. Ich wünsche dir eine schöne Party mit deine Freunde!\nViele Grüße\nDeniz“\n\n1) Score the e-mail on telc's three writing criteria:\n- I Berücksichtigung der Leitpunkte (content points): A = all 4 points covered, B = 3, C = 2, D = 1 or none.\n- II Kommunikative Gestaltung: A = voll angemessen, B = im Großen und Ganzen angemessen, C = kaum noch akzeptabel, D = insgesamt nicht ausreichend.\n- III Formale Richtigkeit: A, B, C or D; C = errors at central points that considerably impair understanding.\nGive A, B, C or D for each criterion and justify it with examples from the text.\n2) Write short feedback to the learner in language they understand: what they did well and what to watch in the next text.",
          ),
          competencies: ["exam_expertise", "didactics"],
          minChars: 400,
          maxChars: 3000,
          expected: [
            "Eksik dördüncü içerik noktasını (Anna'nın doğum günü dileğini sormak) buluyor ve 4 noktadan 3'ü işlendiği için ölçüt I'e B veriyor",
            "Hataları buluyor ve fiil yeri hatasını tek bir örüntü olarak adlandırıyor (Leider ve Vielleicht'tan sonra, weil'li yan cümlede)",
            "Her ölçüte A-D arasında, metinden kanıtla gerekçelendirilmiş bir puan veriyor",
            "Geri bildirimi güçlü bir yanla açıyor, bir ya da iki öncelikli hedefle sınırlıyor ve öğrencinin anlayacağı dilde yazıyor",
          ],
          redFlags: ["Eksik içerik noktasını görmüyor", "Puanları gerekçesiz veriyor ya da üç ölçütü birbirine karıştırıyor", "Geri bildirim, düzeltilmiş hataların uzun bir listesinden ibaret"],
          examples: {
            1: "Güzel bir e-posta, birkaç gramer hatası var. Puan: A, A, B. Geri bildirim: Daha çok gramer çalış.",
            3: "I: B, dileği sormamış, 4 noktadan 3'ü var. II: B. III: B; „Leider ich kann“, „weil ich muss“, „Vielleicht wir können“, „mit deine Freunde“ hatalı ama anlamı bozmuyor. Geri bildirim: „Deine E-Mail ist freundlich und klar. Aber du hast nicht gefragt, was Anna sich wünscht. Achte auf die Wortstellung: Leider kann ich ...“",
            5: "I: B, 4 noktadan 3'ü (dilek yok). II: A ile B arası, B: hitap, kapanış ve öneri uygun ama kısa. III: B; fiil yeri üç kez aynı hata, ayrıca „in Kino“, „mit deine Freunde“; anlamayı bozmuyor, C değil. Geri bildirim: „Toll: Du bedankst dich und machst einen klaren Vorschlag. Ziel 1: Hake am Ende die vier Punkte ab. Ziel 2: Steht Leider oder Vielleicht vorn, kommt das Verb auf Platz 2: Leider kann ich. Nach weil steht das Verb am Ende: ..., weil ich arbeiten muss.“",
          },
          internal:
            "Yerleştirilen noktalar (6). Ölçüt I: 4. içerik noktası (Anna'nın dileği) eksik; ince, en sık kaçırılan. Ölçüt III: 1) 'Leider ich kann' (Leider kann ich); 2) 'weil ich muss ... arbeiten' (weil ich ... arbeiten muss); 3) 'Vielleicht wir können' (Vielleicht können wir); 4) 'in Kino' (ins Kino, ince); 5) 'mit deine Freunde' (mit deinen Freunden, Dativ çoğul, ince). Referans puan (telc Zertifikat Deutsch B1 ölçütleri): I = B (4 noktadan 3'ü); II = A ya da B (uygun hitap, kapanış ve öneri; kısa); III = B (hatalar anlamayı bozmuyor; C ancak merkezi noktalarda anlamayı önemli ölçüde bozan hatalarda). Puan: A/B/C/D = 5/3/1/0; I ya da III'te D, yazının tamamını 0 yapar. Asıl ölçüt: eksik noktayı ve fiil yeri örüntüsünü görmek, geri bildirimde örüntüye odaklanmak.",
        }),
      ],
    }),
    germanProficiencyStage("didactics"),
  ],
};
