import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";

/**
 * HIRING-VISUAL-FLOW 3.1 and 3.2 (K3): Welcome and Consent are two steps of
 * one page. The step lives in the address's hash, so the browser's back
 * button on Consent returns to Welcome (Next keeps the page mounted for a
 * hash change) and a reload stays where the candidate was.
 */
export const CONSENT_HASH = "#consent";
export type LandingStep = "welcome" | "consent";

export const landingStepOf = (hash: string): LandingStep => (hash === CONSENT_HASH ? "consent" : "welcome");

/** "Nasıl gidecek": the device check only when something is recorded, the warm-up only when the version has one. */
export function welcomePath(input: { device: boolean; warmup: boolean }): Array<"device" | "warmup" | "questions" | "team"> {
  return [...(input.device ? (["device"] as const) : []), ...(input.warmup ? (["warmup"] as const) : []), "questions", "team"];
}

/** "Yanına al": a quiet place, the devices the questions need, a computer (K2). */
export function bringList(devices: { camera: boolean; microphone: boolean }): Array<"quiet" | "cameraMic" | "mic" | "computer"> {
  return ["quiet", ...(devices.camera ? (["cameraMic"] as const) : devices.microphone ? (["mic"] as const) : []), "computer"];
}

/** "Kabul et ve başla" waits for the ticked box, and for an extra-time choice still being saved. */
export const agreeWaitReason = (accepted: boolean, extraSaving = false): "extraSavingWait" | "tickFirst" | null =>
  extraSaving ? "extraSavingWait" : accepted ? null : "tickFirst";

/** "Devam et" waits while an extra-time choice is saving, so Consent never opens on a choice not yet kept. */
export const continueWaitReason = (extra: "idle" | "saving" | "saved"): "extraSavingWait" | null => (extra === "saving" ? "extraSavingWait" : null);

/** On Consent, a failed extra-time save is said again: nobody should start believing it was saved. */
export const consentNote = (extraFailed: boolean): "extraNotSaved" | null => (extraFailed ? "extraNotSaved" : null);

/**
 * What the landing draws (final wave A-M2): counts and the candidate's own
 * facts. The stages' names stay on the server; Welcome shows only how many
 * stages there are, and no question or stage reaches the page before consent.
 */
export type LandingState = Pick<
  HiringCandidateState,
  "orgName" | "positionName" | "candidateName" | "totalMinutes" | "reviewers" | "signals" | "devices" | "extraTimePct" | "extraTimeLocked" | "practice" | "contactEmail" | "retention"
> & { introBody: HiringCandidateState["intro"]["body"]; stageCount: number };

export function landingStateOf(state: HiringCandidateState): LandingState {
  return {
    orgName: state.orgName,
    positionName: state.positionName,
    candidateName: state.candidateName,
    introBody: state.intro?.body ?? null,
    stageCount: state.stages.length,
    totalMinutes: state.totalMinutes,
    reviewers: state.reviewers,
    signals: state.signals,
    devices: state.devices,
    extraTimePct: state.extraTimePct,
    extraTimeLocked: state.extraTimeLocked,
    practice: state.practice,
    contactEmail: state.contactEmail,
    retention: state.retention,
  };
}
