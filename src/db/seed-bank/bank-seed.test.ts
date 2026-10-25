import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { validateItem } from "@/lib/exam/validate";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";
import { SEED_BANK, SEED_PARTS } from "./index";
import { seedItemKey } from "./seed-key";

/**
 * The starter bank has to be big enough for the adaptive engine to have a
 * choice near every student, and every item has to be scoreable. These are the
 * minimums from the plan; the bank may hold more.
 */

const count = (section: string, level: string) =>
  SEED_BANK.items.filter((i) => i.section === section && i.level === level).length;
const stimuliOf = (section: string, level: string) =>
  SEED_BANK.stimuli.filter((s) => s.section === section && s.level === level);

describe("starter bank coverage", () => {
  for (const level of CEFR_LEVELS) {
    it(`${level}: grammar has at least 10 items`, () => {
      expect(count("GRAMMAR", level)).toBeGreaterThanOrEqual(10);
    });
    it(`${level}: reading has at least 3 texts with 3+ items each`, () => {
      // Short texts (notices, ads) may carry one or two items, as in ÖSD and telc.
      const texts = stimuliOf("READING", level);
      const itemsOf = (key: string) => SEED_BANK.items.filter((i) => i.stimulusKey === key).length;
      expect(texts.filter((t) => itemsOf(t.key) >= 3).length).toBeGreaterThanOrEqual(3);
      for (const t of texts) expect(itemsOf(t.key)).toBeGreaterThanOrEqual(1);
    });
    it(`${level}: listening has at least 2 clips with 3+ items each`, () => {
      const clips = stimuliOf("LISTENING", level);
      const itemsOf = (key: string) => SEED_BANK.items.filter((i) => i.stimulusKey === key).length;
      expect(clips.filter((c) => itemsOf(c.key) >= 3).length).toBeGreaterThanOrEqual(2);
      for (const c of clips) expect(itemsOf(c.key)).toBeGreaterThanOrEqual(1);
    });
    it(`${level}: writing has at least 4 prompts`, () => {
      expect(count("WRITING", level)).toBeGreaterThanOrEqual(4);
    });
    it(`${level}: speaking has at least 4 prompts`, () => {
      expect(count("SPEAKING", level)).toBeGreaterThanOrEqual(4);
    });
    it(`${level}: grammar has three C-tests with 15 to 20 typed gaps and distinct texts`, () => {
      const ctests = SEED_BANK.items.filter((i) => i.level === level && i.skillTag === "grammar.ctest");
      expect(ctests).toHaveLength(3);
      expect(new Set(ctests.map((c) => c.prompt)).size).toBe(3);
      for (const c of ctests) {
        expect(c.section).toBe("GRAMMAR");
        expect(c.type).toBe("GAP_FILL");
        if (c.content.kind !== "GAP") throw new Error("not a gap item");
        expect(c.content.gaps.length).toBeGreaterThanOrEqual(15);
        expect(c.content.gaps.length).toBeLessThanOrEqual(20);
        expect(c.content.gaps.every((g) => !g.choices)).toBe(true);
      }
    });
  }
});

/**
 * The grammar texts per level (bank of 2026-10-23, spec 2026-10-23 "Targets per level"): three MC cloze texts
 * and three classic word banks (8 gaps) everywhere; B1 and B2 add three Sprachbausteine word banks (10 gaps,
 * 15 words, as in telc B1/B2); B2 to C2 add three open cloze texts (one typed word per gap, ÖSD ZB2/ZC1).
 * Round 3 (2026-10-25) adds one letter-style MC cloze text at A2, B1 and B2 and one "advert and reply"
 * Sprachbausteine text at B1 and B2 (telc style), so those levels hold a fourth.
 * The counts are exact: a level with more or fewer texts than planned fails here until this table changes.
 */
const TEXT_COUNTS: Record<Cefr, { cloze: number; wordBanks: number; sprachbausteine: number; open: number }> = {
  A1: { cloze: 3, wordBanks: 3, sprachbausteine: 0, open: 0 },
  A2: { cloze: 4, wordBanks: 3, sprachbausteine: 0, open: 0 },
  B1: { cloze: 4, wordBanks: 3, sprachbausteine: 4, open: 0 },
  B2: { cloze: 4, wordBanks: 3, sprachbausteine: 4, open: 3 },
  C1: { cloze: 3, wordBanks: 3, sprachbausteine: 0, open: 3 },
  C2: { cloze: 3, wordBanks: 3, sprachbausteine: 0, open: 3 },
};

/** A classic word bank has 8 gaps; a Sprachbausteine word bank has 10 gaps and a pool of 15 words. */
const CLASSIC_WORD_BANK_GAPS = 8;
const SPRACHBAUSTEINE_GAPS = 10;
const SPRACHBAUSTEINE_WORDS = 15;

const TEXT_LEVELS = CEFR_LEVELS;

describe("starter MC cloze, word-bank and open cloze texts", () => {
  const textsOf = (level: string, skillTag: string) =>
    SEED_BANK.items.filter((i) => i.level === level && i.skillTag === skillTag);
  const gapsOf = (item: (typeof SEED_BANK.items)[number]) => {
    if (item.content.kind !== "GAP" || item.key.kind !== "GAP") throw new Error("not a gap item");
    return { gaps: item.content.gaps, key: item.key };
  };
  /** Instruction, title, text: the three paragraphs the builders write. */
  const paragraphs = (item: (typeof SEED_BANK.items)[number]) => item.prompt.split("\n\n");
  const poolOf = (item: (typeof SEED_BANK.items)[number]) => {
    const { gaps, key } = gapsOf(item);
    return [...gaps.map((g) => key.answers[g.id][0]), ...(key.distractors ?? [])].map((w) => w.toLowerCase());
  };

  for (const level of TEXT_LEVELS) {
    const want = TEXT_COUNTS[level];

    it(`${level}: three MC cloze texts, easy to hard, with 10 to 12 four-choice gaps`, () => {
      const texts = textsOf(level, "grammar.cloze");
      expect(texts).toHaveLength(want.cloze);
      expect([...new Set(texts.map((t) => t.within))].sort()).toEqual(["EASY", "HARD", "MID"]);
      for (const t of texts) {
        expect(t.section).toBe("GRAMMAR");
        expect(t.type).toBe("GAP_FILL");
        const { gaps, key } = gapsOf(t);
        expect(gaps.length, paragraphs(t)[1]).toBeGreaterThanOrEqual(10);
        expect(gaps.length, paragraphs(t)[1]).toBeLessThanOrEqual(12);
        for (const g of gaps) {
          expect(g.choices).toHaveLength(4);
          expect(key.answers[g.id]).toHaveLength(1);
          expect(g.choices).toContain(key.answers[g.id][0]);
        }
      }
    });

    it(`${level}: ${want.wordBanks} word banks, easy to hard, with 8 whole-word gaps and 4 to 5 distractors`, () => {
      // Every word bank is either classic (8 gaps) or Sprachbausteine (10 gaps); nothing in between.
      const all = textsOf(level, "grammar.wordbank");
      for (const t of all) expect([CLASSIC_WORD_BANK_GAPS, SPRACHBAUSTEINE_GAPS], paragraphs(t)[1]).toContain(gapsOf(t).gaps.length);
      const texts = all.filter((t) => gapsOf(t).gaps.length === CLASSIC_WORD_BANK_GAPS);
      expect(texts).toHaveLength(want.wordBanks);
      expect(texts.map((t) => t.within).sort()).toEqual(["EASY", "HARD", "MID"]);
      for (const t of texts) {
        const { gaps, key } = gapsOf(t);
        expect(gaps.every((g) => !g.choices)).toBe(true);
        expect(key.distractors?.length, paragraphs(t)[1]).toBeGreaterThanOrEqual(4);
        expect(key.distractors?.length, paragraphs(t)[1]).toBeLessThanOrEqual(5);
        const pool = poolOf(t);
        expect(new Set(pool).size, paragraphs(t)[1]).toBe(pool.length);
      }
    });

    it(`${level}: ${want.sprachbausteine} Sprachbausteine word banks with 10 gaps and 15 different words`, () => {
      // telc B1/B2 Sprachbausteine: ten gaps, fifteen words, each word used at most once (B1 and B2 only).
      const texts = textsOf(level, "grammar.wordbank").filter((t) => gapsOf(t).gaps.length === SPRACHBAUSTEINE_GAPS);
      expect(texts).toHaveLength(want.sprachbausteine);
      for (const t of texts) {
        const { gaps } = gapsOf(t);
        expect(t.within, paragraphs(t)[1]).toBeDefined();
        expect(gaps.every((g) => !g.choices)).toBe(true);
        const pool = poolOf(t);
        expect(pool, paragraphs(t)[1]).toHaveLength(SPRACHBAUSTEINE_WORDS);
        expect(new Set(pool).size, paragraphs(t)[1]).toBe(pool.length);
      }
    });

    it(`${level}: ${want.open} open cloze texts, easy to hard, with typed gaps`, () => {
      const texts = textsOf(level, "grammar.open");
      expect(texts).toHaveLength(want.open);
      if (want.open) expect(texts.map((t) => t.within).sort()).toEqual(["EASY", "HARD", "MID"]);
      for (const t of texts) {
        expect(t.type).toBe("GAP_FILL");
        const { gaps, key } = gapsOf(t);
        expect(gaps.length, paragraphs(t)[1]).toBeGreaterThanOrEqual(8);
        expect(gaps.every((g) => !g.choices)).toBe(true);
        expect(key.distractors ?? [], paragraphs(t)[1]).toEqual([]);
      }
    });

    it(`${level}: every text has its own title and keeps its first and last sentence free of gaps`, () => {
      const texts = [...textsOf(level, "grammar.cloze"), ...textsOf(level, "grammar.wordbank"), ...textsOf(level, "grammar.open")];
      const total = want.cloze + want.wordBanks + want.sprachbausteine + want.open;
      expect(texts).toHaveLength(total);
      const titles = texts.map((t) => paragraphs(t)[1]);
      expect(new Set(titles).size).toBe(total);
      for (const t of texts) {
        const [, title, text] = paragraphs(t);
        expect(title.length, title).toBeLessThanOrEqual(40);
        expect(title).not.toContain("{{");
        const sentences = text.split(/(?<=[.!?])\s+/);
        expect(sentences[0], title).not.toContain("{{");
        expect(sentences.at(-1), title).not.toContain("{{");
      }
    });
  }
});

describe("starter C-tests accept the equally correct completions", () => {
  const ctest = (level: string) => SEED_BANK.items.find((i) => i.level === level && i.skillTag === "grammar.ctest")!;
  const accepts = (level: string, gap: string, typed: string) => {
    const c = ctest(level);
    return scoreItem(c.type, c.content, c.key, { gaps: { [gap]: typed } })?.score === 1 / Object.keys((c.key as { answers: object }).answers).length;
  };

  it("A1: etwas Brot", () => {
    expect(accepts("A1", "g8", "twas")).toBe(true);
    expect(accepts("A1", "g8", "in")).toBe(true);
  });

  it("B1: Teilnehmerinnen and Teilnehmenden", () => {
    expect(accepts("B1", "g15", "ehmerinnen")).toBe(true);
    expect(accepts("B1", "g15", "Teilnehmenden")).toBe(true);
  });

  it("B2: dies, Freizeit, selber", () => {
    expect(accepts("B2", "g2", "ies")).toBe(true);
    expect(accepts("B2", "g3", "zeit")).toBe(true);
    expect(accepts("B2", "g6", "selber")).toBe(true);
  });

  // The later C-tests of a level, picked by a word from their first sentence.
  const acceptsIn = (level: string, firstWord: string, gap: string, typed: string) => {
    const c = SEED_BANK.items.find(
      (i) => i.level === level && i.skillTag === "grammar.ctest" && i.prompt.includes(firstWord),
    );
    if (!c) throw new Error(`no ${level} C-test with "${firstWord}"`);
    return scoreItem(c.type, c.content, c.key, { gaps: { [gap]: typed } })?.score === 1 / Object.keys((c.key as { answers: object }).answers).length;
  };

  it("A2 train: hatte", () => {
    expect(acceptsIn("A2", "Schwester Mei", "g18", "at")).toBe(true);
    expect(acceptsIn("A2", "Schwester Mei", "g18", "atte")).toBe(true);
    expect(acceptsIn("A2", "Schwester Mei", "g18", "hatte")).toBe(true);
  });

  it("B1 club: andern", () => {
    expect(acceptsIn("B1", "Volleyballverein", "g17", "eren")).toBe(true);
    expect(acceptsIn("B1", "Volleyballverein", "g17", "ern")).toBe(true);
    expect(acceptsIn("B1", "Volleyballverein", "g17", "andern")).toBe(true);
  });

  it("B2 volunteering: Einkauf, keinerlei", () => {
    expect(acceptsIn("B2", "Stadtvierteln", "g3", "aufen")).toBe(true);
    expect(acceptsIn("B2", "Stadtvierteln", "g3", "auf")).toBe(true);
    expect(acceptsIn("B2", "Stadtvierteln", "g3", "Einkauf")).toBe(true);
    expect(acceptsIn("B2", "Stadtvierteln", "g8", "in")).toBe(true);
    expect(acceptsIn("B2", "Stadtvierteln", "g8", "inerlei")).toBe(true);
    expect(acceptsIn("B2", "Stadtvierteln", "g8", "keinerlei")).toBe(true);
  });

  it("C1 gardens: Freizeitbetätigung", () => {
    expect(acceptsIn("C1", "Hinterhöfen", "g2", "schäftigung")).toBe(true);
    expect(acceptsIn("C1", "Hinterhöfen", "g2", "tätigung")).toBe(true);
    expect(acceptsIn("C1", "Hinterhöfen", "g2", "Freizeitbetätigung")).toBe(true);
  });
});

describe("starter bank items are well formed", () => {
  it("every item passes validation", () => {
    const failures = SEED_BANK.items
      .map((item, i) => ({ i, prompt: item.prompt.slice(0, 50), errors: validateItem(item) }))
      .filter((f) => f.errors.length > 0);
    expect(failures).toEqual([]);
  });

  it("stimulus keys are unique and every item points at a real one of its section and level", () => {
    const keys = SEED_BANK.stimuli.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of SEED_BANK.items) {
      if (item.section === "READING" || item.section === "LISTENING") {
        const s = SEED_BANK.stimuli.find((x) => x.key === item.stimulusKey);
        expect(s, `${item.section} item "${item.prompt.slice(0, 40)}" has no stimulus`).toBeDefined();
        expect(s!.section).toBe(item.section);
        expect(s!.level).toBe(item.level);
      } else {
        expect(item.stimulusKey).toBeUndefined();
      }
    }
  });

  it("every listening script names only declared speakers", () => {
    for (const s of SEED_BANK.stimuli.filter((x) => x.section === "LISTENING")) {
      expect(s.speakers?.length, s.key).toBeGreaterThan(0);
      const labels = new Set(s.speakers!.map((sp) => sp.label));
      for (const line of s.body.split("\n").filter((l) => l.trim())) {
        const label = line.split(":")[0].trim();
        expect(labels.has(label), `${s.key}: "${line.slice(0, 30)}"`).toBe(true);
      }
    }
  });

  it("items sit in the section part they belong to", () => {
    const sectionOf = { grammar: "GRAMMAR", reading: "READING", listening: "LISTENING", writing: "WRITING", speaking: "SPEAKING" };
    for (const [name, part] of Object.entries(SEED_PARTS)) {
      for (const item of part.items) expect(item.section).toBe(sectionOf[name as keyof typeof sectionOf]);
    }
  });

  it("no single option position holds more than 40% of single-choice keys", () => {
    const single = SEED_BANK.items.filter((i) => i.type === "SINGLE_CHOICE");
    const byPos = new Map<number, number>();
    for (const item of single) {
      if (item.content.kind !== "CHOICE" || item.key.kind !== "CHOICE") continue;
      const pos = item.content.options.findIndex((o) => o.id === (item.key as { correct: string[] }).correct[0]);
      byPos.set(pos, (byPos.get(pos) ?? 0) + 1);
    }
    for (const n of byPos.values()) expect(n / single.length).toBeLessThanOrEqual(0.4);
  });

  it("every choice item has four unique options (three pictures, or 6 to 8 to tick) and its key is among them", () => {
    // Four options, except two formats of the 2026-10-23 bank: a picture choice ("Bild A" to "Bild C") may have
    // three options when every option is a picture, as in ÖSD and telc A1/A2; a "tick 4 of 8" MULTI_CHOICE with
    // `pick` has 6 to 8 options and as many keys as it asks the student to tick.
    const norm = (t: string) => t.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    const ids = (n: number) => "abcdefgh".slice(0, n).split("");
    const choice = SEED_BANK.items.filter((i) => i.content.kind === "CHOICE");
    expect(choice.length).toBeGreaterThan(0);
    for (const item of choice) {
      if (item.content.kind !== "CHOICE" || item.key.kind !== "CHOICE") continue;
      const where = `${item.level} ${item.section} "${item.prompt.slice(0, 40)}"`;
      const { options, pick } = item.content;
      const allPictures = options.every((o) => o.image);
      const tick = item.type === "MULTI_CHOICE" && pick !== undefined;
      const n = options.length;
      if (tick) expect(n, where).toBeGreaterThanOrEqual(6);
      if (tick) expect(n, where).toBeLessThanOrEqual(8);
      else expect(allPictures ? [3, 4] : [4], where).toContain(n);
      expect(options.map((o) => o.id), where).toEqual(ids(n));
      expect(new Set(options.map((o) => norm(o.text))).size, where).toBe(n);
      expect(item.key.correct, where).toHaveLength(tick ? pick : 1);
      expect(new Set(item.key.correct).size, where).toBe(item.key.correct.length);
      for (const id of item.key.correct) expect(options.map((o) => o.id), where).toContain(id);
    }
  });

  it("every item has a stable seed key no other item shares", () => {
    const keys = SEED_BANK.items.map(seedItemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("contains no em-dash anywhere", () => {
    expect(JSON.stringify(SEED_BANK)).not.toContain("\u2014");
  });
});

describe("starter writing and speaking tasks name what to cover", () => {
  const productive = SEED_BANK.items.filter((i) => i.type === "WRITING_PROMPT" || i.type === "SPEAKING_PROMPT");

  it("every task has two to six short student points", () => {
    expect(productive.length).toBeGreaterThanOrEqual(72);
    for (const item of productive) {
      const points = item.rubric?.studentPoints ?? [];
      expect(points.length, item.prompt.slice(0, 60)).toBeGreaterThanOrEqual(2);
      expect(points.length, item.prompt.slice(0, 60)).toBeLessThanOrEqual(6);
      for (const p of points) expect(p.trim().length, p).toBeGreaterThan(0);
    }
  });

  it("no point names a level, a sample, a quotation or a number", () => {
    for (const item of productive) {
      for (const p of item.rubric?.studentPoints ?? []) {
        expect(p, p).not.toMatch(/\b[ABC][12]\b|Niveau|Stufe|z\. ?B\.|zum Beispiel|\.\.\.|["„“”«»]|\d/u);
      }
    }
  });

  it("the form tasks name the fields, never the values to fill in", () => {
    const forms = productive.filter((i) => i.skillTag === "writing.form");
    expect(forms.length).toBeGreaterThanOrEqual(2);
    const text = JSON.stringify(forms.map((i) => i.rubric?.studentPoints));
    for (const value of ["Costa", "Hafenstraße", "28195", "Bremen", "Abend", "Karte", "Tarek", "Mansour", "0176", "Leipzig", "zweimal"]) {
      expect(text, value).not.toContain(value);
    }
    expect(forms[0].rubric?.studentPoints).toContain("Familienname");
  });

  it("the C2 rewrite task gives none of its model sentences", () => {
    const rewrite = productive.find((i) => i.skillTag === "writing.transformation");
    const text = JSON.stringify(rewrite?.rubric?.studentPoints).toLowerCase();
    for (const word of ["trotz der", "mangels", "lässt sich", "angemeldeten", "sollten die"]) expect(text, word).not.toContain(word);
  });
});
