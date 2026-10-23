import type { TextGapKind } from "@/lib/exam/types";

/**
 * The "how you answer" line of a GRAMMAR section intro made only of texts,
 * named by the kinds of text in it. A C-test keeps its own line (old exams);
 * cloze, word bank and open cloze each have one, a section with both cloze and
 * word bank explains both, and any mix that includes open gaps says that the
 * way of answering changes from text to text.
 */
export type TextRuleKey =
  | "ruleGRAMMARCTest"
  | "ruleGRAMMARCloze"
  | "ruleGRAMMARWordBank"
  | "ruleGRAMMAROpen"
  | "ruleGRAMMARTexts"
  | "ruleGRAMMARTextsMixed";

export function textRuleKey(kinds: readonly TextGapKind[]): TextRuleKey {
  if (kinds.includes("CTEST")) return "ruleGRAMMARCTest";
  const cloze = kinds.includes("CLOZE");
  const bank = kinds.includes("WORDBANK");
  const open = kinds.includes("OPEN");
  if (open) return cloze || bank ? "ruleGRAMMARTextsMixed" : "ruleGRAMMAROpen";
  if (cloze && bank) return "ruleGRAMMARTexts";
  return bank ? "ruleGRAMMARWordBank" : cloze ? "ruleGRAMMARCloze" : "ruleGRAMMARCTest";
}
