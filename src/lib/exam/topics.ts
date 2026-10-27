import type { CandidateLocale } from "@/i18n/locale";
import { A1_COURSE_TOPICS } from "./topics-course/a1";
import { A2_COURSE_TOPICS } from "./topics-course/a2";
import { B1_COURSE_TOPICS } from "./topics-course/b1";
import { B2_COURSE_TOPICS } from "./topics-course/b2";

export type TopicId = string;
export type Topic = {
  parent?: TopicId;
  /** True for a task format ("Text with gaps"), which is not a topic the student can study. */
  format?: true;
  label: Record<CandidateLocale, string>;
};

/** The catalog. Every seed skill tag and every gap topic must resolve to an id here (topics.test.ts enforces it). */
export const TOPICS: Record<TopicId, Topic> = {
  konnektor: {
    label: { tr: "Bağlaçlar", en: "Connectors", de: "Konnektoren", es: "Conectores", ar: "أدوات الربط" },
  },
  konjunktiv_i: {
    label: { tr: "Konjunktiv I", en: "Subjunctive I", de: "Konjunktiv I", es: "Subjuntivo I", ar: "Konjunktiv I" },
  },
  relativsatz: {
    label: { tr: "İlgi cümleleri", en: "Relative clauses", de: "Relativsätze", es: "Oraciones de relativo", ar: "جمل الصلة" },
  },
  partizipattribut: {
    label: { tr: "Partizip sıfatları", en: "Participial attributes", de: "Partizipialattribute", es: "Atributos participiales", ar: "الصفات بصيغة اسم المفعول" },
  },
  praeposition: {
    label: { tr: "Edatlar", en: "Prepositions", de: "Präpositionen", es: "Preposiciones", ar: "حروف الجر" },
  },
  "genitiv.praeposition": {
    parent: "praeposition",
    label: { tr: "Genitiv edatları", en: "Genitive prepositions", de: "Genitivpräpositionen", es: "Preposiciones con genitivo", ar: "حروف الجر مع الجينيتيف" },
  },
  wechselpraeposition: {
    parent: "praeposition",
    label: { tr: "Dativ/Akkusativ edatları (Wechselpräpositionen)", en: "Two-way prepositions", de: "Wechselpräpositionen", es: "Preposiciones de doble caso", ar: "حروف الجر مع حالتين (Wechselpräpositionen)" },
  },
  konjunktiv2: {
    label: { tr: "Konjunktiv II", en: "Subjunctive II", de: "Konjunktiv II", es: "Subjuntivo II", ar: "Konjunktiv II" },
  },
  "konjunktiv2.vergangenheit": {
    parent: "konjunktiv2",
    label: { tr: "Konjunktiv II geçmiş", en: "Subjunctive II past", de: "Konjunktiv II der Vergangenheit", es: "Subjuntivo II pasado", ar: "Konjunktiv II في الماضي" },
  },
  modalverb: {
    label: { tr: "Modal fiiller", en: "Modal verbs", de: "Modalverben", es: "Verbos modales", ar: "الأفعال الناقصة (Modalverben)" },
  },
  modalverb_subjektiv: {
    parent: "modalverb",
    label: { tr: "Modal fiillerin öznel kullanımı", en: "Subjective modal verbs", de: "Subjektiver Gebrauch der Modalverben", es: "Uso subjetivo de los modales", ar: "الاستخدام الذاتي للأفعال الناقصة (Modalverben)" },
  },
  dativ: {
    label: { tr: "Dativ", en: "Dative", de: "Dativ", es: "Dativo", ar: "حالة الجر (Dativ)" },
  },
  akkusativ: {
    label: { tr: "Akkusativ", en: "Accusative", de: "Akkusativ", es: "Acusativo", ar: "حالة النصب (Akkusativ)" },
  },
  perfekt: {
    label: { tr: "Perfekt", en: "Present perfect", de: "Perfekt", es: "Pretérito perfecto", ar: "الماضي التام (Perfekt)" },
  },
  praeteritum: {
    label: { tr: "Präteritum", en: "Simple past", de: "Präteritum", es: "Pretérito simple", ar: "الماضي البسيط (Präteritum)" },
  },
  passiv: {
    label: { tr: "Edilgen çatı", en: "Passive voice", de: "Passiv", es: "Voz pasiva", ar: "المبني للمجهول" },
  },
  gist: {
    label: { tr: "Ana fikri anlama", en: "Main idea", de: "Globalverstehen", es: "Idea principal", ar: "فهم الفكرة الرئيسية" },
  },
  detail: {
    label: { tr: "Ayrıntıyı anlama", en: "Detail", de: "Detailverstehen", es: "Información detallada", ar: "فهم التفاصيل" },
  },
  inference: {
    label: { tr: "Çıkarım yapma", en: "Inference", de: "Schlussfolgern", es: "Inferencia", ar: "الاستنتاج" },
  },
  vocabulary: {
    label: { tr: "Kelime bilgisi", en: "Vocabulary", de: "Wortschatz", es: "Vocabulario", ar: "المفردات" },
  },
  structure: {
    label: { tr: "Metin yapısı", en: "Text structure", de: "Textstruktur", es: "Estructura del texto", ar: "بنية النص" },
  },
  attitude: {
    label: { tr: "Konuşmacının tutumu", en: "Speaker's attitude", de: "Einstellung des Sprechers", es: "Actitud del hablante", ar: "موقف المتحدث" },
  },
  adjektiv: {
    label: { tr: "Sıfatlar", en: "Adjectives", de: "Adjektive", es: "Adjetivos", ar: "الصفات" },
  },
  "adjektiv.komparativ": {
    parent: "adjektiv",
    label: { tr: "Karşılaştırma (Komparativ)", en: "Comparative", de: "Komparativ", es: "Comparativo", ar: "صيغة المقارنة (Komparativ)" },
  },
  adjektivendung: {
    parent: "adjektiv",
    label: { tr: "Sıfat takıları", en: "Adjective endings", de: "Adjektivendungen", es: "Terminaciones del adjetivo", ar: "نهايات الصفات (Adjektivendungen)" },
  },
  artikel: {
    label: { tr: "Artikeller", en: "Articles", de: "Artikel", es: "Artículos", ar: "أدوات التعريف" },
  },
  "artikel.nominativ": {
    parent: "artikel",
    label: { tr: "Artikel (Nominativ)", en: "Articles in the nominative", de: "Artikel im Nominativ", es: "Artículos en nominativo", ar: "أداة التعريف في حالة الرفع (Nominativ)" },
  },
  "artikel.akkusativ": {
    parent: "artikel",
    label: { tr: "Artikel (Akkusativ)", en: "Articles in the accusative", de: "Artikel im Akkusativ", es: "Artículos en acusativo", ar: "أداة التعريف في حالة النصب (Akkusativ)" },
  },
  possessiv: {
    label: { tr: "İyelik zamirleri", en: "Possessive articles", de: "Possessivartikel", es: "Posesivos", ar: "أدوات الملكية" },
  },
  "possessiv.nominativ": {
    parent: "possessiv",
    label: { tr: "İyelik zamirleri (Nominativ)", en: "Possessives in the nominative", de: "Possessivartikel im Nominativ", es: "Posesivos en nominativo", ar: "أدوات الملكية في حالة الرفع (Nominativ)" },
  },
  "possessiv.akkusativ": {
    parent: "possessiv",
    label: { tr: "İyelik zamirleri (Akkusativ)", en: "Possessives in the accusative", de: "Possessivartikel im Akkusativ", es: "Posesivos en acusativo", ar: "أدوات الملكية في حالة النصب (Akkusativ)" },
  },
  negation: {
    label: { tr: "Olumsuzluk", en: "Negation", de: "Negation", es: "Negación", ar: "النفي" },
  },
  "negation.kein": {
    parent: "negation",
    label: { tr: "kein ile olumsuzluk", en: "Negation with kein", de: "Negation mit kein", es: "Negación con kein", ar: "النفي بـ kein" },
  },
  "negation.akkusativ": {
    parent: "negation",
    label: { tr: "Akkusativ ile olumsuzluk", en: "Negation in the accusative", de: "Negation im Akkusativ", es: "Negación en acusativo", ar: "النفي في حالة النصب (Akkusativ)" },
  },
  funktionsverbgefuege: {
    label: { tr: "Fonksiyon fiili birleşimleri", en: "Light-verb constructions", de: "Funktionsverbgefüge", es: "Construcciones con verbo de apoyo", ar: "تراكيب الأفعال الوظيفية (Funktionsverbgefüge)" },
  },
  geschweige_denn: {
    parent: "konnektor",
    label: { tr: "geschweige denn", en: "geschweige denn (let alone)", de: "geschweige denn", es: "geschweige denn (y mucho menos)", ar: "geschweige denn" },
  },
  idiomatik: {
    label: { tr: "Deyimler", en: "Idioms", de: "Idiomatik", es: "Modismos", ar: "التعبيرات الاصطلاحية" },
  },
  imperativ: {
    label: { tr: "Emir kipi", en: "Imperative", de: "Imperativ", es: "Imperativo", ar: "صيغة الأمر (Imperativ)" },
  },
  "imperativ.du": {
    parent: "imperativ",
    label: { tr: "Emir kipi (du)", en: "Imperative (du)", de: "Imperativ (du)", es: "Imperativo (du)", ar: "صيغة الأمر مع du" },
  },
  "imperativ.sie": {
    parent: "imperativ",
    label: { tr: "Emir kipi (Sie)", en: "Imperative (Sie)", de: "Imperativ (Sie)", es: "Imperativo (Sie)", ar: "صيغة الأمر مع Sie" },
  },
  infinitiv: {
    label: { tr: "Mastar yapıları", en: "Infinitive constructions", de: "Infinitivkonstruktionen", es: "Construcciones de infinitivo", ar: "تراكيب المصدر (Infinitiv)" },
  },
  "infinitiv.ohnezu": {
    parent: "infinitiv",
    label: { tr: "ohne ... zu", en: "ohne ... zu", de: "ohne ... zu", es: "ohne ... zu (sin + infinitivo)", ar: "ohne ... zu" },
  },
  "infinitiv.umzu": {
    parent: "infinitiv",
    label: { tr: "um ... zu", en: "um ... zu", de: "um ... zu", es: "um ... zu (para + infinitivo)", ar: "um ... zu" },
  },
  konditional_inversion: {
    label: { tr: "Eğer cümlelerinde devrik yapı", en: "Conditional inversion", de: "Konditionale Inversion", es: "Inversión condicional", ar: "القلب الشرطي (Konditionale Inversion)" },
  },
  "konjunktiv2.modal": {
    parent: "konjunktiv2",
    label: { tr: "Modal fiillerle Konjunktiv II", en: "Subjunctive II with modal verbs", de: "Konjunktiv II der Modalverben", es: "Subjuntivo II de los modales", ar: "Konjunktiv II مع الأفعال الناقصة" },
  },
  "konnektor.als_wenn": {
    parent: "konnektor",
    label: { tr: "als / wenn", en: "als / wenn", de: "als / wenn", es: "als / wenn", ar: "als / wenn" },
  },
  "konnektor.konzessiv": {
    parent: "konnektor",
    label: { tr: "Karşıtlık bağlaçları", en: "Concessive connectors", de: "Konzessive Konnektoren", es: "Conectores concesivos", ar: "أدوات الربط التنازلية" },
  },
  "konnektor.modal": {
    parent: "konnektor",
    label: { tr: "Tarz bağlaçları", en: "Connectors of manner", de: "Modale Konnektoren", es: "Conectores modales", ar: "أدوات الربط الدالة على الكيفية" },
  },
  "konnektor.zweiteilig": {
    parent: "konnektor",
    label: { tr: "İkili bağlaçlar", en: "Two-part connectors", de: "Zweiteilige Konnektoren", es: "Conectores de dos partes", ar: "أدوات الربط المزدوجة" },
  },
  lexik_nuance: {
    parent: "vocabulary",
    label: { tr: "Anlam inceliği", en: "Shades of meaning", de: "Bedeutungsnuancen", es: "Matices de significado", ar: "الفروق الدقيقة في المعنى" },
  },
  "modalverb.konjugation": {
    parent: "modalverb",
    label: { tr: "Modal fiillerin çekimi", en: "Modal verb forms", de: "Konjugation der Modalverben", es: "Conjugación de los modales", ar: "تصريف الأفعال الناقصة (Modalverben)" },
  },
  "modalverb.satzklammer": {
    parent: "modalverb",
    label: { tr: "Modal fiillerle cümle yapısı", en: "Modal verbs and sentence frame", de: "Modalverben und Satzklammer", es: "Modales y estructura de la oración", ar: "الأفعال الناقصة وبنية الجملة (Satzklammer)" },
  },
  n_deklination: {
    label: { tr: "n-Deklination", en: "N-declension", de: "n-Deklination", es: "Declinación en -n", ar: "تصريف الأسماء بنهاية n (n-Deklination)" },
  },
  nebensatz: {
    label: { tr: "Yan cümleler", en: "Subordinate clauses", de: "Nebensätze", es: "Oraciones subordinadas", ar: "الجمل الفرعية (Nebensätze)" },
  },
  nominalisierung: {
    label: { tr: "İsimleştirme", en: "Nominalisation", de: "Nominalisierung", es: "Nominalización", ar: "التسمية (Nominalisierung)" },
  },
  paraphrase: {
    label: { tr: "Başka sözcüklerle ifade", en: "Paraphrasing", de: "Umschreibung", es: "Paráfrasis", ar: "إعادة الصياغة" },
  },
  "passiv.modal": {
    parent: "passiv",
    label: { tr: "Modal fiillerle edilgen", en: "Passive with modal verbs", de: "Passiv mit Modalverben", es: "Pasiva con modales", ar: "المبني للمجهول مع الأفعال الناقصة" },
  },
  "passiv.perfekt": {
    parent: "passiv",
    label: { tr: "Edilgen çatı (Perfekt)", en: "Passive in the perfect", de: "Passiv im Perfekt", es: "Pasiva en perfecto", ar: "المبني للمجهول في الماضي التام (Perfekt)" },
  },
  "passiv.praesens": {
    parent: "passiv",
    label: { tr: "Edilgen çatı (Präsens)", en: "Passive in the present", de: "Passiv im Präsens", es: "Pasiva en presente", ar: "المبني للمجهول في المضارع (Präsens)" },
  },
  passiversatz: {
    parent: "passiv",
    label: { tr: "Edilgen yerine kullanılan yapılar", en: "Passive substitutes", de: "Passiversatzformen", es: "Sustitutos de la pasiva", ar: "بدائل المبني للمجهول (Passiversatzformen)" },
  },
  "perfekt.hilfsverb": {
    parent: "perfekt",
    label: { tr: "Perfekt yardımcı fiili", en: "Perfect auxiliary", de: "Hilfsverb im Perfekt", es: "Auxiliar del perfecto", ar: "الفعل المساعد في Perfekt" },
  },
  "perfekt.partizip": {
    parent: "perfekt",
    label: { tr: "Partizip II", en: "Past participle", de: "Partizip II", es: "Participio", ar: "اسم المفعول (Partizip II)" },
  },
  plural: {
    label: { tr: "Çoğul", en: "Plural", de: "Plural", es: "Plural", ar: "الجمع" },
  },
  plusquamperfekt: {
    label: { tr: "Plusquamperfekt", en: "Past perfect", de: "Plusquamperfekt", es: "Pluscuamperfecto", ar: "الماضي البعيد (Plusquamperfekt)" },
  },
  "praeposition.ort": {
    parent: "praeposition",
    label: { tr: "Yer edatları", en: "Prepositions of place", de: "Lokale Präpositionen", es: "Preposiciones de lugar", ar: "حروف الجر للمكان" },
  },
  "praeposition.zeit": {
    parent: "praeposition",
    label: { tr: "Zaman edatları", en: "Prepositions of time", de: "Temporale Präpositionen", es: "Preposiciones de tiempo", ar: "حروف الجر للزمان" },
  },
  praepositionaladverb: {
    label: { tr: "Edat zarfları", en: "Prepositional adverbs", de: "Pronominaladverbien", es: "Adverbios preposicionales", ar: "الظروف الجارة (Pronominaladverbien)" },
  },
  praesens: {
    label: { tr: "Präsens", en: "Present tense", de: "Präsens", es: "Presente", ar: "المضارع (Präsens)" },
  },
  "praesens.haben": {
    parent: "praesens",
    label: { tr: "haben (Präsens)", en: "haben in the present", de: "haben im Präsens", es: "haben en presente", ar: "haben في المضارع" },
  },
  "praesens.sein": {
    parent: "praesens",
    label: { tr: "sein (Präsens)", en: "sein in the present", de: "sein im Präsens", es: "sein en presente", ar: "sein في المضارع" },
  },
  "praesens.regelmaessig": {
    parent: "praesens",
    label: { tr: "Düzenli fiiller (Präsens)", en: "Regular verbs in the present", de: "Regelmäßige Verben im Präsens", es: "Verbos regulares en presente", ar: "الأفعال المنتظمة في المضارع" },
  },
  "praesens.vokalwechsel": {
    parent: "praesens",
    label: { tr: "Ünlü değişimli fiiller (Präsens)", en: "Stem-vowel change in the present", de: "Vokalwechsel im Präsens", es: "Cambio vocálico en presente", ar: "تغيّر حرف العلة في المضارع" },
  },
  reflexiv: {
    label: { tr: "Dönüşlü fiiller", en: "Reflexive verbs", de: "Reflexive Verben", es: "Verbos reflexivos", ar: "الأفعال الانعكاسية" },
  },
  rektion: {
    label: { tr: "Fiil ve edat bağlantısı", en: "Verb government", de: "Rektion", es: "Régimen verbal", ar: "تعدية الأفعال (Rektion)" },
  },
  verb_praeposition: {
    parent: "rektion",
    label: { tr: "Fiil + edat", en: "Verb + preposition", de: "Verb mit Präposition", es: "Verbo + preposición", ar: "الفعل مع حرف الجر" },
  },
  "relativsatz.praeposition": {
    parent: "relativsatz",
    label: { tr: "Edatlı ilgi cümleleri", en: "Relative clauses with a preposition", de: "Relativsätze mit Präposition", es: "Oraciones de relativo con preposición", ar: "جمل الصلة مع حرف الجر" },
  },
  "relativsatz.was": {
    parent: "relativsatz",
    label: { tr: "was ile ilgi cümleleri", en: "Relative clauses with was", de: "Relativsätze mit was", es: "Oraciones de relativo con was", ar: "جمل الصلة مع was" },
  },
  uhrzeit: {
    label: { tr: "Saat", en: "Telling the time", de: "Uhrzeit", es: "La hora", ar: "الوقت (Uhrzeit)" },
  },
  trennbares_verb: {
    label: { tr: "Ayrılabilen fiiller", en: "Separable verbs", de: "Trennbare Verben", es: "Verbos separables", ar: "الأفعال المنفصلة (Trennbare Verben)" },
  },
  wfrage: {
    label: { tr: "Soru sözcükleri", en: "Question words", de: "W-Fragen", es: "Preguntas con palabra interrogativa", ar: "أسئلة W (W-Fragen)" },
  },
  wortbildung: {
    label: { tr: "Sözcük türetme", en: "Word formation", de: "Wortbildung", es: "Formación de palabras", ar: "تكوين الكلمات (Wortbildung)" },
  },
  wortstellung: {
    label: { tr: "Sözcük sırası", en: "Word order", de: "Wortstellung", es: "Orden de las palabras", ar: "ترتيب الكلمات (Wortstellung)" },
  },
  "wortstellung.inversion": {
    parent: "wortstellung",
    label: { tr: "Devrik cümle", en: "Inversion", de: "Inversion", es: "Inversión", ar: "القلب (Inversion)" },
  },
  notes: {
    label: { tr: "Not alma", en: "Note-taking", de: "Notizen machen", es: "Tomar notas", ar: "تدوين الملاحظات" },
  },
  cloze: {
    format: true,
    label: { tr: "Boşluklu metin", en: "Text with gaps", de: "Lückentext", es: "Texto con huecos", ar: "نص به فراغات" },
  },
  wordbank: {
    format: true,
    label: { tr: "Kelime kutusu", en: "Word box", de: "Wortkasten", es: "Cuadro de palabras", ar: "صندوق الكلمات" },
  },
  open: {
    format: true,
    label: { tr: "Açık boşluklar", en: "Open gaps", de: "Offener Lückentext", es: "Huecos abiertos", ar: "فراغات مفتوحة" },
  },
  ctest: {
    format: true,
    label: { tr: "Kelime tamamlama (C-test)", en: "Word completion (C-test)", de: "C-Test", es: "Completar palabras (C-test)", ar: "إكمال الكلمات (C-Test)" },
  },
  // Topics first used by the course tests (spec 2026-10-28), one file per level.
  ...A1_COURSE_TOPICS,
  ...A2_COURSE_TOPICS,
  ...B1_COURSE_TOPICS,
  ...B2_COURSE_TOPICS,
};

/** Old or drifted spellings to their catalog id. */
export const TAG_ALIASES: Record<string, TopicId> = {
  konnektoren: "konnektor",
  konjunktiv1: "konjunktiv_i",
  relativsaetze: "relativsatz",
  partizipialattribut: "partizipattribut",
  genitivpraepositionen: "genitiv.praeposition",
  praeposition_genitiv: "genitiv.praeposition",
  konjunktiv2_vergangenheit: "konjunktiv2.vergangenheit",
  modalverben_subjektiv: "modalverb_subjektiv",
  adjektivdeklination: "adjektivendung",
  komparativ: "adjektiv.komparativ",
  konjunktiv2_modal: "konjunktiv2.modal",
  "konnektor.als-wenn": "konnektor.als_wenn",
  konzessiv: "konnektor.konzessiv",
  nominalstil: "nominalisierung",
  praepositionen: "praeposition",
  praepositionaladverbien: "praepositionaladverb",
  pronominaladverb: "praepositionaladverb",
  reflexivpronomen: "reflexiv",
  "verb-praeposition": "verb_praeposition",
  "n-deklination": "n_deklination",
  "verb.trennbar": "trennbares_verb",
};

const SECTION_PREFIXES = ["grammar.", "reading.", "listening.", "writing.", "speaking."];

/** "grammar.konnektoren" -> "konnektor": drops the section prefix ("grammar.", "reading.", "listening.",
 *  "writing.", "speaking."), lower-cases, applies TAG_ALIASES. Returns the bare id even if not in TOPICS. */
export function topicOf(tagOrTopic: string): TopicId {
  let id = tagOrTopic.trim().toLowerCase();
  for (const prefix of SECTION_PREFIXES) {
    if (id.startsWith(prefix)) {
      id = id.slice(prefix.length);
      break;
    }
  }
  return Object.prototype.hasOwnProperty.call(TAG_ALIASES, id) ? TAG_ALIASES[id] : id;
}

/** Label in the student's language, falling back to en, then null when the id is unknown. Rolls a
 *  subtopic up to its parent only when `rollUp` is true. */
export function topicLabel(
  tagOrTopic: string,
  locale: CandidateLocale,
  opts?: { rollUp?: boolean; /** Lookup to read instead of TOPICS (tests). */ catalog?: Record<TopicId, Topic> },
): string | null {
  const catalog = opts?.catalog ?? TOPICS;
  let id = topicOf(tagOrTopic);
  if (!Object.prototype.hasOwnProperty.call(catalog, id)) return null;
  if (opts?.rollUp) {
    const parent = catalog[id].parent;
    if (parent && Object.prototype.hasOwnProperty.call(catalog, parent)) id = parent;
  }
  const label = catalog[id].label;
  return label[locale] || label.en || null;
}

/** Whether the tag or topic resolves to a task format ("Text with gaps"), which the analysis shows apart from topics. */
export function isFormatTopic(tagOrTopic: string): boolean {
  const id = topicOf(tagOrTopic);
  return Object.prototype.hasOwnProperty.call(TOPICS, id) && TOPICS[id].format === true;
}
