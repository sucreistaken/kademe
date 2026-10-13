import type { I18nText } from "@/db/schema/types";
import { PRESETS } from "@/lib/proctor/policy";
import { section, type BlueprintConfig, type Distribution, type PassRules } from "./blueprint";
import type { Cefr, ExamMode } from "./types";

/**
 * Ready exam blueprints a school can start from on /exam/exams/new. The numbers
 * are the plan's research blueprint (docs/superpowers/plans/
 * 2026-10-06-exam-ready-templates.md): placement tests of Goethe, telc, onSET
 * and Oxford run about 30-45 minutes, and the level check follows the
 * four-module shape of Goethe-Zertifikat and telc Deutsch. Every template is a
 * plain BlueprintConfig, so the editor changes it like any other exam.
 *
 * All three are fixed forms (2026-10-14 decision): the student can go back,
 * flag items and review a section before finishing it, which an adaptive
 * section cannot allow. The placement forms spread their items over the levels
 * (ABSOLUTE), because a placement student can be anywhere; a RELATIVE form
 * would only reach A2-B2 around the B1 anchor. Grammar spreads three items
 * over every level. Reading and listening draw whole texts and clips of four
 * questions, one per level: reading A2 to C1, listening A2 to B2 (a clip is
 * slower than a text). An A1 student is placed by failing the A2 text, a C1
 * or C2 one by passing the top text and the grammar above it; six texts would
 * not fit the time. The adaptive settings stay in each section (minItems,
 * maxItems, targetSe), so switching a section to adaptive in the editor starts
 * from the earlier, simulated values.
 *
 * Measured on simulated students, uniform inside each band, 1000 per level
 * (2026-10-14, Rasch model only, testlet dependence ignored): the fixed
 * placement form puts the pooled objective level exactly right 68-80% of the
 * time at A1-C1 and within one level 99-100%, as the earlier adaptive form did
 * (66-78%, 99-100%, 400 per level). C2 is exact less often on both (40%, 47%).
 * templates.test.ts keeps a smaller version of that simulation.
 */

const perLevel = (counts: Partial<Record<Cefr, number>>): Distribution => ({
  kind: "ABSOLUTE",
  perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, ...counts },
});

/** Three grammar items per level: with the opening C-test as good as the earlier adaptive 10-16 (simulated). */
const GRAMMAR_SPREAD = perLevel({ A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 });
/** One text of four questions per level, A2 to C1. */
const READING_A2_C1 = perLevel({ A2: 4, B1: 4, B2: 4, C1: 4 });
/** One clip of four questions per level, A2 to B2. */
const LISTENING_A2_B2 = perLevel({ A2: 4, B1: 4, B2: 4 });

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
      "15 dakikalık dilbilgisi testi, A1'den C2'ye 24 soru. Kurs danışmanıyla ilk görüşmeden önce kaba bir seviye verir.",
      "A 15-minute grammar test, 24 questions from A1 to C2. Gives a rough level before the first talk with a course advisor.",
    ),
    config: {
      version: 1,
      sections: [
        // Four per level: as close to the earlier adaptive 15-30 as a fixed form gets in 15 minutes (simulated).
        section("GRAMMAR", 15, { distribution: perLevel({ A1: 4, A2: 4, B1: 4, B2: 4, C1: 4, C2: 4 }), minItems: 15, maxItems: 30, targetSe: 0.5, cTest: false }),
        section("READING", 18, { enabled: false, distribution: READING_A2_C1, minItems: 5, maxItems: 8, targetSe: 0.55 }),
        section("LISTENING", 13, { enabled: false, distribution: LISTENING_A2_B2, minItems: 5, maxItems: 8, targetSe: 0.55 }),
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
      "Dört beceri, yaklaşık 64 dakika. Öğrenci bölüm içinde sorular arasında geri dönebilir ve soruları işaretleyebilir. Öğrenciyi doğru sınıfa yerleştirir; sonucu öğretmen onaylar.",
      "Four skills, about 64 minutes. Within a section the student can go back and flag questions. Places the student in the right class; a teacher confirms the result.",
    ),
    config: {
      version: 1,
      sections: [
        // Opens with one B1 C-test (about five minutes), then 18 questions from A1 to C2.
        section("GRAMMAR", 17, { distribution: GRAMMAR_SPREAD, minItems: 10, maxItems: 16, targetSe: 0.45, cTest: true }),
        // Four texts of about 130 (A2) to 470 (C1) words, 16 questions.
        section("READING", 18, { distribution: READING_A2_C1, minItems: 5, maxItems: 8, targetSe: 0.55 }),
        // Three clips of 0.5-2.5 minutes, each played up to twice, 12 questions.
        section("LISTENING", 13, { distribution: LISTENING_A2_B2, minItems: 5, maxItems: 8, targetSe: 0.55 }),
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
