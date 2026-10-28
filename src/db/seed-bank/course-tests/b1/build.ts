import { typedMatches } from "@/lib/exam/item-scoring";
import { CLOZE_SKILL_TAG } from "@/lib/exam/types";
import { markGaps, splitTopic } from "../../cloze";
import type { SeedItem, SeedStimulus } from "../../types";

/*
 * Builders for the four B1 course test forms (spec 2026-10-28). The bank's cloze() builder writes four-choice
 * gaps only; the course tests use the school's a/b/c gaps, so abcCloze() below builds the same item shape with
 * three choices in the order the author writes them.
 */

export const LEVEL = "B1" as const;

const IDS = ["a", "b", "c", "d"] as const;

export type Voice = "A" | "B" | "C" | "D";
export type Speaker = { label: string; voice: Voice };

/** Options in the printed order; `answer` is the index of the right one. */
function choiceBody(options: string[], answer: number) {
  if (options.length < 3 || options.length > 4) throw new Error(`a choice has 3 or 4 options, not ${options.length}: "${options[0]}"`);
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new Error(`answer ${answer} is not an option of "${options[0]}"`);
  return {
    content: { kind: "CHOICE" as const, options: options.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[answer]] },
  };
}

/** The statements of a Richtig / Falsch item: `[text, "R" | "F"]`, B1 has no "Nicht im Text". */
function tfngBody(statements: Array<[string, "R" | "F"]>) {
  if (statements.length < 3) throw new Error("a Richtig / Falsch set has at least 3 statements");
  return {
    content: { kind: "TFNG" as const, twoWay: true as const, statements: statements.map(([text], i) => ({ id: `s${i + 1}`, text })) },
    key: { kind: "TFNG" as const, answers: Object.fromEntries(statements.map(([, v], i) => [`s${i + 1}`, v])) },
  };
}

// ---------------------------------------------------------------- reading

export function readingText(key: string, title: string, topic: string, body: string): SeedStimulus {
  return { key, section: "READING", level: LEVEL, title, topic, body: body.trim() };
}

/** Richtig / Falsch over one reading text. */
export function readingTfng(stimulus: SeedStimulus, skill: "detail" | "gist" | "inference", prompt: string, statements: Array<[string, "R" | "F"]>, explanation: string): SeedItem {
  return { section: "READING", level: LEVEL, type: "TRUE_FALSE_NG", skillTag: `reading.${skill}`, stimulusKey: stimulus.key, prompt, ...tfngBody(statements), explanation };
}

/** "Which text?" over one stimulus holding texts A to D: three options naming texts. */
export function readingChoice(stimulus: SeedStimulus, skill: "detail" | "gist" | "inference" | "attitude", prompt: string, options: string[], answer: number, explanation: string): SeedItem {
  return { section: "READING", level: LEVEL, type: "SINGLE_CHOICE", skillTag: `reading.${skill}`, stimulusKey: stimulus.key, prompt, ...choiceBody(options, answer), explanation };
}

// ---------------------------------------------------------------- listening

/**
 * A clip played at most twice. Every script line is `Label: text` for a declared speaker, as the TTS script
 * parser needs it (tts.ts parseScript); two speakers get two different voices.
 */
export function listeningClip(key: string, title: string, topic: string, speakers: Speaker[], lines: string[]): SeedStimulus {
  const labels = new Set(speakers.map((s) => s.label));
  if (labels.size !== speakers.length) throw new Error(`${key}: a speaker label is declared twice`);
  if (new Set(speakers.map((s) => s.voice)).size !== speakers.length) throw new Error(`${key}: two speakers share a voice`);
  for (const line of lines) {
    const label = line.slice(0, Math.max(0, line.indexOf(":")));
    if (!labels.has(label)) throw new Error(`${key}: line does not start with a declared speaker: "${line.slice(0, 40)}"`);
  }
  return { key, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n"), maxPlays: 2 };
}

export function listeningChoice(stimulus: SeedStimulus, skill: "detail" | "gist" | "inference" | "attitude", prompt: string, options: string[], answer: number, explanation: string): SeedItem {
  return { section: "LISTENING", level: LEVEL, type: "SINGLE_CHOICE", skillTag: `listening.${skill}`, stimulusKey: stimulus.key, prompt, ...choiceBody(options, answer), explanation };
}

export function listeningTfng(stimulus: SeedStimulus, skill: "detail" | "gist" | "inference" | "attitude", prompt: string, statements: Array<[string, "R" | "F"]>, explanation: string): SeedItem {
  return { section: "LISTENING", level: LEVEL, type: "TRUE_FALSE_NG", skillTag: `listening.${skill}`, stimulusKey: stimulus.key, prompt, ...tfngBody(statements), explanation };
}

// ---------------------------------------------------------------- grammar

/** One sentence with a gap (or two) and four options in the printed order; `topic` is a topic id of topics.ts. */
export function grammarChoice(topic: string, prompt: string, options: string[], answer: number, explanation: string): SeedItem {
  if (options.length !== 4) throw new Error(`a Sprachbausteine sentence has 4 options: "${prompt.slice(0, 40)}"`);
  return { section: "GRAMMAR", level: LEVEL, type: "SINGLE_CHOICE", skillTag: `grammar.${topic}`, prompt, ...choiceBody(options, answer), explanation };
}

export type AbcClozeSpec = {
  /** The instruction line(s), the first paragraph of the prompt. */
  instruction: string;
  /** A short German title, shown above the text. */
  title: string;
  /**
   * The whole text with its paragraphs (blank lines). Every gap is written inline as `[[a|*b|c#topic]]`: the
   * three choices in the order the student sees them, a `*` in front of the right one, and a topic id of
   * topics.ts after `#`.
   */
  text: string;
  /** Teacher-facing note, German: the phenomenon of each gap ("geprüftes Grammatikphänomen"). */
  note: string;
};

/**
 * The school's Sprachbausteine text: a GAP_FILL cloze (skill grammar.cloze) whose gaps have exactly three
 * choices, each gap scoring on its own. The choices keep the order they are written in.
 */
export function abcCloze(spec: AbcClozeSpec): SeedItem {
  const gaps: Array<{ id: string; choices: string[] }> = [];
  const answers: Record<string, string[]> = {};
  const topics: Record<string, string> = {};
  const marked = markGaps(spec.text, (rawInner, n) => {
    const { rest, topic } = splitTopic(rawInner, n, "abc cloze");
    if (!topic) throw new Error(`abc cloze gap ${n} has no #topic`);
    const raw = rest.split("|").map((s) => s.trim());
    if (raw.length !== 3) throw new Error(`abc cloze gap ${n} needs exactly 3 choices, has ${raw.length}`);
    const right = raw.map((c, i) => (c.startsWith("*") ? i : -1)).filter((i) => i >= 0);
    if (right.length !== 1) throw new Error(`abc cloze gap ${n} needs exactly one *right choice`);
    const options = raw.map((c) => c.replace(/^\*\s*/, ""));
    if (options.some((o) => !o)) throw new Error(`abc cloze gap ${n} has an empty choice`);
    // Read as the scorer reads them: case, ß/ss and ae/ä do not tell two choices apart.
    if (options.some((o, j) => options.some((p, k) => k > j && typedMatches(o, [p])))) throw new Error(`abc cloze gap ${n} has two equal choices`);
    gaps.push({ id: `g${n}`, choices: options });
    answers[`g${n}`] = [options[right[0]]];
    topics[`g${n}`] = topic;
  });
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: CLOZE_SKILL_TAG,
    prompt: `${spec.instruction}\n\n${spec.title}\n\n${marked}`,
    content: { kind: "GAP", gaps },
    key: { kind: "GAP", answers, topics },
    explanation: `Lückentext mit je drei Lösungen (a, b, c), genau eine passt. Jede Lücke zählt einzeln. Geprüft: ${spec.note}`,
  };
}

// ---------------------------------------------------------------- writing and speaking

export const WRITING_WORDS = { minWords: 60, maxWords: 80 } as const;
/** The closing line of every B1 email task (Halil Bey's sheet). */
export const FORMAL_REMINDER = "Schreiben Sie ca. 60-80 Wörter. Vergessen Sie die formelle Anrede und die Grußformel nicht.";

export type EmailTaskSpec = {
  /** The situation and the addressee, German. */
  situation: string;
  /** The three Leitpunkte, as the student reads them (each has two halves). */
  points: [string, string, string];
  /** The three Leitpunkte for the grader, both halves spelled out. */
  contentPoints: [string, string, string];
  /** Three short phrases the student sees next to the box; never an answer or a level. */
  studentPoints: [string, string, string];
  /** Teacher-facing note. */
  explanation: string;
};

/** The formal email of the course tests: 60-80 words, Sie, three Leitpunkte (Halil Bey's task shape). */
export function formalEmail(spec: EmailTaskSpec): SeedItem {
  return {
    section: "WRITING",
    level: LEVEL,
    type: "WRITING_PROMPT",
    skillTag: "writing.formal",
    prompt: `${spec.situation}\n\nSchreiben Sie zu allen drei Punkten:\n${spec.points.map((p) => `- ${p}`).join("\n")}\n\n${FORMAL_REMINDER}`,
    content: { kind: "WRITING", ...WRITING_WORDS },
    key: { kind: "NONE" },
    rubric: { contentPoints: spec.contentPoints, register: "formell (Sie)", studentPoints: spec.studentPoints },
    explanation: spec.explanation,
  };
}

export type SpeakingTiming = { thinkSeconds: number; answerSeconds: number };
/** Spec 2026-10-28, level adaptation: B1 introduce yourself 30/60, presentation 60/120, proposals 60/90. One take each. */
export const SPEAKING_TIMING = {
  introduction: { thinkSeconds: 30, answerSeconds: 60 },
  presentation: { thinkSeconds: 60, answerSeconds: 120 },
  planning: { thinkSeconds: 60, answerSeconds: 90 },
} as const satisfies Record<string, SpeakingTiming>;

/**
 * One speaking task: the prompt's first sentence is what the mascot says, the rest is the card (cue points as
 * lines starting with "- "). The card already lists the points, so the rubric has no `studentPoints` (the screen
 * would only repeat them).
 */
export function speakingTask(skill: keyof typeof SPEAKING_TIMING, prompt: string, contentPoints: string[], explanation: string): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: `speaking.${skill}`,
    prompt,
    content: { kind: "SPEAKING", ...SPEAKING_TIMING[skill], maxTakes: 1 },
    key: { kind: "NONE" },
    rubric: { contentPoints },
    explanation,
  };
}
