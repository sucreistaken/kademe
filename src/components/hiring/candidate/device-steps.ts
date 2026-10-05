import { deviceBlocker, fixKeyFor, type Blocker, type DeniedKind, type Permission, type Trial } from "./device-rows";

/**
 * HIRING-VISUAL-FLOW 3.3: the device check as three sub-steps, each with a
 * filled button that is the next real action (G2): A turn the devices on, B
 * make a 5 second test, C "can you see and hear yourself?". The rows model
 * (device-rows.ts) stays the rule for what blocks: "Evet, devam et" goes only
 * where deviceBlocker says nothing does (tested over every input).
 */
export type DeviceStep = "open" | "denied" | "sound" | "quiet" | "trial" | "listen";
/** `recorder: false` is a browser without MediaRecorder: the test cannot be made, so no filled trial button is offered (plan 2 said so, "Sorun bildir" stands instead). */
export type StepInput = { camera: boolean; permission: Permission; heard: boolean; quiet: boolean; trial: Trial; denied: DeniedKind | null; recorder?: boolean };

export function deviceStep(input: StepInput): { step: DeviceStep; primary: "open" | "retry" | "trial" | "continue" | null; wait: Blocker | "asking" | null } {
  if (input.permission === "idle" || input.permission === "asking") return { step: "open", primary: "open", wait: input.permission === "asking" ? "asking" : null };
  if (input.permission === "denied") return { step: "denied", primary: input.denied === "unsupported" ? null : "retry", wait: null };
  if (input.trial === "ready" || input.trial === "played") return { step: "listen", primary: "continue", wait: deviceBlocker(input) };
  const recording = input.trial === "recording" ? ("trialRecording" as const) : null;
  const primary = input.recorder === false ? null : ("trial" as const);
  if (!input.heard && !input.quiet) return { step: "sound", primary, wait: "sound" };
  return { step: input.heard ? "trial" : "quiet", primary, wait: recording };
}

/** Task 12 carry: each "Sorun bildir" keeps its own state, so a report from one row is never shown as sent in another. */
export type ReportKind = "devices" | "quiet" | "recorder";
export type ReportState = "idle" | "sending" | "sent" | "failed";
export const NO_REPORTS: Record<ReportKind, ReportState> = { devices: "idle", quiet: "idle", recorder: "idle" };
export const withReport = (reports: Record<ReportKind, ReportState>, kind: ReportKind, state: ReportState): Record<ReportKind, ReportState> => ({
  ...reports,
  [kind]: state,
});

/** Task 12 carry: Safari reports "interrupted" for a context it holds back; it is waited for like "suspended". */
export const contextStalled = (state: string) => state === "suspended" || state === "interrupted";

/** Task 12 carry: without a sound context nothing was listened to, so "we could not hear you" would be untrue. */
export function quietCopy(meterless: boolean): { mic: "micNoMeter" | "micQuietHint"; trial: "trialNoMeter" | "trialQuiet" } {
  return meterless ? { mic: "micNoMeter", trial: "trialNoMeter" } : { mic: "micQuietHint", trial: "trialQuiet" };
}

/** Task 12 carry: "open it in Safari or Chrome from the menu" is for in-app browsers only. */
export const unsupportedSteps = (userAgent: string, maxTouchPoints: number): "fixinApp" | "fixUnsupported" =>
  fixKeyFor(userAgent, maxTouchPoints) === "inApp" ? "fixinApp" : "fixUnsupported";

/**
 * Task 12 carry (a language switch remounts /check): the tab remembers that
 * the test recording was played and that this tab turned the devices on. Only
 * the second lets the check reopen them without a click (see shouldAutoOpen).
 */
export type CheckMemory = { trialPlayed: boolean; devicesOpened: boolean };

export const checkMemoryKey = (token: string) => `kademe-hiring-check:${token}`;

export function readCheckMemory(storage: Pick<Storage, "getItem"> | null, key: string): CheckMemory {
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as { trialPlayed?: unknown; devicesOpened?: unknown } | null) : null;
    return { trialPlayed: parsed?.trialPlayed === true, devicesOpened: parsed?.devicesOpened === true };
  } catch {
    return { trialPlayed: false, devicesOpened: false };
  }
}

export function writeCheckMemory(storage: Pick<Storage, "setItem"> | null, key: string, memory: CheckMemory): void {
  try {
    storage?.setItem(key, JSON.stringify(memory));
  } catch {
    // A tab without storage starts the check again after a remount; nothing else depends on it.
  }
}

/**
 * Controller ruling C3 (G2): devices open without a click only when THIS TAB
 * opened them before (a remount after a language switch), never on a first
 * visit, even where the Permissions API already says granted. Then the browser
 * must still allow them; unknown (Firefox cannot be asked about "camera") is
 * not granted.
 */
export function shouldAutoOpen(input: {
  openedBefore: boolean;
  camera: boolean;
  cameraPermission: PermissionState | null;
  microphonePermission: PermissionState | null;
}): boolean {
  if (!input.openedBefore) return false;
  if (input.microphonePermission !== "granted") return false;
  return input.camera ? input.cameraPermission === "granted" : true;
}

/** 3.3: the browser's own step is shown; the operating system's paragraph (after the first newline) waits behind "Hâlâ olmuyor mu?". */
export function splitFix(text: string): { first: string; rest: string | null } {
  const at = text.indexOf("\n");
  return at < 0 ? { first: text, rest: null } : { first: text.slice(0, at), rest: text.slice(at + 1) };
}

/**
 * Controller ruling C2: the filled button waits on EVERY blocker and says its
 * own reason (the `block*` copy key). "asking" is not a blocker: it only
 * occurs on the open step, where it is the button's busy state.
 */
export const waitReasonKey = (wait: Blocker | "asking" | null): `block${Blocker}` | null => (wait === null || wait === "asking" ? null : `block${wait}`);

/**
 * Fix round 1 (focus): the open and trial buttons now live in the footer, so a
 * step change keeps the same <button> mounted and merely disables it; focus on
 * it (or on any footer control, or a disabled element) counts as lost, and the
 * new title takes it, as it did when plan 2's buttons left with their row.
 */
export const focusLost = (at: { present: boolean; onBody: boolean; inStepArea: boolean; inFooter: boolean; disabled: boolean }): boolean =>
  !at.present || at.onBody || at.inStepArea || at.inFooter || at.disabled;

/** C3: write one memory field without losing the other (the record is replaced whole on every write). */
export function rememberCheck(storage: Pick<Storage, "getItem" | "setItem"> | null, key: string, field: keyof CheckMemory): void {
  writeCheckMemory(storage, key, { ...readCheckMemory(storage, key), [field]: true });
}
