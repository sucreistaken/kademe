import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, auditLogs, candidates, examBlueprints, messageOutbox } from "@/db/schema";
import { mintToken } from "@/lib/auth";
import type { Cefr } from "@/lib/exam/types";

/**
 * Invites one student to one exam. Shared by the panel, the seed and the dev
 * scripts so there is exactly one place that knows what an invitation is.
 *
 * The blueprint's config is copied onto the assessment here. That copy is the
 * exam this student takes, whatever happens to the blueprint afterwards.
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
  | { ok: true; assessmentId: string; candidateId: string; rawToken: string; url: string }
  | { ok: false; code: "BLUEPRINT_NOT_FOUND" | "NOT_PUBLISHED" | "CLAIM_REQUIRED" };

export async function createInvitation(input: InviteInput): Promise<InviteResult> {
  const [blueprint] = await db
    .select()
    .from(examBlueprints)
    .where(and(eq(examBlueprints.id, input.blueprintId), eq(examBlueprints.orgId, input.orgId)));
  if (!blueprint) return { ok: false, code: "BLUEPRINT_NOT_FOUND" };
  if (blueprint.status !== "PUBLISHED") return { ok: false, code: "NOT_PUBLISHED" };
  if (blueprint.mode === "LEVEL_VERIFICATION" && !input.claimedLevel) return { ok: false, code: "CLAIM_REQUIRED" };

  const token = mintToken();
  const expiresAt = new Date(Date.now() + (input.ttlDays ?? LINK_TTL_DAYS) * 86_400_000);
  const url = `${input.baseUrl ?? process.env.APP_ORIGIN ?? "http://localhost:3100"}/a/${token.raw}`;

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
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        blueprintSnapshot: blueprint.config,
        mode: blueprint.mode,
        claimedLevel: blueprint.mode === "LEVEL_VERIFICATION" ? input.claimedLevel : null,
        locale: input.locale,
        invitedBy: input.invitedBy,
      })
      .returning();
    await tx.insert(assessmentLinks).values({
      assessmentId: assessment.id,
      tokenHash: token.hash,
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
  return { ok: true, ...result, rawToken: token.raw, url };
}
