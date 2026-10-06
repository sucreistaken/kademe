import type { I18nText } from "@/db/schema/types";
import { PRESETS } from "@/lib/proctor/policy";
import { section, type BlueprintConfig, type PassRules } from "./blueprint";
import type { ExamMode } from "./types";

/**
 * Ready exam blueprints a school can start from on /exam/exams/new. The numbers
 * are the plan's research blueprint (docs/superpowers/plans/
 * 2026-10-06-exam-ready-templates.md): placement tests of Goethe, telc, onSET
 * and Oxford run about 30-45 minutes, and the level check follows the
 * four-module shape of Goethe-Zertifikat and telc Deutsch. Every template is a
 * plain BlueprintConfig, so the editor changes it like any other exam.
 */

export type ExamTemplateKey = "quick-screen" | "placement" | "level-check";

export type ExamTemplate = {
  key: ExamTemplateKey;
  mode: ExamMode;
  name: I18nText;
  summary: I18nText;
  config: BlueprintConfig;
};

const text = (tr: string, en: string): I18nText => ({ tr, en });

/** Placement keeps the default rules; they only matter if the mode changes. */
const placementRules: PassRules = { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [], minHoldProbability: 0.5 };

const TEMPLATES: readonly ExamTemplate[] = [
  {
    key: "quick-screen",
    mode: "PLACEMENT",
    name: text("Hızlı seviye taraması", "Quick level screen"),
    summary: text(
      "15 dakikalık uyarlanabilir dilbilgisi testi. Kurs danışmanıyla ilk görüşmeden önce kaba bir seviye verir.",
      "A 15-minute adaptive grammar test. Gives a rough level before the first talk with a course advisor.",
    ),
    config: {
      version: 1,
      sections: [
        section("GRAMMAR", 15, { adaptive: true, minItems: 15, maxItems: 30, targetSe: 0.5, cTest: false }),
        section("READING", 12, { enabled: false, adaptive: true, minItems: 5, maxItems: 8, targetSe: 0.55 }),
        section("LISTENING", 12, { enabled: false, adaptive: true, minItems: 5, maxItems: 8, targetSe: 0.55 }),
        section("WRITING", 10, { enabled: false, tasks: 1 }),
        section("SPEAKING", 6, { enabled: false, tasks: 2 }),
      ],
      difficultyOffset: 0,
      resultVisibility: "OVERALL",
      autoRelease: true,
      passRules: placementRules,
      proctoring: PRESETS.STANDARD,
      listening: { maxPlays: 2 },
    },
  },
  {
    key: "placement",
    mode: "PLACEMENT",
    name: text("Yerleştirme sınavı", "Placement test"),
    summary: text(
      "Dört beceri, yaklaşık 57 dakika. Öğrenciyi doğru sınıfa yerleştirir; sonucu öğretmen onaylar.",
      "Four skills, about 57 minutes. Places the student in the right class; a teacher confirms the result.",
    ),
    config: {
      version: 1,
      sections: [
        // Opens with one B1 C-test; the five extra minutes are for it.
        section("GRAMMAR", 17, { adaptive: true, minItems: 10, maxItems: 16, targetSe: 0.45, cTest: true }),
        section("READING", 12, { adaptive: true, minItems: 5, maxItems: 8, targetSe: 0.55 }),
        section("LISTENING", 12, { adaptive: true, minItems: 5, maxItems: 8, targetSe: 0.55 }),
        section("WRITING", 10, { tasks: 1 }),
        section("SPEAKING", 6, { tasks: 2 }),
      ],
      difficultyOffset: 0,
      resultVisibility: "OVERALL",
      autoRelease: false,
      passRules: placementRules,
      proctoring: PRESETS.STRICT,
      listening: { maxPlays: 2 },
    },
  },
  {
    key: "level-check",
    mode: "LEVEL_VERIFICATION",
    name: text("Dört beceride seviye kontrolü", "Four-skill level check"),
    summary: text(
      "Goethe ve telc düzeninde sabit form, yaklaşık 97 dakika. Beyan edilen seviyeyi dört beceride ölçer; konuşma şart.",
      "A fixed form in the Goethe and telc shape, about 97 minutes. Checks the claimed level in all four skills; speaking must hold.",
    ),
    config: {
      version: 1,
      sections: [
        section("READING", 25, { distribution: { kind: "RELATIVE", below: 2, at: 6, above: 2 } }),
        section("LISTENING", 20, { distribution: { kind: "RELATIVE", below: 2, at: 5, above: 2 } }),
        section("GRAMMAR", 15, { distribution: { kind: "RELATIVE", below: 3, at: 6, above: 3 }, cTest: false }),
        section("WRITING", 25, { tasks: 2 }),
        section("SPEAKING", 12, { tasks: 2 }),
      ],
      difficultyOffset: 0,
      resultVisibility: "FULL",
      autoRelease: false,
      passRules: { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: ["SPEAKING"], minHoldProbability: 0.5 },
      proctoring: PRESETS.STRICT,
      listening: { maxPlays: 2 },
    },
  },
];

/** Copies, so a caller that edits a config never changes the template. */
export const EXAM_TEMPLATES: ExamTemplate[] = TEMPLATES.map((t) => structuredClone(t));

export function examTemplateByKey(key: string): ExamTemplate | null {
  const t = TEMPLATES.find((x) => x.key === key);
  return t ? structuredClone(t) : null;
}
