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
