import type { CheckedActivity, Finding } from "@/solutions/hiring/ai/question-check";

/**
 * What "AI ile kontrol et" answered. Each refusal code has its own sentence
 * on screen (components/hiring/builder/check-copy.ts), never the raw code.
 *
 * NOT_FOUND, CLOSED, FORBIDDEN: the opening may not be changed by this viewer.
 * INVALID: a malformed request. NO_DRAFT: only a published version exists (or
 * it was published meanwhile); the check reads drafts only. RATE_LIMITED: too
 * many AI requests (ai-limit). UNCONFIGURED: no AI connected.
 * PROVIDER_FAILED: the model could not be reached. SCHEMA_FAILED: its answer
 * was unusable after one repair. In every refusal the word rule still stands.
 *
 * `checked` is the saved text the AI saw, so the bar can tell when a question
 * changed after the check; `at` is when it ran.
 */
export type CheckCode =
  | "NOT_FOUND"
  | "CLOSED"
  | "FORBIDDEN"
  | "INVALID"
  | "NO_DRAFT"
  | "RATE_LIMITED"
  | "UNCONFIGURED"
  | "PROVIDER_FAILED"
  | "SCHEMA_FAILED";

export type CheckResult = { ok: true; findings: Finding[]; checked: CheckedActivity[]; at: string } | { ok: false; code: CheckCode };
