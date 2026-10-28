import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import {
  assessmentLinks,
  attempts,
  examAssessments,
  examResults,
  itemResponses,
  items,
  sectionRuns,
  stimuli,
} from "@/db/schema";
import { eap, mulberry32, observationOf, poolLeft, replay, replayResponseOf, shouldStop, type Observation, type Posterior } from "@/lib/exam/adaptive";
import {
  adaptiveConfigFor,
  enabledSections,
  estimatedMinutes,
  isTextOnly,
  nextAdaptiveItems,
  pickProductive,
  planFixedSection,
  productiveTaskLevels,
  resolveDistribution,
  textKindsOf,
  textPlanOf,
  weighsTexts,
  type BankItem,
  type BlueprintConfig,
  type SectionConfig,
} from "@/lib/exam/blueprint";
import { candidateExamName } from "@/lib/exam/candidate-exam-name";
import { levelFromTheta } from "@/lib/exam/cefr";
import { COURSE_TESTS, courseSections } from "@/lib/exam/course/catalog";
import { singleInviteForm } from "@/lib/exam/course/forms";
import { coursePlanOf, type CoursePlanRow } from "@/lib/exam/course/plan";
import { courseFormKey, type CourseForm, type CourseKey } from "@/lib/exam/course/types";
import { studentCourseResult, type StudentCourseResult } from "@/lib/exam/course/student-view";
import { playsAllowed } from "@/lib/exam/listening-plays";
import { drawFormatOf } from "@/lib/exam/item-format";
import { hasAnswer, scoreItem } from "@/lib/exam/item-scoring";
import { examDateOf, studentSheetDate } from "@/lib/exam/sheet-date";
import { studentFacingFeedback, type StudentNote } from "@/lib/exam/student-feedback";
import type { StudentAnalysis } from "@/lib/exam/student-analysis";
import { loadStudentAnalysis } from "@/server/student-analysis";
import {
  canFlag,
  canWrite,
  currentSequence,
  decideMove,
  isNavigableConfig,
  isNavigableRun,
  listeningPosition,
  navEntries,
  neighbour,
  type ListeningPosition,
  type NavEntry,
  type NavTarget,
} from "@/lib/exam/navigation";
import { poolPosteriors, studentWaitingFor } from "@/lib/exam/result";
import { makePresentation, toCandidateItem, unalias, type CandidateItem } from "@/lib/exam/safe";
import {
  isObjectiveSection,
  type Cefr,
  type ExamMode,
  type ItemAnswer,
  type ItemSnapshot,
  type Presentation,
  type ResultLevel,
  type Section,
  type TextGapKind,
} from "@/lib/exam/types";
import { isProctored, type ProctoringPolicy } from "@/lib/proctor/policy";
import { SUBMIT_SLACK_MS } from "@/lib/timer";
import { courseFormsSeenBy, seenBy } from "@/server/exam-exposure";

/**
 * The student side of an exam, server only.
 *
 * The rules this file keeps:
 *  - The token is the only credential. Every id used below is derived from it.
 *  - The server owns the clock. A section's deadline is written once, when it
 *    starts, and nothing the browser says moves it.
 *  - The server owns the item sequence. Which item comes next is decided here,
 *    under a row lock, and a reload returns the same item in the same order.
 *    In a navigable section (a fixed form) the whole plan is served at the
 *    start and the student moves around it; the rules are in exam/navigation.ts.
 *  - Nothing the student receives carries a key, a rubric, a difficulty or a
 *    listening transcript. Items go out only through `toCandidateItem`.
 *  - One attempt per invitation. A second try is a new invitation.
 */

import {
  currentAttempt,
  hasConsented,
  resolveToken,
  type CandidateContext,
  type ResolveResult,
} from "@/lib/candidate-context";

// Core helpers the exam flow used to own. Re-exported so existing imports keep
// working; new code imports them from @/lib/candidate-context.
export {
  getConsentText,
  hasConsented,
  recordConsent,
  recordDeviceCheck,
  recordFirstSeen,
  setAssessmentLocale,
  supportedLocales,
  type LinkProblem,
} from "@/lib/candidate-context";

/** What the language exam froze onto the invitation (exam_assessments). */
export type ExamTerms = {
  blueprintId: string;
  examName: string;
  mode: ExamMode;
  claimedLevel: Cefr | null;
  config: BlueprintConfig;
};

/** The core candidate context plus the exam's terms. Every exam function takes this. */
export type ExamCandidateContext = Omit<CandidateContext, "assessment"> & {
  assessment: CandidateContext["assessment"] & ExamTerms;
};

/**
 * The exam's view of an invitation, or null when it is not a language exam.
 * Null is answered with the same 404 as an unknown token, so an exam endpoint
 * never reveals that a hiring invitation exists.
 */
export async function loadExamContext(ctx: CandidateContext): Promise<ExamCandidateContext | null> {
  if (ctx.assessment.solution !== "LANGUAGE_EXAM") return null;
  const [exam] = await db.select().from(examAssessments).where(eq(examAssessments.assessmentId, ctx.assessment.id)).limit(1);
  if (!exam) return null;
  return {
    ...ctx,
    assessment: {
      ...ctx.assessment,
      blueprintId: exam.blueprintId,
      examName: exam.blueprintName,
      mode: exam.mode,
      claimedLevel: exam.claimedLevel,
      config: exam.blueprintSnapshot,
    },
  };
}

/** resolveToken for exam pages and scripts: a non-exam invitation is INVALID here. */
export async function resolveExamToken(rawToken: string): Promise<ResolveResult<ExamCandidateContext>> {
  const resolved = await resolveToken(rawToken);
  if (!resolved.ok && !resolved.ctx) return { ok: false, problem: resolved.problem };
  const exam = await loadExamContext(resolved.ctx!);
  if (!exam) return { ok: false, problem: "INVALID" };
  return resolved.ok ? { ok: true, ctx: exam } : { ok: false, problem: resolved.problem, ctx: exam };
}

/** The single attempt of this exam invitation, created on first need. */
export async function workingAttempt(assessmentId: string) {
  return currentAttempt({ id: assessmentId, solution: "LANGUAGE_EXAM" });
}

export const policyOf = (ctx: ExamCandidateContext): ProctoringPolicy => ctx.assessment.config.proctoring;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type ExamStep = "CONSENT" | "INFO" | "CHECK" | "SECTION_INTRO" | "ITEM" | "DONE";

export type SectionSummary = {
  section: Section;
  position: number;
  minutes: number;
  /** "12" for fixed forms, "8-15" for adaptive, tasks for writing/speaking. */
  itemsLabel: string;
  /** The student can go back, flag items and review before finishing this section. */
  navigable: boolean;
  /** GRAMMAR made only of texts (C-test, cloze, word bank): the intro counts texts, not questions. */
  textOnly: boolean;
  /** The kinds of text the section opens with (empty when it has none), so the intro and the warm-up can say how to answer. */
  textKinds: TextGapKind[];
  done: boolean;
  /** Closed without a question because the bank had none left (BANK_EMPTY); the student is told. */
  skipped?: boolean;
};

/** Navigable sections: the progress strip, and whether the review step is open. */
export type SectionNav = { entries: NavEntry[]; review: boolean };

export type StudentResult = {
  visibility: "NONE" | "OVERALL" | "FULL";
  released: boolean;
  /** Present only once the teacher released it and visibility allows. A0 is Pre-A1 (see `levelLabel`). */
  overall?: ResultLevel | null;
  skills?: Array<{ section: Section; level: ResultLevel | null }>;
  outcome?: "PASS" | "FAIL" | "INCONCLUSIVE" | null;
  /** True when a teacher still has to decide: writing or speaking, or an uncertain objective result. */
  awaitingTeacher: boolean;
  /** Why: "PRODUCTIVE" (writing or speaking) or "REVIEW" (an uncertain result only); null when not waiting. */
  waitingFor?: "PRODUCTIVE" | "REVIEW" | null;
  /**
   * Whether the CEFR level (overall and per section) is shown: the teacher's choice at release
   * (`exam_results.level_shown`), else the exam's visibility setting.
   */
  levelShown: boolean;
  /** Present only once the result is released: counts and topics, never the questions. */
  analysis?: StudentAnalysis;
  /** The teacher-approved note, in the student's language, or null. */
  feedback?: StudentNote | null;
  /** A course test, once the teacher released it: outcome, points per section, the course to continue in. No level. */
  course?: StudentCourseResult;
};

export type CandidateState = {
  step: ExamStep;
  examName: string;
  orgName: string;
  mode: ExamMode;
  claimedLevel: Cefr | null;
  estimatedMinutes: number;
  expiresAt: string;
  sections: SectionSummary[];
  proctoring: ProctoringPolicy;
  maxPlays: number;
  current?: {
    section: Section;
    position: number;
    total: number;
    serverNow: string;
    deadlineAt: string | null;
    remainingMs: number | null;
    answered: number;
    /** Null for adaptive sections, where the count depends on the answers. */
    itemTotal: number | null;
    /** Null on the review step of a navigable section. */
    item: CandidateItem | null;
    /**
     * A listening recording is shown with all its questions at once: every item
     * of that recording in this section, in order, `item` among them. Null for
     * any other item. One-way sections list only the testlet's open items.
     */
    group: CandidateItem[] | null;
    /**
     * Which recording of the section the listening page shows ("text 2 of 3").
     * Null off a listening page, and in one-way sections, where the number of
     * recordings is not known up front.
     */
    listening: ListeningPosition | null;
    /** Null in one-way sections (adaptive, speaking) and before a section starts. */
    nav: SectionNav | null;
  };
  finished?: { terminated: boolean; terminationReason: string | null; result: StudentResult };
};

function itemsLabel(s: SectionConfig, mode: ExamMode, claimed: Cefr | null, offset: number, course?: CourseKey): string {
  if (!isObjectiveSection(s.section)) return String(s.tasks);
  // A course form is fixed and holds the catalog's scored units: a gap, a statement or a question each.
  const units = mode === "COURSE_TEST" && course ? courseSections(course).find((p) => p.section === s.section)?.units : undefined;
  if (units !== undefined) return String(units);
  if (s.adaptive) return `${s.minItems}-${s.maxItems}`;
  const dist = resolveDistribution(s, mode, claimed, offset);
  const openings = textPlanOf(s, mode, claimed).length;
  return String(Object.values(dist).reduce((a, b) => a + b, 0) + openings);
}

async function runsOf(attemptId: string) {
  return db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attemptId)).orderBy(asc(sectionRuns.orderIndex));
}

export async function progressSummary(ctx: ExamCandidateContext) {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.assessmentId, ctx.assessment.id)).limit(1);
  const total = enabledSections(ctx.assessment.config).length;
  if (!attempt) return { done: 0, total };
  const runs = await runsOf(attempt.id);
  return { done: runs.filter((r) => r.submittedAt).length, total };
}

export async function loadState(ctx: ExamCandidateContext): Promise<CandidateState> {
  const cfg = ctx.assessment.config;
  const sections = enabledSections(cfg);
  const base: CandidateState = {
    step: "CONSENT",
    examName: candidateExamName(ctx.assessment.examName, ctx.locale),
    orgName: ctx.orgName,
    mode: ctx.assessment.mode,
    claimedLevel: ctx.assessment.claimedLevel,
    estimatedMinutes: estimatedMinutes(cfg),
    expiresAt: ctx.link.expiresAt.toISOString(),
    sections: sections.map((s, i) => {
      const textOnly = isTextOnly(s, ctx.assessment.mode, ctx.assessment.claimedLevel, cfg.difficultyOffset);
      return {
        section: s.section,
        position: i + 1,
        minutes: s.durationMinutes,
        itemsLabel: itemsLabel(s, ctx.assessment.mode, ctx.assessment.claimedLevel, cfg.difficultyOffset, cfg.course?.key),
        navigable: isNavigableConfig(s),
        textOnly,
        textKinds: textKindsOf(s, ctx.assessment.mode, ctx.assessment.claimedLevel),
        done: false,
      };
    }),
    proctoring: cfg.proctoring,
    maxPlays: cfg.listening.maxPlays,
  };

  if (!(await hasConsented(ctx.assessment.id))) return base;
  if (!ctx.candidate.fullName || !ctx.candidate.email) return { ...base, step: "INFO" };

  const { attempt } = await workingAttempt(ctx.assessment.id);
  if (attempt.completedAt || attempt.terminatedAt) return finishedState(ctx, base, attempt);
  if (isProctored(cfg.proctoring) && !attempt.deviceCheckedAt) return { ...base, step: "CHECK" };

  // Walk the sections in order; close any whose clock ran out on the way.
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    let [run] = await db
      .select()
      .from(sectionRuns)
      .where(and(eq(sectionRuns.attemptId, attempt.id), eq(sectionRuns.section, s.section)))
      .limit(1);
    if (run?.submittedAt) {
      base.sections[i].done = true;
      if (run.completion === "SKIPPED") base.sections[i].skipped = true;
      continue;
    }
    if (run?.deadlineAt && Date.now() > run.deadlineAt.getTime() + SUBMIT_SLACK_MS) {
      await closeSectionRun(run.id, "EXPIRED");
      base.sections[i].done = true;
      continue;
    }
    if (!run || !run.startedAt) {
      return {
        ...base,
        step: "SECTION_INTRO",
        current: {
          section: s.section,
          position: i + 1,
          total: sections.length,
          serverNow: new Date().toISOString(),
          deadlineAt: null,
          remainingMs: null,
          answered: 0,
          itemTotal: null,
          item: null,
          group: null,
          listening: null,
          nav: null,
        },
      };
    }
    if (run.navigable) {
      const view = await navigableView(ctx, run.id);
      if (!view) {
        // A navigable run with nothing served (should not happen: an empty plan is skipped at the start).
        await closeSectionRun(run.id, "DONE");
        base.sections[i].done = true;
        continue;
      }
      return {
        ...base,
        step: "ITEM",
        current: {
          section: s.section,
          position: i + 1,
          total: sections.length,
          serverNow: new Date().toISOString(),
          deadlineAt: run.deadlineAt?.toISOString() ?? null,
          remainingMs: run.deadlineAt ? Math.max(0, run.deadlineAt.getTime() - Date.now()) : null,
          answered: view.entries.filter((e) => e.filled > 0).length,
          itemTotal: view.entries.length,
          item: view.item,
          group: view.group,
          listening: view.listening,
          nav: { entries: view.entries, review: view.review },
        },
      };
    }
    const item = await ensureCurrentItem(ctx, run.id);
    if (!item) {
      // Nothing left to serve: the section is complete.
      await closeSectionRun(run.id, "DONE");
      base.sections[i].done = true;
      continue;
    }
    [run] = await db.select().from(sectionRuns).where(eq(sectionRuns.id, run.id));
    const answered = await countAnswered(run.id);
    return {
      ...base,
      step: "ITEM",
      current: {
        section: s.section,
        position: i + 1,
        total: sections.length,
        serverNow: new Date().toISOString(),
        deadlineAt: run.deadlineAt?.toISOString() ?? null,
        remainingMs: run.deadlineAt ? Math.max(0, run.deadlineAt.getTime() - Date.now()) : null,
        answered,
        itemTotal: run.itemPlan ? run.itemPlan.length : null,
        item,
        group: await listeningGroup(ctx, run.id, item.sequence, true),
        listening: null,
        nav: null,
      },
    };
  }

  await finishAttempt(attempt.id);
  const [done] = await db.select().from(attempts).where(eq(attempts.id, attempt.id));
  return finishedState(ctx, { ...base, sections: base.sections.map((s) => ({ ...s, done: true })) }, done);
}

async function countAnswered(runId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(itemResponses)
    .where(and(eq(itemResponses.sectionRunId, runId), isNotNull(itemResponses.answeredAt)));
  return row?.n ?? 0;
}

/**
 * The date on the student's printed result: the same source as the panel's
 * student copy (the finalized day, else the exam day), see studentSheetDate.
 * Only for a finished exam.
 */
export async function finishedSheetDate(ctx: ExamCandidateContext): Promise<Date | null> {
  const { attempt } = await workingAttempt(ctx.assessment.id);
  const [result] = await db.select({ finalizedAt: examResults.finalizedAt }).from(examResults).where(eq(examResults.attemptId, attempt.id)).limit(1);
  return studentSheetDate({ finalizedAt: result?.finalizedAt, examDate: examDateOf(attempt) });
}

async function finishedState(
  ctx: ExamCandidateContext,
  base: CandidateState,
  attempt: typeof attempts.$inferSelect,
): Promise<CandidateState> {
  const cfg = ctx.assessment.config;
  const [result] = await db.select().from(examResults).where(eq(examResults.attemptId, attempt.id)).limit(1);
  const hasProductive = enabledSections(cfg).some((s) => !isObjectiveSection(s.section));
  const released = !!result?.releasedAt;
  const waitingFor = studentWaitingFor({ hasProductive, final: result?.status === "FINAL", computed: result?.computed });
  // Only a released result says anything about the level, and a course test has no level to say (spec 2026-10-28).
  const levelShown = released && !cfg.course && (result?.levelShown ?? cfg.resultVisibility !== "NONE");
  const student: StudentResult = {
    visibility: cfg.resultVisibility,
    released,
    awaitingTeacher: waitingFor !== null,
    waitingFor,
    levelShown,
  };
  // Released means a teacher finalized it and let the student see it.
  if (released && result?.status === "FINAL") {
    student.analysis =
      (await loadStudentAnalysis(
        ctx.assessment.orgId,
        attempt.id,
        enabledSections(cfg).map((s) => s.section),
        ctx.locale,
      )) ?? undefined;
    student.feedback = studentFacingFeedback(result.studentFeedback);
    student.course = studentCourseResult(result.computed?.course, result.finalOutcome) ?? undefined;
  }
  if (released && result?.status === "FINAL" && levelShown) {
    student.overall = result?.finalOverall ?? null;
    student.outcome = result?.finalOutcome ?? null;
    if (cfg.resultVisibility === "FULL") {
      student.skills = Object.entries(result?.finalSkills ?? {}).map(([section, s]) => ({
        section: section as Section,
        level: s.level as ResultLevel,
      }));
    }
  }
  return {
    ...base,
    step: "DONE",
    finished: {
      terminated: !!attempt.terminatedAt,
      terminationReason: attempt.terminationReason,
      result: student,
    },
  };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** The section the student is on, or null when all are done. */
export async function currentSection(ctx: ExamCandidateContext) {
  const { attempt, finished } = await workingAttempt(ctx.assessment.id);
  if (finished) return null;
  const sections = enabledSections(ctx.assessment.config);
  const runs = await runsOf(attempt.id);
  for (let i = 0; i < sections.length; i++) {
    const run = runs.find((r) => r.section === sections[i].section);
    if (!run?.submittedAt) return { attempt, config: sections[i], position: i + 1, run: run ?? null };
  }
  return null;
}

type PoolRow = BankItem & { section: Section };

/**
 * Approved items the exam may serve. Listening clips without audio are left out.
 * Inside a transaction pass its `x`: a read on the global db there waits for a
 * second pool connection and can starve the pool.
 *
 * The pool is the bank's: an item or text that belongs to a course test form
 * (`course_form` set) is never drawn into a placement or a level check, only
 * its own form serves it (loadCourseForm).
 */
export async function loadPool(orgId: string, section: Section, x: Executor = db): Promise<PoolRow[]> {
  const rows = await x
    .select({
      id: items.id,
      level: items.level,
      b: items.difficulty,
      skillTag: items.skillTag,
      stimulusId: items.stimulusId,
      orderInStimulus: items.orderInStimulus,
      type: items.type,
      exposureCount: items.exposureCount,
      audioKey: stimuli.audioKey,
    })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.orgId, orgId), eq(items.section, section), eq(items.status, "APPROVED"), isNull(items.courseForm), isNull(stimuli.courseForm)));
  return rows
    .filter((r) => section !== "LISTENING" || !!r.audioKey)
    .map((r) => ({
      id: r.id,
      level: r.level,
      b: r.b,
      skillTag: r.skillTag,
      stimulusId: r.stimulusId,
      orderInStimulus: r.orderInStimulus,
      type: r.type,
      exposureCount: r.exposureCount,
      section,
    }));
}

/**
 * The format of every approved item of the section (item-format.ts), by item
 * id, so a fixed form can mix formats (blueprint.ts: mixFormats). Read once
 * when a fixed objective section starts: it needs `content`, which loadPool,
 * run again for every item an adaptive section serves, leaves out. A malformed
 * item falls back to its type (drawFormatOf) instead of failing the start.
 * The bank's items only, like loadPool.
 */
export async function formatsOf(orgId: string, section: Section, x: Executor = db): Promise<Map<string, string>> {
  const rows = await x
    .select({ id: items.id, type: items.type, skillTag: items.skillTag, content: items.content })
    .from(items)
    .where(and(eq(items.orgId, orgId), eq(items.section, section), eq(items.status, "APPROVED"), isNull(items.courseForm)));
  return new Map(rows.map((r) => [r.id, drawFormatOf(r)]));
}

/**
 * The approved items of one course test form in one section, with what the
 * plan needs of them (spec 2026-10-28: a form is its own items, in their own
 * order). `formKey` is "<course key>:<form>", e.g. "B1.1:A".
 */
async function loadCourseForm(orgId: string, formKey: string, section: Section, x: Executor = db): Promise<CoursePlanRow[]> {
  return x
    .select({ id: items.id, courseOrder: items.courseOrder, orderInStimulus: items.orderInStimulus, audioKey: stimuli.audioKey })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.orgId, orgId), eq(items.section, section), eq(items.status, "APPROVED"), eq(items.courseForm, formKey)));
}

/**
 * The course test and the form this invitation sits. The invitation's own
 * snapshot names the form (invite.ts). An invitation without one (made before
 * forms, or by hand) gets the form its student has not seen, else A
 * (singleInviteForm), and that choice is written into the snapshot while it is
 * still unset, so a reload, the next section and a parallel request all serve
 * the same form. Null when the exam does not say which course it is: nothing
 * can be served then.
 */
async function courseFormOf(ctx: ExamCandidateContext): Promise<{ key: CourseKey; form: CourseForm } | null> {
  const course = ctx.assessment.config.course;
  if (!course) return null;
  if (course.form) return { key: course.key, form: course.form };
  const email = ctx.candidate.email?.trim().toLowerCase() ?? "";
  const seen = await courseFormsSeenBy(ctx.assessment.orgId, [email], course.key, ctx.assessment.id);
  const chosen = singleInviteForm(seen.get(email) ?? new Set());
  const [written] = await db
    .update(examAssessments)
    .set({ blueprintSnapshot: sql`jsonb_set(${examAssessments.blueprintSnapshot}, '{course,form}', ${JSON.stringify(chosen)}::jsonb)` })
    .where(and(eq(examAssessments.assessmentId, ctx.assessment.id), sql`${examAssessments.blueprintSnapshot} #>> '{course,form}' is null`))
    .returning({ snapshot: examAssessments.blueprintSnapshot });
  if (written) return { key: course.key, form: written.snapshot.course?.form ?? chosen };
  // Another request set it first: serve what it chose.
  const [current] = await db.select({ snapshot: examAssessments.blueprintSnapshot }).from(examAssessments).where(eq(examAssessments.assessmentId, ctx.assessment.id));
  return { key: course.key, form: current?.snapshot.course?.form ?? chosen };
}

/** Provisional level from the finished objective sections, for placing writing and speaking tasks. */
async function provisionalLevel(attemptId: string): Promise<Cefr> {
  const runs = await runsOf(attemptId);
  const pooled = poolPosteriors(
    runs
      .filter((r) => r.thetaMean !== null && r.thetaSd !== null)
      .map((r) => ({ mean: r.thetaMean as number, sd: r.thetaSd as number })),
  );
  return pooled ? levelFromTheta(pooled.mean).level : "B1";
}

export type StartResult = { ok: true } | { ok: false; code: "SECTION_MISMATCH" | "NO_SECTION" | "BANK_EMPTY" | "NOT_READY" };

/**
 * The server's own check that the steps before the exam happened: consent was
 * recorded, the student's details exist, and a proctored exam passed its
 * system check. The pages enforce the order too, but a hand-made request must
 * not be able to skip them.
 */
async function readyForExam(ctx: ExamCandidateContext, attempt: typeof attempts.$inferSelect): Promise<boolean> {
  if (!(await hasConsented(ctx.assessment.id))) return false;
  if (!ctx.candidate.fullName || !ctx.candidate.email) return false;
  if (isProctored(ctx.assessment.config.proctoring) && !attempt.deviceCheckedAt) return false;
  return true;
}

/** What a section serves: the planned item ids (null for an adaptive section), the level asked per task, and whether the bank had nothing at all. */
type SectionPlan = { itemPlan: string[] | null; taskLevels: string[] | null; poolEmpty: boolean };

/**
 * A placement or level check section: drawn from the bank by the blueprint's
 * rules (blueprint.ts), around what the same student was served before.
 */
async function planDrawnSection(ctx: ExamCandidateContext, attemptId: string, s: SectionConfig): Promise<SectionPlan> {
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  const planned = !isObjectiveSection(s.section) || !s.adaptive;
  // A fixed objective form mixes formats (blueprint.ts: mixFormats), so its
  // pool carries each item's format; adaptive sections pick item by item and
  // writing and speaking have their own rules (pickProductive).
  const loaded = await loadPool(ctx.assessment.orgId, s.section);
  const fixedObjective = isObjectiveSection(s.section) && !s.adaptive;
  const formats = fixedObjective ? await formatsOf(ctx.assessment.orgId, s.section) : null;
  const pool = formats ? loaded.map((p) => ({ ...p, format: formats.get(p.id) })) : loaded;
  let itemPlan: string[] | null = null;
  let taskLevels: string[] | null = null;
  // A returning student (same school, same email) draws around what earlier
  // exams served; when everything was seen the least served units fill the
  // form, so this never blocks a start. Adaptive sections pick item by item
  // and do not use it.
  const avoid = planned ? await seenBy(ctx.assessment.orgId, ctx.candidate.email, ctx.assessment.id) : undefined;
  if (!isObjectiveSection(s.section)) {
    const provisional = await provisionalLevel(attemptId);
    taskLevels = productiveTaskLevels(ctx.assessment.mode, ctx.assessment.claimedLevel, provisional, s.tasks);
    itemPlan = pickProductive(pool, taskLevels as Cefr[], rng, avoid);
  } else if (!s.adaptive) {
    itemPlan = planFixedSection(s, pool, ctx.assessment.mode, ctx.assessment.claimedLevel, ctx.assessment.config.difficultyOffset, rng, avoid);
  }
  return { itemPlan, taskLevels, poolEmpty: pool.length === 0 };
}

/**
 * A course test section (spec 2026-10-28): the invitation's form, whole, in
 * its own order. Nothing is drawn and nothing is avoided because the student
 * met it before, so two students on the same form meet the same questions in
 * the same order, and the objective sections, writing and speaking are served
 * alike. Every task is asked at the course's own level. A form with nothing in
 * this section plans nothing, and the section is skipped as an empty bank is.
 */
async function planCourseSection(ctx: ExamCandidateContext, s: SectionConfig): Promise<SectionPlan> {
  const course = await courseFormOf(ctx);
  if (!course) return { itemPlan: [], taskLevels: null, poolEmpty: true };
  const rows = await loadCourseForm(ctx.assessment.orgId, courseFormKey(course.key, course.form), s.section);
  const itemPlan = coursePlanOf(rows, s.section);
  const taskLevels = isObjectiveSection(s.section) ? null : productiveTaskLevels("COURSE_TEST", null, COURSE_TESTS[course.key].level, itemPlan.length);
  return { itemPlan, taskLevels, poolEmpty: false };
}

/**
 * Starts the current section. Idempotent: a second call, a double click or a
 * reload return the section as it is, and the deadline never moves.
 */
export async function startSection(ctx: ExamCandidateContext, position: number): Promise<StartResult> {
  const current = await currentSection(ctx);
  if (!current) return { ok: false, code: "NO_SECTION" };
  if (!(await readyForExam(ctx, current.attempt))) return { ok: false, code: "NOT_READY" };
  if (current.position !== position) return { ok: false, code: "SECTION_MISMATCH" };
  if (current.run?.startedAt) return { ok: true };

  const s = current.config;
  const { itemPlan, taskLevels, poolEmpty } =
    ctx.assessment.mode === "COURSE_TEST" ? await planCourseSection(ctx, s) : await planDrawnSection(ctx, current.attempt.id, s);
  if ((itemPlan && itemPlan.length === 0) || poolEmpty) {
    // The bank lost these items after the invitation (retired, rejected).
    // Skip the section rather than trap the student in front of it; the
    // report shows it as SKIPPED and the teacher sees why.
    const now = new Date();
    await db
      .insert(sectionRuns)
      .values({ attemptId: current.attempt.id, section: s.section, orderIndex: current.position, startedAt: now, deadlineAt: now, submittedAt: now, completion: "SKIPPED", stopReason: "BANK_EMPTY" })
      .onConflictDoNothing();
    const runs = await runsOf(current.attempt.id);
    const enabled = enabledSections(ctx.assessment.config).map((x) => x.section);
    if (enabled.every((sec) => runs.find((r) => r.section === sec)?.submittedAt)) await finishAttempt(current.attempt.id);
    return { ok: true };
  }

  const now = new Date();
  const deadlineAt = new Date(now.getTime() + s.durationMinutes * 60_000);
  await db
    .insert(sectionRuns)
    .values({
      attemptId: current.attempt.id,
      section: s.section,
      orderIndex: current.position,
      startedAt: now,
      deadlineAt,
      itemPlan,
      taskLevels,
      navigable: isNavigableRun(s.section, itemPlan !== null),
    })
    .onConflictDoUpdate({
      target: [sectionRuns.attemptId, sectionRuns.section],
      // Only fills a run that exists without a start (should not happen); a
      // started run keeps its clock.
      set: { startedAt: sql`coalesce(${sectionRuns.startedAt}, excluded.started_at)`, deadlineAt: sql`coalesce(${sectionRuns.deadlineAt}, excluded.deadline_at)` },
    });
  if (!current.attempt.startedAt) {
    await db.update(attempts).set({ startedAt: now }).where(eq(attempts.id, current.attempt.id));
  }
  await db
    .update(assessmentLinks)
    .set({ status: "IN_PROGRESS" })
    .where(and(eq(assessmentLinks.id, ctx.link.id), eq(assessmentLinks.status, "NOT_STARTED")));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** The item as served. Inside a transaction pass its `x` (see loadPool). */
async function buildSnapshot(itemId: string, x: Executor = db): Promise<ItemSnapshot> {
  const [row] = await x
    .select({ item: items, stimulus: stimuli })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(eq(items.id, itemId));
  const { item, stimulus } = row;
  return {
    id: item.id,
    section: item.section,
    level: item.level,
    difficulty: item.difficulty,
    type: item.type,
    skillTag: item.skillTag,
    stimulusId: item.stimulusId,
    orderInStimulus: item.orderInStimulus,
    prompt: item.prompt,
    content: item.content,
    key: item.answerKey,
    rubric: item.rubric ?? null,
    points: item.points,
    stimulus: stimulus
      ? {
          id: stimulus.id,
          section: stimulus.section as "READING" | "LISTENING",
          level: stimulus.level,
          title: stimulus.title,
          body: stimulus.body,
          audioKey: stimulus.audioKey,
          audioDurationMs: stimulus.audioDurationMs,
          maxPlays: stimulus.maxPlays,
        }
      : null,
  };
}

/** Applies section-level overrides (think / answer time, takes) to a productive item. */
function applyOverrides(snapshot: ItemSnapshot, s: SectionConfig): ItemSnapshot {
  if (snapshot.content.kind !== "SPEAKING") return snapshot;
  return {
    ...snapshot,
    content: {
      ...snapshot.content,
      thinkSeconds: s.thinkSeconds ?? snapshot.content.thinkSeconds,
      answerSeconds: s.answerSeconds ?? snapshot.content.answerSeconds,
      maxTakes: s.maxTakes ?? snapshot.content.maxTakes,
    },
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function serve(tx: Tx, runId: string, itemIds: string[], startSequence: number, s: SectionConfig) {
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  let sequence = startSequence;
  for (const itemId of itemIds) {
    const snapshot = applyOverrides(await buildSnapshot(itemId, tx), s);
    await tx
      .insert(itemResponses)
      .values({
        sectionRunId: runId,
        itemId,
        sequence,
        itemSnapshot: snapshot,
        presentation: makePresentation(snapshot, rng),
      })
      .onConflictDoNothing();
    await tx.update(items).set({ exposureCount: sql`${items.exposureCount} + 1` }).where(eq(items.id, itemId));
    sequence += 1;
  }
}

function sectionConfigFor(ctx: ExamCandidateContext, section: Section): SectionConfig {
  const s = ctx.assessment.config.sections.find((x) => x.section === section);
  if (!s) throw new Error(`section ${section} is not in this exam`);
  return s;
}

/**
 * The item the student should see now, creating it if needed. Returns null
 * when the section has nothing left to serve.
 */
export async function ensureCurrentItem(ctx: ExamCandidateContext, runId: string): Promise<CandidateItem | null> {
  const servedId = await db.transaction(async (tx) => {
    const [run] = await tx.select().from(sectionRuns).where(eq(sectionRuns.id, runId)).for("update");
    if (!run || run.submittedAt) return null;
    const s = sectionConfigFor(ctx, run.section);
    const responses = await tx
      .select()
      .from(itemResponses)
      .where(eq(itemResponses.sectionRunId, runId))
      .orderBy(asc(itemResponses.sequence));
    const open = responses.find((r) => !r.answeredAt && !r.notReached);
    if (open) return open.id;

    const nextSequence = responses.length + 1;
    if (run.itemPlan) {
      const next = run.itemPlan[responses.length];
      if (!next) return null;
      await serve(tx, runId, [next], nextSequence, s);
    } else {
      const cfg = adaptiveConfigFor(s, ctx.assessment.mode, ctx.assessment.claimedLevel);
      const state = replay(
        cfg,
        responses.map((r) => replayResponseOf(r, weighsTexts(s))),
      );
      const pool = await loadPool(ctx.assessment.orgId, run.section, tx);
      const stop = shouldStop(state, cfg, poolLeft(pool, state));
      if (stop) {
        await tx.update(sectionRuns).set({ stopReason: stop }).where(eq(sectionRuns.id, runId));
        return null;
      }
      // The opening texts (GRAMMAR with texts, cTestLevels or cTest) come first; the engine never picks one.
      const next = nextAdaptiveItems(s, ctx.assessment.mode, ctx.assessment.claimedLevel, state, pool, cfg, mulberry32(Math.floor(Math.random() * 2 ** 31)));
      if (!next) return null;
      await serve(tx, runId, next.itemIds, nextSequence, s);
    }
    const [created] = await tx
      .select({ id: itemResponses.id })
      .from(itemResponses)
      .where(and(eq(itemResponses.sectionRunId, runId), eq(itemResponses.sequence, nextSequence)));
    return created?.id ?? null;
  });
  if (!servedId) return null;
  return candidateItemFor(ctx, servedId);
}

/**
 * A navigable run serves its whole plan at once, in plan order (sequence n is
 * the plan's n-th item), so the student can move to any of them. Idempotent
 * under the run's row lock; a reload serves nothing new.
 */
async function serveWholePlan(ctx: ExamCandidateContext, runId: string) {
  await db.transaction(async (tx) => {
    const [run] = await tx.select().from(sectionRuns).where(eq(sectionRuns.id, runId)).for("update");
    if (!run || run.submittedAt || !run.itemPlan) return;
    const served = await tx.select({ itemId: itemResponses.itemId }).from(itemResponses).where(eq(itemResponses.sectionRunId, runId));
    if (served.length >= run.itemPlan.length) return;
    const have = new Set(served.map((r) => r.itemId));
    await serve(tx, runId, run.itemPlan.filter((id) => !have.has(id)), served.length + 1, sectionConfigFor(ctx, run.section));
  });
}

/**
 * What a navigable section shows: the item under the stored cursor (or the
 * review step), and one progress cell per item. Null when nothing was served.
 */
async function navigableView(
  ctx: ExamCandidateContext,
  runId: string,
): Promise<{
  entries: NavEntry[];
  item: CandidateItem | null;
  group: CandidateItem[] | null;
  listening: ListeningPosition | null;
  review: boolean;
} | null> {
  await serveWholePlan(ctx, runId);
  const [run] = await db.select().from(sectionRuns).where(eq(sectionRuns.id, runId));
  const rows = await db
    .select({ id: itemResponses.id, sequence: itemResponses.sequence, snapshot: itemResponses.itemSnapshot, answer: itemResponses.answer, flagged: itemResponses.flagged })
    .from(itemResponses)
    .where(eq(itemResponses.sectionRunId, runId))
    .orderBy(asc(itemResponses.sequence));
  const sequence = currentSequence(run.navCursor, rows.map((r) => r.sequence));
  if (sequence === null) return null;
  const entries = navEntries(rows.map((r) => ({ sequence: r.sequence, content: r.snapshot.content, answer: r.answer ?? null, flagged: r.flagged })));
  const item = run.navReview ? null : await candidateItemFor(ctx, rows.find((r) => r.sequence === sequence)!.id);
  const group = item ? await listeningGroup(ctx, runId, item.sequence, false) : null;
  const anchor = rows.find((r) => r.sequence === sequence)?.snapshot;
  const listening =
    group && anchor
      ? listeningPosition(
          rows.map((r) => ({ sequence: r.sequence, stimulusId: r.snapshot.stimulusId, listening: r.snapshot.stimulus?.section === "LISTENING" })),
          anchor.stimulusId,
        )
      : null;
  return { entries, item, group, listening, review: run.navReview };
}

/**
 * The questions that share the listening recording of the item at `sequence`
 * (itself included), in order, for the one-page-per-recording screen. Null when
 * that item has no listening stimulus. `openOnly` (one-way sections) leaves out
 * items already closed. Every item goes through `candidateItemFor`.
 */
async function listeningGroup(ctx: ExamCandidateContext, runId: string, sequence: number, openOnly: boolean): Promise<CandidateItem[] | null> {
  const rows = await db
    .select({ id: itemResponses.id, sequence: itemResponses.sequence, snapshot: itemResponses.itemSnapshot, answeredAt: itemResponses.answeredAt, notReached: itemResponses.notReached })
    .from(itemResponses)
    .where(eq(itemResponses.sectionRunId, runId))
    .orderBy(asc(itemResponses.sequence));
  const anchor = rows.find((r) => r.sequence === sequence);
  const stimulusId = anchor?.snapshot.stimulusId;
  if (!anchor || !stimulusId || anchor.snapshot.stimulus?.section !== "LISTENING") return null;
  const members = rows.filter((r) => r.snapshot.stimulusId === stimulusId && (!openOnly || (!r.answeredAt && !r.notReached)));
  return Promise.all(members.map((r) => candidateItemFor(ctx, r.id)));
}

export async function candidateItemFor(ctx: ExamCandidateContext, responseId: string): Promise<CandidateItem> {
  const [row] = await db
    .select({ response: itemResponses, run: sectionRuns })
    .from(itemResponses)
    .innerJoin(sectionRuns, eq(sectionRuns.id, itemResponses.sectionRunId))
    .where(eq(itemResponses.id, responseId));
  const snap = row.response.itemSnapshot;
  let takesUsed: number | undefined;
  if (snap.type === "SPEAKING_PROMPT") {
    const { takeCount } = await import("@/lib/candidate-media");
    takesUsed = await takeCount(row.response.id);
  }
  return toCandidateItem(snap, row.response.presentation, row.response.answer ?? null, row.response.sequence, {
    maxPlays: ctx.assessment.config.listening.maxPlays,
    playsUsed: snap.stimulusId ? (row.run.stimulusPlays[snap.stimulusId] ?? 0) : 0,
    takesUsed,
  });
}

type SectionRun = typeof sectionRuns.$inferSelect;
type ItemResponse = typeof itemResponses.$inferSelect;

type SectionRefusal = "NO_SECTION" | "NOT_READY" | "SECTION_MISMATCH" | "SECTION_NOT_STARTED" | "SECTION_EXPIRED";

export type SectionCheck = { ok: true; run: SectionRun } | { ok: false; code: SectionRefusal };

export type WriteCheck = { ok: true; run: SectionRun; response: ItemResponse } | { ok: false; code: SectionRefusal | "ITEM_MISMATCH" };

/** The section the request names is the open one, started, and inside its clock. */
export async function checkSection(ctx: ExamCandidateContext, position: unknown): Promise<SectionCheck> {
  const current = await currentSection(ctx);
  if (!current) return { ok: false, code: "NO_SECTION" };
  if (!(await readyForExam(ctx, current.attempt))) return { ok: false, code: "NOT_READY" };
  if (current.position !== position) return { ok: false, code: "SECTION_MISMATCH" };
  const run = current.run;
  if (!run?.startedAt || !run.deadlineAt) return { ok: false, code: "SECTION_NOT_STARTED" };
  if (Date.now() > run.deadlineAt.getTime() + SUBMIT_SLACK_MS) return { ok: false, code: "SECTION_EXPIRED" };
  return { ok: true, run };
}

const navTarget = (r: ItemResponse | undefined): NavTarget | null =>
  r ? { sequence: r.sequence, answered: !!r.answeredAt, notReached: r.notReached } : null;

async function responseAt(runId: string, sequence: number): Promise<ItemResponse | undefined> {
  const [response] = await db
    .select()
    .from(itemResponses)
    .where(and(eq(itemResponses.sectionRunId, runId), eq(itemResponses.sequence, sequence)));
  return response;
}

/**
 * Every write names the section position and item sequence it believes it is
 * on. If the server disagrees (a second tab, a stale screen) the write is
 * refused rather than landing on the wrong item. A one-way section takes
 * writes on its first open item only; a navigable one on any open item.
 */
export async function checkWrite(ctx: ExamCandidateContext, position: unknown, sequence: unknown): Promise<WriteCheck> {
  const section = await checkSection(ctx, position);
  if (!section.ok) return section;
  return checkItem(section.run, sequence);
}

/** The item half of checkWrite, for a run that already passed checkSection. */
export async function checkItem(run: SectionRun, sequence: unknown): Promise<WriteCheck> {
  if (typeof sequence !== "number") return { ok: false, code: "ITEM_MISMATCH" };
  const response = await responseAt(run.id, sequence);
  let firstOpen: number | null = null;
  let sharesTestlet = false;
  if (!run.navigable) {
    const [row] = await db
      .select({ sequence: itemResponses.sequence, snapshot: itemResponses.itemSnapshot })
      .from(itemResponses)
      .where(and(eq(itemResponses.sectionRunId, run.id), isNull(itemResponses.answeredAt), eq(itemResponses.notReached, false)))
      .orderBy(asc(itemResponses.sequence))
      .limit(1);
    firstOpen = row?.sequence ?? null;
    // A listening testlet is answered together: its other open items share the first one's turn.
    const recording = row?.snapshot.stimulusId;
    sharesTestlet = !!recording && row.snapshot.stimulus?.section === "LISTENING" && response?.itemSnapshot.stimulusId === recording;
  }
  if (!response || !canWrite({ navigable: run.navigable, target: navTarget(response), firstOpen, sharesTestlet })) return { ok: false, code: "ITEM_MISMATCH" };
  return { ok: true, run, response };
}

/**
 * Moves a navigable section's screen to one of its items, or to the review
 * step. Refused (false) in a one-way section and for an item the run does not
 * have. Moving never scores anything.
 */
export async function moveTo(run: SectionRun, to: unknown): Promise<boolean> {
  const rows = await db.select({ sequence: itemResponses.sequence }).from(itemResponses).where(eq(itemResponses.sectionRunId, run.id));
  const move = decideMove({ navigable: run.navigable, to, sequences: rows.map((r) => r.sequence) });
  if (!move.ok) return false;
  await db
    .update(sectionRuns)
    .set(move.review ? { navReview: true } : { navCursor: move.cursor, navReview: false })
    .where(and(eq(sectionRuns.id, run.id), isNull(sectionRuns.submittedAt)));
  return true;
}

/** Marks or unmarks an item to come back to. Navigable sections only; the score never sees it. */
export async function setFlag(run: SectionRun, sequence: unknown, flagged: boolean): Promise<boolean> {
  const response = typeof sequence === "number" ? await responseAt(run.id, sequence) : undefined;
  if (!response || !canFlag({ navigable: run.navigable, target: navTarget(response) })) return false;
  await db
    .update(itemResponses)
    .set({ flagged })
    .where(and(eq(itemResponses.id, response.id), isNull(itemResponses.answeredAt)));
  return true;
}

const MAX_TEXT = 20_000;

/** Keeps only the answer fields that make sense for the item, trimmed to size. */
export function sanitizeAnswer(
  snapshot: ItemSnapshot,
  raw: unknown,
  previous: ItemAnswer | null,
  presentation: Presentation = {},
): ItemAnswer {
  const a = { ...((raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>) };
  // The browser answers with the aliased ids it was shown.
  if (Array.isArray(a.choiceIds))
    a.choiceIds = a.choiceIds.map((x) => (typeof x === "string" ? unalias(presentation, x) : null)).filter(Boolean);
  if (a.matches && typeof a.matches === "object")
    a.matches = Object.fromEntries(
      Object.entries(a.matches as Record<string, unknown>).map(([k, v]) => [k, typeof v === "string" ? unalias(presentation, v) : null]),
    );
  const c = snapshot.content;
  const out: ItemAnswer = {};
  if (c.kind === "CHOICE" && Array.isArray(a.choiceIds)) {
    const valid = new Set(c.options.map((o) => o.id));
    const ids = [...new Set(a.choiceIds.filter((x): x is string => typeof x === "string" && valid.has(x)))];
    out.choiceIds = snapshot.type === "SINGLE_CHOICE" ? ids.slice(0, 1) : ids;
  }
  if (c.kind === "TFNG" && a.tfng && typeof a.tfng === "object") {
    out.tfng = {};
    for (const s of c.statements) {
      const v = (a.tfng as Record<string, unknown>)[s.id];
      if (v === "R" || v === "F" || (v === "NG" && !c.twoWay)) out.tfng[s.id] = v;
    }
  }
  if (c.kind === "GAP" && a.gaps && typeof a.gaps === "object") {
    out.gaps = {};
    for (const g of c.gaps) {
      const v = (a.gaps as Record<string, unknown>)[g.id];
      if (typeof v === "string") out.gaps[g.id] = v.slice(0, 200);
    }
  }
  if (c.kind === "MATCHING" && a.matches && typeof a.matches === "object") {
    out.matches = {};
    const rights = new Set(c.right.map((r) => r.id));
    for (const l of c.left) {
      const v = (a.matches as Record<string, unknown>)[l.id];
      if (typeof v === "string" && rights.has(v)) out.matches[l.id] = v;
    }
  }
  const typedSpeaking = c.kind === "SPEAKING" && a.usedTextAlternative === true;
  if ((c.kind === "SHORT_TEXT" || c.kind === "WRITING" || typedSpeaking) && typeof a.text === "string") {
    out.text = a.text.slice(0, c.kind === "SHORT_TEXT" ? c.maxChars : MAX_TEXT);
  }
  // The recording is attached by the upload route, never by the client.
  if (previous?.mediaAssetId) out.mediaAssetId = previous.mediaAssetId;
  if (c.kind === "SPEAKING" && a.usedTextAlternative === true) out.usedTextAlternative = true;
  return out;
}

export async function saveDraft(ctx: ExamCandidateContext, response: typeof itemResponses.$inferSelect, raw: unknown) {
  const answer = sanitizeAnswer(response.itemSnapshot, raw, response.answer ?? null, response.presentation);
  // An autosave still in flight after "continue" must not overwrite the committed answer.
  await db
    .update(itemResponses)
    .set({ answer, updatedAt: new Date() })
    .where(and(eq(itemResponses.id, response.id), isNull(itemResponses.answeredAt)));
  return answer;
}

/**
 * Scores and closes one item. Never tells the student whether it was right.
 * In a navigable section nothing closes before the section does: "save and
 * continue" keeps the answer as a draft and moves to the next item, or to the
 * review step after the last one.
 */
export async function commitAnswer(
  ctx: ExamCandidateContext,
  run: typeof sectionRuns.$inferSelect,
  response: typeof itemResponses.$inferSelect,
  raw: unknown,
) {
  if (run.navigable) {
    if (raw !== undefined) await saveDraft(ctx, response, raw);
    const rows = await db.select({ sequence: itemResponses.sequence }).from(itemResponses).where(eq(itemResponses.sectionRunId, run.id));
    await moveTo(run, neighbour(rows.map((r) => r.sequence), response.sequence, 1) ?? "REVIEW");
    return;
  }
  const snap = response.itemSnapshot;
  const answer = raw === undefined ? (response.answer ?? {}) : sanitizeAnswer(snap, raw, response.answer ?? null, response.presentation);
  await scoreAndClose(ctx, run, response.id, snap, answer);
}

async function scoreAndClose(
  ctx: ExamCandidateContext,
  run: typeof sectionRuns.$inferSelect,
  responseId: string,
  snap: ItemSnapshot,
  answer: ItemAnswer,
) {
  const scored = scoreItem(snap.type, snap.content, snap.key, answer);
  const closed = await db
    .update(itemResponses)
    .set({
      answer,
      answeredAt: new Date(),
      score: scored?.score ?? null,
      isCorrect: scored?.correct ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(itemResponses.id, responseId), isNull(itemResponses.answeredAt)))
    .returning({ id: itemResponses.id });
  // A double click commits once; the second request changes nothing.
  if (scored && closed.length) await updateTheta(ctx, run, responseId);
}

/** Stores the running estimate after each objective answer, for the teacher's trajectory chart. */
async function updateTheta(ctx: ExamCandidateContext, run: typeof sectionRuns.$inferSelect, responseId: string) {
  const s = sectionConfigFor(ctx, run.section);
  const cfg = adaptiveConfigFor(s, ctx.assessment.mode, ctx.assessment.claimedLevel);
  const rows = await db.select().from(itemResponses).where(eq(itemResponses.sectionRunId, run.id));
  const state = replay(
    cfg,
    rows.map((r) => replayResponseOf(r, weighsTexts(s))),
  );
  await db
    .update(itemResponses)
    .set({ thetaAfter: state.posterior.mean, seAfter: state.posterior.sd })
    .where(eq(itemResponses.id, responseId));
}

/**
 * Closes a section. Used by the submit route, by the clock (cron and state
 * reads) and when the engine runs out of items. Idempotent.
 *
 * - A served item with a draft answer is scored as it stands: autosaved work counts.
 * - Fixed forms: planned items never reached are recorded and scored 0, so
 *   stopping early cannot beat answering.
 * - Writing and speaking answers get a grading row and go to the AI queue.
 */
export async function closeSectionRun(runId: string, reason: "DONE" | "SUBMIT" | "EXPIRED") {
  const claimed = await db
    .update(sectionRuns)
    .set({ submittedAt: new Date() })
    .where(and(eq(sectionRuns.id, runId), isNull(sectionRuns.submittedAt)))
    .returning();
  if (claimed.length === 0) return;
  const run = claimed[0];

  const [ctxRow] = await db
    .select({ exam: examAssessments })
    .from(attempts)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(eq(attempts.id, run.attemptId));
  const cfg = ctxRow.exam.blueprintSnapshot;
  const s = cfg.sections.find((x) => x.section === run.section)!;
  const mode = ctxRow.exam.mode;
  const claimedLevel = ctxRow.exam.claimedLevel;

  const responses = await db.select().from(itemResponses).where(eq(itemResponses.sectionRunId, runId));
  for (const r of responses.filter((x) => !x.answeredAt && !x.notReached)) {
    const snap = r.itemSnapshot;
    const answer = r.answer ?? {};
    const scored = scoreItem(snap.type, snap.content, snap.key, answer);
    // A navigable section presents every item, so a blank one was seen and left
    // empty: it closes as an answered blank, not as "not reached". An adaptive
    // section only serves what it needs, so an unanswered open item there stays
    // not reached.
    const blankSeen = run.navigable && !hasAnswer(snap.type, answer);
    await db
      .update(itemResponses)
      .set({
        answeredAt: hasAnswer(snap.type, answer) || blankSeen ? new Date() : null,
        notReached: !hasAnswer(snap.type, answer) && !run.navigable,
        score: scored ? (hasAnswer(snap.type, answer) ? scored.score : 0) : null,
        isCorrect: scored ? scored.correct && hasAnswer(snap.type, answer) : null,
      })
      .where(eq(itemResponses.id, r.id));
  }
  if (run.itemPlan) {
    const served = new Set(responses.map((r) => r.itemId));
    const objective = isObjectiveSection(run.section);
    let sequence = responses.length + 1;
    for (const itemId of run.itemPlan.filter((id) => !served.has(id))) {
      const snapshot = await buildSnapshot(itemId);
      await db
        .insert(itemResponses)
        .values({
          sectionRunId: runId,
          itemId,
          sequence,
          itemSnapshot: snapshot,
          notReached: true,
          score: objective ? 0 : null,
          isCorrect: objective ? false : null,
        })
        .onConflictDoNothing();
      sequence += 1;
    }
  }

  const all = await db.select().from(itemResponses).where(eq(itemResponses.sectionRunId, runId));
  let thetaMean: number | null = null;
  let thetaSd: number | null = null;
  let stopReason = run.stopReason;
  if (isObjectiveSection(run.section)) {
    const acfg = adaptiveConfigFor(s, mode, claimedLevel);
    const state = replay(
      acfg,
      all.map((r) => replayResponseOf(r, weighsTexts(s))),
    );
    thetaMean = state.posterior.mean;
    thetaSd = state.posterior.sd;
    // A navigable section scores everything at once, so the teacher's
    // trajectory chart is drawn here, in the order the items were served.
    if (run.navigable) await writeTrajectory(all, { mean: acfg.priorMean, sd: acfg.priorSd }, weighsTexts(s));
    const answered = all.filter((r) => r.answeredAt).length;
    if (s.adaptive && answered < s.minItems) {
      stopReason = "INSUFFICIENT";
      // Items the student never reached count as wrong, at the difficulty the
      // engine was about to ask. Otherwise stopping at once would leave the
      // estimate at the starting prior (B1, or the claim) and beat answering.
      const observations = all
        .filter((r) => r.score !== null)
        .map((r) => observationOf(r.itemSnapshot, r.score as number, weighsTexts(s)));
      const missing = s.minItems - answered;
      for (let i = 0; i < missing; i++) observations.push({ b: state.posterior.mean, score: 0 });
      const post = eap(observations, { mean: acfg.priorMean, sd: acfg.priorSd });
      thetaMean = post.mean;
      thetaSd = post.sd;
    }
  }
  // A blank closed in a navigable section has answeredAt set but no answer: still PARTIAL.
  const unanswered = all.filter((r) => !r.answeredAt || !hasAnswer(r.itemSnapshot.type, r.answer ?? {})).length;
  await db
    .update(sectionRuns)
    .set({
      completion: reason === "EXPIRED" ? "EXPIRED" : unanswered > 0 ? "PARTIAL" : "COMPLETE",
      wasLate: reason === "EXPIRED",
      thetaMean,
      thetaSd,
      stopReason,
    })
    .where(eq(sectionRuns.id, runId));

  if (!isObjectiveSection(run.section)) {
    const { openGradings } = await import("@/lib/exam-results");
    await openGradings(runId);
  }

  // The last section closes the attempt.
  const runs = await runsOf(run.attemptId);
  const enabled = cfg.sections.filter((x) => x.enabled).map((x) => x.section);
  const allDone = enabled.every((sec) => runs.find((r) => r.section === sec)?.submittedAt);
  if (allDone) await finishAttempt(run.attemptId);
  else {
    const { recomputeResult } = await import("@/lib/exam-results");
    await recomputeResult(run.attemptId);
  }
}

/** The running estimate after each scored item, in sequence order; blanks count as wrong, as in the final estimate. */
async function writeTrajectory(rows: ItemResponse[], prior: Posterior, weighTexts: boolean) {
  const observations: Observation[] = [];
  for (const r of [...rows].sort((a, b) => a.sequence - b.sequence)) {
    if (r.score === null) continue;
    observations.push(observationOf(r.itemSnapshot, r.score, weighTexts));
    const post = eap(observations, prior);
    await db.update(itemResponses).set({ thetaAfter: post.mean, seAfter: post.sd }).where(eq(itemResponses.id, r.id));
  }
}

export async function finishAttempt(attemptId: string) {
  const updated = await db
    .update(attempts)
    .set({ completedAt: new Date() })
    .where(and(eq(attempts.id, attemptId), isNull(attempts.completedAt)))
    .returning();
  const [attempt] = updated.length ? updated : await db.select().from(attempts).where(eq(attempts.id, attemptId));
  await db
    .update(assessmentLinks)
    .set({ status: "COMPLETED" })
    .where(and(eq(assessmentLinks.assessmentId, attempt.assessmentId), inArray(assessmentLinks.status, ["NOT_STARTED", "IN_PROGRESS"])));
  const { recomputeResult } = await import("@/lib/exam-results");
  await recomputeResult(attemptId);
}

/** Records one more play of a listening clip, refusing past the limit. */
export async function recordPlay(
  ctx: ExamCandidateContext,
  run: typeof sectionRuns.$inferSelect,
  stimulusId: string,
  clipMax?: number | null,
): Promise<{ ok: true; playsUsed: number; playsAllowed: number } | { ok: false }> {
  const max = playsAllowed(ctx.assessment.config.listening.maxPlays, clipMax);
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(sectionRuns).where(eq(sectionRuns.id, run.id)).for("update");
    const used = locked.stimulusPlays[stimulusId] ?? 0;
    if (used >= max) return { ok: false as const };
    await tx
      .update(sectionRuns)
      .set({ stimulusPlays: { ...locked.stimulusPlays, [stimulusId]: used + 1 } })
      .where(eq(sectionRuns.id, run.id));
    return { ok: true as const, playsUsed: used + 1, playsAllowed: max };
  });
}
