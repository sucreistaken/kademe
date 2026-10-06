import { describe, expect, it } from "vitest";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import type { SeedBankPart, SeedItem } from "@/db/seed-bank/types";
import { bankTopUpRefusal, databaseTarget, planTopUp, seedOrderInStimulus, type ExistingItem } from "./bank-topup";

const choiceItem = (prompt: string, stimulusKey?: string): SeedItem => ({
  section: stimulusKey ? "READING" : "GRAMMAR",
  level: "B1",
  type: "SINGLE_CHOICE",
  skillTag: "grammar.x",
  stimulusKey,
  prompt,
  content: { kind: "CHOICE", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }, { id: "c", text: "z" }] },
  key: { kind: "CHOICE", correct: ["a"] },
});

const bank: SeedBankPart = {
  stimuli: [{ key: "r-b1-a", section: "READING", level: "B1", title: "A", body: "Text", topic: "t" }],
  items: [choiceItem("Eins"), choiceItem("Zwei"), choiceItem("Lies", "r-b1-a"), choiceItem("Lies noch", "r-b1-a")],
};

const row = (item: SeedItem, over: Partial<ExistingItem> = {}): ExistingItem => ({
  id: `id-${item.prompt}`,
  seedKey: null,
  origin: "SEED",
  section: item.section,
  level: item.level,
  type: item.type,
  prompt: item.prompt,
  content: item.content,
  stimulusSeedKey: item.stimulusKey ?? null,
  ...over,
});

describe("planTopUp", () => {
  it("adds everything to an empty organisation", () => {
    const plan = planTopUp(bank, { stimuli: [], items: [] });
    expect(plan.stimuli.map((s) => s.key)).toEqual(["r-b1-a"]);
    expect(plan.items.map((i) => i.item.prompt)).toEqual(["Eins", "Zwei", "Lies", "Lies noch"]);
    expect(plan.items[0].seedKey).toBe(seedItemKey(bank.items[0]));
    expect(plan.backfill).toEqual([]);
  });

  it("backfills old seed rows without a key and adds only what is missing", () => {
    const existing = {
      stimuli: [{ id: "s1", seedKey: "r-b1-a" }],
      items: [
        row(bank.items[0]),
        row(bank.items[2]),
        // Jsonb hands keys back in its own order; the match must not care.
        row(bank.items[1], { content: { options: [{ text: "x", id: "a" }, { text: "y", id: "b" }, { text: "z", id: "c" }], kind: "CHOICE" } }),
      ],
    };
    const plan = planTopUp(bank, existing);
    expect(plan.stimuli).toEqual([]);
    expect(plan.items.map((i) => i.item.prompt)).toEqual(["Lies noch"]);
    expect(plan.backfill).toEqual([
      { id: "id-Eins", seedKey: seedItemKey(bank.items[0]) },
      { id: "id-Lies", seedKey: seedItemKey(bank.items[2]) },
      { id: "id-Zwei", seedKey: seedItemKey(bank.items[1]) },
    ]);
  });

  it("does nothing on a second run", () => {
    const keyed = bank.items.map((item) => row(item, { seedKey: seedItemKey(item) }));
    const plan = planTopUp(bank, { stimuli: [{ id: "s1", seedKey: "r-b1-a" }], items: keyed });
    expect(plan).toEqual({ stimuli: [], items: [], backfill: [] });
  });

  it("never claims teacher items, edited seed rows or a duplicate twice", () => {
    const existing = {
      stimuli: [{ id: "s1", seedKey: "r-b1-a" }],
      items: [
        row(bank.items[0], { origin: "TEACHER" }),
        row(bank.items[1], { prompt: "Zwei (bearbeitet)" }),
        row(bank.items[2]),
        row(bank.items[2], { id: "dup" }),
      ],
    };
    const plan = planTopUp(bank, existing);
    expect(plan.backfill.map((b) => b.id)).toEqual(["id-Lies"]);
    expect(plan.items.map((i) => i.item.prompt)).toEqual(["Eins", "Zwei", "Lies noch"]);
  });
});

describe("bankTopUpRefusal", () => {
  const local = (name: string) => `postgresql://kademe:kademe@localhost:5434/${name}`;
  it("runs on a throw-away *_check database", () => {
    expect(bankTopUpRefusal(local("kademe_bank_check"), false)).toBeNull();
  });
  it("refuses the working database unless allowed, and the shared one always", () => {
    expect(bankTopUpRefusal(local("kademe_platform"), false)).toMatch(/_check/);
    expect(bankTopUpRefusal(local("kademe_platform"), true)).toBeNull();
    expect(bankTopUpRefusal(local("kademe"), true)).toMatch(/shared/);
    expect(bankTopUpRefusal("postgresql://u:p@db.example.com:5432/kademe_check", true)).toMatch(/not a local/);
  });
});

describe("production top-up", () => {
  const url = "postgresql://kademe:s3cret@127.0.0.1:5434/kademe";
  const target = "127.0.0.1:5434/kademe";
  it("parses host:port/database without the password", () => {
    expect(databaseTarget(url)).toBe(target);
    expect(databaseTarget(url)).not.toMatch(/s3cret/);
    expect(databaseTarget("postgresql://u:p@db.example.com/x")).toBe("db.example.com:5432/x");
    expect(databaseTarget("nope")).toBeNull();
    expect(databaseTarget(undefined)).toBeNull();
  });
  it("refuses without a confirmation and names the expected value, never the password", () => {
    const r = bankTopUpRefusal(url, { allowWorkingDb: false, production: true });
    expect(r).toContain(`--confirm-db=${target}`);
    expect(r).not.toMatch(/s3cret/);
  });
  it("refuses a mismatched confirmation, including a partial one", () => {
    for (const bad of ["127.0.0.1:5434", "localhost:5434/kademe", "127.0.0.1:5434/kademe_check", `${target}/`]) {
      const r = bankTopUpRefusal(url, { allowWorkingDb: false, production: true, confirmDb: bad });
      expect(r).toMatch(/does not match/);
      expect(r).not.toMatch(/s3cret/);
    }
  });
  it("accepts the exact confirmation, even for the kademe database", () => {
    expect(bankTopUpRefusal(url, { allowWorkingDb: false, production: true, confirmDb: target })).toBeNull();
  });
  it("refuses an invalid url and the combination with --allow-working-db", () => {
    expect(bankTopUpRefusal("nope", { allowWorkingDb: false, production: true, confirmDb: target })).toMatch(/not a valid/);
    expect(bankTopUpRefusal(url, { allowWorkingDb: true, production: true, confirmDb: target })).toMatch(/cannot be combined/);
  });
  it("leaves the defaults unchanged: kademe stays refused without --production", () => {
    expect(bankTopUpRefusal(url, { allowWorkingDb: false })).toMatch(/shared|_check/);
    expect(bankTopUpRefusal(url, { allowWorkingDb: true })).toMatch(/shared/);
    expect(bankTopUpRefusal(url, true)).toMatch(/shared/);
    expect(bankTopUpRefusal(url, { allowWorkingDb: false, confirmDb: target })).toMatch(/only works together/);
  });
});

describe("seedOrderInStimulus", () => {
  it("numbers stimulus items from 1 in bank order and gives 0 to the rest", () => {
    const order = seedOrderInStimulus(bank);
    expect(bank.items.map((i) => order.get(i))).toEqual([0, 0, 1, 2]);
  });
});
