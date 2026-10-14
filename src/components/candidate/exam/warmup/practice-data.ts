import { toCandidateItem, type CandidateItem } from "@/lib/exam/safe";
import type { ItemSnapshot, Section } from "@/lib/exam/types";
import type { ValidatableItem } from "@/lib/exam/validate";

/**
 * Practice questions for the optional warm-up on a section introduction.
 *
 * Fixed, original and very easy, written here and not drawn from the bank. They
 * never reach the server and are never scored: the keys exist only so the
 * data passes the same structural checks as a bank item (validate.ts) and the
 * real item components can draw it. Listening has no sample recording, so it
 * shows the true/false controls on a written sample; writing and speaking
 * show the answer area without recording.
 */

export type PracticeDef = ValidatableItem & {
  /** "grammar.ctest" draws the gaps attached to their word stems. */
  skillTag?: string;
  /** A reading passage drawn above the question. */
  passage?: { title: string; body: string };
  /** Listening: a written sample standing in for the recording. */
  sample?: { text: string };
};

const ANNA = {
  title: "Anna",
  body: "Anna wohnt in Berlin. Sie arbeitet in einem Café. Am Wochenende besucht sie ihre Eltern.",
};

export const PRACTICE: Record<Section, PracticeDef[]> = {
  GRAMMAR: [
    {
      type: "SINGLE_CHOICE",
      prompt: "Wählen Sie die richtige Form.\n\nIch ___ Ayşe.",
      content: {
        kind: "CHOICE",
        options: [
          { id: "a", text: "ist" },
          { id: "b", text: "bin" },
          { id: "c", text: "bist" },
        ],
      },
      key: { kind: "CHOICE", correct: ["b"] },
    },
    {
      type: "GAP_FILL",
      skillTag: "grammar.ctest",
      prompt: "Ergänzen Sie die Wörter. Schreiben Sie nur die fehlenden Buchstaben.\n\nHeute ist das Wetter sch{{g1}}. Die Sonne sch{{g2}} und es ist wa{{g3}}.",
      content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }, { id: "g3" }] },
      key: { kind: "GAP", answers: { g1: ["ön", "schön"], g2: ["eint", "scheint"], g3: ["rm", "warm"] } },
    },
  ],
  READING: [
    {
      type: "TRUE_FALSE_NG",
      prompt: "Richtig oder falsch?",
      passage: ANNA,
      content: {
        kind: "TFNG",
        statements: [
          { id: "s1", text: "Anna wohnt in Berlin." },
          { id: "s2", text: "Anna arbeitet in einer Schule." },
        ],
      },
      key: { kind: "TFNG", answers: { s1: "R", s2: "F" } },
    },
    {
      type: "MATCHING",
      prompt: "Ordnen Sie zu.",
      passage: ANNA,
      content: {
        kind: "MATCHING",
        left: [
          { id: "l1", text: "Wo arbeitet Anna?" },
          { id: "l2", text: "Wen besucht Anna am Wochenende?" },
        ],
        right: [
          { id: "r1", text: "Ihre Eltern" },
          { id: "r2", text: "In einem Café" },
          { id: "r3", text: "In einer Schule" },
        ],
      },
      key: { kind: "MATCHING", pairs: { l1: "r2", l2: "r1" } },
    },
  ],
  LISTENING: [
    {
      type: "TRUE_FALSE_NG",
      prompt: "Richtig oder falsch?",
      sample: { text: "Der Zug nach München fährt um neun Uhr ab. Er kommt um zwölf Uhr an." },
      content: {
        kind: "TFNG",
        statements: [
          { id: "s1", text: "Der Zug fährt um neun Uhr ab." },
          { id: "s2", text: "Der Zug kommt um elf Uhr an." },
        ],
      },
      key: { kind: "TFNG", answers: { s1: "R", s2: "F" } },
    },
  ],
  WRITING: [
    {
      type: "WRITING_PROMPT",
      prompt: "Schreiben Sie ein paar Sätze über Ihr Wochenende. Schreiben Sie mindestens 10 Wörter.",
      content: { kind: "WRITING", minWords: 10, maxWords: 60 },
      key: { kind: "NONE" },
      rubric: { contentPoints: ["Wochenende"] },
    },
  ],
  SPEAKING: [
    {
      type: "SPEAKING_PROMPT",
      prompt: "Stellen Sie sich kurz vor: Name, Wohnort, Hobby.",
      content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 },
      key: { kind: "NONE" },
      rubric: { contentPoints: ["Name", "Wohnort", "Hobby"] },
    },
  ],
};

/** Which hint a practice step carries, picked from what the step shows. */
export type PracticeHint = "choice" | "ctest" | "tfng" | "matching" | "listening" | "writing" | "speaking";

export function hintOf(def: PracticeDef): PracticeHint {
  if (def.skillTag === "grammar.ctest") return "ctest";
  switch (def.content.kind) {
    case "TFNG":
      return def.sample ? "listening" : "tfng";
    case "MATCHING":
      return "matching";
    case "WRITING":
      return "writing";
    case "SPEAKING":
      return "speaking";
    default:
      return "choice";
  }
}

/** The item as the exam components draw it, built the way the server builds a real one. */
export function practiceItem(section: Section, index: number): CandidateItem {
  const def = PRACTICE[section][index];
  const snapshot: ItemSnapshot = {
    id: `practice-${section}-${index}`,
    section,
    level: "A1",
    difficulty: 0,
    type: def.type,
    skillTag: def.skillTag ?? "practice",
    stimulusId: null,
    orderInStimulus: 0,
    prompt: def.prompt,
    content: def.content,
    key: def.key,
    rubric: def.rubric ?? null,
    points: 1,
    // The passage is drawn by the warm-up itself, above the question.
    stimulus: null,
  };
  return toCandidateItem(snapshot, {}, null, index + 1, { maxPlays: 0 });
}
