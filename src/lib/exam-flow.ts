import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  consents,
  consentTexts,
  examResults,
  itemResponses,
  items,
  organizations,
  sectionRuns,
  stimuli,
} from "@/db/schema";
import { sha256 } from "@/lib/auth";
import {
  eap,
  mulberry32,
  poolLeft,
  replay,
  selectNext,
  shouldStop,
  type PoolItem,
} from "@/lib/exam/adaptive";
import {
  adaptiveConfigFor,
  enabledSections,
  estimatedMinutes,
  productiveTaskLevels,
  resolveDistribution,
  sampleFixedForm,
  type BankItem,
  type BlueprintConfig,
  type SectionConfig,
} from "@/lib/exam/blueprint";
import { levelFromTheta } from "@/lib/exam/cefr";
import { hasAnswer, scoreItem } from "@/lib/exam/item-scoring";
import { poolPosteriors } from "@/lib/exam/result";
import { makePresentation, toCandidateItem, unalias, type CandidateItem } from "@/lib/exam/safe";
import {
  isObjectiveSection,
  type Cefr,
  type ExamMode,
  type ItemAnswer,
  type ItemSnapshot,
  type Presentation,
  type Section,
} from "@/lib/exam/types";
import { isProctored, type ProctoringPolicy } from "@/lib/proctor/policy";
import { SUBMIT_SLACK_MS } from "@/lib/timer";
import type { Locale } from "@/i18n/locale";

/**
 * The student side of an exam, server only.
 *
 * The rules this file keeps:
 *  - The token is the only credential. Every id used below is derived from it.
 *  - The server owns the clock. A section's deadline is written once, when it
 *    starts, and nothing the browser says moves it.
 *  - The server owns the item sequence. Which item comes next is decided here,
 *    under a row lock, and a reload returns the same item in the same order.
 *  - Nothing the student receives carries a key, a rubric, a difficulty or a
 *    listening transcript. Items go out only through `toCandidateItem`.
 *  - One attempt per invitation. A second try is a new invitation.
 */

export type LinkProblem = "INVALID" | "NOT_YET" | "EXPIRED" | "COMPLETED";

export type CandidateContext = {
  link: {
    id: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "RETAKE_AVAILABLE";
    expiresAt: Date;
    notBefore: Date | null;
    firstSeenIp: string | null;
  };
  assessment: {
    id: string;
    orgId: string;
    blueprintId: string;
    examName: string;
    mode: ExamMode;
    claimedLevel: Cefr | null;
    config: BlueprintConfig;
  };
  candidate: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
  };
  orgName: string;
  locale: Locale;
  contactEmail: string | null;
  contactName: string | null;
  mediaRetentionDays: number;
  evidenceRetentionDays: number;
};

export type ResolveResult =
  | { ok: true; ctx: CandidateContext }
  | { ok: false; problem: LinkProblem; ctx?: CandidateContext };

export async function resolveToken(rawToken: string): Promise<ResolveResult> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return { ok: false, problem: "INVALID" };
  const [row] = await db
    .select({ link: assessmentLinks, assessment: assessments, candidate: candidates, org: organizations })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .innerJoin(organizations, eq(organizations.id, assessments.orgId))
    .where(eq(assessmentLinks.tokenHash, sha256(rawToken)))
    .limit(1);
  if (!row || row.candidate.deletedAt) return { ok: false, problem: "INVALID" };

  const ctx: CandidateContext = {
    link: {
      id: row.link.id,
      status: row.link.status,
      expiresAt: row.link.expiresAt,
      notBefore: row.link.notBefore,
      firstSeenIp: row.link.firstSeenIp,
    },
    assessment: {
      id: row.assessment.id,
      orgId: row.assessment.orgId,
      // Non-null by the dual write; Task 7 moves this reader to exam_assessments.
      blueprintId: row.assessment.blueprintId!,
      examName: row.assessment.blueprintName!,
      mode: row.assessment.mode!,
      claimedLevel: row.assessment.claimedLevel,
      config: row.assessment.blueprintSnapshot!,
    },
    candidate: {
      id: row.candidate.id,
      fullName: row.candidate.fullName,
      email: row.candidate.email,
      phone: row.candidate.phone,
      location: row.candidate.location,
    },
    orgName: row.org.name,
    locale: row.assessment.locale,
    contactEmail: row.org.contactEmail,
    contactName: row.org.name,
    mediaRetentionDays: row.org.mediaRetentionDays,
    evidenceRetentionDays: row.org.evidenceRetentionDays,
  };

  const now = Date.now();
  if (row.link.status === "COMPLETED") return { ok: false, problem: "COMPLETED", ctx };
  if (row.link.status === "EXPIRED") return { ok: false, problem: "EXPIRED", ctx };
  if (row.link.notBefore && row.link.notBefore.getTime() > now) return { ok: false, problem: "NOT_YET", ctx };
  // A student already inside the exam keeps going past the link's expiry; the
  // section clocks, not the link, decide when writing stops.
  if (row.link.expiresAt.getTime() < now && row.link.status === "NOT_STARTED")
    return { ok: false, problem: "EXPIRED", ctx };
  return { ok: true, ctx };
}

export async function recordFirstSeen(ctx: CandidateContext, ip: string | null, userAgent: string | null) {
  if (ctx.link.firstSeenIp) return;
  await db
    .update(assessmentLinks)
    .set({ firstSeenIp: ip ?? "unknown", firstSeenUserAgent: userAgent })
    .where(and(eq(assessmentLinks.id, ctx.link.id), isNull(assessmentLinks.firstSeenIp)));
}

/** Interface languages offered to every student. Exam content is German either way. */
export const supportedLocales = (ctx: CandidateContext): Locale[] => (ctx ? ["tr", "en"] : ["tr"]);

export async function setAssessmentLocale(ctx: CandidateContext, locale: Locale) {
  await db.update(assessments).set({ locale }).where(eq(assessments.id, ctx.assessment.id));
  ctx.locale = locale;
}

export async function getConsentText(ctx: CandidateContext) {
  const [text] = await db
    .select()
    .from(consentTexts)
    .where(eq(consentTexts.orgId, ctx.assessment.orgId))
    .orderBy(desc(consentTexts.version))
    .limit(1);
  if (!text) throw new Error("no consent text configured for this organisation");
  return text;
}

export async function hasConsented(assessmentId: string) {
  const [row] = await db.select({ id: consents.id }).from(consents).where(eq(consents.assessmentId, assessmentId)).limit(1);
  return !!row;
}

export async function recordConsent(
  ctx: CandidateContext,
  consentTextId: string,
  ip: string | null,
  userAgent: string | null,
) {
  await db.insert(consents).values({
    assessmentId: ctx.assessment.id,
    consentTextId,
    locale: ctx.locale,
    ip,
    userAgent,
  });
}

/** The single attempt of this invitation, created on first need. */
export async function workingAttempt(assessmentId: string) {
  const [existing] = await db.select().from(attempts).where(eq(attempts.assessmentId, assessmentId)).limit(1);
  if (existing) return { attempt: existing, finished: !!existing.completedAt || !!existing.terminatedAt };
  const [created] = await db
    .insert(attempts)
    .values({ assessmentId, solution: "LANGUAGE_EXAM", attemptNumber: 1, isPrimary: true })
    .onConflictDoNothing()
    .returning();
  if (created) return { attempt: created, finished: false };
  const [again] = await db.select().from(attempts).where(eq(attempts.assessmentId, assessmentId)).limit(1);
  return { attempt: again, finished: !!again.completedAt || !!again.terminatedAt };
}

export async function recordDeviceCheck(attemptId: string) {
  await db
    .update(attempts)
    .set({ deviceCheckedAt: new Date() })
    .where(and(eq(attempts.id, attemptId), isNull(attempts.deviceCheckedAt)));
}

export const policyOf = (ctx: CandidateContext): ProctoringPolicy => ctx.assessment.config.proctoring;

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
  done: boolean;
};

export type StudentResult = {
  visibility: "NONE" | "OVERALL" | "FULL";
  released: boolean;
  /** Present only once the teacher released it and visibility allows. */
  overall?: Cefr | null;
  skills?: Array<{ section: Section; level: Cefr | null }>;
  outcome?: "PASS" | "FAIL" | "INCONCLUSIVE" | null;
  /** True when writing or speaking are waiting for a teacher. */
  awaitingTeacher: boolean;
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
    item: CandidateItem | null;
  };
  finished?: { terminated: boolean; terminationReason: string | null; result: StudentResult };
};

function itemsLabel(s: SectionConfig, mode: ExamMode, claimed: Cefr | null, offset: number): string {
  if (!isObjectiveSection(s.section)) return String(s.tasks);
  if (s.adaptive) return `${s.minItems}-${s.maxItems}`;
  const dist = resolveDistribution(s, mode, claimed, offset);
  return String(Object.values(dist).reduce((a, b) => a + b, 0));
}

async function runsOf(attemptId: string) {
  return db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attemptId)).orderBy(asc(sectionRuns.orderIndex));
}

export async function progressSummary(ctx: CandidateContext) {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.assessmentId, ctx.assessment.id)).limit(1);
  const total = enabledSections(ctx.assessment.config).length;
  if (!attempt) return { done: 0, total };
  const runs = await runsOf(attempt.id);
  return { done: runs.filter((r) => r.submittedAt).length, total };
}

export async function loadState(ctx: CandidateContext): Promise<CandidateState> {
  const cfg = ctx.assessment.config;
  const sections = enabledSections(cfg);
  const base: CandidateState = {
    step: "CONSENT",
    examName: ctx.assessment.examName,
    orgName: ctx.orgName,
    mode: ctx.assessment.mode,
    claimedLevel: ctx.assessment.claimedLevel,
    estimatedMinutes: estimatedMinutes(cfg),
    expiresAt: ctx.link.expiresAt.toISOString(),
    sections: sections.map((s, i) => ({
      section: s.section,
      position: i + 1,
      minutes: s.durationMinutes,
      itemsLabel: itemsLabel(s, ctx.assessment.mode, ctx.assessment.claimedLevel, cfg.difficultyOffset),
      done: false,
    })),
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

async function finishedState(
  ctx: CandidateContext,
  base: CandidateState,
  attempt: typeof attempts.$inferSelect,
): Promise<CandidateState> {
  const cfg = ctx.assessment.config;
  const [result] = await db.select().from(examResults).where(eq(examResults.attemptId, attempt.id)).limit(1);
  const hasProductive = enabledSections(cfg).some((s) => !isObjectiveSection(s.section));
  const released = !!result?.releasedAt;
  const student: StudentResult = {
    visibility: cfg.resultVisibility,
    released,
    awaitingTeacher: hasProductive && result?.status !== "FINAL",
  };
  if (released && cfg.resultVisibility !== "NONE") {
    student.overall = (result?.finalOverall as Cefr | null) ?? null;
    student.outcome = result?.finalOutcome ?? null;
    if (cfg.resultVisibility === "FULL") {
      student.skills = Object.entries(result?.finalSkills ?? {}).map(([section, s]) => ({
        section: section as Section,
        level: s.level as Cefr,
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
export async function currentSection(ctx: CandidateContext) {
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

/** Approved items the exam may serve. Listening clips without audio are left out. */
async function loadPool(orgId: string, section: Section): Promise<PoolRow[]> {
  const rows = await db
    .select({
      id: items.id,
      level: items.level,
      b: items.difficulty,
      skillTag: items.skillTag,
      stimulusId: items.stimulusId,
      orderInStimulus: items.orderInStimulus,
      audioKey: stimuli.audioKey,
    })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.orgId, orgId), eq(items.section, section), eq(items.status, "APPROVED")));
  return rows
    .filter((r) => section !== "LISTENING" || !!r.audioKey)
    .map((r) => ({
      id: r.id,
      level: r.level,
      b: r.b,
      skillTag: r.skillTag,
      stimulusId: r.stimulusId,
      orderInStimulus: r.orderInStimulus,
      section,
    }));
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

/** Picks one task per level, avoiding a skill tag twice when the bank allows. */
function pickProductive(pool: PoolRow[], levels: Cefr[], rng: () => number): string[] {
  const chosen: string[] = [];
  const tags = new Set<string>();
  for (const level of levels) {
    const candidates = pool.filter((p) => p.level === level && !chosen.includes(p.id));
    const fresh = candidates.filter((c) => !tags.has(c.skillTag));
    const from = fresh.length > 0 ? fresh : candidates;
    if (from.length === 0) continue;
    const pick = from[Math.floor(rng() * from.length)];
    chosen.push(pick.id);
    tags.add(pick.skillTag);
  }
  return chosen;
}

export type StartResult = { ok: true } | { ok: false; code: "SECTION_MISMATCH" | "NO_SECTION" | "BANK_EMPTY" | "NOT_READY" };

/**
 * The server's own check that the steps before the exam happened: consent was
 * recorded, the student's details exist, and a proctored exam passed its
 * system check. The pages enforce the order too, but a hand-made request must
 * not be able to skip them.
 */
async function readyForExam(ctx: CandidateContext, attempt: typeof attempts.$inferSelect): Promise<boolean> {
  if (!(await hasConsented(ctx.assessment.id))) return false;
  if (!ctx.candidate.fullName || !ctx.candidate.email) return false;
  if (isProctored(ctx.assessment.config.proctoring) && !attempt.deviceCheckedAt) return false;
  return true;
}

/**
 * Starts the current section. Idempotent: a second call, a double click or a
 * reload return the section as it is, and the deadline never moves.
 */
export async function startSection(ctx: CandidateContext, position: number): Promise<StartResult> {
  const current = await currentSection(ctx);
  if (!current) return { ok: false, code: "NO_SECTION" };
  if (!(await readyForExam(ctx, current.attempt))) return { ok: false, code: "NOT_READY" };
  if (current.position !== position) return { ok: false, code: "SECTION_MISMATCH" };
  if (current.run?.startedAt) return { ok: true };

  const s = current.config;
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  const pool = await loadPool(ctx.assessment.orgId, s.section);
  let itemPlan: string[] | null = null;
  let taskLevels: string[] | null = null;
  if (!isObjectiveSection(s.section)) {
    const provisional = await provisionalLevel(current.attempt.id);
    taskLevels = productiveTaskLevels(ctx.assessment.mode, ctx.assessment.claimedLevel, provisional, s.tasks);
    itemPlan = pickProductive(pool, taskLevels as Cefr[], rng);
  } else if (!s.adaptive) {
    const dist = resolveDistribution(s, ctx.assessment.mode, ctx.assessment.claimedLevel, ctx.assessment.config.difficultyOffset);
    itemPlan = sampleFixedForm(pool, dist, rng);
  }
  if ((itemPlan && itemPlan.length === 0) || pool.length === 0) {
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

async function buildSnapshot(itemId: string): Promise<ItemSnapshot> {
  const [row] = await db
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
    const snapshot = applyOverrides(await buildSnapshot(itemId), s);
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

function sectionConfigFor(ctx: CandidateContext, section: Section): SectionConfig {
  const s = ctx.assessment.config.sections.find((x) => x.section === section);
  if (!s) throw new Error(`section ${section} is not in this exam`);
  return s;
}

/**
 * The item the student should see now, creating it if needed. Returns null
 * when the section has nothing left to serve.
 */
export async function ensureCurrentItem(ctx: CandidateContext, runId: string): Promise<CandidateItem | null> {
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
        responses.map((r) => ({
          itemId: r.itemId,
          b: r.itemSnapshot.difficulty,
          skillTag: r.itemSnapshot.skillTag,
          stimulusId: r.itemSnapshot.stimulusId,
          score: r.score,
        })),
      );
      const pool: PoolItem[] = await loadPool(ctx.assessment.orgId, run.section);
      const stop = shouldStop(state, cfg, poolLeft(pool, state));
      if (stop) {
        await tx.update(sectionRuns).set({ stopReason: stop }).where(eq(sectionRuns.id, runId));
        return null;
      }
      const next = selectNext(state, pool, cfg, mulberry32(Math.floor(Math.random() * 2 ** 31)));
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

export async function candidateItemFor(ctx: CandidateContext, responseId: string): Promise<CandidateItem> {
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

export type WriteCheck =
  | { ok: true; run: typeof sectionRuns.$inferSelect; response: typeof itemResponses.$inferSelect }
  | { ok: false; code: "NO_SECTION" | "NOT_READY" | "SECTION_MISMATCH" | "SECTION_NOT_STARTED" | "SECTION_EXPIRED" | "ITEM_MISMATCH" };

/**
 * Every write names the section position and item sequence it believes it is
 * on. If the server disagrees (a second tab, a stale screen) the write is
 * refused rather than landing on the wrong item.
 */
export async function checkWrite(ctx: CandidateContext, position: unknown, sequence: unknown): Promise<WriteCheck> {
  const current = await currentSection(ctx);
  if (!current) return { ok: false, code: "NO_SECTION" };
  if (!(await readyForExam(ctx, current.attempt))) return { ok: false, code: "NOT_READY" };
  if (current.position !== position) return { ok: false, code: "SECTION_MISMATCH" };
  const run = current.run;
  if (!run?.startedAt || !run.deadlineAt) return { ok: false, code: "SECTION_NOT_STARTED" };
  if (Date.now() > run.deadlineAt.getTime() + SUBMIT_SLACK_MS) return { ok: false, code: "SECTION_EXPIRED" };
  if (typeof sequence !== "number") return { ok: false, code: "ITEM_MISMATCH" };
  const [response] = await db
    .select()
    .from(itemResponses)
    .where(and(eq(itemResponses.sectionRunId, run.id), eq(itemResponses.sequence, sequence)));
  if (!response || response.answeredAt || response.notReached) return { ok: false, code: "ITEM_MISMATCH" };
  const [firstOpen] = await db
    .select({ sequence: itemResponses.sequence })
    .from(itemResponses)
    .where(and(eq(itemResponses.sectionRunId, run.id), isNull(itemResponses.answeredAt), eq(itemResponses.notReached, false)))
    .orderBy(asc(itemResponses.sequence))
    .limit(1);
  if (firstOpen && firstOpen.sequence !== sequence) return { ok: false, code: "ITEM_MISMATCH" };
  return { ok: true, run, response };
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
      if (v === "R" || v === "F" || v === "NG") out.tfng[s.id] = v;
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

export async function saveDraft(ctx: CandidateContext, response: typeof itemResponses.$inferSelect, raw: unknown) {
  const answer = sanitizeAnswer(response.itemSnapshot, raw, response.answer ?? null, response.presentation);
  // An autosave still in flight after "continue" must not overwrite the committed answer.
  await db
    .update(itemResponses)
    .set({ answer, updatedAt: new Date() })
    .where(and(eq(itemResponses.id, response.id), isNull(itemResponses.answeredAt)));
  return answer;
}

/** Scores and closes one item. Never tells the student whether it was right. */
export async function commitAnswer(
  ctx: CandidateContext,
  run: typeof sectionRuns.$inferSelect,
  response: typeof itemResponses.$inferSelect,
  raw: unknown,
) {
  const snap = response.itemSnapshot;
  const answer = raw === undefined ? (response.answer ?? {}) : sanitizeAnswer(snap, raw, response.answer ?? null, response.presentation);
  await scoreAndClose(ctx, run, response.id, snap, answer);
}

async function scoreAndClose(
  ctx: CandidateContext,
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
async function updateTheta(ctx: CandidateContext, run: typeof sectionRuns.$inferSelect, responseId: string) {
  const s = sectionConfigFor(ctx, run.section);
  const cfg = adaptiveConfigFor(s, ctx.assessment.mode, ctx.assessment.claimedLevel);
  const rows = await db.select().from(itemResponses).where(eq(itemResponses.sectionRunId, run.id));
  const state = replay(
    cfg,
    rows.map((r) => ({
      itemId: r.itemId,
      b: r.itemSnapshot.difficulty,
      skillTag: r.itemSnapshot.skillTag,
      stimulusId: r.itemSnapshot.stimulusId,
      score: r.score,
    })),
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
    .select({ assessment: assessments, attempt: attempts })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(attempts.id, run.attemptId));
  // Non-null by the dual write; Task 7 moves this reader to exam_assessments.
  const cfg = ctxRow.assessment.blueprintSnapshot!;
  const s = cfg.sections.find((x) => x.section === run.section)!;
  const mode = ctxRow.assessment.mode!;
  const claimedLevel = ctxRow.assessment.claimedLevel;

  const responses = await db.select().from(itemResponses).where(eq(itemResponses.sectionRunId, runId));
  for (const r of responses.filter((x) => !x.answeredAt && !x.notReached)) {
    const snap = r.itemSnapshot;
    const answer = r.answer ?? {};
    const scored = scoreItem(snap.type, snap.content, snap.key, answer);
    await db
      .update(itemResponses)
      .set({
        answeredAt: hasAnswer(snap.type, answer) ? new Date() : null,
        notReached: !hasAnswer(snap.type, answer),
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
      all.map((r) => ({
        itemId: r.itemId,
        b: r.itemSnapshot.difficulty,
        skillTag: r.itemSnapshot.skillTag,
        stimulusId: r.itemSnapshot.stimulusId,
        score: r.score,
      })),
    );
    thetaMean = state.posterior.mean;
    thetaSd = state.posterior.sd;
    const answered = all.filter((r) => r.answeredAt).length;
    if (s.adaptive && answered < s.minItems) {
      stopReason = "INSUFFICIENT";
      // Items the student never reached count as wrong, at the difficulty the
      // engine was about to ask. Otherwise stopping at once would leave the
      // estimate at the starting prior (B1, or the claim) and beat answering.
      const observations = all
        .filter((r) => r.score !== null)
        .map((r) => ({ b: r.itemSnapshot.difficulty, score: r.score as number }));
      const missing = s.minItems - answered;
      for (let i = 0; i < missing; i++) observations.push({ b: state.posterior.mean, score: 0 });
      const post = eap(observations, { mean: acfg.priorMean, sd: acfg.priorSd });
      thetaMean = post.mean;
      thetaSd = post.sd;
    }
  }
  const unanswered = all.filter((r) => !r.answeredAt).length;
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
  ctx: CandidateContext,
  run: typeof sectionRuns.$inferSelect,
  stimulusId: string,
): Promise<{ ok: true; playsUsed: number } | { ok: false }> {
  const max = ctx.assessment.config.listening.maxPlays;
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(sectionRuns).where(eq(sectionRuns.id, run.id)).for("update");
    const used = locked.stimulusPlays[stimulusId] ?? 0;
    if (used >= max) return { ok: false as const };
    await tx
      .update(sectionRuns)
      .set({ stimulusPlays: { ...locked.stimulusPlays, [stimulusId]: used + 1 } })
      .where(eq(sectionRuns.id, run.id));
    return { ok: true as const, playsUsed: used + 1 };
  });
}
