import type { RulesProblem } from "@/solutions/hiring/rules/opening-rules";

/**
 * What "Kaydet" on the team and rules page answered: the stored name (a name
 * another opening already has is numbered), or why not. `problems` are the same
 * rules the form checks (the server checks them again with the organisation's
 * own users). A code is a refusal before the rules: NOT_FOUND (not the
 * caller's opening, or hidden from them), FORBIDDEN (their role cannot change
 * it), CLOSED (a closed opening is history), INVALID (a malformed request).
 */
export type SaveRulesResult =
  | { ok: true; name: string }
  | { ok: false; problems: RulesProblem[] }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "CLOSED" | "INVALID" };
