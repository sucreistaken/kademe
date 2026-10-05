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
