import { typedMatches } from "@/lib/exam/item-scoring";
import type { CourseForm } from "@/lib/exam/course/types";
import { CLOZE_SKILL_TAG } from "@/lib/exam/types";
import { markGaps, splitTopic, textPrompt, type TextSpec } from "../../cloze";
import { LISTENING_RF, READING_RF } from "../../instructions";
import type { SeedItem, SeedStimulus } from "../../types";
import type { SeedCourseForm } from "../types";

/*
 * Authoring helpers for the A1 course test forms (spec 2026-10-28). They follow the shapes of the bank's A1
 * file and author.ts, with the three differences of a course form: a/b/c options for texts and announcements,
 * three-choice cloze gaps, and one take per speaking task. A seed item's text is part of its seed key, so a
 * form is fixed once it is loaded: write a new item instead of editing one.
 */

const LEVEL = "A1" as const;

export type Within = NonNullable<SeedItem["within"]>;
export type Pos3 = 0 | 1 | 2;
export type Pos4 = 0 | 1 | 2 | 3;
export type Voice = "A" | "B" | "C" | "D";
export type Speaker = { label: string; voice: Voice };
export type Statement = [text: string, value: "R" | "F"];
type TextSkill = "gist" | "detail" | "inference";

/** The syllabus every A1 form names: Klett's Inhaltsverzeichnis for A1.1 (Kapitel 1-6) and A1.2 (Kapitel 7-12). */
export const SYLLABUS_SOURCE =
  "https://www.klett-sprachen.de/downloads/21300/netzwerk-neu-a1-probekapitel/pdf (Klett, Netzwerk neu A1 Probekapitel: Inhaltsverzeichnis A1.1 und A1.2)";

const IDS = ["a", "b", "c", "d"] as const;

/** Options with the key at `pos`; the distractors keep their order around it. */
function choiceOf(correct: string, distractors: string[], pos: number) {
  if (pos < 0 || pos > distractors.length) throw new Error(`key position ${pos} is outside the options of "${correct}"`);
  const texts = [...distractors];
  texts.splice(pos, 0, correct);
  return {
    content: { kind: "CHOICE" as const, options: texts.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[pos]] },
  };
}

// ---------------------------------------------------------------- grammar

/** One sentence with a gap and four options (a-d). */
export function sentence(
  skill: string,
  within: Within,
  prompt: string,
  correct: string,
  distractors: [string, string, string],
  pos: Pos4,
  explanation: string,
): SeedItem {
  return { section: "GRAMMAR", level: LEVEL, type: "SINGLE_CHOICE", skillTag: `grammar.${skill}`, within, prompt, ...choiceOf(correct, distractors, pos), explanation };
}

/** Index of the answer among its three choices: spread by gap and answer, the same on every build. */
function answerSlot(answer: string, n: number): number {
  let h = n;
  for (const ch of answer) h = (h * 31 + ch.codePointAt(0)!) % 10007;
  return h % 3;
}

/**
 * The bank's MC cloze (cloze.ts) with three choices per gap, as the course tests use (a/b/c). Every gap is
 * written `[[answer|wrong1|wrong2#topic]]` and must name its topic, which the student analysis needs.
 */
export function cloze3(within: Within, spec: TextSpec): SeedItem {
  const gaps: Array<{ id: string; answer: string; choices: string[] }> = [];
  const topics: Record<string, string> = {};
  const marked = markGaps(spec.body, (rawInner, n) => {
    const { rest: inner, topic } = splitTopic(rawInner, n, "cloze");
    if (!topic) throw new Error(`cloze gap ${n} has no #topic`);
    topics[`g${n}`] = topic;
    const [answer, ...wrong] = inner.split("|").map((s) => s.trim());
    if (!answer) throw new Error(`cloze gap ${n} has no answer`);
    if (wrong.length !== 2 || wrong.some((w) => !w)) throw new Error(`cloze gap ${n} ("${answer}") needs exactly 2 distractors, has ${wrong.length}`);
    const options = [answer, ...wrong];
    // Read as the scorer reads them: case, ß/ss and ae/ä do not tell two options apart.
    if (options.some((o, j) => options.some((p, k) => k > j && typedMatches(o, [p])))) throw new Error(`cloze gap ${n} ("${answer}") has two equal options`);
    const choices = [...wrong];
    choices.splice(answerSlot(answer, n), 0, answer);
    gaps.push({ id: `g${n}`, answer, choices });
  });
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: CLOZE_SKILL_TAG,
    within,
    prompt: textPrompt("Lesen Sie den Text. Wählen Sie für jede Lücke das passende Wort.", spec, marked),
    content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id, choices: g.choices })) },
    key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, [g.answer]])), topics },
    explanation:
      "MC-Lückentext: Erster und letzter Satz sind vollständig. Jede Lücke hat drei Optionen (a, b, c), genau eine passt grammatisch und inhaltlich. Jede Lücke zählt einzeln." +
      (spec.note ? ` Geprüft: ${spec.note}` : ""),
  };
}

// ---------------------------------------------------------------- reading and listening

export const readingText = (key: string, title: string, topic: string, body: string): SeedStimulus => ({
  key,
  section: "READING",
  level: LEVEL,
  title,
  topic,
  body: body.trim(),
});

/** A script of `Label: text` lines; every label is a declared speaker. Two plays, as in the bank's A1 clips. */
export function clip(key: string, title: string, topic: string, speakers: Speaker[], lines: string[]): SeedStimulus {
  const labels = new Set(speakers.map((s) => s.label));
  for (const line of lines) {
    const label = line.slice(0, Math.max(0, line.indexOf(":")));
    if (!labels.has(label)) throw new Error(`clip ${key}: line "${line.slice(0, 30)}" has no declared speaker`);
  }
  return { key, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n"), maxPlays: 2 };
}

/** Richtig / Falsch only (A1 to B1 use two answers); both values are used so the set cannot be answered blind. */
function tfngSet(statements: Statement[]) {
  if (new Set(statements.map(([, v]) => v)).size < 2) throw new Error("a Richtig/Falsch set uses both values");
  const ids = statements.map((_, i) => `s${i + 1}`);
  return {
    content: { kind: "TFNG" as const, twoWay: true as const, statements: statements.map(([text], i) => ({ id: ids[i], text })) },
    key: { kind: "TFNG" as const, answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
  };
}

export const readingTfng = (stimulusKey: string, skill: TextSkill, within: Within, statements: Statement[], explanation: string): SeedItem => ({
  section: "READING",
  level: LEVEL,
  type: "TRUE_FALSE_NG",
  skillTag: `reading.${skill}`,
  within,
  stimulusKey,
  prompt: READING_RF,
  ...tfngSet(statements),
  explanation,
});

export const listeningTfng = (stimulusKey: string, skill: TextSkill, within: Within, statements: Statement[], explanation: string): SeedItem => ({
  section: "LISTENING",
  level: LEVEL,
  type: "TRUE_FALSE_NG",
  skillTag: `listening.${skill}`,
  within,
  stimulusKey,
  prompt: LISTENING_RF,
  ...tfngSet(statements),
  explanation,
});

/** "Which text?" over the four short texts: the three options name texts, in the order given. */
export function whichText(
  stimulusKey: string,
  skill: TextSkill,
  within: Within,
  prompt: string,
  options: [string, string, string],
  correct: string,
  explanation: string,
): SeedItem {
  const pos = options.indexOf(correct);
  if (pos < 0) throw new Error(`"${correct}" is not among the options of "${prompt}"`);
  return {
    section: "READING",
    level: LEVEL,
    type: "SINGLE_CHOICE",
    skillTag: `reading.${skill}`,
    within,
    stimulusKey,
    prompt,
    ...choiceOf(correct, options.filter((_, i) => i !== pos), pos),
    explanation,
  };
}

/** One announcement, one question, three options (a/b/c). */
export function announcementPick(
  stimulusKey: string,
  skill: TextSkill,
  within: Within,
  prompt: string,
  correct: string,
  distractors: [string, string],
  pos: Pos3,
  explanation: string,
): SeedItem {
  return {
    section: "LISTENING",
    level: LEVEL,
    type: "SINGLE_CHOICE",
    skillTag: `listening.${skill}`,
    within,
    stimulusKey,
    prompt,
    ...choiceOf(correct, distractors, pos),
    explanation,
  };
}

// ---------------------------------------------------------------- writing and speaking

export const INFORMAL = "informell (du)";
export const FORMAL = "formell (Sie)";

/** The one short message of a form: 25-40 words, three Leitpunkte. */
export function writingTask(
  skill: "message" | "email",
  prompt: string,
  contentPoints: string[],
  studentPoints: string[],
  register: string,
  explanation: string,
): SeedItem {
  return {
    section: "WRITING",
    level: LEVEL,
    type: "WRITING_PROMPT",
    skillTag: `writing.${skill}`,
    within: "MID",
    prompt,
    content: { kind: "WRITING", minWords: 25, maxWords: 40 },
    key: { kind: "NONE" },
    rubric: { contentPoints, register, studentPoints },
    explanation,
  };
}

type Timing = { thinkSeconds: number; answerSeconds: number };
/** Spec 2026-10-28, level adaptation for A1: think and answer seconds per task. */
export const INTRO: Timing = { thinkSeconds: 30, answerSeconds: 60 };
export const CARD: Timing = { thinkSeconds: 60, answerSeconds: 60 };
export const ASK: Timing = { thinkSeconds: 30, answerSeconds: 45 };

/**
 * One take only. The prompt's first sentence is what the mascot says; the cue points follow as "- " lines and
 * are the student's own list, so the rubric keeps no separate student points (the screen would show them twice).
 */
export function speakingTask(
  skill: "introduction" | "topiccard" | "request",
  within: Within,
  timing: Timing,
  prompt: string,
  contentPoints: string[],
  explanation: string,
): SeedItem {
  return {
    section: "SPEAKING",
    level: LEVEL,
    type: "SPEAKING_PROMPT",
    skillTag: `speaking.${skill}`,
    within,
    prompt,
    content: { kind: "SPEAKING", ...timing, maxTakes: 1 },
    key: { kind: "NONE" },
    rubric: { contentPoints },
    explanation,
  };
}

// ---------------------------------------------------------------- form

export type FormParts = {
  reading: { stimuli: SeedStimulus[]; items: SeedItem[] };
  grammar: SeedItem[];
  listening: { stimuli: SeedStimulus[]; items: SeedItem[] };
  writing: SeedItem;
  speaking: SeedItem[];
};

/** The five sections in telc order (READING, GRAMMAR, LISTENING, WRITING, SPEAKING). */
export function a1Form(key: "A1.1" | "A1", form: CourseForm, syllabus: SeedCourseForm["syllabus"], parts: FormParts): SeedCourseForm {
  return {
    key,
    form,
    syllabus,
    sections: [
      { section: "READING", stimuli: parts.reading.stimuli, items: parts.reading.items },
      { section: "GRAMMAR", stimuli: [], items: parts.grammar },
      { section: "LISTENING", stimuli: parts.listening.stimuli, items: parts.listening.items },
      { section: "WRITING", stimuli: [], items: [parts.writing] },
      { section: "SPEAKING", stimuli: [], items: parts.speaking },
    ],
  };
}
