import { z } from "zod";
import { PRESETS, proctoringPolicySchema } from "@/lib/proctor/policy";
import type { AdaptiveConfig, PoolItem } from "./adaptive";
import { BAND_CENTER, levelIndex, shiftLevel } from "./cefr";
import {
  CEFR_LEVELS,
  isObjectiveSection,
  SECTIONS,
  type Cefr,
  type ExamMode,
  type Section,
} from "./types";

/**
 * The exam blueprint: everything a school can configure about an exam.
 *
 * Stored as one validated jsonb document on `exam_blueprints.config` and
 * copied onto the assessment when a student is invited, so a later edit never
 * changes an exam someone is already taking.
 */

const count = z.number().int().min(0).max(60);

const perLevelSchema = z.object({
  A1: count,
  A2: count,
  B1: count,
  B2: count,
  C1: count,
  C2: count,
});

export const distributionSchema = z.discriminatedUnion("kind", [
  /** Exactly this many items per level. */
  z.object({ kind: z.literal("ABSOLUTE"), perLevel: perLevelSchema }),
  /** Relative to the claimed level (verification) or to B1 (placement). */
  z.object({ kind: z.literal("RELATIVE"), below: count, at: count, above: count }),
]);

export const sectionConfigSchema = z.object({
  section: z.enum(SECTIONS),
  enabled: z.boolean(),
  durationMinutes: z.number().int().min(1).max(180),
  /** Objective sections only. Productive sections are always fixed. */
  adaptive: z.boolean(),
  distribution: distributionSchema,
  minItems: z.number().int().min(1).max(60),
  maxItems: z.number().int().min(1).max(80),
  targetSe: z.number().min(0.2).max(1),
  /** Writing and speaking: how many tasks. */
  tasks: z.number().int().min(1).max(4),
  /** Writing and speaking overrides; null keeps the item's own value. */
  thinkSeconds: z.number().int().min(0).max(300).nullable(),
  answerSeconds: z.number().int().min(20).max(600).nullable(),
  maxTakes: z.number().int().min(1).max(3).nullable(),
});

export const passRulesSchema = z.object({
  /** Overall level must reach the claim. */
  overallAtLeastClaimed: z.boolean(),
  /** Each skill must reach claim + this (e.g. -1). Null: no per-skill rule. */
  minSkillOffset: z.number().int().min(-2).max(0).nullable(),
  /** These skills must reach the claim itself. */
  requiredSkills: z.array(z.enum(SECTIONS)),
  /** Probability, from the objective sections, that ability is at or above the claim. */
  minHoldProbability: z.number().min(0).max(0.99).nullable(),
});

export const blueprintConfigSchema = z
  .object({
    version: z.literal(1),
    sections: z.array(sectionConfigSchema).min(1).max(SECTIONS.length),
    /** Shift every fixed-form level up or down by one. */
    difficultyOffset: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    resultVisibility: z.enum(["NONE", "OVERALL", "FULL"]),
    /** Show the result to the student as soon as it is final. */
    autoRelease: z.boolean(),
    passRules: passRulesSchema,
    proctoring: proctoringPolicySchema,
    listening: z.object({ maxPlays: z.number().int().min(1).max(3) }),
  })
  .superRefine((cfg, ctx) => {
    const seen = new Set<Section>();
    for (const s of cfg.sections) {
      if (seen.has(s.section)) ctx.addIssue({ code: "custom", message: `section ${s.section} repeats` });
      seen.add(s.section);
      if (s.minItems > s.maxItems)
        ctx.addIssue({ code: "custom", message: `${s.section}: minItems above maxItems` });
    }
    if (!cfg.sections.some((s) => s.enabled))
      ctx.addIssue({ code: "custom", message: "at least one section must be enabled" });
  });

export type SectionConfig = z.infer<typeof sectionConfigSchema>;
export type BlueprintConfig = z.infer<typeof blueprintConfigSchema>;
export type PassRules = z.infer<typeof passRulesSchema>;
export type Distribution = z.infer<typeof distributionSchema>;

export const parseBlueprintConfig = (json: unknown): BlueprintConfig => blueprintConfigSchema.parse(json);

const zeroLevels = (): Record<Cefr, number> => ({ A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 });

/** One section with the editor's starting values, overridden by `over`. */
export function section(
  s: Section,
  minutes: number,
  over: Partial<SectionConfig> = {},
): SectionConfig {
  return {
    section: s,
    enabled: true,
    durationMinutes: minutes,
    adaptive: false,
    distribution: { kind: "RELATIVE", below: 0, at: 0, above: 0 },
    minItems: 8,
    maxItems: 16,
    targetSe: 0.45,
    tasks: 1,
    thinkSeconds: null,
    answerSeconds: null,
    maxTakes: null,
    ...over,
  };
}

/** Sensible starting points for the two modes. Schools change them in the editor. */
export function defaultBlueprint(mode: ExamMode): BlueprintConfig {
  if (mode === "PLACEMENT") {
    return {
      version: 1,
      sections: [
        section("GRAMMAR", 20, { adaptive: true, minItems: 10, maxItems: 18, targetSe: 0.45 }),
        section("READING", 25, { adaptive: true, minItems: 6, maxItems: 12, targetSe: 0.5 }),
        section("LISTENING", 25, { adaptive: true, minItems: 6, maxItems: 12, targetSe: 0.5 }),
        section("WRITING", 25, { tasks: 1 }),
        section("SPEAKING", 12, { tasks: 2 }),
      ],
      difficultyOffset: 0,
      resultVisibility: "OVERALL",
      autoRelease: false,
      passRules: { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [], minHoldProbability: 0.5 },
      proctoring: PRESETS.STRICT,
      listening: { maxPlays: 2 },
    };
  }
  return {
    version: 1,
    sections: [
      section("GRAMMAR", 15, { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 } }),
      section("READING", 25, { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 } }),
      section("LISTENING", 20, { distribution: { kind: "RELATIVE", below: 3, at: 3, above: 3 } }),
      section("WRITING", 25, { tasks: 1 }),
      section("SPEAKING", 12, { tasks: 2 }),
    ],
    difficultyOffset: 0,
    resultVisibility: "NONE",
    autoRelease: false,
    passRules: { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [], minHoldProbability: 0.5 },
    proctoring: PRESETS.STRICT,
    listening: { maxPlays: 2 },
  };
}

export const enabledSections = (cfg: BlueprintConfig): SectionConfig[] =>
  cfg.sections.filter((s) => s.enabled);

export const estimatedMinutes = (cfg: BlueprintConfig): number =>
  enabledSections(cfg).reduce((m, s) => m + s.durationMinutes, 0);

/** Where a relative distribution is anchored. */
export const anchorLevel = (mode: ExamMode, claimed: Cefr | null): Cefr =>
  mode === "LEVEL_VERIFICATION" && claimed ? claimed : "B1";

/**
 * Items per level for a fixed form. Counts that would fall off the scale (below
 * A1, above C2) fold back onto the end level, so an A1 claim still gets a full
 * form.
 */
export function resolveDistribution(
  s: SectionConfig,
  mode: ExamMode,
  claimed: Cefr | null,
  difficultyOffset: number,
): Record<Cefr, number> {
  const out = zeroLevels();
  const add = (level: Cefr, n: number) => {
    out[shiftLevel(level, difficultyOffset)] += n;
  };
  if (s.distribution.kind === "ABSOLUTE") {
    for (const l of CEFR_LEVELS) add(l, s.distribution.perLevel[l]);
  } else {
    const anchor = anchorLevel(mode, claimed);
    add(shiftLevel(anchor, -1), s.distribution.below);
    add(anchor, s.distribution.at);
    add(shiftLevel(anchor, 1), s.distribution.above);
  }
  return out;
}

export type BankItem = PoolItem & { level: Cefr };

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A fixed form: the planned item ids, easiest unit first. For reading and
 * listening whole texts are drawn until the level's count is reached, so a
 * level may get a question or two more than asked for.
 */
export function sampleFixedForm(
  pool: BankItem[],
  perLevel: Record<Cefr, number>,
  rng: () => number,
): string[] {
  const units: Array<{ ids: string[]; b: number }> = [];
  for (const level of CEFR_LEVELS) {
    const want = perLevel[level];
    if (want <= 0) continue;
    const atLevel = pool.filter((i) => i.level === level);
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
    for (const unit of shuffle(candidates, rng)) {
      if (taken >= want) break;
      units.push({ ids: unit.map((i) => i.id), b: unit.reduce((a, i) => a + i.b, 0) / unit.length });
      taken += unit.length;
    }
  }
  return units.sort((a, b) => a.b - b.b).flatMap((u) => u.ids);
}

/** Levels an adaptive section may need, for the coverage check. */
function adaptiveLevels(mode: ExamMode, claimed: Cefr | null): Cefr[] {
  if (mode === "PLACEMENT" || !claimed) return [...CEFR_LEVELS];
  const i = levelIndex(claimed);
  return CEFR_LEVELS.filter((_, j) => Math.abs(j - i) <= 1);
}

/**
 * Levels of the writing / speaking tasks. Verification tests the claim itself.
 * Placement follows the provisional level from the objective sections and, with
 * more than one task, reaches one level up to see where the ceiling is.
 */
export function productiveTaskLevels(
  mode: ExamMode,
  claimed: Cefr | null,
  provisional: Cefr,
  tasks: number,
): Cefr[] {
  if (mode === "LEVEL_VERIFICATION" && claimed) return Array(tasks).fill(claimed);
  const plan: number[] = tasks === 1 ? [0] : tasks === 2 ? [0, 1] : tasks === 3 ? [-1, 0, 1] : [-1, 0, 1, 1];
  return plan.map((d) => shiftLevel(provisional, d));
}

export type CoverageRow = {
  section: Section;
  level: Cefr;
  /** Items (objective) or prompts (productive) the exam may need at this level. */
  needed: number;
  available: number;
  /** Reading / listening: texts available. Adaptive needs at least two per level. */
  units?: number;
  ok: boolean;
};

export type BankCount = {
  section: Section;
  level: Cefr;
  /** Items servable today (approved; listening also needs audio). */
  items: number;
  /** Distinct stimuli among those items. */
  stimuli: number;
};

/**
 * Whether the bank holds enough approved content for this blueprint. With a
 * claimed level it answers for that student; without, for every level the
 * exam could reach. The editor shows this live and invite and publish are
 * refused while it fails, so nobody meets an empty section mid-exam.
 */
export function bankCoverage(
  counts: BankCount[],
  cfg: BlueprintConfig,
  mode: ExamMode,
  claimed: Cefr | null,
): { ok: boolean; rows: CoverageRow[] } {
  const rows: CoverageRow[] = [];
  const get = (section: Section, level: Cefr) =>
    counts.find((c) => c.section === section && c.level === level) ?? { items: 0, stimuli: 0 };

  const claims: Array<Cefr | null> =
    mode === "LEVEL_VERIFICATION" ? (claimed ? [claimed] : [...CEFR_LEVELS]) : [null];

  for (const s of enabledSections(cfg)) {
    const need = zeroLevels();
    const needUnits = zeroLevels();
    const testlet = s.section === "READING" || s.section === "LISTENING";
    for (const claim of claims) {
      if (!isObjectiveSection(s.section)) {
        const levels =
          mode === "LEVEL_VERIFICATION" && claim ? [claim] : [...CEFR_LEVELS];
        for (const l of levels) need[l] = Math.max(need[l], s.tasks);
      } else if (s.adaptive) {
        const levels = adaptiveLevels(mode, claim);
        // A student can drift anywhere in reach, so every level needs a few
        // items and, for texts, at least two to choose between.
        const perLevel = Math.max(3, Math.ceil(s.maxItems / levels.length));
        for (const l of levels) {
          need[l] = Math.max(need[l], perLevel);
          if (testlet) needUnits[l] = Math.max(needUnits[l], 2);
        }
      } else {
        const dist = resolveDistribution(s, mode, claim, cfg.difficultyOffset);
        for (const l of CEFR_LEVELS) {
          need[l] = Math.max(need[l], dist[l]);
          if (testlet && dist[l] > 0) needUnits[l] = Math.max(needUnits[l], 1);
        }
      }
    }
    for (const l of CEFR_LEVELS) {
      if (need[l] === 0 && needUnits[l] === 0) continue;
      const have = get(s.section, l);
      const ok = have.items >= need[l] && (!testlet || have.stimuli >= needUnits[l]);
      rows.push({
        section: s.section,
        level: l,
        needed: need[l],
        available: have.items,
        ...(testlet ? { units: have.stimuli } : {}),
        ok,
      });
    }
  }
  return { ok: rows.every((r) => r.ok), rows };
}

/** The engine settings for one adaptive section of one student. */
export function adaptiveConfigFor(
  s: SectionConfig,
  mode: ExamMode,
  claimed: Cefr | null,
): AdaptiveConfig {
  return {
    minItems: s.minItems,
    maxItems: s.maxItems,
    targetSe: s.targetSe,
    // A verification exam starts at the claim, a placement exam at B1. The
    // prior is wide on purpose so that a handful of answers outweigh it.
    priorMean: BAND_CENTER[anchorLevel(mode, claimed)],
    priorSd: 1.5,
    randomesque: 3,
  };
}

