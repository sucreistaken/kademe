import type { I18nText } from "./schema/types";

/**
 * Kademe's starter library. The dev seed (and pnpm db:seed-library) writes it
 * for an organisation; an organisation created any other way starts with an
 * empty library on purpose and meets the designed empty state instead.
 * Every competency written here keeps reviewed_at null until the team confirms
 * it ("Kademe başlangıç içeriği, ekibiniz incelemedi", HIRING-UX 5.10).
 * Anchors describe what a reviewer can observe in an answer, never a trait.
 */
const i18n = (tr: string, en: string): I18nText => ({ tr, en });

export const DEFAULT_SCALE = {
  name: "Kademe 1-5",
  levels: [
    { value: 1, label: i18n("Belirgin eksik", "Clear gap") },
    { value: 2, label: i18n("Kısmen", "Partly there") },
    { value: 3, label: i18n("Beklenen düzeyde", "Meets the bar") },
    { value: 4, label: i18n("Güçlü", "Strong") },
    { value: 5, label: i18n("Örnek düzeyde", "Exceptional") },
  ],
} as const;

export type CompetencySeed = {
  key: string;
  name: I18nText;
  description: I18nText;
  anchors: Record<1 | 3 | 5, I18nText>;
  positive: I18nText[];
  negative: I18nText[];
};

export const SEED_COMPETENCIES: CompetencySeed[] = [
  {
    key: "communication",
    name: i18n("İletişim", "Communication"),
    description: i18n(
      "Karmaşık bir düşünceyi dinleyicisine göre, sırayla ve örnekle anlatabilme.",
      "Explaining a complex idea in order, with examples, calibrated to the listener.",
    ),
    anchors: {
      1: i18n(
        "Cevap soruyla bağlantısız ya da dağınık; dinleyen ana fikri çıkaramıyor ve örnek yok.",
        "The answer drifts from the question or is disordered; the listener cannot pick out the main point and there is no example.",
      ),
      3: i18n(
        "Ana fikri başta söylüyor, sırayla anlatıyor ve en az bir somut örnek veriyor.",
        "States the main point first, explains in order and gives at least one concrete example.",
      ),
      5: i18n(
        "Anlatımı dinleyicinin bilgisine göre ayarlıyor, olası soruyu önceden cevaplıyor ve kısa bir özetle bitiriyor.",
        "Adjusts the explanation to what the listener knows, answers the likely follow-up in advance and closes with a short summary.",
      ),
    },
    positive: [
      i18n("Net ve yapılandırılmış anlattı", "Clear and structured"),
      i18n("Dinleyiciye göre sadeleştirdi", "Adapted to the listener"),
      i18n("Örnekle somutlaştırdı", "Grounded it in an example"),
      i18n("Sorulanı doğru anladı", "Understood what was asked"),
    ],
    negative: [
      i18n("Soruyu dağıttı", "Drifted off the question"),
      i18n("Terimlerin arkasına saklandı", "Hid behind jargon"),
      i18n("Sorunun bir kısmını yanıtsız bıraktı", "Left part of the question unanswered"),
    ],
  },
  {
    key: "problem_solving",
    name: i18n("Problem Çözme", "Problem Solving"),
    description: i18n(
      "Sorunu doğru tanımlama, varsayımları görünür kılma ve seçenekleri gerekçeyle daraltma.",
      "Framing the real problem, surfacing assumptions, and narrowing options with stated reasoning.",
    ),
    anchors: {
      1: i18n(
        "Sorunu tanımlamadan tek bir çözüme atlıyor ve varsayımlarını söylemiyor.",
        "Jumps to a single fix without defining the problem and does not state any assumption.",
      ),
      3: i18n(
        "Sorunu kendi cümleleriyle tanımlıyor, en az iki seçenek sayıyor ve birini gerekçesiyle seçiyor.",
        "Defines the problem in their own words, lists at least two options and picks one with a reason.",
      ),
      5: i18n(
        "Belirtiyi nedenden ayırıyor, önce hangi bilgiyi toplayacağını söylüyor ve seçtiği çözümün nasıl sınanacağını anlatıyor.",
        "Separates symptom from cause, says which information they would gather first and explains how the chosen fix would be tested.",
      ),
    },
    positive: [
      i18n("Sorunu yeniden tanımladı", "Reframed the problem"),
      i18n("Varsayımlarını açıkça söyledi", "Stated assumptions out loud"),
      i18n("Birden fazla seçenek üretti", "Produced more than one option"),
      i18n("Kararının gerekçesini verdi", "Gave the reason behind the choice"),
    ],
    negative: [
      i18n("Tek çözüme erken kilitlendi", "Locked onto one solution too early"),
      i18n("Nedeni belirtiyle karıştırdı", "Confused cause with symptom"),
      i18n("Çözümü test edilebilir değil", "Solution is not testable"),
    ],
  },
  {
    key: "initiative",
    name: i18n("İnisiyatif", "Initiative"),
    description: i18n(
      "Belirsizlikte kendi kararıyla ilerleme ve sonucu sahiplenme.",
      "Moving forward under uncertainty on their own call, and owning the outcome.",
    ),
    anchors: {
      1: i18n(
        "Anlattığı örneklerde işi başkası başlatmış ya da bitirmiş; kendi adımını ayırt etmiyor.",
        "In the examples given someone else started or finished the work; does not separate out their own step.",
      ),
      3: i18n(
        "Kendi başlattığı bir işi anlatıyor ve belirsiz kalan bir noktada nasıl karar verdiğini söylüyor.",
        "Describes work they started themselves and says how they decided at a point that was unclear.",
      ),
      5: i18n(
        "Kimse istemeden bir riski fark edip harekete geçtiği bir örnek veriyor, sonucu ve kendi payını ölçüyle anlatıyor.",
        "Gives an example of spotting a risk and acting on it unasked, and describes the result and their own share with a measure.",
      ),
    },
    positive: [
      i18n("Riski kendi söyledi", "Named the risk unprompted"),
      i18n("Sormadan bir sonraki adımı önerdi", "Proposed the next step unprompted"),
      i18n("Sahiplendiği bir iş anlattı", "Described work they owned"),
      i18n("Belirsizliğe rağmen ilerledi", "Moved forward despite ambiguity"),
    ],
    negative: [
      i18n("Onay beklediğini ima etti", "Implied they were waiting for approval"),
      i18n("Sorumluluğu devretti", "Handed responsibility elsewhere"),
      i18n("Kendi katkısını ayırt edemedi", "Could not separate their own contribution"),
    ],
  },
  {
    key: "commercial",
    name: i18n("Satış Bakışı", "Commercial Sense"),
    description: i18n(
      "İşi müşterinin kazancına bağlama, itirazı karşılama ve değeri ölçülebilir anlatma.",
      "Tying the work to customer gain, handling objections, and expressing value in measurable terms.",
    ),
    anchors: {
      1: i18n(
        "Ürünün özelliklerini sayıyor ama müşterinin kazancına bağlamıyor; itirazı geçiştiriyor.",
        "Lists product features without tying them to the customer's gain and brushes the objection aside.",
      ),
      3: i18n(
        "Müşterinin bağlamını soruyor, faydayı onun işine bağlıyor ve itiraza doğrudan cevap veriyor.",
        "Asks about the customer's context, ties the benefit to their business and answers the objection directly.",
      ),
      5: i18n(
        "Değeri sayıyla anlatıyor (süre, maliyet, gelir), itirazı bir sonraki adıma çeviriyor ve o adımı netleştiriyor.",
        "Expresses value as a number (time, cost, revenue), turns the objection into a next step and makes that step explicit.",
      ),
    },
    positive: [
      i18n("Müşterinin işine bağladı", "Connected it to the customer's business"),
      i18n("İtirazı doğrudan karşıladı", "Met the objection head on"),
      i18n("Değeri sayıyla ifade etti", "Expressed value as a number"),
      i18n("Bir sonraki adımı netleştirdi", "Made the next step explicit"),
    ],
    negative: [
      i18n("Özellik anlattı, fayda anlatmadı", "Described features, not benefit"),
      i18n("Fiyatı ilk savunma aracı yaptı", "Reached for price as the first defence"),
      i18n("Müşterinin bağlamını sormadı", "Never asked about the customer's context"),
    ],
  },
  {
    key: "technical",
    name: i18n("Teknik Bilgi", "Technical Knowledge"),
    description: i18n(
      "Alanın kavramlarını yerinde kullanma, sınırlarını ve ödünleşimlerini bilme.",
      "Using the field's concepts correctly, and knowing their limits and trade-offs.",
    ),
    anchors: {
      1: i18n(
        "Kavramı yanlış yerde kullanıyor ya da yalnızca tanımını tekrarlıyor; uygulamadan örnek yok.",
        "Uses the concept in the wrong place or only repeats its definition; there is no example from practice.",
      ),
      3: i18n(
        "Doğru kavramı doğru yerde kullanıyor ve kendi işinden bir uygulama örneği veriyor.",
        "Uses the right concept in the right place and gives an example from their own work.",
      ),
      5: i18n(
        "Seçeneklerin ödünleşimini adıyla anlatıyor, bilmediği noktayı açıkça söylüyor ve nasıl öğreneceğini belirtiyor.",
        "Names the trade-offs between options, says plainly what they do not know and how they would find out.",
      ),
    },
    positive: [
      i18n("Doğru kavramı doğru yerde kullandı", "Used the right concept in the right place"),
      i18n("Ödünleşimi adıyla anlattı", "Named the trade-off"),
      i18n("Uygulamadan örnek verdi", "Gave an example from practice"),
      i18n("Bilmediği yeri bilmediğini söyledi", "Said plainly what they did not know"),
    ],
    negative: [
      i18n("Tanım doğru, uygulaması yok", "Definition right, application missing"),
      i18n("Kavramları birbirine karıştırdı", "Mixed up the concepts"),
      i18n("Ezber cevap verdi", "Gave a memorised answer"),
    ],
  },
  {
    key: "organisation",
    name: i18n("Organizasyon", "Organisation"),
    description: i18n(
      "İşi adımlara bölme, önceliği gerekçeyle seçme ve takibini kurma.",
      "Breaking work into steps, choosing priority with a reason, and setting up follow-up.",
    ),
    anchors: {
      1: i18n(
        "İşi adımlara bölmüyor; her şeyi aynı anda yapmayı öneriyor, süre ve sıra vermiyor.",
        "Does not break the work into steps; proposes doing everything at once and gives no order or timeline.",
      ),
      3: i18n(
        "İşi adımlara bölüyor, önceliği bir gerekçeyle seçiyor ve kabaca bir takvim veriyor.",
        "Breaks the work into steps, picks the priority with a reason and gives a rough timeline.",
      ),
      5: i18n(
        "Adımlar arasındaki bağımlılıkları söylüyor, gecikme olursa neyi keseceğini belirtiyor ve takibi nasıl yapacağını anlatıyor.",
        "States the dependencies between steps, says what they would cut if something slips and explains how they would follow up.",
      ),
    },
    positive: [
      i18n("İşi adımlara böldü", "Broke the work into steps"),
      i18n("Önceliği gerekçesiyle seçti", "Chose priority with a reason"),
      i18n("Süre ve kapsamı birlikte düşündü", "Considered time and scope together"),
      i18n("Takibi nasıl kuracağını söyledi", "Said how they would follow up"),
    ],
    negative: [
      i18n("Her şeyi aynı anda yapmayı önerdi", "Proposed doing everything at once"),
      i18n("Bağımlılıkları atladı", "Skipped the dependencies"),
      i18n("Planı takvimsiz kaldı", "Plan had no timeline"),
    ],
  },
  {
    key: "teamwork",
    name: i18n("Takım Çalışması", "Teamwork"),
    description: i18n(
      "Ortak sonucu birlikte üretme, anlaşmazlığı işi ilerletecek şekilde çözme.",
      "Producing a shared outcome together, and resolving disagreement in a way that moves work forward.",
    ),
    anchors: {
      1: i18n(
        "Başarıyı tek başına anlatıyor ya da sorunu ekibe yüklüyor; anlaşmazlığın nasıl çözüldüğünü söylemiyor.",
        "Tells the success as a solo story or puts the problem on the team, and does not say how a disagreement was resolved.",
      ),
      3: i18n(
        "Başkasının katkısını adıyla anıyor ve bir anlaşmazlığı konuşarak nasıl çözdüğünü anlatıyor.",
        "Credits someone else's contribution by name and describes how they talked a disagreement through.",
      ),
      5: i18n(
        "Anlaşmazlığı veriyle çözdüğü bir örnek veriyor, kendi fikrinden vazgeçtiği anı ve ortak kararı nasıl sahiplendiğini anlatıyor.",
        "Gives an example of settling a disagreement with evidence, the moment they gave up their own idea and how they owned the shared decision.",
      ),
    },
    positive: [
      i18n("Başkasının katkısını adıyla andı", "Credited someone else's contribution"),
      i18n("Anlaşmazlığı örnekle çözdü", "Resolved disagreement with evidence"),
      i18n("Yardım istediği yeri anlattı", "Described where they asked for help"),
      i18n("Ortak kararı sahiplendi", "Owned the shared decision"),
    ],
    negative: [
      i18n("Başarıyı tek başına anlattı", "Told the success as a solo story"),
      i18n("Çatışmadan kaçındığını söyledi", "Said they avoided the conflict"),
      i18n("Ekibi suçladı", "Blamed the team"),
    ],
  },
  {
    key: "customer",
    name: i18n("Müşteri Odağı", "Customer Focus"),
    description: i18n(
      "Müşterinin gerçek sorununu anlama, beklentiyi yönetme ve sözünü takip etme.",
      "Understanding the customer's real problem, managing expectations, and following through.",
    ),
    anchors: {
      1: i18n(
        "Müşterinin sorununu sormadan süreci anlatıyor ve şikâyeti kendine yönelik algılıyor.",
        "Explains the process without asking about the customer's problem and takes the complaint as aimed at them.",
      ),
      3: i18n(
        "Önce müşterinin sorununu kendi cümleleriyle doğruluyor, sonra ne yapacağını ve ne zaman döneceğini söylüyor.",
        "First confirms the customer's problem in their own words, then says what they will do and when they will get back.",
      ),
      5: i18n(
        "Beklentiyi baştan netleştiriyor, kötü haberi zamanında veriyor ve geri bildirimi somut bir değişikliğe çevirdiği bir örnek anlatıyor.",
        "Sets expectations up front, delivers bad news in time and describes an example of turning feedback into a concrete change.",
      ),
    },
    positive: [
      i18n("Önce müşterinin sorununu anladı", "Understood the customer's problem first"),
      i18n("Geri bildirimi karara dönüştürdü", "Turned feedback into a decision"),
      i18n("Beklentiyi baştan netleştirdi", "Set expectations up front"),
      i18n("Kötü haberi zamanında verdi", "Delivered bad news in time"),
    ],
    negative: [
      i18n("Süreci müşterinin önüne koydu", "Put process ahead of the customer"),
      i18n("Şikayeti kişisel algıladı", "Took the complaint personally"),
      i18n("Sözünü takip etmedi", "Did not follow through on a promise"),
    ],
  },
];
