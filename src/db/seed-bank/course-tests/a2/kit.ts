import { typedMatches } from "@/lib/exam/item-scoring";
import { CLOZE_SKILL_TAG } from "@/lib/exam/types";
import { authorFor, type Speaker, type Within } from "../../author";
import { markGaps, splitTopic, textPrompt, type TextSpec } from "../../cloze";
import type { SeedItem, SeedStimulus } from "../../types";
import type { SeedCourseForm } from "../types";

/*
 * Shared builders of the four A2 course test forms (spec 2026-10-28), so every form is built the same way. A seed
 * item's text is part of its seed key (seed-key.ts): to fix a sentence later, add a new item rather than editing.
 */

/** Items of the A2 forms: the bank's builders, checked for the level's rules (Richtig / Falsch only, and so on). */
export const a = authorFor("A2");

/** Stimulus builders with a key prefix per form, e.g. "ct-a2i-a" (Zwischentest A2.1, form A). */
export function stimuliOf(prefix: string) {
  return {
    text(slug: string, title: string, topic: string, body: string): SeedStimulus {
      return { key: `${prefix}-r-${slug}`, section: "READING", level: "A2", title, topic, body: body.trim() };
    },
    /** Each script line is `Label: text`; the clip is played twice (spec: course tests keep the exam setting of two plays). */
    clip(slug: string, title: string, topic: string, speakers: Speaker[], lines: string[]): SeedStimulus {
      return { key: `${prefix}-l-${slug}`, section: "LISTENING", level: "A2", title, topic, speakers, body: lines.join("\n"), maxPlays: 2 };
    },
  };
}

const CLOZE_INSTRUCTION = "Lesen Sie den Text. Wählen Sie für jede Lücke das passende Wort.";

/** Index of the answer among its three choices: spread by gap and answer, the same on every build. */
function answerSlot(answer: string, n: number): number {
  let h = n;
  for (const ch of answer) h = (h * 31 + ch.codePointAt(0)!) % 10007;
  return h % 3;
}

/**
 * Multiple-choice cloze with THREE choices per gap (a/b/c, as in the Campus German sheet; the bank's `cloze()` builds
 * four). Same text rules: the first and last sentence stay intact, every gap is written inline as
 * `[[answer|wrong1|wrong2#topic]]` and must name its grammar topic. `note` lists what each gap tests, as "(g1)" ...
 */
export function cloze3(within: Within, spec: TextSpec): SeedItem {
  const gaps: Array<{ id: string; answer: string; choices: string[] }> = [];
  const topics: Record<string, string> = {};
  const marked = markGaps(spec.body, (rawInner, n) => {
    const { rest: inner, topic } = splitTopic(rawInner, n, "cloze");
    if (!topic) throw new Error(`cloze gap ${n} needs a #topic`);
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
    choices.splice(answerSlot(answer, n), 0, answer);
    gaps.push({ id: `g${n}`, answer, choices });
  });
  return {
    section: "GRAMMAR",
    level: "A2",
    type: "GAP_FILL",
    skillTag: CLOZE_SKILL_TAG,
    within,
    prompt: textPrompt(CLOZE_INSTRUCTION, spec, marked),
    content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id, choices: g.choices })) },
    key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, [g.answer]])), topics },
    explanation:
      "MC-Lückentext: Erster und letzter Satz sind vollständig. Jede Lücke hat drei Optionen (a, b, c), genau eine passt grammatisch und inhaltlich. Jede Lücke zählt einzeln." +
      (spec.note ? ` Geprüft: ${spec.note}` : ""),
  };
}

const OPTION_IDS = ["a", "b", "c"] as const;

/**
 * Single choice with THREE options (a/b/c) for the "which text" questions of the reading part and the announcements of
 * the listening part; the bank's `choice()` builds four. The correct option sits at `pos`.
 */
export function choice3(
  stimulus: SeedStimulus,
  skill: "gist" | "detail" | "inference",
  within: Within,
  prompt: string,
  correct: string,
  distractors: [string, string],
  pos: 0 | 1 | 2,
  explanation: string,
): SeedItem {
  const texts: string[] = [...distractors];
  texts.splice(pos, 0, correct);
  return {
    section: stimulus.section,
    level: "A2",
    type: "SINGLE_CHOICE",
    skillTag: `${stimulus.section.toLowerCase()}.${skill}`,
    within,
    stimulusKey: stimulus.key,
    prompt,
    content: { kind: "CHOICE", options: texts.map((text, i) => ({ id: OPTION_IDS[i], text })) },
    key: { kind: "CHOICE", correct: [OPTION_IDS[pos]] },
    explanation,
  };
}

/** Task text of a writing item: situation, three Leitpunkte, word range and the reminder about Anrede and Gruß. */
export function writingPrompt(situation: string, points: [string, string, string], formal: boolean): string {
  return (
    `${situation}\n\nSchreiben Sie zu allen drei Punkten:\n${points.map((p) => `- ${p}`).join("\n")}\n\n` +
    `Schreiben Sie ca. ${WRITING_WORDS[0]}-${WRITING_WORDS[1]} Wörter. ` +
    (formal ? "Vergessen Sie die formelle Anrede und die Grußformel nicht." : "Vergessen Sie Anrede und Gruß nicht.")
  );
}

/** Spec 2026-10-28, level adaptation A2: Schreiben 40-60 words. */
export const WRITING_WORDS: [number, number] = [40, 60];

/** Spec 2026-10-28, level adaptation A2: introduce yourself (30/60), talk about your life (60/90), proposals (60/75); one take. */
export const INTRO_TIME = { thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 };
export const LIFE_TIME = { thinkSeconds: 60, answerSeconds: 90, maxTakes: 1 };
export const PROPOSAL_TIME = { thinkSeconds: 60, answerSeconds: 75, maxTakes: 1 };

/** Task 1 of every form: introduce yourself. Never origin, age or religion. */
export const INTRO_PROMPT =
  "Stellen Sie sich bitte kurz vor.\n\n- Name\n- Wohnort (Stadt oder Region)\n- Beruf oder Tätigkeit\n- Freizeit\n- Sprachen";
export const INTRO_POINTS = [
  "Name nennen",
  "Wohnort nennen (Stadt oder Region)",
  "Beruf, Ausbildung, Studium oder Tätigkeit nennen",
  "Freizeit oder Hobbys nennen, mit mindestens einem Detail",
  "Sprachen nennen, die man spricht oder lernt",
];
export const INTRO_EXPLANATION =
  "Sich vorstellen als Monolog (Kapitel 1 und 6 des Kurses). Ausreichend sind zusammenhängende Sätze zu den fünf Stichwörtern; weitere persönliche Angaben, die nicht auf der Karte stehen, werden weder verlangt noch bewertet.";

const CLASS_SOURCES = {
  brochure: "https://www.klett-sprachen.de/downloads/23384/netzwerk-neu-a2-broschuere/pdf",
  firstHalf: "https://www.klett-sprachen.es/downloads/23818/programacion-de-netzwerk-neu-a2-1-para-eeooii/pdf",
  secondHalf: "https://www.klett-sprachen.es/downloads/25144/programacion-de-netzwerk-neu-a2-2-para-eeooii/pdf",
  toc: "https://d-nb.info/122079631X/04",
};

/**
 * What the Zwischentest A2.1 covers. The table-of-contents PDFs on klett-sprachen.de belong to the older Netzwerk
 * A2 (other chapter titles), so the source is Klett's own Netzwerk neu A2 brochure (chapter titles and
 * communication goals) and Klett España's teacher programme (grammar and themes per chapter), cross-checked
 * against the chapter order in the table of contents held by the German National Library and against the
 * exercise solutions of the Übungsbuch.
 */
export function interimSyllabus(): SeedCourseForm["syllabus"] {
  return {
    source:
      `Klett, Netzwerk neu A2: Lernziele je Kapitel (Broschüre ${CLASS_SOURCES.brochure}); Grammatik und Themen der Kapitel 1-6 ` +
      `(Klett España, Programación Netzwerk neu A2.1 ${CLASS_SOURCES.firstHalf}); Kapitelfolge (Inhaltsverzeichnis ${CLASS_SOURCES.toc})`,
    chapters: "Netzwerk neu A2, Kapitel 1-6",
    topics: [
      "Kap. 1: Sich vorstellen, Vergangenes berichten (Perfekt, weil)",
      "Kap. 2: Schulzeit und Ausbildung (Modalverben im Präteritum, Dativ)",
      "Kap. 3: Medien und Vergleiche (Komparativ, Superlativ, dass)",
      "Kap. 4: Gefühle und Feste (wenn, reflexive Verben)",
      "Kap. 5: Leben in der Stadt (höfliche Bitten mit „könnte“, Adjektivendungen, ohne/mit)",
      "Kap. 6: Arbeitswelten (werden, Adjektive nach ein/kein)",
    ],
  };
}

/** What the Abschlusstest A2 covers: all twelve chapters. */
export function finalSyllabus(): SeedCourseForm["syllabus"] {
  return {
    source:
      `Klett, Netzwerk neu A2: Lernziele je Kapitel (Broschüre ${CLASS_SOURCES.brochure}); Grammatik und Themen der Kapitel 1-6 ` +
      `(Klett España, Programación Netzwerk neu A2.1 ${CLASS_SOURCES.firstHalf}) und 7-12 (Programación Netzwerk neu A2.2 ${CLASS_SOURCES.secondHalf}); ` +
      `Kapitelfolge (Inhaltsverzeichnis ${CLASS_SOURCES.toc})`,
    chapters: "Netzwerk neu A2, Kapitel 1-12",
    topics: [
      ...interimSyllabus().topics,
      "Kap. 7: Unterwegs (indirekte Fragesätze, lokale Präpositionen)",
      "Kap. 8: Lernen und Ratschläge (sollte, was für ein)",
      "Kap. 9: Sport und Vorschläge (deshalb, trotzdem, Verben mit Dativ)",
      "Kap. 10: Zusammen leben (als und wenn, Wechselpräpositionen)",
      "Kap. 11: Wünsche und Pläne (Fragen mit Präposition, Verben mit Präposition)",
      "Kap. 12: Unterhaltung (Relativsätze, man und jemand, etwas und nichts)",
    ],
  };
}
