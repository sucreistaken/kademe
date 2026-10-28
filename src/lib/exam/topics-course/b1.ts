import type { Topic, TopicId } from "../topics";

/** Topics first used by the B1 course tests; merged into TOPICS. Ids must not repeat an id of topics.ts. */
export const B1_COURSE_TOPICS: Record<TopicId, Topic> = {
  "infinitiv.zu": {
    parent: "infinitiv",
    label: { tr: "zu ile mastar", en: "Infinitive with zu", de: "Infinitiv mit „zu“", es: "Infinitivo con zu", ar: "المصدر مع zu" },
  },
  "passiv.praeteritum": {
    parent: "passiv",
    label: { tr: "Edilgen çatı (Präteritum)", en: "Passive in the simple past", de: "Passiv im Präteritum", es: "Pasiva en pretérito", ar: "المبني للمجهول في الماضي البسيط (Präteritum)" },
  },
};
