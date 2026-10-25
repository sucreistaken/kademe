import type { ProctoringPolicy } from "@/lib/proctor/policy";
import { recordingLabel, type RecordingLabel } from "@/lib/proctor/recording-status";

/**
 * The exam's system check as a guided flow: one screen, one real action. This
 * file decides WHICH screen and WHAT the one big button does; SystemCheck.tsx
 * only draws it. The rules for what blocks the start are the old checklist's
 * rows, unchanged (see the comments on each branch); they only moved from a
 * list of rows to "the next thing to do".
 */
export type CheckStep = "devices" | "look" | "screen" | "ready" | "blocked";
export type DeviceStateLite = "idle" | "asking" | "ok" | "denied" | "lost" | "unsupported";

/** What the one big button does. The quiet measurement is not a button: the room is measured by itself. */
export type Primary = "open" | "retry" | "continue" | "share" | "start";

/** Why the primary button is off (or what is being waited for). */
export type Wait =
  | "preparing"
  | "asking"
  | "pickScreen"
  | "faceLoading"
  | "faceNone"
  | "faceMany"
  | "quietWorking"
  | "browser"
  | "secondScreen"
  /** The last screen's rules are not ticked yet; the button says so next to itself. */
  | "rules";

/** A step that needs fixing, shown as one sentence plus a retry. */
export type Issue = "denied" | "lost" | "wrongSurface" | "screenDenied" | "unsupported";

export type StepPlan = {
  devices: boolean;
  /** Preview, face and quiet: the "Sizi görüyoruz" step. */
  look: boolean;
  face: boolean;
  quiet: boolean;
  screen: boolean;
  steps: Array<Exclude<CheckStep, "blocked">>;
};

/** Steps the policy does not need are not in the list, so "Adım n / N" never counts them. */
export function planSteps(policy: ProctoringPolicy): StepPlan {
  const devices = policy.camera || policy.microphone;
  const face = policy.camera && policy.aiSignals.face;
  // The old QUIET row followed the microphone row and only existed with the voice signal.
  const quiet = policy.microphone && policy.aiSignals.voice;
  const look = policy.camera || quiet;
  const screen = policy.screenShare;
  const steps: StepPlan["steps"] = [];
  if (devices) steps.push("devices");
  if (look) steps.push("look");
  if (screen) steps.push("screen");
  steps.push("ready");
  return { devices, look, face, quiet, screen, steps };
}

export type StepState = {
  /** The engine exists and has started. Until then nothing can be asked. */
  ready: boolean;
  /** evaluateEnvironment found a blocker other than SECOND_SCREEN. */
  browserBlocked: boolean;
  /** policy.secondScreen === "BLOCK_AT_CHECK". */
  secondScreenBlocks: boolean;
  isExtended: boolean | null;
  camera: DeviceStateLite;
  mic: DeviceStateLite;
  model: "off" | "loading" | "ready" | "unavailable";
  faces: number | null;
  quiet: "idle" | "working" | "done";
  screen: DeviceStateLite;
  surface: "MONITOR" | "WRONG_SURFACE" | "UNVERIFIED" | null;
  /** The student pressed "Devam et" on the look step. */
  lookConfirmed: boolean;
  /** The student ticked "Diğer uygulamaları kapattım, kurallara uyacağım." on the last screen. */
  rulesAccepted: boolean;
};

export type StepResult = {
  step: CheckStep;
  primary: Primary | null;
  wait: Wait | null;
  issue: Issue | null;
  /** 1-based position in plan.steps; null on a blocked screen. */
  index: number | null;
  total: number;
};

const failed = (s: DeviceStateLite) => s === "denied" || s === "lost" || s === "unsupported";

const FIRST_PRIMARY = { devices: "open", look: "continue", screen: "share", ready: "start" } as const;

/** The old FACE row: ok with exactly one face; an unavailable model passes (a warning, not a blocker). */
function faceWait(s: StepState): Wait | null {
  if (s.model === "unavailable") return null;
  if (s.model !== "ready" || s.faces === null) return "faceLoading";
  if (s.faces === 1) return null;
  return s.faces > 1 ? "faceMany" : "faceNone";
}

/** Face first, then the quiet measurement: what the look step (and the last button) still waits for. */
function lookWait(plan: StepPlan, s: StepState): Wait | null {
  if (plan.face) {
    const face = faceWait(s);
    if (face) return face;
  }
  return plan.quiet && s.quiet !== "done" ? "quietWorking" : null;
}

export function checkStep(plan: StepPlan, s: StepState): StepResult {
  const total = plan.steps.length;
  const at = (step: Exclude<CheckStep, "blocked">, primary: Primary | null, wait: Wait | null = null, issue: Issue | null = null): StepResult => ({
    step,
    primary,
    wait,
    issue,
    index: plan.steps.indexOf(step) + 1,
    total,
  });

  // Hard stops come first: a browser that cannot run the exam, or a second screen where the policy forbids one.
  if (s.browserBlocked) return { step: "blocked", primary: null, wait: "browser", issue: null, index: null, total };
  if (s.secondScreenBlocks && s.isExtended === true) return { step: "blocked", primary: null, wait: "secondScreen", issue: null, index: null, total };

  if (!s.ready) {
    const first = plan.steps[0];
    return at(first, FIRST_PRIMARY[first], "preparing");
  }

  // Devices: camera and microphone are one permission; both must be ok (the old CAMERA and MICROPHONE rows).
  if (plan.devices) {
    if (failed(s.camera) || failed(s.mic)) {
      if (s.camera === "unsupported" || s.mic === "unsupported") return at("devices", null, null, "unsupported");
      return at("devices", "retry", null, s.camera === "lost" || s.mic === "lost" ? "lost" : "denied");
    }
    if (s.camera === "asking" || s.mic === "asking") return at("devices", "open", "asking");
    if (s.camera !== "ok" || s.mic !== "ok") return at("devices", "open");
  }

  // Look: face visible and room quiet are measured by themselves; the student only confirms.
  if (plan.look && !s.lookConfirmed) return at("look", "continue", lookWait(plan, s));

  // Screen: only the whole screen counts (the old SCREEN_SHARE row: ok or nothing).
  if (plan.screen && s.screen !== "ok") {
    if (s.screen === "asking") return at("screen", "share", "pickScreen");
    if (s.surface === "WRONG_SURFACE") return at("screen", "retry", null, "wrongSurface");
    if (failed(s.screen)) return at("screen", "retry", null, "screenDenied");
    return at("screen", "share");
  }

  // Ready: the face and the quiet measurement still count at the last button, as the old rows did.
  // The ticked rules come last, so a problem the student can fix is named before the box is asked for.
  return at("ready", "start", lookWait(plan, s) ?? (s.rulesAccepted ? null : "rules"));
}

/** Whether the big button may be pressed: it has an action and nothing is waited for. */
export const primaryEnabled = (r: StepResult): boolean => r.primary !== null && r.wait === null;

/** The plain rules under the yellow callout, in the order they are shown. */
export type PlainRule = "fullscreen" | "oneScreen" | "tab";

/**
 * What the last screen's checklist says, decided by the policy. The yellow
 * callout always asks to close the other applications and, when anything is
 * recorded, says what (the same words the exam header uses, so the promise
 * made here is the one kept there). The plain rules are the old three pills:
 * full screen and one screen only where the policy asks for them, and the tab.
 */
export function readyRules(policy: ProctoringPolicy): { recorded: RecordingLabel | null; plain: PlainRule[] } {
  const plain: PlainRule[] = [];
  if (policy.fullscreen) plain.push("fullscreen");
  if (policy.secondScreen !== "OFF") plain.push("oneScreen");
  plain.push("tab");
  return { recorded: recordingLabel({ camera: policy.camera, audio: policy.microphone, screen: policy.screenShare }), plain };
}
