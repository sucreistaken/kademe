import { databaseTarget } from "./bank-topup";

/**
 * The guard of scripts/recompute-verification.ts. The script rewrites the
 * stored `computed` result of every level verification that is not final, so it
 * never runs without `--confirm-db=<host:port/database>` equal to the target
 * parsed from DATABASE_URL (the same pattern as the bank top-up in production),
 * dry run included: a preview of the wrong database is a mistake too. Returns
 * the reason to refuse, or null.
 */
export function recomputeRefusal(url: string | undefined, confirmDb: string | undefined): string | null {
  const target = databaseTarget(url);
  if (!target) return "DATABASE_URL is missing or not a valid url.";
  if (!confirmDb) return `needs --confirm-db=${target} (the database this run would read and write).`;
  if (confirmDb !== target) return `--confirm-db=${confirmDb} does not match the database in DATABASE_URL (${target}).`;
  return null;
}

/** One report line: the outcome before and after, and the reasons it now has. */
export function recomputeLine(input: { attemptId: string; claimed: string | null; before: string | null; after: string | null; reasons: readonly string[] }): string {
  const reasons = input.reasons.length ? ` (${input.reasons.join(", ")})` : "";
  return `${input.attemptId} claim ${input.claimed ?? "-"}: ${input.before ?? "none"} -> ${input.after ?? "none"}${reasons}`;
}
