import type { SeedBankPart, SeedItem, SeedStimulus } from "@/db/seed-bank/types";
import { canonicalJson, seedItemKey } from "@/db/seed-bank/seed-key";
import { thetaForLevel } from "@/lib/exam/cefr";
import { refuseUnlessThrowAwayDb, refuseUnlessWorkingDb } from "@/db/working-db-guard";
import { CEFR_LEVELS, SECTIONS, type ItemContent, type ItemKey, type ItemRubric } from "@/lib/exam/types";

/** host:port/database of a database url, without user or password. Null when the url does not parse. */
export function databaseTarget(url: string | undefined): string | null {
  try {
    const u = new URL(url ?? "");
    const name = decodeURIComponent(u.pathname.replace(/^\//, ""));
    if (!u.hostname || !name) return null;
    return `${u.hostname}:${u.port || "5432"}/${name}`;
  } catch {
    return null;
  }
}

export type TopUpMode = { allowWorkingDb: boolean; production?: boolean; confirmDb?: string };

/**
 * The top-up writes rows, so by default it only runs on a throw-away
 * `*_check` database; `--allow-working-db` widens that to the local working
 * database (never the shared `kademe`). `--production --confirm-db=<host:port/db>`
 * is the only way onto a production database: the confirmation must equal the
 * target parsed from DATABASE_URL exactly. Returns the reason to refuse, or null.
 */
export function bankTopUpRefusal(url: string | undefined, mode: boolean | TopUpMode): string | null {
  const m: TopUpMode = typeof mode === "boolean" ? { allowWorkingDb: mode } : mode;
  if (m.production) {
    const target = databaseTarget(url);
    if (!target) return "DATABASE_URL is missing or not a valid url.";
    if (m.allowWorkingDb) return "--production cannot be combined with --allow-working-db.";
    if (!m.confirmDb) return `--production needs --confirm-db=${target} (the database this run would write to).`;
    if (m.confirmDb !== target) return `--confirm-db=${m.confirmDb} does not match the database in DATABASE_URL (${target}).`;
    return null;
  }
  if (m.confirmDb) return "--confirm-db only works together with --production.";
  return m.allowWorkingDb ? refuseUnlessWorkingDb(url) : refuseUnlessThrowAwayDb(url);
}

/**
 * What a bank top-up has to do for one organisation, worked out without a
 * database so it can be tested: which starter texts and items the org lacks,
 * and which of its existing starter items only lack their seed key (orgs
 * seeded before items had one).
 *
 * Stimuli are matched by their seed key. Items are matched by seed key, or,
 * for SEED rows without one, by the key computed from the row itself. A row
 * whose prompt or content a school edited no longer matches; the original
 * starter item is then added again next to it.
 *
 * With `retireStale`, the plan also lists the starter items the current bank
 * no longer has: APPROVED rows with origin SEED whose seed key (or, without
 * one, the key computed from the row) is not in the bank. They are set to
 * RETIRED, never deleted, so old reports and item_responses keep pointing at
 * them. Items a school wrote (TEACHER, AI) are never touched, and neither is a
 * starter item the school edited in the bank (user decision 2026-10-07): it is
 * the school's version now, listed under `keptEdited` instead.
 */

export type ExistingStimulus = {
  id: string;
  seedKey: string | null;
  /** Only needed for --sync-seed. */
  origin?: string;
  section?: SeedItem["section"];
  level?: SeedStimulus["level"];
  title?: string;
  body?: string;
  speakers?: SeedStimulus["speakers"] | null;
  /** An item that reads this text was edited by the school (an audit row `bank.edit`). */
  itemEdited?: boolean;
};

export type ExistingItem = {
  id: string;
  seedKey: string | null;
  origin: string;
  status: string;
  section: SeedItem["section"];
  level: SeedItem["level"];
  type: SeedItem["type"];
  prompt: string;
  content: ItemContent;
  /** Seed key of the item's stimulus, when it has one. */
  stimulusSeedKey: string | null;
  /** The school edited this item in the bank (an audit row `bank.edit`). */
  edited?: boolean;
  /** The fields --sync-seed compares. Only needed when syncing. */
  answerKey?: ItemKey;
  difficulty?: number;
  explanation?: string | null;
  rubric?: ItemRubric | null;
};

export type TopUpPlan = {
  stimuli: SeedStimulus[];
  items: Array<{ item: SeedItem; seedKey: string }>;
  backfill: Array<{ id: string; seedKey: string }>;
  /** Stale starter items to set RETIRED; empty unless `retireStale` was asked for. */
  retire: Array<{ id: string; section: SeedItem["section"]; level: SeedItem["level"] }>;
  /** Stale starter items kept because the school edited them. */
  keptEdited: number;
  /** What --sync-seed would update; empty unless `syncSeed` was asked for. */
  sync: SyncPlan;
};

export type SyncField = "key" | "difficulty" | "explanation" | "rubric";

export type SyncItemChange = {
  id: string;
  section: SeedItem["section"];
  level: SeedItem["level"];
  prompt: string;
  fields: SyncField[];
  set: { answerKey?: ItemKey; difficulty?: number; explanation?: string | null; rubric?: ItemRubric | null };
};

export type SyncStimulusChange = {
  id: string;
  key: string;
  section: SeedStimulus["section"];
  level: SeedStimulus["level"];
  title: string;
  body: string;
};

export type SyncPlan = {
  items: SyncItemChange[];
  stimuli: SyncStimulusChange[];
  /** Starter items that differ from the seed but were edited by the school, so they are left alone. */
  itemsKeptEdited: number;
  /** Reading texts that differ but are read by an item the school edited, so they are left alone. */
  stimuliKeptEdited: number;
  /** Listening scripts (or voices) that differ from the seed. Never changed: the audio was made from them. */
  listeningDiffs: Array<{ id: string; key: string; level: SeedStimulus["level"] }>;
};

/** Difficulty is stored as a 4-byte float: 0.3 comes back as 0.30000001. */
const DIFFICULTY_EPSILON = 1e-4;

/**
 * --sync-seed: the starter items and texts an organisation has, compared with
 * the current bank. Only origin SEED rows matched by seed key are looked at;
 * teacher and AI rows, and starter items the school edited, never change.
 * Status is never part of it. Reading texts are updated; listening scripts
 * only reported.
 */
export function planSyncSeed(
  bank: SeedBankPart,
  existing: { stimuli: ExistingStimulus[]; items: ExistingItem[] },
): SyncPlan {
  const wanted = new Map(bank.items.map((item) => [seedItemKey(item), item]));
  const sync: SyncPlan = { items: [], stimuli: [], itemsKeptEdited: 0, stimuliKeptEdited: 0, listeningDiffs: [] };
  for (const row of existing.items) {
    if (row.origin !== "SEED") continue;
    const seed = wanted.get(row.seedKey ?? seedItemKey({ ...row, stimulusKey: row.stimulusSeedKey }));
    if (!seed) continue;
    const set: SyncItemChange["set"] = {};
    const fields: SyncField[] = [];
    if (row.answerKey !== undefined && canonicalJson(row.answerKey) !== canonicalJson(seed.key)) {
      set.answerKey = seed.key;
      fields.push("key");
    }
    const difficulty = thetaForLevel(seed.level, seed.within ?? "MID");
    if (row.difficulty !== undefined && Math.abs(row.difficulty - difficulty) > DIFFICULTY_EPSILON) {
      set.difficulty = difficulty;
      fields.push("difficulty");
    }
    if (row.explanation !== undefined && (row.explanation ?? null) !== (seed.explanation ?? null)) {
      set.explanation = seed.explanation ?? null;
      fields.push("explanation");
    }
    if (row.rubric !== undefined && canonicalJson(row.rubric ?? null) !== canonicalJson(seed.rubric ?? null)) {
      set.rubric = seed.rubric ?? null;
      fields.push("rubric");
    }
    if (fields.length === 0) continue;
    if (row.edited) {
      sync.itemsKeptEdited += 1;
      continue;
    }
    sync.items.push({ id: row.id, section: row.section, level: row.level, prompt: seed.prompt, fields, set });
  }
  const seedStimuli = new Map(bank.stimuli.map((s) => [s.key, s]));
  for (const row of existing.stimuli) {
    if (row.origin !== "SEED" || !row.seedKey || row.body === undefined) continue;
    const seed = seedStimuli.get(row.seedKey);
    if (!seed) continue;
    const sameVoices = canonicalJson(row.speakers ?? null) === canonicalJson(seed.speakers ?? null);
    if (seed.section === "LISTENING" || row.section === "LISTENING") {
      if (row.body !== seed.body || !sameVoices) sync.listeningDiffs.push({ id: row.id, key: seed.key, level: seed.level });
      continue;
    }
    if (row.body === seed.body) continue;
    if (row.itemEdited) {
      sync.stimuliKeptEdited += 1;
      continue;
    }
    sync.stimuli.push({ id: row.id, key: seed.key, section: seed.section, level: seed.level, title: seed.title, body: seed.body });
  }
  return sync;
}

/** Counts per section and level of the items and texts a sync would change, in bank order. */
export function syncCounts(sync: SyncPlan): Array<{ kind: "item" | "text"; section: string; level: SeedItem["level"]; n: number }> {
  const counts = new Map<string, { kind: "item" | "text"; section: string; level: SeedItem["level"]; n: number }>();
  const add = (kind: "item" | "text", section: string, level: SeedItem["level"]) => {
    const k = `${kind} ${section} ${level}`;
    const c = counts.get(k) ?? { kind, section, level, n: 0 };
    c.n += 1;
    counts.set(k, c);
  };
  for (const i of sync.items) add("item", i.section, i.level);
  for (const s of sync.stimuli) add("text", s.section, s.level);
  const sec = (x: string) => SECTIONS.indexOf(x as (typeof SECTIONS)[number]);
  return [...counts.values()].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "item" ? -1 : 1) || sec(a.section) - sec(b.section) || CEFR_LEVELS.indexOf(a.level) - CEFR_LEVELS.indexOf(b.level),
  );
}

/** Printed summary lines of a sync: counts per section and level, then the first few examples. */
export function formatSyncSummary(sync: SyncPlan, examples = 3): string[] {
  const lines: string[] = [];
  const bySection = new Map<string, string[]>();
  for (const c of syncCounts(sync)) {
    const k = `${c.kind === "item" ? "items" : "texts"} ${c.section}`;
    bySection.set(k, [...(bySection.get(k) ?? []), `${c.level} ${c.n}`]);
  }
  for (const [k, parts] of bySection) lines.push(`sync ${k}: ${parts.join(", ")}`);
  for (const i of sync.items.slice(0, examples)) lines.push(`e.g. ${i.section} ${i.level} [${i.fields.join(", ")}] ${i.prompt.replace(/\s+/g, " ").slice(0, 70)}`);
  for (const s of sync.stimuli.slice(0, examples)) lines.push(`e.g. text ${s.key}: ${s.title}`);
  if (sync.itemsKeptEdited) lines.push(`kept ${sync.itemsKeptEdited} starter items the school edited`);
  if (sync.stimuliKeptEdited) lines.push(`kept ${sync.stimuliKeptEdited} reading texts read by an item the school edited`);
  if (sync.listeningDiffs.length)
    lines.push(`listening scripts differing from the seed (NOT changed, audio was made from them): ${sync.listeningDiffs.map((d) => d.key).join(", ")}`);
  return lines;
}

export function planTopUp(
  bank: SeedBankPart,
  existing: { stimuli: ExistingStimulus[]; items: ExistingItem[] },
  options: { retireStale?: boolean; syncSeed?: boolean } = {},
): TopUpPlan {
  const haveStimuli = new Set(existing.stimuli.map((s) => s.seedKey).filter((k): k is string => !!k));
  const stimuli = bank.stimuli.filter((s) => !haveStimuli.has(s.key));

  const wanted = new Map(bank.items.map((item) => [seedItemKey(item), item]));
  const have = new Set(existing.items.map((i) => i.seedKey).filter((k): k is string => !!k));
  const backfill: TopUpPlan["backfill"] = [];
  for (const row of existing.items) {
    if (row.seedKey || row.origin !== "SEED") continue;
    const key = seedItemKey({ ...row, stimulusKey: row.stimulusSeedKey });
    if (!wanted.has(key) || have.has(key)) continue;
    have.add(key);
    backfill.push({ id: row.id, seedKey: key });
  }
  const items = [...wanted].filter(([key]) => !have.has(key)).map(([seedKey, item]) => ({ item, seedKey }));
  const retire: TopUpPlan["retire"] = [];
  let keptEdited = 0;
  if (options.retireStale) {
    for (const row of existing.items) {
      if (row.origin !== "SEED" || row.status !== "APPROVED") continue;
      const key = row.seedKey ?? seedItemKey({ ...row, stimulusKey: row.stimulusSeedKey });
      if (wanted.has(key)) continue;
      if (row.edited) {
        keptEdited += 1;
        continue;
      }
      retire.push({ id: row.id, section: row.section, level: row.level });
    }
  }
  const sync = options.syncSeed ? planSyncSeed(bank, existing) : { items: [], stimuli: [], itemsKeptEdited: 0, stimuliKeptEdited: 0, listeningDiffs: [] };
  return { stimuli, items, backfill, retire, keptEdited, sync };
}

/** Retire counts per section and level, in bank order (section, then CEFR level), for the printed summary. */
export function retireCounts(retire: TopUpPlan["retire"]): Array<{ section: SeedItem["section"]; level: SeedItem["level"]; n: number }> {
  const counts = new Map<string, { section: SeedItem["section"]; level: SeedItem["level"]; n: number }>();
  for (const r of retire) {
    const k = `${r.section} ${r.level}`;
    const c = counts.get(k) ?? { section: r.section, level: r.level, n: 0 };
    c.n += 1;
    counts.set(k, c);
  }
  return [...counts.values()].sort(
    (a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || CEFR_LEVELS.indexOf(a.level) - CEFR_LEVELS.indexOf(b.level),
  );
}

/** One summary line per section: "GRAMMAR: A1 12, A2 10". Empty when nothing retires. */
export function formatRetireCounts(retire: TopUpPlan["retire"]): string[] {
  const bySection = new Map<string, string[]>();
  for (const c of retireCounts(retire)) bySection.set(c.section, [...(bySection.get(c.section) ?? []), `${c.level} ${c.n}`]);
  return [...bySection].map(([section, parts]) => `${section}: ${parts.join(", ")}`);
}

/** 1-based position of every stimulus item among the items of its stimulus, as the first import numbered them. */
export function seedOrderInStimulus(bank: SeedBankPart): Map<SeedItem, number> {
  const counter = new Map<string, number>();
  const order = new Map<SeedItem, number>();
  for (const item of bank.items) {
    if (!item.stimulusKey) {
      order.set(item, 0);
      continue;
    }
    const n = (counter.get(item.stimulusKey) ?? 0) + 1;
    counter.set(item.stimulusKey, n);
    order.set(item, n);
  }
  return order;
}
