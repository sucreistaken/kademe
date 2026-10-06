import { longText, single, stage, t, video } from "../build";
import { germanProficiencyStage } from "../german-proficiency-stage";
import type { HiringTemplate } from "../types";

export const germanTeacherAdult: HiringTemplate = {
  key: "german-teacher-adult",
  group: "LANGUAGE_SCHOOL",
  name: t("Almanca Öğretmeni (yetişkin, genel kurs)", "German Teacher (adult general courses)"),
  summary: t(
    "İşlemeyen bir ders, A2 dilbilgisi anlatımı, 45 dakikalık ders planı ve C1 hedefli Almanca yeterlik.",
    "A lesson that did not work, an A2 grammar explanation, a 45-minute lesson plan and a German check aimed at C1.",
  ),
  jobAd: t(
    "Yetişkinlere yönelik genel Almanca kurslarımızda A1'den B2'ye gruplarla çalışacak bir Almanca Öğretmeni arıyoruz. Dersini net bir hedefle planlayan, dilbilgisini öğrencinin seviyesinde örnekle anlatan ve öğrencinin anladığını yoklamadan ilerlemeyen biri olmalısın. Almancan en az C1 düzeyinde olmalı.",
    "We are looking for a German Teacher for our general adult courses, working with groups from A1 to B2. You plan each lesson around a clear aim, explain grammar at the learners' level with examples and do not move on before checking understanding. Your German is at least at C1 level.",
  ),
  weights: { didactics: 40, german_proficiency: 35, communication: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("Bir bilgi sorusu ve bir video sorusu. En fazla 7 dakika.", "One knowledge question and one video question. At most 7 minutes."),
      purpose: "GER seviye bilgisi; işlemeyen bir dersi nasıl fark edip değiştirdiği.",
      minutes: 7,
      activities: [
        single({
          prompt: t(
            "Aşağıdaki „kann“ betimleyicisi Ortak Avrupa Dil Çerçevesi'nin (GER) genel ölçeğinde hangi seviyeye aittir?\n\n„Kann über Erfahrungen und Ereignisse berichten, Träume, Hoffnungen und Ziele beschreiben und zu Plänen und Ansichten kurze Begründungen oder Erklärungen geben.“",
            "Which level of the CEFR global scale does the following can-do descriptor belong to?\n\n„Kann über Erfahrungen und Ereignisse berichten, Träume, Hoffnungen und Ziele beschreiben und zu Plänen und Ansichten kurze Begründungen oder Erklärungen geben.“",
          ),
          options: [t("A2", "A2"), t("B1", "B1"), t("B2", "B2"), t("C1", "C1")],
          correct: 1,
          internal:
            "Doğru cevap: B1 (GER genel ölçek, B1: deneyim ve olay anlatma, plan ve görüşlere kısa gerekçe verme). Çeldiriciler: A2 ('kurz' kelimesine bakıp düşük seçmek; A2 genel ölçekte rutin, doğrudan bilgi alışverişi ve kendi çevresini basitçe betimleme, gerekçe yok); B2 (görüş gerekçelendirmeyi B2'nin 'bir konuda görüşünü açıklayıp seçeneklerin avantaj ve dezavantajlarını belirtme' tanımıyla karıştırmak); C1 ('Träume, Hoffnungen' ifadelerini soyut dil sanıp yüksek seçmek).",
        }),
        video({
          prompt: t(
            "Planladığın gibi gitmeyen bir dersi anlat (kurs, okul, özel ders ya da staj sırasında): dersin hedefi neydi, neyin işlemediğini nereden anladın, o an ne yaptın, sonraki derste neyi değiştirdin ve sonuç ne oldu?",
            "Tell us about a lesson that did not go as planned (in a course, a school, private lessons or a teaching placement): what was the aim, how did you notice what was not working, what did you do in the moment, what did you change in the next lesson, and what was the result?",
          ),
          competencies: ["didactics"],
          expected: [
            "Dersin hedefini ve grubu somut söylüyor (ör. A2, 12 kişi, Wechselpräpositionen)",
            "Sorunu bir gözleme dayandırıyor (alıştırmadaki yanlışlar, sessizlik, anlaşılmayan yönerge) ve nedenini yorumluyor",
            "O an yaptığı somut değişikliği anlatıyor (ara adım, yeni örnek, yönergeyi göstererek verme)",
            "Sonraki derste planı neye göre değiştirdiğini ve işe yarayıp yaramadığını nasıl kontrol ettiğini söylüyor",
          ],
          redFlags: ["Sorunu yalnızca öğrencilere ya da kitaba yüklüyor", "Somut bir ders yerine genel laflar ediyor"],
          examples: {
            1: "Öğrenciler hazırlıksız geldi, o yüzden ders olmadı. Konuyu bir sonraki derste bir daha anlattım.",
            3: "A2 grubunda Wechselpräpositionen'i anlattım ama alıştırmada çoğu Dativ ile Akkusativ'i karıştırdı. Wo? ve Wohin? sorularını tahtaya yazıp sınıftaki eşyalarla yeniden gösterdim, sonraki derse kısa bir tekrar ekledim ve yanlışlar azaldı.",
            5: "B1 grubunda bir tartışma etkinliği planlamıştım, 10 dakika sonra herkes susmuştu. Gözlemim: gerekli kalıpları (Ich bin der Meinung, dass ...) bilmiyorlardı. Etkinliği durdurup üç kalıbı tahtaya yazdım ve önce ikililerde prova ettirdim. Sonraki derslerde her tartışmadan önce bir kalıp aşaması koydum ve sonda her ikiliden bir görüş istedim. İki ders sonra herkes en az iki kez söz alıyordu.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Önce iki dakikalık bir video anlatım, sonra yazılı bir ders planı. En fazla 18 dakika.",
        "First a two-minute video explanation, then a written lesson plan. At most 18 minutes.",
      ),
      purpose: "A2 düzeyinde dilbilgisi anlatımı ve öğretmen dili; 45 dakikalık bir A2 dersini aşamalarıyla planlama. Video önce, çünkü süresi sınırlı; plan kalan süreyi kullanır.",
      minutes: 18,
      activities: [
        video({
          prompt: t(
            "A2.1 düzeyinde, 12 yetişkinden oluşan bir gruba ders veriyorsun. Öğrenciler Perfekt'i haben ile kurmayı biliyor; bugün ilk kez sein ile Perfekt'e geçiyorsun. Sık duyduğun yanlış: „Ich habe nach Berlin gefahren.“\n\nKameraya, karşında bu öğrenciler varmış gibi konuş ve 2 dakikalık bir anlatım yap: Perfekt'te ne zaman sein, ne zaman haben kullanıldığını A2 öğrencisinin anlayacağı bir Almancayla anlat, örnek ver ve anladıklarını nasıl yoklayacağını göster.",
            "You teach a group of 12 adults at A2.1. They can form the Perfekt with haben; today you introduce the Perfekt with sein for the first time. A mistake you often hear: „Ich habe nach Berlin gefahren.“\n\nSpeak to the camera as if these learners were in front of you and give a 2-minute explanation: explain in German an A2 learner understands when the Perfekt takes sein and when haben, give examples and show how you would check that they understood.",
          ),
          competencies: ["didactics", "communication"],
          expected: [
            "Kuralı A2'ye uygun tek bir ölçüte indiriyor (A'dan B'ye hareket ya da değişim: sein; fiillerin çoğu: haben)",
            "Öğrencinin yanlışını („Ich habe nach Berlin gefahren“) doğrudan ele alıyor ve karşıt örnek çifti veriyor",
            "Kısa, yavaş, A2'ye uygun bir Almanca kullanıyor; jest, çizim ya da tahta gibi bir görsel destek gösteriyor",
            "Sonda öğrencilerin anladığını küçük bir yoklamayla kontrol ediyor",
          ],
          redFlags: [
            "A2 öğrencisini terimlerle (intransitiv, Zustandsveränderung) ya da uzun bir istisna listesiyle boğuyor",
            "Kuralı yanlış veriyor (ör. sein'ı yalnızca gehen ve kommen ile sınırlıyor ya da değişim fiillerini haben ile veriyor)",
            "Hiç yoklama yapmadan anlatıp bitiriyor",
          ],
          examples: {
            1: "Kuralı terimlerle sıralıyor: „Intransitive Verben der Fortbewegung und der Zustandsveränderung bilden das Perfekt mit sein.“ Örnek ya da yoklama yok; A2 öğrencisi takip edemez.",
            3: "„Heute lernen wir: Perfekt mit sein. Ich gehe von hier nach da (yürüyerek gösteriyor): Ich bin gegangen. Ich fahre nach Berlin: Ich bin nach Berlin gefahren. Nicht: Ich habe gefahren.“ İki örnek daha veriyor, sonra „Ich ... nach Hause gekommen: bin oder habe?“ diye soruyor.",
            5: "Tahtaya A→B oku çizip yürüyerek başlıyor: „Bewegung von A nach B: sein. Ich bin nach Berlin gefahren.“ Sonra değişim: „Ich schlafe, dann bin ich wach: Ich bin aufgewacht.“ Karşıt çift: „Ich habe Pizza gegessen. Ich bin ins Restaurant gegangen.“ Üç cümle için öğrencilerden kartla „sein“ ya da „haben“ göstermelerini istiyor, ilk yanlışı nedenini sorarak düzeltiyor, bleiben'i sonraki derse bıraktığını söylüyor.",
          },
          internal:
            "Referans: sein ile Perfekt: bir yerden bir yere hareket (gehen, fahren, fliegen, kommen), durum değişimi (aufstehen, einschlafen, aufwachen, werden) ve sein, bleiben, passieren. Fiillerin çoğu haben alır. A2 için iyi bir kural: 'Bewegung von A nach B oder Veränderung: sein'. Uzman ayrıntısı (A2'de şart değil): fahren nesneyle haben alır (Ich habe das Auto in die Garage gefahren); Güney Almanya, Avusturya ve İsviçre'de sitzen, liegen, stehen sein ile de kullanılır. Güçlü anlatım görsel ya da hareketle gösterir, karşıt örnek çifti verir ve kısa bir yoklama koyar.",
        }),
        longText({
          prompt: t(
            "45 dakikalık bir ders planı yaz.\n\nGrup: 10 yetişkin, A2.1. Çoğu gün boyu çalışıp akşam 18:00'de derse geliyor. İkisi geçen hafta A1'den yeni geçti ve daha yavaş ilerliyor.\nDersin hedefi: öğrenciler telefonda randevu alabilir, randevuyu iptal edip yeni bir zaman önerebilir (Ich möchte einen Termin vereinbaren. / Ich muss den Termin leider absagen. / Geht es auch am Donnerstag um 10 Uhr?).\nMalzeme: kitapta bir dinleme metni (bir oto servisini arayan müşteri, 1,5 dakika), tahta ve projeksiyon.\n\nPlanında şu aşamaları sırayla ve dakikalarıyla yaz: hedef, ısınma, sunum, alıştırma, kontrol. Her aşamada öğrencilerin ne yaptığını, çalışma düzenini (bireysel, ikili, grup) ve iki yavaş öğrenci için ne yaptığını belirt.",
            "Write a 45-minute lesson plan.\n\nGroup: 10 adults, A2.1. Most of them work all day and come to class at 18:00. Two moved up from A1 last week and progress more slowly.\nLesson aim: learners can make an appointment by phone, cancel it and suggest a new time (Ich möchte einen Termin vereinbaren. / Ich muss den Termin leider absagen. / Geht es auch am Donnerstag um 10 Uhr?).\nMaterial: a listening text in the coursebook (a customer calling a car repair shop, 1.5 minutes), a board and a projector.\n\nWrite these phases in order with their minutes: aim, warm-up, presentation, practice, check. For each phase say what the learners do, the grouping (individual, pairs, group) and what you do for the two slower learners.",
          ),
          competencies: ["didactics"],
          minChars: 500,
          maxChars: 4000,
          expected: [
            "Dakikaları 45'e denk gelen, hedef, ısınma, sunum, alıştırma ve kontrol aşamalarını içeren gerçekçi bir akış kuruyor",
            "Dinleme metnini görevle kullanıyor (önce genel, sonra ayrıntılı dinleme) ve hedef kalıpları metinden çıkarıyor",
            "Alıştırmayı kontrollüden serbeste doğru kuruyor; ikili telefon rol oyunuyla herkesi konuşturuyor",
            "Hedefi ölçen bir kontrol (yeni eşle rol oyunu, çıkış kartı) ve iki yavaş öğrenci için somut destek (kalıp kartı, güçlü eş) koyuyor",
          ],
          redFlags: [
            "Dersin çoğunu öğretmen anlatımına ayırıyor, öğrenciler konuşmuyor",
            "Aşamaların süreleri 45 dakikayı tutmuyor ya da süre yok",
            "Hedefi ölçen bir kontrol aşaması yok",
          ],
          examples: {
            1: "Isınma: hal hatır sorarım. Sunum: Termin kelimelerini anlatırım. Alıştırma: kitaptaki alıştırmaları yaparız. Kontrol: soru sorarım. Sonda ödev veririm.",
            3: "Isınma (5 dk): „Wann haben Sie Zeit?“ ile ikili sohbet. Sunum (12 dk): dinleme metnini iki kez dinletir, kalıpları tahtaya yazarım. Alıştırma (18 dk): boşluklu diyalog, sonra ikililerde rol kartlarıyla telefon görüşmesi. Kontrol (10 dk): iki ikili sınıfa canlandırır, düzeltirim. Yavaş iki öğrenciye kalıpların yazılı olduğu bir kart veririm.",
            5: "Hedef (1 dk): tahtada „Heute: Termine am Telefon vereinbaren und absagen“. Isınma (5 dk): ikililer bu hafta boş oldukları iki zamanı söyler. Sunum (12 dk): 1. dinleme kim kimi neden arıyor, 2. dinleme tarih ve saat; kalıpları metinden çıkarıp tekrar ederiz. Alıştırma (17 dk): diyalog sıralama, sonra sırt sırta bilgi boşluklu rol kartlarıyla arama; yavaş iki öğrenci kalıp kartı ve güçlü bir eşle. Kontrol (10 dk): eş değiştirip iptal ve yeni zaman; dolaşıp not alır, sık yanlışı sonda birlikte düzeltiriz.",
          },
        }),
      ],
    }),
    germanProficiencyStage("communication"),
  ],
};
