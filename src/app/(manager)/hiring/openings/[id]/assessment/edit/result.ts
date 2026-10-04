/**
 * Why a builder write was refused. The draft's own refusals (HiringConflict),
 * a row that is gone (NOT_FOUND), a value outside the accepted range (INVALID,
 * with the field paths), a role or opening that may not be edited (FORBIDDEN,
 * CLOSED), and an undo whose 8 seconds are long over or whose payload was
 * changed (UNDO_EXPIRED). Each code has its own sentence on screen.
 */
export type ActionCode =
  | "NO_DRAFT"
  | "CLOSED"
  | "STAGE_FULL"
  | "COMPETENCY"
  | "CHOICE_COMPETENCY"
  | "TOO_MANY_COMPETENCIES"
  | "NOT_FOUND"
  | "INVALID"
  | "FORBIDDEN"
  | "UNDO_EXPIRED";

/** What every builder action answers; `at` feeds "Kaydedildi 14:02". */
export type ActionResult<T> = { ok: true; value: T; at: string } | { ok: false; code: ActionCode; fields?: string[] };

/** A deleted stage or question, held by the client only to hand it back on "Geri al". */
export type UndoTicket = { payload: string; index: number; token: string };
