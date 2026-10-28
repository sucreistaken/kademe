import { z } from "zod";
import { PRESETS, proctoringPolicySchema } from "@/lib/proctor/policy";
import { selectNext, type AdaptiveConfig, type AdaptiveState, type PoolItem } from "./adaptive";
import { BAND_CENTER, levelIndex, shiftLevel } from "./cefr";
import { courseBlueprint } from "./course/config";
import { courseCoverage } from "./course/coverage";
import { courseConfigSchema } from "./course/types";
import {
  CEFR_LEVELS,
  isObjectiveSection,
  isTextGap,
  SECTIONS,
  TEXT_GAP_KINDS,
  TEXT_GAP_SKILL_TAGS,
  textGapKindOf,
  type Cefr,
  type ExamMode,
  type ItemType,
  type Section,
  type TextGapKind,
} from "./types";

/**
 * The exam blueprint: everything a school can configure about an exam.
 *
 * Stored as one validated jsonb document on `exam_blueprints.config` and
 * copied onto the assessment when a student is invited, so a later edit never
 * changes an exam someone is already taking.
 */

const count = z.number().int().min(0).max(60);

/** How far from the anchor level a relative text may sit (`relativeTexts`). */
export const MAX_TEXT_OFFSET = 2;

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
  /**
   * GRAMMAR only: open the section with one C-test at the anchor level (B1 for
   * placement, the claim for verification). Optional so stored configs stay
   * valid; missing means off. Without it (and without `cTestLevels`) no C-test is ever served.
   */
  cTest: z.boolean().optional(),
  /**
   * GRAMMAR only: one C-test per listed level, easy to hard, before the
   * section's ordinary items (the onSET shape, spec 2026-10-15). Replaces
   * `cTest` when present. Optional so stored configs stay valid.
   */
  cTestLevels: z.array(z.enum(CEFR_LEVELS)).min(1).max(CEFR_LEVELS.length).optional(),
  /**
   * GRAMMAR only: one MC cloze or word-bank text per entry, before the
   * section's ordinary items (spec 2026-10-18). Served cloze texts first, then
   * word banks, then open cloze texts, each easy to hard (see `textPlanOf`). Replaces `cTestLevels`
   * and `cTest` when present. Optional so stored configs stay valid.
   */
  texts: z
    .array(z.object({ level: z.enum(CEFR_LEVELS), kind: z.enum(["CLOZE", "WORDBANK", "OPEN"]) }))
    .min(1)
    .max(CEFR_LEVELS.length * 3)
    .optional(),
  /**
   * GRAMMAR only: like `texts`, but each text sits at an offset from the anchor
   * level (the claim for a verification, B1 for a placement) instead of at a
   * fixed level, so one stored form fits every claim (spec 2026-10-26). An
   * offset that falls off the scale folds onto its end level and a kind and
   * level planned twice is served once (see `textPlanOf`). Served as `texts`
   * are. Cannot be set together with `texts`. Optional so stored configs stay valid.
   */
  relativeTexts: z
    .array(z.object({ offset: z.number().int().min(-MAX_TEXT_OFFSET).max(MAX_TEXT_OFFSET), kind: z.enum(["CLOZE", "WORDBANK", "OPEN"]) }))
    .min(1)
    .max((2 * MAX_TEXT_OFFSET + 1) * 3)
    .optional(),
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
    /**
     * COURSE_TEST only (spec 2026-10-28): which course test, which form (set
     * per invitation, null on the published exam) and its cut scores.
     * Optional so stored configs stay valid.
     */
    course: courseConfigSchema.optional(),
  })
  .superRefine((cfg, ctx) => {
    const seen = new Set<Section>();
    for (const s of cfg.sections) {
      if (seen.has(s.section)) ctx.addIssue({ code: "custom", message: `section ${s.section} repeats` });
      seen.add(s.section);
      if (s.minItems > s.maxItems)
        ctx.addIssue({ code: "custom", message: `${s.section}: minItems above maxItems` });
      if (s.cTestLevels) {
        if (s.section !== "GRAMMAR") ctx.addIssue({ code: "custom", message: `${s.section}: cTestLevels is for GRAMMAR only` });
        if (new Set(s.cTestLevels).size !== s.cTestLevels.length)
          ctx.addIssue({ code: "custom", message: `${s.section}: cTestLevels repeats a level` });
      }
      if (s.texts) {
        if (s.section !== "GRAMMAR") ctx.addIssue({ code: "custom", message: `${s.section}: texts is for GRAMMAR only` });
        if (new Set(s.texts.map((t) => `${t.kind}:${t.level}`)).size !== s.texts.length)
          ctx.addIssue({ code: "custom", message: `${s.section}: texts repeats a kind and level` });
      }
      if (s.relativeTexts) {
        if (s.section !== "GRAMMAR") ctx.addIssue({ code: "custom", message: `${s.section}: relativeTexts is for GRAMMAR only` });
        if (s.texts) ctx.addIssue({ code: "custom", message: `${s.section}: texts and relativeTexts cannot both be set` });
        if (new Set(s.relativeTexts.map((t) => `${t.kind}:${t.offset}`)).size !== s.relativeTexts.length)
          ctx.addIssue({ code: "custom", message: `${s.section}: relativeTexts repeats a kind and offset` });
      }
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

const spread = (counts: Partial<Record<Cefr, number>>): Distribution => ({
  kind: "ABSOLUTE",
  perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, ...counts },
});

/**
 * The adaptive placement form: grammar, reading and listening choose the next
 * item from the answers so far. No back, no flag. Kept for schools that want
 * it and for the adaptive path of the seed and scripts/verify-exam-flow.ts.
 */
export function adaptivePlacementBlueprint(): BlueprintConfig {
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

/** The course test a blank COURSE_TEST blueprint starts as: B1, the course Halil Bey's test is written for. */
const DEFAULT_COURSE_KEY = "B1";

/**
 * Sensible starting points for the modes. All are fixed forms (the student can
 * go back, flag and review). The placement one keeps the multiple-choice
 * grammar form the placement template had before 2026-10-15, for schools that
 * start blank and want it. A course test has no blank form: it starts as the
 * B1 Abschlusstest (course tests are published from their templates, see
 * course/templates.ts).
 */
export function defaultBlueprint(mode: ExamMode): BlueprintConfig {
  if (mode === "COURSE_TEST") return courseBlueprint(DEFAULT_COURSE_KEY);
  if (mode === "PLACEMENT") {
    return {
      version: 1,
      sections: [
        section("GRAMMAR", 17, { distribution: spread({ A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 }), minItems: 10, maxItems: 16, targetSe: 0.45 }),
        section("READING", 18, { distribution: spread({ A2: 4, B1: 4, B2: 4, C1: 4 }), minItems: 5, maxItems: 8, targetSe: 0.55 }),
        section("LISTENING", 13, { distribution: spread({ A2: 4, B1: 4, B2: 4 }), minItems: 5, maxItems: 8, targetSe: 0.55 }),
        section("WRITING", 10, { tasks: 1 }),
        section("SPEAKING", 6, { tasks: 2 }),
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

/**
 * Where a relative distribution is anchored: the claim in a verification, B1
 * otherwise. A course test has no claim and draws nothing by level (its form
 * is fixed), so it falls on B1 like a placement; nothing reads it there.
 */
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

export type BankItem = PoolItem & {
  level: Cefr;
  /** The item type. Stands in for `format` when that is left out. */
  type?: ItemType;
  /**
   * The item's format (item-format.ts: itemFormatOf), for mixing formats in a
   * form. Left out by older callers: the text kind, else the item type stands
   * in; with neither the format is unknown and the item mixes with nothing.
   */
  format?: string;
  /** How often the item was served in any exam. Orders stale units, least served first. Missing means 0. */
  exposureCount?: number;
};

/**
 * What the same student (same organisation, same email) was served in their
 * other exams (src/server/exam-exposure.ts: seenBy). A unit is stale when any
 * of its items was served or, for a text or clip, when any item of its
 * stimulus was.
 */
export type Avoid = { itemIds: Set<string>; stimulusIds: Set<string> };

/**
 * Empty or missing: texts and writing and speaking tasks are drawn exactly as
 * before `avoid` existed. Fixed forms mix formats either way (sampleFixedForm).
 */
const isAvoiding = (avoid: Avoid | undefined): avoid is Avoid =>
  !!avoid && (avoid.itemIds.size > 0 || avoid.stimulusIds.size > 0);

const NOTHING_SEEN: Avoid = { itemIds: new Set(), stimulusIds: new Set() };

const isStale = (unit: BankItem[], avoid: Avoid): boolean =>
  unit.some((i) => avoid.itemIds.has(i.id) || (!!i.stimulusId && avoid.stimulusIds.has(i.stimulusId)));

/** The skill-tag family: its first two parts ("speaking.planning.open" is "speaking.planning"). */
export const skillTagFamily = (tag: string): string => tag.split(".").slice(0, 2).join(".");

/** One item's format: as loaded, else its text kind, else its item type; null when unknown. */
const itemFormat = (i: BankItem): string | null => i.format ?? textGapKindOf(i) ?? i.type ?? null;

/** The formats of a unit, each once: a text with true/false and multiple-choice questions has two. */
const unitFormats = (unit: BankItem[]): string[] => [
  ...new Set(unit.flatMap((i) => {
    const f = itemFormat(i);
    return f ? [f] : [];
  })),
];

const unitExposure = (unit: BankItem[]): number => Math.max(...unit.map((i) => i.exposureCount ?? 0));

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * How a format group's size spreads it over the draw order (mixFormats). 0
 * would be a plain round robin over formats: every group in the first round,
 * so a format only one text has would be in every form of a level that takes
 * as many texts as it has formats (level check A1 listening: one clip in 100%
 * of first-time forms). 1 would draw formats in proportion to their units, a
 * small format no more often than a shuffle does. 0.75 keeps every text under
 * half of the first-time forms on the starter bank (format-mix.test.ts).
 */
const FORMAT_SPREAD = 0.75;

/** The units a level takes from `order`: whole units until `want` items are reached. */
function takeUnits(order: BankItem[][], want: number): BankItem[][] {
  const out: BankItem[][] = [];
  let taken = 0;
  for (const unit of order) {
    if (taken >= want) break;
    out.push(unit);
    taken += unit.length;
  }
  return out;
}

const formatCount = (units: BankItem[][]): number => new Set(units.flatMap(unitFormats)).size;

/**
 * Interleaves formats at random. Units with the same formats form a group (a
 * text with multiple-choice and true/false questions is one group, a text with
 * only multiple choice another), in the given (shuffled) order. Each group
 * takes a random phase in [0, 1), and its k-th unit the slot
 * (k + phase) / size^FORMAT_SPREAD; units are drawn in slot order. So every
 * format comes up early in some forms and late in others, a big group comes up
 * more often than a small one, and within a group the order stays the shuffle.
 * With one group the order is unchanged and the rng is not used.
 */
function mixFormats(units: BankItem[][], rng: () => number): BankItem[][] {
  const groups = new Map<string, BankItem[][]>();
  for (const unit of units) {
    const key = unitFormats(unit).sort().join("+");
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }
  if (groups.size < 2) return units;
  return [...groups.values()]
    .flatMap((group) => {
      const phase = rng();
      return group.map((unit, k) => ({ unit, slot: (k + phase) / group.length ** FORMAT_SPREAD }));
    })
    .sort((a, b) => a.slot - b.slot)
    .map(({ unit }) => unit);
}

/**
 * Units that must be able to give a level its second format before one is
 * pulled forward (twoFormatsFirst). With a single such unit, pulling it would
 * put it in every form of the level: exposure goes before the second format.
 */
const MIN_SECOND_FORMAT_UNITS = 2;

/**
 * When the units a level takes from `order` show a single format, moves to the
 * front the first unit after which they show two, provided at least
 * MIN_SECOND_FORMAT_UNITS units could do it; else `order` as is. A level of
 * one text then gets a text with two formats, or a short text and another one.
 */
function twoFormatsFirst(order: BankItem[][], want: number): BankItem[][] {
  if (formatCount(takeUnits(order, want)) >= 2) return order;
  const moves: BankItem[][][] = [];
  for (let k = 1; k < order.length; k++) {
    const moved = [order[k], ...order.slice(0, k), ...order.slice(k + 1)];
    if (formatCount(takeUnits(moved, want)) >= 2) moves.push(moved);
  }
  return moves.length >= MIN_SECOND_FORMAT_UNITS ? moves[0] : order;
}

/** How a fixed form orders a level: its item count, and whether to pull a second format forward. */
type LevelMix = { want: number; secondFormat: boolean };

/**
 * The order a level's units are drawn in: units the student has not seen
 * first (shuffled; with `mix`, formats mixed and, when asked, a second format
 * pulled forward), then the stale ones, least served first (ties in shuffled
 * order). The stale tail means a form is always full, even when the student
 * has seen the whole bank. A first-time student has seen nothing: every unit
 * is fresh.
 */
function freshFirst(units: BankItem[][], avoid: Avoid, rng: () => number, mix?: LevelMix): BankItem[][] {
  const fresh = units.filter((u) => !isStale(u, avoid));
  const stale = units.filter((u) => isStale(u, avoid));
  const shuffled = shuffle(fresh, rng);
  const mixed = mix ? mixFormats(shuffled, rng) : shuffled;
  return [
    ...(mix?.secondFormat ? twoFormatsFirst(mixed, mix.want) : mixed),
    ...shuffle(stale, rng).sort((a, b) => unitExposure(a) - unitExposure(b)),
  ];
}

/**
 * A fixed form: the planned item ids, easiest unit first. For reading and
 * listening whole texts are drawn until the level's count is reached, so a
 * level may get a question or two more than asked for. Every draw mixes
 * formats (mixFormats, since 2026-10-24 for first-time students too). In a
 * READING or LISTENING `section` a level also shows two formats when at least
 * two of its fresh units can give it the second one (twoFormatsFirst); grammar
 * singles only mix. With a non-empty `avoid` the units the student has not
 * seen come first (see freshFirst).
 */
export function sampleFixedForm(
  pool: BankItem[],
  perLevel: Record<Cefr, number>,
  rng: () => number,
  avoid?: Avoid,
  section?: Section,
): string[] {
  const secondFormat = section === "READING" || section === "LISTENING";
  const units: Array<{ ids: string[]; b: number }> = [];
  for (const level of CEFR_LEVELS) {
    const want = perLevel[level];
    if (want <= 0) continue;
    // Texts (C-test, cloze, word bank) are never drawn into a form; see textOpenings.
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
    for (const unit of takeUnits(freshFirst(candidates, avoid ?? NOTHING_SEEN, rng, { want, secondFormat }), want)) {
      units.push({ ids: unit.map((i) => i.id), b: unit.reduce((a, i) => a + i.b, 0) / unit.length });
    }
  }
  return units.sort((a, b) => a.b - b.b).flatMap((u) => u.ids);
}

/**
 * Whether a section's texts count as weighted super-items in the estimate.
 * Only sections with `cTestLevels`, `texts` or `relativeTexts`: exams created
 * before 2026-10-15 have `cTest: true` and their stored estimates used weight
 * 1, so re-estimating them (a teacher accepting a gap) must not move the result.
 */
export function weighsTexts(s: SectionConfig): boolean {
  return s.section === "GRAMMAR" && (!!s.cTestLevels || !!s.texts || !!s.relativeTexts);
}

/** The levels of the section's legacy C-tests, easy to hard; empty when it has none. */
export function cTestLevelsOf(s: SectionConfig, mode: ExamMode, claimed: Cefr | null): Cefr[] {
  if (s.section !== "GRAMMAR") return [];
  if (s.cTestLevels) return CEFR_LEVELS.filter((l) => s.cTestLevels!.includes(l));
  return s.cTest ? [anchorLevel(mode, claimed)] : [];
}

/** One text a GRAMMAR section opens with. */
export type TextPlanEntry = { level: Cefr; kind: TextGapKind };

/**
 * The section's listed texts at their levels: `texts` as stored, or
 * `relativeTexts` placed around the anchor level (`shiftLevel` folds an offset
 * that falls off the scale onto the end level). `texts` wins if a config
 * somehow has both (the schema refuses that). Null when it lists neither.
 */
function listedTexts(s: SectionConfig, mode: ExamMode, claimed: Cefr | null): Array<{ level: Cefr; kind: TextGapKind }> | null {
  if (s.texts) return s.texts;
  if (!s.relativeTexts) return null;
  const anchor = anchorLevel(mode, claimed);
  return s.relativeTexts.map((t) => ({ level: shiftLevel(anchor, t.offset), kind: t.kind }));
}

/**
 * The texts that open a section, in serving order; empty when it has none.
 * `texts` or `relativeTexts` (cloze first, then word banks, then open cloze;
 * each easy to hard; a kind and level once, so relative texts that folded onto
 * the same level are served once) replace the legacy C-test fields; without
 * them `cTestLevelsOf` gives C-tests, so a config stored before 2026-10-18
 * plans exactly as it did. Relative texts ignore the difficulty offset, as
 * `texts` do.
 */
export function textPlanOf(s: SectionConfig, mode: ExamMode, claimed: Cefr | null): TextPlanEntry[] {
  if (s.section !== "GRAMMAR") return [];
  const texts = listedTexts(s, mode, claimed);
  if (texts) {
    return (["CLOZE", "WORDBANK", "OPEN"] as const).flatMap((kind) =>
      CEFR_LEVELS.filter((level) => texts.some((t) => t.kind === kind && t.level === level)).map((level) => ({ level, kind })),
    );
  }
  return cTestLevelsOf(s, mode, claimed).map((level) => ({ level, kind: "CTEST" as const }));
}

/** The kinds of text a section opens with, each once, in serving order (cloze, word bank; or C-test). */
export function textKindsOf(s: SectionConfig, mode: ExamMode, claimed: Cefr | null): TextGapKind[] {
  return [...new Set(textPlanOf(s, mode, claimed).map((e) => e.kind))];
}

const fitsEntry = (i: BankItem, e: TextPlanEntry) => i.level === e.level && textGapKindOf(i) === e.kind;

/**
 * The texts that open the section: one per entry of `textPlanOf`, picked at
 * random when the bank has several, in plan order. An entry the bank has no
 * text for is skipped (the section then runs without it). With a non-empty
 * `avoid` a text the student has not seen wins, else the least served one.
 */
export function textOpenings(
  s: SectionConfig,
  pool: BankItem[],
  mode: ExamMode,
  claimed: Cefr | null,
  rng: () => number,
  avoid?: Avoid,
): string[] {
  const ids: string[] = [];
  for (const entry of textPlanOf(s, mode, claimed)) {
    const candidates = pool.filter((i) => fitsEntry(i, entry));
    if (candidates.length === 0) continue;
    ids.push(
      isAvoiding(avoid)
        ? freshFirst(candidates.map((i) => [i]), avoid, rng)[0][0].id
        : candidates[Math.floor(rng() * candidates.length)].id,
    );
  }
  return ids;
}

/** A fixed GRAMMAR section made only of texts: the intro speaks of texts. */
export function isTextOnly(s: SectionConfig, mode: ExamMode, claimed: Cefr | null, difficultyOffset: number): boolean {
  if (s.adaptive || textPlanOf(s, mode, claimed).length === 0) return false;
  return Object.values(resolveDistribution(s, mode, claimed, difficultyOffset)).every((n) => n === 0);
}

/** The item plan of a fixed objective section: its texts, if any, then the form. */
export function planFixedSection(
  s: SectionConfig,
  pool: BankItem[],
  mode: ExamMode,
  claimed: Cefr | null,
  difficultyOffset: number,
  rng: () => number,
  avoid?: Avoid,
): string[] {
  const openings = textOpenings(s, pool, mode, claimed, rng, avoid);
  const form = sampleFixedForm(pool, resolveDistribution(s, mode, claimed, difficultyOffset), rng, avoid, s.section);
  return [...openings, ...form];
}

/** The skill tag of a speaking task built around a picture. */
export const PICTURE_TASK_TAG = "speaking.picture";

/** The first task prefers a picture task, every later one avoids it; each falls back to any task. */
function pictureRule(candidates: BankItem[], index: number): BankItem[] {
  const preferred = candidates.filter((c) => (c.skillTag === PICTURE_TASK_TAG) === (index === 0));
  return preferred.length > 0 ? preferred : candidates;
}

/**
 * The writing or speaking tasks: one per level, avoiding a skill tag twice
 * when the bank allows. A speaking section opens with a picture task when the
 * bank has one at that level (pictureRule). With a non-empty `avoid` a task
 * the student has not seen wins, preferring a skill-tag family not drawn yet
 * in the section; when every task at the level was seen, the least served one.
 * The first slot stays a picture task even when the student has seen them all:
 * it takes an unseen picture task, else the least served one, and only a level
 * with no picture task at all falls back to any task.
 * Without `avoid`, and with no picture task in the pool, the draw is the one
 * made before either rule existed.
 */
export function pickProductive(pool: BankItem[], levels: Cefr[], rng: () => number, avoid?: Avoid): string[] {
  const chosen: string[] = [];
  const tags = new Set<string>();
  const families = new Set<string>();
  levels.forEach((level, index) => {
    const candidates = pool.filter((p) => p.level === level && !chosen.includes(p.id));
    if (candidates.length === 0) return;
    let pick: BankItem;
    if (!isAvoiding(avoid)) {
      const from = pictureRule(candidates, index);
      const newTag = from.filter((c) => !tags.has(c.skillTag));
      const pickFrom = newTag.length > 0 ? newTag : from;
      pick = pickFrom[Math.floor(rng() * pickFrom.length)];
    } else {
      // Slot 0 keeps the picture format: only picture tasks compete, seen or not.
      const pictures = index === 0 ? candidates.filter((c) => c.skillTag === PICTURE_TASK_TAG) : [];
      const field = pictures.length > 0 ? pictures : candidates;
      const unseen = field.filter((c) => !isStale([c], avoid));
      if (unseen.length > 0) {
        const from = pictureRule(unseen, index);
        const newFamily = from.filter((c) => !families.has(skillTagFamily(c.skillTag)));
        const newTag = from.filter((c) => !tags.has(c.skillTag));
        const pickFrom = newFamily.length > 0 ? newFamily : newTag.length > 0 ? newTag : from;
        pick = pickFrom[Math.floor(rng() * pickFrom.length)];
      } else {
        pick = freshFirst(pictureRule(field, index).map((c) => [c]), avoid, rng)[0][0];
      }
    }
    chosen.push(pick.id);
    tags.add(pick.skillTag);
    families.add(skillTagFamily(pick.skillTag));
  });
  return chosen;
}

/**
 * The next unit of an adaptive section. The first units are the section's
 * texts (textPlanOf), one at a time; their partial credit is then the first
 * observations of the estimate.
 */
export function nextAdaptiveItems(
  s: SectionConfig,
  mode: ExamMode,
  claimed: Cefr | null,
  state: AdaptiveState,
  pool: BankItem[],
  config: AdaptiveConfig,
  rng: () => number,
): { itemIds: string[] } | null {
  // The engine never picks a text. Served texts are counted by skill tag, so
  // a reload continues where the student was.
  const plan = textPlanOf(s, mode, claimed).filter((e) => pool.some((i) => fitsEntry(i, e)));
  const served = TEXT_GAP_KINDS.reduce((n, kind) => n + (state.tagCounts[TEXT_GAP_SKILL_TAGS[kind]] ?? 0), 0);
  if (served < plan.length) {
    const candidates = pool.filter((i) => fitsEntry(i, plan[served]) && !state.usedItemIds.includes(i.id));
    if (candidates.length > 0) return { itemIds: [candidates[Math.floor(rng() * candidates.length)].id] };
  }
  return selectNext(state, pool, config, rng);
}

/** Levels an adaptive section may need, for the coverage check. A course test has no adaptive section. */
export function adaptiveLevels(mode: ExamMode, claimed: Cefr | null): Cefr[] {
  if (mode === "COURSE_TEST") return [];
  if (mode === "PLACEMENT" || !claimed) return [...CEFR_LEVELS];
  const i = levelIndex(claimed);
  return CEFR_LEVELS.filter((_, j) => Math.abs(j - i) <= 1);
}

/**
 * Levels of the writing / speaking tasks. Verification tests the claim itself.
 * Placement follows the provisional level from the objective sections and, with
 * more than one task, reaches one level up to see where the ceiling is. A
 * course test asks every task at the course's own level, which the caller
 * passes as `provisional` (the objective sections do not move it).
 */
export function productiveTaskLevels(
  mode: ExamMode,
  claimed: Cefr | null,
  provisional: Cefr,
  tasks: number,
): Cefr[] {
  if (mode === "COURSE_TEST") return Array(tasks).fill(provisional);
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
  /** This row is one of the section's legacy C-tests, not its ordinary items. Set with `text: "CTEST"`. */
  cTest?: true;
  /** This row is one of the section's texts, of this kind, not its ordinary items. */
  text?: TextGapKind;
  /** Course tests: the form this row counts ("B1.1:A"). Unset on a bank row. */
  courseForm?: string;
  ok: boolean;
};

export type BankCount = {
  section: Section;
  level: Cefr;
  /** Items servable today (approved; listening also needs audio). */
  items: number;
  /** Distinct stimuli among those items. */
  stimuli: number;
  /** C-tests among those items. They serve only as an opening, never as ordinary items. */
  cTests?: number;
  /** MC cloze texts among those items. Openings only, as C-tests. */
  clozeTexts?: number;
  /** Word-bank texts among those items. Openings only, as C-tests. */
  wordBanks?: number;
  /** Open cloze texts (one typed word per gap) among those items. Openings only, as C-tests. */
  openTexts?: number;
  /**
   * A course test form ("B1.1:A", spec 2026-10-28): this row counts that form's
   * items only. Course items are never part of the bank's rows, and the bank's
   * coverage ignores course rows (bankCoverage), as every random draw does.
   */
  courseForm?: string;
  /** Course rows: the scored units of those items (a cloze text counts its gaps; `items` counts the item once). */
  points?: number;
};

/**
 * Whether the bank holds enough approved content for this blueprint. With a
 * claimed level it answers for that student; without, for every level the
 * exam could reach. The editor shows this live and invite and publish are
 * refused while it fails, so nobody meets an empty section mid-exam. A course
 * test is covered by its own two forms, not by the bank (courseCoverage), and
 * the other modes never count a course form's rows.
 */
export function bankCoverage(
  counts: BankCount[],
  cfg: BlueprintConfig,
  mode: ExamMode,
  claimed: Cefr | null,
): { ok: boolean; rows: CoverageRow[] } {
  if (mode === "COURSE_TEST") return courseCoverage(counts, cfg);
  const rows: CoverageRow[] = [];
  const get = (section: Section, level: Cefr) => {
    const c = counts.find((x) => !x.courseForm && x.section === section && x.level === level);
    const texts: Record<TextGapKind, number> = { CTEST: c?.cTests ?? 0, CLOZE: c?.clozeTexts ?? 0, WORDBANK: c?.wordBanks ?? 0, OPEN: c?.openTexts ?? 0 };
    // Texts never enter automatic selection, so they do not count as items.
    return { items: (c?.items ?? 0) - texts.CTEST - texts.CLOZE - texts.WORDBANK - texts.OPEN, stimuli: c?.stimuli ?? 0, texts };
  };

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
    const planned = new Set(claims.flatMap((claim) => textPlanOf(s, mode, claim).map((e) => `${e.kind}:${e.level}`)));
    for (const kind of TEXT_GAP_KINDS) {
      for (const l of CEFR_LEVELS) {
        if (!planned.has(`${kind}:${l}`)) continue;
        const available = get(s.section, l).texts[kind];
        rows.push({ section: s.section, level: l, needed: 1, available, ...(kind === "CTEST" ? { cTest: true as const } : {}), text: kind, ok: available >= 1 });
      }
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

