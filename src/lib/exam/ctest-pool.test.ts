import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { buildCTestPool, distractorCount, seedFromText, variantsOf } from "./ctest-pool";
import { normalizeAnswer, typedMatches } from "./item-scoring";

const keyOf = (parts: string[]) => {
  const ids = parts.map((_, i) => `g${i + 1}`);
  const answers = Object.fromEntries(parts.map((p, i) => [ids[i], [p, `x${p}`]]));
  return { ids, answers };
};

describe("variantsOf", () => {
  it("makes inflection variants of a part", () => {
    expect(variantsOf("hte")).toEqual(expect.arrayContaining(["hten", "ht", "hte" + "n"]));
    expect(variantsOf("ine")).toEqual(expect.arrayContaining(["iner", "inem", "in"]));
    expect(variantsOf("en")).toEqual(expect.arrayContaining(["em", "er"]));
  });
  it("never returns the part itself, an empty string or a repeat", () => {
    for (const p of ["r", "u", "e", "en", "hte", "ten", "st", "ß"]) {
      const v = variantsOf(p);
      expect(v).not.toContain(p);
      expect(v).not.toContain("");
      expect(new Set(v).size).toBe(v.length);
    }
  });
  it("swaps case consonants of one-letter parts but invents nothing for a lone vowel", () => {
    expect(variantsOf("r")).toEqual(expect.arrayContaining(["n", "s", "m"]));
    expect(variantsOf("u")).toEqual([]);
  });

  it("drops variants that do not look like German endings", () => {
    for (const p of ["ie", "essant", "racht", "eit"]) {
      for (const v of variantsOf(p)) {
        expect(v).not.toMatch(/[aeiouäöü]{3}|ee/);
        expect(v.length).toBeLessThanOrEqual(p.length + 2);
      }
    }
  });
});

describe("buildCTestPool", () => {
  const parts = ["hte", "ine", "en", "r", "u", "nd", "eit", "en", "ht", "m"];
  const { ids, answers } = keyOf(parts);

  it("is deterministic per seed and differs between seeds", () => {
    expect(buildCTestPool(ids, answers, 7)).toEqual(buildCTestPool(ids, answers, 7));
    expect(buildCTestPool(ids, answers, 7)).not.toEqual(buildCTestPool(ids, answers, 8));
  });

  it("holds every missing part (duplicates twice) plus ceil(gaps * 0.6) distractors", () => {
    const pool = buildCTestPool(ids, answers, 1);
    expect(pool).toHaveLength(parts.length + distractorCount(parts.length));
    const count = (xs: string[], s: string) => xs.filter((x) => x === s).length;
    for (const p of new Set(parts)) expect(count(pool, p)).toBeGreaterThanOrEqual(count(parts, p));
    expect(count(pool, "en")).toBe(2);
  });

  it("never offers a distractor that any gap accepts, nor a duplicate, nor an empty one", () => {
    const accepted = ids.flatMap((g) => answers[g]);
    for (let seed = 0; seed < 200; seed++) {
      const pool = buildCTestPool(ids, answers, seed);
      const rest = [...pool];
      for (const p of parts) rest.splice(rest.indexOf(p), 1);
      expect(rest).toHaveLength(distractorCount(parts.length));
      for (const d of rest) {
        expect(d.trim()).not.toBe("");
        expect(typedMatches(d, accepted)).toBe(false);
        expect(rest.filter((x) => normalizeAnswer(x) === normalizeAnswer(d))).toHaveLength(1);
        expect(parts.some((p) => normalizeAnswer(p) === normalizeAnswer(d))).toBe(false);
      }
    }
  });

  it("does not reveal the whole words or the gap order", () => {
    const pool = buildCTestPool(ids, answers, 5);
    expect(pool.some((p) => p.startsWith("x") && p.length > 1)).toBe(false);
    expect(pool).not.toEqual(parts);
  });

  it("copes with a single short gap", () => {
    const k = keyOf(["r"]);
    const pool = buildCTestPool(k.ids, k.answers, 4);
    expect(pool).toContain("r");
    expect(pool).toHaveLength(2);
    expect(pool.every((p) => p.trim() !== "")).toBe(true);
  });

  it("works for every C-test in the seed bank", () => {
    const tests = SEED_BANK.items.filter((i) => i.skillTag === "grammar.ctest");
    expect(tests.length).toBeGreaterThan(0);
    for (const t of tests) {
      if (t.content.kind !== "GAP" || t.key.kind !== "GAP") throw new Error("not a gap item");
      const gapIds = t.content.gaps.map((g) => g.id);
      const key = t.key.answers;
      const pool = buildCTestPool(gapIds, key, seedFromText(t.prompt));
      expect(pool).toHaveLength(gapIds.length + distractorCount(gapIds.length));
      const accepted = gapIds.flatMap((g) => key[g]);
      const rest = [...pool];
      for (const g of gapIds) rest.splice(rest.indexOf(key[g][0]), 1);
      for (const d of rest) expect(typedMatches(d, accepted)).toBe(false);
    }
  });
});
