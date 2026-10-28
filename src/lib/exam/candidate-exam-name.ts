import { candidateT } from "@/i18n/candidate";
import candidateTr from "@/i18n/messages/candidate.tr.json";
import candidateEn from "@/i18n/messages/candidate.en.json";
import type { CandidateLocale } from "@/i18n/locale";
import { courseGermanNameOf } from "@/lib/exam/course/templates";
import { EXAM_TEMPLATES, type ExamTemplateKey } from "@/lib/exam/templates";

/** The dictionary key (namespace `examNames`) that holds each template's name. */
const NAME_KEY = {
  "quick-screen": "quickScreen",
  placement: "placement",
  "level-check": "levelCheck",
} as const satisfies Record<ExamTemplateKey, string>;

/** The unit `defaultExamName` writes after the minutes, per manager language. */
const STORED_UNIT = { tr: "dk", en: "min" } as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The exam's name as the student reads it. A ready template names its exam in
 * the language the manager had open when it was published ("Yerleştirme
 * sınavı"), and the creator adds the length ("Placement test, 45 min"). That
 * stored text is the manager's, so a student in another language would read it
 * in the wrong one. When the stored name is still exactly a template's default
 * name in Turkish or English, with or without the length, the template's name
 * in the student's language is shown instead. A name the manager typed or
 * edited is shown as stored.
 *
 * A course test is the exception that needs no dictionary: "Zwischentest B1.1"
 * and "Abschlusstest B1" are proper names, so whatever language the manager's
 * panel stored ("Kurs ara sınavı B1.1", "Mid-course test B1.1"), every student
 * reads the German one.
 */
export function candidateExamName(stored: string, locale: CandidateLocale): string {
  const course = courseGermanNameOf(stored);
  if (course) return course;
  const t = candidateT(locale);
  // The exam the seed and the production setup create is named after this
  // dictionary entry, not after a template.
  if (stored === candidateTr.exam.titlePlacement || stored === candidateEn.exam.titlePlacement) {
    return t("exam.titlePlacement");
  }
  for (const template of EXAM_TEMPLATES) {
    const name = () => t(`examNames.${NAME_KEY[template.key]}`);
    for (const from of ["tr", "en"] as const) {
      const base = template.name[from];
      if (stored === base) return name();
      const withLength = stored.match(new RegExp(`^${escapeRegExp(base)}, (\\d+) ${STORED_UNIT[from]}$`));
      if (withLength) return `${name()}, ${t("exam.minutes", { n: Number(withLength[1]) })}`;
    }
  }
  return stored;
}
