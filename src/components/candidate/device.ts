/**
 * The language exam is desktop only (user decision 2026-10-14). These are the
 * pure halves of that rule, shared by the browser check (isMobileDevice in
 * MobileBlock.tsx) and the exam page's gate (DesktopOnlyGate).
 *
 * One exception (2026-11-09): an exam whose state says `allowMobile` (the
 * public web check, see src/lib/exam/mobile.ts) runs on a phone or a tablet,
 * so none of the three places that block a phone (the consent screen, the
 * system check, the exam page) shows it the desktop-only screen.
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

/**
 * What the exam page shows for a device verdict: nothing at all until the
 * device is known. A phone is blocked unless the exam runs on phones
 * (`allowMobile`); then it gets the exam like a computer.
 */
export function examPageView(device: "mobile" | "desktop" | "unknown", allowMobile = false): "block" | "exam" | "wait" {
  if (device === "unknown") return "wait";
  return device === "mobile" && !allowMobile ? "block" : "exam";
}

/** Whether the consent screen and the system check show this device the desktop-only screen. */
export function blocksDevice(mobile: boolean, allowMobile = false): boolean {
  return mobile && !allowMobile;
}

/**
 * Where the student stands, for the phone screen's lead: before the first
 * section (nothing has started), between sections (finished ones are kept,
 * the next clock waits), or inside a running section (its clock runs).
 */
export type MobileMoment = "start" | "between" | "running";

export function mobileMoment(state: { step: string; sections: ReadonlyArray<{ done: boolean }> }): MobileMoment {
  if (state.step === "ITEM") return "running";
  return state.sections.some((s) => s.done) ? "between" : "start";
}
