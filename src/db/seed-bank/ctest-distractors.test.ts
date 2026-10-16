import { describe, expect, it } from "vitest";
import { cTest } from "./ctest";
import { seedItemKey } from "./seed-key";

describe("cTest distractors", () => {
  const base = { first: "Ich heiße Lena.", body: "Ich bin 24 Jahre alt und arbeite in Köln.", last: "Das ist schön." };

  it("puts them in the key in gap order, never in the content", () => {
    const item = cTest("A1", "MID", { ...base, distractors: { 3: ["en"], 1: ["ist"] } });
    expect(item.key).toMatchObject({ kind: "GAP", distractors: ["ist", "en"] });
    expect(JSON.stringify(item.content)).not.toContain("ist");
  });

  it("does not change the seed key of the item", () => {
    const a = cTest("A1", "MID", base);
    const b = cTest("A1", "MID", { ...base, distractors: { 1: ["ist"] } });
    expect(seedItemKey(b)).toBe(seedItemKey(a));
  });

  it("rejects a distractor a gap accepts, one that completes the target stem, or an unknown gap", () => {
    expect(() => cTest("A1", "MID", { ...base, distractors: { 2: ["in"] } })).toThrow(/accepted/);
    expect(() => cTest("A1", "MID", { ...base, distractors: { 1: ["alt"] } })).toThrow(/accepted/);
    expect(() => cTest("A1", "MID", { ...base, distractors: { 9: ["x"] } })).toThrow(/does not exist/);
  });
});
