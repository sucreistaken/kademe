/**
 * Runs the AI grading job for real on up to two PENDING writing/speaking
 * answers (run `pnpm verify:exam` first to create some) and checks what came
 * back: a proposal with a level, every quoted piece of evidence found in the
 * answer, pronunciation marked not assessable, one ai_runs row per call.
 *
 * Exits 2, "not verified", when no AI provider is configured.
 * Run with: pnpm verify:grading
 */
import "dotenv/config";

async function main() {
  const { desc, eq, gt } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { getAiProvider } = await import("../src/lib/ai");
  const { runGrading } = await import("../src/lib/exam-results");
  const { normalizeForEvidence } = await import("../src/lib/exam/grading");

  const provider = getAiProvider();
  if (!provider.available) {
    console.log("NOT VERIFIED: no AI provider configured.");
    process.exit(2);
  }
  console.log(`provider ${provider.name}, model ${provider.model}`);
  const pending = await db
    .select({ g: s.responseGradings, r: s.itemResponses })
    .from(s.responseGradings)
    .innerJoin(s.itemResponses, eq(s.itemResponses.id, s.responseGradings.itemResponseId))
    .where(eq(s.responseGradings.status, "PENDING"))
    .orderBy(desc(s.responseGradings.updatedAt))
    .limit(10);
  const pick = [
    pending.find((p) => p.r.itemSnapshot.type === "WRITING_PROMPT"),
    pending.find((p) => p.r.itemSnapshot.type === "SPEAKING_PROMPT"),
  ].filter((x): x is (typeof pending)[number] => !!x);
  if (pick.length === 0) {
    console.log("NOT VERIFIED: no PENDING grading. Run pnpm verify:exam first.");
    process.exit(2);
  }
  let failed = 0;
  for (const { g, r } of pick) {
    const before = new Date();
    const t0 = Date.now();
    const outcome = await runGrading(g.id);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const [after] = await db.select().from(s.responseGradings).where(eq(s.responseGradings.id, g.id));
    const runs = await db.select().from(s.aiRuns).where(gt(s.aiRuns.at, before));
    console.log(`\n${r.itemSnapshot.type} (task ${g.taskLevel}): ${outcome.status} in ${secs} s, status ${after.status}, level ${after.aiLevel}`);
    console.log(`  ai_runs rows written: ${runs.length} (${runs.map((x) => `${x.purpose}${x.error ? " ERROR" : ""}`).join(", ")})`);
    if (outcome.status !== "PROPOSED" || !after.aiProposal) {
      failed++;
      console.log(`  FAIL: ${after.aiError ?? JSON.stringify(outcome)}`);
      continue;
    }
    const source = normalizeForEvidence(r.answer?.text ?? "");
    for (const c of after.aiProposal.criteria) {
      const bad = c.evidence.filter((e) => !source.includes(normalizeForEvidence(e)));
      console.log(`  ${c.criterion.padEnd(17)} ${c.level} ${c.assessable ? "" : "(not assessable)"} evidence ${c.evidence.length}${bad.length ? ` UNVERIFIED ${bad.length}` : ""}`);
      if (bad.length) failed++;
      if (c.criterion === "PRONUNCIATION" && c.assessable) {
        failed++;
        console.log("  FAIL: pronunciation marked assessable");
      }
    }
    console.log(`  flags: ${after.aiProposal.flags.join(", ") || "none"}`);
    console.log(`  summary: ${after.aiProposal.summary}`);
  }
  console.log(failed === 0 ? "\nAll grading checks passed." : `\n${failed} grading check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
