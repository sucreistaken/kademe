import { eq } from "drizzle-orm";
import { db } from "@/db";
import { items, stimuli } from "@/db/schema";
import { SEED_BANK } from "@/db/seed-bank";
import { thetaForLevel } from "@/lib/exam/cefr";
import { synthesize, ttsAvailable } from "@/lib/tts";

/**
 * Loads the hand-written starter bank into an organisation. Rows are APPROVED
 * with origin SEED; the bank screen labels them as starter content the school
 * has not reviewed.
 *
 * Listening audio is made (or reused, it is content addressed) when a TTS key
 * is present. Without one the clips are stored without audio and the listening
 * section reports a coverage gap instead of playing silence.
 */
export async function importSeedBank(orgId: string, options: { audio?: boolean; log?: (m: string) => void } = {}) {
  const log = options.log ?? (() => {});
  const byKey = new Map<string, string>();
  let audioMade = 0;
  let audioReused = 0;
  let audioFailed = 0;
  for (const s of SEED_BANK.stimuli) {
    const [row] = await db
      .insert(stimuli)
      .values({
        orgId,
        section: s.section,
        level: s.level,
        title: s.title,
        body: s.body,
        topic: s.topic,
        speakers: s.speakers ?? null,
        origin: "SEED",
        seedKey: s.key,
      })
      .returning({ id: stimuli.id });
    byKey.set(s.key, row.id);
    if (s.section === "LISTENING" && options.audio !== false && ttsAvailable()) {
      try {
        const audio = await synthesize(s.body, s.speakers ?? []);
        if (audio.cached) audioReused++;
        else audioMade++;
        await db
          .update(stimuli)
          .set({ audioKey: audio.key, audioMime: audio.mime, audioDurationMs: audio.durationMs })
          .where(eq(stimuli.id, row.id));
        log(`  audio ${audio.cached ? "reused" : "made  "} ${s.key}`);
      } catch (error) {
        audioFailed++;
        log(`  audio FAILED ${s.key}: ${error instanceof Error ? error.message.slice(0, 160) : error}`);
      }
    }
  }
  const order = new Map<string, number>();
  const rows = SEED_BANK.items.map((item) => {
    const stimulusId = item.stimulusKey ? byKey.get(item.stimulusKey) ?? null : null;
    const n = item.stimulusKey ? (order.get(item.stimulusKey) ?? 0) + 1 : 0;
    if (item.stimulusKey) order.set(item.stimulusKey, n);
    return {
      orgId,
      section: item.section,
      level: item.level,
      difficulty: thetaForLevel(item.level, item.within ?? "MID"),
      type: item.type,
      skillTag: item.skillTag,
      stimulusId,
      orderInStimulus: n,
      prompt: item.prompt,
      content: item.content,
      answerKey: item.key,
      rubric: item.rubric ?? null,
      explanation: item.explanation ?? null,
      status: "APPROVED" as const,
      origin: "SEED" as const,
    };
  });
  for (let i = 0; i < rows.length; i += 100) await db.insert(items).values(rows.slice(i, i + 100));
  return { stimuli: SEED_BANK.stimuli.length, items: rows.length, audioMade, audioReused, audioFailed };
}
