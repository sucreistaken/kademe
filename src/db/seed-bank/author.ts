import type { Cefr, TfngValue } from "@/lib/exam/types";
import {
  LISTENING_RF,
  LISTENING_RFN,
  READING_RF,
  READING_RFN,
  READING_YES_NO,
} from "./instructions";
import type { SeedBankPart, SeedItem, SeedStimulus } from "./types";

/**
 * Authoring helpers for the units added in round 3 (levels/<level>-more.ts). The older level files keep their
 * own local helpers; new units use this one set so every level builds items the same way and the bank rules
 * (Richtig / Falsch only up to B1, Ja / Nein from B1, play-once clips from B2, tick-n with a key per tick)
 * are checked while writing, not only by the tests.
 *
 * A seed item's text is part of its seed key (seed-key.ts): changing a prompt or an option later makes a new
 * item. Fix a unit by adding a new one and dropping the old one from the list.
 */

export type Within = NonNullable<SeedItem["within"]>;
export type Pos = 0 | 1 | 2 | 3;
export type Voice = "A" | "B" | "C" | "D";
export type Speaker = { label: string; voice: Voice };

/** The five section parts of one level; `noParts()` is the empty one. */
export type LevelParts = {
  grammar: SeedBankPart;
  reading: SeedBankPart;
  listening: SeedBankPart;
  writing: SeedBankPart;
  speaking: SeedBankPart;
};

export const noParts = (): LevelParts => ({
  grammar: { stimuli: [], items: [] },
  reading: { stimuli: [], items: [] },
  listening: { stimuli: [], items: [] },
  writing: { stimuli: [], items: [] },
  speaking: { stimuli: [], items: [] },
});

/** Appends `extra` to `base`, section by section. */
export const withParts = (base: LevelParts, extra: LevelParts): LevelParts => ({
  grammar: { stimuli: [...base.grammar.stimuli, ...extra.grammar.stimuli], items: [...base.grammar.items, ...extra.grammar.items] },
  reading: { stimuli: [...base.reading.stimuli, ...extra.reading.stimuli], items: [...base.reading.items, ...extra.reading.items] },
  listening: { stimuli: [...base.listening.stimuli, ...extra.listening.stimuli], items: [...base.listening.items, ...extra.listening.items] },
  writing: { stimuli: [...base.writing.stimuli, ...extra.writing.stimuli], items: [...base.writing.items, ...extra.writing.items] },
  speaking: { stimuli: [...base.speaking.stimuli, ...extra.speaking.stimuli], items: [...base.speaking.items, ...extra.speaking.items] },
});

const IDS = ["a", "b", "c", "d"] as const;
const LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const levelIndex = (l: Cefr) => LEVELS.indexOf(l);

/** Four options with the correct one at `pos`; the key points at it. */
export function choiceOptions(correct: string, distractors: [string, string, string], pos: Pos) {
  const texts: string[] = [...distractors];
  texts.splice(pos, 0, correct);
  return {
    content: { kind: "CHOICE" as const, options: texts.map((text, i) => ({ id: IDS[i], text })) },
    key: { kind: "CHOICE" as const, correct: [IDS[pos]] },
  };
}

/** A drop-down: the choices with the correct one at `pos`. */
export const dropdown = (correct: string, distractors: [string, string], pos: Pos): string[] => {
  const texts: string[] = [...distractors];
  texts.splice(pos, 0, correct);
  return texts;
};

const tfngContent = (statements: Array<[string, TfngValue]>) => ({
  statements: statements.map(([text], i) => ({ id: `s${i + 1}`, text })),
});
const tfngKey = (statements: Array<[string, TfngValue]>) => ({
  kind: "TFNG" as const,
  answers: Object.fromEntries(statements.map(([, v], i) => [`s${i + 1}`, v])),
});

/** Which column of the matching task a number names: the 1-based position in `right`. */
const matchContent = (left: string[], right: string[]) => ({
  kind: "MATCHING" as const,
  left: left.map((text, i) => ({ id: `l${i + 1}`, text })),
  right: right.map((text, i) => ({ id: `r${i + 1}`, text })),
});
const matchKey = (pairs: number[]) => ({
  kind: "MATCHING" as const,
  pairs: Object.fromEntries(pairs.map((r, i) => [`l${i + 1}`, `r${r}`])),
});

const gapContent = (n: number) => ({ kind: "GAP" as const, gaps: Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}` })) });

export type ReadingSkill = "gist" | "detail" | "inference" | "vocabulary" | "structure" | "attitude";
export type ListeningSkill = "gist" | "detail" | "inference" | "attitude" | "notes";

/** The builders for one level. Stimulus keys are `v6-r-<level>-<slug>` and `v6-l-<level>-<slug>`. */
export function authorFor(level: Cefr) {
  const lower = level.toLowerCase();
  /** Richtig / Falsch only up to B1 (ÖSD, telc); "nicht im Text" and Ja / Nein / Text sagt dazu nichts from B2. */
  const twoWayLevel = levelIndex(level) <= levelIndex("B1");

  const readingBase = (stimulus: SeedStimulus) => (skill: ReadingSkill, within: Within, prompt: string, explanation: string) => ({
    section: "READING" as const,
    level,
    skillTag: `reading.${skill}`,
    within,
    stimulusKey: stimulus.key,
    prompt,
    explanation,
  });
  const listeningBase = (stimulus: SeedStimulus) => (skill: ListeningSkill, within: Within, prompt: string, explanation: string) => ({
    section: "LISTENING" as const,
    level,
    skillTag: `listening.${skill}`,
    within,
    stimulusKey: stimulus.key,
    prompt,
    explanation,
  });

  return {
    level,

    // ---------------------------------------------------------------- grammar, single items

    /** A sentence with a gap and four options (the correct one first in the call, placed at `pos`). */
    grammarChoice(skill: string, within: Within, prompt: string, correct: string, distractors: [string, string, string], pos: Pos, explanation: string): SeedItem {
      return { section: "GRAMMAR", level, type: "SINGLE_CHOICE", skillTag: `grammar.${skill}`, within, prompt, ...choiceOptions(correct, distractors, pos), explanation };
    },
    /** One gap with a drop-down of three forms. */
    grammarSelect(skill: string, within: Within, prompt: string, correct: string, distractors: [string, string], pos: Pos, explanation: string): SeedItem {
      return {
        section: "GRAMMAR",
        level,
        type: "GAP_FILL",
        skillTag: `grammar.${skill}`,
        within,
        prompt,
        content: { kind: "GAP", gaps: [{ id: "g1", choices: dropdown(correct, distractors, pos) }] },
        key: { kind: "GAP", answers: { g1: [correct] } },
        explanation,
      };
    },
    /** One typed gap; list every accepted spelling. */
    grammarTyped(skill: string, within: Within, prompt: string, answers: string[], explanation: string): SeedItem {
      return {
        section: "GRAMMAR",
        level,
        type: "GAP_FILL",
        skillTag: `grammar.${skill}`,
        within,
        prompt,
        content: { kind: "GAP", gaps: [{ id: "g1" }] },
        key: { kind: "GAP", answers: { g1: answers } },
        explanation,
      };
    },

    // ---------------------------------------------------------------- reading

    text(slug: string, title: string, topic: string, body: string): SeedStimulus {
      return { key: `v6-r-${lower}-${slug}`, section: "READING", level, title, topic, body: body.trim() };
    },
    forText(stimulus: SeedStimulus) {
      const base = readingBase(stimulus);
      return {
        choice(skill: ReadingSkill, within: Within, prompt: string, correct: string, distractors: [string, string, string], pos: Pos, explanation: string): SeedItem {
          return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...choiceOptions(correct, distractors, pos) };
        },
        /** Richtig / Falsch (A1 to B1) or Richtig / Falsch / Nicht im Text (B2 and up), by the level. */
        tfng(skill: ReadingSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string, prompt?: string): SeedItem {
          if (twoWayLevel && statements.some(([, v]) => v === "NG")) throw new Error(`${level}: no "nicht im Text" statements up to B1`);
          return {
            ...base(skill, within, prompt ?? (twoWayLevel ? READING_RF : READING_RFN), explanation),
            type: "TRUE_FALSE_NG",
            content: { kind: "TFNG", ...(twoWayLevel ? { twoWay: true } : {}), ...tfngContent(statements) },
            key: tfngKey(statements),
          };
        },
        /**
         * Ja / Nein wording (from B1), two answers: R is "Ja", F is "Nein". `prompt` defaults to the
         * standard line; a "Ist die Person dafür?" task passes its own and the statements are the names.
         */
        yesNo(skill: ReadingSkill, within: Within, statements: Array<[string, "R" | "F"]>, explanation: string, prompt: string = READING_YES_NO): SeedItem {
          if (levelIndex(level) < levelIndex("B1")) throw new Error(`${level}: Ja / Nein wording starts at B1`);
          return {
            ...base(skill, within, prompt, explanation),
            type: "TRUE_FALSE_NG",
            content: { kind: "TFNG", twoWay: true, wording: "JA_NEIN", ...tfngContent(statements) },
            key: tfngKey(statements),
          };
        },
        /** `pairs[i]` is the 1-based position in `right` that left row i belongs to. */
        match(skill: ReadingSkill, within: Within, prompt: string, left: string[], right: string[], pairs: number[], explanation: string): SeedItem {
          if (pairs.length !== left.length) throw new Error("one pair per left row");
          if (pairs.some((p) => p < 1 || p > right.length)) throw new Error("a pair points outside the right column");
          return { ...base(skill, within, prompt, explanation), type: "MATCHING", content: matchContent(left, right), key: matchKey(pairs) };
        },
        /** Typed gaps in a form or table of the prompt ("Name: {{g1}}"); `answers[i]` lists the spellings of gap i + 1. */
        form(skill: ReadingSkill, within: Within, prompt: string, answers: string[][], explanation: string): SeedItem {
          return {
            ...base(skill, within, prompt, explanation),
            type: "GAP_FILL",
            content: gapContent(answers.length),
            key: { kind: "GAP", answers: Object.fromEntries(answers.map((a, i) => [`g${i + 1}`, a])) },
          };
        },
      };
    },

    // ---------------------------------------------------------------- listening

    /** `maxPlays: 1` plays the clip once (from B2). Each script line is `Label: text` with a declared speaker. */
    clip(slug: string, title: string, topic: string, speakers: Speaker[], lines: string[], maxPlays?: 1 | 2 | 3): SeedStimulus {
      if (maxPlays === 1 && levelIndex(level) < levelIndex("B2")) throw new Error(`${level}: a clip played once starts at B2`);
      return {
        key: `v6-l-${lower}-${slug}`,
        section: "LISTENING",
        level,
        title,
        topic,
        speakers,
        body: lines.join("\n"),
        ...(maxPlays ? { maxPlays } : {}),
      };
    },
    forClip(stimulus: SeedStimulus) {
      const base = listeningBase(stimulus);
      return {
        choice(skill: ListeningSkill, within: Within, prompt: string, correct: string, distractors: [string, string, string], pos: Pos, explanation: string): SeedItem {
          return { ...base(skill, within, prompt, explanation), type: "SINGLE_CHOICE", ...choiceOptions(correct, distractors, pos) };
        },
        tfng(skill: ListeningSkill, within: Within, statements: Array<[string, TfngValue]>, explanation: string, prompt?: string): SeedItem {
          if (twoWayLevel && statements.some(([, v]) => v === "NG")) throw new Error(`${level}: no "nicht im Text" statements up to B1`);
          return {
            ...base(skill, within, prompt ?? (twoWayLevel ? LISTENING_RF : LISTENING_RFN), explanation),
            type: "TRUE_FALSE_NG",
            content: { kind: "TFNG", ...(twoWayLevel ? { twoWay: true } : {}), ...tfngContent(statements) },
            key: tfngKey(statements),
          };
        },
        /** Note taking: typed gaps in a note, form or table of the prompt; list every accepted spelling per gap. */
        notes(skill: ListeningSkill, within: Within, prompt: string, answers: string[][], explanation: string): SeedItem {
          return {
            ...base(skill, within, prompt, explanation),
            type: "GAP_FILL",
            content: gapContent(answers.length),
            key: { kind: "GAP", answers: Object.fromEntries(answers.map((a, i) => [`g${i + 1}`, a])) },
          };
        },
        /** Who says what: `pairs[i]` is the 1-based position in `right` (the persons, then "keine ...") of left row i. */
        match(skill: ListeningSkill, within: Within, prompt: string, left: string[], right: string[], pairs: number[], explanation: string): SeedItem {
          if (pairs.length !== left.length) throw new Error("one pair per left row");
          if (pairs.some((p) => p < 1 || p > right.length)) throw new Error("a pair points outside the right column");
          return { ...base(skill, within, prompt, explanation), type: "MATCHING", content: matchContent(left, right), key: matchKey(pairs) };
        },
        /** Tick `correct.length` of 6 to 8 boxes; the screen adds "Kreuzen Sie n Antworten an." */
        pick(skill: ListeningSkill, within: Within, prompt: string, options: string[], correct: number[], explanation: string): SeedItem {
          if (options.length < 6 || options.length > 8) throw new Error("a tick-n item has 6 to 8 options");
          const ids = "abcdefgh".slice(0, options.length).split("");
          return {
            ...base(skill, within, prompt, explanation),
            type: "MULTI_CHOICE",
            content: { kind: "CHOICE", pick: correct.length, options: options.map((text, i) => ({ id: ids[i], text })) },
            key: { kind: "CHOICE", correct: correct.map((i) => ids[i]) },
          };
        },
      };
    },

    // ---------------------------------------------------------------- writing and speaking

    writing(
      skill: string,
      within: Within,
      words: [number, number],
      prompt: string,
      contentPoints: string[],
      studentPoints: string[],
      register: string,
      explanation: string,
    ): SeedItem {
      return {
        section: "WRITING",
        level,
        type: "WRITING_PROMPT",
        skillTag: `writing.${skill}`,
        within,
        prompt,
        content: { kind: "WRITING", minWords: words[0], maxWords: words[1] },
        key: { kind: "NONE" },
        rubric: { contentPoints, register, studentPoints },
        explanation,
      };
    },
    speaking(
      skill: string,
      within: Within,
      timing: { thinkSeconds: number; answerSeconds: number; maxTakes: number },
      prompt: string,
      contentPoints: string[],
      studentPoints: string[],
      explanation: string,
      register?: string,
    ): SeedItem {
      return {
        section: "SPEAKING",
        level,
        type: "SPEAKING_PROMPT",
        skillTag: `speaking.${skill}`,
        within,
        prompt,
        content: { kind: "SPEAKING", ...timing },
        key: { kind: "NONE" },
        rubric: register ? { contentPoints, register, studentPoints } : { contentPoints, studentPoints },
        explanation,
      };
    },
  };
}
