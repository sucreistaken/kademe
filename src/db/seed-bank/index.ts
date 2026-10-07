import { A1_PARTS } from "./levels/a1";
import { A2_PARTS } from "./levels/a2";
import { B1_PARTS } from "./levels/b1";
import { B2_PARTS } from "./levels/b2";
import { C1_PARTS } from "./levels/c1";
import { C2_PARTS } from "./levels/c2";
import type { SeedBankPart } from "./types";

/**
 * The starter bank, one file per CEFR level (levels/a1.ts ... levels/c2.ts),
 * written from docs/EXAM-BANK-RESEARCH.md. Each level file holds that level's
 * five sections; SEED_PARTS joins them back into one part per section.
 */
const LEVELS = [A1_PARTS, A2_PARTS, B1_PARTS, B2_PARTS, C1_PARTS, C2_PARTS];
type SectionName = "grammar" | "reading" | "listening" | "writing" | "speaking";

const join = (section: SectionName): SeedBankPart => ({
  stimuli: LEVELS.flatMap((l) => l[section].stimuli),
  items: LEVELS.flatMap((l) => l[section].items),
});

export const SEED_PARTS = {
  grammar: join("grammar"),
  reading: join("reading"),
  listening: join("listening"),
  writing: join("writing"),
  speaking: join("speaking"),
};

export const SEED_BANK: SeedBankPart = {
  stimuli: Object.values(SEED_PARTS).flatMap((p) => p.stimuli),
  items: Object.values(SEED_PARTS).flatMap((p) => p.items),
};
