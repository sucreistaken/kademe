import { audio, longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const courseAdvisor: HiringTemplate = {
  key: "course-advisor",
  group: "LANGUAGE_SCHOOL",
  name: t("Kurs Danışmanı (satış ve kayıt)", "Course Advisor (sales and enrolment)"),
  summary: t(
    "Kararsız adayla dürüst satış, seviye testine göre kur seçimi, \"başka okul daha ucuz\" telefonu ve deneme dersine gelmeyen adaya takip mesajı.",
    "Honest selling to a hesitant applicant, placing a level-test result, a \"another school is cheaper\" phone call and a follow-up to a trial-lesson no-show.",
  ),
  jobAd: t(
    "Dil okulumuza gelen adayları dinleyip doğru kursa yönlendirecek, telefonda ve yüz yüze kayıt görüşmelerini yürütecek bir Kurs Danışmanı arıyoruz. Satışı adayın hedefine bağlayan, fiyat itirazında rakamla konuşan ve vermediğin bir sözü asla vermeyen biri olmalısın.",
    "We are looking for a Course Advisor who listens to applicants, guides them to the right course and runs enrolment conversations on the phone and in person. You tie the sale to the applicant's goal, answer a price objection with numbers and never promise what the school cannot deliver.",
  ),
  weights: { commercial: 40, customer: 35, communication: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Bir kısa senaryo sorusu ve iki video sorusu. En fazla 13 dakika.",
        "One short scenario question and two video questions. At most 13 minutes.",
      ),
      purpose: "Seviye testi sonucunu okulun yerleştirme kuralına göre kura bağlama; kararsız bir adayı dürüstçe ikna etme; satış sonrası memnuniyetsizliği yönetme.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Okulun yerleştirme tablosu (yazılı seviye testi, 100 puan üzerinden):\n- 46-60: A2.1\n- 61-75: A2.2\n- 76-90: B1.1\n\nOkulun kuralı: Yazılı puan bant sınırına 5 puan ya da daha yakınsa ve sözlü görüşme bir alt kuru gösteriyorsa, adayın kuru sözlü görüşmenin gösterdiği kur olur. Diğer bütün durumlarda yazılı puanın bandı geçerlidir.\n\nBir aday yazılı testten 62 aldı. Sözlü görüşmeyi yapan öğretmenin notu: \"Konuşmada A2.1 düzeyinde.\" Aday, arkadaşı orada olduğu ve haziranda B1 sınavına girmek istediği için B1.1 akşam grubuna yazılmak istiyor. Adaya hangi kuru önerirsin?",
            "The school's placement table (written level test, out of 100 points):\n- 46-60: A2.1\n- 61-75: A2.2\n- 76-90: B1.1\n\nThe school's rule: if the written score is within 5 points of the band limit and the oral interview points to the level below, the applicant's course is the one the interview points to. In every other case the band of the written score applies.\n\nAn applicant scored 62 on the written test. The note from the teacher who did the oral interview says: \"Speaking at A2.1 level.\" The applicant wants to join the B1.1 evening group because a friend is in it and they want to sit a B1 exam in June. Which course do you recommend?",
          ),
          options: [
            t("B1.1, çünkü adayın hedefi haziranda B1 ve akşam grubu programına uyuyor", "B1.1, because the applicant's goal is B1 in June and the evening group fits their schedule"),
            t("A2.2, çünkü 62 puan yazılı testte A2.2 bandının içinde kalıyor", "A2.2, because a score of 62 falls inside the A2.2 band of the written test"),
            t("A2.1, çünkü puan bant sınırına 5 puandan yakın ve sözlü görüşme alt kuru gösteriyor", "A2.1, because the score is within 5 points of the band limit and the interview points lower"),
            t("A2.2, çünkü sözlü görüşme tek başına yazılı puanın bandını düşüremiyor", "A2.2, because the interview alone cannot lower the band of the written score"),
          ],
          correct: 2,
          internal:
            "Doğru cevap: A2.1. 62, A2.2 bandının alt sınırına (61) 1 puan uzaklıkta, yani 5 puan içinde; sözlü görüşme bir alt kuru (A2.1) gösteriyor; kural gereği sözlü görüşmenin kuru geçerli. Çeldiriciler: B1.1 (adayın isteğine göre satış, en tehlikeli hata: aday kurda zorlanıp bırakır); A2.2 bant (kuralın ikinci koşulunu atlamak); A2.2 sözlü düşüremez (kuralı ters okumak). İyi bir danışman ayrıca adaya B1 hedefine giden yolu (A2.1, A2.2, B1.1) ve süresini dürüstçe anlatır.",
        }),
        video({
          prompt: t(
            "Bir şeyi almak ya da bir şeye kaydolmak konusunda kararsız olan birine yardım ettiğin bir durumu anlat (iş, okul ya da gönüllü bir işte): kafasındaki soru neydi, ona tam olarak ne söyledin, satışın aleyhine olsa da söylediğin bir doğru oldu mu ve sonuç ne oldu?",
            "Tell us about a time you helped someone who was undecided about buying or signing up for something (at work, school or volunteering): what was holding them back, what exactly did you say, did you tell them anything true that worked against the sale, and what was the result?",
          ),
          competencies: ["commercial", "customer"],
          expected: [
            "Kararsızlığın gerçek nedenini sorarak bulduğunu anlatıyor (fiyat, zaman, başarısızlık korkusu, yanlış seviye)",
            "Teklifi kişinin somut hedefine bağlıyor (sınav tarihi, iş, okul) ve bunu sayıyla ya da tarihle anlatıyor",
            "Satış aleyhine de olsa söylediği bir doğruyu aktarıyor (daha uzun süre gerekir, bu kur ona uygun değil)",
            "Görüşmeyi net bir sonraki adımla bitiriyor (deneme dersi, seviye testi, karar tarihi) ve sonucunu söylüyor",
          ],
          redFlags: ["Baskıyla ya da uydurma aciliyetle kayıt aldığını anlatıyor", "Kişinin ne istediğini sormadan ürün özelliklerini saydığını anlatıyor", "Somut bir olay yerine genel laflar ediyor"],
          examples: {
            1: "Kararsız müşteriye kampanyanın bugün bittiğini söylerim, genelde hemen karar verirler. Satış böyle bir şey, biraz baskı gerekir.",
            3: "Bir aday fiyat yüzünden kararsızdı. Ne için Almanca öğrenmek istediğini sordum, iş başvurusu için B1 gerekiyormuş. Kursun kaç saat olduğunu ve taksit seçeneğini anlattım, bir deneme dersine çağırdım, deneme dersinden sonra kaydoldu.",
            5: "Bir aday iki ay içinde B1 almak istiyordu ama seviye testi A2.1 çıktı. Ona açıkça iki ayda B1'in gerçekçi olmadığını, A2.1'den B1 sınavına yaklaşık altı ay gerektiğini söyledim. Asıl derdi iş başvurusunun tarihiydi; işverene A2 belgesi ve kayıt belgesiyle başvurabileceğini birlikte kontrol ettik. Yoğun akşam programını önerdim, deneme dersine çağırdım ve cuma günü arayacağımı söyledim. Kaydoldu ve haziranda B1'i geçti; aynı yolu sonra başka adaylara da anlattım.",
          },
        }),
        video({
          prompt: t(
            "Sattığın ya da önerdiğin bir şeyden sonra memnun kalmayan biriyle ilgilendiğin bir durumu anlat (iş, okul ya da gönüllü bir işte): neden memnun değildi, ona tam olarak ne söyledin, ne yaptın ve sonuç ne oldu?",
            "Tell us about a time you dealt with someone who was unhappy after buying something you sold or recommended (at work, school or volunteering): why were they unhappy, what exactly did you say, what did you do, and what was the result?",
          ),
          competencies: ["customer", "communication"],
          expected: [
            "Kişinin memnuniyetsizliğini kendi cümleleriyle özetleyip doğruladığını anlatıyor",
            "Kendi payını savunmaya geçmeden kabul ediyor (yanlış beklenti, eksik bilgi)",
            "Yetkisi içinde somut bir çözüm ve dönüş zamanı verdiğini söylüyor",
            "Sonradan anlatımında ya da sürecinde neyi değiştirdiğini söylüyor",
          ],
          redFlags: ["Memnuniyetsizliği tamamen müşteriye ya da öğretmene yüklüyor", "Yetkisini aşan bir söz (iade, ücretsiz kur) verdiğini anlatıyor"],
          examples: {
            1: "Kurs ona göre değilmiş demek ki. Kayıtta her şeyi anlattım, sonrası öğretmenin işi.",
            3: "Bir öğrenci kursun çok hızlı ilerlediğini söyledi. Dinledim, öğretmeniyle konuştum ve bir alt kura geçmesini önerdim, kabul etti ve devam etti.",
            5: "Bir öğrenci iki hafta sonra 'bana sınav hazırlığı denmişti, bu genel kurs' dedi. 'Sana sınav kısmını net anlatmamışım, haklısın' dedim. Yöneticimle konuşup aynı fiyatla sınav hazırlık grubuna geçişini ertesi gün ayarladım ve sonucu kendisine yazdım. Sonra kayıt görüşmelerimde kursun ne olduğunu ve ne olmadığını tek cümleyle yazılı da vermeye başladım; benzer şikayet tekrar gelmedi.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki görev: bir veliyle sesli telefon canlandırması ve deneme dersine gelmeyen bir adaya yazılı takip mesajı. En fazla 18 dakika.",
        "Two tasks like the real job: a recorded phone role-play with a parent and a written follow-up to an applicant who missed a trial lesson. At most 18 minutes.",
      ),
      purpose: "Fiyat itirazını rakip kötülemeden ve uydurma indirim vermeden değerle karşılama; gelmeyen adayı baskısız ve net bir adımla geri kazanma.",
      minutes: 18,
      activities: [
        audio({
          prompt: t(
            "Telefon canlandırması. Bir veli arıyor ve lisede okuyan oğlu için A2 kursunu soruyor. Veli şöyle diyor: \"Sizi beğendik ama Merkez Dil Okulu aynı kur için 15.000 TL istiyor, siz 18.000 TL diyorsunuz. Neden sizi seçeyim?\"\n\nBildiklerin:\n- Bizim A2 kursumuz: 10 hafta, toplam 120 ders saati, sınıfta en fazla 10 öğrenci, 18.000 TL. Kurs öncesi ücretsiz seviye testi ve ücretsiz bir deneme dersi var.\n- Merkez Dil Okulu'nun kendi sitesinde yazan: aynı kur 10 hafta, toplam 80 ders saati, sınıfta en fazla 16 öğrenci, 15.000 TL.\n- İndirim yetkin: yalnızca peşin ödemede %5. Başka indirim veremezsin.\n\nVeliye telefonda ne söylersin? Sesli cevap ver; veliyle konuşuyormuş gibi konuş.",
            "Phone role-play. A parent calls and asks about the A2 course for their son, who is at secondary school. The parent says: \"We like you, but Merkez Language School charges 15,000 TL for the same course and you charge 18,000 TL. Why should I choose you?\"\n\nWhat you know:\n- Our A2 course: 10 weeks, 120 lesson hours in total, at most 10 learners per class, 18,000 TL. A free level test before the course and one free trial lesson.\n- Merkez Language School's own website says: the same course is 10 weeks, 80 lesson hours in total, at most 16 learners per class, 15,000 TL.\n- Your discount authority: 5% for payment in full only. You may not give any other discount.\n\nWhat do you say to the parent on the phone? Answer out loud, as if you were talking to the parent.",
          ),
          competencies: ["commercial", "customer"],
          expected: [
            "Önce velinin neye önem verdiğini soruyor (hedef, sınav, program, oğlunun ihtiyacı) ve itirazı kabul ederek başlıyor",
            "Değeri sayıyla anlatıyor: ders saati başına bizde 150 TL, diğer okulda yaklaşık 188 TL; 40 saat daha fazla ders ve en fazla 10 kişilik sınıf",
            "Rakibi kötülemiyor, yalnızca kamuya açık bilgiyle karşılaştırıyor; yalnızca yetkisi içindeki %5 peşin indirimini anıyor",
            "Görüşmeyi net bir adımla bitiriyor: ücretsiz seviye testi ya da deneme dersi için gün ve saat öneriyor",
          ],
          redFlags: ["Yetkisi olmayan bir indirim ya da fiyat eşleme sözü veriyor", "Diğer okulu kötülüyor ya da doğrulanmamış bir iddiada bulunuyor", "Fiyatı savunmak yerine yalnızca \"kalitemiz yüksek\" gibi genel laflar ediyor"],
          examples: {
            1: "Bakın biz çok kaliteliyiz, o okul o kadar iyi değil açıkçası. İsterseniz size de 15.000 TL yapayım, yeter ki kaydolun.",
            3: "Haklısınız, fiyat farkı var. Ama bizim kursumuz 120 saat, onlarınki 80 saat; sınıflarımız da en fazla 10 kişi. Peşin öderseniz %5 indirim de yapabiliyorum. Oğlunuz isterse ücretsiz deneme dersine gelebilir.",
            5: "Fiyata bakmanız çok doğal. Önce sorayım: oğlunuzun hedefi bir sınav mı, okul mu? (...) Anladım. Rakamla bakarsak bizde 120 saat ders var, ders saati 150 TL'ye geliyor; diğer okulun sitesinde 80 saat yazıyor, saati yaklaşık 188 TL. Yani 40 saat daha fazla ders ve en fazla 10 kişilik sınıf, oğlunuz her derste daha çok konuşur. Peşin öderseniz %5 indirimle 17.100 TL oluyor. Karar vermeden önce ücretsiz seviye testi ve deneme dersi için perşembe 17:00 uygun mu?",
          },
          internal:
            "Referans: ders saati başına fiyat bizde 18.000 / 120 = 150 TL, diğer okulda 15.000 / 80 = 187,5 TL; yani saat başına biz daha ucuzuz. Fark: 40 ders saati ve 6 kişi daha küçük sınıf. %5 peşin indirimle 17.100 TL. Güçlü cevap bu hesabı yapar, rakibi kötülemez, %5 dışında indirim ya da fiyat eşleme vermez ve somut bir sonraki adım (seviye testi, deneme dersi, gün ve saat) önerir. Velinin ihtiyacını soran ve itirazı kabul ederek başlayan cevap müşteri odağında yüksek puan alır.",
        }),
        longText({
          prompt: t(
            "Deniz Kaya iki hafta önce telefonla aradı. İşyeri ondan Almanca B1 belgesi istiyor ve önümüzdeki yıl başvurusu var. Seviye testi onu B1.1 kuruna yerleştirdi. Dün (salı) 19:00'daki ücretsiz B1.1 deneme dersine kayıtlıydı ama gelmedi ve haber vermedi. Deniz, okulun kendisine WhatsApp'tan yazmasına izin vermişti.\n\nBildiklerin:\n- Yeni deneme dersi seçenekleri: perşembe 19:00 ya da cumartesi 10:00.\n- Yeni B1.1 akşam kuru 3 Kasım'da başlıyor; erken kayıtta %5 indirim 24 Ekim'de bitiyor.\n- Seviye testinin sonucu üç ay geçerli.\n\nDeniz'e gönderilecek WhatsApp mesajını yaz.",
            "Deniz Kaya phoned two weeks ago. Their employer requires a German B1 certificate and they have an application next year. The level test placed them in the B1.1 course. Yesterday (Tuesday) they were booked for the free B1.1 trial lesson at 19:00 but did not come and did not let us know. Deniz agreed that the school may message them on WhatsApp.\n\nWhat you know:\n- New trial-lesson options: Thursday 19:00 or Saturday 10:00.\n- The new B1.1 evening course starts on 3 November; the 5% early-registration discount ends on 24 October.\n- The level-test result is valid for three months.\n\nWrite the WhatsApp message to Deniz.",
          ),
          competencies: ["commercial", "communication"],
          expected: [
            "Suçlamadan, kısa ve sıcak bir tonla açıyor; gelmemesini sorun etmeden yeni bir fırsat sunuyor",
            "İki somut deneme dersi seçeneğini gün ve saatle veriyor ve cevabı kolaylaştıran tek bir soru soruyor",
            "Teklifi Deniz'in hedefine bağlıyor (işyeri için B1, 3 Kasım başlangıcı) ve %5 indirimin son tarihini uydurma aciliyet katmadan doğru söylüyor",
            "Mesajı istemezse bir daha yazmayacağını belirten nazik bir çıkış yolu bırakıyor",
          ],
          redFlags: ["Gelmediği için suçlayıcı ya da pasif agresif bir dil kullanıyor", "Uydurma bir aciliyet ya da verilemeyecek bir indirim yazıyor", "Somut bir seçenek ya da tarih vermeden genel bir hatırlatma yapıyor"],
          examples: {
            1: "Merhaba, dün deneme dersine gelmediniz. Lütfen bir dahaki sefere haber verin. Kayıt için okulumuzu arayabilirsiniz.",
            3: "Merhaba Deniz, dünkü deneme dersinde seni göremedik, umarım her şey yolundadır. İstersen perşembe 19:00 ya da cumartesi 10:00'daki derse katılabilirsin. Yeni B1.1 kuru 3 Kasım'da başlıyor. Hangisi uygun, yazar mısın?",
            5: "Merhaba Deniz, ben Kademe Dil Okulu'ndan Selin. Dünkü deneme dersine yetişemedin, hiç sorun değil. İşyerin için B1 hedefine giden ilk adımı kaçırmaman için iki yeni seçenek var: perşembe 19:00 ya da cumartesi 10:00. Hangisini ayırayım? Bilgi olarak: B1.1 akşam kuru 3 Kasım'da başlıyor, 24 Ekim'e kadar kayıtta %5 indirim var ve seviye testin üç ay geçerli, yeniden girmen gerekmiyor. Şu an uygun değilse tek kelime yazman yeterli, seni rahatsız etmem.",
          },
          internal:
            "Güçlü mesaj: kısa (WhatsApp), suçlamasız, iki somut seçenek ve tek bir soru, hedefe bağ (B1, işyeri), doğru tarihler (3 Kasım başlangıç, 24 Ekim indirim sonu, test sonucu üç ay geçerli) ve bir çıkış yolu. Uydurma aciliyet (\"son 2 yer\") ya da %5 dışında indirim düşük puan.",
        }),
      ],
    }),
  ],
};
