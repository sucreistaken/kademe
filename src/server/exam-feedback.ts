import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, candidates, examFeedback } from "@/db/schema";
import type { CandidateLocale } from "@/i18n/locale";
import type { FeedbackInput } from "@/lib/exam/feedback";

/**
 * The end-of-exam survey, both sides. The student side writes one row per
 * invitation once the exam is finished; the school's panel reads rows of its own
 * organisation only (every read below names the caller's `orgId`, and the join to
 * the invitation uses the (id, org_id) pair, so a row can never be reached
 * through another organisation). A soft-deleted student is left out, as in the
 * other panel queries.
 */

export type SaveOutcome = "SAVED" | "ALREADY_ANSWERED" | "NOT_FINISHED";

/**
 * Stores the answer, once. The exam must be over (the latest attempt completed;
 * a terminated or unfinished attempt gets NOT_FINISHED). A second write for the
 * same invitation changes nothing and says so: the first answer stands.
 */
export async function saveExamFeedback(
  ctx: { assessmentId: string; orgId: string; locale: CandidateLocale },
  input: FeedbackInput,
): Promise<SaveOutcome> {
  const [latest] = await db
    .select({ completedAt: attempts.completedAt })
    .from(attempts)
    .where(eq(attempts.assessmentId, ctx.assessmentId))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  if (!latest?.completedAt) return "NOT_FINISHED";
  const written = await db
    .insert(examFeedback)
    .values({
      assessmentId: ctx.assessmentId,
      orgId: ctx.orgId,
      overall: input.overall,
      clarity: input.clarity,
      usability: input.usability,
      technicalProblem: input.technicalProblem,
      comment: input.comment,
      locale: ctx.locale,
    })
    .onConflictDoNothing({ target: examFeedback.assessmentId })
    .returning({ id: examFeedback.id });
  return written.length ? "SAVED" : "ALREADY_ANSWERED";
}

/** Whether this invitation's survey is answered: the finished screen does not offer it again. */
export async function hasExamFeedback(orgId: string, assessmentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: examFeedback.id })
    .from(examFeedback)
    .where(and(eq(examFeedback.orgId, orgId), eq(examFeedback.assessmentId, assessmentId)))
    .limit(1);
  return !!row;
}

export type StoredFeedback = {
  overall: number;
  clarity: number | null;
  usability: number | null;
  technicalProblem: boolean | null;
  comment: string | null;
  locale: CandidateLocale;
  createdAt: Date;
};

/** One student's answer for the result page, or null when there is none. */
export async function examFeedbackOf(orgId: string, assessmentId: string): Promise<StoredFeedback | null> {
  const [row] = await db
    .select({
      overall: examFeedback.overall,
      clarity: examFeedback.clarity,
      usability: examFeedback.usability,
      technicalProblem: examFeedback.technicalProblem,
      comment: examFeedback.comment,
      locale: examFeedback.locale,
      createdAt: examFeedback.createdAt,
    })
    .from(examFeedback)
    .where(and(eq(examFeedback.orgId, orgId), eq(examFeedback.assessmentId, assessmentId)))
    .limit(1);
  return row ?? null;
}

export type FeedbackComment = {
  id: string;
  assessmentId: string;
  name: string | null;
  overall: number;
  technicalProblem: boolean | null;
  comment: string;
  locale: CandidateLocale;
  createdAt: Date;
};

export type FeedbackTotals = {
  count: number;
  /** Averages are null while there is nothing to average. */
  averageOverall: number | null;
  averageClarity: number | null;
  averageUsability: number | null;
  /** Students who answered the technical question, and how many of them said yes. */
  technicalAnswered: number;
  technicalYes: number;
};

export type FeedbackOverview = FeedbackTotals & {
  /** The newest comments (at most the limit asked for), newest first. */
  comments: FeedbackComment[];
};

export const OVERVIEW_COMMENTS = 20;

const average = (value: string | number | null | undefined): number | null => (value === null || value === undefined ? null : Number(value));

/** One organisation's answers (a soft-deleted student's left out): the scope every overview read shares. */
const inOrg = (orgId: string) => and(eq(examFeedback.orgId, orgId), isNull(candidates.deletedAt));

/** The numbers of the overview: how many answered and how they rated. Always one organisation. */
export async function feedbackTotals(orgId: string): Promise<FeedbackTotals> {
  const [totals] = await db
    .select({
      count: sql<number>`count(*)::int`,
      overall: sql<string | null>`avg(${examFeedback.overall})`,
      clarity: sql<string | null>`avg(${examFeedback.clarity})`,
      usability: sql<string | null>`avg(${examFeedback.usability})`,
      technicalAnswered: sql<number>`count(${examFeedback.technicalProblem})::int`,
      technicalYes: sql<number>`(count(*) filter (where ${examFeedback.technicalProblem}))::int`,
    })
    .from(examFeedback)
    .innerJoin(assessments, and(eq(assessments.id, examFeedback.assessmentId), eq(assessments.orgId, examFeedback.orgId)))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .where(inOrg(orgId));
  return {
    count: totals?.count ?? 0,
    averageOverall: average(totals?.overall),
    averageClarity: average(totals?.clarity),
    averageUsability: average(totals?.usability),
    technicalAnswered: totals?.technicalAnswered ?? 0,
    technicalYes: totals?.technicalYes ?? 0,
  };
}

/** The school's overview: the totals, and the newest comments. Always one organisation. */
export async function feedbackOverview(orgId: string, commentLimit: number = OVERVIEW_COMMENTS): Promise<FeedbackOverview> {
  const [totals, comments] = await Promise.all([
    feedbackTotals(orgId),
    db
      .select({
        id: examFeedback.id,
        assessmentId: examFeedback.assessmentId,
        name: candidates.fullName,
        overall: examFeedback.overall,
        technicalProblem: examFeedback.technicalProblem,
        comment: examFeedback.comment,
        locale: examFeedback.locale,
        createdAt: examFeedback.createdAt,
      })
      .from(examFeedback)
      .innerJoin(assessments, and(eq(assessments.id, examFeedback.assessmentId), eq(assessments.orgId, examFeedback.orgId)))
      .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
      .where(and(inOrg(orgId), isNotNull(examFeedback.comment)))
      .orderBy(desc(examFeedback.createdAt))
      .limit(commentLimit),
  ]);
  return { ...totals, comments: comments.flatMap((c) => (c.comment ? [{ ...c, comment: c.comment }] : [])) };
}
