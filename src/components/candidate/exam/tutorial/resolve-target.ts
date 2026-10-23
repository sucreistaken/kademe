import type { Target } from "./script-types";

/**
 * Where a script target is on the demo stage. Every target is found through
 * a stable attribute of the real exam components (or of the stage's own
 * wrappers), never through classes or text, so a restyle cannot break a
 * tutorial and a test can check every target against the stage's markup.
 */

/** The stage wraps each item in an element carrying its index. */
export const ITEM_ATTR = "data-demo-item";
/** Inside a target, the point the cursor presses (the button of a card), when it is not the middle of the target. */
export const PRESS_ATTR = "data-demo-press";

export type TargetMatch = { attr: string; value: string | null } | { tag: string };
/** Found in item `scope` (or anywhere when null): the first element that fits one of `anyOf`, in that order. */
export type TargetQuery = { scope: number | null; anyOf: TargetMatch[] };

const UI: Record<Extract<Target, { kind: "ui" }>["name"], TargetMatch[]> = {
  // The exam clock's pill (TimerPill).
  timer: [{ attr: "data-cue", value: null }],
  // The bottom bar's Mark button, or the first Mark of a group page's headings.
  mark: [
    { attr: "id", value: "tutorial-mark" },
    { attr: "data-demo-mark", value: null },
  ],
  next: [{ attr: "id", value: "tutorial-next" }],
  strip: [{ attr: "data-demo", value: "strip" }],
  // A writing or speaking task's column, or the reading text (ReadingPane's article).
  passage: [{ attr: "data-demo-task", value: null }, { tag: "article" }],
  player: [{ attr: "data-demo", value: "player" }],
  // The reading text's note tools.
  notes: [{ attr: "role", value: "toolbar" }],
  record: [{ attr: "data-demo", value: "record" }],
};

export function targetQuery(target: Target): TargetQuery {
  switch (target.kind) {
    case "ui":
      return { scope: null, anyOf: UI[target.name] };
    case "option":
      return { scope: target.item, anyOf: [{ attr: "data-demo-option", value: target.id }] };
    case "matchRow":
      return { scope: target.item, anyOf: [{ attr: "data-match-drop", value: target.id }] };
    case "tray":
      return { scope: target.item, anyOf: [{ attr: "data-match-tray", value: null }] };
    case "chip":
      return { scope: target.item, anyOf: [{ attr: "data-demo-chip", value: target.id }] };
    case "gap":
      return target.id === "text"
        ? { scope: target.item, anyOf: [{ tag: "textarea" }, { tag: "input" }] }
        : { scope: target.item, anyOf: [{ attr: "data-cloze-gap", value: target.id }] };
  }
}

function findMatch(root: ParentNode, match: TargetMatch): HTMLElement | null {
  if ("tag" in match) return root.querySelector<HTMLElement>(match.tag);
  for (const el of root.querySelectorAll<HTMLElement>(`[${match.attr}]`)) {
    if (match.value === null || el.getAttribute(match.attr) === match.value) return el;
  }
  return null;
}

/** The element of a target inside the stage, or null when the stage does not show it now. */
export function resolveTarget(stage: ParentNode, target: Target): HTMLElement | null {
  const q = targetQuery(target);
  const scope = q.scope === null ? stage : stage.querySelector(`[${ITEM_ATTR}="${q.scope}"]`);
  if (!scope) return null;
  for (const m of q.anyOf) {
    const el = findMatch(scope, m);
    if (el) return el;
  }
  return null;
}

/** Where the cursor goes on a target's element: its press point when it has one. */
export function pressPoint(el: HTMLElement): HTMLElement {
  return el.querySelector<HTMLElement>(`[${PRESS_ATTR}]`) ?? el;
}
