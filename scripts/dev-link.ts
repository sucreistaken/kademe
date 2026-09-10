/**
 * Mints a fresh candidate link for development and prints the URL.
 *
 * The seed prints its raw tokens once and never again, which is the correct
 * behaviour but unhelpful an hour later. This adds a link rather than replacing
 * one, so nothing already in the database is disturbed.
 *
 * Run with: npx tsx scripts/dev-link.ts [candidate email]
 */

import "dotenv/config";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../src/db";
import { assessmentLinks, assessments, candidates } from "../src/db/schema";
import { mintToken } from "../src/lib/auth";

async function main() {
  const wanted = process.argv[2];

  const rows = await db
    .select({
      assessmentId: assessments.id,
      name: candidates.fullName,
      email: candidates.email,
    })
    .from(assessments)
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .orderBy(asc(candidates.fullName));

  const targets = wanted
    ? rows.filter((r) => r.email === wanted || r.name === wanted)
    : rows;

  if (targets.length === 0) {
    console.log("No candidate matched. Known candidates:");
    for (const row of rows) console.log(`  ${row.name} <${row.email}>`);
    process.exit(1);
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  console.log("\n  Fresh candidate links (raw tokens are shown only here):\n");

  for (const target of targets) {
    // An assessment may only hold one usable link at a time
    // (drizzle/sql/0002_single_active_link.sql), so the current one is retired
    // first, exactly the way re-issuing a link from the manager side would.
    await db
      .update(assessmentLinks)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(assessmentLinks.assessmentId, target.assessmentId),
          ne(assessmentLinks.status, "EXPIRED"),
        ),
      );

    const token = mintToken();
    await db.insert(assessmentLinks).values({
      assessmentId: target.assessmentId,
      tokenHash: token.hash,
      status: "NOT_STARTED",
      expiresAt,
      attemptsAllowed: 1,
    });
    console.log(`  ${target.name?.padEnd(14)} http://localhost:3100/a/${token.raw}`);
  }

  console.log("");
  process.exit(0);
}

void main();
