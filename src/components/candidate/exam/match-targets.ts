import { matchingTargets, type CandidateImage } from "@/lib/exam/safe";
import { AD_TONE_CLASSES, adTone } from "@/lib/exam/ad-tone";
import { matchChoices } from "@/lib/exam/match-options";
import { passageBlocks } from "@/lib/exam/passage-blocks";
import { pictureCaption } from "./ExamImage";

/**
 * A matching item's targets as the lists draw them: the letter, the words next
 * to it and the colour of the letter's disc. Pure, so it is tested without a
 * browser.
 */
export type TargetView = {
  id: string;
  /** A, B, C ... or 0 ("fits nobody"). */
  badge: string;
  /** What the list shows next to the letter: the advert's title, the picture's caption, or the sentence itself. */
  label: string;
  image?: CandidateImage;
  /** A picture target's own words ("Bild A" says nothing, so then null); the gallery prints it under the picture. */
  caption: string | null;
  /** The border class of the letter disc (the advert card's tone), or null for a neutral disc. */
  disc: string | null;
};

/** One option of a row's list. */
export type PickerChoice = {
  id: string;
  badge: string;
  label: string;
  disc: string | null;
  selected: boolean;
  /** Where another row holds it ("in Lücke 2"); null when it is free. */
  hint: string | null;
};

/**
 * A matching answer with one row set, or removed when `targetId` is null. Never stores "".
 * `exclusive` (text insertion: every sentence is used once): a target another row holds moves
 * to this row. Other matching lets two rows share a target (one person's two statements).
 */
export function withMatch(matches: Record<string, string> | undefined, rowId: string, targetId: string | null, exclusive = false) {
  const next = { ...(matches ?? {}) };
  if (targetId) {
    if (exclusive) for (const [other, held] of Object.entries(next)) if (held === targetId) delete next[other];
    next[rowId] = targetId;
  } else delete next[rowId];
  return next;
}

/** "Anzeige A" and "Abschnitt C" only repeat the letter: the title lives on the card in the text. */
const isBare = (r: { badge: string; label: string }) => r.badge === "0" || /^(?:\p{L}+\s+)?[A-Z]$/u.test(r.label.trim());

/** The title of each lettered card of a passage ("A  Computerkurs" gives A: Computerkurs). */
export function cardTitles(text: string, title: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const b of passageBlocks(text, title)) {
    if (b.kind === "card" && b.marker && b.title && /^[A-Z]$/.test(b.marker)) out.set(b.marker, b.title);
  }
  return out;
}

export function targetViews(right: ReadonlyArray<{ id: string; text: string; image?: CandidateImage }>, titles: ReadonlyMap<string, string> = new Map()): TargetView[] {
  const targets = matchingTargets([...right]);
  const bare = targets.every(isBare);
  return targets.map((r, i) => {
    const caption = r.image ? pictureCaption(r.text) : null;
    const label = r.image ? (caption ?? r.image.alt) : bare && r.badge !== "0" ? (titles.get(r.badge) ?? r.label) : r.label;
    const disc = !r.image && bare && r.badge !== "0" ? AD_TONE_CLASSES[adTone(r.badge, i)].disc : null;
    return { id: r.id, badge: r.badge, label, image: r.image, caption, disc };
  });
}

/** The row's options in list order (free first, used last) with their hints. */
export function pickerChoices(
  views: readonly TargetView[],
  matches: Readonly<Record<string, string>>,
  rowId: string,
  rowOrder: readonly string[],
  hint: (usedBy: string[]) => string,
): PickerChoice[] {
  return matchChoices(views, matches, rowId, rowOrder).map(({ target, selected, usedBy }) => ({
    id: target.id,
    badge: target.badge,
    label: target.label,
    disc: target.disc,
    selected,
    hint: usedBy.length > 0 ? hint(usedBy) : null,
  }));
}
