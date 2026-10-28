import { typedMatches } from "@/lib/exam/item-scoring";
import { CLOZE_SKILL_TAG, type TfngValue } from "@/lib/exam/types";
import { markGaps, splitTopic, textPrompt, type TextSpec } from "../../cloze";
import { LISTENING_RFN, READING_RFN } from "../../instructions";
import type { SeedItem, SeedStimulus } from "../../types";

/**
 * Builders shared by the four B2 course test forms (spec 2026-10-28). They
 * mirror the bank's B2 builders (levels/b2.ts) and add what the course tests
 * need: three-choice cloze gaps (a/b/c) and the which-text items of the
 * short-texts task.
 */

export const LEVEL = "B2" as const;

export type Within = NonNullable<SeedItem["within"]>;
export type Pos3 = 0 | 1 | 2;
export type Pos4 = 0 | 1 | 2 | 3;

const IDS = ["a", "b", "c", "d"] as const;

/** Where the B2 syllabus comes from (there is no Netzwerk neu B2). Both documents were read for the topic and grammar lists. */
export const B2_SYLLABUS_SOURCE =
  "CEFR B2 ohne Lehrbuch (Benutzerentscheidung): Themen aus Goethe-Zertifikat B2, Prüfungsziele/Testbeschreibung, Kap. 4.3 Prüfungsthemen " +
  "(https://www.goethe.de/pro/relaunch/prf/sr/Pruefungsziele_Testbeschreibung_B2.pdf); Grammatik aus dem Inhaltsverzeichnis von telc Grammatiktraining Deutsch für B2, " +
  "12 Kapitel (https://shop.telc.net/media/catalog/product/file//v/0/v01-4004-tgr-1801a_grammatiktraining_b2.pdf), in eine erste und eine zweite Hälfte geteilt";

// ---------------------------------------------------------------- texts and clips

/** A reading text. Keys are unique over the whole bank, so the course forms get their own prefix. */
export function readingText(key: string, title: string, topic: string, body: string): SeedStimulus {
  return { key, section: "READING", level: LEVEL, title, topic, body: body.trim() };
}

/** A listening script, one `Label: text` turn per line, every label in `speakers`. A script is never edited under the same key (the audio is made from it). */
export function clip(
  key: string,
  title: string,
  topic: string,
  speakers: Array<{ label: string; voice: "A" | "B" | "C" | "D" }>,
  lines: string[],
  maxPlays: 1 | 2,
): SeedStimulus {
  return { key, section: "LISTENING", level: LEVEL, title, topic, speakers, body: lines.join("\n"), maxPlays };
}

// ---------------------------------------------------------------- choice items

function choiceContent(options: string[], correct: number) {
  return {
    content: { kind: "CHOICE" as const, options: options.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[correct]] },
  };
}

type Base = { section: SeedItem["section"]; skill: string; within: Within; stimulusKey?: string };

function base(b: Base, prompt: string, explanation: string) {
  return {
    section: b.section,
    level: LEVEL,
    skillTag: `${b.section.toLowerCase()}.${b.skill}`,
    within: b.within,
    ...(b.stimulusKey ? { stimulusKey: b.stimulusKey } : {}),
    prompt,
    explanation,
  };
}

/** A grammar sentence with one blank (or two for a two-part connector) and four options. */
export function sentence(
  skill: string,
  within: Within,
  prompt: string,
  options: [string, string, string, string],
  correct: Pos4,
  phenomenon: string,
): SeedItem {
  return { ...base({ section: "GRAMMAR", skill, within }, prompt, phenomenon), type: "SINGLE_CHOICE", ...choiceContent(options, correct) };
}

/** Reading: which text fits? Three options naming texts. */
export function whichText(
  stimulusKey: string,
  skill: "detail" | "gist" | "inference",
  within: Within,
  prompt: string,
  options: [string, string, string],
  correct: Pos3,
  explanation: string,
): SeedItem {
  return { ...base({ section: "READING", skill, within, stimulusKey }, prompt, explanation), type: "SINGLE_CHOICE", ...choiceContent(options, correct) };
}

/** Listening: one question on a short announcement, three options. */
export function announcementQuestion(
  stimulusKey: string,
  skill: "gist" | "detail" | "inference",
  within: Within,
  prompt: string,
  options: [string, string, string],
  correct: Pos3,
  explanation: string,
): SeedItem {
  return { ...base({ section: "LISTENING", skill, within, stimulusKey }, prompt, explanation), type: "SINGLE_CHOICE", ...choiceContent(options, correct) };
}

/** Richtig / Falsch / Nicht im Text (B2): `twoWay` stays unset. The statements follow the text in order. */
export function tfng(
  section: "READING" | "LISTENING",
  stimulusKey: string,
  skill: "detail" | "gist" | "inference" | "attitude",
  within: Within,
  statements: Array<[string, TfngValue]>,
  explanation: string,
): SeedItem {
  const ids = statements.map((_, i) => `s${i + 1}`);
  return {
    ...base({ section, skill, within, stimulusKey }, section === "READING" ? READING_RFN : LISTENING_RFN, explanation),
    type: "TRUE_FALSE_NG",
    content: { kind: "TFNG", statements: statements.map(([text], i) => ({ id: ids[i], text })) },
    key: { kind: "TFNG", answers: Object.fromEntries(statements.map(([, v], i) => [ids[i], v])) },
  };
}

// ---------------------------------------------------------------- cloze with three choices

const CLOZE_INSTRUCTION = "Lesen Sie den Text. Wählen Sie für jede Lücke das passende Wort.";

/**
 * Index of the answer among its three choices: a round robin over the gaps, shifted by a hash of the title,
 * so a text spreads its answers evenly over a/b/c and every build is the same (the exam shuffles again when
 * it serves them).
 */
function answerSlot(title: string, n: number): number {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) % 10007;
  return (n - 1 + h) % 3;
}

/**
 * Multiple-choice cloze with three choices per gap (a/b/c, the course tests'
 * format). Same shape as `cloze()` in ../../cloze.ts, which writes four
 * choices: every gap is `[[answer|wrong1|wrong2#topic]]` and must name its
 * topic, because the student analysis of a course test lists the topics missed.
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
    if (wrong.length !== 2) throw new Error(`cloze gap ${n} ("${answer}") needs exactly 2 distractors, has ${wrong.length}`);
    if (wrong.some((w) => !w)) throw new Error(`cloze gap ${n} ("${answer}") has an empty distractor`);
    const options = [answer, ...wrong];
    // Read as the scorer reads them: case, ß/ss and ae/ä do not tell two options apart.
    if (options.some((o, j) => options.some((p, k) => k > j && typedMatches(o, [p])))) {
      throw new Error(`cloze gap ${n} ("${answer}") has two equal options`);
    }
    const choices = [...wrong];
    choices.splice(answerSlot(spec.title, n), 0, answer);
    gaps.push({ id: `g${n}`, answer, choices });
  });
  return {
    section: "GRAMMAR",
    level: LEVEL,
    type: "GAP_FILL",
    skillTag: CLOZE_SKILL_TAG,
    within,
    prompt: textPrompt(CLOZE_INSTRUCTION, spec, marked),
    content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id, choices: g.choices })) },
    key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, [g.answer]])), topics },
    explanation: `MC-Lückentext mit drei Auswahlmöglichkeiten, jede Lücke zählt einzeln. Geprüft: ${spec.note ?? ""}`.trim(),
  };
}

// ---------------------------------------------------------------- writing and speaking

const FORMAL = "formell (Sie)";
const FORUM = "neutral/sachlich (Forumsbeitrag)";
export const REGISTER = { formal: FORMAL, forum: FORUM } as const;

/** The B2 writing task of a course test: 120-150 words, three Leitpunkte with two halves each (rubric: spelled out for the grader). */
export function writingTask(
  skill: "formal" | "opinion",
  within: Within,
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
    within,
    prompt,
    content: { kind: "WRITING", minWords: 120, maxWords: 150 },
    key: { kind: "NONE" },
    rubric: { contentPoints, register, studentPoints },
    explanation,
  };
}

/** A speaking task of a course test: one recording, no retake. The prompt's first sentence is what the mascot says. */
export function speakingTask(
  skill: "introduction" | "presentation" | "proposal",
  within: Within,
  timing: { thinkSeconds: number; answerSeconds: number },
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

/** Task timings of the spec (level adaptation, B2). */
export const SPEAKING_TIMING = {
  introduction: { thinkSeconds: 30, answerSeconds: 60 },
  presentation: { thinkSeconds: 90, answerSeconds: 150 },
  proposal: { thinkSeconds: 60, answerSeconds: 120 },
} as const;

const INTRO_EXPLANATION =
  "Kurze Vorstellung (Name, Wohnort als Stadt oder Region, Beruf oder Studium, Freizeit, Sprachen). Bewertet wird nach den fünf Kriterien des Bewertungsbogens.";
const PRESENTATION_EXPLANATION =
  "Präsentation mit vier Leitpunkten: Einleitung, Erfahrung oder Beispiel, Vor- und Nachteile, eigene Meinung mit Begründung. Bewertet wird nach den fünf Kriterien des Bewertungsbogens.";
const PROPOSAL_EXPLANATION =
  "Monolog zu einem Vorschlag: Argumente dafür und dagegen, eigener Vorschlag, Ergebnis. Bewertet wird nach den fünf Kriterien des Bewertungsbogens.";

/** The introduction task, the same shape in every form; only the cue words and the order may differ. */
export function introductionTask(cues: string[], contentPoints: string[]): SeedItem {
  return speakingTask(
    "introduction",
    "EASY",
    SPEAKING_TIMING.introduction,
    `Stellen Sie sich bitte kurz vor.\n\n${cues.map((c) => `- ${c}`).join("\n")}`,
    contentPoints,
    INTRO_EXPLANATION,
  );
}

/** The presentation task: a topic and four points. */
export function presentationTask(topic: string, points: [string, string, string, string], contentPoints: string[]): SeedItem {
  return speakingTask(
    "presentation",
    "MID",
    SPEAKING_TIMING.presentation,
    `Halten Sie bitte einen kurzen Vortrag zum Thema „${topic}“.\n\n${points.map((p) => `- ${p}`).join("\n")}\n\nGehen Sie auf alle vier Punkte ein.`,
    contentPoints,
    PRESENTATION_EXPLANATION,
  );
}

/** The FINAL proposal task: one proposal, arguments for and against, a conclusion, as a monologue. */
export function proposalTask(opening: string, points: [string, string, string, string], contentPoints: string[]): SeedItem {
  return speakingTask(
    "proposal",
    "HARD",
    SPEAKING_TIMING.proposal,
    `${opening}\n\n${points.map((p) => `- ${p}`).join("\n")}`,
    contentPoints,
    PROPOSAL_EXPLANATION,
  );
}
