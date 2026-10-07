import type { StagePayload } from "../rules/patches";
import { stagePayloadFrom, type CompetencySuggestion, type HiringDraft } from "./draft";

/**
 * Step 2 of the wizard arrives filled (HIRING-UX 5.20): the first AI draft is
 * accepted whole on the server. Pure: when it runs, and what it writes.
 */
export type AutoApplyDecision = "NO_DRAFT" | "HAS_STAGES" | "APPLY";

/** Only a draft with no stage at all is filled, so opening step 2 again never adds a second set. */
export function autoApplyDecision(state: { hasDraft: boolean; stageCount: number }): AutoApplyDecision {
  if (!state.hasDraft) return "NO_DRAFT";
  return state.stageCount > 0 ? "HAS_STAGES" : "APPLY";
}

/** The proposals that are not library competencies yet; each becomes one (findOrCreateCompetency). */
export function competenciesToCreate(draft: HiringDraft): CompetencySuggestion[] {
  return draft.competencies.filter((c) => !c.libraryId);
}

/**
 * Every stage of the draft as an insert payload. `accepted` maps a new
 * competency's key to its library id; a question loses a link whose
 * competency could not be created (no library right, no name).
 */
export function draftStagePayloads(draft: HiringDraft, accepted: Record<string, string>): StagePayload[] {
  return draft.stages.map((stage) => stagePayloadFrom(stage, draft.competencies, accepted));
}
