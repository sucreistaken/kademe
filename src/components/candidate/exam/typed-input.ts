import type { CandidateContent } from "@/lib/exam/safe";

/**
 * Whether the student enters this answer by typing (autosave waits for a pause)
 * or by clicking and dragging (autosave goes out almost at once). Drop-down
 * gaps, C-test parts, word-bank words and cloze options are clicks.
 */
export function entersByTyping(content: CandidateContent | undefined): boolean {
  switch (content?.kind) {
    case "WRITING":
    case "SHORT_TEXT":
    case "SPEAKING":
      return true;
    case "GAP":
      return !content.cloze && !content.pool && content.gaps.some((g) => !g.choices);
    default:
      return false;
  }
}
