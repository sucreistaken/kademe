import { grammar } from "./grammar";
import { listening } from "./listening";
import { reading } from "./reading";
import { speaking } from "./speaking";
import type { SeedBankPart } from "./types";
import { writing } from "./writing";

export const SEED_PARTS = { grammar, reading, listening, writing, speaking };

export const SEED_BANK: SeedBankPart = {
  stimuli: Object.values(SEED_PARTS).flatMap((p) => p.stimuli),
  items: Object.values(SEED_PARTS).flatMap((p) => p.items),
};
