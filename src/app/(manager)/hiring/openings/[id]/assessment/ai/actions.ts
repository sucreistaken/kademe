"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { managerLocale } from "@/i18n/manager-locale";
import { aiLimitReached } from "@/lib/ai-limit";
import { can } from "@/lib/authorize";
import { COMPETENCY_NAME_MAX } from "@/lib/library/anchors";
import { archiveCompetencyIfUnused, findOrCreateCompetency, setPositionJobAdIfEmpty } from "@/server/library-write";
import { isUuid } from "@/server/settings";
import { jobAdProblem, SUGGESTABLE_TYPES } from "@/solutions/hiring/ai/draft";
import { generateHiringDraft } from "@/solutions/hiring/ai/draft-job";
import { stagePayloadSchema, type StagePayload } from "@/solutions/hiring/rules/patches";
import { draftLibrary } from "@/solutions/hiring/server/draft-context";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";
import { deleteStage, insertStage } from "@/solutions/hiring/server/versions";
import { workingState } from "@/solutions/hiring/server/working";
import { editableOpening } from "../../access";
import type { AcceptCompetencyResult, AcceptStageResult, AiDone, AiRefusal, GenerateResult } from "./result";

/**
 * The AI draft screen (HIRING-UX 5.6). AI proposes, people decide: generating
 * writes nothing to the assessment (only an empty position gets the pasted
 * ad), and every card is written by its own click. Every action first asks for
 * the right to edit this opening (editableOpening: organisation-scoped load,
 * role, CLOSED) and writes with the session's organisation and user, never
 * ones from the browser. A live opening is never turned into a draft here
 * (ruling C5): accepting answers NO_DRAFT until "Düzenlemeye başla". Every
 * refusal is a code with its own sentence (refusal-copy.ts).
 */

const i18n = (max: number) => z.object({ tr: z.string().max(max), en: z.string().max(max) });
const proposalSchema = z.object({
  name: i18n(COMPETENCY_NAME_MAX),
  description: i18n(2000),
  anchors: z.partialRecord(z.enum(["1", "3", "5"]), i18n(2000)),
});

const INVALID = { ok: false as const, code: "INVALID" as const };
const suggestable = new Set<string>(SUGGESTABLE_TYPES);

/** The create audit row of an accepted AI competency names this; its undo asks for the same. */
const viaOf = (openingId: string) => `hiring-ai:${openingId}`;

/** The refusals a draft write throws, as codes; null for a real error. */
function refusalOf(error: unknown): AiRefusal | null {
  if (error instanceof HiringConflict) return { ok: false, code: error.code };
  if (error instanceof HiringNotFound) return { ok: false, code: "NOT_FOUND" };
  if (error instanceof HiringInvalid) return INVALID;
  return null;
}

function revalidate() {
  revalidatePath("/hiring/openings/[id]", "layout");
}

/** "Önerileri üret": one proposal from the job ad, under the AI limit, for an opening that has a draft. */
export async function generateDraftAction(openingId: string, jobAd: string): Promise<GenerateResult> {
  if (typeof openingId !== "string" || typeof jobAd !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  const problem = jobAdProblem(jobAd);
  if (problem === "TOO_SHORT") return { ok: false, code: "JOB_AD_TOO_SHORT" };
  if (problem === "TOO_LONG") return { ok: false, code: "JOB_AD_TOO_LONG" };
  const { user, opening } = gate;
  const state = await workingState(user.orgId, openingId);
  // Nothing could be accepted without a draft, so nothing is spent on a proposal.
  if (!state.draft) return { ok: false, code: "NO_DRAFT" };
  if (await aiLimitReached(user.orgId, user.id, "HIRING_DRAFT")) return { ok: false, code: "RATE_LIMITED" };
  await setPositionJobAdIfEmpty(user.orgId, user.id, opening.positionId, jobAd);
  const outcome = await generateHiringDraft({
    orgId: user.orgId,
    userId: user.id,
    openingId,
    positionName: opening.positionName,
    jobAd: jobAd.trim(),
    locales: state.content?.localeSet ?? ["tr"],
    teamLocale: await managerLocale(),
    library: await draftLibrary(user.orgId, opening.positionId),
  });
  if (outcome.status === "OK") return { ok: true, draft: outcome.draft, budgetWarning: outcome.budgetWarning };
  return { ok: false, code: outcome.status === "UNCONFIGURED" ? "UNCONFIGURED" : outcome.code };
}

/**
 * "Kabul et" on a stage card: a strict insert into the draft (no restore
 * option: only active competencies of the organisation), never a draft opened
 * here; NO_DRAFT on a live opening (C5). Choice questions are refused: the AI
 * never proposes one.
 */
export async function acceptStageAction(openingId: string, payload: StagePayload): Promise<AcceptStageResult> {
  if (typeof openingId !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  const parsed = stagePayloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.activities.some((a) => !suggestable.has(a.type))) return INVALID;
  try {
    const stageId = await insertStage(gate.user.orgId, openingId, parsed.data);
    revalidate();
    return { ok: true, stageId };
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal) return refusal;
    throw error;
  }
}

/** "Geri al" on an accepted stage card: the stage leaves the draft again. */
export async function removeAcceptedStageAction(openingId: string, stageId: string): Promise<AiDone> {
  if (typeof openingId !== "string" || typeof stageId !== "string" || !isUuid(stageId)) return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  try {
    await deleteStage(gate.user.orgId, openingId, stageId);
    revalidate();
    return { ok: true };
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal) return refusal;
    throw error;
  }
}

/** "Kabul et" on a new-competency card: "Kütüphaneye eklenir, diğer alımlar da kullanabilir." */
export async function acceptCompetencyAction(
  openingId: string,
  proposal: { name: { tr: string; en: string }; description: { tr: string; en: string }; anchors: Partial<Record<"1" | "3" | "5", { tr: string; en: string }>> },
): Promise<AcceptCompetencyResult> {
  if (typeof openingId !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  if (!can(gate.user, "library:write")) return { ok: false, code: "LIBRARY_FORBIDDEN" };
  const parsed = proposalSchema.safeParse(proposal);
  if (!parsed.success) return INVALID;
  const result = await findOrCreateCompetency(gate.user.orgId, gate.user.id, parsed.data, viaOf(openingId));
  if (!result.ok) return result;
  revalidatePath("/library/competencies");
  return result;
}

/**
 * "Geri al" on an accepted competency card (ruling C1): archived, never
 * deleted, and only when this screen created it for this user and nothing uses
 * it yet; otherwise it stays in the library and the code says why.
 */
export async function undoCompetencyAction(openingId: string, competencyId: string): Promise<AiDone> {
  if (typeof openingId !== "string" || typeof competencyId !== "string" || !isUuid(competencyId)) return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  if (!can(gate.user, "library:write")) return { ok: false, code: "LIBRARY_FORBIDDEN" };
  const result = await archiveCompetencyIfUnused(gate.user.orgId, gate.user.id, competencyId, viaOf(openingId));
  if (result.ok) revalidatePath("/library/competencies");
  return result;
}
