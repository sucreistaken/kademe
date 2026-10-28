import type { Section } from "../types";

/** What the plan needs of a course form's item: where it sits and, for a listening item, whether its clip has audio. */
export type CoursePlanRow = { id: string; courseOrder: number | null; orderInStimulus: number; audioKey: string | null };

/**
 * The item ids a course form serves in one section, in serving order
 * (spec 2026-10-28, "Engine"): the form's approved items of that section by
 * `course_order`, nothing drawn at random and nothing avoided because the
 * student met it before. An item without a position comes last; ties fall to
 * the item's place in its text and then its id, so two reads agree.
 * Listening items without audio are left out, as in the bank's pool: a
 * question the student cannot hear is worse than a short section (the
 * coverage check refuses such a form before it is ever invited).
 */
export function coursePlanOf(rows: readonly CoursePlanRow[], section: Section): string[] {
  const position = (r: CoursePlanRow) => r.courseOrder ?? Number.POSITIVE_INFINITY;
  return rows
    .filter((r) => section !== "LISTENING" || !!r.audioKey)
    .sort((a, b) => {
      if (position(a) !== position(b)) return position(a) < position(b) ? -1 : 1;
      if (a.orderInStimulus !== b.orderInStimulus) return a.orderInStimulus - b.orderInStimulus;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((r) => r.id);
}
