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

/**
 * The exam bar's fixed button widths in px (the bar never changes size; the
 * classes in step-footer.tsx spell the same numbers). Back and the flag carry a
 * 16px icon and an 8px gap; every button has 12px padding and a 2px border on
 * each side.
 */
export const EXAM_BAR_WIDTH = { back: 112, flag: 168, primary: 176 } as const;

/**
 * At most this many px a label character takes in the bar (Nunito 16px bold and
 * extra bold, Noto Sans Arabic for Arabic). Measured average on the five
 * locales' bar labels: at most about 9.1px; a single W is about 18px, so the
 * budget is an average, not a worst case for every letter.
 */
export const EXAM_BAR_CHAR_PX = 10;

/** How many characters a label of the exam bar may have to fit its fixed button. */
export function examBarLabelBudget(width: number, icon: boolean): number {
  return Math.floor((width - 2 * (12 + 2) - (icon ? 16 + 8 : 0)) / EXAM_BAR_CHAR_PX);
}
