import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const studentServices: HiringTemplate = {
  key: "student-services",
  group: "LANGUAGE_SCHOOL",
  name: t("Öğrenci İşleri ve Kayıt Sorumlusu", "Student Services and Registration Officer"),
  summary: t(
    "Yanlış kaydı düzeltme, eksik belge kontrolü, ödeme listesiyle sınıf listesini karşılaştırma ve devamsızlık e-postası.",
    "Fixing a wrong registration, a missing-document check, matching a payment list to a class list and an absence e-mail.",
  ),
  jobAd: t(
    "Dil okulumuzda kayıt, belge, ödeme takibi ve devamsızlık süreçlerini yürütecek bir Öğrenci İşleri ve Kayıt Sorumlusu arıyoruz. Listeleri satır satır kontrol etmeden rahat etmeyen, yoğun kayıt döneminde işleri sıraya koyan ve öğrencilere kuralları net ama kibar bir dille anlatan biri olmalısın.",
    "We are looking for a Student Services and Registration Officer who runs registration, documents, payment tracking and attendance at our language school. You are not at ease until a list is checked line by line, you put work in order during the busy enrolment season and you explain rules to learners clearly and kindly.",
  ),
  weights: { organisation: 40, accuracy: 35, customer: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Kısa bir senaryo sorusu ve iki video sorusu. En fazla 13 dakika.",
        "One short scenario question and two video questions. At most 13 minutes.",
      ),
      purpose: "Kayıt dosyasında eksik belgeyi kurala göre bulma; bir kayıt hatasını düzeltme ve kişiye haber verme; yoğun günde işleri sıraya koyma.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Okulun kayıt kuralı: Bir kayıt dosyası şu dört belge tamamsa kapanır:\n1) Öğrencinin imzaladığı kayıt formu\n2) Fotoğraflı kimliğin fotokopisi\n3) Ödeme makbuzu ya da imzalı taksit sözleşmesi\n4) Seviye testi sonucu ya da önceki seviyeyi gösteren bir sertifika\n\nÖnündeki dosyada şunlar var: doldurulmuş ama imza alanı boş bir kayıt formu, kimlik fotokopisi, öğrencinin imzaladığı taksit sözleşmesi ve Goethe-Zertifikat A2 belgesi. Seviye testi sonucu yok.\n\nDosyayı kapatmak için ne eksik?",
            "The school's registration rule: a registration file is closed when these four documents are complete:\n1) The registration form signed by the learner\n2) A photocopy of a photo ID\n3) A payment receipt or a signed instalment agreement\n4) A level-test result or a certificate showing the previous level\n\nThe file in front of you contains: a completed registration form whose signature field is empty, a copy of the ID, an instalment agreement signed by the learner and a Goethe-Zertifikat A2 certificate. There is no level-test result.\n\nWhat is missing before the file can be closed?",
          ),
          options: [
            t("Hiçbir şey, dört belge de dosyada var", "Nothing, all four documents are in the file"),
            t("Seviye testi sonucu, dosyada test sonucu yok", "The level-test result, the file has no test result"),
            t("Ödeme makbuzu, taksit sözleşmesi tek başına yetmez", "The payment receipt, an instalment agreement alone is not enough"),
            t("Öğrencinin kayıt formundaki imzası, imza alanı boş", "The learner's signature on the registration form, the field is empty"),
          ],
          correct: 3,
          internal:
            "Doğru cevap: kayıt formundaki imza. Seviye testi yerine A2 sertifikası kuralın 4. maddesini karşılıyor; imzalı taksit sözleşmesi 3. maddeyi karşılıyor. Çeldiriciler: hiçbir şey eksik değil (formun var olmasını yeterli saymak); seviye testi (\"ya da\" koşulunu kaçırmak); ödeme makbuzu (taksit seçeneğini kaçırmak).",
        }),
        video({
          prompt: t(
            "Bir kayıtta, listede ya da formda yanlışlık bulduğun ve bunun bir kişiyi etkilediği bir durumu anlat (iş, okul ya da gönüllü bir işte; hata senin ya da başkasının olabilir): yanlışlığı nasıl fark ettin, kaydı nasıl düzelttin, etkilenen kişiye ne söyledin ve tekrarlanmaması için ne yaptın?",
            "Tell us about a time you found a mistake in a record, list or form that affected a person (at work, school or volunteering; the mistake may have been yours or someone else's): how did you notice it, how did you correct the record, what did you tell the person affected, and what did you do so it would not happen again?",
          ),
          competencies: ["organisation", "customer"],
          expected: [
            "Yanlışlığı somut anlatıyor (hangi kayıt, ne yanlıştı, kimi nasıl etkiledi)",
            "Düzeltmeyi adımlara bölüyor: kaynağı kontrol etme, kaydı düzeltme, bağlı kayıtları (ödeme, sınıf listesi) güncelleme",
            "Etkilenen kişiye kendisi haber verdiğini, hatayı sahiplendiğini ve ne zaman çözüleceğini söylediğini anlatıyor",
            "Tekrarı önleyen bir kontrol adımı söylüyor (ikinci kontrol, form alanı, kontrol listesi)",
          ],
          redFlags: ["Kaydı sessizce düzeltip kişiye haber vermediğini anlatıyor", "Hatayı başkasına yükleyip kendi adımını söylemiyor"],
          examples: {
            1: "Böyle hatalar herkesin başına gelir, sistemde düzeltip geçtim. Öğrenciye söylemeye gerek görmedim.",
            3: "Bir öğrenci yanlış kura kaydedilmişti, ilk derste fark ettik. Kaydı doğru kura taşıdım, öğrenciyi arayıp özür diledim ve doğru sınıfı söyledim.",
            5: "Bir öğrenci sabah kuruna yazılmıştı ama formda akşamı işaretlemişti; ilk ders günü bana geldi. Formu açıp hatanın bizde olduğunu gördüm, 'hata bizde, özür dilerim' dedim. Kaydı akşam grubuna taşıdım, ödeme kaydındaki grup kodunu ve iki öğretmenin listesini de güncelledim, öğrenciye aynı gün yazılı onay gönderdim. Sonra kayıt girişinde formdaki grup kodunu ikinci bir kişinin okumasını kural yaptık; o dönem benzer hata tekrar etmedi.",
          },
        }),
        video({
          prompt: t(
            "Aynı anda çok sayıda isteğin geldiği yoğun bir günü anlat (iş, okul ya da gönüllü bir işte): hangi istekler vardı, hangisini neden önce yaptın, hangisini ertelediğinde kişiye ne söyledin ve hiçbir şeyin unutulmaması için neyi nasıl takip ettin?",
            "Tell us about a busy day when many requests came in at once (at work, school or volunteering): what were the requests, which did you do first and why, what did you tell the people whose requests you postponed, and how did you keep track so nothing was forgotten?",
          ),
          competencies: ["organisation", "customer"],
          expected: [
            "İstekleri somut sayıyor ve önceliği bir gerekçeyle belirliyor (son tarih, etki, kaç kişiyi ilgilendirdiği)",
            "Ertelediği kişilere ne zaman döneceğini söylediğini anlatıyor",
            "Takip için somut bir araç ya da yöntem söylüyor (liste, tablo, bilet sistemi) ve gün sonunda kapattığını anlatıyor",
          ],
          redFlags: ["Önceliği gelen sıraya ya da kimin daha çok ısrar ettiğine göre belirliyor", "Hiçbir takip yöntemi söylemiyor ya da unuttuğu bir işi önemsemiyor"],
          examples: {
            1: "Yoğun günlerde kim önce gelirse onunla ilgilenirim, gerisi bekler. Aklımda tutarım.",
            3: "Kayıt haftasında hem telefonlar hem kapıda bekleyenler vardı. Önce o gün başlayacak kursun kayıtlarını bitirdim, telefonları bir listeye yazıp öğleden sonra geri aradım.",
            5: "Kayıt haftasının pazartesisi kapıda 6 kişi, 14 cevapsız e-posta ve öğretmenden 18:00 dersi için sınıf listesi isteği vardı. Önce sınıf listesini çıkardım, çünkü 12 öğrenciyi ve dersi etkiliyordu. Kapıdakilere tahmini bekleme süresini söyleyip belgelerini önceden kontrol ettim. E-postalara 'yarın 12:00'ye kadar dönüyorum' diye kısa cevap yazdım ve hepsini bir tabloya aldım. Gün sonunda tabloyu kapattım; ertesi kayıt dönemi için de e-postalara hazır cevap şablonları hazırladım.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki yazılı görev: bir ödeme listesini sınıf listesiyle karşılaştırmak ve devamsızlığı fazla olan bir öğrenciye resmi bir e-posta yazmak. En fazla 20 dakika.",
        "Two written tasks like the real job: comparing a payment list with a class list and writing a formal e-mail to a learner with too many absences. At most 20 minutes.",
      ),
      purpose: "Ödeme ve sınıf listesindeki tutarsızlıkları bulma ve her biri için adım belirleme; devamsızlık kuralını doğru hesaplayıp öğrenciye net ve saygılı anlatma.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "B1.1 akşam grubunun (pazartesi ve çarşamba 18:30) kur ücreti 9.000 TL. Öğrenci ya tam ödeme yapar (9.000 TL) ya da 3.000 TL'lik üç taksitle öder; tam ödeme ya da ilk taksit kayıtta alınır. Kur 20 Ekim'de başlıyor; bugün 17 Ekim.\n\nSınıf listesi (öğretmene gidecek):\n1. Ahmet Yıldız\n2. Burcu Aydın\n3. Can Öztürk\n4. Deniz Kaya\n5. Ece Polat\n6. Furkan Çelik\n7. Gizem Arslan\n8. Hakan Doğan\n9. İrem Koç\n10. Kerem Şahin\n\nÖdeme listesi (muhasebeden, grup: B1.1 akşam):\n- Hakan Doğan: 9.000 TL, tam ödeme\n- Burcu Aydın: 3.000 TL, taksit 1/3\n- Kerem Şahin: 6.000 TL, tam ödeme\n- Ahmet Yıldız: 9.000 TL, tam ödeme\n- Leyla Tunç: 9.000 TL, tam ödeme\n- Gizem Arslan: 3.000 TL, taksit 1/3\n- Can Öztürk: 9.000 TL, tam ödeme\n- Ece Polat: 9.000 TL, tam ödeme\n- Deniz Kaya: 3.000 TL, taksit 1/3\n- Furkan Çelik: 3.000 TL, taksit 1/3\n\nİki listeyi karşılaştır. Bulduğun her tutarsızlığı yaz, neden tutarsızlık olduğunu açıkla ve kur başlamadan önce her biri için ne yapacağını (kimi arayacağını, hangi kaydı neye göre düzelteceğini) belirt.",
            "The B1.1 evening group (Monday and Wednesday 18:30) costs 9,000 TL. A learner either pays in full (9,000 TL) or in three instalments of 3,000 TL; the full payment or the first instalment is taken at registration. The course starts on 20 October; today is 17 October.\n\nClass list (goes to the teacher):\n1. Ahmet Yıldız\n2. Burcu Aydın\n3. Can Öztürk\n4. Deniz Kaya\n5. Ece Polat\n6. Furkan Çelik\n7. Gizem Arslan\n8. Hakan Doğan\n9. İrem Koç\n10. Kerem Şahin\n\nPayment list (from accounts, group: B1.1 evening):\n- Hakan Doğan: 9,000 TL, full payment\n- Burcu Aydın: 3,000 TL, instalment 1/3\n- Kerem Şahin: 6,000 TL, full payment\n- Ahmet Yıldız: 9,000 TL, full payment\n- Leyla Tunç: 9,000 TL, full payment\n- Gizem Arslan: 3,000 TL, instalment 1/3\n- Can Öztürk: 9,000 TL, full payment\n- Ece Polat: 9,000 TL, full payment\n- Deniz Kaya: 3,000 TL, instalment 1/3\n- Furkan Çelik: 3,000 TL, instalment 1/3\n\nCompare the two lists. Write down every inconsistency you find, explain why it is one, and say what you will do about each before the course starts (whom you contact, which record you correct and on what basis).",
          ),
          competencies: ["accuracy", "organisation"],
          expected: [
            "İrem Koç'un sınıf listesinde olup ödeme listesinde olmadığını buluyor ve ödemesinin ya da makbuzunun kontrol edilmesini öneriyor",
            "Leyla Tunç'un ödeme yapıp sınıf listesinde olmadığını buluyor ve hangi gruba kayıtlı olduğunu kontrol ediyor",
            "Kerem Şahin'in 6.000 TL ödemesinin \"tam ödeme\" olarak işaretlendiğini ama tam ücretin 9.000 TL olduğunu fark ediyor",
            "Her tutarsızlık için kaynağı (makbuz, kayıt formu) kontrol edip kaydı ona göre düzelten ve kurdan önce bitecek bir sıra veriyor; listelerin farklı sıralanmasını hata saymıyor",
          ],
          redFlags: ["Kontrol etmeden bir listeyi doğru sayıp diğerini ona göre değiştiriyor", "Tutarsızlıklardan birini ya da hiçbirini bulamıyor", "Ödemesi görünmeyen öğrenciyi doğrulamadan dersten çıkarmayı öneriyor"],
          examples: {
            1: "İki listede de 10 kişi var, sayılar tutuyor. Sorun görmüyorum.",
            3: "İki tutarsızlık buldum. 1) Kerem Şahin 6.000 TL ödemiş ama \"tam ödeme\" yazıyor, ücret 9.000 TL. Makbuzuna bakarım; iki taksit ödendiyse kaydı 2/3 olarak düzelttiririm, değilse Kerem'i arayıp eksik 3.000 TL'yi konuşurum. 2) İrem Koç sınıf listesinde ama ödeme listesinde yok. Kayıt formuna ve makbuza bakıp muhasebeye sorarım; ödeme yoksa İrem'i arayıp ilk taksiti kurdan önce alırım.",
            5: "Üç tutarsızlık var. 1) İrem Koç sınıf listesinde ama ödeme listesinde yok: kayıt formunu ve makbuzu kontrol ederim, ödeme yoksa İrem'i bugün arayıp ilk taksiti kurdan önce alırım. 2) Leyla Tunç 9.000 TL ödemiş ama sınıf listesinde yok: kayıt formuna bakarım, başka gruba mı yazıldı yoksa listeye mi eklenmeli, ona göre muhasebeyle ya da öğretmenle düzeltirim. 3) Kerem Şahin 6.000 TL ödemiş ama tam ödeme yazıyor: tam ücret 9.000 TL. Makbuza bakarım; iki taksit ödendiyse kaydı 2/3 olarak düzelttiririm. Listelerin sırası farklı ama bu hata değil. 19 Ekim'de iki listeyi yeniden karşılaştırırım.",
          },
          internal:
            "Yerleştirilmiş tutarsızlıklar (3):\n1) Belirgin: İrem Koç sınıf listesinde, ödeme listesinde yok.\n2) Belirgin: Leyla Tunç ödeme listesinde (9.000 TL, B1.1 akşam), sınıf listesinde yok. Bu her iki listede de 10 isim olduğu için sayıya bakan biri kaçırır.\n3) İnce: Kerem Şahin 6.000 TL ödemiş ama \"tam ödeme\" işaretli; tam ücret 9.000 TL. Ya 3.000 TL eksik ya da kayıt \"taksit 2/3\" olmalı; makbuzla doğrulanır.\nHata olmayan: listelerin sırası farklı. Kerem'i ödeme kaynağı doğrulanmadan iki yoldan biriyle açıklayan cevap, kontrol adımı söylüyorsa cezalandırılmaz. Doğruluk puanı: 3/3 ve kontrol yöntemi = 5; ince hata dahil 2/3 = 3; ince hata yok ya da 1/3 = 1.",
        }),
        longText({
          prompt: t(
            "Okulun devam kuralı: Kur 24 dersten oluşur. Kur sertifikası için en az 20 derse katılmak gerekir.\n\nB1.2 sabah grubundaki Mert Aksoy'un durumu: şu ana kadar 16 ders yapıldı, Mert bunların 4'üne gelmedi. Son iki dersi üst üste kaçırdı ve haber vermedi. 8 ders kaldı.\n\nOkulun sunabildikleri: kaçırılan derslerin konu özeti ve ödevleri; öğretmenle haftada bir kez 15 dakikalık soru saati. Kuru tekrar etmek isteyen öğrenciye bir sonraki dönemde %50 indirim.\n\nMert'e gönderilecek resmi e-postayı yaz (konu satırı dahil). Mert'in devam durumunu, bunun sertifikaya etkisini ve seçeneklerini net anlat.",
            "The school's attendance rule: the course has 24 lessons. A course certificate requires attending at least 20 of them.\n\nThe situation of Mert Aksoy in the B1.2 morning group: 16 lessons have taken place so far and Mert missed 4 of them. He missed the last two in a row without letting anyone know. 8 lessons remain.\n\nWhat the school can offer: a topic summary and the homework of the missed lessons; a 15-minute question slot with the teacher once a week. A learner who wants to repeat the course gets 50% off in the next term.\n\nWrite the formal e-mail to Mert (including the subject line). Explain clearly his attendance, what it means for the certificate and his options.",
          ),
          competencies: ["customer", "organisation"],
          expected: [
            "Durumu doğru rakamlarla yazıyor: 4 devamsızlık, en fazla 4 devamsızlık hakkı var, bundan sonraki her devamsızlık sertifikayı kaybettirir",
            "Resmi ama sıcak bir dil kullanıyor; suçlamadan haber vermemesini nazikçe hatırlatıyor ve nedenini açıklamaya zorlamıyor",
            "Okulun sunduğu destekleri (konu özeti, soru saati) somut olarak sunuyor ve kuru tekrar seçeneğini yalnızca bilgi olarak doğru veriyor",
            "Net bir sonraki adım ve tarih istiyor (bir sonraki derse katılım, cevap ya da görüşme günü) ve kime ulaşacağını yazıyor",
          ],
          redFlags: ["Devamsızlık hesabını yanlış yapıyor (örneğin sertifikanın zaten kaybedildiğini ya da daha çok hakkı olduğunu yazıyor)", "Tehditkar ya da suçlayıcı bir dil kullanıyor", "Devamsızlığın özel nedenini açıklamasını şart koşuyor"],
          examples: {
            1: "Konu: Devamsızlık\nMert Bey, çok fazla derse gelmediniz. Böyle devam ederseniz kurdan atılacaksınız. Bilginize.",
            3: "Konu: Devam durumunuz hakkında\nSayın Mert Aksoy, kurumuzda bugüne kadar yapılan 16 dersin 4'üne katılamadınız. Sertifika için 24 dersin en az 20'sine katılmanız gerekiyor. Kaçırdığınız derslerin özetini ve ödevlerini size gönderebiliriz. Sorularınız için bize ulaşabilirsiniz.",
            5: "Konu: B1.2 devam durumunuz ve sertifika\nSayın Mert Aksoy,\nSon iki derste sizi göremedik, umarız her şey yolundadır. Sertifika için 24 dersin en az 20'sine katılım gerekiyor; 16 dersin 4'üne katılamadınız, yani devamsızlık hakkınızın tamamını kullandınız. Kalan 8 dersin hepsine katılırsanız sertifikayı alırsınız. Kaçırdığınız derslerin özeti ve ödevleri ekte; öğretmeninizin haftalık 15 dakikalık soru saatini de kullanabilirsiniz. Kuru tekrar ederseniz sonraki dönemde %50 indirim var. Pazartesi dersine katılımınızı cuma 17:00'ye kadar bildirir misiniz?\nSaygılarımla,\nÖğrenci İşleri",
          },
          internal:
            "Referans: 24 dersin en az 20'si gerekiyor, yani en fazla 4 devamsızlık. Mert 4 devamsızlıkla hakkının tamamını kullandı; kalan 8 dersin hepsine gelirse 20 derse ulaşır ve sertifikayı alır. Bir devamsızlık daha sertifikayı kaybettirir. \"Sertifikayı zaten kaybetti\" ya da \"daha 2 hakkı var\" yanlış. Kuru tekrar seçeneği bilgi olarak verilmeli, ilk öneri olarak dayatılmamalı.",
        }),
      ],
    }),
  ],
};
