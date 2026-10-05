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
