/**
 * Recomputes the stored result of every LEVEL_VERIFICATION attempt that is not
 * final, with the verification rules of 2026-11-24 (docs/EXAM-ENGINE.md, "Seviye
 * doğrulama kararı"), and prints each attempt's outcome before and after.
 * FINAL results are never touched (finalOutcome and finalSkills stay as frozen),
 * and nothing is finalized by this script.
 *
 *   pnpm exam:recompute-verification --confirm-db=127.0.0.1:5434/kademe_verif --dry-run
 *   pnpm exam:recompute-verification --confirm-db=127.0.0.1:5434/kademe_verif
 *
 * `--confirm-db=<host:port/database>` is required, dry run included, and must
 * equal the target parsed from DATABASE_URL. `--dry-run` computes and prints
 * without writing.
 */
import "dotenv/config";
import { recomputeLine, recomputeRefusal } from "../src/server/recompute-verification";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const confirmDb = args.find((a) => a.startsWith("--confirm-db="))?.slice("--confirm-db=".length);
  const refusal = recomputeRefusal(process.env.DATABASE_URL, confirmDb);
  if (refusal) {
    console.error(`Refusing: ${refusal}`);
    process.exit(2);
  }

  const { and, eq, ne } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { attempts, examAssessments, examResults } = await import("../src/db/schema");
  const { recomputeResult } = await import("../src/lib/exam-results");

  const rows = await db
    .select({ attemptId: attempts.id, claimed: examAssessments.claimedLevel, before: examResults.computed })
    .from(examResults)
    .innerJoin(attempts, eq(attempts.id, examResults.attemptId))
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(and(eq(examAssessments.mode, "LEVEL_VERIFICATION"), ne(examResults.status, "FINAL")));

  console.log(`${dryRun ? "Dry run: " : ""}${rows.length} level verification(s) not final.`);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const after = await recomputeResult(r.attemptId, { dryRun, finalize: false });
    const outcome = after?.computed.verification?.outcome ?? null;
    console.log(recomputeLine({ attemptId: r.attemptId, claimed: r.claimed, before: r.before?.verification?.outcome ?? null, after: outcome, reasons: after?.computed.verification?.reasons ?? [] }));
    counts.set(outcome ?? "none", (counts.get(outcome ?? "none") ?? 0) + 1);
  }
  console.log(`${dryRun ? "Would be" : "Now"}: ${[...counts].map(([k, n]) => `${k} ${n}`).join(", ") || "nothing"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
