import type { CandidateState } from "@/lib/exam-flow";

/**
 * The language exam is desktop only (user decision 2026-10-14). These are the
 * pure halves of that rule, shared by the browser check (isMobileDevice in
 * MobileBlock.tsx) and the exam page's gate (DesktopOnlyGate).
 */

/** What the browser says about itself. */
export type BrowserSignals = {
  /** navigator.userAgentData.mobile; undefined where the browser has no userAgentData (Safari, Firefox). */
  uaMobile: boolean | undefined;
  hasDisplayMedia: boolean;
  coarsePointer: boolean;
  userAgent: string;
};

/**
 * A phone or a tablet: the browser says it is mobile, or it cannot share a
 * screen (no getDisplayMedia) and has a touch pointer or a phone or tablet UA.
 */
export function isMobileSignals(s: BrowserSignals): boolean {
  if (s.uaMobile) return true;
  return !s.hasDisplayMedia && (s.coarsePointer || /Android|iPhone|iPad|iPod/i.test(s.userAgent));
}

const PHONE_UA = /iPhone|iPod|Windows Phone|Android.*Mobile/i;

/**
 * The server's reading of the request: only a definite phone signal
 * (Sec-CH-UA-Mobile ?1 or a phone UA) is "mobile", so a phone sees the
 * desktop-only screen in the first paint. Anything else is "unknown" and the
 * browser decides (an iPad asking for the desktop site says "Macintosh").
 */
export function serverDeviceHint(h: { get(name: string): string | null } | null): "mobile" | "unknown" {
  if (!h) return "unknown";
  return h.get("sec-ch-ua-mobile") === "?1" || PHONE_UA.test(h.get("user-agent") ?? "") ? "mobile" : "unknown";
}

/** What the exam page shows for a device verdict: nothing at all until the device is known. */
export function examPageView(device: "mobile" | "desktop" | "unknown"): "block" | "exam" | "wait" {
  return device === "mobile" ? "block" : device === "desktop" ? "exam" : "wait";
}

/**
 * Where the student stands, for the phone screen's lead: before the first
 * section (nothing has started), between sections (finished ones are kept,
 * the next clock waits), or inside a running section (its clock runs).
 */
export type MobileMoment = "start" | "between" | "running";

export function mobileMoment(state: Pick<CandidateState, "step" | "sections">): MobileMoment {
  if (state.step === "ITEM") return "running";
  return state.sections.some((s) => s.done) ? "between" : "start";
}
