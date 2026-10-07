"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { aiLimitReached } from "@/lib/ai-limit";
import { can } from "@/lib/authorize";
import { loadPosition } from "@/server/library";
import { findOrCreateCompetency } from "@/server/library-write";
import { isUuid } from "@/server/settings";
import { autoApplyDecision, competenciesToCreate, draftStagePayloads } from "@/solutions/hiring/ai/apply-draft";
import { jobAdProblem, type CompetencySuggestion } from "@/solutions/hiring/ai/draft";
import { generateHiringDraft } from "@/solutions/hiring/ai/draft-job";
import {
  activityForRevision,
  activityRestorePatch,
  competencyProposal,
  contentAsDraft,
  reviseInputSchema,
  revisedActivityPatch,
  revisedCompetencyIds,
  revisedStagePayloads,
  type ReviseInput,
} from "@/solutions/hiring/ai/revise";
import { reviseHiringActivity, reviseHiringDraft } from "@/solutions/hiring/ai/revise-job";
import { draftLibrary } from "@/solutions/hiring/server/draft-context";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";
import { replaceDraftStages, setActivityCompetencies, updateActivity } from "@/solutions/hiring/server/versions";
import { workingState } from "@/solutions/hiring/server/working";
import { editableOpening } from "../access";
import { draftId } from "../assessment/edit/stage-ticket";
import type { ApplyDraftResult, ReviseResult, SetupRefusal, UndoReviseResult } from "./result";
import { packReviseUndo, unpackReviseUndo } from "./revise-undo";

/**
 * The wizard's step 2 "Sorular" (HIRING-UX 5.20): the first AI draft arrives
 * accepted whole, "AI'a söyle" rewrites the list or one question, and every
 * rewrite can be undone. Every action first asks for the right to edit this
 * opening (editableOpening: organisation-scoped load, role, CLOSED) and writes
 * with the session's organisation and user, never ones from the browser. AI
 * calls are made only under the limit (HIRING_DRAFT for the first draft,
 * HIRING_REVISE for revisions), and never for a live opening without a draft.
 */

const INVALID = { ok: false as const, code: "INVALID" as const };
const refuse = (code: SetupRefusal["code"]): SetupRefusal => ({ ok: false, code });

function refusalOf(error: unknown): SetupRefusal | null {
  if (error instanceof HiringConflict) return refuse(error.code);
  if (error instanceof HiringNotFound) return refuse("NOT_FOUND");
  if (error instanceof HiringInvalid) return INVALID;
  return null;
}

/** Writes that may meet a draft refusal: answered as a code, anything else is a real error. */
async function guarded<T>(work: () => Promise<T>): Promise<T | SetupRefusal> {
  try {
    return await work();
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal) return refusal;
    throw error;
  }
}
const isRefusal = (value: unknown): value is SetupRefusal => typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === false;

function revalidate() {
  revalidatePath("/hiring/openings/[id]", "layout");
}

type Gate = Extract<Awaited<ReturnType<typeof editableOpening>>, { ok: true }>;

/**
 * New competencies the AI proposed become library rows (findOrCreateCompetency
 * reuses one of the same name), recorded as made by this opening's AI so the
 * AI screen's undo rules hold. Without the library right none is created and
 * the questions simply lose that link. Answers key to library id.
 */
async function acceptNew(gate: Gate, openingId: string, proposals: CompetencySuggestion[]): Promise<Record<string, string>> {
  const accepted: Record<string, string> = {};
  if (!proposals.length || !can(gate.user, "library:write")) return accepted;
  for (const c of proposals) {
    const result = await findOrCreateCompetency(gate.user.orgId, gate.user.id, competencyProposal(c), `hiring-ai:${openingId}`);
    if (result.ok) accepted[c.key] = result.id;
  }
  if (Object.keys(accepted).length) revalidatePath("/library/competencies");
  return accepted;
}

async function jobAdOf(gate: Gate): Promise<string> {
  const position = await loadPosition(gate.user.orgId, gate.opening.positionId);
  return position?.jobDescription?.trim() ?? "";
}

/**
 * Step 2's first visit: the position's job ad (written by step 1's AI) to a
 * draft, accepted whole: new competencies into the library, then every stage.
 * Idempotent: a draft that already has a stage is left alone (applied: false)
 * and nothing is generated; the stages are written in one transaction that
 * checks again that the draft is still empty. Quotes are not checked here (the
 * ad was AI-written); the time budget still gets its one repair.
 */
export async function generateAndApplyDraftAction(openingId: string): Promise<ApplyDraftResult> {
  if (typeof openingId !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return refuse(gate.code);
  const { user, opening } = gate;
  const state = await workingState(user.orgId, openingId);
  const decision = autoApplyDecision({ hasDraft: state.draft !== null, stageCount: state.draft ? (state.content?.stages.length ?? 0) : 0 });
  if (decision === "NO_DRAFT") return refuse("NO_DRAFT");
  if (decision === "HAS_STAGES") return { ok: true, applied: false };
  const jobAd = await jobAdOf(gate);
  const problem = jobAdProblem(jobAd);
  if (problem === "TOO_SHORT") return refuse("JOB_AD_TOO_SHORT");
  if (problem === "TOO_LONG") return refuse("JOB_AD_TOO_LONG");
  if (await aiLimitReached(user.orgId, user.id, "HIRING_DRAFT")) return refuse("RATE_LIMITED");
  const outcome = await generateHiringDraft({
    orgId: user.orgId,
    userId: user.id,
    openingId,
    positionName: opening.positionName,
    jobAd,
    locales: state.content?.localeSet ?? ["tr"],
    teamLocale: state.content?.defaultLocale ?? DEFAULT_LOCALE,
    library: await draftLibrary(user.orgId, opening.positionId),
  });
  if (outcome.status === "UNCONFIGURED") return refuse("UNCONFIGURED");
  if (outcome.status === "FAILED") return refuse(outcome.code);
  const accepted = await acceptNew(gate, openingId, competenciesToCreate(outcome.draft));
  const payloads = draftStagePayloads(outcome.draft, accepted);
  const written = await guarded(() => replaceDraftStages(user.orgId, openingId, payloads, { onlyIfEmpty: true }));
  if (isRefusal(written)) return written;
  if (!written.applied) return { ok: true, applied: false };
  revalidate();
  return { ok: true, applied: true, stages: payloads.length, budgetWarning: outcome.budgetWarning };
}

/**
 * "AI'a söyle" (target all) and "AI ile düzelt" (target one question). The
 * instruction is at most 500 characters and goes to the model as quoted data.
 * The whole list is replaced in one transaction; one question is updated in
 * place (its links set after). Either way the previous content comes back as a
 * signed undo token (undoReviseAction).
 */
export async function reviseAssessmentAction(openingId: string, input: ReviseInput): Promise<ReviseResult> {
  if (typeof openingId !== "string") return INVALID;
  const parsed = reviseInputSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { instruction, target } = parsed.data;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return refuse(gate.code);
  const { user, opening } = gate;
  const state = await workingState(user.orgId, openingId);
  if (!state.draft || !state.content) return refuse("NO_DRAFT");
  const content = state.content;
  const one = target.kind === "activity" ? activityForRevision(content, state.facts, target.activityId) : null;
  if (target.kind === "activity" && one === null) return refuse("NOT_FOUND");
  if (one === "CHOICE") return refuse("CHOICE_QUESTION");
  if (await aiLimitReached(user.orgId, user.id, "HIRING_REVISE")) return refuse("RATE_LIMITED");
  const context = {
    orgId: user.orgId,
    userId: user.id,
    openingId,
    positionName: opening.positionName,
    jobAd: await jobAdOf(gate),
    instruction,
    locales: content.localeSet,
    teamLocale: content.defaultLocale,
    library: await draftLibrary(user.orgId, opening.positionId),
  };

  if (target.kind === "all") {
    const { draft: current, base } = contentAsDraft(content, state.facts);
    const outcome = await reviseHiringDraft({ ...context, current });
    if (outcome.status === "UNCONFIGURED") return refuse("UNCONFIGURED");
    if (outcome.status === "FAILED") return refuse(outcome.code);
    const accepted = await acceptNew(gate, openingId, competenciesToCreate(outcome.draft));
    const payloads = revisedStagePayloads(outcome.draft, base, accepted);
    const written = await guarded(() => replaceDraftStages(user.orgId, openingId, payloads));
    if (isRefusal(written)) return written;
    revalidate();
    const undoToken = packReviseUndo({ orgId: user.orgId, openingId, versionId: written.versionId }, { kind: "all", stages: written.previous });
    return { ok: true, target: "all", stages: payloads.length, undoToken, budgetWarning: outcome.budgetWarning };
  }

  const current = one!;
  const outcome = await reviseHiringActivity({ ...context, stageName: current.stageName, activity: current.activity, competencies: current.competencies });
  if (outcome.status === "UNCONFIGURED") return refuse("UNCONFIGURED");
  if (outcome.status === "FAILED") return refuse(outcome.code);
  const accepted = await acceptNew(
    gate,
    openingId,
    outcome.revision.competencies.filter((c) => !c.libraryId),
  );
  const patch = revisedActivityPatch(current.payload, outcome.revision.activity);
  const ids = revisedCompetencyIds(outcome.revision, accepted);
  const activityId = target.activityId;
  const written = await guarded(async () => {
    await updateActivity(user.orgId, openingId, activityId, patch);
    const same = ids.length === current.payload.competencyIds.length && ids.every((id, i) => id === current.payload.competencyIds[i]);
    if (!same) await setActivityCompetencies(user.orgId, openingId, activityId, ids);
    return draftId(user.orgId, openingId);
  });
  if (isRefusal(written)) return written;
  revalidate();
  const undoToken = packReviseUndo({ orgId: user.orgId, openingId, versionId: written }, { kind: "activity", activityId, payload: current.payload });
  return { ok: true, target: "activity", activityId, undoToken };
}

/**
 * "Geri al" after a revision: the content the revision replaced goes back,
 * accepted only as the server signed it for this organisation, opening and
 * draft, within ten minutes (UNDO_EXPIRED otherwise). The whole list is
 * restored in one transaction; links archived since stay (restore: true).
 */
export async function undoReviseAction(openingId: string, undoToken: string): Promise<UndoReviseResult> {
  if (typeof openingId !== "string" || typeof undoToken !== "string") return INVALID;
  const gate = await editableOpening(openingId);
  if (!gate.ok) return refuse(gate.code);
  const { user } = gate;
  const done = await guarded(async () => {
    const versionId = await draftId(user.orgId, openingId);
    const undo = unpackReviseUndo({ orgId: user.orgId, openingId, versionId }, undoToken);
    if (!undo) return refuse("UNDO_EXPIRED");
    if (undo.kind === "all") {
      await replaceDraftStages(user.orgId, openingId, undo.stages, { restore: true });
    } else {
      if (!isUuid(undo.activityId)) return refuse("UNDO_EXPIRED");
      await updateActivity(user.orgId, openingId, undo.activityId, activityRestorePatch(undo.payload));
      await setActivityCompetencies(user.orgId, openingId, undo.activityId, undo.payload.competencyIds);
    }
    return { ok: true as const };
  });
  if (!isRefusal(done)) revalidate();
  return done;
}
