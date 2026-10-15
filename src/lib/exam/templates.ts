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
 * section cannot allow. Reading and listening draw whole texts and clips of
 * four questions, one per level: reading A2 to C1, listening A2 to B2 (a clip
 * is slower than a text). An A1 student is placed by failing the A2 text, a C1
 * or C2 one by passing the top text and the grammar above it; six texts would
 * not fit the time. The adaptive settings stay in each section (minItems,
 * maxItems, targetSe), so switching a section to adaptive in the editor starts
 * from the earlier, simulated values.
 *
 * Grammar is C-tests (spec 2026-10-15, the onSET shape): the placement form
 * has six, one per level A1 to C2, about five minutes each (30 minutes, about
 * 77 for the whole test); the quick screen has three, A2 to B2, in 15 minutes.
 * A C-test is one weighted observation per text, not a list of items.
 *
 * Measured on simulated students, uniform inside each band, 4000 per level
 * (scripts/simulate-placement.ts, Rasch model only), exact / within one level,
 * pooled objective skills:
 *   placement, before (multiple-choice grammar, one B1 C-test):
 *     A1 66/100  A2 76/100  B1 79/100  B2 77/100  C1 68/100  C2 39/99
 *   placement, after (six C-tests):
 *     A1 70/100  A2 81/100  B1 83/100  B2 81/100  C1 73/100  C2 47/100
 *   quick screen, before (24 multiple-choice items):
 *     A1 65/99  A2 66/100  B1 64/99  B2 62/99  C1 55/99  C2 62/98
 *   quick screen, after (three C-tests):
 *     A1 65/100  A2 75/100  B1 70/100  B2 76/100  C1 60/100  C2 28/98
 * Both gates passed. The quick screen's C2 exact rate drops (62% to 28%)
 * because its hardest text is B2, so a C2 student is mostly placed at B2 or
 * C1; the other levels hold or improve. templates.test.ts keeps a smaller
 * version of the placement simulation.
 */

const perLevel = (counts: Partial<Record<Cefr, number>>): Distribution => ({
  kind: "ABSOLUTE",
  perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, ...counts },
});

/** No ordinary items: the section is its C-tests. */
const NO_ITEMS = perLevel({});
/** One C-test per level, easy to hard: the onSET shape (spec 2026-10-15). */
const C_TESTS_A1_C2: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
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
      "15 dakikalık üç C-test (A2, B1, B2): öğrenci eksik harfleri kendisi yazar. Kurs danışmanıyla ilk görüşmeden önce kaba bir seviye verir.",
      "Three C-tests in 15 minutes (A2, B1, B2): the student types the missing letters. Gives a rough level before the first talk with a course advisor.",
    ),
    config: {
      version: 1,
      sections: [
        // Three C-tests, A2 to B2, about five minutes each.
        section("GRAMMAR", 15, { distribution: NO_ITEMS, cTestLevels: ["A2", "B1", "B2"], minItems: 15, maxItems: 30, targetSe: 0.5 }),
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
      "Dört beceri, yaklaşık 77 dakika. Dilbilgisi onSET düzeninde altı C-testle ölçülür: öğrenci eksik harfleri kendisi yazar. Bölüm içinde geri dönülebilir, soru işaretlenebilir. Öğrenciyi doğru sınıfa yerleştirir; sonucu öğretmen onaylar.",
      "Four skills, about 77 minutes. Grammar is measured with six C-tests in the onSET shape: the student types the missing letters. Within a section the student can go back and flag questions. Places the student in the right class; a teacher confirms the result.",
    ),
    config: {
      version: 1,
      sections: [
        // Six C-tests, A1 to C2, about five minutes each (onSET: eight texts, five minutes each).
        section("GRAMMAR", 30, { distribution: NO_ITEMS, cTestLevels: [...C_TESTS_A1_C2], minItems: 10, maxItems: 16, targetSe: 0.45 }),
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
