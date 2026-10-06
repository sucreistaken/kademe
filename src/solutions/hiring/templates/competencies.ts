import { SEED_COMPETENCIES, type CompetencySeed } from "@/db/library-seed-data";
import { t } from "./build";

/**
 * Competencies the ready templates need beyond the starter library. An
 * organisation gets them (unreviewed) the first time it applies a template
 * that uses them. Anchors describe what a reviewer observes in an answer,
 * never a trait.
 */
const NEW: CompetencySeed[] = [
  {
    key: "accuracy",
    name: t("Doğruluk ve titizlik", "Accuracy and care"),
    description: t(
      "Hataları bulma ve düzeltme; sayıları, kayıtları ve ayrıntıları kontrol ederek çalışma.",
      "Finding and fixing errors; checking numbers, records and details before moving on.",
    ),
    anchors: {
      1: t(
        "Metindeki ya da kayıttaki hataların çoğunu görmüyor, kontrol adımı söylemiyor ve düzeltmeyi gerekçelendirmiyor.",
        "Misses most errors in the text or record, names no checking step and gives no reason for a correction.",
      ),
      3: t(
        "Belirgin hataları buluyor, doğru halini yazıyor ve bir kontrol adımı (yeniden hesap, kaynakla karşılaştırma) söylüyor.",
        "Finds the clear errors, writes the correct version and names a check (recalculation, comparison with the source).",
      ),
      5: t(
        "İnce hataları da buluyor, hatanın nedenini ve tekrarını önleyecek bir yöntemi söylüyor, kontrolü bir alışkanlık olarak anlatıyor.",
        "Also finds subtle errors, says why the error happened and a way to prevent it, and describes checking as a routine.",
      ),
    },
    positive: [
      t("Hataları tek tek buldu", "Found the errors one by one"),
      t("Rakamları yeniden hesapladı", "Recalculated the figures"),
      t("Kontrol yöntemini söyledi", "Named how they check"),
      t("Nedenini ve önlemi yazdı", "Gave the cause and a safeguard"),
    ],
    negative: [
      t("Belirgin bir hatayı kaçırdı", "Missed an obvious error"),
      t("Kontrol etmeden varsaydı", "Assumed without checking"),
      t("Düzeltmeyi gerekçesiz yaptı", "Corrected without a reason"),
    ],
  },
  {
    key: "didactics",
    name: t("Öğretim becerisi", "Teaching skill"),
    description: t(
      "Ders planlama, anlatımı öğrencinin düzeyine göre ayarlama ve anlaşıldığını yoklama.",
      "Planning a lesson, explaining at the learner's level and checking that it was understood.",
    ),
    anchors: {
      1: t(
        "Konuyu kural olarak sıralıyor; hedefi, öğrencinin düzeyini ve anlaşıldığını yoklama yolunu söylemiyor.",
        "Lists the topic as rules; does not state a goal, the learner's level or a way to check understanding.",
      ),
      3: t(
        "Dersin hedefini söylüyor, sıralı adımlar ve en az bir örnek veriyor, anlaşıldığını yoklamak için bir soru ya da alıştırma koyuyor.",
        "States the lesson goal, gives ordered steps and at least one example, and adds a question or exercise to check understanding.",
      ),
      5: t(
        "Anlatımı öğrencinin düzeyine ve olası yanlışlarına göre kuruyor, adımlar arasında yoklama yapıyor, anlamayan öğrenci için ikinci bir yol söylüyor.",
        "Builds the explanation around the learner's level and likely mistakes, checks between steps and offers a second route for a learner who does not follow.",
      ),
    },
    positive: [
      t("Net bir ders hedefi koydu", "Set a clear lesson goal"),
      t("Düzeye uygun örnek verdi", "Gave an example at the right level"),
      t("Anlaşıldığını yokladı", "Checked understanding"),
      t("Olası yanlışı önceden söyledi", "Anticipated the likely mistake"),
    ],
    negative: [
      t("Kuralı örneksiz sıraladı", "Listed the rule without an example"),
      t("Öğrencinin düzeyini hesaba katmadı", "Ignored the learner's level"),
      t("Anlaşıldığını yoklamadı", "Never checked understanding"),
    ],
  },
  {
    key: "german_proficiency",
    name: t("Almanca yeterliği", "German proficiency"),
    description: t(
      "Almancayı doğru, zengin ve duruma uygun bir üslupla kullanma.",
      "Using German accurately, with range and in a register that fits the situation.",
    ),
    anchors: {
      1: t(
        "B2'nin altında: sık hatalar anlamı bozuyor, kelime ve yapı çeşidi dar, cümleler kısa ve tekrar ediyor.",
        "Below B2: frequent errors block meaning, vocabulary and structures are narrow, sentences are short and repetitive.",
      ),
      3: t(
        "C1 düzeyi: akıcı, geniş kelime ve yapı çeşidi, hatalar seyrek ve anlamı bozmuyor, üslup duruma uygun.",
        "C1 level: fluent, wide range of words and structures, rare errors that do not hinder meaning, register fits the situation.",
      ),
      5: t(
        "C2'ye yakın: ince anlam farklarını kesin ifade ediyor, deyimleri doğal kullanıyor, dil denetimi anadili konuşanınkine yakın.",
        "Close to C2: expresses fine shades of meaning precisely, uses idiom naturally, control of the language is near native.",
      ),
    },
    positive: [
      t("Akıcı ve doğal konuştu", "Spoke fluently and naturally"),
      t("Geniş kelime çeşidi kullandı", "Used a wide vocabulary"),
      t("Üslubu duruma uydurdu", "Matched the register to the situation"),
      t("Karmaşık cümleleri doğru kurdu", "Built complex sentences correctly"),
    ],
    negative: [
      t("Hatalar anlamı bozdu", "Errors blocked meaning"),
      t("Aynı kalıpları tekrar etti", "Repeated the same patterns"),
      t("Üslup duruma uymadı", "Register did not fit"),
    ],
  },
  {
    key: "resilience",
    name: t("Baskı altında sakinlik", "Composure under pressure"),
    description: t(
      "Tekrarlanan baskı karşısında sakin ve kibar kalma, hatadan sonra toparlanma.",
      "Staying calm and polite under repeated pressure and recovering after a mistake.",
    ),
    anchors: {
      1: t(
        "Baskıyı anlatırken savunmaya geçiyor ya da karşı tarafı suçluyor; toparlanma adımı yok.",
        "Gets defensive or blames the other side when describing pressure; no recovery step.",
      ),
      3: t(
        "Baskı altında ne yaptığını somut anlatıyor, tonunu koruduğunu söylüyor ve bir toparlanma adımı veriyor.",
        "Describes concretely what they did under pressure, says they kept their tone and gives one recovery step.",
      ),
      5: t(
        "Baskının kaynağını ayırıyor, tepkisini bilinçli seçtiğini gösteriyor, sonrasında kendini ve ekibi toparlayan bir yöntem anlatıyor.",
        "Separates the source of the pressure, shows a deliberate choice of reaction and describes a way to reset themselves and the team afterwards.",
      ),
    },
    positive: [
      t("Tonunu korudu", "Kept their tone"),
      t("Önce nefes alıp önceliği belirledi", "Paused and set a priority first"),
      t("Hatayı sahiplenip toparladı", "Owned the mistake and recovered"),
      t("Karşı tarafı suçlamadı", "Did not blame the other side"),
    ],
    negative: [
      t("Savunmaya geçti", "Became defensive"),
      t("Karşı tarafı suçladı", "Blamed the other side"),
      t("Toparlanma adımı söylemedi", "Named no recovery step"),
    ],
  },
  {
    key: "integrity",
    name: t("Dürüstlük ve gizlilik", "Integrity and confidentiality"),
    description: t(
      "Uygunsuz talebi reddetme, kişisel veriyi koruma ve yetkisinin sınırını bilme.",
      "Refusing an improper request, protecting personal data and knowing the limit of one's authority.",
    ),
    anchors: {
      1: t(
        "Uygunsuz talebi kabul ediyor ya da kişisel veriyi paylaşmayı normal görüyor; sınırı söylemiyor.",
        "Accepts the improper request or treats sharing personal data as normal; names no limit.",
      ),
      3: t(
        "Talebi nazikçe reddediyor, nedenini söylüyor ve kimin onayına gerektiğini ya da hangi kanalı kullanacağını belirtiyor.",
        "Politely refuses, gives the reason and says whose approval or which channel is needed.",
      ),
      5: t(
        "Reddin yanında alternatif sunuyor, olayı kayda geçiriyor ya da ilgili kişiye bildiriyor ve benzerini önleyecek bir kural öneriyor.",
        "Offers an alternative alongside the refusal, records or reports the incident and proposes a rule that prevents a repeat.",
      ),
    },
    positive: [
      t("Talebi nazikçe reddetti", "Refused politely"),
      t("Gerekçesini açıkladı", "Explained the reason"),
      t("Kişisel veriyi korudu", "Protected personal data"),
      t("Doğru kanala yönlendirdi", "Pointed to the right channel"),
    ],
    negative: [
      t("Uygunsuz talebi kabul etti", "Went along with the improper request"),
      t("Kişisel veriyi paylaşmayı normal gördü", "Treated sharing personal data as normal"),
      t("Yetki sınırını söylemedi", "Did not name the limit of authority"),
    ],
  },
  {
    key: "design_craft",
    name: t("Tasarım zanaatı", "Design craft"),
    description: t(
      "Kullanıcı araştırması, net akışlar ve erişilebilir arayüzler tasarlama.",
      "User research, clear flows and accessible interfaces.",
    ),
    anchors: {
      1: t(
        "Tasarımı görünüşe indirgiyor; kullanıcıyı, akışı ve erişilebilirliği anmıyor, kararlarını gerekçelendirmiyor.",
        "Reduces design to appearance; does not mention the user, the flow or accessibility, and gives no reasons for decisions.",
      ),
      3: t(
        "Kullanıcının hedefinden başlıyor, akışı adım adım çiziyor ve en az bir erişilebilirlik ya da kullanılabilirlik noktasını gerekçesiyle söylüyor.",
        "Starts from the user's goal, lays out the flow step by step and names at least one accessibility or usability point with a reason.",
      ),
      5: t(
        "Kararı kullanıcı verisine ya da testine bağlıyor, alternatifleri karşılaştırıyor, uç durumları ve erişilebilirliği tasarıma katıyor, nasıl ölçeceğini söylüyor.",
        "Ties the decision to user data or a test, compares alternatives, builds edge cases and accessibility into the design and says how it would be measured.",
      ),
    },
    positive: [
      t("Kullanıcı hedefinden başladı", "Started from the user's goal"),
      t("Akışı net çizdi", "Laid out a clear flow"),
      t("Erişilebilirliği gerekçesiyle ekledi", "Included accessibility with a reason"),
      t("Kararı veriyle destekledi", "Backed the decision with data"),
    ],
    negative: [
      t("Yalnızca görünüşten söz etti", "Talked only about looks"),
      t("Kullanıcıyı anmadı", "Never mentioned the user"),
      t("Kararı gerekçelendirmedi", "Gave no reason for the decision"),
    ],
  },
  {
    key: "classroom_management",
    name: t("Sınıf yönetimi", "Classroom management"),
    description: t(
      "Grubu derse katılımda tutma, aksaklığı yönetme ve sessiz öğrenciyi dahil etme.",
      "Keeping a group engaged, handling disruption and including quiet learners.",
    ),
    anchors: {
      1: t(
        "Aksaklığı görmezden geliyor ya da cezayla çözüyor; sessiz öğrenciyi ve grubun katılımını anmıyor.",
        "Ignores the disruption or answers it with punishment; does not mention quiet learners or group participation.",
      ),
      3: t(
        "Aksaklığı dersi durdurmadan ele alıyor, katılımı artıracak bir etkinlik ya da düzen söylüyor ve sessiz öğrenciye bir yol açıyor.",
        "Handles the disruption without stopping the lesson, names an activity or routine that raises participation and opens a way in for the quiet learner.",
      ),
      5: t(
        "Aksaklığın nedenini okuyup önlem alıyor, grubu çeşitli düzenlerle (ikili, küçük grup) çalıştırıyor, herkesin konuşma payını gözetiyor ve dersin sonunda yoklama yapıyor.",
        "Reads the cause of the disruption and acts early, varies the grouping (pairs, small groups), watches each learner's talking time and checks the outcome at the end.",
      ),
    },
    positive: [
      t("Dersi durdurmadan müdahale etti", "Intervened without stopping the lesson"),
      t("Sessiz öğrenciye yol açtı", "Opened a way in for the quiet learner"),
      t("Çalışma düzenini çeşitlendirdi", "Varied the grouping"),
      t("Nedeni okuyup önlem aldı", "Read the cause and acted early"),
    ],
    negative: [
      t("Aksaklığı görmezden geldi", "Ignored the disruption"),
      t("Cezaya başvurdu", "Reached for punishment"),
      t("Sessiz öğrenciyi unuttu", "Forgot the quiet learner"),
    ],
  },
  {
    key: "exam_expertise",
    name: t("Sınav bilgisi", "Exam expertise"),
    description: t(
      "Goethe, telc ve ÖSD sınavlarının biçimini, değerlendirme ölçütlerini ve kurallarını bilme.",
      "Knowing the formats, assessment criteria and rules of the Goethe, telc and ÖSD exams.",
    ),
    anchors: {
      1: t(
        "Sınav biçimlerini karıştırıyor, ölçütleri ve süreleri söyleyemiyor, hazırlığı genel tavsiyeye indirgiyor.",
        "Mixes up exam formats, cannot state criteria or timings and reduces preparation to general advice.",
      ),
      3: t(
        "Sınavın bölümlerini ve değerlendirme ölçütlerini doğru sayıyor, hazırlık planını bu ölçütlere bağlıyor.",
        "Names the exam parts and assessment criteria correctly and ties the preparation plan to them.",
      ),
      5: t(
        "Sınavlar arasındaki farkları (biçim, puanlama, geçme koşulu) doğru karşılaştırıyor, öğrenciye göre sınav seçiyor ve sık yapılan puan kaybı hatalarını önceden çalıştırıyor.",
        "Compares exams correctly (format, scoring, pass rule), picks the exam to suit the learner and rehearses the common point-losing mistakes in advance.",
      ),
    },
    positive: [
      t("Sınav bölümlerini doğru saydı", "Named the exam parts correctly"),
      t("Ölçütleri hazırlığa bağladı", "Tied criteria to preparation"),
      t("Sınavları doğru karşılaştırdı", "Compared the exams correctly"),
      t("Sık hataları önceden çalıştırdı", "Rehearsed common mistakes in advance"),
    ],
    negative: [
      t("Sınav biçimlerini karıştırdı", "Mixed up the formats"),
      t("Ölçütleri söyleyemedi", "Could not state the criteria"),
      t("Genel tavsiyede kaldı", "Stayed with general advice"),
    ],
  },
];

export const TEMPLATE_COMPETENCIES: CompetencySeed[] = [...SEED_COMPETENCIES, ...NEW];

export const templateCompetency = (key: string): CompetencySeed | undefined => TEMPLATE_COMPETENCIES.find((c) => c.key === key);
