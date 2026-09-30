import type { ItemAnswer, ItemContent, ItemKey, ItemType } from "./types";

/**
 * Scoring objective items against their key. Productive items (writing,
 * speaking) return null: they are judged, not scored, and that happens in the
 * grading pipeline.
 *
 * Every score is a fraction in [0, 1]. `correct` is true only for a full score.
 */

export type ItemScore = { score: number; correct: boolean } | null;

const UMLAUT_FALLBACK: Array<[RegExp, string]> = [
  [/ae/g, "ä"],
  [/oe/g, "ö"],
  [/ue/g, "ü"],
];

/**
 * Canonical form of a typed answer: Unicode NFC, trimmed, inner whitespace
 * collapsed, trailing punctuation dropped, case folded.
 *
 * Case is folded because a gap at the start of a sentence invites "Dem" where
 * the key says "dem", and the exam measures grammar, not the shift key.
 * `ß` and `ss` are treated alike (Swiss German does not use `ß`).
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/u, "")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss");
}

/** Same, but also reads ae/oe/ue as umlauts, for students without a German keyboard. */
function withUmlauts(normalized: string): string {
  return UMLAUT_FALLBACK.reduce((s, [re, to]) => s.replace(re, to), normalized);
}

export function typedMatches(given: string | undefined, accepted: string[]): boolean {
  if (!given || !given.trim()) return false;
  const g = normalizeAnswer(given);
  return accepted.some((a) => {
    const k = normalizeAnswer(a);
    return g === k || withUmlauts(g) === k || withUmlauts(g) === withUmlauts(k);
  });
}

export function scoreItem(
  type: ItemType,
  content: ItemContent,
  key: ItemKey,
  answer: ItemAnswer | null | undefined,
): ItemScore {
  const a = answer ?? {};
  switch (key.kind) {
    case "NONE":
      return null;
    case "CHOICE": {
      const picked = new Set(a.choiceIds ?? []);
      if (type === "SINGLE_CHOICE") {
        const ok = picked.size === 1 && picked.has(key.correct[0]);
        return { score: ok ? 1 : 0, correct: ok };
      }
      const correct = new Set(key.correct);
      let hits = 0;
      let falsePicks = 0;
      for (const id of picked) {
        if (correct.has(id)) hits++;
        else falsePicks++;
      }
      const score = Math.max(0, hits - falsePicks) / correct.size;
      return { score, correct: score === 1 };
    }
    case "TFNG": {
      const ids = content.kind === "TFNG" ? content.statements.map((s) => s.id) : Object.keys(key.answers);
      const right = ids.filter((id) => a.tfng?.[id] === key.answers[id]).length;
      const score = ids.length === 0 ? 0 : right / ids.length;
      return { score, correct: score === 1 };
    }
    case "GAP": {
      const ids = Object.keys(key.answers);
      const right = ids.filter((id) => typedMatches(a.gaps?.[id], key.answers[id])).length;
      const score = ids.length === 0 ? 0 : right / ids.length;
      return { score, correct: score === 1 };
    }
    case "MATCHING": {
      const ids = Object.keys(key.pairs);
      const right = ids.filter((id) => a.matches?.[id] === key.pairs[id]).length;
      const score = ids.length === 0 ? 0 : right / ids.length;
      return { score, correct: score === 1 };
    }
    case "SHORT_TEXT": {
      const ok = typedMatches(a.text, key.accepted);
      return { score: ok ? 1 : 0, correct: ok };
    }
  }
}

/** Whether the student gave anything at all, for "answered" counts and required checks. */
export function hasAnswer(type: ItemType, answer: ItemAnswer | null | undefined): boolean {
  if (!answer) return false;
  switch (type) {
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return (answer.choiceIds?.length ?? 0) > 0;
    case "TRUE_FALSE_NG":
      return Object.keys(answer.tfng ?? {}).length > 0;
    case "GAP_FILL":
      return Object.values(answer.gaps ?? {}).some((v) => v.trim().length > 0);
    case "MATCHING":
      return Object.keys(answer.matches ?? {}).length > 0;
    case "SHORT_TEXT":
    case "WRITING_PROMPT":
      return (answer.text?.trim().length ?? 0) > 0 || !!answer.mediaAssetId;
    case "SPEAKING_PROMPT":
      return !!answer.mediaAssetId || (answer.text?.trim().length ?? 0) > 0;
  }
}

export const wordCount = (text: string | undefined): number =>
  (text ?? "").trim().split(/\s+/u).filter(Boolean).length;
