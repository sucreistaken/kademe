import type { BlueprintConfig } from "../blueprint";
import type { Cefr } from "../types";
import { COURSE_TESTS } from "./catalog";
import { courseBlueprint, courseMaxPoints } from "./config";
import { courseKeyOfTemplate, courseTemplateKey } from "./template-keys";
import { COURSE_KEYS, type CourseKey, type CourseTestKind } from "./types";

/**
 * The eight course tests as ready exams (spec 2026-10-28, "Engine": one
 * template per course test, published on the first invite by
 * `ensureTemplateBlueprint`). Kept apart from EXAM_TEMPLATES on purpose: the
 * exam wizard, the AI exam creator and the template simulations list that
 * array, and a course test is neither copied nor edited nor drawn from the
 * bank. `readyTemplateByKey` (templates.ts) finds both kinds for an invite.
 *
 * The panel names exist in Turkish, English and German. The student always
 * reads the German name (`germanName`): a proper name, like "Goethe-Zertifikat",
 * never translated (candidate-exam-name.ts maps any of the stored names to it).
 */

export type Text3 = { tr: string; en: string; de: string };

export type CourseExamTemplate = {
  /** The ready-exam key, `courseTemplateKey(courseKey)`: "course-b1-1". An invite picks it as `template:<key>`. */
  key: string;
  courseKey: CourseKey;
  kind: CourseTestKind;
  level: Cefr;
  mode: "COURSE_TEST";
  /** "Zwischentest B1.1" / "Abschlusstest B1": what the student and the German report show. Equals `name.de`. */
  germanName: string;
  name: Text3;
  summary: Text3;
  /** The scored points of one form. */
  points: number;
  config: BlueprintConfig;
};

const NAME_PREFIX: Record<CourseTestKind, Omit<Text3, "de">> = {
  INTERIM: { tr: "Kurs ara sınavı", en: "Mid-course test" },
  FINAL: { tr: "Kurs sonu sınavı", en: "End-of-course test" },
};

/** What the test covers, for the summary: Netzwerk neu's chapters, or the CEFR topic list at B2 (no coursebook). */
function scopeOf(key: CourseKey): Text3 {
  const { kind, level } = COURSE_TESTS[key];
  if (level === "B2") {
    return kind === "INTERIM"
      ? { tr: "B2 konu listesinin ilk yarısı", en: "first half of the B2 topic list", de: "erste Hälfte der B2-Themenliste" }
      : { tr: "B2 konu listesinin tamamı", en: "the whole B2 topic list", de: "gesamte B2-Themenliste" };
  }
  const book = `Netzwerk neu ${level}, Kapitel ${kind === "INTERIM" ? "1-6" : "1-12"}`;
  return { tr: book, en: book, de: book };
}

function summaryOf(key: CourseKey, points: number): Text3 {
  const interim = COURSE_TESTS[key].kind === "INTERIM";
  const scope = scopeOf(key);
  return {
    tr: `${interim ? "Kursun ilk yarısının sonunda yapılır" : "Kursun sonunda yapılır"} (${scope.tr}). Okuma, dilbilgisi (Sprachbausteine), dinleme, yazma ve konuşma; toplam ${points} puan. Her öğrenci A veya B formundan birini çözer.${interim ? "" : " Geçemeyen öğrenci için hangi kursa döneceği önerilir."} Yazma ve konuşma puanlarını yapay zeka önerir, öğretmen onaylar.`,
    en: `${interim ? "Taken at the end of the first half of the level" : "Taken at the end of the level"} (${scope.en}). Reading, grammar (Sprachbausteine), listening, writing and speaking; ${points} points in all. Each student sits form A or B.${interim ? "" : " A student who does not pass is advised which course to join next."} The AI proposes the writing and speaking points; a teacher confirms them.`,
    de: `${interim ? "Am Ende der ersten Kurshälfte" : "Am Ende des Kurses"} (${scope.de}). Lesen, Sprachbausteine, Hören, Schreiben und Sprechen; insgesamt ${points} Punkte. Jede Person schreibt Form A oder B.${interim ? "" : " Wer nicht besteht, erhält eine Empfehlung, in welchem Kurs es weitergeht."} Die KI schlägt die Punkte für Schreiben und Sprechen vor, die Lehrkraft bestätigt sie.`,
  };
}

function templateOf(courseKey: CourseKey): CourseExamTemplate {
  const test = COURSE_TESTS[courseKey];
  const points = courseMaxPoints(courseKey);
  return {
    key: courseTemplateKey(courseKey),
    courseKey,
    kind: test.kind,
    level: test.level,
    mode: "COURSE_TEST",
    germanName: test.germanName,
    name: { tr: `${NAME_PREFIX[test.kind].tr} ${courseKey}`, en: `${NAME_PREFIX[test.kind].en} ${courseKey}`, de: test.germanName },
    summary: summaryOf(courseKey, points),
    points,
    config: courseBlueprint(courseKey),
  };
}

const TEMPLATES: readonly CourseExamTemplate[] = COURSE_KEYS.map(templateOf);

/** Copies, so a caller that edits a config never changes the template. In catalog order: A1.1, A1, A2.1, A2, B1.1, B1, B2.1, B2. */
export const COURSE_EXAM_TEMPLATES: CourseExamTemplate[] = TEMPLATES.map((t) => structuredClone(t));

export function courseExamTemplate(key: CourseKey): CourseExamTemplate {
  return structuredClone(TEMPLATES.find((t) => t.courseKey === key)!);
}

/** The course template with this ready-exam key ("course-b1-1"), or null. */
export function courseExamTemplateByKey(templateKey: string): CourseExamTemplate | null {
  const key = courseKeyOfTemplate(templateKey);
  return key ? courseExamTemplate(key) : null;
}

/**
 * The German name a stored exam name stands for, or null. An invitation
 * stores the template's name in the manager's language ("Kurs ara sınavı
 * B1.1"); the student reads "Zwischentest B1.1" whatever their own language.
 */
export function courseGermanNameOf(stored: string): string | null {
  const t = TEMPLATES.find((x) => x.name.tr === stored || x.name.en === stored || x.name.de === stored);
  return t ? t.germanName : null;
}
