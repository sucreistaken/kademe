import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const accountant: HiringTemplate = {
  key: "accountant",
  group: "GENERIC",
  name: t("Muhasebe Uzmanı", "Accountant"),
  summary: t("Kapanış hatası, KDV ve yevmiye, banka mutabakatı ve yanlış dönem talebi.", "A closing error, VAT and journal entries, a bank reconciliation and a wrong-period request."),
  jobAd: t(
    "Günlük kayıtları, banka mutabakatlarını ve ay sonu kapanışını yürütecek, beyannameler için verileri hazırlayacak bir Muhasebe Uzmanı arıyoruz. Rakamı kontrol etmeden geçmeyen, Tek Düzen Hesap Planı'na ve KDV kurallarına hakim ve kurala aykırı bir talebe nazikçe hayır diyebilen biri olmalısın.",
    "We are looking for an Accountant who runs daily bookkeeping, bank reconciliations and the month-end close and prepares the data for tax returns. You never pass a figure without checking it, you know the Turkish uniform chart of accounts and VAT rules, and you can politely say no to a request that breaks the rules.",
  ),
  weights: { accuracy: 40, technical: 35, integrity: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("İki bilgi sorusu ve iki kısa video sorusu. En fazla 14 dakika.", "Two knowledge questions and two short video questions. At most 14 minutes."),
      purpose: "Kapanışta bulunan bir hatayı sahiplenme, mevzuat değişikliğini uygulama, KDV ve yevmiye kaydı bilgisi.",
      minutes: 14,
      activities: [
        single({
          prompt: t(
            "KDV dahil toplamı 14.400 TL olan bir satış faturası var. KDV oranı %20. Faturadaki KDV tutarı kaç TL'dir?",
            "A sales invoice has a VAT-inclusive total of 14,400 TL. The VAT rate is 20%. How much VAT is on the invoice?",
          ),
          options: [
            t("2.880 TL", "2,880 TL"),
            t("12.000 TL", "12,000 TL"),
            t("2.400 TL", "2,400 TL"),
            t("1.440 TL", "1,440 TL"),
          ],
          correct: 2,
          internal: "Doğru cevap: 2.400 TL. Matrah = 14.400 / 1,20 = 12.000 TL; KDV = 12.000 x 0,20 = 2.400 TL. Çeldiriciler: 2.880 TL (KDV dahil tutarın %20'si, en sık hata), 12.000 TL (matrah), 1.440 TL (%10).",
        }),
        single({
          prompt: t(
            "Şirket, 10.000 TL + %20 KDV tutarında ticari malı vadeli (veresiye) satın alıyor. Tek Düzen Hesap Planı'na göre doğru yevmiye kaydı hangisi?",
            "The company buys trade goods on credit for 10,000 TL plus 20% VAT. Under the Turkish uniform chart of accounts, which journal entry is correct?",
          ),
          options: [
            t("153 Ticari Mallar borç 12.000 / 320 Satıcılar alacak 12.000", "Debit 153 Trade Goods 12,000 / Credit 320 Suppliers 12,000"),
            t("153 Ticari Mallar borç 10.000, 191 İndirilecek KDV borç 2.000 / 320 Satıcılar alacak 12.000", "Debit 153 Trade Goods 10,000, Debit 191 Deductible VAT 2,000 / Credit 320 Suppliers 12,000"),
            t("153 Ticari Mallar borç 10.000, 391 Hesaplanan KDV borç 2.000 / 320 Satıcılar alacak 12.000", "Debit 153 Trade Goods 10,000, Debit 391 Calculated VAT 2,000 / Credit 320 Suppliers 12,000"),
            t("320 Satıcılar borç 12.000 / 153 Ticari Mallar alacak 10.000, 191 İndirilecek KDV alacak 2.000", "Debit 320 Suppliers 12,000 / Credit 153 Trade Goods 10,000, Credit 191 Deductible VAT 2,000"),
          ],
          correct: 1,
          internal: "Doğru cevap: 153 B 10.000, 191 B 2.000 / 320 A 12.000. Alışta ödenen KDV 191 İndirilecek KDV'ye gider. Çeldiriciler: KDV'yi maliyete katmak (a), alışta 391 Hesaplanan KDV kullanmak (c, satış hesabı), kaydı ters kurmak (d).",
        }),
        video({
          prompt: t(
            "Ay ya da yıl sonu kapanışında bir hata fark ettiğin bir durumu anlat: hata neydi, nasıl fark ettin, kime ne söyledin, nasıl düzelttin ve tekrarlanmaması için sonra neyi değiştirdin?",
            "Tell us about a time you found an error during a month-end or year-end close: what was the error, how did you notice it, whom did you tell what, how did you fix it, and what did you change afterwards so it would not happen again?",
          ),
          competencies: ["integrity", "technical"],
          expected: [
            "Hatayı somut söylüyor (hangi hesap, ne tutar, hangi dönem) ve nasıl fark ettiğini anlatıyor (mutabakat, bakiye kontrolü, karşılaştırma)",
            "Hatayı kendisi yapmış olsa bile gizlemeden ilgili kişiye bildirdiğini anlatıyor",
            "Düzeltmeyi kayıtla ve gerekçesiyle yaptığını söylüyor",
            "Sonradan eklediği bir kontrol adımını söylüyor",
          ],
          redFlags: ["Hatayı kimseye söylemeden sessizce düzelttiğini anlatıyor", "Somut bir hata yerine 'ben hata yapmam' diyor", "Hatayı başkasına yükleyip kendi payını söylemiyor"],
          examples: {
            1: "Kapanışta bazen küçük farklar çıkar, ben de bir sonraki aya düzeltirim, kimseyi uğraştırmam.",
            3: "Eylül kapanışında 320 Satıcılar hesabında bir faturanın iki kez kaydedildiğini mutabakatta gördüm. Müdürüme söyledim, mükerrer kaydı ters kayıtla iptal ettim.",
            5: "Eylül kapanışında satıcı mutabakatı yaparken bir tedarikçinin 46.800 TL'lik faturasının iki kez kaydedildiğini gördüm; ikinci kaydı ben girmiştim. Finans müdürüne hemen yazdım, ters kayıtla düzelttim ve indirilecek KDV'yi de kontrol ettim, beyanname verilmeden yakalanmıştı. Sonrasında fatura girişinde belge numarasıyla mükerrer kontrolü yapan bir rapor ekledim, kapanış listesine de satıcı mutabakatını ayın 3'üne çektim.",
          },
        }),
        video({
          prompt: t(
            "Bir mevzuat ya da muhasebe uygulaması değişikliğini kendi işine uyguladığın bir durumu anlat: değişiklik neydi, nasıl öğrendin, kayıtlarında neyi değiştirdin ve sonucu nasıl kontrol ettin?",
            "Tell us about a time you applied a change in regulation or accounting practice to your own work: what was the change, how did you learn about it, what did you change in your bookkeeping, and how did you check the result?",
          ),
          competencies: ["technical"],
          expected: [
            "Değişikliği doğru kavramlarla ve somut anlatıyor (oran, tarih, hesap, belge türü)",
            "Değişikliği hangi kaynaktan öğrendiğini ve nasıl doğruladığını söylüyor (resmi duyuru, mali müşavir, mevzuat metni)",
            "Kayıtlarda ya da sistemde yaptığı değişikliği ve ilk dönemde yaptığı kontrolü anlatıyor",
          ],
          redFlags: ["Değişikliği yanlış ya da belirsiz anlatıyor", "Doğrulamadan duyduğu bilgiyle uyguladığını anlatıyor"],
          examples: {
            1: "Mevzuat sık değişiyor, mali müşavirimiz ne derse onu yapıyoruz.",
            3: "KDV genel oranı %18'den %20'ye çıktığında ERP'deki vergi kodlarını güncelledim, ilk hafta kesilen faturaları kontrol ettim.",
            5: "Temmuz 2023'te KDV genel oranı %18'den %20'ye çıktığında değişikliği Resmi Gazete'den okuyup mali müşavirle teyit ettim. ERP'de vergi kodlarını yürürlük tarihine göre ayırdım, çünkü önceki tarihli teslimlere eski oran uygulanmaya devam edecekti. İlk ay KDV beyannamesinden önce oran bazında bir dökümle 391 hesabını faturalarla karşılaştırdım ve %18'le kesilmiş iki faturayı yakaladım.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t("Gerçek işe benzeyen iki yazılı görev: bir banka mutabakatı ve bir yöneticiye cevap. En fazla 20 dakika.", "Two written tasks like the real job: a bank reconciliation and a reply to a manager. At most 20 minutes."),
      purpose: "Mutabakatta farkları bulma ve açıklama; dönemsellik ilkesine aykırı talebe gerekçeli cevap.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Eylül ayı banka mutabakatını yapıyorsun. Banka ekstresinin bakiyesi ile 102 Bankalar hesabının bakiyesi tutmuyor. Farkın tamamını açıkla: her farkın ne olduğunu, nedenini ve hangi düzeltme kaydını önerdiğini yaz.\n\nBANKA EKSTRESİ (Eylül)\nAçılış bakiyesi: 125.000,00\n03.09 Tahsilat, Atlas Ltd.: +48.000,00\n10.09 Kira ödemesi: -22.500,00\n17.09 Tahsilat, Deniz AŞ: +18.540,00\n24.09 Ödeme, Kaya Ltd.: -31.200,00\n30.09 Hesap işletim ücreti: -350,00\nKapanış bakiyesi: 137.490,00\n\n102 BANKALAR HESABI (Eylül)\nAçılış bakiyesi: 125.000,00\n03.09 Atlas Ltd. tahsilatı: +48.000,00\n10.09 Kira ödemesi: -22.500,00\n17.09 Deniz AŞ tahsilatı: +18.450,00\n24.09 Kaya Ltd. ödemesi: -31.200,00\nKapanış bakiyesi: 137.750,00",
            "You are doing the September bank reconciliation. The bank statement balance and the balance of account 102 Banks do not agree. Explain the whole difference: for each difference write what it is, why it happened and which correcting entry you propose.\n\nBANK STATEMENT (September)\nOpening balance: 125,000.00\n03.09 Receipt, Atlas Ltd.: +48,000.00\n10.09 Rent payment: -22,500.00\n17.09 Receipt, Deniz AŞ: +18,540.00\n24.09 Payment, Kaya Ltd.: -31,200.00\n30.09 Account maintenance fee: -350.00\nClosing balance: 137,490.00\n\nACCOUNT 102 BANKS (September)\nOpening balance: 125,000.00\n03.09 Atlas Ltd. receipt: +48,000.00\n10.09 Rent payment: -22,500.00\n17.09 Deniz AŞ receipt: +18,450.00\n24.09 Kaya Ltd. payment: -31,200.00\nClosing balance: 137,750.00",
          ),
          competencies: ["accuracy", "technical"],
          expected: [
            "Toplam farkı (260 TL, defter fazla) doğru hesaplıyor ve iki farkla tam olarak açıklıyor",
            "Deftere işlenmemiş 350 TL banka ücretini buluyor ve gider kaydını öneriyor (770 ya da 780 borç / 102 alacak)",
            "Deniz AŞ tahsilatındaki 90 TL'lik basamak yer değiştirmesini (18.540 yerine 18.450) buluyor, dekontla teyit edip 102 borç / 120 alacak düzeltmesini öneriyor",
            "Bir önleme adımı söylüyor (ekstreyle günlük eşleştirme, 9'a bölünen farkı yer değiştirme işareti olarak kontrol etme)",
          ],
          redFlags: ["Farkı 'kur farkı' ya da 'diğer' gibi bir hesaba atarak kapatıyor", "Farklardan yalnızca birini bulup kalan farkı açıklamıyor", "Düzeltmeyi banka ekstresini değiştirmek gibi yanlış tarafta yapıyor"],
          examples: {
            1: "Arada 260 TL fark var, büyük bir tutar değil. 689 Diğer Olağandışı Gider hesabına atıp kapatırım.",
            3: "Fark 260 TL. Bankanın kestiği 350 TL işletim ücreti deftere işlenmemiş, 770 borç / 102 alacak kaydı gerekir. Bir de Deniz AŞ tahsilatı defterde 18.450, bankada 18.540; 90 TL eksik kaydedilmiş, 102'ye 90 TL borç yazarım.",
            5: "Defter 137.750, banka 137.490; defter 260 TL fazla. (1) 30.09'daki 350 TL işletim ücreti deftere işlenmemiş, defter 350 TL fazla. Kayıt: 770 Genel Yönetim Giderleri (politikaya göre 780) borç 350 / 102 alacak 350. (2) Deniz AŞ tahsilatı defterde 18.450, bankada 18.540; rakamlar yer değiştirmiş, defter 90 TL eksik, fark 9'a bölünüyor. Dekont ve cari kontrolünden sonra 102 borç 90 / 120 Alıcılar alacak 90. 350 - 90 = 260 TL, fark tamamen açıklanıyor. Önlem: tahsilatları ekstreden otomatik eşleştirmek, banka masraflarını haftalık işlemek.",
          },
          internal: "Yerleştirilmiş farklar (tam olarak 2):\n1) Belirgin: 30.09 hesap işletim ücreti 350 TL bankada var, defterde yok. Defteri 350 TL fazla gösterir. Düzeltme: 770 (ya da 780) B 350 / 102 A 350.\n2) İnce: 17.09 Deniz AŞ tahsilatı bankada 18.540, defterde 18.450 (basamak yer değiştirmesi). Defteri 90 TL eksik gösterir. Fark 9'a bölünüyor. Düzeltme (dekontla teyit sonrası): 102 B 90 / 120 A 90.\nKontrol: defter 137.750 - 350 + 90 = 137.490 = banka. Net fark 260 TL. Diğer tüm satırlar iki tarafta aynı.",
        }),
        longText({
          prompt: t(
            "Bugün 6 Kasım, Ekim kapanışı devam ediyor. Finans müdüründen şu e-posta geldi:\n\n\"Delta Yapı'ya kestiğimiz 4 Kasım tarihli 85.000 TL + KDV danışmanlık faturasını Ekim'e kaydeder misin? Ekim ciro hedefine 60.000 TL kaldı, bununla tutturuyoruz. Hizmeti zaten Kasım'ın ilk haftasında verdik, bir hafta oynamanın kimseye zararı olmaz. Bugün kapatalım lütfen.\"\n\nFinans müdürüne göndereceğin cevabı yaz.",
            "Today is 6 November and the October close is still open. You receive this e-mail from the finance manager:\n\n\"Could you book the consultancy invoice to Delta Yapı, dated 4 November, for 85,000 TL plus VAT, in October? We are 60,000 TL short of the October revenue target and this gets us there. We delivered the service in the first week of November anyway, moving it by a week hurts nobody. Let's close it today please.\"\n\nWrite your reply to the finance manager.",
          ),
          competencies: ["integrity", "technical"],
          expected: [
            "Talebi nazik ama net reddediyor; hizmetin ve faturanın Kasım'a ait olduğunu söylüyor",
            "Gerekçeyi doğru kavramlarla veriyor: dönemsellik ve tahakkuk ilkesi, KDV'nin fatura ve hizmet dönemine göre Kasım beyannamesine girmesi, Ekim tablolarının ve beyannamesinin yanlış olacağı",
            "Bir alternatif sunuyor (Ekim raporunda Kasım'ın ilk haftasındaki faturayı not olarak gösterme, hedef sapmasını açıklayan kısa bir not hazırlama)",
            "Talep ısrarla sürerse kimin onayına ya da hangi kanala gideceğini söylüyor ya da kararı yazılı kayda alıyor",
          ],
          redFlags: ["Talebi kabul ediyor ya da 'bu seferlik' diyor", "Reddediyor ama gerekçe vermiyor ya da yanlış kurala dayanıyor", "Müdürü suçlayan ya da tehdit eden bir dil kullanıyor"],
          examples: {
            1: "Tamam, siz onaylıyorsanız Ekim'e alıyorum. Kapanışı bugün yaparız.",
            3: "Merhaba, bu faturayı Ekim'e alamam; hizmet de fatura da Kasım'a ait, dönemsellik ilkesine aykırı olur ve KDV'si Kasım beyannamesine girmeli. Ekim kapanışını bugün tamamlıyorum, fatura Kasım'da kaydedilecek.",
            5: "Merhaba, hedefin önemini biliyorum ama bu faturayı Ekim'e kaydedemem. Hizmet Kasım'ın ilk haftasında verildi, fatura 4 Kasım tarihli; dönemsellik ve tahakkuk ilkesine göre gelir Kasım'a ait, KDV'si de Kasım beyannamesine girmeli. Ekim'e alırsak Ekim tabloları ve KDV beyannamesi yanlış olur. Önerim: Ekim raporuna 'hedefe 60.000 TL kala kapandı, 4 Kasım'da 85.000 TL Delta Yapı faturası kesildi' notunu ekleyelim, notu ben hazırlayabilirim. Farklı bir uygulama düşünülüyorsa mali müşavirin yazılı görüşünü alalım. Ekim kapanışını bugün bu haliyle tamamlıyorum.",
          },
          internal: "Referans: Hizmet Kasım'da verildi, fatura 4 Kasım tarihli; gelir ve KDV Kasım dönemine aittir (dönemsellik ve tahakkuk ilkesi, KDV'de vergiyi doğuran olay hizmetin yapılması ya da faturanın düzenlenmesi). Ekim'e kayıt Ekim finansal tablolarını ve KDV beyannamesini yanlış gösterir. Güçlü cevap: net ret, doğru gerekçe, alternatif (rapora not, sapma açıklaması), ısrar halinde yazılı kayıt ya da mali müşavir veya üst yönetim görüşü.",
        }),
      ],
    }),
  ],
};
