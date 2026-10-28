/**
 * Makes listening audio for every clip that has none yet. Idempotent and
 * content addressed: a clip whose audio already exists is reused, never paid
 * for twice. Safe to run again after a quota error.
 *
 * Covers the clips of the course test forms too (spec 2026-10-28): they are
 * LISTENING stimuli like the bank's, with a course_form, so the query
 * (clipsWithoutAudio) must never filter on it. Their seed keys read
 * "course-<course>-<form>-...".
 *
 * Run with: pnpm bank:tts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";

async function main() {
  const { db } = await import("../src/db");
  const { stimuli } = await import("../src/db/schema");
  const { clipsWithoutAudio } = await import("../src/server/bank-import");
  const { synthesize, ttsAvailable } = await import("../src/lib/tts");
  const { recordAiRun } = await import("../src/lib/ai-runs");
  if (!ttsAvailable()) {
    console.log("NOT VERIFIED: GOOGLE_AI_API_KEY is not set, no audio was made.");
    process.exit(2);
  }
  const missing = await clipsWithoutAudio();
  const inCourseForms = missing.filter((s) => s.courseForm).length;
  console.log(`${missing.length} clip(s) without audio${inCourseForms ? ` (${inCourseForms} in course test forms)` : ""}.`);
  let made = 0;
  let failed = 0;
  for (const s of missing) {
    try {
      const audio = await synthesize(s.body, s.speakers ?? []);
      await db
        .update(stimuli)
        .set({ audioKey: audio.key, audioMime: audio.mime, audioDurationMs: audio.durationMs })
        .where(eq(stimuli.id, s.id));
      if (!audio.cached)
        await recordAiRun({ orgId: s.orgId, purpose: "TTS", model: audio.model, inputRef: `stimulus:${s.id}`, outputRef: audio.key });
      made++;
      console.log(`  ok   ${s.seedKey ?? s.id} ${audio.cached ? "(reused)" : `(${audio.model}, ${Math.round((audio.durationMs ?? 0) / 1000)} s)`}`);
    } catch (error) {
      failed++;
      const reason = error instanceof Error ? error.message : String(error);
      await recordAiRun({ orgId: s.orgId, purpose: "TTS", model: "gemini-tts", inputRef: `stimulus:${s.id}`, error: reason });
      console.log(`  FAIL ${s.seedKey ?? s.id}: ${reason.slice(0, 160)}`);
    }
  }
  console.log(`\nmade or reused ${made}, failed ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
