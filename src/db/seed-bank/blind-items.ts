import { matchingTargets, toCandidateItem, type CandidateItem } from "@/lib/exam/safe";
import type { Cefr, ItemSnapshot } from "@/lib/exam/types";
import { seedItemKey } from "./seed-key";
import type { SeedBankPart, SeedItem, SeedStimulus } from "./types";

/** The objective items of one level with their seed keys, shared by the blind export and compare scripts. */
export type BlindItem = {
  seedKey: string;
  item: SeedItem;
  stimulus: SeedStimulus | null;
  snapshot: ItemSnapshot;
  /** What the solver sees, from the engine's own whitelist. */
  candidate: CandidateItem;
  /** Matching only: the letter a row's target shows, to the right column id. */
  letterToRightId: Record<string, string>;
};

export function blindItems(bank: SeedBankPart, level: Cefr): BlindItem[] {
  const stimuli = new Map(bank.stimuli.map((s) => [s.key, s]));
  const out: BlindItem[] = [];
  for (const item of bank.items) {
    if (item.level !== level) continue;
    if (item.section !== "GRAMMAR" && item.section !== "READING" && item.section !== "LISTENING") continue;
    if (item.key.kind === "NONE") continue;
    const stimulus = item.stimulusKey ? (stimuli.get(item.stimulusKey) ?? null) : null;
    const seedKey = seedItemKey(item);
    const snapshot: ItemSnapshot = {
      id: seedKey,
      section: item.section,
      level: item.level,
      difficulty: 0,
      type: item.type,
      skillTag: item.skillTag,
      stimulusId: stimulus?.key ?? null,
      orderInStimulus: 0,
      prompt: item.prompt,
      content: item.content,
      key: item.key,
      rubric: null,
      points: 1,
      stimulus: stimulus
        ? {
            id: stimulus.key,
            section: stimulus.section,
            level: stimulus.level,
            title: stimulus.title,
            body: stimulus.body,
            audioKey: null,
            audioDurationMs: null,
          }
        : null,
    };
    const candidate = toCandidateItem(snapshot, {}, null, out.length + 1, { maxPlays: 1 });
    const letterToRightId: Record<string, string> = {};
    if (item.content.kind === "MATCHING") {
      for (const t of matchingTargets(item.content.right)) letterToRightId[t.badge] = t.id;
    }
    out.push({ seedKey, item, stimulus, snapshot, candidate, letterToRightId });
  }
  return out;
}

/** Plain argument parser: `--name value` pairs, `--flag` alone is "true". */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[a.slice(2)] = next;
      i++;
    } else out[a.slice(2)] = "true";
  }
  return out;
}

export function parseLevel(raw: string | undefined): Cefr {
  const up = (raw ?? "").toUpperCase();
  if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(up)) throw new Error("--level must be one of a1 a2 b1 b2 c1 c2");
  return up as Cefr;
}
