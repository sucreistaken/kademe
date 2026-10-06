import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { stimuli } from "@/db/schema";
import { aiLimitReached } from "@/lib/ai-limit";
import { recordAiRun } from "@/lib/ai-runs";
import { synthesize } from "@/lib/tts";

/**
 * The listening audio of one of the organisation's stimuli, made now when it
 * is missing: the same TTS call and ai_runs rows as the bank's makeAudio
 * (src/app/(manager)/exam/bank/actions.ts), without its redirects. A listening
 * item is only ever approved with audio (setItemStatus refuses it otherwise).
 */
export async function ensureStimulusAudio(orgId: string, userId: string, stimulusId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [s] = await db
    .select({ id: stimuli.id, body: stimuli.body, speakers: stimuli.speakers, audioKey: stimuli.audioKey })
    .from(stimuli)
    .where(and(eq(stimuli.id, stimulusId), eq(stimuli.orgId, orgId)))
    .limit(1);
  if (!s) return { ok: false, reason: "not found" };
  if (s.audioKey) return { ok: true };
  if (await aiLimitReached(orgId, userId, "TTS")) return { ok: false, reason: "rate limited" };
  try {
    const audio = await synthesize(s.body, s.speakers ?? []);
    await db
      .update(stimuli)
      .set({ audioKey: audio.key, audioMime: audio.mime, audioDurationMs: audio.durationMs })
      .where(and(eq(stimuli.id, s.id), eq(stimuli.orgId, orgId)));
    if (!audio.cached) {
      await recordAiRun({ orgId, purpose: "TTS", model: audio.model, requestedBy: userId, inputRef: `stimulus:${s.id}`, outputRef: audio.key });
    }
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 120) : "failed";
    await recordAiRun({ orgId, purpose: "TTS", model: "gemini-tts", requestedBy: userId, inputRef: `stimulus:${s.id}`, error: reason });
    return { ok: false, reason };
  }
}
