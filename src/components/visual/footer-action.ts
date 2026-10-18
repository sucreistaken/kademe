import type { ReactNode } from "react";

/**
 * G2, G9 and plan decision 4: the one filled button of a step screen, as data,
 * so the footer draws it and no screen can disable it without a reason. A
 * button that works keeps its filled look (aria-disabled and a spinner, its
 * label says what it does); a button that waits for the candidate turns grey
 * and its reason stands next to it, linked by `id` + `-why`.
 */
export type FooterAction =
  | {
      kind: "button";
      id: string;
      label: string;
      onClick: () => void;
      busy?: boolean;
      busyLabel?: string;
      waitReason?: string | null;
      /** A small picture before the label. */
      icon?: ReactNode;
      /** "flagged": a toggle that is on (filled amber); the button is then aria-pressed. */
      tone?: "flagged";
      /** What assistive technology and the tooltip say when the visible label alone is not the action. */
      ariaLabel?: string;
    }
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

/** The CSS variable the floating notice layer writes on <html> while a notice shows. */
export const NOTICE_SPACE_VAR = "--step-notice-space";

/**
 * The room a floating notice takes above the bar: its measured height (with the
 * layer's own gap to the bar), 0 when there is none or it is not measured yet.
 */
export function noticeSpace(measured: number | null | undefined): string {
  return typeof measured === "number" && Number.isFinite(measured) && measured > 0 ? `${Math.ceil(measured)}px` : "0px";
}

/**
 * Where something pinned just above the bar sits (the word-bank and C-test
 * pool tray, the finishing toast): above the bar and above any notice, so a
 * save failure never hides what the student still has to reach.
 */
export const ABOVE_FOOTER = `calc(var(${FOOTER_SPACE_VAR}, 112px) + var(${NOTICE_SPACE_VAR}, 0px))`;
