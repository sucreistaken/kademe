import { COURSE_KEYS, type CourseKey } from "./types";

/**
 * The ready-exam template key of each course test (spec 2026-10-28): "B1.1"
 * -> "course-b1-1", "B1" -> "course-b1". An invite picks it as
 * `template:<key>` (exam-choice.ts) and `ensureTemplateBlueprint` publishes it.
 */
export const courseTemplateKey = (key: CourseKey): string => `course-${key.toLowerCase().replace(".", "-")}`;

export function courseKeyOfTemplate(templateKey: string): CourseKey | null {
  return COURSE_KEYS.find((k) => courseTemplateKey(k) === templateKey) ?? null;
}
