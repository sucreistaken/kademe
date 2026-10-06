import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, stimuli } from "@/db/schema";
import { SEED_BANK } from "@/db/seed-bank";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import type { SeedItem, SeedStimulus } from "@/db/seed-bank/types";
import { thetaForLevel } from "@/lib/exam/cefr";
import { synthesize, ttsAvailable } from "@/lib/tts";
import { planTopUp, seedOrderInStimulus } from "./bank-topup";

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
    const [row] = await db.insert(stimuli).values(stimulusRow(orgId, s)).returning({ id: stimuli.id });
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
  const order = seedOrderInStimulus(SEED_BANK);
  const rows = SEED_BANK.items.map((item) =>
    itemRow(orgId, item, seedItemKey(item), item.stimulusKey ? byKey.get(item.stimulusKey) ?? null : null, order.get(item) ?? 0),
  );
  for (let i = 0; i < rows.length; i += 100) await db.insert(items).values(rows.slice(i, i + 100));
  return { stimuli: SEED_BANK.stimuli.length, items: rows.length, audioMade, audioReused, audioFailed };
}

/**
 * Adds the starter texts and items an organisation does not have yet, for
 * orgs seeded before the bank grew. Idempotent: a second run inserts nothing.
 * Old seed rows without a seed key get theirs backfilled first, so they are
 * not added twice. New listening clips are stored without audio; `pnpm
 * bank:tts` makes it. One transaction per organisation.
 */
type Executor = Pick<typeof db, "select">;

async function loadTopUpState(tx: Executor, orgId: string) {
  const haveStimuli = await tx
    .select({ id: stimuli.id, seedKey: stimuli.seedKey })
    .from(stimuli)
    .where(eq(stimuli.orgId, orgId));
  const haveItems = await tx
    .select({
      id: items.id,
      seedKey: items.seedKey,
      origin: items.origin,
      section: items.section,
      level: items.level,
      type: items.type,
      prompt: items.prompt,
      content: items.content,
      stimulusSeedKey: stimuli.seedKey,
    })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(eq(items.orgId, orgId));
  return { haveStimuli, plan: planTopUp(SEED_BANK, { stimuli: haveStimuli, items: haveItems }) };
}

/** Read-only: what a top-up would do for one organisation, for the production summary. */
export async function previewTopUp(orgId: string) {
  const { plan } = await loadTopUpState(db, orgId);
  return { stimuliToInsert: plan.stimuli.length, itemsToInsert: plan.items.length, keysToBackfill: plan.backfill.length };
}

export async function topUpSeedBank(orgId: string) {
  return db.transaction(async (tx) => {
    const { haveStimuli, plan } = await loadTopUpState(tx, orgId);

    for (const b of plan.backfill) {
      await tx.update(items).set({ seedKey: b.seedKey }).where(and(eq(items.id, b.id), eq(items.orgId, orgId)));
    }
    const byKey = new Map(haveStimuli.filter((s) => s.seedKey).map((s) => [s.seedKey!, s.id]));
    for (const s of plan.stimuli) {
      const [row] = await tx.insert(stimuli).values(stimulusRow(orgId, s)).returning({ id: stimuli.id });
      byKey.set(s.key, row.id);
    }
    const order = seedOrderInStimulus(SEED_BANK);
    const rows = plan.items.map(({ item, seedKey }) => {
      const stimulusId = item.stimulusKey ? byKey.get(item.stimulusKey) : null;
      if (stimulusId === undefined) throw new Error(`stimulus ${item.stimulusKey} is missing for org ${orgId}`);
      return itemRow(orgId, item, seedKey, stimulusId, order.get(item) ?? 0);
    });
    for (let i = 0; i < rows.length; i += 100) await tx.insert(items).values(rows.slice(i, i + 100));
    return {
      stimuliAdded: plan.stimuli.length,
      itemsAdded: rows.length,
      keysBackfilled: plan.backfill.length,
      listeningWithoutAudio: plan.stimuli.filter((s) => s.section === "LISTENING").map((s) => s.key),
    };
  });
}

/** Seed item counts of an organisation, for the top-up script's before/after line. */
export async function seedCounts(orgId: string) {
  const [[i], [s]] = await Promise.all([
    db.select({ n: count() }).from(items).where(and(eq(items.orgId, orgId), eq(items.origin, "SEED"))),
    db.select({ n: count() }).from(stimuli).where(and(eq(stimuli.orgId, orgId), eq(stimuli.origin, "SEED"))),
  ]);
  return { items: i.n, stimuli: s.n };
}

function stimulusRow(orgId: string, s: SeedStimulus) {
  return {
    orgId,
    section: s.section,
    level: s.level,
    title: s.title,
    body: s.body,
    topic: s.topic,
    speakers: s.speakers ?? null,
    origin: "SEED" as const,
    seedKey: s.key,
  };
}

function itemRow(orgId: string, item: SeedItem, seedKey: string, stimulusId: string | null, orderInStimulus: number) {
  return {
    orgId,
    section: item.section,
    level: item.level,
    difficulty: thetaForLevel(item.level, item.within ?? "MID"),
    type: item.type,
    skillTag: item.skillTag,
    stimulusId,
    orderInStimulus,
    prompt: item.prompt,
    content: item.content,
    answerKey: item.key,
    rubric: item.rubric ?? null,
    explanation: item.explanation ?? null,
    status: "APPROVED" as const,
    origin: "SEED" as const,
    seedKey,
  };
}
