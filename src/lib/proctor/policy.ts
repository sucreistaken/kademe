/**
 * Proctoring policy. Pure, no database.
 *
 * A policy is stored as JSON on the exam and snapshotted onto each attempt, so
 * a teacher tightening the rules mid-week does not change what an attempt in
 * progress was promised. Presets are starting points: the teacher picks one
 * and may then flip individual switches, and `preset` stays as a label.
 *
 * Automatic termination is off in every preset. Ending an exam on a machine's
 * say-so is a decision a school has to opt into explicitly.
 */

import { z } from "zod";

const seconds = (min: number, max: number) => z.number().int().min(min).max(max);

export const proctoringPolicySchema = z.object({
  preset: z.enum(["OFF", "STANDARD", "STRICT"]),
  camera: z.boolean(),
  microphone: z.boolean(),
  screenShare: z.boolean(),
  fullscreen: z.boolean(),
  secondScreen: z.enum(["OFF", "WARN", "BLOCK_AT_CHECK"]),
  clipboardBlock: z.boolean(),
  browserPolicy: z.enum(["CHROMIUM_ONLY", "ANY_DESKTOP"]),
  aiSignals: z.object({
    face: z.boolean(),
    gaze: z.boolean(),
    phone: z.boolean(),
    voice: z.boolean(),
  }),
  /** Send flagged snapshots to a vision model for a second opinion. */
  aiSecondLook: z.boolean(),
  snapshots: z.object({
    webcamSeconds: seconds(10, 300),
    screenSeconds: seconds(10, 300),
  }),
  /** Hard cap on paid AI reviews, so one noisy attempt cannot run up the bill. */
  maxAiReviewsPerAttempt: z.number().int().min(0).max(200),
  termination: z.object({
    enabled: z.boolean(),
    screenShareGoneSeconds: seconds(10, 600),
    fullscreenExitMax: z.number().int().min(1).max(50),
  }),
});

export type ProctoringPolicy = z.infer<typeof proctoringPolicySchema>;
export type PolicyPreset = ProctoringPolicy["preset"];

const DEFAULT_SNAPSHOTS = { webcamSeconds: 30, screenSeconds: 45 };
const TERMINATION_OFF = {
  enabled: false,
  screenShareGoneSeconds: 60,
  fullscreenExitMax: 5,
};

export const PRESETS: Record<PolicyPreset, ProctoringPolicy> = {
  OFF: {
    preset: "OFF",
    camera: false,
    microphone: false,
    screenShare: false,
    fullscreen: false,
    secondScreen: "OFF",
    clipboardBlock: false,
    browserPolicy: "ANY_DESKTOP",
    aiSignals: { face: false, gaze: false, phone: false, voice: false },
    aiSecondLook: false,
    snapshots: DEFAULT_SNAPSHOTS,
    maxAiReviewsPerAttempt: 0,
    termination: TERMINATION_OFF,
  },
  // Camera and fullscreen without screen sharing: the low-friction default.
  // Gaze and voice stay off because they misfire most on ordinary behaviour.
  STANDARD: {
    preset: "STANDARD",
    camera: true,
    microphone: true,
    screenShare: false,
    fullscreen: true,
    secondScreen: "WARN",
    clipboardBlock: true,
    browserPolicy: "ANY_DESKTOP",
    aiSignals: { face: true, gaze: false, phone: true, voice: false },
    aiSecondLook: true,
    snapshots: { webcamSeconds: 30, screenSeconds: 45 },
    maxAiReviewsPerAttempt: 30,
    termination: TERMINATION_OFF,
  },
  STRICT: {
    preset: "STRICT",
    camera: true,
    microphone: true,
    screenShare: true,
    fullscreen: true,
    secondScreen: "BLOCK_AT_CHECK",
    clipboardBlock: true,
    browserPolicy: "CHROMIUM_ONLY",
    aiSignals: { face: true, gaze: true, phone: true, voice: true },
    aiSecondLook: true,
    snapshots: { webcamSeconds: 20, screenSeconds: 30 },
    maxAiReviewsPerAttempt: 60,
    termination: TERMINATION_OFF,
  },
};

/** A fresh copy, so callers can edit it without mutating the shared preset. */
export function policyFromPreset(preset: PolicyPreset): ProctoringPolicy {
  return structuredClone(PRESETS[preset]);
}

/** Strict parse. Throws a ZodError on anything that is not a full, valid policy. */
export function parsePolicy(json: unknown): ProctoringPolicy {
  return proctoringPolicySchema.parse(json);
}

/**
 * Lenient parse for reading stored rows. A corrupt policy falls back to
 * STANDARD rather than OFF: failing open would silently unproctor an exam.
 */
export function safeParsePolicy(json: unknown): ProctoringPolicy {
  const result = proctoringPolicySchema.safeParse(json);
  return result.success ? result.data : policyFromPreset("STANDARD");
}

/** Whether anything is actually watched. Microphone alone does not count. */
export function isProctored(policy: ProctoringPolicy): boolean {
  return (
    policy.preset !== "OFF" &&
    (policy.camera || policy.screenShare || policy.fullscreen)
  );
}

export type CheckId =
  | "BROWSER"
  | "SINGLE_SCREEN"
  | "CAMERA"
  | "MICROPHONE"
  | "FACE"
  | "SCREEN_SHARE"
  | "CONNECTION";

export type PreflightCheck = { id: CheckId; required: boolean };

/**
 * The pre-exam checks in the order the candidate walks through them. A check
 * that is not required is still shown, but failing it does not block the start.
 * SINGLE_SCREEN under WARN is informational; only BLOCK_AT_CHECK enforces it.
 * CONNECTION is advisory: a slow line is the candidate's risk, not a rule.
 */
export function requiredChecks(policy: ProctoringPolicy): PreflightCheck[] {
  const checks: PreflightCheck[] = [{ id: "BROWSER", required: true }];
  if (policy.secondScreen !== "OFF") {
    checks.push({
      id: "SINGLE_SCREEN",
      required: policy.secondScreen === "BLOCK_AT_CHECK",
    });
  }
  if (policy.camera) checks.push({ id: "CAMERA", required: true });
  if (policy.microphone) checks.push({ id: "MICROPHONE", required: true });
  if (policy.camera && policy.aiSignals.face) {
    checks.push({ id: "FACE", required: true });
  }
  if (policy.screenShare) checks.push({ id: "SCREEN_SHARE", required: true });
  checks.push({ id: "CONNECTION", required: false });
  return checks;
}
