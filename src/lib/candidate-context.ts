import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  consents,
  consentTexts,
  organizations,
} from "@/db/schema";
import { sha256 } from "@/lib/auth";
import type { Locale } from "@/i18n/locale";

/**
 * The candidate side of the core, server only. Every solution's candidate flow
 * starts here: the token is the only credential, and everything else (link,
 * invitation, person, organisation) is derived from it on the server.
 *
 * Nothing in this file knows what a solution does with the invitation. The
 * exam reads its own terms through `loadExamContext` in exam-flow.
 */

export type LinkProblem = "INVALID" | "NOT_YET" | "EXPIRED" | "COMPLETED";
export type SolutionKind = (typeof assessments.$inferSelect)["solution"];

export type CandidateContext = {
  link: {
    id: string;
    status: (typeof assessmentLinks.$inferSelect)["status"];
    expiresAt: Date;
    notBefore: Date | null;
    firstSeenIp: string | null;
  };
  assessment: {
    id: string;
    orgId: string;
    solution: SolutionKind;
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

export type ResolveResult<C extends CandidateContext = CandidateContext> =
  | { ok: true; ctx: C }
  | { ok: false; problem: LinkProblem; ctx?: C };

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
      solution: row.assessment.solution,
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
  // A candidate already inside keeps going past the link's expiry; the
  // solution's own clocks, not the link, decide when writing stops.
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

/** Interface languages offered to every candidate. */
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

/**
 * The invitation's latest attempt, created on first need. The language exam
 * has exactly one (the database enforces it); a hiring retake adds attempt 2,
 * 3 and this returns the newest.
 */
export async function currentAttempt(assessment: { id: string; solution: SolutionKind }) {
  const latest = () =>
    db
      .select()
      .from(attempts)
      .where(eq(attempts.assessmentId, assessment.id))
      .orderBy(desc(attempts.attemptNumber))
      .limit(1);
  const [existing] = await latest();
  if (existing) return { attempt: existing, finished: !!existing.completedAt || !!existing.terminatedAt };
  const [created] = await db
    .insert(attempts)
    .values({ assessmentId: assessment.id, solution: assessment.solution, attemptNumber: 1, isPrimary: true })
    .onConflictDoNothing()
    .returning();
  if (created) return { attempt: created, finished: false };
  const [again] = await latest();
  return { attempt: again, finished: !!again.completedAt || !!again.terminatedAt };
}

export async function recordDeviceCheck(attemptId: string) {
  await db
    .update(attempts)
    .set({ deviceCheckedAt: new Date() })
    .where(and(eq(attempts.id, attemptId), isNull(attempts.deviceCheckedAt)));
}
