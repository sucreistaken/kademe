import type { Locale } from "@/i18n/locale";

/**
 * HIRING-UX 6.3 as data: the active row opens, finished rows fold into one
 * "Hazır" line, the connection row informs and never blocks, and the button's
 * reason names the one thing it waits for.
 *
 * The microphone gate has an escape (Task 12 review ruling): a working
 * microphone can read quiet, and a browser can keep the sound context
 * suspended. After QUIET_AFTER_MS unheard (`quiet`), the microphone row stays
 * open with a hint ("quiet") and the trial opens; the candidate's own voice on
 * the playback is then the microphone's proof.
 */
export type Permission = "idle" | "asking" | "granted" | "denied";
export type Trial = "none" | "recording" | "ready" | "played";
export type RowId = "camera" | "microphone" | "trial" | "connection";
export type RowState = "active" | "done" | "waiting" | "info" | "quiet";
type Input = { camera: boolean; permission: Permission; heard: boolean; quiet: boolean; trial: Trial };

export function deviceRows(input: Input): Array<{ id: RowId; state: RowState }> {
  const granted = input.permission === "granted";
  const rows: Array<{ id: RowId; state: RowState }> = [];
  if (input.camera) rows.push({ id: "camera", state: granted ? "done" : "active" });
  const micState: RowState = granted && input.heard ? "done" : granted && input.quiet ? "quiet" : granted || !input.camera ? "active" : "waiting";
  rows.push({ id: "microphone", state: micState });
  rows.push({ id: "trial", state: input.trial === "played" ? "done" : granted && (input.heard || input.quiet) ? "active" : "waiting" });
  rows.push({ id: "connection", state: "info" });
  return rows;
}

export type Blocker = "permission" | "permissionMic" | "sound" | "trialNone" | "trialRecording" | "trialListen";

export function deviceBlocker(input: Input): Blocker | null {
  if (input.permission !== "granted") return input.camera ? "permission" : "permissionMic";
  if (!input.heard && !input.quiet) return "sound";
  if (input.trial === "none") return "trialNone";
  if (input.trial === "recording") return "trialRecording";
  if (input.trial === "ready") return "trialListen";
  return null;
}

/** How long the microphone row waits for a voice before it lets the trial prove the microphone. */
export const QUIET_AFTER_MS = 8000;
/** A sound context still suspended this long will not start by itself. */
const SUSPENDED_GIVE_UP_MS = 1000;

export function isQuiet(input: { heard: boolean; listenedMs: number; suspendedMs: number }): boolean {
  return !input.heard && (input.listenedMs >= QUIET_AFTER_MS || input.suspendedMs >= SUSPENDED_GIVE_UP_MS);
}

export type FixKey = "chrome" | "safariMac" | "ios" | "iosOther" | "android" | "firefox" | "inApp" | "other";

/**
 * Which "Nasıl düzeltirim?" steps to show. Order matters: in-app browsers
 * (Facebook, Instagram, LinkedIn, the Google app, LINE, an Android WebView)
 * come first, since they carry the browser's name too; iOS browsers other than
 * Safari have their own switch in Settings; iOS and Android browsers also say
 * "Safari". iPadOS asks for the desktop site and says "Macintosh": a touch
 * screen (`maxTouchPoints` > 1) tells it from a Mac.
 */
export function fixKeyFor(userAgent: string, maxTouchPoints = 0): FixKey {
  if (/FBAN|FBAV|Instagram|LinkedInApp|GSA\/|Line\/|; wv\)/.test(userAgent)) return "inApp";
  if (/CriOS|FxiOS|EdgiOS/.test(userAgent)) return "iosOther";
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Firefox\//i.test(userAgent)) return "firefox";
  if (/Chrome\/|Edg\//i.test(userAgent)) return "chrome";
  if (/Safari\//i.test(userAgent) && /Macintosh/i.test(userAgent)) return "safariMac";
  return "other";
}

/** The camera only when a video question exists; the microphone always, with the browser's voice clean-up. */
export function mediaConstraints(camera: boolean): MediaStreamConstraints {
  const audio = { echoCancellation: true, noiseSuppression: true };
  return camera ? { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio } : { audio };
}

/**
 * Why the camera or microphone did not open, so each gets its own next step:
 * a refused permission gets the browser's steps, no device gets "try another
 * device", a device another app holds gets "close it and try again".
 * "unsupported" (no mediaDevices at all: an in-app browser, an insecure
 * address) is decided before asking, never from an error.
 */
export type DeniedKind = "notAllowed" | "notFound" | "busy" | "unsupported" | "other";

export function deniedKind(err: unknown): Exclude<DeniedKind, "unsupported"> {
  const name = err && typeof err === "object" && "name" in err ? (err as { name: unknown }).name : undefined;
  if (name === "NotAllowedError" || name === "SecurityError") return "notAllowed";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "notFound";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "other";
}

/** A voice moves the microphone's level past this (0..1 of full scale); a room's hum does not. */
export const HEARD_AT = 0.06;

/** The loudest sample of one analyser frame (unsigned 8-bit, silence at 128), as 0..1. */
export function peakLevel(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i] - 128) / 128);
  return peak;
}

/**
 * Upload speed from one probe: 2 Mbps is enough for recorded answers. Shown
 * whole from 10 up, with one decimal below. Advice only: it never blocks.
 */
export function uploadSpeed(bytes: number, ms: number): { state: "ok" | "low"; mbps: number } {
  const mbps = (bytes * 8) / (Math.max(ms, 1) / 1000) / 1_000_000;
  return { state: mbps >= 2 ? "ok" : "low", mbps: mbps >= 10 ? Math.round(mbps) : Math.round(mbps * 10) / 10 };
}

/** The candidate's own number format ("4,2" in Turkish, HIRING-UX 8.4). */
export function formatMbps(mbps: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(mbps);
}
