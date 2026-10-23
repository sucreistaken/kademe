import { describe, expect, it } from "vitest";
import { SEED_BANK } from "./index";
import { canonicalJson, seedItemKey } from "./seed-key";

describe("seedItemKey", () => {
  const base = {
    section: "READING" as const,
    level: "B1" as const,
    type: "SINGLE_CHOICE" as const,
    prompt: "Was stimmt?",
    content: { kind: "CHOICE" as const, options: [{ id: "a", text: "x" }, { id: "b", text: "y" }] },
    stimulusKey: "r-b1-a",
  };

  it("is stable and readable", () => {
    expect(seedItemKey(base)).toBe(seedItemKey({ ...base }));
    expect(seedItemKey(base)).toMatch(/^reading-b1-[0-9a-f]{16}$/);
  });

  it("keeps the key of every item of a real listening stimulus when that stimulus gains a play limit", () => {
    const stim = SEED_BANK.stimuli.find((x) => x.section === "LISTENING")!;
    const own = SEED_BANK.items.filter((i) => i.stimulusKey === stim.key);
    expect(own.length).toBeGreaterThan(0);
    const before = own.map((i) => seedItemKey(i));
    const limited = { ...stim, maxPlays: 1 as const };
    const after = SEED_BANK.items.filter((i) => i.stimulusKey === limited.key).map((i) => seedItemKey(i));
    expect(after).toEqual(before);
    expect(before[0]).toMatch(/^listening-[a-c][12]-[0-9a-f]{16}$/);
  });

  it("tells apart items that share a prompt but not the text or the content", () => {
    expect(seedItemKey(base)).not.toBe(seedItemKey({ ...base, stimulusKey: "r-b1-b" }));
    expect(seedItemKey(base)).not.toBe(
      seedItemKey({ ...base, content: { kind: "CHOICE", options: [{ id: "a", text: "z" }, { id: "b", text: "y" }] } }),
    );
  });

  it("does not depend on the key order a jsonb column hands back", () => {
    const reordered = { options: [{ text: "x", id: "a" }, { text: "y", id: "b" }], kind: "CHOICE" as const };
    expect(seedItemKey({ ...base, content: reordered })).toBe(seedItemKey(base));
    expect(seedItemKey({ ...base, stimulusKey: undefined })).toBe(seedItemKey({ ...base, stimulusKey: null }));
  });
});

describe("canonicalJson", () => {
  it("sorts keys at every depth and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
});
