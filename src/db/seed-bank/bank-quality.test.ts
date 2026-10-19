import { describe, expect, it } from "vitest";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";
import { SEED_BANK } from "./index";
import type { SeedItem } from "./types";

/**
 * Item-writing rules learned from the ÖSD, telc and TestDaF model tests
 * (docs/research/exam-sources-2026-10-19). Each rule closes a shortcut a
 * test-wise student could use without understanding the text.
 */

const items = (level: Cefr) => SEED_BANK.items.filter((i) => i.level === level);
const stimuli = (level: Cefr) => SEED_BANK.stimuli.filter((s) => s.level === level);
const TWO_WAY_LEVELS: Cefr[] = ["A1", "A2", "B1"];

/** A four-option single choice whose key is longer than every distractor. */
function keyIsLongest(item: SeedItem): boolean | null {
  if (item.type !== "SINGLE_CHOICE" || item.content.kind !== "CHOICE" || item.key.kind !== "CHOICE") return null;
  const key = item.key.correct[0];
  const keyLen = item.content.options.find((o) => o.id === key)?.text.length ?? 0;
  return item.content.options.every((o) => o.id === key || o.text.length < keyLen);
}

/** A four-option single choice whose key is shorter than every distractor: the same cue, reversed. */
function keyIsShortest(item: SeedItem): boolean | null {
  if (item.type !== "SINGLE_CHOICE" || item.content.kind !== "CHOICE" || item.key.kind !== "CHOICE") return null;
  const key = item.key.correct[0];
  const keyLen = item.content.options.find((o) => o.id === key)?.text.length ?? 0;
  return item.content.options.every((o) => o.id === key || o.text.length > keyLen);
}

function keyLengthRatio(item: SeedItem): number | null {
  if (item.type !== "SINGLE_CHOICE" || item.content.kind !== "CHOICE" || item.key.kind !== "CHOICE") return null;
  const key = item.key.correct[0];
  const keyLen = item.content.options.find((o) => o.id === key)?.text.length ?? 0;
  const others = item.content.options.filter((o) => o.id !== key).map((o) => o.text.length);
  return keyLen / (others.reduce((a, b) => a + b, 0) / others.length);
}

const tfngSets = (level: Cefr) =>
  items(level).flatMap((i) =>
    i.content.kind === "TFNG" && i.key.kind === "TFNG"
      ? [{ item: i, values: i.content.statements.map((s) => (i.key as { answers: Record<string, string> }).answers[s.id]) }]
      : [],
  );

describe("bank quality: the key is not the longest option", () => {
  for (const level of CEFR_LEVELS) {
    it(`${level}: reading and listening keys are the longest option in at most 30% of single-choice items`, () => {
      const flags = items(level)
        .filter((i) => i.section === "READING" || i.section === "LISTENING")
        .map(keyIsLongest)
        .filter((x): x is boolean => x !== null);
      const longest = flags.filter(Boolean).length;
      expect(longest, `${longest} of ${flags.length}`).toBeLessThanOrEqual(Math.floor(flags.length * 0.3));
    });

    it(`${level}: on average the key is between 0.85 and 1.2 times a distractor's length`, () => {
      const ratios = items(level)
        .filter((i) => i.section === "READING" || i.section === "LISTENING")
        .map(keyLengthRatio)
        .filter((x): x is number => x !== null);
      const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      expect(mean).toBeLessThanOrEqual(1.2);
      expect(mean).toBeGreaterThanOrEqual(0.85);
    });

    it(`${level}: reading and listening keys are the shortest option in at most 30% of single-choice items`, () => {
      const flags = items(level)
        .filter((i) => i.section === "READING" || i.section === "LISTENING")
        .map(keyIsShortest)
        .filter((x): x is boolean => x !== null);
      const shortest = flags.filter(Boolean).length;
      expect(shortest, `${shortest} of ${flags.length}`).toBeLessThanOrEqual(Math.floor(flags.length * 0.3));
    });

    it(`${level}: grammar keys are the longest option in at most 35% of single-choice items`, () => {
      const flags = items(level)
        .filter((i) => i.section === "GRAMMAR")
        .map(keyIsLongest)
        .filter((x): x is boolean => x !== null);
      const longest = flags.filter(Boolean).length;
      expect(longest, `${longest} of ${flags.length}`).toBeLessThanOrEqual(Math.floor(flags.length * 0.35));
    });
  }
});

describe("bank quality: richtig / falsch / nicht im Text", () => {
  for (const level of TWO_WAY_LEVELS) {
    it(`${level}: statements are Richtig / Falsch only, as in ÖSD and telc up to B1`, () => {
      for (const { item, values } of tfngSets(level)) {
        expect(item.content.kind === "TFNG" && item.content.twoWay, item.prompt).toBe(true);
        expect(values, item.prompt).not.toContain("NG");
        expect(item.prompt.toLowerCase(), item.prompt).not.toContain("nicht im text");
      }
    });
  }

  for (const level of CEFR_LEVELS.filter((l) => !TWO_WAY_LEVELS.includes(l))) {
    it(`${level}: "nicht im Text" is the last statement in at most 40% of sets`, () => {
      const sets = tfngSets(level);
      const ngLast = sets.filter((s) => s.values.at(-1) === "NG").length;
      expect(ngLast, `${ngLast} of ${sets.length}`).toBeLessThanOrEqual(Math.floor(sets.length * 0.4));
    });

    it(`${level}: sets differ in how many "nicht im Text" statements they hold`, () => {
      const counts = new Set(tfngSets(level).map((s) => s.values.filter((v) => v === "NG").length));
      expect(counts.size).toBeGreaterThanOrEqual(2);
    });
  }

  for (const level of CEFR_LEVELS) {
    it(`${level}: no set of three or more statements has a single answer throughout`, () => {
      for (const { item, values } of tfngSets(level)) {
        if (values.length >= 3) expect(new Set(values).size, item.prompt).toBeGreaterThanOrEqual(2);
      }
    });

    it(`${level}: no answer opens or closes more than 60% of sets`, () => {
      const sets = tfngSets(level);
      for (const pick of [(v: string[]) => v[0] ?? "", (v: string[]) => v.at(-1) ?? ""]) {
        const counts = new Map<string, number>();
        for (const s of sets) counts.set(pick(s.values), (counts.get(pick(s.values)) ?? 0) + 1);
        const top = Math.max(0, ...counts.values());
        expect(top, JSON.stringify([...counts])).toBeLessThanOrEqual(Math.ceil(sets.length * 0.6));
      }
    });

    it(`${level}: no answer sequence repeats in more than a third of sets`, () => {
      const sets = tfngSets(level);
      const counts = new Map<string, number>();
      for (const s of sets) counts.set(s.values.join(""), (counts.get(s.values.join("")) ?? 0) + 1);
      const top = Math.max(0, ...counts.values());
      expect(top, JSON.stringify([...counts])).toBeLessThanOrEqual(Math.max(2, Math.ceil(sets.length / 3)));
    });
  }
});

/** Topics that make a text about work, training or job hunting. */
const WORK = /arbeit|beruf|job|stelle|personal|bewerb|weiterbildung|ausbildung|kolleg|büro|firma|projekt|gehalt|karriere|quereinstieg|unternehm|betrieb/i;

describe("bank quality: many short texts on many topics", () => {
  for (const level of CEFR_LEVELS) {
    it(`${level}: at least 6 reading texts and 5 listening clips`, () => {
      expect(stimuli(level).filter((s) => s.section === "READING").length).toBeGreaterThanOrEqual(6);
      expect(stimuli(level).filter((s) => s.section === "LISTENING").length).toBeGreaterThanOrEqual(5);
    });

    it(`${level}: on average no more than 3 items per text or clip`, () => {
      const linked = items(level).filter((i) => i.stimulusKey).length;
      expect(linked / stimuli(level).length).toBeLessThanOrEqual(3);
    });

    it(`${level}: at least 40% of texts and clips are about something other than work or training`, () => {
      const all = stimuli(level);
      const other = all.filter((s) => !WORK.test(s.topic));
      expect(other.length, all.map((s) => s.topic).join(" | ")).toBeGreaterThanOrEqual(Math.ceil(all.length * 0.4));
    });
  }
});

describe("bank quality: the task types the certificate exams use", () => {
  for (const level of CEFR_LEVELS) {
    it(`${level}: listening has a note-taking item (typed gap or short answer)`, () => {
      const notes = items(level).filter((i) => i.section === "LISTENING" && (i.type === "GAP_FILL" || i.type === "SHORT_TEXT"));
      expect(notes.length).toBeGreaterThanOrEqual(1);
    });

    it(`${level}: reading has a matching task`, () => {
      expect(items(level).filter((i) => i.section === "READING" && i.type === "MATCHING").length).toBeGreaterThanOrEqual(1);
    });
  }
});
