/**
 * Pre-exam environment check. Pure: the browser code gathers the feature
 * flags, this decides what they mean for a given policy.
 *
 * Blockers stop the candidate from starting; warnings are shown and logged
 * but let them through. The rule of thumb: block only on things the proctor
 * cannot work without, or that the policy explicitly forbids. Anything we
 * merely cannot verify is a warning, since the candidate usually cannot fix it.
 */

import type { ProctoringPolicy } from "./policy";

export type EnvironmentFeatures = {
  mobile: boolean;
  getDisplayMedia: boolean;
  /** `"isExtended" in screen`, i.e. the browser can tell us about extra displays. */
  isExtendedSupported: boolean;
  /** window.screen.isExtended; null when it could not be read. */
  isExtended: boolean | null;
  fullscreenEnabled: boolean;
  mediaRecorder: boolean;
  wasm: boolean;
  chromium: boolean;
};

export type EnvironmentBlocker =
  | "MOBILE"
  | "NO_SCREEN_SHARE"
  | "NO_FULLSCREEN"
  | "NO_RECORDER"
  | "BROWSER_NOT_SUPPORTED"
  | "SECOND_SCREEN";

export type EnvironmentWarning = "SECOND_SCREEN_UNVERIFIABLE" | "SECOND_SCREEN" | "NO_WASM";

export type EnvironmentVerdict = {
  ok: boolean;
  blockers: EnvironmentBlocker[];
  warnings: EnvironmentWarning[];
};

type EnvironmentPolicy = Pick<
  ProctoringPolicy,
  | "camera"
  | "microphone"
  | "screenShare"
  | "fullscreen"
  | "secondScreen"
  | "browserPolicy"
  | "aiSignals"
>;

export function evaluateEnvironment(
  f: EnvironmentFeatures,
  policy: EnvironmentPolicy,
): EnvironmentVerdict {
  const blockers: EnvironmentBlocker[] = [];
  const warnings: EnvironmentWarning[] = [];

  // Product decision: a watched exam is taken on a desktop. Phones cannot
  // share their screen and hold the camera at the wrong angle anyway.
  if (f.mobile && (policy.screenShare || policy.camera)) blockers.push("MOBILE");
  if (policy.browserPolicy === "CHROMIUM_ONLY" && !f.chromium) {
    blockers.push("BROWSER_NOT_SUPPORTED");
  }
  if (policy.screenShare && !f.getDisplayMedia) blockers.push("NO_SCREEN_SHARE");
  if (policy.fullscreen && !f.fullscreenEnabled) blockers.push("NO_FULLSCREEN");
  // Evidence clips around flagged events need MediaRecorder.
  if ((policy.camera || policy.microphone || policy.screenShare) && !f.mediaRecorder) {
    blockers.push("NO_RECORDER");
  }

  if (policy.secondScreen !== "OFF") {
    if (!f.isExtendedSupported || f.isExtended === null) {
      warnings.push("SECOND_SCREEN_UNVERIFIABLE");
    } else if (f.isExtended) {
      if (policy.secondScreen === "BLOCK_AT_CHECK") blockers.push("SECOND_SCREEN");
      else warnings.push("SECOND_SCREEN");
    }
  }

  // The vision models run on WebAssembly. Without it the exam still runs, but
  // model signals are missing and the attempt shows a coverage gap.
  const visionWanted =
    policy.camera && (policy.aiSignals.face || policy.aiSignals.gaze || policy.aiSignals.phone);
  if (visionWanted && !f.wasm) warnings.push("NO_WASM");

  return { ok: blockers.length === 0, blockers, warnings };
}

export type DisplaySurfaceSettings = {
  displaySurface?: string;
  width?: number;
  height?: number;
};

export type ScreenInfo = { width: number; height: number; dpr: number };

export type SurfaceVerdict = {
  surface: "MONITOR" | "WRONG_SURFACE" | "UNVERIFIED";
  /** A whole monitor was shared, but apparently not the one the exam is on. */
  wrongMonitor: boolean;
};

export const MONITOR_SIZE_TOLERANCE = 0.15;

/**
 * Check what the candidate picked in the share dialog. A tab or window share
 * would hide everything else on the screen, so only "monitor" passes. Some
 * browsers omit displaySurface; that is UNVERIFIED, not a failure.
 *
 * The wrong-monitor guess compares the shared track's size to this screen in
 * device pixels. It only fires when BOTH dimensions are off by more than 15%,
 * since browsers downscale shares and one dimension can drift on its own.
 */
export function verifyDisplaySurface(
  settings: DisplaySurfaceSettings,
  screen: ScreenInfo,
): SurfaceVerdict {
  if (settings.displaySurface === undefined) {
    return { surface: "UNVERIFIED", wrongMonitor: false };
  }
  if (settings.displaySurface !== "monitor") {
    return { surface: "WRONG_SURFACE", wrongMonitor: false };
  }

  const { width, height } = settings;
  const expectedW = screen.width * screen.dpr;
  const expectedH = screen.height * screen.dpr;
  if (!width || !height || expectedW <= 0 || expectedH <= 0) {
    return { surface: "MONITOR", wrongMonitor: false };
  }
  const off = (actual: number, expected: number) =>
    Math.abs(actual - expected) / expected > MONITOR_SIZE_TOLERANCE;
  return { surface: "MONITOR", wrongMonitor: off(width, expectedW) && off(height, expectedH) };
}
