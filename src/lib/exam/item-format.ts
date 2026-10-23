import { matchingTargets } from "./safe";
import { textGapKindOf, type ItemContent, type ItemType } from "./types";

/**
 * An item's format: what the student sees and does, as opposed to what the
 * item tests. Form drawing mixes formats (blueprint.ts: mixFormats), so a
 * student does not meet the same kind of question again and again.
 *
 * Parts, joined by "/":
 *   - a text with gaps: its kind (CTEST, CLOZE, WORDBANK, OPEN) and nothing else
 *   - else the item type, then
 *     - TRUE_FALSE_NG: JA_NEIN when it is worded Ja / Nein / Text sagt dazu nichts
 *     - MATCHING: LETTERS when the student picks letters, as ItemView.tsx
 *       MatchingItem decides (`lettersOnly`): every target is only a letter
 *       naming a text ("Anzeige A", "Person B"), or the targets are pictures,
 *       whatever their captions; else WORDS (headings, sentences, names)
 *     - MULTI_CHOICE: PICK when the student ticks an exact number of boxes
 *     - PICTURE when an option, a target or the task shows a picture
 *
 * Examples: "SINGLE_CHOICE", "SINGLE_CHOICE/PICTURE", "TRUE_FALSE_NG/JA_NEIN",
 * "MATCHING/LETTERS/PICTURE", "MULTI_CHOICE/PICK", "CLOZE".
 */
export function itemFormatOf(item: { type: ItemType; skillTag: string; content: ItemContent }): string {
  const text = textGapKindOf(item);
  if (text) return text;
  const c = item.content;
  const parts: string[] = [item.type];
  if (c.kind === "TFNG" && c.wording) parts.push(c.wording);
  if (c.kind === "MATCHING") parts.push(lettersOnly(c.right) ? "LETTERS" : "WORDS");
  if (c.kind === "CHOICE" && c.pick !== undefined) parts.push("PICK");
  if (hasPicture(c)) parts.push("PICTURE");
  return parts.join("/");
}

/**
 * The format of a bank item for drawing a form, never throwing: an item whose
 * content does not have the shape its kind promises gets its item type, so one
 * malformed item cannot stop a section from starting for every student.
 */
export function drawFormatOf(item: { type: ItemType; skillTag: string; content: ItemContent }): string {
  try {
    return itemFormatOf(item);
  } catch {
    return item.type;
  }
}

/**
 * The student picks letters, as MatchingItem in ItemView.tsx decides
 * (`lettersOnly = bare || gallery.length > 0`): every target is a bare letter
 * (or the "0" target "Keine Anzeige passt"), or some target is a picture.
 */
function lettersOnly(right: Array<{ text: string; image?: unknown }>): boolean {
  const bare = matchingTargets(right).every((r) => r.badge === "0" || /^(?:\p{L}+\s+)?[A-Z]$/u.test(r.label.trim()));
  return bare || right.some((r) => !!r.image);
}

function hasPicture(c: ItemContent): boolean {
  switch (c.kind) {
    case "CHOICE":
      return c.options.some((o) => !!o.image);
    case "MATCHING":
      return c.right.some((r) => !!r.image);
    case "WRITING":
    case "SPEAKING":
      return (c.images?.length ?? 0) > 0;
    default:
      return false;
  }
}
