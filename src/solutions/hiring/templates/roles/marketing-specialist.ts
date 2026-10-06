import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const marketingSpecialist: HiringTemplate = {
  key: "marketing-specialist",
  group: "EXTRA",
  name: t("Pazarlama Uzmanı", "Marketing Specialist"),
  summary: t(
    "Ölçülen bir kampanya, CTR ve CPA okuma, kanal tablosundan bütçe kararı ve yeni kurs için reklam metinleri.",
    "A measured campaign, reading CTR and CPA, a budget decision from a channel table and ad copy for a new course.",
  ),
  jobAd: t(
    "Dijital kampanyalarımızı planlayacak, yürütecek ve sonuçlarını ölçecek bir Pazarlama Uzmanı arıyoruz. Kararını tıklamaya değil kayda ve maliyete bakarak veren, rakamları ekibe sade anlatan ve kısa, doğru, ikna edici metin yazan biri olmalısın.",
    "We are looking for a Marketing Specialist who plans, runs and measures our digital campaigns. You base decisions on enrolments and cost, not clicks, explain numbers plainly to the team and write short, accurate, persuasive copy.",
  ),
  weights: { commercial: 40, problem_solving: 35, communication: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Kısa bir hesap sorusu ve iki video sorusu. En fazla 13 dakika.",
        "One short calculation question and two video questions. At most 13 minutes.",
      ),
      purpose: "Temel kampanya metriklerini doğru hesaplama; sonucu ölçülen gerçek bir kampanya; tutmayan bir kampanyada nedeni bulup değiştirme.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Bir kurs kampanyasının bir haftalık verisi:\n- Gösterim: 40.000\n- Tıklama: 800\n- Kayıt formu dolduran (dönüşüm): 32\n- Harcama: 4.800 TL\n\nCTR tıklamanın gösterime oranıdır. CPA, bir dönüşüm (bir doldurulmuş kayıt formu) başına maliyettir. Bu kampanyanın CTR ve CPA değeri hangisidir?",
            "One week of data from a course campaign:\n- Impressions: 40,000\n- Clicks: 800\n- Sign-up forms completed (conversions): 32\n- Spend: 4,800 TL\n\nCTR is clicks divided by impressions. CPA is the cost per conversion (one completed sign-up form). What are this campaign's CTR and CPA?",
          ),
          options: [
            t("CTR %2, CPA 150 TL", "CTR 2%, CPA 150 TL"),
            t("CTR %2, CPA 6 TL", "CTR 2%, CPA 6 TL"),
            t("CTR %4, CPA 150 TL", "CTR 4%, CPA 150 TL"),
            t("CTR %4, CPA 6 TL", "CTR 4%, CPA 6 TL"),
          ],
          correct: 0,
          internal:
            "Doğru cevap: CTR %2 (800 / 40.000), CPA 150 TL (4.800 / 32). Çeldiriciler: CPA 6 TL (tıklama başı maliyeti, 4.800 / 800, CPA sanmak); CTR %4 (dönüşüm oranını, 32 / 800, CTR sanmak); CTR %4 ve CPA 6 TL (iki karışıklık birden). Seçenekler 2x2 dengeli: her değer iki kez geçiyor, cevap sayarak bulunamıyor.",
        }),
        video({
          prompt: t(
            "Sonucunu ölçtüğün bir kampanyayı ya da tanıtım çalışmasını anlat (iş, okul ya da gönüllü bir işte): hedef neydi, hangi kanalı ve bütçeyi neden seçtin, sonucu hangi sayıyla ölçtün, sonuç ne oldu ve bu sayıya bakarak neye karar verdin?",
            "Tell us about a campaign or promotion whose result you measured (at work, school or volunteering): what was the goal, which channel and budget did you choose and why, which number did you measure it with, what was the result, and what did you decide based on that number?",
          ),
          competencies: ["commercial", "problem_solving"],
          expected: [
            "Hedefi iş sonucuna bağlıyor (kayıt, satış, maliyet) ve somut sayılar veriyor",
            "Kanal ve bütçe seçimini bir gerekçeyle açıklıyor (hedef kitle, geçmiş veri, maliyet)",
            "Beğeni ya da tıklama gibi ara metriklerle kayıt ya da satış gibi sonuç metriğini ayırıyor",
            "Sonuca göre aldığı somut kararı söylüyor (bütçe kaydırma, kanalı kapatma, metni değiştirme)",
          ],
          redFlags: ["Başarıyı yalnızca beğeni, erişim ya da tıklamayla anlatıyor", "Sayı vermiyor ya da sonucu ölçmediğini söylüyor", "Kendi payını ekibin işinden ayırmıyor"],
          examples: {
            1: "Instagram'da bir kampanya yaptık, çok beğeni aldı, herkes çok sevdi. Bence başarılıydı.",
            3: "Okul kulübümüzün etkinliği için Instagram ve e-posta kullandım. Hedef 100 kayıttı, 85 kayıt aldık; kayıtların çoğu e-postadan geldi, bir sonraki etkinlikte e-postaya daha çok zaman ayırdık.",
            5: "Bir dil kursunun yaz dönemi için hedef 60 kayıt ve kayıt başı en fazla 500 TL idi. 20.000 TL'yi Google arama ve Instagram arasında bölüştüm, çünkü geçmiş dönemde arama daha ucuz kayıt getirmişti. İki hafta sonra Instagram'da kayıt başı maliyet 900 TL, aramada 350 TL çıktı. Instagram bütçesinin yarısını aramaya kaydırdım; dönemi 64 kayıt ve ortalama 310 TL ile kapattık.",
          },
        }),
        video({
          prompt: t(
            "Bir kampanyanın ya da içeriğin beklediğin sonucu vermediği bir durumu anlat (iş, okul ya da gönüllü bir işte): bunu hangi sayıdan fark ettin, nedenini nasıl aradın, durumu yöneticine ya da ekibe nasıl anlattın, neyi değiştirdin ve sonuç ne oldu?",
            "Tell us about a time a campaign or piece of content did not deliver the result you expected (at work, school or volunteering): which number told you, how did you look for the cause, how did you explain it to your manager or team, what did you change, and what was the result?",
          ),
          competencies: ["problem_solving", "communication"],
          expected: [
            "Sorunu bir sayıyla fark ettiğini söylüyor ve hangi adımda koptuğunu ayırıyor (gösterim, tıklama, form, kayıt)",
            "Birden çok olası nedeni sınadığını anlatıyor (hedef kitle, metin, açılış sayfası, takip süresi)",
            "Kötü sonucu yöneticine ya da ekibe sayı ve önerilen değişiklikle birlikte, saklamadan anlattığını söylüyor",
            "Değişikliğin sonucunu ölçtüğünü ve öğrendiğini söylüyor",
          ],
          redFlags: ["Başarısızlığı algoritmaya, bütçeye ya da başkasına yükleyip kendi adımını söylemiyor", "Kötü sonucu yöneticiden sakladığını ya da süslediğini anlatıyor"],
          examples: {
            1: "Bir reklamımız tutmadı, sanırım algoritma bizi göstermedi. Sonra o kanalı bıraktık.",
            3: "Bir e-posta kampanyasında açılma iyiydi ama tıklama çok düşüktü. Butonun e-postanın en altında kaldığını gördüm, yukarı taşıdım ve tıklama ikiye katlandı. Durumu yöneticime haftalık raporda anlattım.",
            5: "Yeni bir kurs için reklamlar çok tıklandı ama formların sadece %1'i kayda döndü. Yöneticime sayıları gösterip sorunun reklamda değil sonraki adımda olduğunu söyledim. Açılış sayfasını ve takip süresini inceledim: formlar ortalama üç gün sonra aranıyordu. Satış ekibiyle aynı gün arama kuralı koyduk ve sayfadaki fiyat bilgisini öne aldık. Dört haftada form-kayıt oranı %1'den %4'e çıktı.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki yazılı görev: bir kanal tablosundan iki karar ve yeni bir akşam kursu için üç reklam metni. En fazla 20 dakika.",
        "Two written tasks like the real job: two decisions from a channel table and three ad texts for a new evening course. At most 20 minutes.",
      ),
      purpose: "Kanal verisini kayıt ve maliyet üzerinden okuyup bütçe kararı verme, kısıtı görme; kurala uygun, doğru ve ikna edici reklam metni yazma.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Bir dil kursunun geçen ayki dijital kampanyası (toplam bütçe 30.000 TL, kurs ücreti kişi başı 6.000 TL):\n\nKanal | Harcama | Gösterim | Tıklama | Form | Kayıt\nInstagram | 12.000 TL | 300.000 | 3.000 | 120 | 6\nGoogle arama | 9.000 TL | 45.000 | 1.800 | 90 | 15\nFacebook | 6.000 TL | 200.000 | 1.000 | 60 | 3\nYouTube | 3.000 TL | 150.000 | 300 | 6 | 0\n\nEk bilgiler:\n- Satış ekibi Google formlarını ortalama aynı gün, Instagram ve Facebook formlarını ortalama 3 gün sonra arıyor.\n- Google aramada gösterim payın zaten %90; bütçeyi artırsan da en fazla yaklaşık %10 daha fazla gösterim alabilirsin.\n\nGelecek ay bütçe yine 30.000 TL. Vereceğin iki kararı yaz; her birini tablodaki sayılarla gerekçelendir ve sonucu nasıl ölçeceğini söyle.",
            "Last month's digital campaign for a language school (total budget 30,000 TL, course fee 6,000 TL per person):\n\nChannel | Spend | Impressions | Clicks | Forms | Enrolments\nInstagram | 12,000 TL | 300,000 | 3,000 | 120 | 6\nGoogle search | 9,000 TL | 45,000 | 1,800 | 90 | 15\nFacebook | 6,000 TL | 200,000 | 1,000 | 60 | 3\nYouTube | 3,000 TL | 150,000 | 300 | 6 | 0\n\nMore facts:\n- The sales team calls Google forms on average the same day, and Instagram and Facebook forms on average 3 days later.\n- Your Google search impression share is already 90%; even with more budget you can get at most about 10% more impressions.\n\nNext month's budget is again 30,000 TL. Write two decisions you take; justify each with numbers from the table and say how you will measure the result.",
          ),
          competencies: ["commercial", "problem_solving"],
          expected: [
            "Form başı maliyetin üç kanalda aynı (100 TL) olduğunu ama kayıt başı maliyetin farklı olduğunu görüyor (Google 600 TL, Instagram ve Facebook 2.000 TL) ve kararı kayıt başı maliyete dayandırıyor",
            "YouTube'u (3.000 TL, 0 kayıt) kesiyor ya da küçük bir teste indiriyor ve parayı nereye kaydırdığını söylüyor",
            "Google'a sınırsız bütçe kaydırmanın işe yaramayacağını gösterim payı kısıtından görüyor",
            "Instagram ve Facebook formlarının 3 günde aranmasını form-kayıt oranının (%5 ve %17) farkına olası neden olarak bağlıyor, aynı gün arama kuralı gibi bir değişiklik ve ölçüm öneriyor",
          ],
          redFlags: ["Instagram'ı en çok tıklama ya da form getirdiği için en iyi kanal sayıyor", "Bütçenin tamamını Google'a kaydırıyor", "Kararlarını sayıyla gerekçelendirmiyor"],
          examples: {
            1: "Instagram en çok tıklamayı ve formu getirmiş, bütçeyi Instagram'a kaydırırım. YouTube'da da daha çok video paylaşırız.",
            3: "1) YouTube'u kapatırım: 3.000 TL harcandı, kayıt yok. Bu parayı Google'a veririm, çünkü kayıt başı maliyet Google'da 600 TL, diğerlerinde 2.000 TL. 2) Instagram'a daha iyi bir görsel denerim. Kayıt sayısı ve kayıt başı maliyetle ölçerim.",
            5: "1) YouTube'u kapatırım (0 kayıt). Google'a en fazla 900 TL eklerim, gösterim payı %90 olduğu için fazlası boşa gider; kalan 2.100 TL'yi Instagram'a koyarım. 2) Form başı maliyet her kanalda 100 TL ama form-kayıt oranı Google'da %17, Instagram ve Facebook'ta %5. Fark, 3 günlük arama gecikmesinden olabilir: satışla aynı gün arama kuralı koyarız. Ölçüm: kanal başına kayıt başı maliyet ve form-kayıt oranı, iki hafta sonra ilk ayla karşılaştırma.",
          },
          internal:
            "Referans hesap: CTR Instagram %1, Google %4, Facebook %0,5, YouTube %0,2. Form başı maliyet Instagram, Google, Facebook 100 TL; YouTube 500 TL. Kayıt başı maliyet Google 600 TL, Instagram ve Facebook 2.000 TL, YouTube kayıt yok. Form-kayıt oranı Google %16,7, Instagram ve Facebook %5. Toplam 24 kayıt, 144.000 TL gelir. Tuzaklar: aynı form başı maliyet (kanallar eşit sanmak), Instagram'ın hacmi (en çok form), Google'ın gösterim payı kısıtı (yaklaşık 900 TL üstü ek bütçe boşa), takip gecikmesi (sorun reklamda değil satış adımında olabilir). Güçlü iki karar: YouTube'u kesip parayı kısıtı gözeterek dağıtmak ve aynı gün arama ile form-kayıt oranını yükseltmek.",
        }),
        longText({
          prompt: t(
            "Yeni bir A1 Almanca akşam kursu için üç reklam metni yaz. Hedef: mesai sonrası Almanca öğrenmek isteyen çalışanlar.\n\nKurs bilgileri: Kadıköy şubesi; salı ve perşembe 19:00-21:30; 8 hafta, toplam 40 ders saati; başlangıç 2 Aralık; sınıf en fazla 12 kişi; ücret 6.000 TL, 15 Kasım'a kadar erken kayıtta %10 indirimle 5.400 TL; 25 Kasım 19:00'da ücretsiz deneme dersi. Kurs sonunda katılım belgesi veriliyor; sınav başarısı garanti edilemez, reklamda \"garanti\" ya da \"kesin\" iddiası kullanılamaz.\n\nYazacakların (Türkçe):\n1) Google arama reklamı: bir başlık (en fazla 30 karakter) ve bir açıklama (en fazla 90 karakter).\n2) Instagram gönderi metni (en fazla 150 karakter), harekete çağrıyla.\n3) Eski öğrencilere e-posta: konu satırı (en fazla 50 karakter) ve 2-3 cümlelik metin.",
            "Write three ad texts for a new A1 German evening course. Audience: working people who want to learn German after work.\n\nCourse facts: Kadıköy branch; Tuesday and Thursday 19:00-21:30; 8 weeks, 40 lesson hours in total; starts 2 December; at most 12 people per class; fee 6,000 TL, or 5,400 TL with a 10% early-bird discount until 15 November; free trial lesson on 25 November at 19:00. A certificate of attendance is given at the end; exam success cannot be guaranteed, and the ads may not claim anything is \"guaranteed\" or \"certain\".\n\nWrite (in English):\n1) A Google search ad: one headline (at most 30 characters) and one description (at most 90 characters).\n2) An Instagram post text (at most 150 characters) with a call to action.\n3) An e-mail to former students: a subject line (at most 50 characters) and a 2-3 sentence body.",
          ),
          competencies: ["communication", "commercial"],
          expected: [
            "Her metin karakter sınırına uyuyor ve kanala uygun yazılmış (arama: niyet ve yer, Instagram: kısa ve çağrılı, e-posta: tanıdık ve kişisel)",
            "Hedef kitlenin kazancını öne çıkarıyor (mesai sonrası saat, küçük sınıf, ücretsiz deneme dersi)",
            "Tarih, saat ve fiyat bilgileri doğru (5.400 TL erken kayıt 15 Kasım'a kadar, başlangıç 2 Aralık)",
            "Her metinde net bir harekete çağrı var ve \"garanti\" ya da kesin sonuç iddiası yok",
          ],
          redFlags: ["Garanti, kesin sertifika ya da sınav başarısı vaat ediyor", "Fiyat, tarih ya da indirim süresini yanlış yazıyor", "Karakter sınırlarını belirgin biçimde aşıyor"],
          examples: {
            1: "Almanca öğrenmenin en kolay yolu! Garantili sonuç, hemen kayıt ol. Instagram: En iyi Almanca kursu bizde! E-posta: Yeni kursumuz açıldı, bekleriz.",
            3: "1) Başlık: Akşam A1 Almanca Kursu. Açıklama: Salı-perşembe 19:00, Kadıköy. 2 Aralık'ta başlıyor, hemen kayıt ol. 2) Mesai sonrası Almanca! Salı ve perşembe 19:00, 12 kişilik sınıf. 15 Kasım'a kadar %10 indirim. 3) Konu: Yeni A1 akşam kursu açıldı. Metin: 2 Aralık'ta başlıyoruz, erken kayıt fırsatını kaçırma.",
            5: "1) Başlık: İşten Sonra A1 Almanca. Açıklama: Kadıköy, salı-perşembe 19:00. 12 kişilik sınıf, 15 Kasım'a kadar 5.400 TL. 2) Mesai bitti, Almanca başlıyor! Salı-perşembe 19:00, en fazla 12 kişi. 25 Kasım deneme dersi ücretsiz, yerini ayırt. 3) Konu: Akşam A1 Almanca: deneme dersine gel. Metin: Merhaba Ayşe, 2 Aralık'ta Kadıköy'de akşam A1 kursu açıyoruz. 25 Kasım 19:00'daki ücretsiz deneme dersine gelebilirsin; 15 Kasım'a kadar kayıtta 5.400 TL.",
          },
          internal:
            "Kontrol listesi: başlık 30, açıklama 90, Instagram 150, konu satırı 50 karakteri aşmamalı. Doğru bilgiler: salı ve perşembe 19:00-21:30, 8 hafta, 40 ders saati, başlangıç 2 Aralık, en fazla 12 kişi, 6.000 TL ya da 15 Kasım'a kadar 5.400 TL, deneme dersi 25 Kasım 19:00. Yasak: garanti, kesin sonuç, sınav başarısı vaadi. Her metinde harekete çağrı beklenir.",
        }),
      ],
    }),
  ],
};
