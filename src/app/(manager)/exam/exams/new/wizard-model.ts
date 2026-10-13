import { defaultBlueprint, enabledSections, type BlueprintConfig, type SectionConfig } from "@/lib/exam/blueprint";
import type { ExamTemplateKey } from "@/lib/exam/templates";
import { isObjectiveSection, type ExamMode, type Section } from "@/lib/exam/types";
import { PRESETS, type PolicyPreset } from "@/lib/proctor/policy";

/**
 * "Sınav oluştur" as a guided flow (user decision 2026-10-14: every manager
 * flow follows the hiring setup wizard). Four steps, one decision each: how
 * to start (a ready template, recommended, or blank), the sections and their
 * minutes, how closely the exam is watched, and a last look before
 * publishing. Everything finer (adaptive limits, result rules, single
 * proctoring switches) stays in the exam's editor, one link away.
 */
export const EXAM_WIZARD_STEPS = ["start", "sections", "proctoring", "review"] as const;
export type ExamWizardStep = (typeof EXAM_WIZARD_STEPS)[number];

/** The template the start step marks "Önerilen" and selects first: the four-skill placement test. */
export const RECOMMENDED_TEMPLATE: ExamTemplateKey = "placement";

export type ExamStart = { kind: "template"; key: string } | { kind: "blank"; mode: ExamMode };

/** One ready template as the wizard needs it. */
export type WizardTemplate = { key: string; mode: ExamMode; name: string; config: BlueprintConfig };

/** The recommended template first, the others in their order. */
export function orderTemplates<T extends { key: string }>(templates: readonly T[]): T[] {
  return [...templates.filter((t) => t.key === RECOMMENDED_TEMPLATE), ...templates.filter((t) => t.key !== RECOMMENDED_TEMPLATE)];
}

/** The mode and config a start gives, before the manager changes anything; null for a template that does not exist. */
export function startDraft(start: ExamStart, templates: readonly WizardTemplate[]): { mode: ExamMode; config: BlueprintConfig } | null {
  if (start.kind === "blank") return { mode: start.mode, config: defaultBlueprint(start.mode) };
  const template = templates.find((t) => t.key === start.key);
  return template ? { mode: template.mode, config: structuredClone(template.config) } : null;
}

/** The step 2 choice for one section: on or off, and its minutes. */
export type SectionChoice = { section: Section; enabled: boolean; minutes: number };

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 180;
export const clampMinutes = (n: number): number => Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(Number.isFinite(n) ? n : MIN_MINUTES)));

export const sectionChoices = (config: BlueprintConfig): SectionChoice[] =>
  config.sections.map((s) => ({ section: s.section, enabled: s.enabled, minutes: s.durationMinutes }));

/**
 * The config with the step 2 choices on it. Only `enabled` and the minutes
 * change; the order and everything else of each section stay as the start
 * gave them. A choice for a section the config does not have is ignored.
 */
export function withSections(config: BlueprintConfig, choices: readonly SectionChoice[]): BlueprintConfig {
  return {
    ...config,
    sections: config.sections.map((s) => {
      const c = choices.find((x) => x.section === s.section);
      return c ? { ...s, enabled: c.enabled, durationMinutes: clampMinutes(c.minutes) } : s;
    }),
  };
}

/** The config watched at one of the three levels; automatic termination stays as it was (off in every preset). */
export function withProctoring(config: BlueprintConfig, preset: PolicyPreset): BlueprintConfig {
  return { ...config, proctoring: { ...structuredClone(PRESETS[preset]), termination: config.proctoring.termination } };
}

/** The whole draft: the start's config, then the sections, then the watching level. */
export function wizardConfig(base: BlueprintConfig, choices: readonly SectionChoice[], preset: PolicyPreset): BlueprintConfig {
  return withProctoring(withSections(base, choices), preset);
}

export const totalMinutes = (choices: readonly SectionChoice[]): number => choices.filter((c) => c.enabled).reduce((m, c) => m + clampMinutes(c.minutes), 0);

/** Step 2 waits while no section is on. */
export const sectionsWait = (choices: readonly SectionChoice[]): "NO_SECTION" | null => (choices.some((c) => c.enabled) ? null : "NO_SECTION");

/**
 * How a section picks its questions, in the words step 2 and the editor use:
 * an adaptive objective section follows the student's answers, a fixed one
 * gives everyone a set number per level, writing and speaking are tasks a
 * teacher grades.
 */
export function sectionKind(s: Pick<SectionConfig, "section" | "adaptive">): "adaptive" | "fixed" | "tasks" {
  if (!isObjectiveSection(s.section)) return "tasks";
  return s.adaptive ? "adaptive" : "fixed";
}

/**
 * The editor's "Seviyeyi kaydır": it moves every fixed-form level one step
 * (resolveDistribution); adaptive sections follow the student's answers and
 * ignore it (exam-flow plans only fixed sections with it). So it applies to
 * the enabled fixed objective sections, and is off when there are none.
 */
export function levelShiftScope(config: BlueprintConfig): { applies: boolean; fixed: Section[]; adaptive: Section[] } {
  const objective = enabledSections(config).filter((s) => isObjectiveSection(s.section));
  const fixed = objective.filter((s) => !s.adaptive).map((s) => s.section);
  const adaptive = objective.filter((s) => s.adaptive).map((s) => s.section);
  return { applies: fixed.length > 0, fixed, adaptive };
}
