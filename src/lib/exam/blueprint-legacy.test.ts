import { describe, expect, it } from "vitest";
import { mulberry32, replay, selectNext, type AdaptiveConfig, type AdaptiveState, type ReplayResponse } from "./adaptive";
import {
  adaptiveConfigFor,
  anchorLevel,
  bankCoverage,
  isTextOnly,
  nextAdaptiveItems,
  planFixedSection,
  resolveDistribution,
  section,
  weighsTexts,
  type BankCount,
  type BankItem,
  type BlueprintConfig,
  type CoverageRow,
  type SectionConfig,
} from "./blueprint";
import { thetaForLevel } from "./cefr";
import { EXAM_TEMPLATES } from "./templates";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, CLOZE_SKILL_TAG, WORD_BANK_SKILL_TAG, type Cefr, type ExamMode } from "./types";

/**
 * Regression proof for the text-gap change (spec 2026-10-18): a frozen copy of
 * the C-test planning as it was before (commit 55ce992), run side by side with
 * today's code on every legacy section shape. Old configs and old attempts
 * must plan exactly as before, and the new cloze and word-bank items in the
 * bank must never reach them.
 */
const legacy = {
  cTestLevelsOf(s: SectionConfig, mode: ExamMode, claimed: Cefr | null): Cefr[] {
    if (s.section !== "GRAMMAR") return [];
    if (s.cTestLevels) return CEFR_LEVELS.filter((l) => s.cTestLevels!.includes(l));
    return s.cTest ? [anchorLevel(mode, claimed)] : [];
  },
  isCTest: (i: { skillTag: string }) => i.skillTag === C_TEST_SKILL_TAG,
  weighsCTests: (s: SectionConfig) => s.section === "GRAMMAR" && !!s.cTestLevels,
  shuffle<T>(xs: T[], rng: () => number): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  sampleFixedForm(pool: BankItem[], perLevel: Record<Cefr, number>, rng: () => number): string[] {
    const units: Array<{ ids: string[]; b: number }> = [];
    for (const level of CEFR_LEVELS) {
      const want = perLevel[level];
      if (want <= 0) continue;
      const atLevel = pool.filter((i) => i.level === level && !legacy.isCTest(i));
      const singles = atLevel.filter((i) => !i.stimulusId);
      const groups = new Map<string, BankItem[]>();
      for (const i of atLevel.filter((x) => x.stimulusId)) groups.set(i.stimulusId!, [...(groups.get(i.stimulusId!) ?? []), i]);
      const candidates = [...singles.map((i) => [i]), ...[...groups.values()].map((g) => [...g].sort((a, b) => a.orderInStimulus - b.orderInStimulus))];
      let taken = 0;
      for (const unit of legacy.shuffle(candidates, rng)) {
        if (taken >= want) break;
        units.push({ ids: unit.map((i) => i.id), b: unit.reduce((a, i) => a + i.b, 0) / unit.length });
        taken += unit.length;
      }
    }
    return units.sort((a, b) => a.b - b.b).flatMap((u) => u.ids);
  },
  planFixedSection(s: SectionConfig, pool: BankItem[], mode: ExamMode, claimed: Cefr | null, offset: number, rng: () => number): string[] {
    const ids: string[] = [];
    for (const level of legacy.cTestLevelsOf(s, mode, claimed)) {
      const candidates = pool.filter((i) => legacy.isCTest(i) && i.level === level);
      if (candidates.length > 0) ids.push(candidates[Math.floor(rng() * candidates.length)].id);
    }
    return [...ids, ...legacy.sampleFixedForm(pool, resolveDistribution(s, mode, claimed, offset), rng)];
  },
  nextAdaptiveItems(s: SectionConfig, mode: ExamMode, claimed: Cefr | null, state: AdaptiveState, pool: BankItem[], config: AdaptiveConfig, rng: () => number) {
    const levels = legacy.cTestLevelsOf(s, mode, claimed).filter((l) => pool.some((i) => legacy.isCTest(i) && i.level === l));
    const served = state.tagCounts[C_TEST_SKILL_TAG] ?? 0;
    if (served < levels.length) {
      const candidates = pool.filter((i) => legacy.isCTest(i) && i.level === levels[served] && !state.usedItemIds.includes(i.id));
      if (candidates.length > 0) return { itemIds: [candidates[Math.floor(rng() * candidates.length)].id] };
    }
    return selectNext(state, pool, config, rng);
  },
  isCTestOnly(s: SectionConfig, mode: ExamMode, claimed: Cefr | null, offset: number): boolean {
    if (s.adaptive || legacy.cTestLevelsOf(s, mode, claimed).length === 0) return false;
    return Object.values(resolveDistribution(s, mode, claimed, offset)).every((n) => n === 0);
  },
};

/** Per level: 10 single grammar items, 2 reading texts of 3 questions, 2 C-tests. */
const legacyPool: BankItem[] = CEFR_LEVELS.flatMap((level) => [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `${level}-g${i}`, level, b: thetaForLevel(level) + (i - 5) * 0.05, skillTag: `grammar.t${i % 4}`, stimulusId: null, orderInStimulus: 0 })),
  ...[0, 1].flatMap((t) =>
    [1, 2, 3].map((n) => ({ id: `${level}-r${t}-${n}`, level, b: thetaForLevel(level) + t * 0.1, skillTag: "reading.detail", stimulusId: `${level}-text${t}`, orderInStimulus: n })),
  ),
  ...[0, 1].map((k) => ({ id: `ctest-${level}-${k}`, level, b: thetaForLevel(level), skillTag: C_TEST_SKILL_TAG, stimulusId: null, orderInStimulus: 0 })),
]);
/** The same bank after the content rollout: two cloze texts and two word banks per level on top. */
const rolledOutPool: BankItem[] = [
  ...legacyPool,
  ...CEFR_LEVELS.flatMap((level) =>
    [0, 1].flatMap((k) => [
      { id: `cloze-${level}-${k}`, level, b: thetaForLevel(level), skillTag: CLOZE_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
      { id: `bank-${level}-${k}`, level, b: thetaForLevel(level), skillTag: WORD_BANK_SKILL_TAG, stimulusId: null, orderInStimulus: 0 },
    ]),
  ),
];

const ALL = [...CEFR_LEVELS];
const fixedShapes: SectionConfig[] = [
  section("GRAMMAR", 15, { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 } }),
  section("GRAMMAR", 15, { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 }, cTest: false }),
  section("GRAMMAR", 15, { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 }, cTest: true }),
  section("GRAMMAR", 17, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 } }, cTest: true }),
  section("GRAMMAR", 30, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } }, cTestLevels: ALL }),
  section("GRAMMAR", 15, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } }, cTestLevels: ["A2", "B1", "B2"] }),
  section("GRAMMAR", 20, { distribution: { kind: "RELATIVE", below: 2, at: 4, above: 2 }, cTestLevels: ["C2", "A1"], cTest: true }),
  section("READING", 18, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 4, B1: 4, B2: 4, C1: 4, C2: 0 } } }),
  section("READING", 12, { distribution: { kind: "RELATIVE", below: 0, at: 3, above: 0 }, cTest: true }),
  ...EXAM_TEMPLATES.flatMap((t) => t.config.sections.filter((s) => !s.adaptive && ["GRAMMAR", "READING", "LISTENING"].includes(s.section))),
];
const adaptiveShapes: SectionConfig[] = [
  section("GRAMMAR", 20, { adaptive: true, minItems: 10, maxItems: 18, targetSe: 0.45 }),
  section("GRAMMAR", 17, { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45, cTest: true }),
  section("GRAMMAR", 30, { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45, cTestLevels: ["A2", "B1", "B2"] }),
  section("GRAMMAR", 30, { adaptive: true, minItems: 6, maxItems: 12, targetSe: 0.45, cTestLevels: ALL }),
  ...EXAM_TEMPLATES.flatMap((t) => t.config.sections.filter((s) => s.adaptive)),
];
const contexts: Array<[ExamMode, Cefr | null]> = [
  ["PLACEMENT", null],
  ["LEVEL_VERIFICATION", "A1"],
  ["LEVEL_VERIFICATION", "B2"],
  ["LEVEL_VERIFICATION", "C2"],
];

function runAdaptive(
  next: typeof nextAdaptiveItems,
  s: SectionConfig,
  mode: ExamMode,
  claimed: Cefr | null,
  pool: BankItem[],
  weigh: boolean,
  seed: number,
): string[] {
  const cfg = adaptiveConfigFor(s, mode, claimed);
  const rng = mulberry32(seed);
  const answers = mulberry32(seed + 1000);
  const responses: ReplayResponse[] = [];
  for (;;) {
    const state = replay(cfg, responses);
    if (state.answered >= cfg.maxItems) break;
    const unit = next(s, mode, claimed, state, pool, cfg, rng);
    if (!unit) break;
    for (const id of unit.itemIds) {
      const item = pool.find((p) => p.id === id)!;
      const text = item.id.startsWith("ctest") || item.id.startsWith("cloze") || item.id.startsWith("bank");
      responses.push({ itemId: id, b: item.b, skillTag: item.skillTag, stimulusId: item.stimulusId, score: text ? Math.round(answers() * 20) / 20 : answers() < 0.5 ? 1 : 0, weight: weigh && text ? 5 : 1 });
    }
  }
  return responses.map((r) => r.itemId);
}

describe("legacy configs plan exactly as before 2026-10-18", () => {
  it("fixed sections: the same plan for every shape, context, offset and seed, with or without the new texts in the bank", () => {
    let compared = 0;
    for (const s of fixedShapes) {
      for (const [mode, claimed] of contexts) {
        for (const offset of [-1, 0, 1]) {
          for (let seed = 1; seed <= 8; seed++) {
            const before = legacy.planFixedSection(s, legacyPool, mode, claimed, offset, mulberry32(seed));
            expect(planFixedSection(s, legacyPool, mode, claimed, offset, mulberry32(seed))).toEqual(before);
            expect(planFixedSection(s, rolledOutPool, mode, claimed, offset, mulberry32(seed))).toEqual(before);
            compared++;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(300);
  });

  it("adaptive sections: the same served sequence, with or without the new texts in the bank", () => {
    for (const s of adaptiveShapes) {
      for (const [mode, claimed] of contexts) {
        for (let seed = 1; seed <= 6; seed++) {
          const weigh = legacy.weighsCTests(s);
          const before = runAdaptive(legacy.nextAdaptiveItems, s, mode, claimed, legacyPool, weigh, seed);
          expect(runAdaptive(nextAdaptiveItems, s, mode, claimed, legacyPool, weighsTexts(s), seed)).toEqual(before);
          expect(runAdaptive(nextAdaptiveItems, s, mode, claimed, rolledOutPool, weighsTexts(s), seed)).toEqual(before);
        }
      }
    }
  });

  it("the text-only intro and the estimate weighting answer as before", () => {
    for (const s of [...fixedShapes, ...adaptiveShapes]) {
      expect(weighsTexts(s), s.section).toBe(legacy.weighsCTests(s));
      for (const [mode, claimed] of contexts) {
        for (const offset of [-1, 0, 1]) expect(isTextOnly(s, mode, claimed, offset)).toBe(legacy.isCTestOnly(s, mode, claimed, offset));
      }
    }
  });

  it("coverage: new texts in the bank change no row of a legacy config and never count as items; C-test rows gain their kind", () => {
    const counts: BankCount[] = (["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"] as const).flatMap((section) =>
      CEFR_LEVELS.map((level, i) => ({ section, level, items: 10 + i, stimuli: 3, ...(section === "GRAMMAR" ? { cTests: i % 2 } : {}) })),
    );
    const rolledOut = counts.map((c) => (c.section === "GRAMMAR" ? { ...c, items: c.items + 5, clozeTexts: 3, wordBanks: 2 } : c));
    const strip = (rows: CoverageRow[]) => rows.map(({ text, ...r }) => (r.cTest ? (expect(text).toBe("CTEST"), r) : (expect(text).toBeUndefined(), r)));
    const configs: BlueprintConfig[] = [
      ...EXAM_TEMPLATES.map((t) => t.config),
      ...fixedShapes.map((s) => ({ ...EXAM_TEMPLATES[0].config, sections: [s] })),
      ...adaptiveShapes.map((s) => ({ ...EXAM_TEMPLATES[0].config, sections: [s] })),
    ];
    for (const cfg of configs) {
      for (const [mode, claimed] of [...contexts, ["LEVEL_VERIFICATION", null] as [ExamMode, null]]) {
        const a = bankCoverage(counts, cfg, mode, claimed);
        const b = bankCoverage(rolledOut, cfg, mode, claimed);
        expect(strip(b.rows)).toEqual(strip(a.rows));
        expect(b.ok).toBe(a.ok);
      }
    }
  });
});
