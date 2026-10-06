import { fileUpload, longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const productDesigner: HiringTemplate = {
  key: "product-designer",
  group: "EXTRA",
  name: t("Ürün Tasarımcısı", "Product Designer"),
  summary: t(
    "Fikri değiştiren araştırma, erişilebilirlik kuralı, süreç gösteren portfolyo ve kayıt formu incelemesi.",
    "Research that changed an idea, an accessibility rule, a portfolio that shows process and a sign-up form review.",
  ),
  jobAd: t(
    "Web ve mobil ürünlerimizin akışlarını ve arayüzlerini tasarlayacak bir Ürün Tasarımcısı arıyoruz. Kararını kullanıcı araştırmasına ve veriye dayandıran, erişilebilirliği baştan düşünen ve tasarımını ürün ve yazılım ekibine gerekçesiyle anlatabilen biri olmalısın.",
    "We are looking for a Product Designer who designs the flows and interfaces of our web and mobile products. You base decisions on user research and data, think about accessibility from the start and explain your design and its reasons to product and engineering.",
  ),
  weights: { design_craft: 40, problem_solving: 35, communication: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "Bir kısa bilgi sorusu ve iki video sorusu. En fazla 13 dakika. Sonraki bölümde portfolyo dosyası (PDF, PNG ya da JPG, en fazla 20 MB) yükleyeceksin; şimdiden hazırla.",
        "One short knowledge question and two video questions. At most 13 minutes. In the next part you will upload a portfolio file (PDF, PNG or JPG, at most 20 MB); have it ready now.",
      ),
      purpose: "Temel erişilebilirlik kuralı bilgisi; araştırmanın fikri değiştirdiği gerçek bir durum; tasarım kararını ekibe gerekçesiyle anlatma.",
      minutes: 13,
      activities: [
        single({
          prompt: t(
            "Bir web uygulamasının giriş ekranını WCAG 2.1 AA düzeyine göre inceliyorsun. Gövde metni 16 px ve normal kalınlıkta. Aşağıdakilerden hangisi WCAG 2.1 AA'ya göre bir ihlaldir?",
            "You are reviewing a web app's sign-in screen against WCAG 2.1 level AA. Body text is 16 px and regular weight. Which of the following is a violation of WCAG 2.1 AA?",
          ),
          options: [
            t("Gövde metninin beyaz zemine kontrastı 4,6:1", "Body text has a 4.6:1 contrast ratio on white"),
            t("Klavyeyle gezinirken odaklanan alanın görünür bir odak göstergesi yok", "The focused field has no visible focus indicator when navigating by keyboard"),
            t("24 px kalın başlığın beyaz zemine kontrastı 3,2:1", "A 24 px bold heading has a 3.2:1 contrast ratio on white"),
            t("Hatalı alan kırmızı çerçeve ve yanındaki hata metniyle gösteriliyor", "An invalid field is shown with a red border and an error text next to it"),
          ],
          correct: 1,
          internal:
            "Doğru cevap: görünür odak göstergesi yok (WCAG 2.4.7 Focus Visible, AA). Çeldiriciler: 4,6:1 normal metin için AA eşiği 4,5:1'i geçiyor (7:1'i AA sanmak, o AAA); 24 px kalın başlık büyük metin sayılır, AA eşiği 3:1, 3,2:1 geçiyor; kırmızı çerçeve yanında metin olduğu için bilgi yalnızca renkle verilmiyor (1.4.1 karşılanıyor).",
        }),
        video({
          prompt: t(
            "Kullanıcı araştırmasının ya da bir testin, başta doğru bulduğun bir tasarım fikrini değiştirdiği bir durumu anlat (iş, okul ya da kişisel bir projede): ilk fikrin neydi, hangi araştırmayı nasıl yaptın, ne gördün, tasarımı nasıl değiştirdin ve sonucu nasıl ölçtün?",
            "Tell us about a time user research or a test changed a design idea you first believed in (at work, school or in a personal project): what was your first idea, which research did you do and how, what did you see, how did you change the design, and how did you measure the result?",
          ),
          competencies: ["design_craft", "problem_solving"],
          expected: [
            "İlk fikri ve neden doğru bulduğunu açıkça söylüyor",
            "Araştırma yöntemini somut anlatıyor (kaç kullanıcı, hangi görev, hangi veri)",
            "Gördüğü bulguyu ve tasarımda neyi neden değiştirdiğini birbirine bağlıyor",
            "Değişikliğin sonucunu bir ölçüyle ya da ikinci bir testle doğruladığını söylüyor",
          ],
          redFlags: ["Araştırmanın fikrini hiç değiştirmediğini, kullanıcıların sonunda alıştığını söylüyor", "Yöntem ya da bulgu vermeden genel laflar ediyor"],
          examples: {
            1: "Genelde içgüdülerime güvenirim, kullanıcılar ne istediğini bilmez. Tasarımı yaptım, sonra herkes beğendi.",
            3: "Bir ödeme ekranında adımları tek sayfada toplamayı düşünmüştüm. Beş kullanıcıyla test yaptım, üçü uzun sayfada kayboldu. İki adıma böldüm, ikinci testte hepsi ödemeyi bitirdi.",
            5: "Bir kurs uygulamasında ana sayfaya kişisel öneriler koymak istiyordum. Yedi öğrenciyle görev bazlı test yaptım; altısı önce 'bir sonraki dersim ne zaman' diye arıyordu ve önerilere hiç bakmadı. Ana sayfayı sıradaki derse göre yeniden kurdum, önerileri alta aldım. Yayından iki hafta sonra ders sayfasına ulaşma süresi ortalama 14 saniyeden 5 saniyeye indi ve destek taleplerinde 'dersim nerede' soruları azaldı.",
          },
        }),
        video({
          prompt: t(
            "Bir tasarım kararın konusunda ürün yöneticisi, yazılımcı ya da bir ekip arkadaşıyla anlaşamadığın bir durumu anlat (iş, okul ya da kişisel bir projede): anlaşmazlık neydi, kararını nasıl anlattın, karşı tarafın hangi kaygısını dikkate aldın ve sonunda ne oldu?",
            "Tell us about a time you disagreed with a product manager, developer or teammate about a design decision (at work, school or in a personal project): what was the disagreement, how did you explain your decision, which of their concerns did you take on board, and what happened in the end?",
          ),
          competencies: ["communication", "design_craft"],
          expected: [
            "Anlaşmazlığı ve iki tarafın gerekçesini somut söylüyor",
            "Kararını kullanıcı verisi, test ya da erişilebilirlik gibi bir gerekçeyle anlattığını söylüyor",
            "Karşı tarafın kaygısını (süre, teknik maliyet, iş hedefi) ciddiye alıp bir uzlaşma ya da deneme önerdiğini anlatıyor",
            "Sonucu ve bundan ne öğrendiğini söylüyor",
          ],
          redFlags: ["Karşı tarafı tasarımdan anlamamakla suçluyor", "Kararını yalnızca beğeniye ya da kişisel zevke dayandırıyor"],
          examples: {
            1: "Yazılımcı tasarımımı değiştirmek istedi ama tasarım benim işim, olduğu gibi yapılmasını istedim.",
            3: "Yazılımcı, özel bir tarih seçicinin iki hafta süreceğini söyledi. Ben kullanıcıların mevcut seçicide zorlandığını gösteren test notlarını paylaştım. Sonunda hazır bir bileşeni özelleştirmeye karar verdik.",
            5: "Ürün yöneticisi kayıt formuna pazarlama için üç yeni zorunlu alan eklemek istiyordu. Ben huni verisini gösterdim: her ek alanda tamamlama oranı düşüyordu. Kaygısının hedef kitleyi tanımak olduğunu anladım; alanları kayıttan sonraki ilk girişe, isteğe bağlı olarak taşımayı önerdim. İki hafta A/B testi yaptık: kayıt oranı korundu, kullanıcıların %40'ı alanları yine doldurdu. O günden beri böyle kararları küçük bir testle veriyoruz.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Portfolyo yükleme ve bir kayıt formu incelemesi. En fazla 20 dakika.",
        "A portfolio upload and a sign-up form review. At most 20 minutes.",
      ),
      purpose: "Portfolyoda süreç kanıtı (problem, araştırma, alternatif, sonuç); yazılı tarif edilen bir formda kullanılabilirlik ve erişilebilirlik sorunlarını bulup gerekçeli çözüm önerme.",
      minutes: 20,
      activities: [
        fileUpload({
          prompt: t(
            "Portfolyonu tek bir dosya olarak yükle (PDF, PNG ya da JPG, en fazla 20 MB). 1-3 proje yeterli. En az bir projede süreci göster: problem neydi, senin rolün neydi, hangi araştırmayı yaptın, hangi alternatifleri denedin, son tasarım ne oldu ve sonucu nasıl ölçtün. Müşteriye ait gizli bilgileri (gerçek kullanıcı verisi, yayınlanmamış ürün adı) çıkar ya da gizle.",
            "Upload your portfolio as a single file (PDF, PNG or JPG, at most 20 MB). One to three projects are enough. In at least one project, show the process: what the problem was, what your role was, which research you did, which alternatives you tried, what the final design was and how you measured the result. Remove or mask a client's confidential details (real user data, unreleased product names).",
          ),
          mimeTypes: ["application/pdf", "image/png", "image/jpeg"],
          competencies: ["design_craft", "communication"],
          expected: [
            "En az bir projede problemden sonuca giden süreci gösteriyor (araştırma, eskiz ya da wireframe, alternatifler, son tasarım)",
            "Kendi rolünü ekibin işinden ayırıyor",
            "Tasarım kararlarını kullanıcı bulgusu ya da veriyle gerekçelendiriyor ve sonucu bir ölçüyle veriyor",
            "Dosya düzenli ve kısa; gizli müşteri bilgilerini gizlemiş",
          ],
          redFlags: ["Yalnızca son ekran görüntüleri var, süreç ve gerekçe yok", "Gerçek kullanıcı verisi ya da gizli müşteri bilgisi açıkta", "Rolü belirsiz; ekip işini tek başına yapmış gibi sunuyor"],
          examples: {
            1: "Birkaç uygulamanın son ekran görüntüleri; açıklama, rol ve süreç yok. Bir ekranda gerçek müşteri adları görünüyor.",
            3: "İki proje. Birinde problem, rol, birkaç wireframe ve son tasarım var; kararların bir kısmı gerekçeli ama araştırma kısa geçilmiş ve sonuç ölçülmemiş.",
            5: "Üç proje, her biri bir sayfalık özetle başlıyor (problem, rol, süre). Ana projede 6 kullanıcıyla yapılan testin bulguları, iki alternatif akışın karşılaştırması, erişilebilirlik notları ve yayından sonra görev tamamlama oranının %62'den %81'e çıktığı gösteriliyor. Müşteri adları ve kullanıcı verileri maskelenmiş.",
          },
        }),
        longText({
          prompt: t(
            "Bir dil kursunun mobil \"ücretsiz deneme dersine kayıt\" formu şöyle:\n\n- Alanlar: Ad Soyad, E-posta, Telefon, T.C. kimlik no, Şifre, Şifre tekrar. Hepsi zorunlu.\n- Alanların üstünde etiket yok; alan adı yalnızca kutunun içinde gri yer tutucu metin olarak yazıyor ve yazmaya başlayınca kayboluyor.\n- Şifre kuralları (en az 8 karakter, bir büyük harf, bir rakam) yalnızca form gönderilip hata alınınca gösteriliyor.\n- Hata olduğunda formdaki tüm alanlar temizleniyor.\n- Telefon alanı yalnızca \"05xxxxxxxxx\" biçimini kabul ediyor; boşluk ya da +90 yazılınca \"Geçersiz giriş\" hatası çıkıyor.\n- \"Kampanya e-postalarını almayı kabul ediyorum\" kutusu önceden işaretli ve işareti kaldırınca form gönderilemiyor.\n- \"Kayıt ol\" düğmesi açık gri zemin üstünde beyaz yazı; \"Vazgeç\" düğmesi kalın mavi.\n\nAnalitik: formu açanların %40'ı formu bitirmeden çıkıyor; çıkışların çoğu şifre adımında.\n\nEn önemli gördüğün üç sorunu seç. Her biri için neden önemli olduğunu (kullanıcıya etkisi), önerdiğin düzeltmeyi ve düzeltmenin işe yarayıp yaramadığını nasıl ölçeceğini yaz.",
            "A language school's mobile \"sign up for a free trial lesson\" form looks like this:\n\n- Fields: Full name, E-mail, Phone, National ID number, Password, Repeat password. All required.\n- There are no labels above the fields; each field's name appears only as grey placeholder text inside the box and disappears once you start typing.\n- The password rules (at least 8 characters, one capital letter, one digit) are shown only after the form is submitted and fails.\n- When there is an error, every field in the form is cleared.\n- The phone field accepts only the format \"05xxxxxxxxx\"; spaces or +90 give an \"Invalid input\" error.\n- The box \"I agree to receive campaign e-mails\" is pre-ticked, and the form cannot be submitted if you untick it.\n- The \"Sign up\" button is white text on light grey; the \"Cancel\" button is bold blue.\n\nAnalytics: 40% of people who open the form leave without finishing; most exits happen at the password step.\n\nPick the three problems you see as most important. For each, say why it matters (the effect on the user), the fix you propose and how you will measure whether the fix works.",
          ),
          competencies: ["design_craft", "problem_solving"],
          expected: [
            "Analitikteki şifre adımı çıkışını bir sorunla ilişkilendiriyor (deneme dersi için şifre gereksiz, kurallar geç gösteriliyor, hata alanları temizliyor) ve önceliğini veriye dayandırıyor",
            "Seçtiği her sorunun kullanıcıya etkisini somut söylüyor ve uygulanabilir bir düzeltme veriyor",
            "En az bir erişilebilirlik ya da güven sorununu görüyor (yer tutucu etiket, düşük kontrastlı ana düğme, zorunlu kampanya onayı, gereksiz kimlik no)",
            "Her düzeltme için bir ölçü söylüyor (tamamlama oranı, adım bazında çıkış, hata sayısı, A/B testi)",
          ],
          redFlags: ["Yalnızca renk ve görünüş önerileriyle kalıyor", "Analitik verisini hiç kullanmıyor", "Sorun söylüyor ama düzeltme ya da ölçü vermiyor"],
          examples: {
            1: "Form biraz sade, renkleri daha canlı yaparım. Düğmeyi büyütürüm ve başlığa güzel bir görsel eklerim.",
            3: "1) Şifre kuralları geç gösteriliyor, kullanıcı hata alıp çıkıyor: kuralları alanın altında baştan gösteririm. 2) Etiketler kayboluyor: alanların üstüne kalıcı etiket koyarım. 3) Kayıt ol düğmesi soluk: kontrastı yüksek ana renk yaparım. Formu bitirme oranına bakarım.",
            5: "1) Deneme dersi için şifre ve T.C. kimlik no gereksiz; çıkışlar şifre adımında. İkisini kaldırır, hesabı ilk dersten sonra açtırırım. Ölçü: tamamlama oranı ve adım bazında çıkış, iki hafta A/B testi. 2) Hata olunca alanlar temizleniyor ve telefon biçimi katı: girilenleri korur, boşluk ve +90'ı kendim düzeltir, hatayı alanın altında yazarım. Ölçü: hata sonrası çıkış. 3) Kampanya onayı zorunlu ve işaretli: güven ve yasal sorun; isteğe bağlı ve boş yaparım, etiketleri kalıcı yaparım. Ölçü: tamamlama ve şikayet sayısı.",
          },
          internal:
            "Yerleştirilmiş sorunlar (8): 1) yer tutucu metin etiket yerine kullanılıyor ve kayboluyor (erişilebilirlik, hafıza yükü); 2) şifre kuralları ancak hatadan sonra gösteriliyor; 3) hata olunca tüm alanlar temizleniyor; 4) telefon biçimi katı ve hata mesajı belirsiz; 5) ince: kampanya e-postası onayı önceden işaretli ve zorunlu (geçerli onay değil, güven ve yasal risk); 6) ince: deneme dersi kaydı için T.C. kimlik no gereksiz kişisel veri (veri en aza indirme); 7) ince: deneme dersi için şifre ve şifre tekrar alanının kendisi gereksiz olabilir, analitikteki şifre adımı çıkışı buna işaret ediyor; 8) ana düğme düşük kontrastlı, ikincil düğme daha belirgin (görsel hiyerarşi ters, kontrast ihlali). Güçlü cevap analitiği 2, 3 ya da 7 ile ilişkilendirir ve en az bir ince sorunu seçer.",
        }),
      ],
    }),
  ],
};
