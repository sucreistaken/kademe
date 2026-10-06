import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const hrSpecialist: HiringTemplate = {
  key: "hr-specialist",
  group: "EXTRA",
  name: t("İnsan Kaynakları Uzmanı", "HR Specialist"),
  summary: t(
    "Gizli bir konu, yasak mülakat sorusu, çalışan şikayetinde ilk adımlar ve finalist adaya ret e-postası.",
    "A confidential matter, a forbidden interview question, first steps on an employee complaint and a rejection e-mail to a finalist.",
  ),
  jobAd: t(
    "İşe alım, işe başlama ve çalışan ilişkileri süreçlerini yürütecek bir İnsan Kaynakları Uzmanı arıyoruz. Gizli bilgiyi koruyan, zor bir haberi açık ve saygılı bir dille veren ve aynı anda birçok süreci takvimiyle takip eden biri olmalısın.",
    "We are looking for an HR Specialist who runs hiring, onboarding and employee relations. You protect confidential information, deliver hard news clearly and respectfully, and keep many processes on track with dates.",
  ),
  weights: { integrity: 40, communication: 35, organisation: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Bir kısa bilgi sorusu ve iki video sorusu. En fazla 13 dakika.",
        "One short knowledge question and two video questions. At most 13 minutes.",
      ),
      purpose: "Mülakatta sorulamayacak konuları bilme; gerçek bir gizlilik durumunda sınırı koruma; birden çok süreci aynı anda takvimle yürütme.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Bir satış uzmanı pozisyonu için mülakat hazırlıyorsun. İlanda iş tanımı, çalışma saatleri (hafta içi 09:00-18:00, ayda iki cumartesi) ve şehir içi saha ziyaretleri yazıyor. Aşağıdaki konulardan hangisini adaya mülakatta sormak ayrımcılık riski taşıdığı için uygun değildir?",
            "You are preparing an interview for a sales specialist role. The ad states the duties, the working hours (weekdays 09:00-18:00 and two Saturdays a month) and in-city field visits. Which of the following topics is not appropriate to raise with the candidate in the interview because it carries a discrimination risk?",
          ),
          options: [
            t("Adayın maaş beklentisini sormak", "Asking about the candidate's salary expectation"),
            t("Adayın önceki işinden ayrılma nedenini sormak", "Asking about the candidate's reason for leaving the last job"),
            t("Adayın medeni durumunu sormak", "Asking about the candidate's marital status"),
            t("Adayın ayda iki cumartesi çalışıp çalışamayacağını sormak", "Asking whether the candidate can work two Saturdays a month"),
          ],
          correct: 2,
          internal:
            "Doğru cevap: medeni durum. İşle ilgisi olmayan ve ayrımcılık riski taşıyan kişisel bir konudur; aile durumu, yaş, inanç, sağlık, köken ve siyasi tercih de aynı gruptadır. Çeldiriciler: maaş beklentisi (yasal ve olağan bir soru, bazı adaylar hassas diye yasak sanıyor), ayrılma nedeni (işle ilgili, sorulabilir), ayda iki cumartesi (ilanda yazan iş koşulu; herkese aynı şekilde sorulduğu sürece uygun, aile durumunu sormanın yerine geçen doğru soru budur).",
        }),
        video({
          prompt: t(
            "Gizli bir bilgiyle ya da gizli tutulması gereken bir konuyla karşılaştığın bir durumu anlat (iş, okul ya da gönüllü bir işte): konu neydi, biri senden bu bilgiyi istedi ya da paylaşmanı bekledi mi, tam olarak ne söyledin ve ne yaptın, sonuç ne oldu?",
            "Tell us about a time you handled confidential information or a matter that had to stay confidential (at work, school or volunteering): what was it, did someone ask you for the information or expect you to share it, what exactly did you say and do, and what was the result?",
          ),
          competencies: ["integrity", "communication"],
          expected: [
            "Bilginin neden gizli olduğunu ve kimin bilmeye yetkili olduğunu somut söylüyor",
            "Bilgiyi isteyen kişiye ne dediğini aktarıyor: nazikçe reddediyor ve nedenini ya da doğru kanalı söylüyor",
            "Bilgiyi nasıl koruduğunu anlatıyor (erişimi sınırlama, kilitli dosya, yalnızca gerekenle paylaşma)",
            "Sonucu ve gerekiyorsa olayı kime bildirdiğini ya da hangi kuralı önerdiğini söylüyor",
          ],
          redFlags: ["Gizli bilgiyi 'zararsız' diye paylaştığını rahatça anlatıyor", "İsimler ya da ayrıntılarla gizli bilgiyi bu cevapta da açık ediyor", "Somut bir olay yerine genel laflar ediyor"],
          examples: {
            1: "Bir arkadaşım yeni gelen müdürün maaşını sordu, zaten herkes duyacaktı diye kabaca söyledim. Gizlilik önemli tabii ama bazen abartılıyor.",
            3: "Bordro hazırlarken bir yönetici, ekibindeki birinin maaşını sordu. Bu bilgiyi yalnızca İK müdürünün onayıyla paylaşabileceğimi söyledim ve onu İK müdürüne yönlendirdim. Dosyayı da yalnızca bordro ekibinin erişebildiği klasörde tuttum.",
            5: "İşten çıkarma planlanan bir çalışanla ilgili belgeleri hazırlıyordum. Ekip arkadaşı koridorda 'X gidiyor mu?' diye sordu. 'Kişisel süreçler hakkında bilgi veremem, merak ettiğin bir şey varsa yöneticinle konuşabilirsin' dedim. Belgeleri paylaşılan klasörden çıkarıp erişimi iki kişiye indirdim, soruyu İK müdürüme bildirdim. Sonra hassas dosyalar için ayrı bir klasör ve erişim listesi kuralı önerdim, kabul edildi.",
          },
        }),
        video({
          prompt: t(
            "Aynı anda birden çok işe alım, işe başlama ya da benzer süreci yürüttüğün bir dönemi anlat (iş, okul ya da gönüllü bir işte): kaç süreç vardı, hangi tarihler sıkıştı, işleri nasıl sıraladın ve takip ettin, neyi kaçırdın ya da son anda kurtardın, sonra neyi değiştirdin?",
            "Tell us about a period when you ran several hiring, onboarding or similar processes at the same time (at work, school or volunteering): how many were there, which dates were tight, how did you order and track the work, what did you miss or save at the last minute, and what did you change afterwards?",
          ),
          competencies: ["organisation"],
          expected: [
            "Süreç sayısını ve sıkışan tarihleri somut söylüyor",
            "Önceliği bir gerekçeyle (başlama tarihi, yasal süre, yönetici talebi) belirlediğini anlatıyor",
            "Takip için kullandığı aracı ya da yöntemi söylüyor (tablo, kontrol listesi, hatırlatma) ve kime ne zaman bilgi verdiğini anlatıyor",
            "Kaçırdığı ya da son anda yakaladığı bir işi sahipleniyor ve sonradan değiştirdiği bir şeyi söylüyor",
          ],
          redFlags: ["Hiçbir şeyin aksamadığını, her şeyi aklında tuttuğunu söylüyor", "Takip yöntemi ya da tarih vermiyor"],
          examples: {
            1: "Çok yoğundu ama hepsini hallettim, ben her şeyi aklımda tutarım.",
            3: "Bir ayda altı işe alım vardı, iki kişi aynı pazartesi başlıyordu. Bir tabloda her adayın aşamasını tuttum ve başlama tarihi yakın olanları öne aldım. Bir kişinin bilgisayarı yetişmedi, BT ile konuşup ilk gün yedek cihaz verdik.",
            5: "Mart'ta dört açık pozisyon ve beş işe başlama vardı. Hepsini başlama tarihine göre bir tabloda sıraladım; her işe başlama için 10 gün önceden sözleşme, 5 gün önce SGK girişi ve cihaz, 1 gün önce hoş geldin e-postası adımlarını koydum. Bir adayın SGK girişini son gün fark ettim ve yetiştirdim. Sonra tabloya otomatik hatırlatma ekledim ve yöneticilere her pazartesi kısa bir durum e-postası göndermeye başladım.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki yazılı görev: bir çalışan şikayetinde ilk adımlar ve finalist bir adaya ret e-postası. En fazla 20 dakika.",
        "Two written tasks like the real job: first steps on an employee complaint and a rejection e-mail to a finalist. At most 20 minutes.",
      ),
      purpose: "Hassas bir şikayette gizliliği doğru sınırla koruma, politikaya göre ilerleme ve şikayetçiyi koruma; kötü haberi açık, saygılı ve gizliliğe uygun yazma.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Satış ekibinden Elif sana şu e-postayı yazdı:\n\n\"Ekip liderim Murat son iki aydır toplantılarda beni herkesin önünde bağırarak eleştiriyor. İki kez 'senin gibilerle bu iş olmaz' dedi. Cumartesi nöbetlerinin neredeyse hepsini bana veriyor. Bir toplantının ses kaydı bende var. Murat öğrenirse durumum daha da kötüleşir diye korkuyorum. Lütfen kimseye söylemeyin, sadece bilin.\"\n\nŞirket politikası: zorbalık ve taciz şikayetleri İK ve hukuk biriminden oluşan bir kurul tarafından incelenir; şikayetçiye misilleme yasaktır; bilgi yalnızca incelemeyi yürütenlerle paylaşılır.\n\nAtacağın ilk üç adımı sırayla yaz. Her adımda kime ne söyleyeceğini ve neden bu sırayı seçtiğini belirt.",
            "Elif from the sales team sent you this e-mail:\n\n\"For the last two months my team lead Murat has been shouting at me and criticising me in front of everyone in meetings. Twice he said 'this job won't work with people like you'. He gives almost all the Saturday shifts to me. I have an audio recording of one meeting. I am afraid things will get worse if Murat finds out. Please don't tell anyone, just be aware.\"\n\nCompany policy: bullying and harassment complaints are reviewed by a panel of HR and the legal team; retaliation against the complainant is forbidden; information is shared only with those running the review.\n\nWrite the first three steps you take, in order. For each step, say whom you tell what and why you chose this order.",
          ),
          competencies: ["integrity", "organisation"],
          expected: [
            "Elif'e mutlak gizlilik sözü vermiyor; politikaya göre bilginin yalnızca incelemeyi yürütenlerle paylaşılacağını dürüstçe açıklıyor ve misilleme yasağını söylüyor",
            "Kısa sürede Elif'le birebir görüşüp olayları tarih, tanık ve kanıtla (ses kaydı, nöbet listesi) kayda geçiriyor",
            "Politikadaki kurula bildiriyor ve Murat'la incelemeden önce tek başına konuşmuyor",
            "İnceleme sürerken Elif'i dezavantajlı duruma düşürmeyen bir geçici önlem öneriyor (cumartesi nöbetlerini başka bir yöneticinin planlaması gibi) ve Elif'e sürecin adımlarını ve zamanını söylüyor",
          ],
          redFlags: ["'Kimseye söylemem' diye söz verip konuyu bekletiyor ya da tamamen gizli tutuyor", "Murat'ı hemen arayıp yüzleştiriyor ya da Elif'in adını veriyor", "Şikayeti 'yönetim tarzı' diye küçümseyip Elif'e kendi çözmesini öneriyor"],
          examples: {
            1: "Elif istemediği için kimseye söylemem, durumu izlerim. Belki de Murat'la iyi bir dille konuşursa düzelir, ona bunu öneririm.",
            3: "1) Elif'le aynı gün görüşür, olayları tarihleriyle not alırım. 2) Konuyu politikadaki kurula bildiririm, çünkü bu bir zorbalık şikayeti. 3) Murat'la kurulun kararına göre görüşülür. Elif'e misillemenin yasak olduğunu söylerim.",
            5: "1) Bugün Elif'e yazar, yarın sabah birebir görüşürüz. Ona dürüstçe, bilgiyi yalnızca inceleme kuruluyla paylaşacağımı, kimseye söylememe sözü veremeyeceğimi, misillemenin yasak olduğunu söylerim. Olayları tarih ve tanıkla yazar, ses kaydını ve nöbet listesini alırım. 2) Aynı gün kurula bildiririm; Murat'la tek başıma konuşmam. 3) Kurulla birlikte geçici önlem olarak cumartesi nöbetlerini başka bir yöneticiye planlatırım ve Elif'e sürecin adımlarını ve ne zaman döneceğimi yazarım.",
          },
          internal:
            "Referans: (1) Mutlak gizlilik sözü verilemez; doğru sınır politikadaki 'bilmesi gereken' kişilerle paylaşımdır ve bu Elif'e açıkça söylenir. (2) Önce Elif'le birebir görüşme ve kayıt: tarihler, sözler, tanıklar, ses kaydı, nöbet dağılımı. (3) Kurula bildirim; Murat'la incelemeden önce tek başına konuşmak kanıtı ve Elif'i riske atar. (4) Misilleme riskine karşı Elif'in aleyhine olmayan geçici önlem (nöbet planlaması, raporlama hattı). 'senin gibilerle' ifadesi ayrımcılık boyutu olabileceği için ciddiye alınmalı. Üç adımda 1, 2 ve 3 ya da 4'ün olması güçlü cevaptır.",
        }),
        longText({
          prompt: t(
            "Muhasebe Uzmanı pozisyonu için finale kalan Deniz Kaya'ya ret e-postası yaz.\n\nBildiklerin: Deniz iki mülakata girdi ve bir vaka çalışması yaptı. Vaka çalışması güçlüydü; mülakatlarda iletişimi çok iyi bulundu. Pozisyon için ay sonu kapanışını SAP'de tek başına yürütmüş başka bir aday seçildi; Deniz'in SAP deneyimi yok. Deniz son mülakatta geri bildirim istedi. Kurallar: diğer adaylar hakkında bilgi verilmez; aday onay verirse bilgileri 12 ay boyunca aday havuzunda tutulabilir. Ekip altı ay içinde ikinci bir muhasebe pozisyonu açmayı düşünüyor ama karar kesin değil.",
            "Write a rejection e-mail to Deniz Kaya, a finalist for the Accountant role.\n\nWhat you know: Deniz had two interviews and did a case study. The case study was strong, and the interviewers found the communication very good. Another candidate who had run the month-end close in SAP alone was chosen; Deniz has no SAP experience. In the last interview Deniz asked for feedback. Rules: no information is given about other candidates; if the candidate consents, their details may be kept in the talent pool for 12 months. The team is thinking about opening a second accounting role within six months, but the decision is not final.",
          ),
          competencies: ["communication", "integrity"],
          expected: [
            "Kararı ilk paragrafta açık ve saygılı söylüyor, adayın emeğine teşekkür ediyor",
            "İstenen geri bildirimi işe dayalı ve somut veriyor: güçlü yanlar (vaka çalışması, iletişim) ve belirleyici fark (ay sonu kapanışında SAP deneyimi)",
            "Diğer aday hakkında bilgi vermiyor; olası ikinci pozisyon için kesin söz vermiyor",
            "Aday havuzu için açık onay istiyor ve 12 aylık süreyi söylüyor",
          ],
          redFlags: ["Seçilen adayın adını ya da ayrıntılarını paylaşıyor", "İkinci pozisyon için kesin ya da ima eden bir söz veriyor", "Kalıp ve belirsiz bir metinle geri bildirim talebini yok sayıyor"],
          examples: {
            1: "Sayın Deniz Kaya, başvurunuz için teşekkür ederiz. Maalesef olumsuz sonuçlandı. Size başarılar dileriz.",
            3: "Merhaba Deniz, sürecimize ayırdığın zaman için teşekkür ederiz. Bu pozisyon için başka bir adayla ilerleme kararı aldık. Vaka çalışman güçlüydü ve iletişimin çok beğenildi; karar, ay sonu kapanışında SAP deneyimine verilen ağırlıktan kaynaklandı. Uygun olursa bilgilerini aday havuzumuzda tutmak isteriz.",
            5: "Merhaba Deniz, iki mülakat ve vaka çalışması boyunca ayırdığın zaman için teşekkür ederiz. Bu pozisyon için başka bir adayla ilerlemeye karar verdik. İstediğin geri bildirim: vaka çalışman güçlüydü, mülakatlarda iletişimin çok beğenildi. Belirleyici olan, ay sonu kapanışını SAP'de yürütme deneyimiydi. Onay verirsen bilgilerini 12 ay boyunca aday havuzumuzda tutar, uygun bir pozisyon açılırsa sana yazarız. Onay için bu e-postaya 'evet' demen yeterli. İyi dileklerle, İK Ekibi",
          },
        }),
      ],
    }),
  ],
};
