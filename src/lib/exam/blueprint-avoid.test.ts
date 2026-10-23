import { describe, expect, it } from "vitest";
import { mulberry32 } from "./adaptive";
import {
  PICTURE_TASK_TAG,
  pickProductive,
  planFixedSection,
  productiveTaskLevels,
  resolveDistribution,
  sampleFixedForm,
  section,
  skillTagFamily,
  textOpenings,
  textPlanOf,
  type Avoid,
  type BankItem,
  type SectionConfig,
} from "./blueprint";
import { thetaForLevel } from "./cefr";
import { seedPool } from "./seed-forms";
import { EXAM_TEMPLATES } from "./templates";
import { CEFR_LEVELS, CLOZE_SKILL_TAG, isObjectiveSection, isTextGap, textGapKindOf, type Cefr, type ExamMode } from "./types";

/**
 * Regression proof for `avoid` (no repeats for a returning student): a frozen
 * copy of the selection as it was at commit 5a2260f (sampleFixedForm and
 * textOpenings from blueprint.ts, pickProductive from exam-flow.ts), run side
 * by side with today's code. With `avoid` missing or empty the draw must not
 * move by a single item.
 */
const legacy = {
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
      const atLevel = pool.filter((i) => i.level === level && !isTextGap(i));
      const singles = atLevel.filter((i) => !i.stimulusId);
      const groups = new Map<string, BankItem[]>();
      for (const i of atLevel.filter((x) => x.stimulusId)) {
        groups.set(i.stimulusId!, [...(groups.get(i.stimulusId!) ?? []), i]);
      }
      const candidates = [
        ...singles.map((i) => [i]),
        ...[...groups.values()].map((g) => [...g].sort((a, b) => a.orderInStimulus - b.orderInStimulus)),
      ];
      let taken = 0;
      for (const unit of legacy.shuffle(candidates, rng)) {
        if (taken >= want) break;
        units.push({ ids: unit.map((i) => i.id), b: unit.reduce((a, i) => a + i.b, 0) / unit.length });
        taken += unit.length;
      }
    }
    return units.sort((a, b) => a.b - b.b).flatMap((u) => u.ids);
  },
  textOpenings(s: SectionConfig, pool: BankItem[], mode: ExamMode, claimed: Cefr | null, rng: () => number): string[] {
    const ids: string[] = [];
    for (const entry of textPlanOf(s, mode, claimed)) {
      const candidates = pool.filter((i) => i.level === entry.level && textGapKindOf(i) === entry.kind);
      if (candidates.length > 0) ids.push(candidates[Math.floor(rng() * candidates.length)].id);
    }
    return ids;
  },
  planFixedSection(s: SectionConfig, pool: BankItem[], mode: ExamMode, claimed: Cefr | null, offset: number, rng: () => number): string[] {
    const openings = legacy.textOpenings(s, pool, mode, claimed, rng);
    return [...openings, ...legacy.sampleFixedForm(pool, resolveDistribution(s, mode, claimed, offset), rng)];
  },
  pickProductive(pool: BankItem[], levels: Cefr[], rng: () => number): string[] {
    const chosen: string[] = [];
    const tags = new Set<string>();
    for (const level of levels) {
      const candidates = pool.filter((p) => p.level === level && !chosen.includes(p.id));
      const fresh = candidates.filter((c) => !tags.has(c.skillTag));
      const from = fresh.length > 0 ? fresh : candidates;
      if (from.length === 0) continue;
      const pick = from[Math.floor(rng() * from.length)];
      chosen.push(pick.id);
      tags.add(pick.skillTag);
    }
    return chosen;
  },
};

const empty = (): Avoid => ({ itemIds: new Set(), stimulusIds: new Set() });
/** An avoid list that touches nothing in the pools below: the returning-student path with nothing seen. */
const foreign = (): Avoid => ({ itemIds: new Set(["elsewhere"]), stimulusIds: new Set() });
const avoiding = (itemIds: string[], stimulusIds: string[] = []): Avoid => ({ itemIds: new Set(itemIds), stimulusIds: new Set(stimulusIds) });

/**
 * Per level: 8 single items (multiple choice and gap fill in turn, served 7
 * down to 0 times), 4 texts of 3 questions (served 40 down to 10 times) and 3
 * cloze texts.
 */
const synthetic: BankItem[] = CEFR_LEVELS.flatMap((level) => [
  ...Array.from({ length: 8 }, (_, i): BankItem => ({
    id: `${level}-s${i}`,
    level,
    b: thetaForLevel(level) + (i - 4) * 0.05,
    skillTag: `grammar.t${i}`,
    type: i % 2 === 0 ? "SINGLE_CHOICE" : "GAP_FILL",
    stimulusId: null,
    orderInStimulus: 0,
    exposureCount: 7 - i,
  })),
  ...[0, 1, 2, 3].flatMap((t) =>
    [1, 2, 3].map((n): BankItem => ({
      id: `${level}-x${t}-${n}`,
      level,
      b: thetaForLevel(level) + t * 0.1,
      skillTag: "reading.detail",
      type: "SINGLE_CHOICE",
      stimulusId: `${level}-text${t}`,
      orderInStimulus: n,
      exposureCount: 10 * (4 - t),
    })),
  ),
  ...[0, 1, 2].map((k): BankItem => ({
    id: `${level}-c${k}`,
    level,
    b: thetaForLevel(level),
    skillTag: CLOZE_SKILL_TAG,
    type: "GAP_FILL",
    stimulusId: null,
    orderInStimulus: 0,
    exposureCount: 5 - k,
  })),
]);

const task = (id: string, level: Cefr, skillTag: string, exposureCount = 0): BankItem => ({
  id, level, b: thetaForLevel(level), skillTag, type: "SPEAKING_PROMPT", stimulusId: null, orderInStimulus: 0, exposureCount,
});
const tasks = [
  task("pic-1", "B1", PICTURE_TASK_TAG, 3),
  task("pic-2", "B1", PICTURE_TASK_TAG, 1),
  task("talk-1", "B1", "speaking.presentation", 4),
  task("talk-2", "B1", "speaking.presentation.slides", 2),
  task("plan-1", "B1", "speaking.planning", 6),
  task("plan-2", "B2", "speaking.planning", 0),
];

/** A grammar section with two cloze openings and singles at three levels, for the pinned draw. */
const pinnedSection = section("GRAMMAR", 20, {
  distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 2, B1: 4, B2: 3, C1: 0, C2: 0 } },
  texts: [{ level: "B1", kind: "CLOZE" }, { level: "B2", kind: "CLOZE" }],
});

describe("without avoid the draw is the one of 5a2260f", () => {
  const pool = seedPool();
  const contexts = (mode: ExamMode): Array<{ claimed: Cefr | null; provisional: Cefr }> =>
    mode === "PLACEMENT"
      ? CEFR_LEVELS.map((provisional) => ({ claimed: null, provisional }))
      : CEFR_LEVELS.map((claimed) => ({ claimed, provisional: claimed }));

  it("every template section, level and seed on the starter bank, with avoid missing or empty", () => {
    let compared = 0;
    for (const t of EXAM_TEMPLATES) {
      for (const s of t.config.sections) {
        // Picture tasks are the one intended change (a speaking section opens with one); tested below.
        const sectionPool = pool.filter((p) => p.section === s.section && p.skillTag !== PICTURE_TASK_TAG);
        for (const { claimed, provisional } of contexts(t.mode)) {
          for (let seed = 1; seed <= 12; seed++) {
            if (isObjectiveSection(s.section)) {
              const before = legacy.planFixedSection(s, sectionPool, t.mode, claimed, t.config.difficultyOffset, mulberry32(seed));
              expect(planFixedSection(s, sectionPool, t.mode, claimed, t.config.difficultyOffset, mulberry32(seed))).toEqual(before);
              expect(planFixedSection(s, sectionPool, t.mode, claimed, t.config.difficultyOffset, mulberry32(seed), empty())).toEqual(before);
            } else {
              const levels = productiveTaskLevels(t.mode, claimed, provisional, s.tasks);
              const before = legacy.pickProductive(sectionPool, levels, mulberry32(seed));
              expect(pickProductive(sectionPool, levels, mulberry32(seed))).toEqual(before);
              expect(pickProductive(sectionPool, levels, mulberry32(seed), empty())).toEqual(before);
            }
            compared++;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
  });

  it("every count, level and seed on a pool of singles, texts and cloze texts", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const offset of [-1, 0, 1]) {
        for (const mode of ["PLACEMENT", "LEVEL_VERIFICATION"] as const) {
          const before = legacy.planFixedSection(pinnedSection, synthetic, mode, "B1", offset, mulberry32(seed));
          expect(planFixedSection(pinnedSection, synthetic, mode, "B1", offset, mulberry32(seed))).toEqual(before);
          expect(planFixedSection(pinnedSection, synthetic, mode, "B1", offset, mulberry32(seed), empty())).toEqual(before);
        }
      }
      const perLevel = { A1: seed % 5, A2: 3, B1: 7, B2: 2, C1: seed % 3, C2: 1 };
      expect(sampleFixedForm(synthetic, perLevel, mulberry32(seed), empty())).toEqual(legacy.sampleFixedForm(synthetic, perLevel, mulberry32(seed)));
    }
  });

  it("a fixed seed draws the ids 5a2260f drew", () => {
    // Printed by the code of 5a2260f for this pool, section and seed.
    expect(planFixedSection(pinnedSection, synthetic, "PLACEMENT", null, 0, mulberry32(2026))).toEqual(PINNED_PLAN);
    expect(planFixedSection(pinnedSection, synthetic, "PLACEMENT", null, 0, mulberry32(2026), empty())).toEqual(PINNED_PLAN);
    const plain = tasks.filter((t) => t.skillTag !== PICTURE_TASK_TAG);
    expect(pickProductive(plain, ["B1", "B1", "B2"], mulberry32(2026))).toEqual(PINNED_TASKS);
    expect(pickProductive(plain, ["B1", "B1", "B2"], mulberry32(2026), empty())).toEqual(PINNED_TASKS);
  });
});

const PINNED_PLAN = ["B1-c1", "B2-c0", "A2-s2", "A2-s3", "B1-s2", "B1-s4", "B1-s5", "B1-s6", "B2-s0", "B2-s5", "B2-s6"];
const PINNED_TASKS = ["talk-2", "talk-1", "plan-2"];

describe("a returning student", () => {
  const pool = synthetic;
  const singles = pool.filter((p) => !p.stimulusId && !isTextGap(p));
  const texts = pool.filter((p) => p.stimulusId);
  const want = (level: Cefr, n: number): Record<Cefr, number> => ({ A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, [level]: n });

  it("never draws a seen item while unseen ones remain", () => {
    const seen = ["B1-s0", "B1-s1", "B1-s2", "B1-s3", "B1-s4"];
    for (let seed = 1; seed <= 40; seed++) {
      const ids = sampleFixedForm(singles, want("B1", 3), mulberry32(seed), avoiding(seen));
      expect(ids.sort()).toEqual(["B1-s5", "B1-s6", "B1-s7"]);
    }
  });

  it("counts a whole text as seen when one of its questions was served, or when its stimulus is listed", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const byItem = sampleFixedForm(texts, want("A2", 3), mulberry32(seed), avoiding(["A2-x0-2", "A2-x1-1", "A2-x2-3"]));
      expect(byItem).toEqual(["A2-x3-1", "A2-x3-2", "A2-x3-3"]);
      const byStimulus = sampleFixedForm(texts, want("A2", 3), mulberry32(seed), avoiding([], ["A2-text0", "A2-text2", "A2-text3"]));
      expect(byStimulus).toEqual(["A2-x1-1", "A2-x1-2", "A2-x1-3"]);
    }
  });

  it("still fills the form when everything was seen, least served first", () => {
    const all = avoiding(pool.map((p) => p.id), pool.flatMap((p) => (p.stimulusId ? [p.stimulusId] : [])));
    for (let seed = 1; seed <= 40; seed++) {
      expect(sampleFixedForm(singles, want("C1", 3), mulberry32(seed), all).sort()).toEqual(["C1-s5", "C1-s6", "C1-s7"]);
      // Text 3 was served least (10 times), then text 2 (20).
      expect(sampleFixedForm(texts, want("C1", 6), mulberry32(seed), all).sort()).toEqual(
        ["C1-x2-1", "C1-x2-2", "C1-x2-3", "C1-x3-1", "C1-x3-2", "C1-x3-3"],
      );
    }
  });

  it("puts unseen units before stale ones, so a form short of fresh units is topped up", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ids = sampleFixedForm(singles, want("B2", 4), mulberry32(seed), avoiding(["B2-s0", "B2-s1", "B2-s2", "B2-s3", "B2-s4", "B2-s5"]));
      // Both unseen, then the two least served of the stale ones.
      expect(ids.sort()).toEqual(["B2-s4", "B2-s5", "B2-s6", "B2-s7"]);
    }
  });

  it("mixes formats among unseen units of a level", () => {
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 60; seed++) {
      const ids = sampleFixedForm(singles, want("B1", 2), mulberry32(seed), foreign());
      const types = ids.map((id) => pool.find((p) => p.id === id)!.type);
      expect(new Set(types).size).toBe(2);
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Still random: every item turns up.
    expect(counts.size).toBe(8);
  });

  it("opens with a text the student has not seen, else the least served one", () => {
    const s = { section: "GRAMMAR", texts: [{ level: "B1", kind: "CLOZE" }] } as SectionConfig;
    const cloze = (k: number, exposureCount: number): BankItem => ({
      id: `cloze-${k}`, level: "B1", b: thetaForLevel("B1"), skillTag: CLOZE_SKILL_TAG, stimulusId: null, orderInStimulus: 0, exposureCount,
    });
    const texts3 = [cloze(0, 5), cloze(1, 1), cloze(2, 9)];
    for (let seed = 1; seed <= 30; seed++) {
      expect(textOpenings(s, texts3, "PLACEMENT", null, mulberry32(seed), avoiding(["cloze-0", "cloze-1"]))).toEqual(["cloze-2"]);
      expect(textOpenings(s, texts3, "PLACEMENT", null, mulberry32(seed), avoiding(["cloze-0", "cloze-1", "cloze-2"]))).toEqual(["cloze-1"]);
    }
  });

  describe("writing and speaking tasks", () => {
    it("opens with a picture task and keeps it out of the second slot", () => {
      for (let seed = 1; seed <= 40; seed++) {
        const [first, second] = pickProductive(tasks, ["B1", "B1"], mulberry32(seed));
        expect(first.startsWith("pic-")).toBe(true);
        expect(second.startsWith("pic-")).toBe(false);
      }
    });

    it("falls back to any task when the level has no picture task, or only picture tasks", () => {
      expect(pickProductive(tasks, ["B2"], mulberry32(1))).toEqual(["plan-2"]);
      const onlyPictures = tasks.filter((t) => t.skillTag === PICTURE_TASK_TAG);
      expect(pickProductive(onlyPictures, ["B1", "B1"], mulberry32(1)).sort()).toEqual(["pic-1", "pic-2"]);
    });

    it("draws unseen tasks first and mixes skill-tag families", () => {
      const family = (id: string) => skillTagFamily(tasks.find((t) => t.id === id)!.skillTag);
      const firsts = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) {
        // Both picture tasks were seen: the opening falls back to the other tasks.
        const picks = pickProductive(tasks, ["B1", "B1"], mulberry32(seed), avoiding(["pic-1", "pic-2"]));
        expect(picks.some((id) => id.startsWith("pic-"))).toBe(false);
        // talk-1 and talk-2 differ in tag but share a family: never both.
        expect(new Set(picks.map(family)).size).toBe(2);
        firsts.add(picks[0]);
      }
      expect(firsts).toEqual(new Set(["talk-1", "talk-2", "plan-1"]));
    });

    it("takes an unseen picture task first, and the least served task when all were seen", () => {
      for (let seed = 1; seed <= 40; seed++) {
        const [first] = pickProductive(tasks, ["B1"], mulberry32(seed), avoiding(["pic-1"]));
        expect(first).toBe("pic-2");
        const everything = avoiding(tasks.map((t) => t.id));
        // Seen picture tasks: the less served one (pic-2), then the least served other task (talk-2).
        expect(pickProductive(tasks, ["B1", "B1"], mulberry32(seed), everything)).toEqual(["pic-2", "talk-2"]);
      }
    });
  });
});
