import path from "node:path";
import { COURSE_TESTS } from "@/lib/exam/course/catalog";
import { courseFormKey } from "@/lib/exam/course/types";
import type { RawAnswers } from "./blind-answers";
import { compareBlind, formatSectionTally, renderBlindFile } from "./blind-report";
import { courseBlindFileName, courseBlindItems, selectCourseForms } from "./blind-items";
import type { SeedCourseForm } from "./course-tests/types";

/**
 * The course test forms' side of `pnpm bank:blind-export` and
 * `bank:blind-compare` (`--course <key>:<form>` or `all`, spec 2026-10-28):
 * what to write and what to print, without touching a file, so it can be tested.
 * The forms come from the seed (COURSE_FORMS_SEED); no database is needed.
 */

export type CourseExport = { formKey: string; file: string; text: string; items: number };

export const NO_COURSE_FORMS = "There are no course forms in the seed yet.";

/** The files `bank:blind-export --course` writes: one per selected form, named after it unless `out` names the file. */
export function courseExports(spec: string, forms: readonly SeedCourseForm[], options: { out?: string; outDir?: string } = {}): CourseExport[] {
  const selected = selectCourseForms(spec, forms);
  if (options.out && selected.length > 1) throw new Error("--out names one file: with --course all use --out-dir <dir>");
  return selected.map((form) => {
    const formKey = courseFormKey(form.key, form.form);
    const items = courseBlindItems(form);
    const productive = form.sections.filter((s) => s.section === "WRITING" || s.section === "SPEAKING").reduce((n, s) => n + s.items.length, 0);
    const notes = [
      `This is a course test form in the order the students are served it (Lesen, Sprachbausteine, Hören). Its ${productive} writing and speaking tasks have no key and are not part of the blind solve.`,
    ];
    return {
      formKey,
      file: options.out ?? path.join(options.outDir ?? ".", courseBlindFileName(form)),
      text: renderBlindFile(`Blind solve: ${COURSE_TESTS[form.key].germanName}, Form ${form.form} (${formKey})`, items, notes),
      items: items.length,
    };
  });
}

/**
 * What `bank:blind-compare --course` prints: per form the report of each item
 * (the engine's own scoring), the tally of every section in scored units (a
 * gap, a statement or a row is a unit, as in the test's points) and the
 * totals; then the keys of the answers file that belong to none of the
 * selected forms.
 */
export function courseComparison(spec: string, forms: readonly SeedCourseForm[], raw: RawAnswers): string[] {
  const selected = selectCourseForms(spec, forms);
  if (selected.length === 0) return [`${NO_COURSE_FORMS} Nothing to compare.`];
  const out: string[] = [];
  const known = new Set<string>();
  for (const form of selected) {
    const items = courseBlindItems(form);
    for (const i of items) known.add(i.seedKey);
    const r = compareBlind(items, raw);
    out.push(`\n== ${COURSE_TESTS[form.key].germanName}, Form ${form.form} (${courseFormKey(form.key, form.form)})`);
    out.push(...r.lines);
    for (const t of r.sections) out.push(`  ${formatSectionTally(t)}`);
    out.push(`  ${items.length} items: ${r.agree} agree, ${r.disagree} disagree, ${r.unanswered} unanswered`);
  }
  for (const k of raw.keys()) {
    if (!known.has(k)) out.push(`UNKNOWN KEY in answers file (not an objective item of the selected course form${selected.length > 1 ? "s" : ""}): ${k}`);
  }
  return out;
}
