/**
 * What the preview's stamp answered. The preview shows nothing for it (the
 * stamp is a side effect of opening the page); the codes keep a refusal from
 * ever reaching the browser as a raw error.
 *
 * NOT_FOUND, CLOSED, FORBIDDEN: this viewer may not change the opening (a
 * reviewer's visit stamps nothing). INVALID: a malformed request. NO_DRAFT:
 * the draft was published meanwhile (the database's freeze refusal).
 */
export type PreviewStampResult = { ok: true; stamped: boolean } | { ok: false; code: "NOT_FOUND" | "CLOSED" | "FORBIDDEN" | "INVALID" | "NO_DRAFT" };
