import type { Topic, TopicId } from "../topics";

/** Topics first used by the A1 course tests; merged into TOPICS. Ids must not repeat an id of topics.ts. */
export const A1_COURSE_TOPICS: Record<TopicId, Topic> = {
  // Netzwerk neu A1: "Verben und Personalpronomen" (Kapitel 1), Personalpronomen im Akkusativ (Kapitel 6) and im Dativ (Kapitel 11).
  personalpronomen: {
    label: { tr: "Kişi zamirleri", en: "Personal pronouns", de: "Personalpronomen", es: "Pronombres personales", ar: "الضمائر الشخصية (Personalpronomen)" },
  },
};
