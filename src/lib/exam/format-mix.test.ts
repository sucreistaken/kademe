import { describe, expect, it } from "vitest";
import { mulberry32 } from "./adaptive";
import { enabledSections, planFixedSection, resolveDistribution, textPlanOf, type BankItem, type SectionConfig } from "./blueprint";
import { seedPool, type SeedPoolItem } from "./seed-forms";
import { examTemplateByKey, type ExamTemplate } from "./templates";
import { CEFR_LEVELS, isObjectiveSection, isTextGap, textGapKindOf, type Cefr, type ExamMode } from "./types";

/**
 * Format mix for every student (2026-10-24). Owner feedback after a live
 * test: "the questions all look like the same format". Until 655db25 only a
 * returning student's draw mixed formats; a first-time student's reading and
 * listening were a plain shuffle, often multiple choice only. This draws
 * FORMS first-time forms per context from the starter bank with the frozen
 * draw of 655db25 ("before") and today's (`planFixedSection`, "after") and
 * compares, per template, context, section and level, the distinct formats
 * (item-format.ts) of the items drawn there.
 *
 * Print the table: FORMAT_MIX_TABLE=1 npx vitest run src/lib/exam/format-mix.test.ts
 */
const FORMS = 200;

/** The first-time fixed-form draw of 655db25 (unchanged since 5a2260f). */
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
    for (const entry of textPlanOf(s, mode, claimed)) {
      const candidates = pool.filter((i) => i.level === entry.level && textGapKindOf(i) === entry.kind);
      if (candidates.length > 0) ids.push(candidates[Math.floor(rng() * candidates.length)].id);
    }
    return [...ids, ...legacy.sampleFixedForm(pool, resolveDistribution(s, mode, claimed, offset), rng)];
  },
};

const pool = seedPool();
const byId = new Map(pool.map((p) => [p.id, p]));
const formatOf = (i: SeedPoolItem): string => i.format!;

/** The units (a text with its questions, or a single item) the form draws from at one level. */
function unitsAt(sectionPool: SeedPoolItem[], level: Cefr): SeedPoolItem[][] {
  const atLevel = sectionPool.filter((i) => i.level === level && !isTextGap(i));
  const byStimulus = new Map<string, SeedPoolItem[]>();
  for (const i of atLevel) {
    const key = i.stimulusId ?? i.id;
    byStimulus.set(key, [...(byStimulus.get(key) ?? []), i]);
  }
  return [...byStimulus.values()];
}

/**
 * Whether some draw of whole units meeting the level's count shows two
 * formats: one unit has two, or a unit with fewer items than the count is
 * followed by one with another format.
 */
function canShowTwo(units: SeedPoolItem[][], want: number): boolean {
  const formats = (u: SeedPoolItem[]) => new Set(u.map(formatOf));
  if (units.some((u) => formats(u).size >= 2)) return true;
  return units.some((u) => u.length < want && units.some((v) => v !== u && [...formats(v)].some((f) => !formats(u).has(f))));
}

type Cell = {
  template: string;
  context: string;
  section: string;
  /** A level, or "all" for the whole section. */
  level: string;
  /** Average distinct formats per form. */
  before: number;
  after: number;
  /** Share of forms showing two formats or more. */
  twoBefore: number;
  twoAfter: number;
  /** Units (texts, clips, single items) drawn at least once across the forms, of those in the bank. */
  unitsBefore: number;
  unitsAfter: number;
  unitsInBank: number;
  canShowTwo: boolean;
  /** After: forms showing fewer than two formats although the bank could show two. */
  shortForms: number;
};

function measure(t: ExamTemplate): Cell[] {
  const contexts: Array<Cefr | null> = t.mode === "PLACEMENT" ? [null] : [...CEFR_LEVELS];
  const cells: Cell[] = [];
  for (const claimed of contexts) {
    for (const s of enabledSections(t.config)) {
      if (!isObjectiveSection(s.section) || s.adaptive) continue;
      const want = resolveDistribution(s, t.mode, claimed, t.config.difficultyOffset);
      const levels = CEFR_LEVELS.filter((l) => want[l] > 0);
      if (levels.length === 0) continue;
      const sectionPool = pool.filter((p) => p.section === s.section);
      const tally = new Map<string, { before: number; after: number; twoBefore: number; twoAfter: number; short: number; usedBefore: Set<string>; usedAfter: Set<string> }>();
      const row = (key: string) => {
        const r = tally.get(key) ?? { before: 0, after: 0, twoBefore: 0, twoAfter: 0, short: 0, usedBefore: new Set<string>(), usedAfter: new Set<string>() };
        tally.set(key, r);
        return r;
      };
      const feasible = new Map(levels.map((l) => [l, canShowTwo(unitsAt(sectionPool, l), want[l])]));
      for (let seed = 1; seed <= FORMS; seed++) {
        const drawn = {
          before: legacy.planFixedSection(s, sectionPool, t.mode, claimed, t.config.difficultyOffset, mulberry32(seed)),
          after: planFixedSection(s, sectionPool, t.mode, claimed, t.config.difficultyOffset, mulberry32(seed), { itemIds: new Set(), stimulusIds: new Set() }),
        };
        for (const side of ["before", "after"] as const) {
          const items = drawn[side].map((id) => byId.get(id)!).filter((i) => !isTextGap(i));
          for (const key of [...levels, "all"]) {
            const here = items.filter((i) => key === "all" || i.level === key);
            const n = new Set(here.map(formatOf)).size;
            const r = row(key);
            r[side] += n;
            if (n >= 2) r[side === "before" ? "twoBefore" : "twoAfter"]++;
            if (side === "after" && n < 2 && key !== "all" && feasible.get(key as Cefr)) r.short++;
            for (const i of here) (side === "before" ? r.usedBefore : r.usedAfter).add(i.stimulusId ?? i.id);
          }
        }
      }
      for (const key of [...levels, "all"]) {
        const r = row(key);
        const inBank = key === "all" ? levels.reduce((n, l) => n + unitsAt(sectionPool, l).length, 0) : unitsAt(sectionPool, key as Cefr).length;
        cells.push({
          template: t.key,
          context: claimed ?? "*",
          section: s.section,
          level: key,
          before: r.before / FORMS,
          after: r.after / FORMS,
          twoBefore: r.twoBefore / FORMS,
          twoAfter: r.twoAfter / FORMS,
          unitsBefore: r.usedBefore.size,
          unitsAfter: r.usedAfter.size,
          unitsInBank: inBank,
          canShowTwo: key === "all" ? levels.some((l) => feasible.get(l)) : !!feasible.get(key as Cefr),
          shortForms: r.short,
        });
      }
    }
  }
  return cells;
}

const template = (key: string): ExamTemplate => {
  const t = examTemplateByKey(key);
  if (!t) throw new Error(`no template ${key}`);
  return t;
};
const cells = [...measure(template("placement")), ...measure(template("level-check"))];

if (process.env.FORMAT_MIX_TABLE) {
  const pct = (x: number) => `${Math.round(100 * x)}%`;
  const lines = [
    `Distinct formats per form, ${FORMS} first-time forms per context, starter bank. before = 655db25, after = format mix.`,
    "| template | context | section | level | formats before | formats after | 2+ formats before | 2+ formats after | units drawn before | units drawn after |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...cells.map(
      (c) =>
        `| ${c.template} | ${c.context} | ${c.section} | ${c.level} | ${c.before.toFixed(2)} | ${c.after.toFixed(2)} | ${pct(c.twoBefore)} | ${pct(c.twoAfter)} | ${c.unitsBefore} / ${c.unitsInBank} | ${c.unitsAfter} / ${c.unitsInBank} |`,
    ),
  ];
  const levelCells = cells.filter((c) => c.level !== "all");
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const section of ["READING", "LISTENING", "GRAMMAR"]) {
    const of = levelCells.filter((c) => c.section === section);
    const all = cells.filter((c) => c.section === section && c.level === "all");
    if (of.length === 0) continue;
    lines.push(
      `${section}: per level ${avg(of.map((c) => c.before)).toFixed(2)} -> ${avg(of.map((c) => c.after)).toFixed(2)}, 2+ formats ${pct(avg(of.map((c) => c.twoBefore)))} -> ${pct(avg(of.map((c) => c.twoAfter)))}; whole section ${avg(all.map((c) => c.before)).toFixed(2)} -> ${avg(all.map((c) => c.after)).toFixed(2)}`,
    );
  }
  console.log(lines.join("\n"));
}

describe("every student gets a mix of formats (starter bank, first-time forms)", () => {
  it("measures every fixed objective section of the placement test and the level check", () => {
    expect(cells.filter((c) => c.template === "placement" && c.level !== "all").map((c) => `${c.section} ${c.level}`)).toEqual([
      "READING A2", "READING B1", "READING B2", "READING C1", "LISTENING A2", "LISTENING B1", "LISTENING B2",
    ]);
    expect(new Set(cells.filter((c) => c.template === "level-check").map((c) => c.context)).size).toBe(6);
  });

  it("shows on average at least as many formats as before in every section of every context", () => {
    const sections = cells.filter((c) => c.level === "all");
    const worse = sections.filter((c) => c.after < c.before).map((c) => `${c.template} ${c.context} ${c.section}: ${c.before} -> ${c.after}`);
    expect(worse).toEqual([]);
    expect(sections.filter((c) => c.after > c.before).length).toBeGreaterThan(sections.length / 2);
  });

  it("per level, shows as many formats as before on average, or two in every form", () => {
    // A level of two questions takes one text: when the section prefers a text with a format the section has not
    // shown yet (see mixFormats), that text may have two formats where a random one sometimes had three. Such a
    // level still shows two formats in every form, where before it sometimes showed one.
    const worse = cells
      .filter((c) => c.level !== "all" && c.after < c.before && c.twoAfter < 1)
      .map((c) => `${c.template} ${c.context} ${c.section} ${c.level}: ${c.before} -> ${c.after}`);
    expect(worse).toEqual([]);
  });

  it("shows at least two formats per level in reading and listening, in every form, wherever the bank can", () => {
    const testlets = cells.filter((c) => (c.section === "READING" || c.section === "LISTENING") && c.level !== "all");
    // The starter bank can show two formats at every reading and listening level the templates draw.
    expect(testlets.filter((c) => !c.canShowTwo).map((c) => `${c.template} ${c.context} ${c.section} ${c.level}`)).toEqual([]);
    expect(testlets.filter((c) => c.shortForms > 0).map((c) => `${c.template} ${c.context} ${c.section} ${c.level}: ${c.shortForms}`)).toEqual([]);
    for (const c of testlets) expect(c.twoAfter, `${c.template} ${c.context} ${c.section} ${c.level}`).toBe(1);
  });

  it("still draws at random: every level keeps at least three units in play", () => {
    // The section preference needs three candidates (blueprint.ts: MIN_SECTION_CHOICE), so it never pins a level.
    const narrow = cells
      .filter((c) => c.level !== "all" && c.unitsAfter < Math.min(3, c.unitsInBank))
      .map((c) => `${c.template} ${c.context} ${c.section} ${c.level}: ${c.unitsAfter} of ${c.unitsInBank}`);
    expect(narrow).toEqual([]);
  });
});
