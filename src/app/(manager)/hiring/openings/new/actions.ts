"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiLimitReached } from "@/lib/ai-limit";
import { can } from "@/lib/authorize";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX } from "@/lib/library/positions";
import { requireUser } from "@/server/session";
import { roleBriefRequestSchema, type RoleBriefResult, type RoleRound } from "@/solutions/hiring/ai/role-brief";
import { generateRoleBrief } from "@/solutions/hiring/ai/role-brief-job";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";
import { createOpening, type CreateOpeningResult } from "@/solutions/hiring/server/openings";

const schema = z.object({
  position: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), id: z.uuid() }),
    z.object({ kind: z.literal("new"), name: z.string().max(POSITION_NAME_MAX), jobDescription: z.string().max(POSITION_JOB_AD_MAX) }),
  ]),
  start: z.enum(["AI", "COPY", "BLANK", "TEMPLATE"]),
  copyFrom: z.uuid().nullable(),
  templateKey: z.string().max(80).nullable().optional(),
  /** The job ad step 1's AI wrote (clarifyRoleAction's brief); used by an AI start only. */
  jobAd: z.string().max(POSITION_JOB_AD_MAX).nullable().optional(),
});

export type CreateOpeningActionResult = CreateOpeningResult | { ok: false; code: "INVALID" | "FAILED" };

/** "Alımı oluştur" (HIRING-UX 5.3). Every refusal comes back as a code the form turns into a sentence. */
export async function createOpeningAction(input: z.input<typeof schema>): Promise<CreateOpeningActionResult> {
  const user = await requireUser("opening:write");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID" };
  let result: CreateOpeningResult;
  try {
    result = await createOpening(user, parsed.data);
  } catch (error) {
    // A disabled creator or a row gone meanwhile: a sentence, never a raw error.
    if (error instanceof HiringNotFound || error instanceof HiringConflict || error instanceof HiringInvalid) return { ok: false, code: "FAILED" };
    throw error;
  }
  if (result.ok) revalidatePath("/hiring/openings");
  return result;
}

export type ClarifyRoleResult = { ok: true; result: RoleBriefResult } | { ok: false; code: "INVALID" | "RATE_LIMITED" | "UNCONFIGURED" | "FAILED" | "FORBIDDEN" };

/**
 * "Rolü anlat" (HIRING-UX 5.20, step 1): one turn of the role conversation.
 * The browser holds the conversation and sends it whole each time (`rounds`:
 * the questions asked so far and the answers given); the server keeps nothing
 * and writes only the ai_runs rows of the call. Same right as creating an
 * opening (opening:write), under the HIRING_ROLE_BRIEF limit. From the sixth
 * answered round on, the answer is always the brief.
 */
export async function clarifyRoleAction(input: { positionName: string; text: string; rounds: RoleRound[] }): Promise<ClarifyRoleResult> {
  const user = await requireUser();
  if (!can(user, "opening:write")) return { ok: false, code: "FORBIDDEN" };
  const parsed = roleBriefRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID" };
  if (await aiLimitReached(user.orgId, user.id, "HIRING_ROLE_BRIEF")) return { ok: false, code: "RATE_LIMITED" };
  const outcome = await generateRoleBrief({ ...parsed.data, orgId: user.orgId, userId: user.id });
  if (outcome.status === "OK") return { ok: true, result: outcome.result };
  return { ok: false, code: outcome.status === "UNCONFIGURED" ? "UNCONFIGURED" : "FAILED" };
}
