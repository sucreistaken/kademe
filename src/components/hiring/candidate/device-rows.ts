import type { Locale } from "@/i18n/locale";

/**
 * HIRING-UX 6.3 as data: the active row opens, finished rows fold into one
 * "Hazır" line, the connection row informs and never blocks, and the button's
 * reason names the one thing it waits for.
 */
export type Permission = "idle" | "asking" | "granted" | "denied";
export type Trial = "none" | "recording" | "ready" | "played";
export type RowId = "camera" | "microphone" | "trial" | "connection";
export type RowState = "active" | "done" | "waiting" | "info";
type Input = { camera: boolean; permission: Permission; heard: boolean; trial: Trial };

export function deviceRows(input: Input): Array<{ id: RowId; state: RowState }> {
  const granted = input.permission === "granted";
  const rows: Array<{ id: RowId; state: RowState }> = [];
  if (input.camera) rows.push({ id: "camera", state: granted ? "done" : "active" });
  rows.push({ id: "microphone", state: input.heard && granted ? "done" : granted || !input.camera ? "active" : "waiting" });
  rows.push({ id: "trial", state: input.trial === "played" ? "done" : granted && input.heard ? "active" : "waiting" });
  rows.push({ id: "connection", state: "info" });
  return rows;
}

export type Blocker = "permission" | "permissionMic" | "sound" | "trialNone" | "trialRecording" | "trialListen";

export function deviceBlocker(input: Input): Blocker | null {
  if (input.permission !== "granted") return input.camera ? "permission" : "permissionMic";
  if (!input.heard) return "sound";
  if (input.trial === "none") return "trialNone";
  if (input.trial === "recording") return "trialRecording";
  if (input.trial === "ready") return "trialListen";
  return null;
}

export type FixKey = "chrome" | "safariMac" | "ios" | "android" | "firefox" | "other";

/** Which "Nasıl düzeltirim?" steps to show. Order matters: iOS and Android browsers also say "Safari". */
export function fixKeyFor(userAgent: string): FixKey {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
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
 * A refused permission (the candidate or a policy said no) gets the browser's
 * steps; anything else (no device, a device another app holds, no
 * mediaDevices on an insecure address) is "could not reach it".
 */
export function deniedKind(err: unknown): "notAllowed" | "other" {
  const name = err && typeof err === "object" && "name" in err ? (err as { name: unknown }).name : undefined;
  return name === "NotAllowedError" || name === "SecurityError" ? "notAllowed" : "other";
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
