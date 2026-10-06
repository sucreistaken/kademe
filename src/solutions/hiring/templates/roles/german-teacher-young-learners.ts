import { longText, single, stage, t, video } from "../build";
import { germanProficiencyStage } from "../german-proficiency-stage";
import type { HiringTemplate } from "../types";

export const germanTeacherYoungLearners: HiringTemplate = {
  key: "german-teacher-young-learners",
  group: "LANGUAGE_SCHOOL",
  name: t("Çocuk ve Genç Almanca Öğretmeni", "German Teacher for Children and Teens"),
  summary: t(
    "Dağılan bir grubu toparlama, oyunla A1 etkinliği, sıkıldığını söyleyen bir öğrencinin velisine cevap ve C1 hedefli Almanca yeterlik.",
    "Bringing a disrupted group back, a game-based A1 activity, a reply to a parent whose child says they are bored, and a German check aimed at C1.",
  ),
  jobAd: t(
    "Çocuk ve genç gruplarımıza Almanca öğretecek bir öğretmen arıyoruz. Dersi oyun ve hareketle canlı tutan, dağılan bir grubu dersi durdurmadan toparlayan, hızlı ve yavaş öğrenciye ayrı yol açan ve velilerle sakin, net iletişim kuran biri olmalısın. Almancan en az C1 düzeyinde olmalı.",
    "We are looking for a teacher for our German groups of children and teens. You keep lessons lively with games and movement, bring a disrupted group back without stopping the lesson, give fast and slow learners their own way forward and talk to parents calmly and clearly. Your German is at least at C1 level.",
  ),
  weights: { classroom_management: 40, didactics: 30, german_proficiency: 30 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("Bir senaryo sorusu ve bir video sorusu. En fazla 7 dakika.", "One scenario question and one video question. At most 7 minutes."),
      purpose: "Yaşa uygun etkinlik seçimi; dağılan bir grubu gerçekte nasıl yönettiği.",
      minutes: 7,
      activities: [
        single({
          prompt: t(
            "10-11 yaşında 12 öğrenciden oluşan bir A1 grubu. 45 dakikalık dersin ilk 25 dakikası sıralarda oturarak yapılan bir okuma çalışmasıydı ve öğrenciler huzursuzlanmaya başladı. Kalan 15 dakikanın hedefi: her öğrencinin geçen ders öğrendiği 12 okul eşyası kelimesini (der Bleistift, das Heft, die Schere ...) birkaç kez yüksek sesle söylemesi. Hangi etkinlik bu gruba ve hedefe en uygun?",
            "An A1 group of 12 learners aged 10-11. The first 25 minutes of the 45-minute lesson were a reading task done sitting at the desks, and the learners are getting restless. The aim for the remaining 15 minutes: every learner says the 12 school-things words learned last lesson (der Bleistift, das Heft, die Schere ...) aloud several times. Which activity fits this group and aim best?",
          ),
          options: [
            t("Kelimelerle bir eleme yarışması: yanlış söyleyen oturur, sona kalan kazanır", "An elimination contest with the words: whoever gets one wrong sits down, the last one standing wins"),
            t("Kelimelerin artikellerini ve çoğullarını soran bir çalışma kâğıdını sessizce doldurmak", "Quietly filling in a worksheet that asks for the words' articles and plurals"),
            t("Öğretmenin kelimeleri tek tek gösterip söylediği, öğrencilerin dinleyip deftere yazdığı bir tekrar", "A review where the teacher shows and says each word and the learners listen and copy them"),
            t("Ayakta bir hareket oyunu: öğretmen kelimeyi söyler, öğrenciler eşyayı gösterir; sonra ikililerde sırayla", "A standing movement game: the teacher says a word, learners point to the object; then the same in pairs"),
          ],
          correct: 3,
          internal:
            "Doğru cevap: ayakta hareket oyunu, sonra ikililer (TPR). Uzun oturma sonrası hareket ihtiyacına cevap veriyor; ikili aşamada 12 öğrencinin hepsi aynı anda konuşuyor. Çeldiriciler: eleme yarışması (çocuklar sever ama yanlış yapan, çoğunlukla zayıf öğrenci erken oturup konuşmayı bırakır; hedef herkesin söylemesi); çalışma kâğıdı (yine oturarak ve sessiz, söyleme yok); öğretmen merkezli tekrar (öğrenciler dinliyor, kendileri söylemiyor).",
        }),
        video({
          prompt: t(
            "Sık sık bölünen ya da birkaç öğrencinin grubu dağıttığı bir dersi anlat (kurs, okul, özel ders ya da staj sırasında): ne oldu, o an tam olarak ne söyledin ve ne yaptın, sonraki derslerde neyi değiştirdin ve sonuç ne oldu?",
            "Tell us about a lesson that kept being interrupted or where a few learners pulled the group apart (in a course, a school, private lessons or a teaching placement): what happened, what exactly did you say and do in the moment, what did you change in the following lessons, and what was the result?",
          ),
          competencies: ["classroom_management"],
          expected: [
            "Durumu somut anlatıyor (öğrencilerin yaşı, grup büyüklüğü, ne oldu) ve o an ne söylediğini aktarıyor",
            "Dersi durdurmadan müdahale ettiğini anlatıyor (yaklaşma, göz teması, görev verme, kısa ve sakin bir uyarı)",
            "Bölünmenin nedenini yorumluyor (sıkılma, fazla zor ya da uzun görev, geçişler) ve sonraki derslerde ritüel, kural ya da akış değişikliği yapıyor",
            "Sonucu ve sessiz öğrencilerin de derse nasıl katıldığını söylüyor",
          ],
          redFlags: ["Yalnızca cezaya ya da öğrenciyi sınıftan çıkarmaya başvurduğunu anlatıyor", "Öğrencileri etiketleyip ('yaramaz çocuklar') kendi payını görmüyor"],
          examples: {
            1: "Çok gürültü yapıyorlardı, sesimi yükselttim ve en çok konuşanı dışarı çıkardım. Sonra sustular.",
            3: "12 yaşındaki öğrencilerden oluşan bir grupta iki öğrenci sürekli konuşuyordu. Yanlarına gidip birine kart dağıtma görevi verdim, diğerini öne oturttum. Sonraki derslerde başta birlikte iki üç kural koyduk ve işe yaradı.",
            5: "11-12 yaşındaki öğrencilerden oluşan 14 kişilik bir grupta her etkinlik geçişinde gürültü patlıyordu. O an konuşmayı kesip el işaretiyle sessizlik ritüelimizi başlattım, en hareketli iki öğrenciye malzeme dağıtma görevi verdim. Sorunun geçişlerde olduğunu fark ettim: uzun yönerge verirken dağılıyorlardı. Sonraki derslerde yönergeyi kısa ve göstererek verdim, her geçişe 30 saniyelik bir hareket oyunu koydum, sessiz öğrencilere ikili çalışmada söz sırası verdim. İki hafta sonra geçişlerde dersi durdurmam gerekmedi.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "İki yazılı görev: oyuna dayalı bir A1 etkinliği ve bir veli mesajına cevap. En fazla 18 dakika.",
        "Two written tasks: a game-based A1 activity and a reply to a parent's message. At most 18 minutes.",
      ),
      purpose: "Çocuklar için düzeye uygun, herkesi konuşturan oyunlu etkinlik tasarımı; hızlı öğrenci için farklılaştırma ve veliyle yetki sınırı içinde iletişim.",
      minutes: 18,
      activities: [
        longText({
          prompt: t(
            "10-12 yaşında 12 öğrenciden oluşan bir A1 grubu için 20 dakikalık, oyuna dayalı bir etkinlik tasarla.\n\nÖğrenciler renkleri biliyor; geçen ders şu 10 giysi kelimesini öğrendiler: die Hose, der Rock, das T-Shirt, der Pullover, die Jacke, das Kleid, die Mütze, der Schal, die Schuhe, die Socken.\nHedef: öğrenciler birinin ne giydiğini söyleyebilir (Er trägt eine Hose. Die Hose ist blau.).\nSınıf: sıralar yer değiştirebiliyor; tahta ve resim kartları var, projeksiyon yok.\n\nEtkinliği dakikalarıyla adım adım yaz: yönergeyi öğrencilere Almanca tam olarak nasıl vereceğin, her öğrencinin nasıl konuşacağı, erken bitirenler ve zorlananlar için ne yapacağın ve sonda hedefe ulaşıldığını nasıl kontrol edeceğin.",
            "Design a 20-minute game-based activity for an A1 group of 12 learners aged 10-12.\n\nThe learners know the colours; last lesson they learned these 10 clothes words: die Hose, der Rock, das T-Shirt, der Pullover, die Jacke, das Kleid, die Mütze, der Schal, die Schuhe, die Socken.\nAim: learners can say what someone is wearing (Er trägt eine Hose. Die Hose ist blau.).\nRoom: desks can be moved; there is a board and picture cards, no projector.\n\nWrite the activity step by step with minutes: exactly how you give the instructions to the learners in German, how every learner gets to speak, what you do for early finishers and for those who struggle, and how you check at the end that the aim was reached.",
          ),
          competencies: ["didactics", "classroom_management"],
          minChars: 400,
          maxChars: 3000,
          expected: [
            "Dakikaları 20'ye denk gelen, hareket ya da oyun içeren ve her öğrenciyi konuşturan (ikili, küçük grup) bir akış kuruyor",
            "Almanca yönergeleri kısa, gösterilerek ve A1'e uygun yazıyor (ör. „Steht auf! Zeigt mir die Hose!“)",
            "Dilbilgisi yükünü düzeye göre sınırlıyor (Die Hose ist blau; eril kelimelerde einen'i kalıp olarak veriyor ya da bilerek erteliyor)",
            "Erken bitiren ve zorlanan öğrenciye ayrı yol ve sonda hedefi ölçen kısa bir kontrol koyuyor",
          ],
          redFlags: ["Etkinlik öğretmen anlatımına ya da sessiz kâğıt çalışmasına dönüşüyor", "Sıfat çekimi gibi A1'i aşan bir dilbilgisi yükü koyuyor", "Süre ya da kontrol adımı yok"],
          examples: {
            1: "Kelimeleri tahtaya yazarım, öğrenciler defterlerine yazar. Sonra her öğrenci bir cümle kurar. Oyun olarak bir bulmaca dağıtırım.",
            3: "Isınma (3 dk): kartları gösteririm, hep birlikte söyleriz. Oyun (10 dk): bir öğrenci tahtadaki karakterlerden birini aklından seçer, diğerleri „Trägt sie einen Rock?“ diye sorup tahmin eder. İkili (5 dk): resimdeki kişiyi tarif et, eşin çizsin. Kontrol (2 dk): birkaç öğrenci bir karakteri tarif eder. Erken bitirenler kendi karakterlerini çizer.",
            5: "Kartlarla tekrar (3 dk): „Zeigt mir die Jacke!“ Oyun (8 dk): „Wer ist das?“ Tahtada giyimli altı karakter; ben tarif ederim („Sie trägt eine Hose. Die Hose ist grün.“), çocuklar ayağa kalkıp karakteri gösterir, sonra rolü bir çocuk alır. İkili (6 dk): A ve B kartlarında giysiler ve renkler farklı; sorup bulurlar. Erken bitiren yeni karakter çizip tarif eder, zorlanan kalıp kartıyla çalışır. Çıkış (3 dk): herkes bir karakteri tek cümleyle tarif eder, listeye işaretlerim. Eril kelimeleri „Er trägt einen Rock“ kalıbıyla veririm.",
          },
          internal:
            "Referans: güçlü cevap hedef cümleyi korur (yüklem sıfat: Die Hose ist blau), sıfat çekimini (eine blaue Hose) A1'de bilerek dışarıda bırakır ve eril kelimelerde Akkusativ'i (Er trägt einen Rock / einen Pullover / einen Schal) ya kalıp olarak verir ya da önce dişil ve çoğul kelimelerle başlar. Örnek akış: kartlarla tekrar (3 dk), 'Wer ist das?' ya da 'Ich sehe was, was du nicht siehst' tahmin oyunu (8 dk), ikililerde resimli bilgi boşluğu (6 dk), çıkış turu (3 dk). Çocukların kendi giysileri yerine resim kartı ya da kurgu karakter kullanmak, giysi üzerinden alay riskini azaltır.",
        }),
        longText({
          prompt: t(
            "Bir veli, okulun mesaj sistemi üzerinden sana şunu yazdı:\n\n\"Merhaba, kızım Elif derste çok sıkıldığını söylüyor. Evde 'zaten biliyorum' diyor, derste hep aynı şeyleri tekrar ediyormuşsunuz. Bu kadar para ödüyoruz. Ya daha üst bir gruba alınsın ya da ücretimizi geri istiyoruz.\"\n\nBildiklerin: Elif 11 yaşında, 2 aydır senin A1 grubunda. Derste görevleri çoğu zaman herkesten önce bitiriyor, sonra yanındakiyle konuşuyor. Yazılı ödevlerinde hâlâ temel hatalar var (fiilin cümledeki yeri, artikeller). Okulda grup değişikliği seviye testi ve müdür onayıyla yapılıyor; ücret konularına yalnızca okul ofisi bakıyor. Bir sonraki A2 grubu 6 hafta sonra başlıyor.\n\nVeliye göndereceğin cevabı yaz.",
            "A parent wrote to you through the school's messaging system:\n\n\"Hello, my daughter Elif says she is very bored in class. At home she says 'I already know this', and apparently you keep repeating the same things. We pay a lot for this. Either she moves to a higher group or we want our money back.\"\n\nWhat you know: Elif is 11 and has been in your A1 group for 2 months. In class she usually finishes tasks before everyone else and then chats with her neighbour. Her written homework still has basic errors (verb position, articles). At the school a group change needs a placement test and the director's approval; fees are handled only by the school office. The next A2 group starts in 6 weeks.\n\nWrite the reply you send to the parent.",
          ),
          competencies: ["classroom_management", "didactics"],
          minChars: 300,
          maxChars: 3000,
          expected: [
            "Velinin kaygısını kabul ederek ve savunmaya geçmeden açılıyor",
            "Elif hakkında somut ve dengeli bir gözlem veriyor (görevleri erken bitiriyor, yazıda temel hatalar sürüyor)",
            "Derste hemen uygulayacağı somut bir farklılaştırma planı sunuyor (ek görev, zor kart, yardımcı rolü) ve ne zaman geri bildirim vereceğini söylüyor",
            "Grup değişikliği için seviye testi ve müdür onayını, ücret için okul ofisini doğru gösteriyor; yetkisi dışında söz vermiyor",
          ],
          redFlags: [
            "Yetkisi olmadığı hâlde grup değişikliği ya da ücret iadesi sözü veriyor",
            "Veliyi ya da Elif'i suçlayan bir dil kullanıyor ('derste konuşuyor, sorun onda')",
            "Elif'in gerçek durumunu saklayıp yalnızca övüyor",
          ],
          examples: {
            1: "Merhaba, derslerimiz programa göre ilerliyor. Elif derste arkadaşıyla konuşuyor, belki o yüzden sıkılıyor. Ücret konusunu ofise sorun.",
            3: "Merhaba, yazdığınız için teşekkür ederim. Elif derste gerçekten hızlı, görevleri çoğu zaman önce bitiriyor. Bundan sonra ona ek görevler vereceğim. Grup değişikliği seviye testiyle oluyor; isterseniz test için müdürümüzle görüşebilirim. Ücret konusunda okul ofisi size yardımcı olabilir.",
            5: "Merhaba, açıkça yazdığınız için teşekkür ederim. Gözlemim: Elif görevleri çoğu zaman ilk bitiriyor, bu bir güç. Yazılarında ise fiilin yeri ve artikeller hâlâ çalışması gereken noktalar. Bu haftadan itibaren erken bitirdiğinde ona daha zor ek kartlar vereceğim ve bu iki noktaya özel kısa yazı görevleri hazırlayacağım. Üst gruba geçiş seviye testi ve müdür onayıyla oluyor; isterseniz testi müdürümüze ileteyim. Ücret sorularını okul ofisi yanıtlıyor. Üç hafta sonra size Elif'in durumunu yazayım mı?",
          },
          internal:
            "Referans: velinin kaygısını kabul eder, Elif'in hızını olumlu bir gözlem olarak verir ama tabloyu dürüstçe tamamlar (görevleri erken bitiriyor, yazıda temel hatalar sürüyor). Sözü yetkisi içinde tutar: grup değişikliğine değil seviye testine ve müdür onayına, ücrete değil ofise yönlendirir. Sınıf içi somut plan: erken bitirene ek görev (zor kart, kısa yazı), yardımcı rolü, yazıda hedefli çalışma. Bir takip zamanı ya da görüşme önerir.",
        }),
      ],
    }),
    germanProficiencyStage("didactics"),
  ],
};
