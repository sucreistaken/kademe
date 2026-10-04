"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/authorize";
import { saveAnchors } from "@/server/library-write";
import { isUuid } from "@/server/settings";
import { usedCompetencyIds } from "@/solutions/hiring/rules/content";
import { workingVersions } from "@/solutions/hiring/rules/versions";
import { loadVersionContent } from "@/solutions/hiring/server/content";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";
import { saveDraftWeights, versionsOf } from "@/solutions/hiring/server/versions";
import { addWeightSet } from "@/solutions/hiring/server/weight-sets";
import { editableOpening } from "../../access";
import type { AnchorsResult, ScorecardRefusal, WeightsResult } from "./result";

/**
 * Scorecard writes (HIRING-UX 5.7). Every action first asks for the right to
 * edit this opening (organisation-scoped load, role, CLOSED: editableOpening,
 * the code-answering form of openingFor(id, "edit")) and writes with the
 * session's organisation and user, never ones from the browser. Weights are
 * checked by the rules (NOT_WHOLE / NOT_100), not here, so the sentence on
 * screen always matches what was wrong. Every refusal is a code with its own
 * sentence (refusal-copy.ts); anything else is a real error.
 */

const uuid = z.string().refine(isUuid, "not an id");
/** A scorecard holds at most a few dozen competencies; 100 keys is a generous bound for a request. */
const weightsRecord = z.record(uuid, z.number()).refine((w) => Object.keys(w).length <= 100, "too many weights");
const weightsSchema = z.object({ versionId: uuid, enabled: z.boolean(), weights: weightsRecord });
const liveSchema = weightsSchema.extend({ reason: z.string().max(1000) });
const i18n = z.object({ tr: z.string().max(2000), en: z.string().max(2000) });
const anchorsSchema = z.partialRecord(z.enum(["1", "2", "3", "4", "5"]), i18n);

const INVALID = { ok: false as const, code: "INVALID" as const };

/** The refusals a hiring write throws, as codes; null for a real error. */
function refusalOf(error: unknown): ScorecardRefusal | null {
  if (error instanceof HiringConflict && (error.code === "NO_DRAFT" || error.code === "CLOSED")) return { ok: false, code: error.code };
  if (error instanceof HiringNotFound) return { ok: false, code: "NOT_FOUND" };
  return null;
}

function revalidate() {
  revalidatePath("/hiring/openings/[id]", "layout");
}

/** "Puan kartını kaydet" on a draft: weighting on or off and the percentages, for the draft the form was loaded for. */
export async function saveDraftWeightsAction(openingId: string, input: { versionId: string; enabled: boolean; weights: Record<string, number> }): Promise<WeightsResult> {
  if (typeof openingId !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  const parsed = weightsSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  try {
    const result = await saveDraftWeights(gate.user.orgId, openingId, parsed.data);
    if (!result.ok) return result;
    revalidate();
    return { ok: true };
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal) return refusal;
    throw error;
  }
}

/** "Puan kartını kaydet" on a live version: a new weight set with a reason (addWeightSet audits it). */
export async function addWeightSetAction(
  openingId: string,
  input: { versionId: string; enabled: boolean; weights: Record<string, number>; reason: string },
): Promise<WeightsResult> {
  if (typeof openingId !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  const parsed = liveSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  try {
    const result = await addWeightSet(gate.user.orgId, openingId, parsed.data, gate.user.id);
    if (result.ok) revalidate();
    return result;
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal) return refusal;
    throw error;
  }
}

/**
 * The anchor Sheet's save. A library write, so it also needs library:write;
 * and only for a competency this opening's draft measures (a published
 * scorecard keeps its own copy and is not edited from here).
 */
export async function saveAnchorsAction(
  openingId: string,
  competencyId: string,
  anchors: Partial<Record<"1" | "2" | "3" | "4" | "5", { tr: string; en: string }>>,
): Promise<AnchorsResult> {
  if (typeof openingId !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  if (!can(gate.user, "library:write")) return { ok: false, code: "LIBRARY_FORBIDDEN" };
  const parsed = anchorsSchema.safeParse(anchors);
  if (!parsed.success || typeof competencyId !== "string" || !isUuid(competencyId)) return INVALID;
  const orgId = gate.user.orgId;
  const { draft } = workingVersions(await versionsOf(orgId, openingId));
  if (!draft) return { ok: false, code: "NO_DRAFT" };
  const content = await loadVersionContent(orgId, draft.id);
  if (!content || !usedCompetencyIds(content).includes(competencyId)) return { ok: false, code: "NOT_FOUND" };
  const result = await saveAnchors(orgId, gate.user.id, competencyId, parsed.data);
  if (result.ok) {
    revalidate();
    revalidatePath(`/library/competencies/${competencyId}`);
  }
  return result;
}
