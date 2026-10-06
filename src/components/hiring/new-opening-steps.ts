import type { CreateOpeningActionResult } from "@/app/(manager)/hiring/openings/new/actions";
import { flowStepOf, stepOfProblem } from "@/components/manager/flow-model";

/**
 * HIRING-VISUAL-FLOW 4.6 (P6, W1-W8): opening a hiring is rare and thought
 * through each time, so it is three steps with one question each. The step
 * lives in the hash (useFlowStep): the browser's back button steps back and
 * every typed value stays (one component, one state).
 */
export type NewOpeningStep = "position" | "ad" | "start";
/** Every refusal createOpeningAction can answer (unchanged: the server's four and the action's INVALID, FAILED). */
export type NewOpeningRefusal = Extract<CreateOpeningActionResult, { ok: false }>["code"];

/** Plan decision 13: the ad step only for a new position name (a library position's ad lives on the position). */
export const newOpeningSteps = (input: { newName: boolean }): NewOpeningStep[] => (input.newName ? ["position", "ad", "start"] : ["position", "start"]);

/** W3: the hash's step; without a position every step opens the position step. */
export function newOpeningStepOf(hash: string, input: { steps: NewOpeningStep[]; positionReady: boolean }): NewOpeningStep {
  return flowStepOf(hash, { steps: input.steps, firstInvalid: input.positionReady ? null : "position" });
}

/** The last step's "Alımı oluştur" waits for a position, then for a source when copying (the existing reasons). */
export function createWait(input: { positionReady: boolean; start: "AI" | "COPY" | "BLANK"; copyFrom: string }): "needPosition" | "needCopySource" | null {
  if (!input.positionReady) return "needPosition";
  return input.start === "COPY" && !input.copyFrom ? "needCopySource" : null;
}

const REFUSAL_STEP: Record<NewOpeningRefusal, NewOpeningStep> = {
  POSITION_NAME_REQUIRED: "position",
  POSITION_NOT_FOUND: "position",
  JOB_AD_REQUIRED: "start",
  COPY_SOURCE_NOT_FOUND: "start",
  INVALID: "start",
  FAILED: "start",
};

/** W8: a refusal of createOpeningAction opens the step it is about; the sentence stays the existing one. */
export const newOpeningStepOfRefusal = (code: NewOpeningRefusal): NewOpeningStep => stepOfProblem(REFUSAL_STEP, code) ?? "start";

export type NewOpeningSummaryPart = { text: string } | { key: "summaryAd" | "summaryNoAd" | "summaryAi" | "summaryBlank" } | { key: "summaryCopy"; name: string };

/**
 * H3, W5: the last step's one line ("Destek Uzmanı · ilan metni var · AI
 * taslağı"). Copying says nothing of the source until one is chosen (the
 * button waits with "Kopyalanacak alımı seç." meanwhile).
 */
export function newOpeningSummary(input: { name: string; hasAd: boolean; start: "AI" | "COPY" | "BLANK"; copyName: string | null }): NewOpeningSummaryPart[] {
  const parts: NewOpeningSummaryPart[] = [{ text: input.name }, { key: input.hasAd ? "summaryAd" : "summaryNoAd" }];
  if (input.start === "AI") parts.push({ key: "summaryAi" });
  else if (input.start === "BLANK") parts.push({ key: "summaryBlank" });
  else if (input.copyName) parts.push({ key: "summaryCopy", name: input.copyName });
  return parts;
}
