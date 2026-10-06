import type { Cefr, ItemContent, ItemKey, ItemType, Section } from "@/lib/exam/types";

/** What the QUESTION_SET cards show of an item besides its prompt. Pure, client-safe. */
export type ItemPreview = { lines: Array<{ text: string; correct: boolean }> };

export type ReviewItem = {
  id: string;
  section: Section;
  level: Cefr;
  type: ItemType;
  prompt: string;
  status: "DRAFT" | "APPROVED" | "REJECTED" | "RETIRED";
  stimulusTitle: string | null;
  stimulusBody: string | null;
  hasAudio: boolean;
  preview: ItemPreview;
};

export function itemPreview(content: ItemContent, key: ItemKey): ItemPreview {
  switch (content.kind) {
    case "CHOICE": {
      const correct = key.kind === "CHOICE" ? key.correct : [];
      return { lines: content.options.map((o) => ({ text: o.text, correct: correct.includes(o.id) })) };
    }
    case "TFNG": {
      const answers = key.kind === "TFNG" ? key.answers : {};
      return { lines: content.statements.map((s) => ({ text: `${s.text} (${answers[s.id] ?? "?"})`, correct: false })) };
    }
    case "GAP": {
      const answers = key.kind === "GAP" ? key.answers : {};
      return { lines: content.gaps.map((g) => ({ text: `${g.id}: ${(answers[g.id] ?? []).join(" / ")}`, correct: false })) };
    }
    case "MATCHING": {
      const pairs = key.kind === "MATCHING" ? key.pairs : {};
      const right = new Map(content.right.map((r) => [r.id, r.text]));
      return { lines: content.left.map((l) => ({ text: `${l.text} -> ${right.get(pairs[l.id]) ?? "?"}`, correct: false })) };
    }
    default:
      return { lines: [] };
  }
}
