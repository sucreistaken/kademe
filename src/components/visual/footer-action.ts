/**
 * G2, G9 and plan decision 4: the one filled button of a step screen, as data,
 * so the footer draws it and no screen can disable it without a reason. A
 * button that works keeps its filled look (aria-disabled and a spinner, its
 * label says what it does); a button that waits for the candidate turns grey
 * and its reason stands next to it, linked by `id` + `-why`.
 */
export type FooterAction =
  | { kind: "button"; id: string; label: string; onClick: () => void; busy?: boolean; busyLabel?: string; waitReason?: string | null }
  | { kind: "link"; id: string; label: string; href: string };

export function footerButtonState(action: Extract<FooterAction, { kind: "button" }>) {
  if (action.busy) return { mode: "busy" as const, label: action.busyLabel ?? action.label, reason: null, describedBy: undefined };
  if (action.waitReason) return { mode: "waiting" as const, label: action.label, reason: action.waitReason, describedBy: `${action.id}-why` };
  return { mode: "ready" as const, label: action.label, reason: null, describedBy: undefined };
}

/** The CSS variable the measured bar writes on <html>; the spacer and the scroll padding read it. */
export const FOOTER_SPACE_VAR = "--step-footer-space";

/**
 * G9: the room the fixed bar takes at the bottom of the window: its measured
 * height (journey, bar and any note) plus a 24px gap, so content is never
 * under it. Until it is measured (on the server, before the first paint, in a
 * browser without ResizeObserver) the room is the 112px of a plain bar.
 */
export function footerSpace(measured: number | null | undefined): string {
  return typeof measured === "number" && Number.isFinite(measured) && measured > 0 ? `${Math.ceil(measured) + 24}px` : "112px";
}
