import { and, asc, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  examBlueprints,
  examResultRevisions,
  examResults,
  itemResponses,
  items,
  mediaAssets,
  proctorAiReviews,
  proctorEvents,
  proctorEvidence,
  proctorSessions,
  responseGradingRevisions,
  responseGradings,
  sectionRuns,
  stimuli,
  transcripts,
  users,
} from "@/db/schema";
import type { BankCount } from "@/lib/exam/blueprint";
import { enabledSections } from "@/lib/exam/blueprint";
import type { Cefr, Section } from "@/lib/exam/types";
import { getStorage } from "@/lib/storage";

/**
 * Read models for the teacher panel. Pages call these; nothing here writes.
 */

export type StudentStatus =
  | "NOT_STARTED"
  | "IN_EXAM"
  | "AWAITING_GRADING"
  | "AWAITING_REVIEW"
  | "FINAL"
  | "RELEASED"
  | "EXPIRED";

export type StudentRow = {
  assessmentId: string;
  name: string;
  email: string;
  examName: string;
  mode: "PLACEMENT" | "LEVEL_VERIFICATION";
  claimed: Cefr | null;
  status: StudentStatus;
  level: Cefr | null;
  levelFinal: boolean;
  outcome: "PASS" | "FAIL" | "INCONCLUSIVE" | null;
  integrity: "CLEAR" | "REVIEW" | "ATTENTION" | "NONE" | "PENDING";
  invitedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  linkId: string | null;
  currentSection: Section | null;
  aiProposals: number;
};

export async function listStudents(orgId: string): Promise<StudentRow[]> {
  const rows = await db
    .select({
      assessment: assessments,
      candidate: candidates,
      attempt: attempts,
      result: examResults,
    })
    .from(assessments)
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .leftJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .leftJoin(examResults, eq(examResults.attemptId, attempts.id))
    .where(and(eq(assessments.orgId, orgId), sql`${candidates.deletedAt} is null`))
    .orderBy(desc(assessments.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.assessment.id);
  const links = await db.select().from(assessmentLinks).where(inArray(assessmentLinks.assessmentId, ids));
  const attemptIds = rows.map((r) => r.attempt?.id).filter((x): x is string => !!x);
  const openRuns = attemptIds.length
    ? await db
        .select({ attemptId: sectionRuns.attemptId, section: sectionRuns.section })
        .from(sectionRuns)
        .where(and(inArray(sectionRuns.attemptId, attemptIds), sql`${sectionRuns.submittedAt} is null`, sql`${sectionRuns.startedAt} is not null`))
    : [];
  const proposals = attemptIds.length
    ? await db
        .select({ attemptId: sectionRuns.attemptId, n: sql<number>`count(*)::int` })
        .from(responseGradings)
        .innerJoin(itemResponses, eq(itemResponses.id, responseGradings.itemResponseId))
        .innerJoin(sectionRuns, eq(sectionRuns.id, itemResponses.sectionRunId))
        .where(and(inArray(sectionRuns.attemptId, attemptIds), inArray(responseGradings.status, ["AI_PROPOSED", "AI_FAILED"])))
        .groupBy(sectionRuns.attemptId)
    : [];

  return rows.map(({ assessment, candidate, attempt, result }) => {
    const myLinks = links.filter((l) => l.assessmentId === assessment.id);
    const link = myLinks.find((l) => l.status !== "EXPIRED") ?? myLinks[0] ?? null;
    let status: StudentStatus;
    if (result?.releasedAt) status = "RELEASED";
    else if (result?.status === "FINAL") status = "FINAL";
    else if (attempt?.completedAt || attempt?.terminatedAt)
      status = result?.status === "AWAITING_GRADING" ? "AWAITING_GRADING" : "AWAITING_REVIEW";
    else if (attempt?.startedAt) status = "IN_EXAM";
    else if (link?.status === "EXPIRED") status = "EXPIRED";
    else status = "NOT_STARTED";
    const proctored = assessment.blueprintSnapshot.proctoring.preset !== "OFF";
    const integrity = !proctored ? "NONE" : attempt?.integritySummary?.level ?? "PENDING";
    const final = result?.status === "FINAL";
    return {
      assessmentId: assessment.id,
      name: candidate.fullName ?? "",
      email: candidate.email ?? "",
      examName: assessment.blueprintName,
      mode: assessment.mode,
      claimed: assessment.claimedLevel,
      status,
      level: ((final ? result?.finalOverall : result?.computed?.overall) ?? null) as Cefr | null,
      levelFinal: final,
      outcome: final ? (result?.finalOutcome ?? null) : (result?.computed?.verification?.outcome ?? null),
      integrity,
      invitedAt: assessment.createdAt,
      completedAt: attempt?.completedAt ?? null,
      expiresAt: link?.expiresAt ?? null,
      linkId: link && link.status === "NOT_STARTED" ? link.id : null,
      currentSection: openRuns.find((r) => r.attemptId === attempt?.id)?.section ?? null,
      aiProposals: proposals.find((p) => p.attemptId === attempt?.id)?.n ?? 0,
    };
  });
}

/** Approved, servable items per section and level; listening needs audio. */
export async function bankCounts(orgId: string): Promise<BankCount[]> {
  const rows = await db
    .select({
      section: items.section,
      level: items.level,
      n: sql<number>`count(*)::int`,
      s: sql<number>`count(distinct ${items.stimulusId})::int`,
    })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(
      and(
        eq(items.orgId, orgId),
        eq(items.status, "APPROVED"),
        sql`(${items.section} <> 'LISTENING' or ${stimuli.audioKey} is not null)`,
      ),
    )
    .groupBy(items.section, items.level);
  return rows.map((r) => ({ section: r.section, level: r.level, items: r.n, stimuli: r.s }));
}

export async function publishedBlueprints(orgId: string) {
  return db
    .select()
    .from(examBlueprints)
    .where(and(eq(examBlueprints.orgId, orgId), eq(examBlueprints.status, "PUBLISHED")))
    .orderBy(asc(examBlueprints.name));
}

export async function expiringLinks(orgId: string) {
  const soon = new Date(Date.now() + 48 * 3600_000);
  return db
    .select({ link: assessmentLinks, name: candidates.fullName, assessmentId: assessments.id })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .where(
      and(
        eq(assessments.orgId, orgId),
        eq(assessmentLinks.status, "NOT_STARTED"),
        lt(assessmentLinks.expiresAt, soon),
        gt(assessmentLinks.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(assessmentLinks.expiresAt));
}

// ---------------------------------------------------------------------------
// One student's result
// ---------------------------------------------------------------------------

export async function loadResultView(orgId: string, assessmentId: string) {
  const [head] = await db
    .select({ assessment: assessments, candidate: candidates, attempt: attempts, result: examResults })
    .from(assessments)
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .leftJoin(attempts, eq(attempts.assessmentId, assessments.id))
    .leftJoin(examResults, eq(examResults.attemptId, attempts.id))
    .where(and(eq(assessments.id, assessmentId), eq(assessments.orgId, orgId)));
  if (!head) return null;
  const attempt = head.attempt;
  const cfg = head.assessment.blueprintSnapshot;
  const runs = attempt
    ? await db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attempt.id)).orderBy(asc(sectionRuns.orderIndex))
    : [];
  const responses = runs.length
    ? await db
        .select()
        .from(itemResponses)
        .where(inArray(itemResponses.sectionRunId, runs.map((r) => r.id)))
        .orderBy(asc(itemResponses.sequence))
    : [];
  const gradings = responses.length
    ? await db.select().from(responseGradings).where(inArray(responseGradings.itemResponseId, responses.map((r) => r.id)))
    : [];
  const gradingRevs = gradings.length
    ? await db
        .select()
        .from(responseGradingRevisions)
        .where(inArray(responseGradingRevisions.gradingId, gradings.map((g) => g.id)))
        .orderBy(desc(responseGradingRevisions.at))
    : [];
  const resultRevs = head.result
    ? await db.select().from(examResultRevisions).where(eq(examResultRevisions.resultId, head.result.id)).orderBy(desc(examResultRevisions.at))
    : [];
  const mediaIds = responses.map((r) => r.answer?.mediaAssetId).filter((x): x is string => !!x);
  const media = mediaIds.length ? await db.select().from(mediaAssets).where(inArray(mediaAssets.id, mediaIds)) : [];
  const trans = mediaIds.length ? await db.select().from(transcripts).where(inArray(transcripts.mediaAssetId, mediaIds)) : [];
  const storage = getStorage();
  const mediaUrls: Record<string, string> = {};
  for (const m of media) {
    if (m.status === "READY" || m.status === "INCOMPLETE") mediaUrls[m.id] = await storage.getSignedUrl(m.storageKey, 3600);
  }
  const userIds = [
    ...new Set(
      [
        ...gradings.map((g) => g.decidedBy),
        ...gradingRevs.map((r) => r.changedBy),
        ...resultRevs.map((r) => r.changedBy),
        head.result?.finalizedBy,
        attempt?.integrityDecidedBy,
      ].filter((x): x is string => !!x),
    ),
  ];
  const people = userIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [];
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));

  return {
    assessment: head.assessment,
    candidate: head.candidate,
    attempt,
    result: head.result,
    sections: enabledSections(cfg).map((s) => s.section),
    runs,
    responses,
    gradings,
    gradingRevs,
    resultRevs,
    media,
    mediaUrls,
    transcripts: trans,
    nameOf,
  };
}

export async function loadIntegrityView(attemptId: string) {
  const events = await db
    .select({ event: proctorEvents, review: proctorAiReviews })
    .from(proctorEvents)
    .leftJoin(proctorAiReviews, eq(proctorAiReviews.eventId, proctorEvents.id))
    .where(eq(proctorEvents.attemptId, attemptId))
    .orderBy(asc(proctorEvents.startedAt));
  const evidence = await db
    .select()
    .from(proctorEvidence)
    .where(and(eq(proctorEvidence.attemptId, attemptId), ne(proctorEvidence.kind, "CLIP_AUDIO")))
    .orderBy(asc(proctorEvidence.capturedAt));
  const sessions = await db.select().from(proctorSessions).where(eq(proctorSessions.attemptId, attemptId));
  const storage = getStorage();
  const urls: Record<string, string> = {};
  for (const e of evidence) urls[e.id] = await storage.getSignedUrl(e.storageKey, 3600);
  return { events, evidence, sessions, urls };
}
