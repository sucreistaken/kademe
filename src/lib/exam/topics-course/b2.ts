import type { Topic, TopicId } from "../topics";

/** Topics first used by the B2 course tests; merged into TOPICS. Ids must not repeat an id of topics.ts. */
export const B2_COURSE_TOPICS: Record<TopicId, Topic> = {
  futur2: {
    label: {
      tr: "Futur II ve tahminler",
      en: "Future perfect and assumptions",
      de: "Futur II und Vermutungen",
      es: "Futuro perfecto y suposiciones",
      ar: "المستقبل التام والافتراضات (Futur II)",
    },
  },
  modalpartikel: {
    label: {
      tr: "Modal parçacıklar (Modalpartikeln)",
      en: "Modal particles",
      de: "Modalpartikeln",
      es: "Partículas modales",
      ar: "الأدوات الدالة على موقف المتحدث (Modalpartikeln)",
    },
  },
  nominal_verbalstil: {
    parent: "nominalisierung",
    label: {
      tr: "İsim ve fiil üslubu",
      en: "Nominal and verbal style",
      de: "Nominal- und Verbalstil",
      es: "Estilo nominal y estilo verbal",
      ar: "الأسلوب الاسمي والأسلوب الفعلي",
    },
  },
};
