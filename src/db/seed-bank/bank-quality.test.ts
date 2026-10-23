import { describe, expect, it } from "vitest";
import { imageRefsOf } from "@/lib/exam/image-refs";
import { isFormatTopic, topicOf, TOPICS } from "@/lib/exam/topics";
import { CEFR_LEVELS, CLOZE_SKILL_TAG, OPEN_CLOZE_SKILL_TAG, WORD_BANK_SKILL_TAG, type Cefr } from "@/lib/exam/types";
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

/**
 * The text options of a single choice, or null when the length rules do not apply: not a single choice, or a
 * picture choice, whose option texts are only labels ("Bild A") and give nothing away by their length.
 */
function textOptions(item: SeedItem): { key: string; options: Array<{ id: string; text: string }> } | null {
  if (item.type !== "SINGLE_CHOICE" || item.content.kind !== "CHOICE" || item.key.kind !== "CHOICE") return null;
  if (item.content.options.some((o) => o.image)) return null;
  return { key: item.key.correct[0], options: item.content.options };
}

/** A four-option single choice whose key is longer than every distractor. */
function keyIsLongest(item: SeedItem): boolean | null {
  const t = textOptions(item);
  if (!t) return null;
  const keyLen = t.options.find((o) => o.id === t.key)?.text.length ?? 0;
  return t.options.every((o) => o.id === t.key || o.text.length < keyLen);
}

/** A four-option single choice whose key is shorter than every distractor: the same cue, reversed. */
function keyIsShortest(item: SeedItem): boolean | null {
  const t = textOptions(item);
  if (!t) return null;
  const keyLen = t.options.find((o) => o.id === t.key)?.text.length ?? 0;
  return t.options.every((o) => o.id === t.key || o.text.length > keyLen);
}

/** Key length over the mean distractor length; null when there is no text to compare (no NaN from 0 / 0). */
function keyLengthRatio(item: SeedItem): number | null {
  const t = textOptions(item);
  if (!t) return null;
  const keyLen = t.options.find((o) => o.id === t.key)?.text.length ?? 0;
  const others = t.options.filter((o) => o.id !== t.key).map((o) => o.text.length);
  const mean = others.reduce((a, b) => a + b, 0) / others.length;
  return others.length && mean > 0 ? keyLen / mean : null;
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
      expect(ratios.length).toBeGreaterThan(0);
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

    // Also the spec's rule "clips with 3+ speakers use distinct voices" (2026-10-23), for every clip.
    it(`${level}: every listening clip has at most four speakers, each with a distinct voice`, () => {
      const clips = stimuli(level).filter((s) => s.section === "LISTENING");
      const crowded = clips.filter((s) => (s.speakers?.length ?? 0) > 4);
      expect(crowded.map((s) => s.key)).toEqual([]);
      const shared = clips.filter((s) => new Set((s.speakers ?? []).map((x) => x.voice)).size !== (s.speakers ?? []).length);
      expect(shared.map((s) => s.key)).toEqual([]);
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

/** Questions about a protected characteristic; the bank is also used in hiring. */
const PROTECTED = /ihrem land|ihr land|heimatland|herkunftsland|woher kommen sie|woher kommst du|wie alt sind sie|wie alt bist du|ihr alter\b|ihre religion|ihre nationalität|staatsangehörigkeit/i;

describe("bank quality: nothing asks for origin, age or religion", () => {
  it("no prompt, statement, option or rubric point asks for a protected characteristic", () => {
    const hits = SEED_BANK.items
      .filter((i) => PROTECTED.test(JSON.stringify([i.prompt, i.content, i.rubric ?? null])))
      .map((i) => `${i.level} ${i.section}: ${i.prompt.slice(0, 60)}`);
    expect(hits).toEqual([]);
  });
});

/** Levels from which a format may appear, as in ÖSD and telc (spec 2026-10-23, format matrix). */
const LEVEL_INDEX = (level: Cefr) => CEFR_LEVELS.indexOf(level);
const FROM_B1 = (level: Cefr) => LEVEL_INDEX(level) >= LEVEL_INDEX("B1");
const FROM_B2 = (level: Cefr) => LEVEL_INDEX(level) >= LEVEL_INDEX("B2");

describe("bank quality: formats only from the level that uses them", () => {
  for (const level of CEFR_LEVELS.filter((l) => !FROM_B1(l))) {
    it(`${level}: no Ja / Nein wording (only from B1)`, () => {
      const jaNein = items(level).filter((i) => i.content.kind === "TFNG" && i.content.wording === "JA_NEIN");
      expect(jaNein.map((i) => i.prompt.slice(0, 60))).toEqual([]);
    });
  }

  for (const level of CEFR_LEVELS.filter((l) => !FROM_B2(l))) {
    it(`${level}: no clip played only once (maxPlays 1 only from B2)`, () => {
      const once = stimuli(level).filter((s) => s.section === "LISTENING" && s.maxPlays === 1);
      expect(once.map((s) => s.key)).toEqual([]);
    });
  }

  for (const level of CEFR_LEVELS) {
    it(`${level}: a "tick n" multiple choice has 6 to 8 options and exactly n keys`, () => {
      for (const i of items(level)) {
        if (i.content.kind !== "CHOICE" || i.content.pick === undefined) continue;
        const where = i.prompt.slice(0, 60);
        expect(i.type, where).toBe("MULTI_CHOICE");
        expect(i.content.options.length, where).toBeGreaterThanOrEqual(6);
        expect(i.content.options.length, where).toBeLessThanOrEqual(8);
        expect(i.key.kind === "CHOICE" ? i.key.correct.length : -1, where).toBe(i.content.pick);
      }
    });
  }
});

/** Text kinds whose every gap names the topic it tests (C-tests test word parts, not a topic). */
const TOPIC_TEXT_TAGS = [CLOZE_SKILL_TAG, WORD_BANK_SKILL_TAG, OPEN_CLOZE_SKILL_TAG];

describe("bank quality: every gap of a grammar text names a topic", () => {
  for (const level of CEFR_LEVELS) {
    it(`${level}: every cloze, word-bank and open cloze gap has a #topic from topics.ts that is not a task format`, () => {
      const bad: string[] = [];
      for (const i of items(level).filter((x) => TOPIC_TEXT_TAGS.includes(x.skillTag))) {
        if (i.content.kind !== "GAP" || i.key.kind !== "GAP") continue;
        const title = i.prompt.split("\n\n")[1] ?? i.prompt.slice(0, 40);
        for (const g of i.content.gaps) {
          const topic = i.key.topics?.[g.id];
          const id = topic ? topicOf(topic) : null;
          if (!topic) bad.push(`${title} ${g.id}: no topic`);
          else if (!id || !Object.prototype.hasOwnProperty.call(TOPICS, id)) bad.push(`${title} ${g.id}: unknown topic "${topic}"`);
          else if (isFormatTopic(topic)) bad.push(`${title} ${g.id}: "${topic}" is a task format, not a topic`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});

/** A target text "A: ..." to "G: ...": the letter the student writes. */
const LETTERED = /^[A-Z]:/u;

describe("bank quality: insertion tasks use every spare paragraph at most once", () => {
  for (const level of CEFR_LEVELS) {
    it(`${level}: in an insertion task (two more targets than gaps) no target fills two gaps`, () => {
      // Insertion: the targets are lettered ("A:" to "G:") or the task is a reading.structure matching, with
      // exactly two spare targets (ÖSD/telc 5 of 7). "Wer sagt was" tasks may reuse a person; insertion may not.
      for (const i of items(level)) {
        if (i.content.kind !== "MATCHING" || i.key.kind !== "MATCHING") continue;
        const { left, right } = i.content;
        const lettered = right.every((r) => LETTERED.test(r.text.trim()));
        if (right.length !== left.length + 2 || !(lettered || i.skillTag === "reading.structure")) continue;
        const used = Object.values(i.key.pairs);
        expect(new Set(used).size, i.prompt.slice(0, 60)).toBe(used.length);
      }
    });
  }
});

/**
 * The three-forms targets (spec 2026-10-23, "Targets per level (one draw x 3)"). A level that misses one is
 * listed in SHORT_OF_TARGET and its expectation runs as `it.fails` until the bank grows; remove the entry then.
 */
const SHORT_OF_TARGET: string[] = [];

/** Pictures a reading and a listening unit of the same level share; one exam can show both. Remove when fixed. */
const SHARED_PICTURES: Partial<Record<Cefr, string>> = {
  // A1: obj.place.cinema (reading v4-r-a1-schilder-stadt, listening v5-l-a1-nachrichten-orte) and
  // obj.food.pizza (reading v4-r-a1-zettel-kueche, listening v5-l-a1-gespraeche-essen-kleidung). Reported in B8.
  A1: "obj.place.cinema, obj.food.pizza",
};

describe("bank quality: enough units for three forms in a row", () => {
  const target = (name: string) => (SHORT_OF_TARGET.includes(name) ? it.fails : it);
  const linked = (level: Cefr, section: "READING" | "LISTENING") => {
    const units = stimuli(level).filter((s) => s.section === section);
    const count = items(level).filter((i) => i.section === section && units.some((u) => u.key === i.stimulusKey)).length;
    return { units: units.length, items: count };
  };

  for (const level of CEFR_LEVELS) {
    target(`${level} speaking.picture`)(`${level}: at least 4 picture speaking tasks`, () => {
      expect(items(level).filter((i) => i.skillTag === "speaking.picture").length).toBeGreaterThanOrEqual(4);
    });

    target(`${level} reading`)(`${level}: at least 24 reading items in at least 9 texts`, () => {
      const r = linked(level, "READING");
      expect(r.items, `${r.items} items in ${r.units} texts`).toBeGreaterThanOrEqual(24);
      expect(r.units, `${r.items} items in ${r.units} texts`).toBeGreaterThanOrEqual(9);
    });

    target(`${level} listening`)(`${level}: at least 21 listening items in at least 8 clips`, () => {
      const l = linked(level, "LISTENING");
      expect(l.items, `${l.items} items in ${l.units} clips`).toBeGreaterThanOrEqual(21);
      expect(l.units, `${l.items} items in ${l.units} clips`).toBeGreaterThanOrEqual(8);
    });
  }
});

describe("bank quality: reading and listening do not show the same picture", () => {
  for (const level of CEFR_LEVELS) {
    const test = SHARED_PICTURES[level] ? it.fails : it;
    test(`${level}: no picture of a reading unit is also in a listening unit`, () => {
      const pictures = (section: string) =>
        new Map(items(level).filter((i) => i.section === section).flatMap((i) => imageRefsOf(i.content).map((r) => [r.storageKey, r.alt] as const)));
      const reading = pictures("READING");
      const listening = pictures("LISTENING");
      expect([...reading].filter(([k]) => listening.has(k)).map(([, alt]) => alt)).toEqual([]);
    });
  }
});
