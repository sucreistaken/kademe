import { describe, expect, it } from "vitest";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import type { SeedBankPart, SeedItem } from "@/db/seed-bank/types";
import {
  bankTopUpRefusal,
  databaseTarget,
  formatRetireCounts,
  planTopUp,
  retireCounts,
  seedOrderInStimulus,
  type ExistingItem,
} from "./bank-topup";

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
  status: "APPROVED",
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
    expect(plan).toEqual({ stimuli: [], items: [], backfill: [], retire: [], keptEdited: 0 });
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

describe("planTopUp with retireStale", () => {
  // Starter items of an older bank: keyed rows whose key is gone, and an
  // unkeyed row that hashes to nothing in the current bank.
  const oldKeyed = (prompt: string, level: SeedItem["level"], section: SeedItem["section"] = "GRAMMAR") =>
    row({ ...choiceItem(prompt), section, level }, { id: `old-${prompt}`, seedKey: `old-key-${prompt}`, section, level });
  const current = bank.items.map((item) => row(item, { seedKey: seedItemKey(item) }));
  const stimuliNow = [{ id: "s1", seedKey: "r-b1-a" }];

  it("retires stale starter items and leaves the current ones", () => {
    const unkeyedStale = row(choiceItem("Alt"), { id: "old-unkeyed" });
    const plan = planTopUp(bank, { stimuli: stimuliNow, items: [...current, oldKeyed("Vorher", "A1"), unkeyedStale] }, { retireStale: true });
    expect(plan.retire.map((r) => r.id)).toEqual(["old-Vorher", "old-unkeyed"]);
    expect(plan.items).toEqual([]);
  });

  it("keeps a stale starter item the school edited and counts it (user decision 2026-10-07)", () => {
    const edited = { ...oldKeyed("Bearbeitet", "B1"), edited: true };
    const plan = planTopUp(bank, { stimuli: stimuliNow, items: [...current, oldKeyed("Vorher", "A1"), edited] }, { retireStale: true });
    expect(plan.retire.map((r) => r.id)).toEqual(["old-Vorher"]);
    expect(plan.keptEdited).toBe(1);
  });

  it("keeps an unkeyed starter row that still hashes to a bank item, and backfills it", () => {
    const unkeyedCurrent = row(bank.items[0]);
    const plan = planTopUp(bank, { stimuli: stimuliNow, items: [unkeyedCurrent, ...current.slice(1)] }, { retireStale: true });
    expect(plan.retire).toEqual([]);
    expect(plan.backfill.map((b) => b.id)).toEqual(["id-Eins"]);
  });

  it("never touches a school's own items, even with an unknown key", () => {
    const teacher = row(choiceItem("Unsere Frage"), { id: "teacher", origin: "TEACHER" });
    const ai = row(choiceItem("KI Frage"), { id: "ai", origin: "AI", seedKey: "old-key-ai" });
    const plan = planTopUp(bank, { stimuli: stimuliNow, items: [...current, teacher, ai] }, { retireStale: true });
    expect(plan.retire).toEqual([]);
  });

  it("leaves stale starter items that are not APPROVED alone (already retired, draft, rejected)", () => {
    const items = [
      ...current,
      { ...oldKeyed("A", "A1"), status: "RETIRED" },
      { ...oldKeyed("B", "A2"), status: "DRAFT" },
      { ...oldKeyed("C", "B1"), status: "REJECTED" },
    ];
    expect(planTopUp(bank, { stimuli: stimuliNow, items }, { retireStale: true }).retire).toEqual([]);
  });

  it("retires nothing without the option", () => {
    const plan = planTopUp(bank, { stimuli: stimuliNow, items: [...current, oldKeyed("Vorher", "A1")] });
    expect(plan.retire).toEqual([]);
  });

  it("counts the retirements per section and level for the summary, in bank order", () => {
    const stale = [
      oldKeyed("r1", "B2", "READING"),
      oldKeyed("g1", "A2"),
      oldKeyed("g2", "A1"),
      oldKeyed("g3", "A2"),
      oldKeyed("l1", "C1", "LISTENING"),
    ];
    const plan = planTopUp(bank, { stimuli: stimuliNow, items: [...current, ...stale] }, { retireStale: true });
    expect(plan.retire).toHaveLength(5);
    expect(retireCounts(plan.retire)).toEqual([
      { section: "GRAMMAR", level: "A1", n: 1 },
      { section: "GRAMMAR", level: "A2", n: 2 },
      { section: "READING", level: "B2", n: 1 },
      { section: "LISTENING", level: "C1", n: 1 },
    ]);
    expect(formatRetireCounts(plan.retire)).toEqual(["GRAMMAR: A1 1, A2 2", "READING: B2 1", "LISTENING: C1 1"]);
    expect(formatRetireCounts([])).toEqual([]);
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
