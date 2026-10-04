/**
 * The speaking chain end to end with real services: a spoken German answer
 * (made with Gemini TTS so the check is repeatable) is stored as a recording,
 * transcribed by ElevenLabs Scribe, then graded by the AI. Uses the local
 * database; run `pnpm verify:exam` first so a speaking task exists.
 *
 * Run with: npx tsx scripts/verify-speaking-chain.ts
 */
import "dotenv/config";

const ANSWER = [
  "Sprecher: Also, mein normaler Tag beginnt um sieben Uhr.",
  "Sprecher: Ich stehe auf, dusche und frühstücke mit meiner Familie.",
  "Sprecher: Danach fahre ich mit dem Bus zur Arbeit, weil ich kein Auto habe.",
  "Sprecher: Am Nachmittag habe ich oft Besprechungen, und am Abend lerne ich Deutsch, weil ich später in Deutschland studieren möchte.",
].join("\n");

async function main() {
  const { and, desc, eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { synthesize } = await import("../src/lib/tts");
  const { getStorage } = await import("../src/lib/storage");
  const { runTranscription } = await import("../src/lib/transcribe-job");
  const { runGrading } = await import("../src/lib/exam-results");

  const [row] = await db
    .select({ r: s.itemResponses, run: s.sectionRuns, a: s.assessments })
    .from(s.itemResponses)
    .innerJoin(s.sectionRuns, eq(s.sectionRuns.id, s.itemResponses.sectionRunId))
    .innerJoin(s.attempts, eq(s.attempts.id, s.sectionRuns.attemptId))
    .innerJoin(s.assessments, eq(s.assessments.id, s.attempts.assessmentId))
    .where(and(eq(s.sectionRuns.section, "SPEAKING")))
    .orderBy(desc(s.itemResponses.servedAt))
    .limit(1);
  if (!row) throw new Error("no speaking task: run pnpm verify:exam first");
  console.log(`task (${row.r.itemSnapshot.level}): ${row.r.itemSnapshot.prompt.slice(0, 90)}`);

  const audio = await synthesize(ANSWER, [{ label: "Sprecher", voice: "B" }]);
  const { stream } = await getStorage().openStream(audio.key);
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const bytes = new Uint8Array(Buffer.concat(chunks));
  const [asset] = await db
    .insert(s.mediaAssets)
    .values({ orgId: row.a.orgId, attemptId: row.run.attemptId, sectionRunId: row.run.id, itemResponseId: row.r.id, storageKey: "pending", mime: audio.mime, status: "READY", bytes: bytes.byteLength, durationMs: audio.durationMs ?? 30000, parts: [] })
    .returning();
  const key = `media/${row.a.orgId}/${row.a.id}/${row.run.id}/${asset.id}.${audio.mime === "audio/mpeg" ? "mp3" : "wav"}`;
  await getStorage().putObject(key, audio.mime, bytes);
  await db.update(s.mediaAssets).set({ storageKey: key }).where(eq(s.mediaAssets.id, asset.id));
  await db
    .update(s.itemResponses)
    .set({ answer: { mediaAssetId: asset.id }, answeredAt: row.r.answeredAt ?? new Date() })
    .where(eq(s.itemResponses.id, row.r.id));
  await db
    .insert(s.responseGradings)
    .values({ itemResponseId: row.r.id, taskLevel: row.r.itemSnapshot.level, status: "PENDING" })
    .onConflictDoUpdate({ target: s.responseGradings.itemResponseId, set: { status: "PENDING", aiProposal: null, aiLevel: null, finalLevel: null, aiError: null } });

  const t0 = Date.now();
  const tr = await runTranscription(asset.id);
  const [transcript] = await db.select().from(s.transcripts).where(eq(s.transcripts.mediaAssetId, asset.id));
  console.log(`transcription: ${tr.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s, language ${transcript?.language}, ${transcript?.words?.length ?? 0} words`);
  console.log(`  "${transcript?.text.slice(0, 160)}"`);
  const [g] = await db.select().from(s.responseGradings).where(eq(s.responseGradings.itemResponseId, row.r.id));
  const t1 = Date.now();
  const out = await runGrading(g.id);
  const [after] = await db.select().from(s.responseGradings).where(eq(s.responseGradings.id, g.id));
  console.log(`grading: ${out.status} in ${((Date.now() - t1) / 1000).toFixed(1)} s, level ${after.aiLevel}`);
  for (const c of after.aiProposal?.criteria ?? []) console.log(`  ${c.criterion.padEnd(17)} ${c.assessable ? c.level : "-"} ${c.evidence.length} quote(s)`);
  console.log(`  flags: ${after.aiProposal?.flags.join(", ") || "none"}`);
  const ok = tr.status === "DONE" && out.status === "PROPOSED" && (transcript?.words?.length ?? 0) > 20;
  console.log(ok ? "\nSpeaking chain check passed." : "\nSpeaking chain check FAILED.");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
