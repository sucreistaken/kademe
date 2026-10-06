import { z } from "zod";
import type { Locale } from "@/i18n/locale";
import { blueprintConfigSchema, enabledSections, estimatedMinutes, type BlueprintConfig, type CoverageRow, type SectionConfig } from "@/lib/exam/blueprint";
import { EXAM_TEMPLATES, type ExamTemplate } from "@/lib/exam/templates";
import { isObjectiveSection, SECTIONS, type Cefr, type ExamMode, type Section } from "@/lib/exam/types";

/**
 * EXAM creator, pure part (spec 5.4): the nearest ready template, sections on
 * or off, minutes scaled to the target with the emphasis section taking the
 * larger share, every value inside sectionConfigSchema. No AI. Client-safe.
 */

export const SECTION_LABEL: Record<Section, { tr: string; en: string }> = {
  GRAMMAR: { tr: "Dilbilgisi", en: "Grammar" },
  READING: { tr: "Okuma", en: "Reading" },
  LISTENING: { tr: "Dinleme", en: "Listening" },
  WRITING: { tr: "Yazma", en: "Writing" },
  SPEAKING: { tr: "Konuşma", en: "Speaking" },
};

export const MIN_SECTION_MINUTES = 3;
export const EMPHASIS_FACTOR = 1.5;
const MIN_TARGET = 10;
const MAX_TARGET = 120;

export type ExamShape = { mode: ExamMode; targetMinutes: number | null; skills: Section[]; emphasis: Section | null; speakingRequired: boolean | null };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Named skills must match the template's sections (the emphasis counts as
 * named). With no skills named, only a template that lacks the emphasis
 * section is pushed back: "okuma ağırlıklı" means more reading, not reading only.
 */
export function examTemplateFor(p: ExamShape): ExamTemplate {
  const want = new Set<Section>(p.skills);
  const score = (t: ExamTemplate) => {
    const on = new Set(enabledSections(t.config).map((s) => s.section));
    const differ = want.size
      ? SECTIONS.filter((s) => on.has(s) !== (want.has(s) || s === p.emphasis)).length
      : p.emphasis && !on.has(p.emphasis)
        ? 1
        : 0;
    const minutes = p.targetMinutes ? Math.abs(estimatedMinutes(t.config) - p.targetMinutes) : 0;
    return differ * 30 + minutes;
  };
  const candidates = EXAM_TEMPLATES.filter((t) => t.mode === p.mode);
  return [...candidates].sort((a, b) => score(a) - score(b))[0];
}

/**
 * Whole minutes per section that add up to the target exactly: every section
 * gets `min`, the rest is split by weight, leftovers go to the largest
 * fractions. A target below n * min returns the minimums.
 */
export function allocateMinutes(target: number, weights: number[], min: number): number[] {
  const floor = min * weights.length;
  if (target <= floor) return weights.map(() => min);
  const rest = target - floor;
  const sum = weights.reduce((a, w) => a + w, 0);
  const raw = weights.map((w) => (rest * w) / sum);
  const out = raw.map((r) => min + Math.floor(r));
  let left = target - out.reduce((a, n) => a + n, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].i] += 1;
  return out;
}

/** Item counts follow the time: an adaptive section's limits and a fixed form's per-level counts scale with it. */
function rescaleSection(s: SectionConfig, minutes: number, baseMinutes: number) {
  const f = minutes / baseMinutes;
  s.durationMinutes = minutes;
  if (!isObjectiveSection(s.section)) return;
  if (s.adaptive) {
    s.minItems = clamp(Math.round(s.minItems * f), 1, 60);
    s.maxItems = clamp(Math.max(Math.round(s.maxItems * f), s.minItems), 1, 80);
  } else if (s.distribution.kind === "RELATIVE") {
    const d = s.distribution;
    s.distribution = {
      kind: "RELATIVE",
      below: clamp(Math.round(d.below * f), 0, 60),
      at: clamp(Math.round(d.at * f), 1, 60),
      above: clamp(Math.round(d.above * f), 0, 60),
    };
  }
}

export function buildExamConfig(p: ExamShape): { template: ExamTemplate; config: BlueprintConfig } {
  const template = examTemplateFor(p);
  const config = structuredClone(template.config);
  const base = new Map(config.sections.map((s) => [s.section, s.durationMinutes]));
  const on = new Set<Section>(p.skills.length ? p.skills : enabledSections(template.config).map((s) => s.section));
  if (p.emphasis) on.add(p.emphasis);
  if (p.speakingRequired === true) on.add("SPEAKING");
  if (p.speakingRequired === false) on.delete("SPEAKING");
  if (on.size === 0) for (const s of enabledSections(template.config)) if (s.section !== "SPEAKING") on.add(s.section);
  for (const s of config.sections) s.enabled = on.has(s.section);
  const enabled = config.sections.filter((s) => s.enabled);
  const baseOf = (s: SectionConfig) => base.get(s.section) ?? s.durationMinutes;
  const target = clamp(p.targetMinutes ?? enabled.reduce((m, s) => m + baseOf(s), 0), MIN_TARGET, MAX_TARGET);
  const top = Math.max(...enabled.map(baseOf));
  const weights = enabled.map((s) => (s.section === p.emphasis ? top * EMPHASIS_FACTOR : baseOf(s)));
  const minutes = allocateMinutes(target, weights, MIN_SECTION_MINUTES);
  enabled.forEach((s, i) => rescaleSection(s, minutes[i], baseOf(s)));
  // A pass rule may only name a section the exam has.
  config.passRules.requiredSkills = config.passRules.requiredSkills.filter((s) => on.has(s));
  if (p.speakingRequired === true && p.mode === "LEVEL_VERIFICATION" && !config.passRules.requiredSkills.includes("SPEAKING")) {
    config.passRules.requiredSkills.push("SPEAKING");
  }
  return { template, config: blueprintConfigSchema.parse(config) };
}

export type CoverageGap = { section: Section; level: Cefr; missing: number; cTest: boolean };

export function coverageGaps(rows: CoverageRow[]): CoverageGap[] {
  return rows.filter((r) => !r.ok).map((r) => ({ section: r.section, level: r.level, missing: Math.max(1, r.needed - r.available), cTest: !!r.cTest }));
}

export function defaultExamName(templateName: string, minutes: number, locale: Locale): string {
  return `${templateName}, ${minutes} ${locale === "tr" ? "dk" : "min"}`;
}

export type SectionEdit = { section: Section; enabled: boolean; durationMinutes: number };

export const examEditsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sections: z
    .array(z.object({ section: z.enum(SECTIONS), enabled: z.boolean(), durationMinutes: z.number().int().min(1).max(180) }))
    .max(SECTIONS.length),
});
export type ExamEdits = z.infer<typeof examEditsSchema>;

/** The card's edits on a copy of the config; null when the result is not a valid exam. */
export function applyExamEdits(config: BlueprintConfig, edits: ExamEdits): BlueprintConfig | null {
  const next = structuredClone(config);
  for (const e of edits.sections) {
    const s = next.sections.find((x) => x.section === e.section);
    if (!s) return null;
    s.enabled = e.enabled;
    s.durationMinutes = e.durationMinutes;
  }
  next.passRules.requiredSkills = next.passRules.requiredSkills.filter((sec) => next.sections.some((s) => s.section === sec && s.enabled));
  const parsed = blueprintConfigSchema.safeParse(next);
  return parsed.success ? parsed.data : null;
}

export function initialSectionEdits(config: BlueprintConfig): SectionEdit[] {
  return config.sections.map((s) => ({ section: s.section, enabled: s.enabled, durationMinutes: s.durationMinutes }));
}

export function editedTotal(edits: SectionEdit[]): number {
  return edits.filter((e) => e.enabled).reduce((m, e) => m + e.durationMinutes, 0);
}
