import type { Topic, TopicId } from "../topics";

/** Topics first used by the B1 course tests; merged into TOPICS. Ids must not repeat an id of topics.ts. */
export const B1_COURSE_TOPICS: Record<TopicId, Topic> = {
  "infinitiv.zu": {
    parent: "infinitiv",
    label: { tr: "zu'lu mastar (Infinitiv mit zu)", en: "Infinitive with zu", de: "Infinitiv mit „zu“", es: "Infinitivo con zu", ar: "المصدر مع zu" },
  },
  "passiv.praeteritum": {
    parent: "passiv",
    label: { tr: "Edilgen çatı (Präteritum)", en: "Passive in the simple past", de: "Passiv im Präteritum", es: "Pasiva en pretérito", ar: "المبني للمجهول في الماضي البسيط (Präteritum)" },
  },
  "konnektor.kausal": {
    parent: "konnektor",
    label: { tr: "Sebep bağlaçları (weil, da)", en: "Causal connectors (weil, da)", de: "Kausale Konnektoren (weil, da)", es: "Conectores causales (weil, da)", ar: "أدوات الربط السببية (weil, da)" },
  },
  "konnektor.konsekutiv": {
    parent: "konnektor",
    label: { tr: "Sonuç bağlaçları (deshalb, so ... dass)", en: "Connectors of consequence (deshalb, so ... dass)", de: "Konsekutive Konnektoren (deshalb, so ... dass)", es: "Conectores consecutivos (deshalb, so ... dass)", ar: "أدوات الربط الدالة على النتيجة (deshalb, so ... dass)" },
  },
  "konnektor.final": {
    parent: "konnektor",
    label: { tr: "Amaç cümleleri (damit, um ... zu)", en: "Clauses of purpose (damit, um ... zu)", de: "Finalsätze (damit, um ... zu)", es: "Oraciones finales (damit, um ... zu)", ar: "جمل الغرض (damit, um ... zu)" },
  },
  lassen: {
    label: { tr: "lassen fiili (yaptırmak)", en: "The verb lassen", de: "Das Verb „lassen“", es: "El verbo lassen", ar: "الفعل lassen" },
  },
  futur: {
    label: { tr: "Gelecek zaman (Futur I)", en: "Future tense (Futur I)", de: "Futur I", es: "Futuro (Futur I)", ar: "زمن المستقبل (Futur I)" },
  },
};
