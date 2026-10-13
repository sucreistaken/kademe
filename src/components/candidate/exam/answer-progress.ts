import type { ItemAnswer } from "@/lib/exam/types";

/**
 * How much of one item the student has filled in, counted in sub-answers: one
 * per true/false statement, gap or matching row, and one for a choice, a text
 * or a recording. Pure and shared, so the question screen, the review step
 * and the server's progress strip count the same way.
 *
 * Takes the item's content shape only (the student's `CandidateContent` and
 * the server's snapshot content both fit); keys never come into it.
 */
export type ProgressContent =
  | { kind: "CHOICE" }
  | { kind: "TFNG"; statements: ReadonlyArray<{ id: string }> }
  | { kind: "GAP"; gaps: ReadonlyArray<{ id: string }> }
  | { kind: "MATCHING"; left: ReadonlyArray<{ id: string }> }
  | { kind: "SHORT_TEXT" | "WRITING" | "SPEAKING" };

export type AnswerProgress = { filled: number; total: number };

export type ProgressState = "EMPTY" | "PARTIAL" | "COMPLETE";

const TFNG_VALUES: ReadonlySet<string> = new Set(["R", "F", "NG"]);

const filledText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

export function answerProgress(content: ProgressContent, answer: ItemAnswer | null | undefined): AnswerProgress {
  const a = answer ?? {};
  switch (content.kind) {
    case "CHOICE":
      return { filled: (a.choiceIds?.length ?? 0) > 0 ? 1 : 0, total: 1 };
    case "TFNG":
      return {
        filled: content.statements.filter((s) => TFNG_VALUES.has(a.tfng?.[s.id] ?? "")).length,
        total: content.statements.length,
      };
    case "GAP":
      return { filled: content.gaps.filter((g) => filledText(a.gaps?.[g.id])).length, total: content.gaps.length };
    case "MATCHING":
      // A row set back to "Seçin" is stored as "": it is empty, not answered.
      return { filled: content.left.filter((l) => filledText(a.matches?.[l.id])).length, total: content.left.length };
    default:
      return { filled: filledText(a.text) || !!a.mediaAssetId ? 1 : 0, total: 1 };
  }
}

export function progressState({ filled, total }: AnswerProgress): ProgressState {
  if (filled <= 0) return "EMPTY";
  return filled >= total ? "COMPLETE" : "PARTIAL";
}
