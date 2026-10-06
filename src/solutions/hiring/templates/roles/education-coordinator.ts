import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const educationCoordinator: HiringTemplate = {
  key: "education-coordinator",
  group: "LANGUAGE_SCHOOL",
  name: t("Eğitim Koordinatörü", "Education Coordinator"),
  summary: t(
    "Öğretmenler arası anlaşmazlık, ders programı çakışması, haftalık program önerisi ve şikayet alan bir öğretmen için geri bildirim planı.",
    "A conflict between teachers, a timetable clash, a weekly timetable proposal and a feedback plan for a teacher with learner complaints.",
  ),
  jobAd: t(
    "Dil okulumuzda ders programını, öğretmen ekibini ve kur geçişlerini yönetecek bir Eğitim Koordinatörü arıyoruz. Kısıtları görüp uygulanabilir bir program kuran, öğretmenlere derse dayanan somut geri bildirim veren ve anlaşmazlıkları ekibi bölmeden çözen biri olmalısın.",
    "We are looking for an Education Coordinator who runs the timetable, the teaching team and level changes at our language school. You see the constraints and build a timetable that works, give teachers concrete feedback grounded in their lessons and resolve disagreements without splitting the team.",
  ),
  weights: { organisation: 40, didactics: 35, teamwork: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Bir kısa senaryo sorusu ve iki video sorusu. En fazla 13 dakika.",
        "One short scenario question and two video questions. At most 13 minutes.",
      ),
      purpose: "Ders programı çakışmasında kurallara uyan seçeneği bulma; iki öğretmen arasındaki anlaşmazlığı çözme; bir dersi gözlemleyip öğretimle ilgili somut geri bildirim verme.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Salı akşamları şu an:\n- Oda 1: A2 grubu, öğretmen Elif, 18:00-21:00\n- Oda 2: B1 grubu, öğretmen Jonas, 18:00-21:00\n- Oda 3: salı 19:00'a kadar başka bir kuruma kiralı, 19:00-22:00 boş\n\nYeni bir B2 grubu salı akşamı 3 saatlik ders istiyor. Ayşe salı 17:00-22:00 arası boş. Okul binası 22:00'de kapanıyor. Devam eden grupların gün ve saati kur ortasında değiştirilemiyor.\n\nHangi plan bu kuralların hiçbirini bozmaz?",
            "Tuesday evenings at the moment:\n- Room 1: A2 group, teacher Elif, 18:00-21:00\n- Room 2: B1 group, teacher Jonas, 18:00-21:00\n- Room 3: rented to another organisation until 19:00 on Tuesdays, free 19:00-22:00\n\nA new B2 group wants a 3-hour lesson on Tuesday evening. Ayşe is free on Tuesdays 17:00-22:00. The building closes at 22:00. Running groups cannot change their day or time in the middle of a course.\n\nWhich plan breaks none of these rules?",
          ),
          options: [
            t("B2 grubu salı 18:00-21:00, Oda 3, öğretmen Ayşe", "B2 group Tuesday 18:00-21:00, Room 3, teacher Ayşe"),
            t("B2 grubu salı 19:00-22:00, Oda 3, öğretmen Ayşe", "B2 group Tuesday 19:00-22:00, Room 3, teacher Ayşe"),
            t("B2 grubu salı 18:00-21:00, Oda 2, öğretmen Jonas; B1 grubu çarşambaya", "B2 group Tuesday 18:00-21:00, Room 2, teacher Jonas; B1 group moves to Wednesday"),
            t("B2 grubu salı 19:00-22:00, Oda 3, öğretmen Elif", "B2 group Tuesday 19:00-22:00, Room 3, teacher Elif"),
          ],
          correct: 1,
          internal:
            "Doğru cevap: salı 19:00-22:00, Oda 3, Ayşe. Çeldiriciler: 18:00-21:00 Oda 3 (oda 19:00'a kadar kiralı); Jonas ve B1'i çarşambaya taşımak (devam eden grubun saati değiştirilemez); Elif 19:00-22:00 (Elif 21:00'e kadar A2 grubunda).",
        }),
        video({
          prompt: t(
            "İki iş arkadaşı (örneğin iki öğretmen) arasındaki bir anlaşmazlığı çözdüğün ya da çözmeye yardım ettiğin bir durumu anlat (iş, okul ya da gönüllü bir işte): anlaşmazlık neydi, iki tarafla nasıl ve ne zaman konuştun, ne söyledin, hangi ortak karara varıldı ve sonra ne oldu?",
            "Tell us about a time you resolved, or helped resolve, a disagreement between two colleagues, for example two teachers (at work, school or volunteering): what was the disagreement, how and when did you talk to each side, what did you say, what shared decision was reached, and what happened afterwards?",
          ),
          competencies: ["teamwork", "organisation"],
          expected: [
            "Anlaşmazlığı somut anlatıyor (paylaşılan grup, ders materyali, oda, nöbet) ve iki tarafın gerekçesini adil aktarıyor",
            "Önce ayrı ayrı, sonra birlikte dinlediğini ve konuşmayı kişilerden çok öğrenciye ya da işe yönelttiğini anlatıyor",
            "Ortak kararı somut söylüyor (kim neyi ne zamana kadar yapacak) ve takibi nasıl yaptığını anlatıyor",
            "Kendi fikrinden vazgeçtiği ya da yanıldığı bir noktayı açıkça söylüyor",
          ],
          redFlags: ["Taraflardan birini haklı ilan edip diğerini dinlemeden kararı dayattığını anlatıyor", "Anlaşmazlığı görmezden gelip kendiliğinden geçmesini beklediğini söylüyor"],
          examples: {
            1: "Öğretmenler arasında böyle şeyler olur, karışmam. Kendi aralarında hallederler.",
            3: "Aynı grubu paylaşan iki öğretmen ödev miktarı konusunda anlaşamıyordu. İkisini bir araya getirdim, her birinin fikrini dinledim ve haftada iki ödevde anlaştık.",
            5: "Aynı B1 grubunu paylaşan iki öğretmenden biri kitabı sırayla bitirmek, diğeri sınav görevlerine ağırlık vermek istiyordu ve öğrenciler iki farklı yön görüyordu. Önce ikisiyle ayrı ayrı 15 dakika konuştum, sonra öğrencilerin ara sınav sonuçlarını masaya koyup birlikte oturduk. Ben kitabın bitmesini savunuyordum; veriler Schreiben'de zayıflığı gösterince fikrimi değiştirdim. Haftada bir dersi sınav görevine ayırmayı ve ortak bir ders planı tablosunu kararlaştırdık. Dört hafta sonra ikisiyle tekrar baktık; şikayetler bitti ve Schreiben ortalaması yükseldi.",
          },
        }),
        video({
          prompt: t(
            "Bir dersi (başkasının ya da kendi dersini) gözlemleyip öğretimle ilgili bir şeyi değiştirdiğin ya da değiştirmesine yardım ettiğin bir durumu anlat: derste tam olarak ne gördün, bunu kime nasıl söyledin, ne değişti ve değişikliğin işe yarayıp yaramadığını nasıl anladın?",
            "Tell us about a time you observed a lesson (someone else's or your own) and changed, or helped change, something about the teaching: what exactly did you see in the lesson, whom did you tell and how, what changed, and how did you find out whether the change worked?",
          ),
          competencies: ["didactics", "teamwork"],
          expected: [
            "Gözlemi yoruma değil derste görülen somut bir davranışa dayandırıyor (öğrencilerin konuşma süresi, talimatın anlaşılması, ödev geri bildirimi)",
            "Öğretimle ilgili bir değişiklik öneriyor (etkinlik, aşamalandırma, anlaşıldığını yoklama) ve nedenini öğrencinin öğrenmesine bağlıyor",
            "Geri bildirimi saygılı ve iki yönlü verdiğini, öğretmenin görüşünü de aldığını anlatıyor",
            "Değişikliğin etkisini somut bir ölçüyle kontrol ettiğini söylüyor (ikinci gözlem, öğrenci sonucu, kısa anket)",
          ],
          redFlags: ["Geri bildirimi \"ders sıkıcıydı\" gibi genel bir yargıyla veriyor", "Değişikliğin işe yarayıp yaramadığını hiç kontrol etmiyor"],
          examples: {
            1: "Ders bence iyiydi, öğretmene genel olarak güzel olduğunu söyledim. Her öğretmenin kendi tarzı var.",
            3: "Bir derste öğretmen talimatı verdikten sonra öğrencilerin yarısı ne yapacağını bilmiyordu. Dersten sonra bunu söyledim, talimattan sonra bir öğrenciye görevi tekrar ettirmesini önerdim. Bir sonraki derste daha az soru geldi.",
            5: "Bir A2 dersinde 90 dakikanın 55'inde öğretmenin konuştuğunu, öğrencilerin ancak 10 dakika konuştuğunu not ettim. Dersten sonra önce öğretmene dersin hedefini ve kendi gözlemini sordum; o da grubun sessiz olduğunu düşünüyordu. Konuşma görevlerini ikili çalışmaya çevirmeyi ve her görevin başında örnek bir diyalog vermeyi birlikte planladık. İki hafta sonra ikinci gözlemde öğrencilerin konuşma süresi 30 dakikaya çıktı ve sessiz iki öğrenci ilk kez gönüllü konuştu.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki yazılı görev: kısıtları verilmiş bir haftalık ders programı önerisi ve öğrenci şikayetleri alan bir öğretmen için geri bildirim planı. En fazla 20 dakika.",
        "Two written tasks like the real job: a weekly timetable proposal with given constraints and a feedback plan for a teacher with learner complaints. At most 20 minutes.",
      ),
      purpose: "Birbirine bağlı kısıtlarla uygulanabilir bir program kurma; şikayeti gözleme dayalı bir geri bildirim planına çevirme ve sınırda bir öğrencinin kur kararını kurala ve kanıta göre verme.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Gelecek dönem için haftalık ders programı öner.\n\nZaman dilimleri: pazartesi-cuma, sabah 09:00-12:00 ve akşam 18:00-21:00. Her grup haftada 2 ders yapar; bir grubun iki dersi art arda iki güne konmaz. İki oda var (Oda 1, Oda 2); Oda 2 çarşamba akşamı başka bir sınava ayrıldı.\n\nÖğretmenler (her biri haftada en fazla 4 ders):\n- Ayşe: yalnızca sabahları, pazartesi-cuma\n- Jonas: yalnızca akşamları, pazartesi-perşembe; sınav hazırlık grubunu yalnızca o verebilir\n- Elif: yalnızca pazartesi, çarşamba ve cuma akşamları\n\nGruplar:\n- G1: A1 akşam\n- G2: A2 akşam; öğrenciler yalnızca salı ve perşembe akşamı gelebiliyor\n- G3: B1 sabah\n- G4: B1 sınav hazırlık, akşam\n- G5: A2 sabah\n\nProgramı tablo gibi yaz (gün, saat, oda, grup, öğretmen). Her seçimi hangi kısıtın belirlediğini kısaca açıkla ve programı yayınlamadan önce kimle neyi teyit edeceğini yaz.",
            "Propose the weekly timetable for next term.\n\nTime slots: Monday to Friday, morning 09:00-12:00 and evening 18:00-21:00. Each group has 2 lessons a week; a group's two lessons are never on two consecutive days. There are two rooms (Room 1, Room 2); Room 2 is booked for another exam on Wednesday evening.\n\nTeachers (each at most 4 lessons a week):\n- Ayşe: mornings only, Monday to Friday\n- Jonas: evenings only, Monday to Thursday; he is the only one who can teach the exam-prep group\n- Elif: Monday, Wednesday and Friday evenings only\n\nGroups:\n- G1: A1 evening\n- G2: A2 evening; the learners can only come on Tuesday and Thursday evenings\n- G3: B1 morning\n- G4: B1 exam prep, evening\n- G5: A2 morning\n\nWrite the timetable like a table (day, time, room, group, teacher). Briefly explain which constraint decided each choice, and say what you would confirm with whom before publishing it.",
          ),
          competencies: ["organisation"],
          expected: [
            "G2'yi salı ve perşembe akşamı Jonas'a veriyor, çünkü o akşamlarda yalnızca Jonas var",
            "G4'ü Jonas'a pazartesi ve çarşamba akşamı koyuyor (Jonas'ın kalan art arda olmayan tek ikilisi) ve böylece Jonas 4 dersle sınırında kalıyor",
            "Oda 2'nin çarşamba akşamı kapalı olduğunu görüp G1'i Elif'le pazartesi ve cuma akşamı koyuyor; G3 ve G5'i Ayşe'ye art arda olmayan sabahlara yerleştiriyor",
            "Yayından önce teyit edilecekleri söylüyor (Oda 2 rezervasyonu, öğretmenlerin onayı, G2 öğrencilerinin günleri) ve bir öğretmen gelemezse ne olacağına değiniyor",
          ],
          redFlags: ["Bir kısıtı bozan bir program veriyor (çarşamba akşamı iki grup, G4'ü başka öğretmene verme, art arda günler)", "Gerekçe vermeden yalnızca tablo yazıyor ya da tablo hiç vermiyor"],
          examples: {
            1: "Her öğretmen eşit sayıda grup alsın: Ayşe G3 ve G5, Jonas G1 ve G4, Elif G2. Günleri öğretmenler kendi aralarında seçsin.",
            3: "Ayşe: G3 pazartesi ve çarşamba sabah, G5 salı ve perşembe sabah. Jonas: G2 salı ve perşembe akşam, G4 pazartesi ve çarşamba akşam. Elif: G1 pazartesi ve çarşamba akşam. Odaları öğretmenlerle konuşup dağıtırım.",
            5: "Pzt 09:00 Oda 1 G3 Ayşe; Sal 09:00 Oda 1 G5 Ayşe; Çar 09:00 Oda 1 G3 Ayşe; Per 09:00 Oda 1 G5 Ayşe. Pzt 18:00 Oda 1 G4 Jonas, Oda 2 G1 Elif; Sal 18:00 Oda 1 G2 Jonas; Çar 18:00 Oda 1 G4 Jonas; Per 18:00 Oda 1 G2 Jonas; Cum 18:00 Oda 1 G1 Elif. Gerekçe: G2 salı/perşembe, o akşamlar yalnızca Jonas; G4 Jonas'ın, kalan tek ikili pazartesi/çarşamba; çarşamba Oda 2 kapalı, G1 pazartesi/cuma. Jonas ve Ayşe 4 derste. Yayından önce Oda 2 rezervasyonunu, üç öğretmenin onayını ve G2'nin günlerini teyit ederim.",
          },
          internal:
            "Referans çözüm (akşamlar tek): Jonas G2 salı ve perşembe (o akşamlar yalnızca Jonas çalışıyor), Jonas G4 pazartesi ve çarşamba (G4 yalnızca Jonas'ın; salı/perşembe dolu, kalan art arda olmayan ikili pazartesi/çarşamba). Çarşamba akşamı Oda 2 kapalı ve Oda 1'de G4 var, bu yüzden G1 çarşamba olamaz: Elif G1 pazartesi ve cuma. Pazartesi akşamı iki oda kullanılır. Sabahlar: Ayşe G3 ve G5, her biri art arda olmayan iki gün (örnek: G3 pazartesi/çarşamba, G5 salı/perşembe; başka geçerli ikililer de doğru sayılır). Ayşe ve Jonas 4 dersle sınırda; Elif 2 ders. Tuzaklar: G4 yalnızca Jonas, G2 yalnızca salı/perşembe, çarşamba Oda 2 kapalı, art arda gün yasağı. Oda adları değişebilir, kısıtları bozmayan her çözüm doğrudur.",
        }),
        longText({
          prompt: t(
            "Murat bu dönem okulda yeni ve B1.1 akşam grubunu (12 öğrenci) veriyor. Kur ortası anketinde 5 öğrenci şunları yazdı:\n- \"Derslerin çoğunda öğretmen tahtada gramer anlatıyor, biz çok az konuşuyoruz.\"\n- \"Ödevlerimiz üç haftadır düzeltilip geri gelmedi.\"\n- \"Ders çoğu zaman 10 dakika geç başlıyor.\"\n\nAyrıca bu gruptaki Selin'in kur sonu testi şöyle (her bölüm 100 puan): Lesen 70, Hören 65, Schreiben 45, Sprechen 50. Schreiben ve Sprechen'i Murat puanladı.\n\nOkulun kur geçme kuralı: B1.2'ye geçmek için dört bölümün ortalaması en az 60 olmalı. Ortalaması 55-59 arasında kalan öğrenci için koordinatör, başka bir öğretmenle ikinci bir değerlendirme yapabilir; karar bir hafta içinde verilir.\n\nİki şey yaz:\n1) Murat için geri bildirim planın: ne zaman neyi gözlemlersin, onunla nasıl konuşursun, hangi somut hedefleri koyarsınız ve nasıl takip edersin?\n2) Selin için kararın ve gerekçen: ne yaparsın, Selin'e ne söylersin?",
            "Murat is new at the school this term and teaches the B1.1 evening group (12 learners). In the mid-course survey 5 learners wrote:\n- \"In most lessons the teacher explains grammar on the board and we speak very little.\"\n- \"Our homework has not come back corrected for three weeks.\"\n- \"The lesson usually starts 10 minutes late.\"\n\nAlso, Selin in this group has these end-of-course test results (each part out of 100): Lesen 70, Hören 65, Schreiben 45, Sprechen 50. Murat marked Schreiben and Sprechen.\n\nThe school's rule for moving up: to move to B1.2 the average of the four parts must be at least 60. For a learner whose average is between 55 and 59, the coordinator may arrange a second assessment with another teacher; the decision is made within one week.\n\nWrite two things:\n1) Your feedback plan for Murat: what do you observe and when, how do you talk to him, what concrete goals do you agree and how do you follow up?\n2) Your decision for Selin and your reasons: what do you do, and what do you tell Selin?",
          ),
          competencies: ["didactics", "teamwork"],
          expected: [
            "Şikayetleri doğrudan suç olarak değil gözlemle doğrulanacak bilgi olarak ele alıyor: habersiz değil önceden konuşulmuş bir ders gözlemi ve öğrenci konuşma süresine, ödev geri bildirimine, başlangıç saatine bakma",
            "Murat'la iki yönlü bir konuşma planlıyor, yeni olduğunu ve desteğe ihtiyacını hesaba katıyor ve ölçülebilir hedefler koyuyor (örneğin her derste en az 30 dakika öğrenci konuşması, ödevlerin bir hafta içinde dönmesi, dakik başlangıç) ile bir takip tarihi veriyor",
            "Selin'in ortalamasını 57,5 olarak doğru hesaplıyor, 55-59 bandında olduğunu görüyor ve Schreiben ile Sprechen için başka bir öğretmenle ikinci değerlendirme istiyor",
            "Selin'e kararı ve tarihini açıkça söylüyor, sonuç ne olursa olsun Schreiben ve Sprechen için somut bir destek öneriyor",
          ],
          redFlags: ["Murat'ı gözlem yapmadan yalnızca şikayetlere göre uyarıyor ya da şikayetleri önemsemiyor", "Selin'i kuralı ve ikinci değerlendirme seçeneğini yok sayarak doğrudan geçiriyor ya da kurda bırakıyor", "Ortalamayı yanlış hesaplıyor"],
          examples: {
            1: "Murat'a şikayetleri iletirim ve düzelmesini söylerim. Selin'in ortalaması 60'ın altında, kurallar belli, B1.1'i tekrar eder.",
            3: "Murat'ın bir dersini gözlemlerim, sonra şikayetleri onunla konuşurum. Daha çok konuşma etkinliği yapmasını ve ödevleri zamanında geri vermesini isterim, bir ay sonra tekrar bakarız. Selin'in ortalaması 57,5; ikinci değerlendirme yaparım, sonucuna göre karar veririm ve Selin'e bildiririm.",
            5: "1) Murat'la önce kısa tanışma konuşması, gelecek hafta önceden haber verdiğim bir ders gözlemi: öğrenci konuşma süresi, başlangıç saati, ödev geri bildirimi. Gözlemden sonra önce onun görüşünü alırım. Hedefler: ders 18:00'de başlar, her derste en az 30 dakika ikili ya da grup konuşması, ödevler bir hafta içinde düzeltilmiş döner. İki hafta sonra ikinci gözlem, kur sonunda kısa anket. 2) Selin'in ortalaması 57,5, 55-59 bandında. Bu hafta başka bir öğretmenle Schreiben ve Sprechen için ikinci değerlendirme yaparız; Selin'e kuralı, tarihi ve iki bölüm için destek saatini anlatırım.",
          },
          internal:
            "Referans: Selin'in ortalaması (70 + 65 + 45 + 50) / 4 = 57,5; kural gereği 55-59 bandında. Güçlü karar: bir hafta içinde başka bir öğretmenle ikinci değerlendirme (özellikle Murat'ın puanladığı ve şikayetlerle ilgili olabilecek Schreiben ve Sprechen), sonuca göre geçiş ya da tekrar; Selin'e süreç ve tarih açıkça söylenir. Doğrudan geçirmek ya da doğrudan bırakmak kuralın verdiği aracı kullanmamaktır. Murat için güçlü plan: şikayetleri gözlemle doğrular, iki yönlü konuşur, ölçülebilir hedef ve takip tarihi koyar; yeni öğretmen olduğu için destek (örnek ders planı, deneyimli bir öğretmenin dersini izleme) önerir.",
        }),
      ],
    }),
  ],
};
