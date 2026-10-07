import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { validateItem } from "@/lib/exam/validate";
import { CEFR_LEVELS } from "@/lib/exam/types";
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
      const texts = stimuliOf("READING", level);
      expect(texts.length).toBeGreaterThanOrEqual(3);
      for (const t of texts) {
        expect(SEED_BANK.items.filter((i) => i.stimulusKey === t.key).length).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${level}: listening has at least 2 clips with 3+ items each`, () => {
      const clips = stimuliOf("LISTENING", level);
      expect(clips.length).toBeGreaterThanOrEqual(2);
      for (const c of clips) {
        expect(SEED_BANK.items.filter((i) => i.stimulusKey === c.key).length).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${level}: writing has at least 4 prompts`, () => {
      expect(count("WRITING", level)).toBeGreaterThanOrEqual(4);
    });
    it(`${level}: speaking has at least 4 prompts`, () => {
      expect(count("SPEAKING", level)).toBeGreaterThanOrEqual(4);
    });
    it(`${level}: grammar has one C-test with 15 to 20 typed gaps`, () => {
      const ctests = SEED_BANK.items.filter((i) => i.level === level && i.skillTag === "grammar.ctest");
      expect(ctests).toHaveLength(1);
      const [c] = ctests;
      expect(c.section).toBe("GRAMMAR");
      expect(c.type).toBe("GAP_FILL");
      if (c.content.kind !== "GAP") throw new Error("not a gap item");
      expect(c.content.gaps.length).toBeGreaterThanOrEqual(15);
      expect(c.content.gaps.length).toBeLessThanOrEqual(20);
      expect(c.content.gaps.every((g) => !g.choices)).toBe(true);
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

  it("every item has a stable seed key no other item shares", () => {
    const keys = SEED_BANK.items.map(seedItemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("contains no em-dash anywhere", () => {
    expect(JSON.stringify(SEED_BANK)).not.toContain("\u2014");
  });
});
