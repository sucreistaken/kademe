import type { CreateOpeningActionResult } from "@/app/(manager)/hiring/openings/new/actions";
import { flowStepOf, stepOfProblem } from "@/components/manager/flow-model";
import type { StartValue } from "./start-choices";

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

/**
 * The last step's "Alımı oluştur" waits for a position, then for a start (none
 * is preselected from the job ad, user decision 2026-10-06), then for a source
 * when copying.
 */
export function createWait(input: { positionReady: boolean; start: StartValue | null; copyFrom: string }): "needPosition" | "needStart" | "needCopySource" | null {
  if (!input.positionReady) return "needPosition";
  if (input.start === null) return "needStart";
  return input.start === "COPY" && !input.copyFrom ? "needCopySource" : null;
}

/**
 * The start once the ad may have changed: the job-ad start without an ad is
 * no choice at all (user decision 2026-10-06, less AI), so it is cleared and
 * never comes back on its own when the ad does. Other starts stay.
 */
export const startAfterAdChange = (start: StartValue | null, hasAd: boolean): StartValue | null => (start === "AI" && !hasAd ? null : start);

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
 * H3, W5: the last step's one line ("Destek Uzmanı · ilan metni var · ilan
 * metninden öneri"). It says nothing of the start until one is chosen, and
 * nothing of a copy until its source is chosen (the button waits meanwhile).
 */
export function newOpeningSummary(input: { name: string; hasAd: boolean; start: StartValue | null; copyName: string | null }): NewOpeningSummaryPart[] {
  const parts: NewOpeningSummaryPart[] = [{ text: input.name }, { key: input.hasAd ? "summaryAd" : "summaryNoAd" }];
  if (input.start === "AI") parts.push({ key: "summaryAi" });
  else if (input.start === "BLANK") parts.push({ key: "summaryBlank" });
  else if (input.copyName) parts.push({ key: "summaryCopy", name: input.copyName });
  return parts;
}

/** Manager mockup 3: above this many library positions the cards get a search field. */
export const POSITION_FILTER_FROM = 6;

const fold = (text: string) => text.trim().toLocaleLowerCase("tr");

/**
 * The old picker's rule, kept: a new name that is a library position's name
 * (any case, outer spaces ignored) is that position, so "Devam et" picks it
 * instead of opening a second position of the same name.
 */
export function matchPosition<P extends { id: string; name: string }>(list: readonly P[], name: string): P | null {
  const wanted = fold(name);
  if (!wanted) return null;
  return list.find((p) => fold(p.name) === wanted) ?? null;
}

/** The cards the search shows, in the library's order; the chosen card always stays in view. */
export function visiblePositions<P extends { id: string; name: string }>(list: readonly P[], query: string, pickedId: string | null): P[] {
  const q = fold(query);
  return q ? list.filter((p) => p.id === pickedId || fold(p.name).includes(q)) : [...list];
}
