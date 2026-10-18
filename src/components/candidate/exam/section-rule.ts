import type { TextGapKind } from "@/lib/exam/types";

/**
 * The "how you answer" line of a GRAMMAR section intro made only of texts,
 * named by the kinds of text in it. A C-test keeps its own line (old exams);
 * cloze and word bank each have one, and a section with both explains both.
 */
export type TextRuleKey = "ruleGRAMMARCTest" | "ruleGRAMMARCloze" | "ruleGRAMMARWordBank" | "ruleGRAMMARTexts";

export function textRuleKey(kinds: readonly TextGapKind[]): TextRuleKey {
  if (kinds.includes("CTEST")) return "ruleGRAMMARCTest";
  const cloze = kinds.includes("CLOZE");
  const bank = kinds.includes("WORDBANK");
  if (cloze && bank) return "ruleGRAMMARTexts";
  return bank ? "ruleGRAMMARWordBank" : cloze ? "ruleGRAMMARCloze" : "ruleGRAMMARCTest";
}
