import { createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, auditLogs, candidates, examAssessments, examBlueprints, messageOutbox } from "@/db/schema";
import { mintToken, safeEqual, sha256 } from "@/lib/auth";
import type { Cefr } from "@/lib/exam/types";
import { resolveSigningSecret } from "@/lib/signing-secret";

/**
 * Invites one student to one exam. Shared by the panel, the seed and the dev
 * scripts so there is exactly one place that knows what an invitation is.
 *
 * The blueprint's config is copied onto the assessment here. That copy is the
 * exam this student takes, whatever happens to the blueprint afterwards.
 *
 * Nothing is e-mailed: the row in message_outbox is the future mail path and
 * nothing reads it yet. The school shares each link itself, so the link must
 * stay retrievable for the panel (inviteLink), while the database still only
 * holds the token's hash: the raw token is an HMAC of the link row's id under
 * the server's secret, so a database read alone never yields it.
 */

export const LINK_TTL_DAYS = 14;

export type InviteInput = {
  orgId: string;
  blueprintId: string;
  fullName: string;
  email: string;
  claimedLevel: Cefr | null;
  locale: "tr" | "en";
  invitedBy: string | null;
  baseUrl?: string;
  ttlDays?: number;
};

export type InviteResult =
  | { ok: true; assessmentId: string; candidateId: string; rawToken: string; url: string; expiresAt: Date }
  | { ok: false; code: "BLUEPRINT_NOT_FOUND" | "NOT_PUBLISHED" | "CLAIM_REQUIRED" };

/**
 * The exam link's raw token for one link row: 32 bytes of HMAC-SHA256 of the
 * row's id, base64url, the same shape as a random token. Without the secret
 * it cannot be computed from the id.
 */
export function examLinkToken(linkId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kademe:exam-link:v1:${linkId}`).digest("base64url");
}

/**
 * The secret links are derived with, or null where the server has none (a
 * production without AUTH_SECRET). Inviting never depends on it: without it
 * the token is random, as before, and the panel says the link cannot be
 * shown again.
 */
function linkSecret(): string | null {
  try {
    return resolveSigningSecret(process.env);
  } catch {
    return null;
  }
}
const origin = (baseUrl?: string) => baseUrl ?? process.env.APP_ORIGIN ?? "http://localhost:3100";
export const examLinkUrl = (raw: string, baseUrl?: string) => `${origin(baseUrl)}/a/${raw}`;

export async function createInvitation(input: InviteInput): Promise<InviteResult> {
  const [blueprint] = await db
    .select()
    .from(examBlueprints)
    .where(and(eq(examBlueprints.id, input.blueprintId), eq(examBlueprints.orgId, input.orgId)));
  if (!blueprint) return { ok: false, code: "BLUEPRINT_NOT_FOUND" };
  if (blueprint.status !== "PUBLISHED") return { ok: false, code: "NOT_PUBLISHED" };
  if (blueprint.mode === "LEVEL_VERIFICATION" && !input.claimedLevel) return { ok: false, code: "CLAIM_REQUIRED" };

  const linkId = randomUUID();
  const s = linkSecret();
  const raw = s ? examLinkToken(linkId, s) : mintToken().raw;
  const expiresAt = new Date(Date.now() + (input.ttlDays ?? LINK_TTL_DAYS) * 86_400_000);
  const url = examLinkUrl(raw, input.baseUrl);

  const result = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .insert(candidates)
      .values({ orgId: input.orgId, fullName: input.fullName, email: input.email })
      .returning();
    const [assessment] = await tx
      .insert(assessments)
      .values({
        orgId: input.orgId,
        candidateId: candidate.id,
        solution: "LANGUAGE_EXAM",
        locale: input.locale,
        invitedBy: input.invitedBy,
      })
      .returning();
    await tx.insert(examAssessments).values({
      assessmentId: assessment.id,
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
      blueprintSnapshot: blueprint.config,
      mode: blueprint.mode,
      claimedLevel: blueprint.mode === "LEVEL_VERIFICATION" ? input.claimedLevel : null,
    });
    await tx.insert(assessmentLinks).values({
      id: linkId,
      assessmentId: assessment.id,
      tokenHash: sha256(raw),
      status: "NOT_STARTED",
      expiresAt,
      attemptsAllowed: 1,
    });
    await tx.insert(messageOutbox).values({
      orgId: input.orgId,
      kind: "INVITE",
      toEmail: input.email,
      subject: input.locale === "en" ? `Your German exam: ${blueprint.name}` : `Almanca sınavınız: ${blueprint.name}`,
      body: `${url}`,
    });
    await tx.insert(auditLogs).values({
      orgId: input.orgId,
      actorId: input.invitedBy,
      action: "student.invite",
      subjectType: "assessment",
      subjectId: assessment.id,
      meta: { blueprintId: blueprint.id, mode: blueprint.mode, claimedLevel: input.claimedLevel },
    });
    return { assessmentId: assessment.id, candidateId: candidate.id };
  });
  return { ok: true, ...result, rawToken: raw, url, expiresAt };
}

export type InviteLinkResult =
  | { ok: true; url: string; expiresAt: Date }
  /**
   * NOT_FOUND: no such exam invitation in this organisation. USED: the exam is
   * finished, the link opens nothing. EXPIRED: past its last day or replaced.
   * NOT_RECOVERABLE: an invitation from before links were derived (its token
   * was random and only its hash is stored), or the server's secret changed.
   */
  | { ok: false; code: "NOT_FOUND" | "USED" | "EXPIRED" | "NOT_RECOVERABLE" };

/** Which link of an invitation the panel may hand out again, pure. */
export function linkVerdict(
  link: { id: string; tokenHash: string; status: string; expiresAt: Date },
  now: Date,
  secretValue: string,
): { ok: true; raw: string } | { ok: false; code: "USED" | "EXPIRED" | "NOT_RECOVERABLE" } {
  if (link.status === "COMPLETED") return { ok: false, code: "USED" };
  if (link.status === "EXPIRED" || link.expiresAt.getTime() <= now.getTime()) return { ok: false, code: "EXPIRED" };
  const raw = examLinkToken(link.id, secretValue);
  return safeEqual(sha256(raw), link.tokenHash) ? { ok: true, raw } : { ok: false, code: "NOT_RECOVERABLE" };
}

/**
 * The live link of one exam invitation, again, for the panel's "Linki
 * kopyala". Only the organisation's own exam invitation, only while the link
 * still opens the exam (not started or in progress, before its last day).
 * Each reveal is written to the audit log.
 */
export async function inviteLink(input: { orgId: string; assessmentId: string; actorId: string; baseUrl?: string; now?: Date }): Promise<InviteLinkResult> {
  const rows = await db
    .select({ id: assessmentLinks.id, tokenHash: assessmentLinks.tokenHash, status: assessmentLinks.status, expiresAt: assessmentLinks.expiresAt })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .where(and(eq(assessmentLinks.assessmentId, input.assessmentId), eq(assessments.orgId, input.orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  // At most one link is not EXPIRED (one_active_link_per_assessment); replaced ones stay as EXPIRED rows.
  const link = rows.find((r) => r.status !== "EXPIRED") ?? rows[0] ?? null;
  if (!link) return { ok: false, code: "NOT_FOUND" };
  const s = linkSecret();
  if (!s) return { ok: false, code: "NOT_RECOVERABLE" };
  const verdict = linkVerdict(link, input.now ?? new Date(), s);
  if (!verdict.ok) return verdict;
  await db.insert(auditLogs).values({
    orgId: input.orgId,
    actorId: input.actorId,
    action: "student.link.show",
    subjectType: "assessment",
    subjectId: input.assessmentId,
    meta: null,
  });
  return { ok: true, url: examLinkUrl(verdict.raw, input.baseUrl), expiresAt: link.expiresAt };
}
