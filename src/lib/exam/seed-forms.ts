import { SEED_BANK } from "@/db/seed-bank";
import type { SeedBankPart, SeedItem } from "@/db/seed-bank/types";
import {
  enabledSections,
  pickProductive,
  planFixedSection,
  productiveTaskLevels,
  type Avoid,
  type BankItem,
  type BlueprintConfig,
} from "./blueprint";
import { thetaForLevel } from "./cefr";
import { itemFormatOf } from "./item-format";
import { isObjectiveSection, type Cefr, type ExamMode, type Section } from "./types";

/**
 * Offline form drawing on the starter bank, for src/lib/exam/forms.test.ts
 * and scripts/form-timing.ts. No database: the bank is read from
 * src/db/seed-bank and drawn with the same functions startSection uses.
 */

/** One starter-bank item as an exam pool row, with the seed item it came from. */
export type SeedPoolItem = BankItem & { section: Section; seed: SeedItem };

/**
 * The starter bank as an exam pool, as bank-import.ts writes it: the
 * difficulty comes from the level and `within`, the items of a text count
 * from 1 in bank order, nothing was served yet, and every listening clip
 * counts as having audio. Ids are "seed-<index>"; a stimulus key stands in
 * for the stimulus id. The format is worked out as startSection does.
 */
export function seedPool(bank: SeedBankPart = SEED_BANK): SeedPoolItem[] {
  const order = new Map<string, number>();
  return bank.items.map((item, index) => {
    const n = item.stimulusKey ? (order.get(item.stimulusKey) ?? 0) + 1 : 0;
    if (item.stimulusKey) order.set(item.stimulusKey, n);
    return {
      id: `seed-${index}`,
      section: item.section,
      level: item.level,
      b: thetaForLevel(item.level, item.within ?? "MID"),
      type: item.type,
      format: itemFormatOf(item),
      skillTag: item.skillTag,
      stimulusId: item.stimulusKey ?? null,
      orderInStimulus: n,
      exposureCount: 0,
      seed: item,
    };
  });
}

/** One planned section: its item ids in plan order. */
export type DrawnSection = { section: Section; itemIds: string[] };

/**
 * One student's exam as startSection (exam-flow.ts) plans it: a fixed
 * objective section through planFixedSection, writing and speaking through
 * pickProductive at productiveTaskLevels. `provisional` stands in for the
 * level the objective sections would give. Adaptive sections pick item by
 * item and are left out.
 */
export function drawExamForm(
  cfg: BlueprintConfig,
  mode: ExamMode,
  claimed: Cefr | null,
  provisional: Cefr,
  pool: SeedPoolItem[],
  rng: () => number,
  avoid?: Avoid,
): DrawnSection[] {
  return enabledSections(cfg).flatMap((s): DrawnSection[] => {
    const sectionPool = pool.filter((p) => p.section === s.section);
    if (!isObjectiveSection(s.section)) {
      const levels = productiveTaskLevels(mode, claimed, provisional, s.tasks);
      return [{ section: s.section, itemIds: pickProductive(sectionPool, levels, rng, avoid) }];
    }
    if (s.adaptive) return [];
    return [{ section: s.section, itemIds: planFixedSection(s, sectionPool, mode, claimed, cfg.difficultyOffset, rng, avoid) }];
  });
}

/** What seenBy would return after these forms were served: their items and the stimuli of those items. */
export function servedIn(forms: DrawnSection[][], pool: SeedPoolItem[]): Avoid {
  const byId = new Map(pool.map((p) => [p.id, p]));
  const avoid: Avoid = { itemIds: new Set(), stimulusIds: new Set() };
  for (const id of forms.flat().flatMap((f) => f.itemIds)) {
    avoid.itemIds.add(id);
    const stimulusId = byId.get(id)?.stimulusId;
    if (stimulusId) avoid.stimulusIds.add(stimulusId);
  }
  return avoid;
}
