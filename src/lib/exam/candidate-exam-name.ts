import { candidateT } from "@/i18n/candidate";
import type { CandidateLocale } from "@/i18n/locale";
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
 */
export function candidateExamName(stored: string, locale: CandidateLocale): string {
  const t = candidateT(locale);
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
