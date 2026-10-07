import type { SeedBankPart, SeedItem, SeedStimulus } from "@/db/seed-bank/types";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import { refuseUnlessThrowAwayDb, refuseUnlessWorkingDb } from "@/db/working-db-guard";
import { CEFR_LEVELS, SECTIONS, type ItemContent } from "@/lib/exam/types";

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
 * them. Items a school wrote (TEACHER, AI) are never touched.
 */

export type ExistingStimulus = { id: string; seedKey: string | null };

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
};

export type TopUpPlan = {
  stimuli: SeedStimulus[];
  items: Array<{ item: SeedItem; seedKey: string }>;
  backfill: Array<{ id: string; seedKey: string }>;
  /** Stale starter items to set RETIRED; empty unless `retireStale` was asked for. */
  retire: Array<{ id: string; section: SeedItem["section"]; level: SeedItem["level"] }>;
};

export function planTopUp(
  bank: SeedBankPart,
  existing: { stimuli: ExistingStimulus[]; items: ExistingItem[] },
  options: { retireStale?: boolean } = {},
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
  if (options.retireStale) {
    for (const row of existing.items) {
      if (row.origin !== "SEED" || row.status !== "APPROVED") continue;
      const key = row.seedKey ?? seedItemKey({ ...row, stimulusKey: row.stimulusSeedKey });
      if (wanted.has(key)) continue;
      retire.push({ id: row.id, section: row.section, level: row.level });
    }
  }
  return { stimuli, items, backfill, retire };
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
