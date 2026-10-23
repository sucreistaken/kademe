import type { I18nText } from "@/db/schema/types";
import { PRESETS } from "@/lib/proctor/policy";
import { section, type BlueprintConfig, type Distribution, type PassRules, type SectionConfig } from "./blueprint";
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
 * Grammar is gap-fill texts (spec 2026-10-18, which replaced the onSET
 * C-tests of 2026-10-15 for new exams): multiple-choice cloze texts (11 gaps,
 * four options each) and word banks (8 gaps, whole words dragged from a pool
 * with 4-5 extra words), cloze texts first, each kind easy to hard. A text is
 * one weighted observation (gaps / 4) with a guessing floor (a quarter for a
 * cloze gap, one over the pool for a word bank). The placement form has
 * cloze texts A1 to B2, word banks A2 to B2 and open cloze texts (about 10
 * typed gaps, no guessing floor) at C1 and C2 (30 minutes, about 77 for the
 * whole test; until 2026-10-23 six cloze texts A1 to C2 and the same word
 * banks); the quick screen has cloze texts A1 to B2 and word banks A1 to B1
 * (25 minutes). Reading time: about 3.5 minutes a cloze or open cloze text, 3
 * a word bank, rounded up to five.
 *
 * Measured on simulated students who guess (scripts/simulate-placement.ts,
 * 4000 per level, seed 2026; a quarter on every multiple-choice item and
 * cloze gap, one over the pool on a word-bank gap; a text's gaps share a
 * random effect), exact / within one level / placed too high, %, pooled
 * objective skills:
 *   placement, (a) multiple-choice grammar before onSET:
 *     A1 0/41/100  A2 7/90/93  B1 32/99/68  B2 63/100/36  C1 83/100/10  C2 63/100/0
 *   placement, (b) six C-tests:
 *     A1 6/93/94  A2 35/100/65  B1 66/100/33  B2 84/100/12  C1 84/100/3  C2 59/100/0
 *   placement, (c) six cloze texts + three word banks (until 2026-10-23):
 *     A1 2/76/98  A2 23/99/77  B1 58/100/42  B2 80/100/17  C1 83/100/2  C2 44/100/0
 *   placement, (c) four cloze texts + three word banks + open cloze C1, C2:
 *     A1 3/79/97  A2 24/99/76  B1 60/100/40  B2 83/100/14  C1 82/100/3  C2 49/100/0
 *   quick screen, (a) 24 multiple-choice items:
 *     A1 3/41/98  A2 12/71/88  B1 28/87/71  B2 45/93/52  C1 53/100/38  C2 83/100/0
 *   quick screen, (b) three C-tests A2 to B2:
 *     A1 65/100/35  A2 75/100/18  B1 70/100/15  B2 76/100/7  C1 60/100/2  C2 28/98/0
 *   quick screen, (c) four cloze texts + three word banks:
 *     A1 66/100/34  A2 74/100/19  B1 75/100/12  B2 71/100/6  C1 53/100/0  C2 0/95/0
 * Gate (spec 2026-10-18, section 4), A1 to C1: exact at most 2 points below
 * (a), within one at most 1 below (a), A1 placed too high at most 5 points
 * above (b). Both forms pass at seeds 2026 and 7; each is the smallest of the
 * compositions tried that does (the 15-minute quick screen of the spec placed
 * 66% of A1 students too high). The open cloze placement (2026-10-23) also
 * passes at both seeds in the same 30 minutes, so it replaced the six cloze
 * texts. The low A1 and A2 exact rates of the
 * placement come from guessing on its reading and listening items, which the
 * engine gives no floor; they hit (a), (b) and (c) alike. The quick screen
 * has no text above B2, so a C2 student is placed at C1. docs/EXAM-ENGINE.md
 * has every row; templates.test.ts keeps a smaller version of the placement
 * simulation.
 */

const perLevel = (counts: Partial<Record<Cefr, number>>): Distribution => ({
  kind: "ABSOLUTE",
  perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, ...counts },
});

/** No ordinary items: the section is its texts. */
const NO_ITEMS = perLevel({});
/** Cloze texts, then word banks, then open cloze texts, each easy to hard (specs 2026-10-18 and 2026-10-23). */
const texts = (cloze: Cefr[], wordBanks: Cefr[], open: Cefr[] = []): NonNullable<SectionConfig["texts"]> => [
  ...cloze.map((level) => ({ level, kind: "CLOZE" as const })),
  ...wordBanks.map((level) => ({ level, kind: "WORDBANK" as const })),
  ...open.map((level) => ({ level, kind: "OPEN" as const })),
];
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
      "25 dakikalık dilbilgisi: A1'den B2'ye dört çoktan seçmeli boşluklu metin ve üç kelime havuzu. Kurs danışmanıyla ilk görüşmeden önce kaba bir seviye verir.",
      "Grammar in 25 minutes: four multiple-choice cloze texts and three word banks from A1 to B2. Gives a rough level before the first talk with a course advisor.",
    ),
    config: {
      version: 1,
      sections: [
        // Cloze texts A1 to B2, then word banks A1 to B1: the smallest form that passed the gate (see above).
        section("GRAMMAR", 25, { distribution: NO_ITEMS, texts: texts(["A1", "A2", "B1", "B2"], ["A1", "A2", "B1"]), minItems: 15, maxItems: 30, targetSe: 0.5 }),
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
      "Dört beceri, yaklaşık 77 dakika. Dilbilgisi A1'den B2'ye dört çoktan seçmeli boşluklu metin, üç kelime havuzu ve C1, C2'de iki açık boşluklu metinle ölçülür. Bölüm içinde geri dönülebilir, soru işaretlenebilir. Öğrenciyi doğru sınıfa yerleştirir; sonucu öğretmen onaylar.",
      "Four skills, about 77 minutes. Grammar is measured with four multiple-choice cloze texts from A1 to B2, three word banks and two open cloze texts at C1 and C2. Within a section the student can go back and flag questions. Places the student in the right class; a teacher confirms the result.",
    ),
    config: {
      version: 1,
      sections: [
        // Cloze texts A1 to B2, word banks A2 to B2, open cloze C1 and C2 in place of the C1 and C2 cloze texts
        // (2026-10-23): the same 30 minutes, and it passed the gate at both seeds (see above).
        section("GRAMMAR", 30, { distribution: NO_ITEMS, texts: texts(["A1", "A2", "B1", "B2"], ["A2", "B1", "B2"], ["C1", "C2"]), minItems: 10, maxItems: 16, targetSe: 0.45 }),
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
