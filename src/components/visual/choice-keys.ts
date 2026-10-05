/** 3.7: a letter is the visible mark of a choice; the digits 1-9 are its keyboard shortcut (shown as a key). */
export const choiceLetter = (index: number) => (index < 26 ? String.fromCharCode(65 + index) : String(index + 1));
export const choiceShortcut = (index: number) => (index < 9 ? String(index + 1) : null);

const FORWARD = new Set(["ArrowDown", "ArrowRight"]);
const BACKWARD = new Set(["ArrowUp", "ArrowLeft"]);

/**
 * G6: the arrow keys, Home and End inside a group of checkbox cards move the
 * focus (never the choice) to the next card that can take it, wrapping at the
 * ends, the way native radios already move. Any other key is not the group's:
 * null. Letters and digits never act here, so typing elsewhere is never caught.
 */
export function nextChoiceIndex(input: { key: string; from: number; enabled: boolean[] }): number | null {
  const { key, from, enabled } = input;
  const open = enabled.flatMap((on, i) => (on ? [i] : []));
  if (open.length === 0) return null;
  if (key === "Home") return open[0];
  if (key === "End") return open[open.length - 1];
  if (FORWARD.has(key)) return open.find((i) => i > from) ?? open[0];
  if (BACKWARD.has(key)) return [...open].reverse().find((i) => i < from) ?? open[open.length - 1];
  return null;
}

/** HIRING-UX 6.8: keys 1-9 pick the choice in that place. */
export function keyIndex(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const index = Number(key) - 1;
  return index < count ? index : null;
}

/** Inputs that take a click, not typing: a digit pressed on them may still pick a choice. */
const CLICKED_INPUTS = new Set(["radio", "checkbox", "button", "submit", "reset"]);

export type KeyTarget = { tagName?: string; type?: string; isContentEditable?: boolean } | null;

/**
 * True when a key press belongs to a field the candidate types into (a text
 * answer, the Help form, an address bar substitute), so the choice keys stay
 * out of it (ruling 5).
 */
export function isTypingTarget(target: KeyTarget): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !CLICKED_INPUTS.has((target.type ?? "text").toLowerCase());
  return false;
}

/**
 * Task 4 carry 7: the pure part of useChoiceShortcuts. The choice a key press
 * picks (its place), or null: a key with a modifier, one another handler took
 * or one typed into a field is never a choice.
 */
export function shortcutChoice(
  press: { key: string; target: KeyTarget; defaultPrevented?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  count: number,
): number | null {
  if (press.defaultPrevented || press.metaKey || press.ctrlKey || press.altKey) return null;
  if (isTypingTarget(press.target)) return null;
  return keyIndex(press.key, count);
}
