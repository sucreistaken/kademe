import type { SeedBankPart, SeedItem, SeedStimulus } from "@/db/seed-bank/types";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import { refuseUnlessThrowAwayDb, refuseUnlessWorkingDb } from "@/db/working-db-guard";
import type { ItemContent } from "@/lib/exam/types";

/**
 * The top-up writes rows, so by default it only runs on a throw-away
 * `*_check` database; `--allow-working-db` widens that to the local working
 * database (never the shared `kademe`). Returns the reason to refuse, or null.
 */
export function bankTopUpRefusal(url: string | undefined, allowWorkingDb: boolean): string | null {
  return allowWorkingDb ? refuseUnlessWorkingDb(url) : refuseUnlessThrowAwayDb(url);
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
 */

export type ExistingStimulus = { id: string; seedKey: string | null };

export type ExistingItem = {
  id: string;
  seedKey: string | null;
  origin: string;
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
};

export function planTopUp(bank: SeedBankPart, existing: { stimuli: ExistingStimulus[]; items: ExistingItem[] }): TopUpPlan {
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
  return { stimuli, items, backfill };
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
