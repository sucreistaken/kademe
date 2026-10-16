import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { buildCTestPool, distractorCount } from "./ctest-pool";
import { normalizeAnswer, typedMatches } from "./item-scoring";

describe("hand-written distractors in buildCTestPool", () => {
  const parts = ["hte", "ine", "en", "r", "u", "nd", "eit", "ht", "m", "ie"];
  const ids = parts.map((_, i) => `g${i + 1}`);
  const answers = Object.fromEntries(parts.map((p, i) => [ids[i], [p, `x${p}`]]));
  const hand = ["hten", "inem", "em", "er", "us", "nter", "eiten", "st", "ms", "ind", "ine", "hte", "", "hten"];
  const rest = (pool: string[]) => {
    const r = [...pool];
    for (const p of parts) r.splice(r.indexOf(p), 1);
    return r;
  };

  it("uses only valid hand-written parts, ceil(gaps * 0.6) of them, deterministically", () => {
    for (let seed = 0; seed < 50; seed++) {
      const pool = buildCTestPool(ids, answers, seed, hand);
      expect(pool).toEqual(buildCTestPool(ids, answers, seed, hand));
      const extra = rest(pool);
      expect(extra).toHaveLength(distractorCount(parts.length));
      for (const d of extra) {
        expect(hand).toContain(d);
        expect(["", "ine", "hte"]).not.toContain(d);
      }
      expect(new Set(extra).size).toBe(extra.length);
    }
  });

  it("picks different hand-written parts for different seeds when there are spares", () => {
    const sets = new Set<string>();
    for (let seed = 0; seed < 30; seed++) sets.add(rest(buildCTestPool(ids, answers, seed, hand)).sort().join(","));
    expect(sets.size).toBeGreaterThan(1);
  });

  it("tops up with mechanical variants when too few hand-written parts are valid", () => {
    const extra = rest(buildCTestPool(ids, answers, 3, ["hten", "us"]));
    expect(extra).toHaveLength(distractorCount(parts.length));
    expect(extra).toEqual(expect.arrayContaining(["hten", "us"]));
  });

  it("is the old mechanical pool when no hand-written parts are given", () => {
    expect(buildCTestPool(ids, answers, 9, [])).toEqual(buildCTestPool(ids, answers, 9));
  });
});

describe("seed C-tests carry hand-written distractors", () => {
  const tests = SEED_BANK.items.filter((i) => i.skillTag === "grammar.ctest");

  it("has exactly ceil(gaps * 0.6) + 3 per test, every pool made only of them", () => {
    expect(tests).toHaveLength(18);
    for (const t of tests) {
      if (t.content.kind !== "GAP" || t.key.kind !== "GAP") throw new Error("not a gap item");
      const gapIds = t.content.gaps.map((g) => g.id);
      const hand = t.key.distractors ?? [];
      expect(hand).toHaveLength(distractorCount(gapIds.length) + 3);
      for (let seed = 0; seed < 25; seed++) {
        const pool = buildCTestPool(gapIds, t.key.answers, seed, hand);
        const extra = [...pool];
        for (const g of gapIds) extra.splice(extra.indexOf(t.key.answers[g][0]), 1);
        expect(extra).toHaveLength(distractorCount(gapIds.length));
        for (const d of extra) expect(hand).toContain(d);
        expect(pool).toEqual(buildCTestPool(gapIds, t.key.answers, seed, hand));
      }
    }
  });

  it("never lets a distractor be accepted, nor complete any gap stem into an accepted answer", () => {
    for (const t of tests) {
      if (t.content.kind !== "GAP" || t.key.kind !== "GAP") throw new Error("not a gap item");
      const hand = t.key.distractors ?? [];
      const accepted = Object.values(t.key.answers).flat();
      const stems = [...t.prompt.matchAll(/(\p{L}+)\{\{(g\d+)\}\}/gu)].map((m) => ({ stem: m[1], id: m[2] }));
      expect(stems).toHaveLength(t.content.gaps.length);
      expect(new Set(hand.map(normalizeAnswer)).size).toBe(hand.length);
      for (const d of hand) {
        expect(d.trim()).not.toBe("");
        expect(typedMatches(d, accepted)).toBe(false);
        expect(d).toBe(d.toLowerCase());
        for (const { stem, id } of stems) expect(typedMatches(stem + d, t.key.answers[id])).toBe(false);
      }
    }
  });
});
