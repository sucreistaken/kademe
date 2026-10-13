import { issueMessage, type RowIssue } from "@/lib/exam/bank-sheet";
import type { ItemProblem } from "@/lib/exam/validate";

/**
 * The teacher's sentence for a structural problem or a sheet row problem.
 * `t` is a translator for the `bankTools` namespace (server or client).
 */
export type BankT = (key: string, values?: Record<string, string | number>) => string;

export const issueText = (t: BankT, issue: RowIssue): string => {
  const m = issueMessage(issue);
  return t(m.key, m.values);
};

export const problemSentence = (t: BankT, problem: ItemProblem): string => issueText(t, { kind: "item", problem });
