# onSET-style placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The placement exam measures grammar with six C-tests (one per level, A1 to C2) instead of multiple-choice items, the way onSET does, and each C-test counts in the estimate like a super-item instead of one question.

**Architecture:** A GRAMMAR section config gets an optional `cTestLevels` list; the plan serves one bank C-test per listed level, easy to hard, before any ordinary items. The Rasch/EAP estimate accepts a per-observation weight; a C-test weighs gaps / 4. A shared simulation module measures the old and new forms; the templates switch only after the simulation gate passes. Twelve new seed C-tests give three per level.

**Tech Stack:** Next.js (see `AGENTS.md`: read `node_modules/next/dist/docs/` before touching Next APIs), TypeScript, zod, vitest, Drizzle/Postgres, next-intl JSON messages (`src/i18n/messages/*.{tr,en}.json`).

**Spec:** `docs/superpowers/specs/2026-10-15-onset-placement-design.md`

## Global Constraints

- Never write the em-dash (U+2014) anywhere: code, comments, copy, docs. `bank-seed.test.ts` already fails on it in seed content.
- Code, identifiers, comments and commit messages in English. Candidate and manager UI copy in Turkish and English (both JSON files, same keys). Exam content in German, "Sie" register.
- Exam content is original. Nothing copied from Goethe, telc, onSET or publishers.
- Stored configs must stay valid: every new config field is optional; `cTest: true` keeps its meaning when `cTestLevels` is absent.
- No database migration. `cTestLevels` lives in the JSON config.
- C-test weight: `max(1, gaps / 4)`. A 20-gap text weighs 5.
- Simulation gate tolerance (4000 runs per level): new exact >= old exact - 0.02 and new within-one >= old within-one - 0.01, at every level A1 to C1.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `platform/solutions`.
- Commands: `pnpm typecheck`, `pnpm lint`, `pnpm test` (vitest run), single file `pnpm vitest run <path>`.
- Other Claude sessions may work in this repo. Do not run `pnpm db:seed` or `pnpm db:reset`. Before blaming your code for a Turbopack or tsc failure, run `pnpm typecheck` and check `git status` for someone else's half-written file.

## Review Focus

1. A school edits a placement exam created from the new template (changes minutes, toggles sections) and saves: `cTestLevels` must survive the editor round trip and the AI creator's rescale. Test: Task 5, `exam-config.test.ts` rescale cases, and the existing `actions.test.ts` GRAMMAR comparison extended with `cTestLevels`.
2. The bank has no C-test at one listed level (an org created before the top-up, or a retired text): the section must still start with the remaining texts, and the exam review must name the missing level. Test: Task 2, "skips a level with no C-test" for fixed and adaptive, and the coverage row per level.
3. A teacher changes one gap's score after the exam: the re-estimate must use the same C-test weight as the live close, or the level jumps. Test: Task 1 source guard (no raw `itemSnapshot.difficulty` observation left in `exam-flow.ts` or `reestimate-run.ts`).
4. A short AI-created placement exam (for example 20 minutes in all) gives GRAMMAR only a few minutes: six texts in 4 minutes is unusable. Test: Task 5, rescale trims `cTestLevels` to `floor(minutes / 5)`, at least one, keeping the middle levels.
5. A student reaches the GRAMMAR intro of a C-test-only section: it must say texts and minutes per text, not "0 questions" or "choose an option". Test: Task 2, `sectionIntroKind` unit test, and the Task 6 browser run.

---

### Task 1: Weighted observations in the estimate

**Files:**
- Modify: `src/lib/exam/adaptive.ts` (types at lines 19-20, `eap` at 70-89, `ReplayResponse` at 100-107, `replay` at 110-125)
- Modify: `src/lib/exam-flow.ts` (replay inputs near lines 660-668, 954-962, 1046-1054; observations near 1067-1070 and 1109-1112)
- Modify: `src/lib/exam/reestimate-run.ts` (lines 31-38, 47, 59)
- Test: `src/lib/exam/adaptive.test.ts`

**Interfaces:**
- Consumes: `ItemSnapshot`, `ItemContent`, `isCTest` from `src/lib/exam/types.ts`.
- Produces (exported from `src/lib/exam/adaptive.ts`):
  - `type Observation = { b: number; score: number; weight?: number }`
  - `type ReplayResponse` gains `weight?: number`
  - `const C_TEST_GAPS_PER_WEIGHT = 4`
  - `function itemWeight(item: { skillTag: string; content: ItemContent }): number`
  - `function observationOf(snapshot: Pick<ItemSnapshot, "difficulty" | "skillTag" | "content">, score: number): Observation`
  - `function replayResponseOf(r: { itemId: string; itemSnapshot: ItemSnapshot; score: number | null }): ReplayResponse`

- [ ] **Step 1: Write the failing tests** (append to `src/lib/exam/adaptive.test.ts`; add `itemWeight`, `observationOf`, `replayResponseOf` to the existing import from `./adaptive`, and add the two imports below at the top)

```ts
import { readFileSync } from "node:fs";
import { C_TEST_SKILL_TAG, type ItemSnapshot } from "./types";

describe("weighted observations", () => {
  const prior = { mean: 0, sd: 1.5 };
  const gapContent = (n: number) => ({ kind: "GAP" as const, gaps: Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}` })) });

  it("weight 1 is the same as no weight", () => {
    expect(eap([{ b: 0.5, score: 0.6, weight: 1 }], prior)).toEqual(eap([{ b: 0.5, score: 0.6 }], prior));
  });

  it("weight 5 is the same as five copies of the observation", () => {
    const one = eap([{ b: 0.5, score: 0.6, weight: 5 }], prior);
    const five = eap(Array.from({ length: 5 }, () => ({ b: 0.5, score: 0.6 })), prior);
    expect(one.mean).toBeCloseTo(five.mean, 10);
    expect(one.sd).toBeCloseTo(five.sd, 10);
  });

  it("a C-test weighs its gaps / 4, at least 1; every other item weighs 1", () => {
    expect(itemWeight({ skillTag: C_TEST_SKILL_TAG, content: gapContent(20) })).toBe(5);
    expect(itemWeight({ skillTag: C_TEST_SKILL_TAG, content: gapContent(18) })).toBe(4.5);
    expect(itemWeight({ skillTag: C_TEST_SKILL_TAG, content: gapContent(2) })).toBe(1);
    expect(itemWeight({ skillTag: "grammar.dativ", content: gapContent(20) })).toBe(1);
    expect(itemWeight({ skillTag: "grammar.dativ", content: { kind: "CHOICE", options: [] } })).toBe(1);
  });

  it("observationOf and replayResponseOf carry the snapshot's difficulty and weight", () => {
    const snapshot = { difficulty: -0.5, skillTag: C_TEST_SKILL_TAG, content: gapContent(20), stimulusId: null } as unknown as ItemSnapshot;
    expect(observationOf(snapshot, 0.7)).toEqual({ b: -0.5, score: 0.7, weight: 5 });
    expect(replayResponseOf({ itemId: "x", itemSnapshot: snapshot, score: 0.7 })).toEqual({
      itemId: "x", b: -0.5, skillTag: C_TEST_SKILL_TAG, stimulusId: null, score: 0.7, weight: 5,
    });
  });

  it("replay uses the weight", () => {
    const cfg = { minItems: 1, maxItems: 10, targetSe: 0.3, priorMean: 0, priorSd: 1.5, randomesque: 1 };
    const base = { itemId: "c", b: 0, skillTag: C_TEST_SKILL_TAG, stimulusId: null, score: 0.9 };
    const heavy = replay(cfg, [{ ...base, weight: 5 }]).posterior;
    const light = replay(cfg, [base]).posterior;
    expect(heavy.sd).toBeLessThan(light.sd);
    expect(heavy.mean).toBeGreaterThan(light.mean);
  });

  it("every estimate built from stored responses goes through observationOf or replayResponseOf", () => {
    for (const url of [new URL("../exam-flow.ts", import.meta.url), new URL("./reestimate-run.ts", import.meta.url)]) {
      expect(readFileSync(url, "utf8"), url.pathname).not.toMatch(/itemSnapshot\.difficulty/);
    }
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/lib/exam/adaptive.test.ts`
Expected: FAIL (`itemWeight` is not exported; the source guard finds `itemSnapshot.difficulty`).

- [ ] **Step 3: Implement in `src/lib/exam/adaptive.ts`**

Change the import and the `Observation` type:

```ts
import { isCTest, type ItemContent, type ItemSnapshot } from "./types";

export type Posterior = { mean: number; sd: number };
/** One scored item. `weight` is how many independent items it counts as (default 1). */
export type Observation = { b: number; score: number; weight?: number };
```

Inside `eap`, replace the loop body's last line so the term is weighted:

```ts
    for (const o of observations) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, pCorrect(theta, o.b)));
      const s = Math.min(1, Math.max(0, o.score));
      lp += (o.weight ?? 1) * (s * Math.log(p) + (1 - s) * Math.log(1 - p));
    }
```

Add `weight?: number;` to `ReplayResponse` with the comment `/** See Observation.weight. */`, and in `replay` map it through:

```ts
    posterior: eap(
      answered.map((r) => ({ b: r.b, score: r.score as number, weight: r.weight })),
      { mean: config.priorMean, sd: config.priorSd },
    ),
```

Add after `eap`:

```ts
/**
 * Gaps of one C-test text per unit of weight. Professionally a C-test text is
 * one "super-item" scored by its number of correct gaps (polytomous Rasch);
 * its gaps are not independent, so a 20-gap text is worth more than one item
 * and less than twenty. Five is an uncalibrated choice (spec 2026-10-15,
 * docs/EXAM-ENGINE.md) until a partial credit model is fitted to real data.
 */
export const C_TEST_GAPS_PER_WEIGHT = 4;

/** How many items one scored item counts as in the estimate. */
export function itemWeight(item: { skillTag: string; content: ItemContent }): number {
  if (!isCTest(item) || item.content.kind !== "GAP") return 1;
  return Math.max(1, item.content.gaps.length / C_TEST_GAPS_PER_WEIGHT);
}

/** The observation a stored, scored response adds to the estimate. */
export function observationOf(snapshot: Pick<ItemSnapshot, "difficulty" | "skillTag" | "content">, score: number): Observation {
  return { b: snapshot.difficulty, score, weight: itemWeight(snapshot) };
}

/** A stored response as `replay` reads it. */
export function replayResponseOf(r: { itemId: string; itemSnapshot: ItemSnapshot; score: number | null }): ReplayResponse {
  return {
    itemId: r.itemId,
    b: r.itemSnapshot.difficulty,
    skillTag: r.itemSnapshot.skillTag,
    stimulusId: r.itemSnapshot.stimulusId,
    score: r.score,
    weight: itemWeight(r.itemSnapshot),
  };
}
```

- [ ] **Step 4: Use the helpers at every call site**

In `src/lib/exam-flow.ts`, add `observationOf` and `replayResponseOf` to the existing import from `@/lib/exam/adaptive`. Then:
- Each `replay(cfg, xs.map((r) => ({ itemId: r.itemId, b: r.itemSnapshot.difficulty, skillTag: ..., stimulusId: ..., score: r.score })))` (three places: in the serve path near line 660 over `responses`, in `updateTheta` near 954 over `rows`, in the close path near 1046 over `all`) becomes `replay(cfg, xs.map(replayResponseOf))` with the same variable (`responses`, `rows`, `all`) and the same config variable (`cfg` or `acfg`).
- Near line 1067: `.map((r) => ({ b: r.itemSnapshot.difficulty, score: r.score as number }))` becomes `.map((r) => observationOf(r.itemSnapshot, r.score as number))`.
- In `writeTrajectory` near line 1111: `observations.push({ b: r.itemSnapshot.difficulty, score: r.score });` becomes `observations.push(observationOf(r.itemSnapshot, r.score));`.
- The padding observations `{ b: state.posterior.mean, score: 0 }` for unreached adaptive items stay as they are (weight 1).

In `src/lib/exam/reestimate-run.ts`, import `observationOf, replayResponseOf` from `@/lib/exam/adaptive` and make the same three changes (replay input at lines 31-38, observations at 47 and 59).

- [ ] **Step 5: Run the tests and typecheck**

Run: `pnpm vitest run src/lib/exam/adaptive.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Run the exam suite to catch regressions**

Run: `pnpm vitest run src/lib/exam src/lib/exam-flow`
Expected: PASS. A C-test now weighs more, so a test that asserted an exact posterior after a C-test may move; if one fails, check it asserted a number that depended on weight 1, update it to the weighted value and say so in the task report.

- [ ] **Step 7: Commit**

```bash
git add src/lib/exam/adaptive.ts src/lib/exam/adaptive.test.ts src/lib/exam-flow.ts src/lib/exam/reestimate-run.ts
git commit -m "Count a C-test as a weighted super-item in the ability estimate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `cTestLevels`: config, plan, coverage, intro

**Files:**
- Modify: `src/lib/exam/blueprint.ts` (schema lines 41-63 and `superRefine` 87-97; `cTestLevel`, `cTestOpening`, `planFixedSection`, `nextAdaptiveItems` lines 287-344; `bankCoverage` lines 456-461)
- Modify: `src/lib/exam-flow.ts` (import line 17, `SectionSummary` lines 150-161, `itemsLabel` lines 207-213, summary build lines 238-246)
- Modify: `src/components/candidate/exam/ExamRunner.tsx` (lines 537-553)
- Modify: `src/i18n/messages/candidate.tr.json`, `src/i18n/messages/candidate.en.json` (namespace `examNav`, next to `ruleGRAMMARFixed`)
- Modify: `src/i18n/messages/advanced.tr.json`, `src/i18n/messages/advanced.en.json` (`gapCTest`)
- Modify: `src/solutions/language-exam/create/exam.ts:99` (`C_TEST_NOTE`)
- Test: `src/lib/exam/blueprint.test.ts`

**Interfaces:**
- Consumes: `C_TEST_SKILL_TAG`, `isCTest`, `CEFR_LEVELS` from `./types`; `AdaptiveState.tagCounts` from `./adaptive`.
- Produces (exported from `src/lib/exam/blueprint.ts`):
  - `SectionConfig.cTestLevels?: Cefr[]`
  - `function cTestLevelsOf(s: SectionConfig, mode: ExamMode, claimed: Cefr | null): Cefr[]` (CEFR order; replaces `cTestLevel`, which is removed)
  - `function cTestOpenings(s: SectionConfig, pool: BankItem[], mode: ExamMode, claimed: Cefr | null, rng: () => number): string[]` (replaces `cTestOpening`, which is removed)
  - `function isCTestOnly(s: SectionConfig, mode: ExamMode, claimed: Cefr | null, difficultyOffset: number): boolean`
  - `SectionSummary.cTestOnly: boolean` in `src/lib/exam-flow.ts`

- [ ] **Step 1: Write the failing tests** (append to the C-test `describe` in `src/lib/exam/blueprint.test.ts`, which already defines `pool` with one `ctest-<level>` per level, `isC`, `adaptive`, `fixed`, `runAdaptive`; add `cTestLevelsOf`, `isCTestOnly` to the import from `./blueprint`)

```ts
  const listed = (levels: Cefr[], over: Partial<SectionConfig> = {}) =>
    section("GRAMMAR", 30, { distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } }, cTestLevels: levels, ...over });

  it("cTestLevels: schema accepts a GRAMMAR list, rejects repeats and other sections", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    const withLevels = (s: Partial<SectionConfig>, section = "GRAMMAR") =>
      ({ ...cfg, sections: cfg.sections.map((x) => (x.section === section ? { ...x, ...s } : x)) });
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: ["A1", "B1"] })).success).toBe(true);
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: ["B1", "B1"] })).success).toBe(false);
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: [] })).success).toBe(false);
    expect(blueprintConfigSchema.safeParse(withLevels({ cTestLevels: ["B1"] }, "READING")).success).toBe(false);
  });

  it("cTestLevelsOf: the list in CEFR order; else the anchor when cTest is on; else none", () => {
    expect(cTestLevelsOf(listed(["C2", "A1", "B1"]), "PLACEMENT", null)).toEqual(["A1", "B1", "C2"]);
    expect(cTestLevelsOf(listed(["A2"], { cTest: true }), "LEVEL_VERIFICATION", "C1")).toEqual(["A2"]);
    expect(cTestLevelsOf(fixed(true), "LEVEL_VERIFICATION", "C1")).toEqual(["C1"]);
    expect(cTestLevelsOf(fixed(false), "PLACEMENT", null)).toEqual([]);
    const reading = section("READING", 12, { cTestLevels: ["B1"] });
    expect(cTestLevelsOf(reading, "PLACEMENT", null)).toEqual([]);
  });

  it("fixed form with cTestLevels: one C-test per level, easy to hard, then the form", () => {
    const all = ["A1", "A2", "B1", "B2", "C1", "C2"] as Cefr[];
    const ids = planFixedSection(listed(all), pool, "PLACEMENT", null, 0, mulberry32(7));
    expect(ids).toEqual(all.map((l) => `ctest-${l}`));
    const mixed = planFixedSection(listed(["B1", "A2"], { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 } }), pool, "PLACEMENT", null, 0, mulberry32(7));
    expect(mixed.slice(0, 2)).toEqual(["ctest-A2", "ctest-B1"]);
    expect(mixed.slice(2).filter(isC)).toEqual([]);
    expect(mixed.length).toBe(14);
  });

  it("fixed form skips a level with no C-test in the bank", () => {
    const noB2 = pool.filter((p) => p.id !== "ctest-B2");
    expect(planFixedSection(listed(["B1", "B2", "C1"]), noB2, "PLACEMENT", null, 0, mulberry32(3))).toEqual(["ctest-B1", "ctest-C1"]);
  });

  it("adaptive with cTestLevels: the listed C-tests first, in order, then never another", () => {
    const s = listed(["A2", "B1", "B2"], { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45 });
    for (let seed = 1; seed <= 10; seed++) {
      const ids = runAdaptive(s, "PLACEMENT", null, seed);
      expect(ids.slice(0, 3)).toEqual(["ctest-A2", "ctest-B1", "ctest-B2"]);
      expect(ids.slice(3).filter(isC)).toEqual([]);
    }
  });

  it("adaptive skips a level with no C-test in the bank", () => {
    const noB1 = pool.filter((p) => p.id !== "ctest-B1");
    const s = listed(["A2", "B1", "B2"], { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45 });
    const cfg = adaptiveConfigFor(s, "PLACEMENT", null);
    const rng = mulberry32(1);
    const responses: ReplayResponse[] = [];
    const served: string[] = [];
    for (let k = 0; k < 3; k++) {
      const next = nextAdaptiveItems(s, "PLACEMENT", null, replay(cfg, responses), noB1, cfg, rng)!;
      const id = next.itemIds[0];
      served.push(id);
      const item = noB1.find((p) => p.id === id)!;
      responses.push({ itemId: id, b: item.b, skillTag: item.skillTag, stimulusId: null, score: 0.5 });
    }
    expect(served.slice(0, 2)).toEqual(["ctest-A2", "ctest-B2"]);
    expect(isC(served[2])).toBe(false);
  });

  it("isCTestOnly: a fixed GRAMMAR section with C-tests and no ordinary items", () => {
    expect(isCTestOnly(listed(["B1"]), "PLACEMENT", null, 0)).toBe(true);
    expect(isCTestOnly(listed(["B1"], { distribution: { kind: "RELATIVE", below: 0, at: 1, above: 0 } }), "PLACEMENT", null, 0)).toBe(false);
    expect(isCTestOnly(listed(["B1"], { adaptive: true }), "PLACEMENT", null, 0)).toBe(false);
    expect(isCTestOnly(fixed(false), "PLACEMENT", null, 0)).toBe(false);
  });
```

Append to the `describe("C-test coverage")` block:

```ts
  it("cTestLevels: one coverage row per listed level", () => {
    const cfg = defaultBlueprint("PLACEMENT");
    cfg.sections = cfg.sections.map((s) => (s.section === "GRAMMAR" ? { ...s, cTestLevels: ["A2", "B1", "B2"] as Cefr[] } : s));
    expect(cRows(bankCoverage(full, cfg, "PLACEMENT", null).rows).map((r) => r.level)).toEqual(["A2", "B1", "B2"]);
    const noB1 = full.map((c) => (c.section === "GRAMMAR" && c.level === "B1" ? { ...c, cTests: 0 } : c));
    const res = bankCoverage(noB1, cfg, "PLACEMENT", null);
    expect(res.ok).toBe(false);
    expect(cRows(res.rows).filter((r) => !r.ok).map((r) => r.level)).toEqual(["B1"]);
  });
```

Add `type SectionConfig` to the `./blueprint` import if it is not there.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/lib/exam/blueprint.test.ts`
Expected: FAIL (`cTestLevelsOf` is not exported).

- [ ] **Step 3: Schema in `src/lib/exam/blueprint.ts`**

After the `cTest` field add:

```ts
  /**
   * GRAMMAR only: one C-test per listed level, easy to hard, before the
   * section's ordinary items (the onSET shape, spec 2026-10-15). Replaces
   * `cTest` when present. Optional so stored configs stay valid.
   */
  cTestLevels: z.array(z.enum(CEFR_LEVELS)).min(1).max(CEFR_LEVELS.length).optional(),
```

Inside the `superRefine` loop, after the `minItems` check, add:

```ts
      if (s.cTestLevels) {
        if (s.section !== "GRAMMAR") ctx.addIssue({ code: "custom", message: `${s.section}: cTestLevels is for GRAMMAR only` });
        if (new Set(s.cTestLevels).size !== s.cTestLevels.length)
          ctx.addIssue({ code: "custom", message: `${s.section}: cTestLevels repeats a level` });
      }
```

- [ ] **Step 4: Plan functions in `src/lib/exam/blueprint.ts`**

Add `C_TEST_SKILL_TAG` to the `./types` import. Replace `cTestLevel` and `cTestOpening` (lines 287-310) with:

```ts
/** The levels of the section's C-tests, easy to hard; empty when it has none. */
export function cTestLevelsOf(s: SectionConfig, mode: ExamMode, claimed: Cefr | null): Cefr[] {
  if (s.section !== "GRAMMAR") return [];
  if (s.cTestLevels) return CEFR_LEVELS.filter((l) => s.cTestLevels!.includes(l));
  return s.cTest ? [anchorLevel(mode, claimed)] : [];
}

/**
 * The C-tests that open the section: one per level of `cTestLevelsOf`, picked
 * at random when the bank has several, easy to hard. A level the bank has no
 * C-test for is skipped (the section then runs without it).
 */
export function cTestOpenings(
  s: SectionConfig,
  pool: BankItem[],
  mode: ExamMode,
  claimed: Cefr | null,
  rng: () => number,
): string[] {
  const ids: string[] = [];
  for (const level of cTestLevelsOf(s, mode, claimed)) {
    const candidates = pool.filter((i) => isCTest(i) && i.level === level);
    if (candidates.length > 0) ids.push(candidates[Math.floor(rng() * candidates.length)].id);
  }
  return ids;
}

/** A fixed GRAMMAR section made only of C-tests: the intro speaks of texts. */
export function isCTestOnly(s: SectionConfig, mode: ExamMode, claimed: Cefr | null, difficultyOffset: number): boolean {
  if (s.adaptive || cTestLevelsOf(s, mode, claimed).length === 0) return false;
  return Object.values(resolveDistribution(s, mode, claimed, difficultyOffset)).every((n) => n === 0);
}
```

In `planFixedSection` replace the body with:

```ts
  const openings = cTestOpenings(s, pool, mode, claimed, rng);
  const form = sampleFixedForm(pool, resolveDistribution(s, mode, claimed, difficultyOffset), rng);
  return [...openings, ...form];
```

and update its doc comment to "The item plan of a fixed objective section: its C-tests, if any, then the form."

In `nextAdaptiveItems` replace the opening block with:

```ts
  // The listed C-tests come first, one per call, in level order; the engine
  // never picks one. Served C-tests are counted by skill tag, so a reload
  // continues where the student was.
  const levels = cTestLevelsOf(s, mode, claimed).filter((l) => pool.some((i) => isCTest(i) && i.level === l));
  const served = state.tagCounts[C_TEST_SKILL_TAG] ?? 0;
  if (served < levels.length) {
    const candidates = pool.filter((i) => isCTest(i) && i.level === levels[served] && !state.usedItemIds.includes(i.id));
    if (candidates.length > 0) return { itemIds: [candidates[Math.floor(rng() * candidates.length)].id] };
  }
  return selectNext(state, pool, config, rng);
```

and update its doc comment: "The first units are the section's C-tests (cTestLevelsOf), one at a time; their partial credit is then the first observations of the estimate."

In `bankCoverage` replace the `cTestLevels` set line with:

```ts
    const cTestLevels = new Set(claims.flatMap((claim) => cTestLevelsOf(s, mode, claim)));
```

Update the `CoverageRow.cTest` comment to "This row is one of the section's C-tests, not its ordinary items."

- [ ] **Step 5: Run the blueprint tests**

Run: `pnpm vitest run src/lib/exam/blueprint.test.ts`
Expected: PASS, including every older C-test test (the single `cTest: true` behaviour is unchanged).

- [ ] **Step 6: Section summary and label in `src/lib/exam-flow.ts`**

In the import from `@/lib/exam/blueprint` replace `cTestLevel` with `cTestLevelsOf, isCTestOnly`. In `itemsLabel`:

```ts
  const openings = cTestLevelsOf(s, mode, claimed).length;
  return String(Object.values(dist).reduce((a, b) => a + b, 0) + openings);
```

Add to `SectionSummary` after `navigable`:

```ts
  /** GRAMMAR made only of C-tests: the intro counts texts, not questions. */
  cTestOnly: boolean;
```

and in the summary build after `navigable: isNavigableConfig(s),`:

```ts
      cTestOnly: isCTestOnly(s, ctx.assessment.mode, ctx.assessment.claimedLevel, cfg.difficultyOffset),
```

Run `pnpm typecheck`; if another place builds a `SectionSummary` literal, set `cTestOnly` there the same way.

- [ ] **Step 7: Candidate intro**

In `src/i18n/messages/candidate.tr.json`, namespace `examNav`, after `ruleGRAMMARFixed`:

```json
    "ruleGRAMMARCTest": "{n} kısa metin, kolaydan zora. Her metinde bazı kelimelerin ikinci yarısı eksik; yalnız eksik harfleri yazın. Metin başına yaklaşık {minutes} dakika.",
    "texts": "{n} metin",
```

In `src/i18n/messages/candidate.en.json`, same place:

```json
    "ruleGRAMMARCTest": "{n} short texts, from easier to harder. In each text the second half of some words is missing; type only the missing letters. About {minutes} minutes per text.",
    "texts": "{n} texts",
```

In `src/components/candidate/exam/ExamRunner.tsx`, in the intro block (lines 537-553), make the count and the first rule depend on `s.cTestOnly`:

```tsx
              const count = s.itemsLabel.includes("-")
                ? t("itemsAdaptive", { range: s.itemsLabel })
                : cur.section === "WRITING" || cur.section === "SPEAKING"
                  ? t("tasks", { n: s.itemsLabel })
                  : s.cTestOnly
                    ? n("texts", { n: s.itemsLabel })
                    : t("items", { n: s.itemsLabel });
```

```tsx
                    <li>
                      {s.cTestOnly
                        ? n("ruleGRAMMARCTest", { n: s.itemsLabel, minutes: Math.max(1, Math.round(s.minutes / Number(s.itemsLabel))) })
                        : s.navigable && cur.section === "GRAMMAR"
                          ? n("ruleGRAMMARFixed")
                          : cur.section === "WRITING"
                            ? f(policy.clipboardBlock ? "ruleWritingPaste" : "ruleWritingPlain")
                            : sec(`rule${cur.section}` as "ruleGRAMMAR", { plays: state.maxPlays })}
                    </li>
```

If `n`'s type does not accept the new keys, the JSON edit above is in the wrong namespace: find the namespace `n` is bound to (`useTranslations(...)` near the top of `ExamRunner.tsx`) and put both keys there.

- [ ] **Step 8: Manager copy for missing C-tests**

`src/i18n/messages/advanced.tr.json` `gapCTest`: `"{level} dilbilgisi: C-test yok"`. `advanced.en.json` `gapCTest`: `"{level} grammar: no C-test"`.
`src/solutions/language-exam/create/exam.ts:99`: `text("C-testleri AI üretmez; soru bankasından ekle.", "AI does not write C-tests; add them in the question bank.")`.

- [ ] **Step 9: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/lib/exam src/solutions/language-exam src/app`
Expected: PASS.

```bash
git add src/lib/exam/blueprint.ts src/lib/exam/blueprint.test.ts src/lib/exam-flow.ts src/components/candidate/exam/ExamRunner.tsx src/i18n/messages/candidate.tr.json src/i18n/messages/candidate.en.json src/i18n/messages/advanced.tr.json src/i18n/messages/advanced.en.json src/solutions/language-exam/create/exam.ts
git commit -m "Let a grammar section open with one C-test per listed level

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Form simulation module and the gate script

**Files:**
- Create: `src/lib/exam/form-simulation.ts`
- Create: `src/lib/exam/form-simulation.test.ts`
- Create: `scripts/simulate-placement.ts`

**Interfaces:**
- Consumes: `eap`, `mulberry32`, `pCorrect`, `Observation` (Task 1); `cTestLevelsOf` (Task 2); `adaptiveConfigFor`, `enabledSections`, `resolveDistribution`, `section`, `BlueprintConfig` from `./blueprint`; `BAND_CENTER`, `levelFromTheta`, `thetaForLevel` from `./cefr`; `poolPosteriors` from `./result`; `examTemplateByKey` from `./templates`.
- Produces:
  - `type SimulationOptions = { runs: number; seed: number; cTestGaps: number; cTestWeight: number; textEffectSd: number }`
  - `type FormAccuracy = Record<Cefr, { exact: number; withinOne: number }>`
  - `function simulateFixedForm(config: BlueprintConfig, mode: ExamMode, o: SimulationOptions): FormAccuracy`

- [ ] **Step 1: Write the failing test** (`src/lib/exam/form-simulation.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { section, type BlueprintConfig } from "./blueprint";
import { simulateFixedForm } from "./form-simulation";
import { examTemplateByKey } from "./templates";
import { CEFR_LEVELS } from "./types";

const opts = { runs: 300, seed: 11, cTestGaps: 20, cTestWeight: 5, textEffectSd: 0.5 };
const NONE = { kind: "ABSOLUTE" as const, perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } };
const grammarOnly = (grammar: BlueprintConfig["sections"][number]): BlueprintConfig => ({
  ...examTemplateByKey("quick-screen")!.config,
  sections: [grammar],
});

describe("simulateFixedForm", () => {
  it("returns a share per level between 0 and 1, within-one never below exact", () => {
    const acc = simulateFixedForm(grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: [...CEFR_LEVELS] })), "PLACEMENT", opts);
    for (const l of CEFR_LEVELS) {
      expect(acc[l].exact).toBeGreaterThanOrEqual(0);
      expect(acc[l].withinOne).toBeLessThanOrEqual(1);
      expect(acc[l].withinOne).toBeGreaterThanOrEqual(acc[l].exact);
    }
  });

  it("is deterministic for a seed", () => {
    const cfg = grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: ["A2", "B1", "B2"] }));
    expect(simulateFixedForm(cfg, "PLACEMENT", opts)).toEqual(simulateFixedForm(cfg, "PLACEMENT", opts));
  });

  it("six weighted C-tests place better than one unweighted C-test alone", () => {
    const six = simulateFixedForm(grammarOnly(section("GRAMMAR", 30, { distribution: NONE, cTestLevels: [...CEFR_LEVELS] })), "PLACEMENT", opts);
    const one = simulateFixedForm(grammarOnly(section("GRAMMAR", 5, { distribution: NONE, cTestLevels: ["B1"] })), "PLACEMENT", { ...opts, cTestWeight: 1 });
    const mean = (a: typeof six) => CEFR_LEVELS.reduce((s, l) => s + a[l].exact, 0) / CEFR_LEVELS.length;
    expect(mean(six)).toBeGreaterThan(mean(one));
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/lib/exam/form-simulation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/exam/form-simulation.ts`**

```ts
import { eap, mulberry32, pCorrect, type Observation } from "./adaptive";
import { adaptiveConfigFor, cTestLevelsOf, enabledSections, resolveDistribution, type BlueprintConfig } from "./blueprint";
import { BAND_CENTER, levelFromTheta, thetaForLevel } from "./cefr";
import { poolPosteriors } from "./result";
import { CEFR_LEVELS, isObjectiveSection, type Cefr, type ExamMode } from "./types";

/**
 * Simulated students of known level take a fixed form; the result is how
 * often the pooled objective level is exactly right and within one level.
 * Rasch model only. Reading and listening testlet dependence is ignored, as
 * in docs/EXAM-ENGINE.md; C-test gap dependence is not: the gaps of one text
 * share a random effect, so twenty gaps do not pass for twenty items.
 */

export type SimulationOptions = {
  runs: number;
  seed: number;
  /** Gaps per simulated C-test text. */
  cTestGaps: number;
  /** Weight the estimate gives one C-test (1 before 2026-10-15, gaps / 4 after). */
  cTestWeight: number;
  /** Sd in logits of the per-text effect shared by the gaps of one text. */
  textEffectSd: number;
};

export type FormAccuracy = Record<Cefr, { exact: number; withinOne: number }>;

function normal(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function simulateFixedForm(config: BlueprintConfig, mode: ExamMode, o: SimulationOptions): FormAccuracy {
  const rng = mulberry32(o.seed);
  const within = ["EASY", "MID", "HARD"] as const;
  const objective = enabledSections(config).filter((s) => isObjectiveSection(s.section));
  const out = {} as FormAccuracy;
  for (const level of CEFR_LEVELS) {
    let exact = 0;
    let withinOne = 0;
    for (let r = 0; r < o.runs; r++) {
      // Spread across the band, not only its centre.
      const theta = BAND_CENTER[level] - 0.5 + rng();
      const posteriors = objective.map((s) => {
        const cfg = adaptiveConfigFor(s, mode, null);
        const dist = resolveDistribution(s, mode, null, config.difficultyOffset);
        const observations: Observation[] = CEFR_LEVELS.flatMap((l) =>
          Array.from({ length: dist[l] }, () => {
            const b = thetaForLevel(l, within[Math.floor(rng() * 3)]);
            return { b, score: rng() < pCorrect(theta, b) ? 1 : 0 };
          }),
        );
        for (const l of cTestLevelsOf(s, mode, null)) {
          const b = thetaForLevel(l);
          const onThisText = theta + o.textEffectSd * normal(rng);
          let right = 0;
          for (let g = 0; g < o.cTestGaps; g++) right += rng() < pCorrect(onThisText, b) ? 1 : 0;
          observations.push({ b, score: right / o.cTestGaps, weight: o.cTestWeight });
        }
        return eap(observations, { mean: cfg.priorMean, sd: cfg.priorSd });
      });
      const got = levelFromTheta(poolPosteriors(posteriors)!.mean).level;
      const diff = Math.abs(CEFR_LEVELS.indexOf(got) - CEFR_LEVELS.indexOf(level));
      if (diff === 0) exact++;
      if (diff <= 1) withinOne++;
    }
    out[level] = { exact: exact / o.runs, withinOne: withinOne / o.runs };
  }
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/exam/form-simulation.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/simulate-placement.ts`**

The "before" and "after" GRAMMAR sections are written out here, not read from the templates, so the script gives the same answer before and after Task 5.

```ts
/**
 * Gate for the onSET-style placement (spec 2026-10-15, section 7 and 8):
 * today's forms against the C-test forms, same simulated students.
 * Run: pnpm tsx scripts/simulate-placement.ts
 */
import { section, type BlueprintConfig, type SectionConfig } from "@/lib/exam/blueprint";
import { simulateFixedForm, type FormAccuracy } from "@/lib/exam/form-simulation";
import { examTemplateByKey } from "@/lib/exam/templates";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";

const per = (counts: Partial<Record<Cefr, number>>) => ({
  kind: "ABSOLUTE" as const,
  perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, ...counts },
});
const withGrammar = (key: "placement" | "quick-screen", grammar: SectionConfig): BlueprintConfig => {
  const cfg = structuredClone(examTemplateByKey(key)!.config);
  cfg.sections = cfg.sections.map((s) => (s.section === "GRAMMAR" ? grammar : s));
  return cfg;
};

const RUNS = 4000;
const base = { runs: RUNS, seed: 2026, cTestGaps: 20, textEffectSd: 0.5 };
const forms = {
  placementBefore: [withGrammar("placement", section("GRAMMAR", 17, { distribution: per({ A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 }), cTest: true })), 1],
  placementAfter: [withGrammar("placement", section("GRAMMAR", 30, { distribution: per({}), cTestLevels: [...CEFR_LEVELS] })), 5],
  quickBefore: [withGrammar("quick-screen", section("GRAMMAR", 15, { distribution: per({ A1: 4, A2: 4, B1: 4, B2: 4, C1: 4, C2: 4 }), cTest: false })), 1],
  quickAfter: [withGrammar("quick-screen", section("GRAMMAR", 15, { distribution: per({}), cTestLevels: ["A2", "B1", "B2"] })), 5],
} as const;

const results = Object.fromEntries(
  Object.entries(forms).map(([name, [cfg, weight]]) => [name, simulateFixedForm(cfg, "PLACEMENT", { ...base, cTestWeight: weight })]),
) as Record<keyof typeof forms, FormAccuracy>;

const pct = (x: number) => `${Math.round(x * 100)}%`;
for (const [name, acc] of Object.entries(results)) {
  console.log(name.padEnd(16), CEFR_LEVELS.map((l) => `${l} ${pct(acc[l].exact)}/${pct(acc[l].withinOne)}`).join("  "));
}

const gate = (before: FormAccuracy, after: FormAccuracy) =>
  (["A1", "A2", "B1", "B2", "C1"] as Cefr[]).every(
    (l) => after[l].exact >= before[l].exact - 0.02 && after[l].withinOne >= before[l].withinOne - 0.01,
  );
console.log(`placement gate: ${gate(results.placementBefore, results.placementAfter) ? "PASS" : "FAIL"}`);
console.log(`quick-screen gate: ${gate(results.quickBefore, results.quickAfter) ? "PASS" : "FAIL"}`);
```

- [ ] **Step 6: Run the script and record the output**

Run: `pnpm tsx scripts/simulate-placement.ts`
Expected: four rows of "exact/within-one" per level and two gate lines. Copy the full output into the task report. It decides Task 5: a FAIL on placement stops the plan (report to the controller, do not change the template); a FAIL on quick screen means the quick screen stays as it is.

- [ ] **Step 7: Commit**

```bash
git add src/lib/exam/form-simulation.ts src/lib/exam/form-simulation.test.ts scripts/simulate-placement.ts
git commit -m "Add a fixed-form placement simulation and the C-test gate script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Twelve new seed C-tests

**Files:**
- Modify: `src/db/seed-bank/levels/a1.ts` (C-test at line 195), `a2.ts` (184 and 888), `b1.ts` (210), `b2.ts` (217 and 230), `c1.ts` (224), `c2.ts` (209)
- Modify: `src/db/seed-bank/bank-seed.test.ts` (lines 44-55; the `ctest` finder at 59)
- Modify: each level file's header comment where it states the grammar count ("plus one C-test")

**Interfaces:**
- Consumes: `cTest(level, within, { first, body, last, variants? })` from `src/db/seed-bank/ctest.ts` (unchanged).
- Produces: three items per level with `skillTag === "grammar.ctest"`; the existing one stays first in each level's grammar list.

**Content rules** (spec section 6 and `docs/EXAM-BANK-RESEARCH.md` section 2.7 and 3):
- `first` and `last` are complete sentences. `body` yields 18 to 20 gaps: the builder damages every second counted word (two letters or more, no digits) of `body`, so `body` needs about 36 to 40 counted words.
- Vocabulary and structures at the level (A1: present tense, everyday words; C2: dense nominal style, subjunctive, rare connectors).
- Topics: not work. The cohort feedback was that B1-C2 content is too work-heavy for teenagers. Use these, one text each:
  - A1: (1) a family weekend at the lake, (2) shopping at the market for a birthday
  - A2: (1) moving into a new flat with a friend, (2) a day trip by train that went wrong
  - B1: (1) joining a sports club, (2) cycling in the city
  - B2: (1) friendship and social media, (2) volunteering in the neighbourhood
  - C1: (1) why teenagers sleep too little, (2) urban gardens
  - C2: (1) how memory distorts what we remember, (2) dialects and identity
- Neutral, no upsetting topics, no German culture trivia, names of diverse origin.
- `within: "MID"` for all twelve.
- Every gap must have exactly the completions a teacher would accept. Where a different completion is equally correct in context, list it in `variants` (1-based gap number, the missing part only), with a comment naming the word, as in `b2.ts:224-227`.

- [ ] **Step 1: Update the seed test first**

In `src/db/seed-bank/bank-seed.test.ts` replace the "grammar has one C-test" test with:

```ts
    it(`${level}: grammar has three C-tests with 15 to 20 typed gaps and distinct texts`, () => {
      const ctests = SEED_BANK.items.filter((i) => i.level === level && i.skillTag === "grammar.ctest");
      expect(ctests).toHaveLength(3);
      expect(new Set(ctests.map((c) => c.prompt)).size).toBe(3);
      for (const c of ctests) {
        expect(c.section).toBe("GRAMMAR");
        expect(c.type).toBe("GAP_FILL");
        if (c.content.kind !== "GAP") throw new Error("not a gap item");
        expect(c.content.gaps.length).toBeGreaterThanOrEqual(15);
        expect(c.content.gaps.length).toBeLessThanOrEqual(20);
        expect(c.content.gaps.every((g) => !g.choices)).toBe(true);
      }
    });
```

The `ctest(level)` finder at line 59 uses `find`, which returns the first C-test of the level; keep each existing C-test first in its level's list so those acceptance tests still point at the same text.

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run src/db/seed-bank/bank-seed.test.ts`
Expected: FAIL, 1 C-test per level found, 3 expected.

- [ ] **Step 3: Write the two new C-tests in each level file**

Add them right after the existing C-test of the level, with the same `cTest(LEVEL, "MID", { ... })` call shape the file already uses. Where a file holds its C-test in a const (`a2.ts`, `b2.ts`), add `grammarCTest2` and `grammarCTest3` and list them after `grammarCTest` in the `grammar` part (`a2.ts:888`, `b2.ts:230`). Update the file header comment's C-test count.

- [ ] **Step 4: Run the seed tests**

Run: `pnpm vitest run src/db/seed-bank`
Expected: PASS (counts, keys, no em-dash, seed keys unique).

- [ ] **Step 5: Blind solve review**

For each of the twelve new texts, print the damaged prompt without the key:

```bash
pnpm tsx -e 'import { SEED_BANK } from "@/db/seed-bank"; for (const l of ["A1","A2","B1","B2","C1","C2"]) { const cs = SEED_BANK.items.filter((i) => i.level === l && i.skillTag === "grammar.ctest").slice(1); for (const c of cs) console.log(`\n== ${l}\n${c.prompt}`); }'
```

Solve every gap yourself without looking at the source, writing down every completion that is grammatical and fits the context. Compare with the key. For each difference either add the completion to `variants` (with a comment) or, if the text is ambiguous in a way variants cannot fix, reword the sentence. Put the comparison (gap, key, other accepted forms, decision) in the task report.

- [ ] **Step 6: Run the seed tests again and commit**

Run: `pnpm vitest run src/db/seed-bank`
Expected: PASS.

```bash
git add src/db/seed-bank/levels src/db/seed-bank/bank-seed.test.ts
git commit -m "Add two C-tests per level to the starter bank

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Switch the templates

**Precondition:** the Task 3 script printed `placement gate: PASS`. If the quick-screen gate printed FAIL, skip every quick-screen step below and leave that template as it is.

**Files:**
- Modify: `src/lib/exam/templates.ts` (header comment lines 6-32, constants 35-45, quick-screen 63-87, placement 89-116)
- Modify: `src/lib/exam/templates.test.ts` (placement shape test at 84-100, coverage test at 133-140, simulation test at 154-194)
- Modify: `src/solutions/language-exam/create/exam-config.ts` (`rescaleSection` at 72-91)
- Modify: `src/solutions/language-exam/create/exam-config.test.ts`
- Modify: `src/app/(manager)/exam/exams/actions.test.ts:98-99`
- Modify: `src/lib/exam/blueprint.ts` (`defaultBlueprint` doc comment only)
- Modify: `src/i18n/messages/screens.tr.json`, `screens.en.json` (`forWhomQuick`, only if the quick screen changes)

**Interfaces:**
- Consumes: `cTestLevels` (Task 2), `simulateFixedForm` (Task 3), seed C-tests (Task 4).
- Produces: templates `placement` and (if gated in) `quick-screen` with C-test GRAMMAR sections; `MINUTES_PER_C_TEST = 5` in `exam-config.ts`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/exam/templates.test.ts`, change the placement shape test so GRAMMAR is expected as:

```ts
    expect(sectionOf("placement", "GRAMMAR")).toMatchObject({
      adaptive: false,
      durationMinutes: 30,
      distribution: { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } },
      cTestLevels: ["A1", "A2", "B1", "B2", "C1", "C2"],
    });
    expect(estimatedMinutes(byKey("placement").config)).toBe(77);
```

(adapt to the helper names the test file already uses: `sectionOf`, `byKey`; keep its other assertions for READING to SPEAKING). Replace the "placement's coverage asks for the B1 C-test and nothing else" test with:

```ts
  it("placement's coverage asks for one C-test at every level, and the seed bank has them", () => {
    const t = byKey("placement");
    const rows = bankCoverage(seedCounts(), t.config, t.mode, null).rows.filter((r) => r.cTest);
    expect(rows.map((r) => r.level)).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    expect(rows.every((r) => r.ok)).toBe(true);
  });
```

Replace the body of the simulation test with the shared module (same thresholds as today):

```ts
    const acc = simulateFixedForm(byKey("placement").config, "PLACEMENT", { runs: 300, seed: 2026, cTestGaps: 20, cTestWeight: 5, textEffectSd: 0.5 });
    for (const level of CEFR_LEVELS) {
      expect(acc[level].withinOne, `${level} within one`).toBeGreaterThanOrEqual(0.95);
      // C2 sits above the top text of the reading form; it is exact less often.
      expect(acc[level].exact, `${level} exact`).toBeGreaterThanOrEqual(level === "C2" ? 0.25 : 0.5);
    }
```

and import `simulateFixedForm` from `./form-simulation`; drop imports that become unused.

If the quick screen changes, add:

```ts
  it("quick screen: three C-tests A2 to B2 in 15 minutes", () => {
    expect(sectionOf("quick-screen", "GRAMMAR")).toMatchObject({ durationMinutes: 15, cTestLevels: ["A2", "B1", "B2"] });
    expect(Object.values(resolveDistribution(sectionOf("quick-screen", "GRAMMAR"), "PLACEMENT", null, 0)).every((n) => n === 0)).toBe(true);
  });
```

In `src/solutions/language-exam/create/exam-config.test.ts` add:

```ts
describe("C-test sections follow the minutes", () => {
  const grammarOf = (target: number) =>
    buildExamConfig(shape({ skills: ["GRAMMAR"], targetMinutes: target })).config.sections.find((s) => s.section === "GRAMMAR")!;

  it("keeps the middle levels, five minutes a text, at least one", () => {
    // A GRAMMAR-only placement shape picks whichever template fits; force the placement one's GRAMMAR by checking only when it has cTestLevels.
    for (const [target, levels] of [
      [30, ["A1", "A2", "B1", "B2", "C1", "C2"]],
      [15, ["A2", "B1", "B2"]],
      [10, ["B1", "B2"]],
    ] as const) {
      const g = grammarOf(target);
      if (g.cTestLevels) expect(g.cTestLevels, `${target} min`).toEqual(levels);
    }
  });
});
```

If `shape({ skills: ["GRAMMAR"] })` resolves to a template without `cTestLevels` (the quick screen when it did not change), the `if` makes that case vacuous; then add a direct case that builds `shape({ skills: ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"], targetMinutes: 40 })` (placement template, GRAMMAR gets fewer than 30 minutes) and asserts `cTestLevels.length === Math.max(1, Math.floor(g.durationMinutes / 5))` and that the kept levels are contiguous and centred (for 6 listed: start index `Math.floor((6 - kept) / 2)`).

In `src/app/(manager)/exam/exams/actions.test.ts:98-99`, add `cTestLevels` to both the destructuring and the `toMatchObject`.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run src/lib/exam/templates.test.ts src/solutions/language-exam/create/exam-config.test.ts`
Expected: FAIL (template still has 17 minutes and `cTest: true`).

- [ ] **Step 3: Templates**

In `src/lib/exam/templates.ts`, add next to the other constants:

```ts
/** No ordinary items: the section is its C-tests. */
const NO_ITEMS = perLevel({});
/** One C-test per level, easy to hard: the onSET shape (spec 2026-10-15). */
const C_TESTS_A1_C2: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
```

Remove `GRAMMAR_SPREAD` if nothing else uses it. Placement GRAMMAR:

```ts
        // Six C-tests, A1 to C2, about five minutes each (onSET: eight texts, five minutes each).
        section("GRAMMAR", 30, { distribution: NO_ITEMS, cTestLevels: [...C_TESTS_A1_C2], minItems: 10, maxItems: 16, targetSe: 0.45 }),
```

Placement summary:

```ts
    summary: text(
      "Dört beceri, yaklaşık 77 dakika. Dilbilgisi onSET düzeninde altı C-testle ölçülür: öğrenci eksik harfleri kendisi yazar. Bölüm içinde geri dönülebilir, soru işaretlenebilir. Öğrenciyi doğru sınıfa yerleştirir; sonucu öğretmen onaylar.",
      "Four skills, about 77 minutes. Grammar is measured with six C-tests in the onSET shape: the student types the missing letters. Within a section the student can go back and flag questions. Places the student in the right class; a teacher confirms the result.",
    ),
```

If the quick-screen gate passed, its GRAMMAR and summary:

```ts
        section("GRAMMAR", 15, { distribution: NO_ITEMS, cTestLevels: ["A2", "B1", "B2"], minItems: 15, maxItems: 30, targetSe: 0.5 }),
```

```ts
    summary: text(
      "15 dakikalık üç C-test (A2, B1, B2): öğrenci eksik harfleri kendisi yazar. Kurs danışmanıyla ilk görüşmeden önce kaba bir seviye verir.",
      "Three C-tests in 15 minutes (A2, B1, B2): the student types the missing letters. Gives a rough level before the first talk with a course advisor.",
    ),
```

and `screens.tr.json` `forWhomQuick`: `"İlk görüşmede hızlı bir ön fikir için: üç C-test, kaba bir seviye verir."`; `screens.en.json`: `"For a quick first impression: three C-tests, a rough level."`.

Rewrite the header comment's numbers: placement is C-test grammar (spec 2026-10-15), about 77 minutes; replace the 2026-10-14 simulation figures with the Task 3 script output for the new form (exact and within-one per level), and say the quick screen changed or stayed and why (gate result).

- [ ] **Step 4: Rescale trims C-tests**

In `src/solutions/language-exam/create/exam-config.ts`, above `rescaleSection`:

```ts
/** Minutes one C-test text needs (onSET gives five). */
const MINUTES_PER_C_TEST = 5;
```

Inside `rescaleSection`, right after `if (!isObjectiveSection(s.section)) return;`:

```ts
  if (s.cTestLevels) {
    // Fewer minutes, fewer texts: keep the middle levels, never more than listed.
    const keep = clamp(Math.floor(minutes / MINUTES_PER_C_TEST), 1, s.cTestLevels.length);
    const start = Math.floor((s.cTestLevels.length - keep) / 2);
    s.cTestLevels = s.cTestLevels.slice(start, start + keep);
  }
```

- [ ] **Step 5: `defaultBlueprint` comment**

In `src/lib/exam/blueprint.ts`, the `defaultBlueprint` doc comment says the placement default is "shaped like the placement template". Change it to: "the placement one keeps the multiple-choice grammar form the placement template had before 2026-10-15, for schools that start blank and want it". Do not change its values.

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run src/lib/exam src/solutions/language-exam src/app`
Expected: PASS. The AI creator picks templates by minutes; a test that expected the placement template for a target near 64 minutes may now get another one. If so, read the test's intent and update the target or the expectation; list each such change in the task report.

- [ ] **Step 7: Full checks and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

```bash
git add src/lib/exam/templates.ts src/lib/exam/templates.test.ts src/solutions/language-exam/create/exam-config.ts src/solutions/language-exam/create/exam-config.test.ts "src/app/(manager)/exam/exams/actions.test.ts" src/lib/exam/blueprint.ts src/i18n/messages/screens.tr.json src/i18n/messages/screens.en.json
git commit -m "Measure placement grammar with six C-tests in the onSET shape

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs, browser check, rollout (controller)

**Files:**
- Modify: `docs/EXAM-ENGINE.md` (sections "Model", "Sabit form", "Başlangıç bankası")
- Modify: `docs/STATUS.md` (new section for this change; production rollout log)

- [ ] **Step 1: Docs**

`docs/EXAM-ENGINE.md` (Turkish, like the file): under "Model" add a bullet on the C-test weight (`max(1, boşluk / 4)`, why, uncalibrated, replaced by a partial credit model once data exists). Under "Sabit form" replace the placement figures with the Task 3 output and describe `cTestLevels`. Under "Başlangıç bankası" update the C-test count (3 per level, 18 in all).
`docs/STATUS.md`: a section "onSET düzeninde yerleştirme (2026-10-15, `platform/solutions`)" with what changed, the simulation table, the blind-solve result, and what is not verified.

- [ ] **Step 2: Local browser run (Claude in Chrome only, never Playwright)**

Use a DB copy and port of your own (memory: `kademe_platform` on 5434, dev on a free 31xx port with a unique `*.localhost` hostname). Apply the bank: `pnpm bank:topup --allow-working-db --retire-stale --sync-seed` against that copy. Then: create a placement exam from the template, check the review screen shows no C-test gap, invite yourself, start the exam, check the GRAMMAR intro says "6 metin" and "Metin başına yaklaşık 5 dakika", fill some gaps in two texts, go back between texts, finish the section, finish the exam, open the teacher result and the per-gap view of one C-test, accept one gap and see the level re-estimate. Note anything not checked.

- [ ] **Step 3: Commit docs**

```bash
git add docs/EXAM-ENGINE.md docs/STATUS.md
git commit -m "Document the onSET-style placement and the C-test weight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Rollout**

Only when no exam is running on production. Fast-forward `main` to `platform/solutions`, deploy with the recipe in the production-host memory, then on the VM `pnpm run bank:topup --production --confirm-db=127.0.0.1:5434/kademe` (the twelve new texts; report the before and after counts). Log the rollout in `docs/STATUS.md` and commit. Existing exams keep their config; tell the user a cohort exam created before today keeps the old grammar section.
