import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const examCentreOfficer: HiringTemplate = {
  key: "exam-centre-officer",
  group: "LANGUAGE_SCHOOL",
  name: t("Sınav Sorumlusu (lisanslı merkez)", "Exam Centre Officer (licensed centre)"),
  summary: t(
    "Katı kuralları olan bir etkinlik, kimliği kayıtla uyuşmayan aday, sınav günü kontrol listesi ve Hören sırasında telefon şüphesi.",
    "Running an event with strict rules, a candidate whose ID does not match, an exam-day checklist and a suspected phone during Hören.",
  ),
  jobAd: t(
    "Lisanslı sınav merkezimizde Goethe ve telc sınavlarının kayıt, sınav günü ve tutanak süreçlerini yürütecek bir Sınav Sorumlusu arıyoruz. Kuralı tanıdık için bile esnetmeyen, sınav gününü dakika dakika planlayan ve bir şüpheyi suçlamadan, eksiksiz kayda geçiren biri olmalısın.",
    "We are looking for an Exam Centre Officer who runs registration, exam days and incident records for Goethe and telc exams at our licensed centre. You do not bend a rule even for someone you know, you plan an exam day minute by minute and you record a suspicion completely without accusing anyone.",
  ),
  weights: { integrity: 40, organisation: 35, exam_expertise: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Bir kısa senaryo sorusu ve iki video sorusu. En fazla 13 dakika.",
        "One short scenario question and two video questions. At most 13 minutes.",
      ),
      purpose: "Kimlik kayıtla uyuşmadığında yetki sınırını bilme; katı kuralları olan bir etkinliği yürütme; uygunsuz bir talebi reddetme.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Sınav kurumunun kuralı: aday, kayıttaki bilgilerle eşleşen geçerli ve fotoğraflı bir kimlik göstermeden sınava giremez. Kayıt bilgisini yalnızca sınav kurumu düzeltebilir; kurumun sınav günleri için açık bir telefon hattı var.\n\nSınav sabahı 08:40, giriş 09:00'da kapanıyor. Bir adayın kimliği geçerli, fotoğraf yüzüyle uyuşuyor ve adı kayıttakiyle aynı. Ama kimlikteki doğum tarihi 21.03.2001, kayıtta 12.03.2001 yazıyor. Aday \"kayıtta yazım hatası olmuş\" diyor.\n\nNe yaparsın?",
            "The exam institution's rule: a candidate may not sit the exam without a valid photo ID that matches the registration details. Only the exam institution can correct registration details; it runs a phone line that is open on exam days.\n\nIt is 08:40 on exam morning and entry closes at 09:00. A candidate's ID is valid, the photo matches their face and the name is the same as in the registration. But the date of birth on the ID is 21.03.2001 and the registration says 12.03.2001. The candidate says \"there was a typo in the registration\".\n\nWhat do you do?",
          ),
          options: [
            t("Kurumun hattını arayıp durumu anlatmak, kurumun kararına göre adayı almak ve farkı tutanağa yazmak", "Call the institution's line, explain the case, admit the candidate according to its decision and record the difference"),
            t("Fotoğraf ve ad uyuştuğu için adayı almak ve farkı sınavdan sonra tutanağa yazmak", "Admit the candidate because the photo and name match, and record the difference after the exam"),
            t("Aday listesindeki doğum tarihini kimliğe göre düzeltmek ve adayı sınava almak", "Correct the date of birth on the candidate list to match the ID and admit the candidate"),
            t("Kimlik kayıtla uyuşmadığı için adayı hemen geri göndermek ve durumu tutanağa yazmak", "Send the candidate away at once because the ID does not match, and record the case"),
          ],
          correct: 0,
          internal:
            "Doğru cevap: kurumun hattını aramak, kararına göre hareket etmek ve tutanak. Kayıt bilgisini yalnızca kurum düzeltebilir ve bunun için sınav günü açık bir hat var; giriş kapanmadan 20 dakika var. Çeldiriciler: fotoğraf ve ad uyuşuyor diye almak (kural kayıtla eşleşmeyi istiyor, karar merkezin değil); listeyi kendin düzeltmek (yetki aşımı); hemen geri göndermek (kurumun hattını kullanmadan adayı mağdur etmek).",
        }),
        video({
          prompt: t(
            "Kuralları katı olan bir etkinliği ya da süreci yürüttüğün ya da yürütülmesinde görev aldığın bir durumu anlat (iş, okul ya da gönüllü bir işte; örneğin bir sınav, seçim, denetim, bilet kontrolü): önceden neyi nasıl hazırladın, gün içinde kurala uymayan bir şey olduğunda ne yaptın ve sonrasında neyi kayda geçirdin?",
            "Tell us about a time you ran, or had a role in, an event or process with strict rules (at work, school or volunteering; for example an exam, an election, an audit, a ticket check): what did you prepare in advance and how, what did you do when something did not follow the rules on the day, and what did you record afterwards?",
          ),
          competencies: ["organisation", "integrity"],
          expected: [
            "Hazırlığı somut adımlarla anlatıyor (liste, oturma planı, malzeme, görev dağılımı, zaman çizelgesi)",
            "Kurala uymayan durumu nasıl ele aldığını, kuralı esnetmeden ve kişiyi küçük düşürmeden anlatıyor",
            "Ne olduğunu, saatini ve kimin tanık olduğunu kayda geçirdiğini ve kime bildirdiğini söylüyor",
            "Sonradan süreçte neyi değiştirdiğini söylüyor",
          ],
          redFlags: ["Kuralı \"bir kereden bir şey olmaz\" diye esnettiğini anlatıyor", "Hiçbir şeyi kayda geçirmediğini ya da bildirmediğini anlatıyor"],
          examples: {
            1: "Böyle etkinliklerde kurallar biraz esnek olmalı, insanlar zaten stresli. Bir şey olursa idare ederim.",
            3: "Okulumuzdaki bir sınavda gözetmendim. Sabah salonu ve oturma planını hazırladım. Bir öğrenci telefonunu sıraya koymuştu, telefonu öndeki masaya bıraktırdım ve sınav sonunda sorumluya söyledim.",
            5: "Üniversitedeki öğrenci temsilcisi seçiminde sandık görevlisiydim. Bir gün önce seçmen listesini, mühürleri ve sayım tutanağını kontrol ettim, görevleri saat saat dağıttım. Gün içinde biri listede adı olmayan bir arkadaşı için oy kullanmak istedi; kuralı sakin bir şekilde söyleyip seçim kuruluna yönlendirdim ve saatiyle tutanağa yazdım. Sayımda iki görevliyle birlikte imzaladık. Sonraki seçimde girişte liste kontrolünü ayrı bir masaya aldık, aynı tartışma tekrar olmadı.",
          },
        }),
        video({
          prompt: t(
            "Birinin senden bir kuralı esnetmeni ya da paylaşmaman gereken bir bilgiyi paylaşmanı istediği bir durumu anlat (iş, okul ya da gönüllü bir işte; tanıdığın biri de olabilir): tam olarak ne istendi, ona ne söyledin, ne yaptın ve sonra ne oldu?",
            "Tell us about a time someone asked you to bend a rule or share information you should not share (at work, school or volunteering; it may have been someone you knew): what exactly was asked, what did you say, what did you do, and what happened afterwards?",
          ),
          competencies: ["integrity"],
          expected: [
            "Talebi ve kendi cevabını somut aktarıyor (ne dediğini tırnak içinde ya da açıkça)",
            "Reddi nazik ama net yapıyor ve gerekçesini kurala ya da kişilerin hakkına bağlıyor",
            "Mümkünse doğru kanalı ya da meşru bir alternatifi gösteriyor ve gerekiyorsa olayı bildiriyor ya da kaydediyor",
          ],
          redFlags: ["Tanıdık olduğu için \"bu seferlik\" kuralı esnettiğini anlatıyor", "Reddettiğini söylüyor ama ne dediğini ve ne yaptığını anlatamıyor"],
          examples: {
            1: "Bir arkadaşım sınav sonuçlarını önceden sormuştu, sadece kendi notunu söyledim, kimseye zararı yoktu.",
            3: "Bir tanıdığım kursa kayıt tarihi geçtikten sonra kaydolmak istedi. Kuralın herkes için aynı olduğunu söyleyip reddettim ve bir sonraki dönemin tarihini verdim.",
            5: "Okulun kayıt biriminde çalışırken bir veli, oğlunun sınıfındaki başka bir öğrencinin notlarını istedi. 'Başka bir öğrencinin bilgisini paylaşamam, bu onun hakkı' dedim. Kendi oğlunun sonuçlarını ve öğretmenle görüşme randevusunu önerdim, kabul etti. Talebi yöneticime de bildirdim. Sonra benzer sorular için kısa bir yazılı açıklama hazırladık ve tüm birimle paylaştık.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki yazılı görev: 20 adaylık yazılı bir sınav modülü için sınav günü kontrol listesi ve Hören sırasında telefon kullanma şüphesi. En fazla 20 dakika.",
        "Two written tasks like the real job: an exam-day checklist for a 20-candidate written module and a suspected phone use during Hören. At most 20 minutes.",
      ),
      purpose: "Sınav gününü aşamalara bölme ve sınav bilgisini (kimlik kuralı, geçme koşulu) doğru kullanma; şüpheyi diğer adayları etkilemeden ele alma ve eksiksiz tutanak.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Cumartesi 09:30'da merkezinde Goethe-Zertifikat B1'in Schreiben modülü var: 20 aday, bir salon, sen ve iki gözetmen. Salonun kuralı: telefonlar ve akıllı saatler kapalı olarak salon girişindeki çantalarda kalır.\n\nSınav günü kontrol listeni yaz. Şu aşamalara böl: bir gün önce, sınav sabahı adaylar gelmeden, adayların girişi, sınav sırasında, sınavdan sonra. Her maddede kimin yapacağını belirt.\n\nListenin sonuna, çıkışta bir adayın şu sorusuna vereceğin kısa cevabı ekle: \"Goethe B1'den geçmek için kaç puan gerekiyor? Dört modülün ortalamasına mı bakılıyor?\"",
            "On Saturday at 09:30 your centre runs the Schreiben module of the Goethe-Zertifikat B1: 20 candidates, one room, you and two invigilators. The room rule: phones and smartwatches stay switched off in the bags at the room entrance.\n\nWrite your exam-day checklist. Split it into these phases: the day before, the exam morning before candidates arrive, candidate entry, during the exam, after the exam. For each item say who does it.\n\nAt the end of the list add the short answer you would give a candidate who asks on the way out: \"How many points do I need to pass Goethe B1? Is it the average of the four modules?\"",
          ),
          competencies: ["organisation", "exam_expertise"],
          expected: [
            "Listeyi istenen aşamalara bölüyor ve her maddeye bir sorumlu atıyor (sen, gözetmen 1, gözetmen 2)",
            "Girişte her adayın geçerli, fotoğraflı ve kayıtla eşleşen kimliğini aday listesiyle kontrol ediyor; telefon ve saatlerin çantaya konduğunu doğruluyor",
            "Sınav kağıtlarının güvenliğini, oturma planını, saat ve süre takibini, olay tutanağını ve sınav sonrası kağıtların sayılıp teslimini ele alıyor",
            "Adaya doğru cevabı veriyor: ortalamaya bakılmıyor, dört modülün her birinde ayrı ayrı 100 üzerinden en az 60 gerekiyor",
          ],
          redFlags: ["Kimlik kontrolünü atlıyor ya da yalnızca \"kimlik bakılır\" deyip kayıtla karşılaştırmayı söylemiyor", "Geçme koşulunu yanlış veriyor (ortalama, toplam puan ya da başka bir eşik)", "Sınav kağıtlarının sayımını ve teslimini hiç anmıyor"],
          examples: {
            1: "Sabah salonu açarım, adaylar gelince sınavı başlatırım, bitince kağıtları toplarım. Geçmek için ortalama 60 yeterli.",
            3: "Bir gün önce: aday listesini ve oturma planını hazırlarım. Sabah: salonu ve kağıtları kontrol ederim. Giriş: gözetmenler kimlikleri kontrol eder, telefonları çantaya koydurur. Sınav sırasında: süreyi tahtaya yazarız, gözetmenler salonda dolaşır. Sonra: kağıtları sayıp teslim ederim. Adaya: her modülde 60 puan gerekir.",
            5: "Bir gün önce (ben): aday listesi, oturma planı, kağıtların kilitli dolapta sayımı, tutanak formu, görev dağılımı. Sabah 08:30 (ben, G1): salon, masa numaraları, saat; kağıtlar sayılarak alınır. Giriş (G1, G2): kimlik geçerli, fotoğraflı ve kayıtla aynı mı; telefon ve saat kapalı olarak çantaya; uyuşmazlıkta beni çağırırlar. Sınav: başlangıç ve bitiş tahtaya, G2 dolaşır, olay olursa saatiyle tutanak. Sonra: kağıtlar listeyle sayılır, imzalı tutanakla teslim. Adaya: ortalamaya bakılmıyor; dört modülün her birinde 100 üzerinden en az 60 gerekiyor.",
          },
          internal:
            "Referans (sınav bilgisi): Goethe-Zertifikat B1 dört modülden oluşur (Lesen, Hören, Schreiben, Sprechen) ve her modülde geçmek için 100 üzerinden en az 60 gerekir; ortalamaya bakılmaz. Aday, kayıttaki bilgilerle eşleşen geçerli fotoğraflı bir kimlik göstermeden sınava giremez. Bu iki bilgi doğru verilmezse sınav bilgisi puanı 1. Organizasyon için güçlü liste: beş aşama, her maddede sorumlu, kağıt güvenliği (kilitli, sayılarak teslim alma ve teslim etme), kimlik ve telefon kontrolü, süre takibi, olay tutanağı. Bu şablon sınav kurumunun ayrıntılı süre ve prosedür kurallarını vermiyor; adayın uydurduğu ayrıntılar değil, mantıklı bir yapı puanlanır.",
        }),
        longText({
          prompt: t(
            "Goethe-Zertifikat B1'in Hören modülü sürüyor. Ses kaydı tüm salon için hoparlörden çalıyor ve durdurulamıyor. 20 aday var; sen ve bir gözetmen salondasın. Salonun kuralı: telefonlar ve akıllı saatler kapalı olarak salon girişindeki çantalarda kalır.\n\n14 numaralı masadaki adayın birkaç kez başını eğip kucağına baktığını ve masanın altında bir ekran ışığına benzer bir parıltı olduğunu görüyorsun. Henüz emin değilsin.\n\nMerkezin yazılı prosedürü: sınav kurallarına aykırı her durum, saati ve tanıklarıyla tutanağa yazılır; sınav sorumlusu tutanağı aynı gün sınav kurumuna gönderir; adayın sonucuna sınav kurumu karar verir.\n\nNe yaparsın ve tutanağa neleri yazarsın? Sınav sırasında ve sınavdan sonra yapacaklarını sırayla yaz.",
            "The Hören module of the Goethe-Zertifikat B1 is in progress. The recording plays through a speaker for the whole room and cannot be stopped. There are 20 candidates; you and one invigilator are in the room. The room rule: phones and smartwatches stay switched off in the bags at the room entrance.\n\nYou see the candidate at desk 14 lower their head and look at their lap several times, and a glow like a screen light under the desk. You are not sure yet.\n\nThe centre's written procedure: every breach of the exam rules is recorded with the time and the witnesses; the exam centre officer sends the record to the exam institution on the same day; the exam institution decides on the candidate's result.\n\nWhat do you do, and what do you write in the record? Write, in order, what you do during the exam and after it.",
          ),
          competencies: ["integrity", "exam_expertise"],
          expected: [
            "Diğer adayları ve çalan ses kaydını bozmadan sessizce yaklaşıp durumu doğruluyor; gözetmenden tanık olarak gözlemesini istiyor",
            "Bir cihaz görürse sessizce alıp güvenceye alıyor ve saatini not ediyor; emin değilse adayı herkesin önünde suçlamıyor ama gözlemini yine kayda geçiriyor",
            "Sonuç hakkında kendisi karar vermiyor ya da söz vermiyor; prosedüre göre tutanağı aynı gün sınav kurumuna gönderiyor",
            "Tutanağa somut bilgileri yazıyor: saat, masa numarası, aday adı, ne gördüğü, tanık, alınan cihaz, adayın açıklaması; ayrıca cihazın girişten nasıl geçtiğini sorgulayıp önlem öneriyor",
          ],
          redFlags: ["Hören'i durdurmaya ya da adayla salonda yüksek sesle tartışmaya kalkıyor", "Emin olmadığı için hiçbir şey yapmıyor ya da hiçbir şeyi kayda geçirmiyor", "Adayın sonucuna kendisi karar veriyor ya da tutanağı göndermeyeceğine dair söz veriyor"],
          examples: {
            1: "Emin olmadığım için bir şey yapmam, adayı rahatsız etmek istemem. Sınav bitince konuşurum, gerek yoksa tutanak tutmam.",
            3: "Sessizce masaya giderim, telefon varsa alırım. Sınav bitince adayla konuşur, olanları tutanağa yazar ve sınav kurumuna bildiririm.",
            5: "Gözetmene işaret edip 14'ü izlemesini isterim, sonra sesi bozmadan masaya yaklaşırım. Telefon görürsem sessizce alıp masama koyar, saati not ederim (örneğin 10:42). Göremezsem adayı suçlamam ama yakınında kalır, gözlemimi saatiyle not ederim. Sınav bitince adayı salon dışında, gözetmenin yanında dinler, açıklamasını yazarım. Tutanak: tarih, modül, saat, masa 14, aday adı, gözlem, tanık, cihaz ve adayın açıklaması; ikimiz imzalarız. Aynı gün sınav kurumuna gönderirim; sonuç kurumun kararıdır, adaya söz vermem. Ayrıca girişte çanta kontrolümüzü gözden geçiririm.",
          },
          internal:
            "Referans: (1) Hören kaydı tüm salon için çalıyor ve durdurulamıyor; müdahale diğer adayları etkilememeli. (2) Şüphe kesin değil; önce sessizce doğrulama ve ikinci bir tanık. (3) Cihaz görülürse güvenceye alma ve saat; görülmezse suçlamadan gözlem kaydı. (4) Prosedür gereği tutanak aynı gün sınav kurumuna gider ve sonuca kurum karar verir; merkez ceza ya da sonuç kararı vermez, adaya söz vermez. (5) Tutanak içeriği: tarih, modül, saat, masa, aday, gözlenen davranış, tanık, alınan cihaz, adayın açıklaması, imzalar. Ek puan: girişteki telefon kontrolünün neden işlemediğini sorgulamak. Bu şablon sınav kurumunun kendi ceza kurallarını vermiyor; aday bunları uydurursa ek puan almaz.",
        }),
      ],
    }),
  ],
};
