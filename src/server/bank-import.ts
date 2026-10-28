import { and, count, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, items, stimuli } from "@/db/schema";
import { readFile } from "node:fs/promises";
import { SEED_BANK } from "@/db/seed-bank";
import { courseSeed, type CourseSeedItem } from "@/db/seed-bank/course-seed";
import { COURSE_FORMS_SEED } from "@/db/seed-bank/course-tests";
import type { SeedCourseForm } from "@/db/seed-bank/course-tests/types";
import { seedImageFilesUsedBy } from "@/db/seed-bank/image";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import type { SeedItem, SeedStimulus } from "@/db/seed-bank/types";
import type { ItemContent } from "@/lib/exam/types";
import { thetaForLevel } from "@/lib/exam/cefr";
import { getStorage } from "@/lib/storage";
import { synthesize, ttsAvailable } from "@/lib/tts";
import { planCourseTopUp, planTopUp, retireCounts, seedOrderInStimulus, syncCounts, type SyncPlan } from "./bank-topup";

/** True when the object is already in storage (the same probe `tts.ts` uses for audio). */
async function stored(key: string): Promise<boolean> {
  try {
    const s = await getStorage().openStream(key, { start: 0, end: 0 });
    await s.stream?.cancel?.();
    return true;
  } catch {
    return false;
  }
}

export type ImageUploadCounts = { uploaded: number; present: number };

/**
 * Uploads the catalog pictures the given seed items use and storage does not
 * hold yet. Content addressed, so a second run uploads nothing. Goes through
 * the storage abstraction only (VM disk or R2). Runs before any item row is
 * written, so an item never points at a picture that is not there.
 */
export async function ensureSeedImages(contents: ItemContent[], log: (m: string) => void = () => {}): Promise<ImageUploadCounts> {
  const files = seedImageFilesUsedBy(contents);
  let uploaded = 0;
  let present = 0;
  for (const f of files) {
    if (await stored(f.storageKey)) {
      present++;
      continue;
    }
    await getStorage().putObject(f.storageKey, f.mime, new Uint8Array(await readFile(f.path)));
    uploaded++;
  }
  if (files.length) log(`  images: ${uploaded} uploaded, ${present} already in storage`);
  return { uploaded, present };
}

/**
 * Loads the hand-written starter bank into an organisation, and the course
 * test forms next to it (spec 2026-10-28: their rows carry course_form and
 * never mix with the bank). Rows are APPROVED with origin SEED; the bank
 * screen labels them as starter content the school has not reviewed.
 *
 * Listening audio is made (or reused, it is content addressed) when a TTS key
 * is present. Without one the clips are stored without audio and the listening
 * section reports a coverage gap instead of playing silence.
 */
export async function importSeedBank(orgId: string, options: { audio?: boolean; log?: (m: string) => void; courseForms?: readonly SeedCourseForm[] } = {}) {
  const log = options.log ?? (() => {});
  const course = courseSeed(options.courseForms ?? COURSE_FORMS_SEED);
  const byKey = new Map<string, string>();
  const images = await ensureSeedImages([...SEED_BANK.items, ...course.items.map((c) => c.item)].map((i) => i.content), log);
  let audioMade = 0;
  let audioReused = 0;
  let audioFailed = 0;
  const addText = async (s: SeedStimulus, seedKey: string, courseForm: string | null) => {
    const [row] = await db.insert(stimuli).values(stimulusRow(orgId, s, seedKey, courseForm)).returning({ id: stimuli.id });
    byKey.set(seedKey, row.id);
    if (s.section === "LISTENING" && options.audio !== false && ttsAvailable()) {
      try {
        const audio = await synthesize(s.body, s.speakers ?? []);
        if (audio.cached) audioReused++;
        else audioMade++;
        await db
          .update(stimuli)
          .set({ audioKey: audio.key, audioMime: audio.mime, audioDurationMs: audio.durationMs })
          .where(eq(stimuli.id, row.id));
        log(`  audio ${audio.cached ? "reused" : "made  "} ${seedKey}`);
      } catch (error) {
        audioFailed++;
        log(`  audio FAILED ${seedKey}: ${error instanceof Error ? error.message.slice(0, 160) : error}`);
      }
    }
  };
  for (const s of SEED_BANK.stimuli) await addText(s, s.key, null);
  const order = seedOrderInStimulus(SEED_BANK);
  const rows = SEED_BANK.items.map((item) =>
    itemRow(orgId, item, seedItemKey(item), item.stimulusKey ? byKey.get(item.stimulusKey) ?? null : null, order.get(item) ?? 0),
  );
  for (let i = 0; i < rows.length; i += 100) await db.insert(items).values(rows.slice(i, i + 100));
  for (const c of course.stimuli) await addText(c.stimulus, c.seedKey, c.courseForm);
  const courseRows = course.items.map((c) => courseItemRow(orgId, c, c.stimulusSeedKey ? byKey.get(c.stimulusSeedKey) ?? null : null));
  for (let i = 0; i < courseRows.length; i += 100) await db.insert(items).values(courseRows.slice(i, i + 100));
  return {
    stimuli: SEED_BANK.stimuli.length,
    items: rows.length,
    courseStimuli: course.stimuli.length,
    courseItems: courseRows.length,
    audioMade,
    audioReused,
    audioFailed,
    imagesUploaded: images.uploaded,
    imagesPresent: images.present,
  };
}

/**
 * Adds the starter texts and items an organisation does not have yet, for
 * orgs seeded before the bank grew. Idempotent: a second run inserts nothing.
 * Old seed rows without a seed key get theirs backfilled first, so they are
 * not added twice. New listening clips are stored without audio; `pnpm
 * bank:tts` makes it. One transaction per organisation.
 *
 * With `retireStale`, starter items the current bank no longer has are set
 * RETIRED in the same transaction, after the adding (see planTopUp). Rows are
 * never deleted. Stimuli have no status column, so the texts and clips of
 * retired items stay as they are; nothing serves a stimulus without an
 * APPROVED item.
 *
 * The course test forms (spec 2026-10-28) are topped up in the same
 * transaction by their own plan (planCourseTopUp): their rows carry
 * course_form and course_order, and the bank's retire and sync never see them
 * (nor the course plan the bank's rows).
 */
type Executor = Pick<typeof db, "select">;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type TopUpOptions = { retireStale?: boolean; syncSeed?: boolean; courseForms?: readonly SeedCourseForm[] };

async function loadTopUpState(tx: Executor, orgId: string, options: TopUpOptions) {
  const haveStimuli = await tx
    .select({
      id: stimuli.id,
      seedKey: stimuli.seedKey,
      origin: stimuli.origin,
      section: stimuli.section,
      level: stimuli.level,
      title: stimuli.title,
      body: stimuli.body,
      speakers: stimuli.speakers,
      maxPlays: stimuli.maxPlays,
      courseForm: stimuli.courseForm,
    })
    .from(stimuli)
    .where(eq(stimuli.orgId, orgId));
  const haveItems = await tx
    .select({
      id: items.id,
      seedKey: items.seedKey,
      origin: items.origin,
      status: items.status,
      section: items.section,
      level: items.level,
      type: items.type,
      prompt: items.prompt,
      content: items.content,
      stimulusId: items.stimulusId,
      stimulusSeedKey: stimuli.seedKey,
      answerKey: items.answerKey,
      difficulty: items.difficulty,
      explanation: items.explanation,
      rubric: items.rubric,
      courseForm: items.courseForm,
      courseOrder: items.courseOrder,
      orderInStimulus: items.orderInStimulus,
    })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(eq(items.orgId, orgId));
  // A starter item the school edited in the bank is the school's now: --retire-stale keeps it.
  const editedRows = await tx
    .select({ id: auditLogs.subjectId })
    .from(auditLogs)
    .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.action, "bank.edit"), eq(auditLogs.subjectType, "item")));
  const edited = new Set(editedRows.map((r: { id: string | null }) => r.id));
  const withEdits = haveItems.map((i) => ({ ...i, edited: edited.has(i.id) }));
  // --sync-seed leaves a reading text alone when an item that reads it was edited.
  const editedStimuli = new Set(withEdits.filter((i) => i.edited && i.stimulusId).map((i) => i.stimulusId));
  const stimuliWithEdits = haveStimuli.map((s) => ({ ...s, itemEdited: editedStimuli.has(s.id) }));
  const existing = { stimuli: stimuliWithEdits, items: withEdits };
  const course = courseSeed(options.courseForms ?? COURSE_FORMS_SEED);
  const planOptions = { retireStale: options.retireStale, syncSeed: options.syncSeed };
  return {
    haveStimuli,
    plan: planTopUp(SEED_BANK, existing, planOptions),
    course,
    coursePlan: planCourseTopUp(course, existing, planOptions),
    courseRowsInOrg: haveItems.filter((i) => !!i.courseForm).length,
  };
}

/** Read-only: what a top-up would do for one organisation, for the production summary. */
export async function previewTopUp(orgId: string, options: TopUpOptions = {}) {
  const { plan, course, coursePlan, courseRowsInOrg } = await loadTopUpState(db, orgId, options);
  return {
    stimuliToInsert: plan.stimuli.length,
    itemsToInsert: plan.items.length,
    keysToBackfill: plan.backfill.length,
    retire: plan.retire,
    keptEdited: plan.keptEdited,
    sync: plan.sync,
    course: {
      /** Whether the course forms are part of this run at all: the seed has some, or the org has course rows. */
      active: course.items.length > 0 || courseRowsInOrg > 0,
      stimuliToInsert: coursePlan.stimuli.length,
      itemsToInsert: coursePlan.items.length,
      retire: coursePlan.retire,
      keptEdited: coursePlan.keptEdited,
      stale: coursePlan.stale,
      sync: coursePlan.sync,
    },
  };
}

/**
 * Which rows a plan owns. The bank's rows have no course form, the course
 * forms' rows have one; the writes below repeat that next to the plan's own
 * conditions, so a plan can never write to the other kind of row.
 */
type PlanScope = { items: () => SQL; stimuli: () => SQL; retireAction: string; syncAction: string };
const BANK_SCOPE: PlanScope = {
  items: () => isNull(items.courseForm),
  stimuli: () => isNull(stimuli.courseForm),
  retireAction: "bank.retire_stale",
  syncAction: "bank.sync_seed",
};
const COURSE_SCOPE: PlanScope = {
  items: () => isNotNull(items.courseForm),
  stimuli: () => isNotNull(stimuli.courseForm),
  retireAction: "course.retire_stale",
  syncAction: "course.sync_seed",
};

/**
 * Sets the planned items RETIRED. The status and origin conditions repeat the
 * plan's, so a row a school changed between the read and this write is left alone.
 */
async function retireItems(tx: Tx, orgId: string, retire: Array<{ id: string }>, scope: PlanScope): Promise<number> {
  let retired = 0;
  const retireIds = retire.map((r) => r.id);
  for (let i = 0; i < retireIds.length; i += 500) {
    const done = await tx
      .update(items)
      .set({ status: "RETIRED", updatedAt: new Date() })
      .where(
        and(
          eq(items.orgId, orgId),
          eq(items.origin, "SEED"),
          eq(items.status, "APPROVED"),
          scope.items(),
          inArray(items.id, retireIds.slice(i, i + 500)),
        ),
      )
      .returning({ id: items.id });
    retired += done.length;
  }
  return retired;
}

/** Same guards as the retire step: starter rows only, scoped to the org. Status stays as it is. */
async function syncItems(tx: Tx, orgId: string, sync: SyncPlan, scope: PlanScope) {
  let itemsSynced = 0;
  for (const c of sync.items) {
    const done = await tx
      .update(items)
      .set({ ...c.set, updatedAt: new Date() })
      .where(and(eq(items.id, c.id), eq(items.orgId, orgId), eq(items.origin, "SEED"), scope.items()))
      .returning({ id: items.id });
    itemsSynced += done.length;
  }
  let stimuliSynced = 0;
  for (const c of sync.stimuli) {
    const done = await tx
      .update(stimuli)
      .set({ body: c.body })
      .where(and(eq(stimuli.id, c.id), eq(stimuli.orgId, orgId), eq(stimuli.origin, "SEED"), eq(stimuli.section, "READING"), scope.stimuli()))
      .returning({ id: stimuli.id });
    stimuliSynced += done.length;
  }
  let playsSynced = 0;
  for (const c of sync.plays) {
    const done = await tx
      .update(stimuli)
      .set({ maxPlays: c.maxPlays })
      .where(and(eq(stimuli.id, c.id), eq(stimuli.orgId, orgId), eq(stimuli.origin, "SEED"), eq(stimuli.section, "LISTENING"), scope.stimuli()))
      .returning({ id: stimuli.id });
    playsSynced += done.length;
  }
  return { itemsSynced, stimuliSynced, playsSynced };
}

const syncAudit = (sync: SyncPlan, done: { itemsSynced: number; stimuliSynced: number; playsSynced: number }) => ({
  items: done.itemsSynced,
  stimuli: done.stimuliSynced,
  listeningPlays: done.playsSynced,
  bySectionLevel: syncCounts(sync),
  itemsKeptEdited: sync.itemsKeptEdited,
  stimuliKeptEdited: sync.stimuliKeptEdited,
  listeningDiffs: sync.listeningDiffs.map((d) => d.key),
});

export async function topUpSeedBank(orgId: string, options: TopUpOptions = {}, log: (m: string) => void = () => {}) {
  // Pictures first and outside the transaction: storage is not transactional, and uploads are idempotent.
  const courseItems = courseSeed(options.courseForms ?? COURSE_FORMS_SEED).items.map((c) => c.item);
  const images = await ensureSeedImages([...SEED_BANK.items, ...courseItems].map((i) => i.content), log);
  return db.transaction(async (tx) => {
    const { haveStimuli, plan, coursePlan } = await loadTopUpState(tx, orgId, options);

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

    // The course forms: their own texts and items (a form's items hang off the form's own texts).
    for (const c of coursePlan.stimuli) {
      const [row] = await tx.insert(stimuli).values(stimulusRow(orgId, c.stimulus, c.seedKey, c.courseForm)).returning({ id: stimuli.id });
      byKey.set(c.seedKey, row.id);
    }
    const courseRows = coursePlan.items.map((c) => {
      const stimulusId = c.stimulusSeedKey ? byKey.get(c.stimulusSeedKey) : null;
      if (stimulusId === undefined) throw new Error(`stimulus ${c.stimulusSeedKey} is missing for org ${orgId}`);
      return courseItemRow(orgId, c, stimulusId);
    });
    for (let i = 0; i < courseRows.length; i += 100) await tx.insert(items).values(courseRows.slice(i, i + 100));

    const retired = await retireItems(tx, orgId, plan.retire, BANK_SCOPE);
    if (retired > 0) {
      await tx.insert(auditLogs).values({
        orgId,
        actorId: null,
        action: BANK_SCOPE.retireAction,
        subjectType: "item",
        meta: { retired, bySectionLevel: retireCounts(plan.retire) },
      });
    }
    const courseRetired = await retireItems(tx, orgId, coursePlan.retire, COURSE_SCOPE);
    if (courseRetired > 0) {
      const byForm: Record<string, number> = {};
      for (const r of coursePlan.retire) byForm[r.courseForm] = (byForm[r.courseForm] ?? 0) + 1;
      await tx.insert(auditLogs).values({
        orgId,
        actorId: null,
        action: COURSE_SCOPE.retireAction,
        subjectType: "item",
        meta: { retired: courseRetired, byForm, bySectionLevel: retireCounts(coursePlan.retire) },
      });
    }

    const synced = await syncItems(tx, orgId, plan.sync, BANK_SCOPE);
    if (synced.itemsSynced > 0 || synced.stimuliSynced > 0 || synced.playsSynced > 0) {
      await tx.insert(auditLogs).values({ orgId, actorId: null, action: BANK_SCOPE.syncAction, subjectType: "item", meta: syncAudit(plan.sync, synced) });
    }
    const courseSynced = await syncItems(tx, orgId, coursePlan.sync, COURSE_SCOPE);
    if (courseSynced.itemsSynced > 0 || courseSynced.stimuliSynced > 0 || courseSynced.playsSynced > 0) {
      await tx.insert(auditLogs).values({ orgId, actorId: null, action: COURSE_SCOPE.syncAction, subjectType: "item", meta: syncAudit(coursePlan.sync, courseSynced) });
    }
    return {
      itemsSynced: synced.itemsSynced,
      stimuliSynced: synced.stimuliSynced,
      stimuliAdded: plan.stimuli.length,
      itemsAdded: rows.length,
      keysBackfilled: plan.backfill.length,
      itemsRetired: retired,
      imagesUploaded: images.uploaded,
      imagesPresent: images.present,
      listeningWithoutAudio: plan.stimuli.filter((s) => s.section === "LISTENING").map((s) => s.key),
      course: {
        itemsSynced: courseSynced.itemsSynced,
        stimuliSynced: courseSynced.stimuliSynced,
        stimuliAdded: coursePlan.stimuli.length,
        itemsAdded: courseRows.length,
        itemsRetired: courseRetired,
        /** Still APPROVED although their form no longer has them (not retired in this run). */
        staleLeft: options.retireStale ? 0 : coursePlan.stale,
        listeningWithoutAudio: coursePlan.stimuli.filter((s) => s.stimulus.section === "LISTENING").map((s) => s.seedKey),
      },
    };
  });
}

/**
 * Every listening clip without audio, for `pnpm bank:tts`: the bank's and the
 * course test forms' alike (a clip of a course form has a course_form and needs
 * its audio just the same), in every organisation.
 */
export async function clipsWithoutAudio() {
  return db
    .select()
    .from(stimuli)
    .where(and(eq(stimuli.section, "LISTENING"), isNull(stimuli.audioKey)));
}

/** Seed counts of the bank in an organisation (course rows are not part of it), for the top-up script's before/after line. */
export async function seedCounts(orgId: string) {
  const [[i], [a], [s]] = await Promise.all([
    db.select({ n: count() }).from(items).where(and(eq(items.orgId, orgId), eq(items.origin, "SEED"), isNull(items.courseForm))),
    db.select({ n: count() }).from(items).where(and(eq(items.orgId, orgId), eq(items.origin, "SEED"), eq(items.status, "APPROVED"), isNull(items.courseForm))),
    db.select({ n: count() }).from(stimuli).where(and(eq(stimuli.orgId, orgId), eq(stimuli.origin, "SEED"), isNull(stimuli.courseForm))),
  ]);
  return { items: i.n, approved: a.n, stimuli: s.n };
}

/** The same counts for the course test forms' rows. */
export async function courseSeedCounts(orgId: string) {
  const [[i], [a], [s]] = await Promise.all([
    db.select({ n: count() }).from(items).where(and(eq(items.orgId, orgId), eq(items.origin, "SEED"), isNotNull(items.courseForm))),
    db.select({ n: count() }).from(items).where(and(eq(items.orgId, orgId), eq(items.origin, "SEED"), eq(items.status, "APPROVED"), isNotNull(items.courseForm))),
    db.select({ n: count() }).from(stimuli).where(and(eq(stimuli.orgId, orgId), eq(stimuli.origin, "SEED"), isNotNull(stimuli.courseForm))),
  ]);
  return { items: i.n, approved: a.n, stimuli: s.n };
}

/** A bank text keeps its key as the seed key; a course text is stored under its form's prefixed key and course form. */
function stimulusRow(orgId: string, s: SeedStimulus, seedKey: string = s.key, courseForm: string | null = null) {
  return {
    orgId,
    section: s.section,
    level: s.level,
    title: s.title,
    body: s.body,
    topic: s.topic,
    speakers: s.speakers ?? null,
    maxPlays: s.maxPlays ?? null,
    origin: "SEED" as const,
    seedKey,
    courseForm,
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

/** A course item is a bank-style starter item plus where its form serves it (spec 2026-10-28). */
function courseItemRow(orgId: string, c: CourseSeedItem, stimulusId: string | null) {
  return { ...itemRow(orgId, c.item, c.seedKey, stimulusId, c.orderInStimulus), courseForm: c.courseForm, courseOrder: c.courseOrder };
}
