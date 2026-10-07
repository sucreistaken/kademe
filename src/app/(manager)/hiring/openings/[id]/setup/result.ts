/**
 * What the wizard's step 2 server actions answer (HIRING-UX 5.20). Each code
 * has its own sentence on screen, never the raw code.
 *
 * NOT_FOUND, CLOSED, FORBIDDEN: the opening (or the question) may not be
 * changed by this viewer, or is gone. INVALID: a malformed request (an empty
 * or over-long instruction included). NO_DRAFT: only a published version
 * exists; "Soruları düzenle" opens a draft first. JOB_AD_TOO_SHORT /
 * JOB_AD_TOO_LONG: the position's job ad cannot feed a draft. RATE_LIMITED:
 * too many AI requests (ai-limit). UNCONFIGURED: no AI connected.
 * PROVIDER_FAILED: the model could not be reached. SCHEMA_FAILED: its answer
 * was unusable after one repair. COMPETENCY, CHOICE_COMPETENCY,
 * TOO_MANY_COMPETENCIES, STAGE_FULL: the draft refused the write.
 * CHOICE_QUESTION: "AI ile düzelt" on a choice question (the AI never writes
 * one). UNDO_EXPIRED: the undo token is not this draft's, was changed, or its
 * ten minutes are over.
 */
export type SetupCode =
  | "NOT_FOUND"
  | "CLOSED"
  | "FORBIDDEN"
  | "INVALID"
  | "NO_DRAFT"
  | "JOB_AD_TOO_SHORT"
  | "JOB_AD_TOO_LONG"
  | "RATE_LIMITED"
  | "UNCONFIGURED"
  | "PROVIDER_FAILED"
  | "SCHEMA_FAILED"
  | "COMPETENCY"
  | "CHOICE_COMPETENCY"
  | "TOO_MANY_COMPETENCIES"
  | "STAGE_FULL"
  | "CHOICE_QUESTION"
  | "UNDO_EXPIRED";

export type SetupRefusal = { ok: false; code: SetupCode };

/** applied: false when the draft already had stages (nothing was generated or written). */
export type ApplyDraftResult =
  | { ok: true; applied: false }
  | { ok: true; applied: true; stages: number; budgetWarning: string | null }
  | SetupRefusal;

/** undoToken goes back to undoReviseAction within ten minutes. After "all", every stage and question id is new. */
export type ReviseResult =
  | { ok: true; target: "all"; stages: number; undoToken: string; budgetWarning: string | null }
  | { ok: true; target: "activity"; activityId: string; undoToken: string }
  | SetupRefusal;

export type UndoReviseResult = { ok: true } | SetupRefusal;
