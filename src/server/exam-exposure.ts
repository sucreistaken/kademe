import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, candidates, itemResponses, items, sectionRuns } from "@/db/schema";
import type { Avoid } from "@/lib/exam/blueprint";
import { COURSE_FORMS, courseFormKey, parseCourseFormKey, type CourseForm, type CourseKey } from "@/lib/exam/course/types";

/**
 * Everything the same student was served in their other exams: the items of
 * every item_responses row under the organisation's candidates with this
 * email (any case), in any assessment but `excludeAssessmentId`, and the
 * stimuli of those items. A new form draws around it (blueprint.ts: Avoid),
 * so a returning student does not meet the same questions again.
 *
 * A course test's items are left out: a course form is served as a whole, in
 * its own order, and never mixes with the bank (spec 2026-10-28), so nothing
 * the student saw in a course test is avoided, and nothing is avoided in one.
 *
 * `not_reached` rows are counted on purpose: closing a section writes the same
 * flag (`not_reached = true`, `answered_at` null) both for an item that was
 * planned and never shown and for a shown adaptive or one-way item left
 * unanswered, and nothing else on the row (its `served_at` is the close time
 * for the first kind) tells them apart. Counting both only makes the next form
 * avoid a few more items, which is the safe side of the guess.
 *
 * One query; the candidate lookup uses candidates_org_email_lower_idx. No
 * email means no way to recognise the student: empty sets, today's draw.
 */
export async function seenBy(
  orgId: string,
  email: string | null | undefined,
  excludeAssessmentId: string,
): Promise<Avoid> {
  const avoid: Avoid = { itemIds: new Set(), stimulusIds: new Set() };
  if (!email?.trim()) return avoid;
  const rows = await db
    .selectDistinct({ itemId: itemResponses.itemId, stimulusId: items.stimulusId })
    .from(candidates)
    .innerJoin(assessments, eq(assessments.candidateId, candidates.id))
    .innerJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .innerJoin(sectionRuns, eq(sectionRuns.attemptId, attempts.id))
    .innerJoin(itemResponses, eq(itemResponses.sectionRunId, sectionRuns.id))
    .innerJoin(items, eq(items.id, itemResponses.itemId))
    .where(
      and(
        eq(candidates.orgId, orgId),
        sql`lower(${candidates.email}) = lower(${email})`,
        eq(assessments.orgId, orgId),
        ne(assessments.id, excludeAssessmentId),
        isNull(items.courseForm),
      ),
    );
  for (const r of rows) {
    avoid.itemIds.add(r.itemId);
    if (r.stimulusId) avoid.stimulusIds.add(r.stimulusId);
  }
  return avoid;
}

/**
 * Which forms of one course test each of these students already sat in this
 * organisation (spec 2026-10-28: a returning student gets the form they have
 * not seen). A form is sat when any of its items was served to the same
 * email (any case) in another assessment but `excludeAssessmentId`: a student
 * who opened a section has seen that form's items, finished or not. Keyed by
 * the lower-cased email; every asked email has an entry, empty when the
 * student sat nothing. One query for the whole list.
 */
export async function courseFormsSeenBy(
  orgId: string,
  emails: readonly (string | null | undefined)[],
  key: CourseKey,
  excludeAssessmentId?: string,
): Promise<Map<string, Set<CourseForm>>> {
  const wanted = [...new Set(emails.map((e) => e?.trim().toLowerCase() ?? "").filter(Boolean))];
  const seen = new Map<string, Set<CourseForm>>(wanted.map((e) => [e, new Set<CourseForm>()]));
  if (wanted.length === 0) return seen;
  const rows = await db
    .selectDistinct({ email: sql<string>`lower(${candidates.email})`, courseForm: items.courseForm })
    .from(candidates)
    .innerJoin(assessments, eq(assessments.candidateId, candidates.id))
    .innerJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .innerJoin(sectionRuns, eq(sectionRuns.attemptId, attempts.id))
    .innerJoin(itemResponses, eq(itemResponses.sectionRunId, sectionRuns.id))
    .innerJoin(items, eq(items.id, itemResponses.itemId))
    .where(
      and(
        eq(candidates.orgId, orgId),
        eq(assessments.orgId, orgId),
        inArray(sql`lower(${candidates.email})`, wanted),
        inArray(items.courseForm, COURSE_FORMS.map((f) => courseFormKey(key, f))),
        excludeAssessmentId ? ne(assessments.id, excludeAssessmentId) : undefined,
      ),
    );
  for (const r of rows) {
    const parsed = r.courseForm ? parseCourseFormKey(r.courseForm) : null;
    if (parsed) seen.get(r.email)?.add(parsed.form);
  }
  return seen;
}
