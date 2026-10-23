import { describe, expect, it } from "vitest";
import { mulberry32 } from "./adaptive";
import { enabledSections, productiveTaskLevels, resolveDistribution, textPlanOf, type BlueprintConfig } from "./blueprint";
import { drawExamForm, seedPool, servedIn, type DrawnSection, type SeedPoolItem } from "./seed-forms";
import { EXAM_TEMPLATES, type ExamTemplate } from "./templates";
import { CEFR_LEVELS, isObjectiveSection, isTextGap, textGapKindOf, type Cefr } from "./types";

/**
 * Where the CURRENT starter bank is too small for three forms in a row
 * without a repeat, as "<template> <context> <section> <level>": the
 * context is the claimed level (level check) or the provisional level that
 * places writing and speaking (placement; "*" for a section it does not
 * change). In these cells the third (or second) form tops up with units the
 * student has seen, least served first. Everywhere else the three forms must
 * not share an item or a text.
 *
 * Bank tasks shrink this list to empty: the test fails both on a repeat in a
 * cell that is not listed and on a listed cell that no longer repeats.
 */
const EXPECTED_SHORTFALL: string[] = [
  // Bank too small: a claim at the end of the scale folds "below" or "above" grammar onto it, 9 singles a form,
  // 27 for three; A1 and C2 hold 24 each (bank of 2026-10-23).
  "level-check A1 GRAMMAR A1",
  "level-check C2 GRAMMAR C2",
  // Draw overshoot (whole texts): the bank could fill three disjoint forms, but whole texts overshoot the item
  // count and form 1 must equal the legacy draw. C2 reading: 8 items a form, 24 for three; the bank has exactly
  // 24 in 12 texts (six of 3, six of 1), so three forms of 3+3+1+1 would fit. A1 listening: 7 items a form, 21
  // for three; 24 in 11 clips (3,3,3,3,3,2,2,2,1,1,1), so 3+3+1, 3+2+2 and 3+2+1+1 would fit. Every other
  // reading and listening cell of the earlier list draws three forms without a repeat now.
  "level-check C2 READING C2",
  "level-check A1 LISTENING A1",
];

/** Each sequence of forms starts from its own seed; a cell is short when any of them repeats there. */
const SEEDS = [1, 2, 3, 4, 5, 6];

type Context = { label: string; claimed: Cefr | null; provisional: Cefr };

const contextsOf = (t: ExamTemplate): Context[] =>
  t.mode === "LEVEL_VERIFICATION"
    ? CEFR_LEVELS.map((claimed) => ({ label: claimed, claimed, provisional: claimed }))
    : CEFR_LEVELS.map((provisional) => ({ label: provisional, claimed: null, provisional }));

const pool = seedPool();
const byId = new Map(pool.map((p) => [p.id, p]));

/** The cell an item counts in; placement grammar, reading and listening do not depend on the provisional level. */
function cellOf(t: ExamTemplate, ctx: Context, item: SeedPoolItem): string {
  const context = t.mode === "PLACEMENT" && isObjectiveSection(item.section) ? "*" : ctx.label;
  return `${t.key} ${context} ${item.section} ${item.level}`;
}

/** Items (and texts) of `later` already in `earlier`, by cell. */
function repeats(t: ExamTemplate, ctx: Context, earlier: DrawnSection[][], later: DrawnSection[]): string[] {
  const seen = servedIn(earlier, pool);
  return later
    .flatMap((f) => f.itemIds)
    .map((id) => byId.get(id)!)
    .filter((i) => seen.itemIds.has(i.id) || (!!i.stimulusId && seen.stimulusIds.has(i.stimulusId)))
    .map((i) => cellOf(t, ctx, i));
}

/**
 * Why a drawn exam is not a full form, empty when it is: every fixed level
 * reaches its count (or all the bank has), every planned text the bank has is
 * there, and every writing or speaking slot the bank can fill is filled.
 */
function gaps(cfg: BlueprintConfig, t: ExamTemplate, ctx: Context, form: DrawnSection[]): string[] {
  const out: string[] = [];
  for (const s of enabledSections(cfg)) {
    const drawn = (form.find((f) => f.section === s.section)?.itemIds ?? []).map((id) => byId.get(id)!);
    const sectionPool = pool.filter((p) => p.section === s.section);
    if (!isObjectiveSection(s.section)) {
      const levels = productiveTaskLevels(t.mode, ctx.claimed, ctx.provisional, s.tasks);
      const fillable = levels.filter((l, i) => sectionPool.filter((p) => p.level === l).length > levels.slice(0, i).filter((x) => x === l).length);
      if (drawn.length !== fillable.length) out.push(`${s.section}: ${drawn.length} of ${fillable.length} tasks`);
      continue;
    }
    const plan = textPlanOf(s, t.mode, ctx.claimed).filter((e) => sectionPool.some((p) => p.level === e.level && textGapKindOf(p) === e.kind));
    const texts = drawn.filter(isTextGap);
    if (texts.length !== plan.length) out.push(`${s.section}: ${texts.length} of ${plan.length} texts`);
    const want = resolveDistribution(s, t.mode, ctx.claimed, cfg.difficultyOffset);
    for (const level of CEFR_LEVELS) {
      if (want[level] === 0) continue;
      const have = sectionPool.filter((p) => p.level === level && !isTextGap(p)).length;
      const got = drawn.filter((p) => p.level === level && !isTextGap(p)).length;
      if (got < Math.min(want[level], have)) out.push(`${s.section} ${level}: ${got} of ${want[level]} items`);
    }
  }
  return out;
}

describe("three forms in a row on the starter bank", () => {
  const short = new Set<string>();
  const notFull: string[] = [];
  for (const t of EXAM_TEMPLATES) {
    for (const ctx of contextsOf(t)) {
      for (const seed of SEEDS) {
        const forms: DrawnSection[][] = [];
        for (let n = 0; n < 4; n++) {
          const form = drawExamForm(t.config, t.mode, ctx.claimed, ctx.provisional, pool, mulberry32(seed * 100 + n), servedIn(forms, pool));
          for (const g of gaps(t.config, t, ctx, form)) notFull.push(`${t.key} ${ctx.label} form ${n + 1} (seed ${seed}): ${g}`);
          if (n > 0 && n < 3) for (const cell of repeats(t, ctx, forms, form)) short.add(cell);
          forms.push(form);
        }
      }
    }
  }

  it("never repeats an item or a text across three forms where the bank has enough units", () => {
    const unexpected = [...short].filter((c) => !EXPECTED_SHORTFALL.includes(c)).sort();
    expect(unexpected, `repeats outside EXPECTED_SHORTFALL; all short cells now:\n${[...short].sort().join("\n")}`).toEqual([]);
  });

  it("lists only cells that still fall short (shrink EXPECTED_SHORTFALL as the bank grows)", () => {
    const covered = EXPECTED_SHORTFALL.filter((c) => !short.has(c));
    expect(covered, "these cells no longer repeat: remove them from EXPECTED_SHORTFALL").toEqual([]);
  });

  it("draws a full form every time, the fourth one too", () => {
    expect(notFull).toEqual([]);
  });

  for (const cell of EXPECTED_SHORTFALL) it.todo(`bank too small for three forms without a repeat: ${cell}`);
});
