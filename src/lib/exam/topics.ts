import type { CandidateLocale } from "@/i18n/locale";

export type TopicId = string;
export type Topic = { parent?: TopicId; label: Record<CandidateLocale, string> };

/** The catalog. Grows with the bank; every seed tag and gap topic must resolve (a later test enforces it). */
export const TOPICS: Record<TopicId, Topic> = {
  konnektor: {
    label: { tr: "Bağlaçlar", en: "Connectors", de: "Konnektoren", es: "Conectores", ar: "أدوات الربط" },
  },
  konjunktiv_i: {
    label: { tr: "Konjunktiv I", en: "Subjunctive I", de: "Konjunktiv I", es: "Subjuntivo I", ar: "صيغة الشرط الأولى (Konjunktiv I)" },
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
    label: { tr: "Genitiv edatları", en: "Genitive prepositions", de: "Genitivpräpositionen", es: "Preposiciones con genitivo", ar: "حروف الجر مع المضاف إليه" },
  },
  wechselpraeposition: {
    parent: "praeposition",
    label: { tr: "Değişken edatlar", en: "Two-way prepositions", de: "Wechselpräpositionen", es: "Preposiciones mixtas", ar: "حروف الجر المتغيرة" },
  },
  konjunktiv2: {
    label: { tr: "Konjunktiv II", en: "Subjunctive II", de: "Konjunktiv II", es: "Subjuntivo II", ar: "صيغة الشرط الثانية (Konjunktiv II)" },
  },
  "konjunktiv2.vergangenheit": {
    parent: "konjunktiv2",
    label: { tr: "Konjunktiv II geçmiş", en: "Subjunctive II past", de: "Konjunktiv II der Vergangenheit", es: "Subjuntivo II pasado", ar: "Konjunktiv II في الماضي" },
  },
  modalverb: {
    label: { tr: "Modal fiiller", en: "Modal verbs", de: "Modalverben", es: "Verbos modales", ar: "الأفعال المساعدة" },
  },
  modalverb_subjektiv: {
    parent: "modalverb",
    label: { tr: "Modal fiillerin öznel kullanımı", en: "Subjective modal verbs", de: "Subjektiver Gebrauch der Modalverben", es: "Uso subjetivo de los modales", ar: "الاستخدام الذاتي للأفعال المساعدة" },
  },
  dativ: {
    label: { tr: "Dativ", en: "Dative", de: "Dativ", es: "Dativo", ar: "حالة المفعول به غير المباشر (Dativ)" },
  },
  akkusativ: {
    label: { tr: "Akkusativ", en: "Accusative", de: "Akkusativ", es: "Acusativo", ar: "حالة المفعول به المباشر (Akkusativ)" },
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
  opts?: { rollUp?: boolean },
): string | null {
  let id = topicOf(tagOrTopic);
  if (!Object.prototype.hasOwnProperty.call(TOPICS, id)) return null;
  if (opts?.rollUp) {
    const parent = TOPICS[id].parent;
    if (parent && Object.prototype.hasOwnProperty.call(TOPICS, parent)) id = parent;
  }
  const label = TOPICS[id].label;
  return label[locale] || label.en || null;
}
