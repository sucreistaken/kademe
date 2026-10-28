import type { Topic, TopicId } from "../topics";

/** Topics first used by the A2 course tests; merged into TOPICS. Ids must not repeat an id of topics.ts. */
export const A2_COURSE_TOPICS: Record<TopicId, Topic> = {
  "adjektiv.superlativ": {
    parent: "adjektiv",
    label: { tr: "En üstünlük (Superlativ)", en: "Superlative", de: "Superlativ", es: "Superlativo", ar: "صيغة التفضيل العليا (Superlativ)" },
  },
  werden: {
    label: { tr: "werden fiili", en: "The verb werden", de: "Das Verb „werden“", es: "El verbo werden", ar: "الفعل werden" },
  },
  "nebensatz.indirekte_frage": {
    parent: "nebensatz",
    label: { tr: "Dolaylı soru cümleleri", en: "Indirect questions", de: "Indirekte Fragesätze", es: "Preguntas indirectas", ar: "الأسئلة غير المباشرة" },
  },
  indefinitpronomen: {
    label: {
      tr: "Belgisiz zamirler (man, jemand, etwas ...)",
      en: "Indefinite pronouns (man, jemand, etwas ...)",
      de: "Indefinitpronomen (man, jemand, etwas ...)",
      es: "Pronombres indefinidos (man, jemand, etwas ...)",
      ar: "الضمائر غير المحددة (man, jemand, etwas ...)",
    },
  },
};
