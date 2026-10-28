import type { BankCount, BlueprintConfig, CoverageRow } from "../blueprint";
import { isObjectiveSection, type Cefr, type ItemContent, type ItemKey, type Section } from "../types";
import { COURSE_TESTS, courseSections } from "./catalog";
import { courseFormKey, COURSE_FORMS, parseCourseFormKey } from "./types";
import { courseUnits } from "./units";

/**
 * Whether the bank holds both parallel forms of a course test (spec
 * 2026-10-28): for every section of the test, each form has exactly the
 * catalog's scored units (writing and speaking: tasks), counting approved
 * items only (a listening item also needs its clip's audio, as everywhere
 * else). Exactly, not at least: the form's maximum points are the catalog's,
 * so a form with a missing or an extra item is refused here instead of being
 * served and scored against the wrong maximum. Pure; the counts come from
 * `bankCounts` (server/panel.ts), which carries the course rows.
 */
export function courseCoverage(counts: BankCount[], cfg: BlueprintConfig): { ok: boolean; rows: CoverageRow[] } {
  const course = cfg.course;
  // A COURSE_TEST blueprint without its course cannot be served at all.
  if (!course) return { ok: false, rows: [] };
  const level = COURSE_TESTS[course.key].level;
  const plans = courseSections(course.key);
  const rows: CoverageRow[] = [];
  for (const form of COURSE_FORMS) {
    const formKey = courseFormKey(course.key, form);
    for (const s of cfg.sections.filter((x) => x.enabled)) {
      const plan = plans.find((p) => p.section === s.section);
      if (!plan) continue;
      const have = counts.filter((c) => c.courseForm === formKey && c.section === s.section);
      const items = have.reduce((n, c) => n + c.items, 0);
      // Objective sections are worth their scored units (a cloze text is one item with several gaps); a task is one item.
      const available = isObjectiveSection(s.section) ? have.reduce((n, c) => n + (c.points ?? c.items), 0) : items;
      const testlet = s.section === "READING" || s.section === "LISTENING";
      rows.push({
        section: s.section,
        level,
        needed: plan.units,
        available,
        ...(testlet ? { units: have.reduce((n, c) => n + c.stimuli, 0) } : {}),
        courseForm: formKey,
        ok: available === plan.units,
      });
    }
  }
  return { ok: rows.every((r) => r.ok), rows };
}

/** One approved course item as the counting query reads it. */
export type CourseCountRow = {
  courseForm: string | null;
  section: Section;
  level: Cefr;
  content: ItemContent;
  answerKey: ItemKey;
  stimulusId: string | null;
  audioKey: string | null;
};

/**
 * `BankCount` rows for the course forms: one per form, section and level,
 * with the items, their scored units (`points`) and the texts they sit on.
 * A listening item without audio is not servable and is not counted; a row
 * whose form key is not a course form is ignored.
 */
export function foldCourseCounts(rows: readonly CourseCountRow[]): BankCount[] {
  const groups = new Map<string, { count: BankCount; stimuli: Set<string> }>();
  for (const r of rows) {
    const parsed = r.courseForm ? parseCourseFormKey(r.courseForm) : null;
    if (!r.courseForm || !parsed) continue;
    if (r.section === "LISTENING" && !r.audioKey) continue;
    const id = `${r.courseForm}|${r.section}|${r.level}`;
    let group = groups.get(id);
    if (!group) {
      group = { count: { section: r.section, level: r.level, items: 0, stimuli: 0, courseForm: courseFormKey(parsed.key, parsed.form), points: 0 }, stimuli: new Set() };
      groups.set(id, group);
    }
    group.count.items += 1;
    group.count.points = (group.count.points ?? 0) + courseUnits({ content: r.content, key: r.answerKey });
    if (r.stimulusId) group.stimuli.add(r.stimulusId);
    group.count.stimuli = group.stimuli.size;
  }
  return [...groups.values()].map((g) => g.count);
}
