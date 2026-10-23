import { describe, expect, it } from "vitest";
import { thetaForLevel } from "@/lib/exam/cefr";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import { SEED_BANK } from "@/db/seed-bank";
import type { SeedBankPart, SeedItem } from "@/db/seed-bank/types";
import {
  bankTopUpRefusal,
  databaseTarget,
  formatRetireCounts,
  formatSyncSummary,
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
    expect(plan).toEqual({
      stimuli: [],
      items: [],
      backfill: [],
      retire: [],
      keptEdited: 0,
      sync: { items: [], stimuli: [], plays: [], itemsKeptEdited: 0, stimuliKeptEdited: 0, listeningDiffs: [] },
    });
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

describe("planTopUp with syncSeed", () => {
  const withFields = (item: SeedItem, over: Partial<ExistingItem> = {}) =>
    row(item, {
      seedKey: seedItemKey(item),
      answerKey: item.key,
      difficulty: thetaForLevel(item.level, item.within ?? "MID"),
      explanation: item.explanation ?? null,
      rubric: item.rubric ?? null,
      ...over,
    });
  const readingStimulus = (over = {}) => ({
    id: "s1",
    seedKey: "r-b1-a",
    origin: "SEED",
    section: "READING" as const,
    level: "B1" as const,
    title: "A",
    body: "Text",
    speakers: null,
    ...over,
  });
  const current = () => bank.items.map((i) => withFields(i));
  const sync = (existing: Parameters<typeof planTopUp>[1]) => planTopUp(bank, existing, { syncSeed: true }).sync;

  it("changes nothing when the org is already current (and the float4 difficulty round trip)", () => {
    const items = bank.items.map((i) => withFields(i, { difficulty: Math.fround(thetaForLevel(i.level, "MID")) }));
    expect(sync({ stimuli: [readingStimulus()], items })).toEqual({
      items: [],
      stimuli: [],
      plays: [],
      itemsKeptEdited: 0,
      stimuliKeptEdited: 0,
      listeningDiffs: [],
    });
  });

  it("does nothing unless syncSeed is asked for", () => {
    const items = [withFields(bank.items[0], { answerKey: { kind: "CHOICE", correct: ["b"] } })];
    expect(planTopUp(bank, { stimuli: [], items }).sync.items).toEqual([]);
  });

  it("updates key, difficulty, explanation and rubric that differ, only those fields", () => {
    const seeded: SeedBankPart = {
      stimuli: [],
      items: [{ ...choiceItem("Eins"), within: "HARD", explanation: "Neu", key: { kind: "CHOICE", correct: ["a", "b"] } }],
    };
    const old = withFields({ ...seeded.items[0], within: undefined, explanation: "Alt", key: { kind: "CHOICE", correct: ["a"] } });
    const plan = planTopUp(seeded, { stimuli: [], items: [{ ...old, seedKey: seedItemKey(seeded.items[0]) }] }, { syncSeed: true }).sync;
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].fields).toEqual(["key", "difficulty", "explanation"]);
    expect(plan.items[0].set).toEqual({
      answerKey: { kind: "CHOICE", correct: ["a", "b"] },
      difficulty: thetaForLevel("B1", "HARD"),
      explanation: "Neu",
    });
  });

  it("brings the student points onto an existing writing or speaking starter item, rubric only", () => {
    const task = (studentPoints?: string[]): SeedItem => ({
      section: "SPEAKING",
      level: "A1",
      type: "SPEAKING_PROMPT",
      skillTag: "speaking.request",
      within: "MID",
      prompt: "Bitten Sie Herrn Braun um den Kuli. Sagen Sie auch danke.",
      content: { kind: "SPEAKING", thinkSeconds: 20, answerSeconds: 30, maxTakes: 2 },
      key: { kind: "NONE" },
      rubric: { contentPoints: ["höfliche Bitte", "Dank"], register: "formell (Sie)", ...(studentPoints ? { studentPoints } : {}) },
      explanation: "Bewertung",
    });
    const seeded: SeedBankPart = { stimuli: [], items: [task(["höflich um den Kuli bitten", "sich bedanken"])] };
    // The rubric is not part of the seed key, so the old row matches the new seed item.
    expect(seedItemKey(task())).toBe(seedItemKey(seeded.items[0]));
    const old = withFields(task());
    const plan = planTopUp(seeded, { stimuli: [], items: [old] }, { syncSeed: true }).sync;
    expect(plan.items).toEqual([
      {
        id: old.id,
        section: "SPEAKING",
        level: "A1",
        prompt: seeded.items[0].prompt,
        fields: ["rubric"],
        set: { rubric: { contentPoints: ["höfliche Bitte", "Dank"], register: "formell (Sie)", studentPoints: ["höflich um den Kuli bitten", "sich bedanken"] } },
      },
    ]);
    expect(formatSyncSummary(plan)[0]).toBe("sync items SPEAKING: A1 1");
    // Run again on the synced row: nothing left to do.
    const synced = { ...old, rubric: plan.items[0].set.rubric };
    expect(planTopUp(seeded, { stimuli: [], items: [synced] }, { syncSeed: true }).sync.items).toEqual([]);
    // A starter item the school edited keeps its own rubric.
    const kept = planTopUp(seeded, { stimuli: [], items: [{ ...old, edited: true }] }, { syncSeed: true }).sync;
    expect(kept.items).toEqual([]);
    expect(kept.itemsKeptEdited).toBe(1);
  });

  it("syncs the student points of every starter writing and speaking task in the real bank", () => {
    const productive = SEED_BANK.items.filter((i) => i.type === "WRITING_PROMPT" || i.type === "SPEAKING_PROMPT");
    // As the rows were seeded before the student points existed.
    const before = (i: SeedItem): SeedItem => ({ ...i, rubric: { contentPoints: i.rubric?.contentPoints ?? [], ...(i.rubric?.register ? { register: i.rubric.register } : {}) } });
    const items = productive.map((i) => withFields(before(i), { seedKey: seedItemKey(i) }));
    const plan = planTopUp({ stimuli: [], items: productive }, { stimuli: [], items }, { syncSeed: true }).sync;
    expect(plan.items).toHaveLength(productive.length);
    for (const [n, change] of plan.items.entries()) {
      expect(change.fields).toEqual(["rubric"]);
      expect(change.set.rubric).toEqual(productive[n].rubric);
    }
  });

  it("compares keys regardless of jsonb key order", () => {
    const items = bank.items.map((i) => withFields(i, { answerKey: { correct: ["a"], kind: "CHOICE" } as SeedItem["key"] }));
    expect(sync({ stimuli: [readingStimulus()], items }).items).toEqual([]);
  });

  it("skips a starter item the school edited and counts it", () => {
    const items = [withFields(bank.items[0], { answerKey: { kind: "CHOICE", correct: ["c"] }, edited: true }), ...current().slice(1)];
    const plan = sync({ stimuli: [readingStimulus()], items });
    expect(plan.items).toEqual([]);
    expect(plan.itemsKeptEdited).toBe(1);
  });

  it("never touches TEACHER or AI items, even with a seed key that matches", () => {
    const changed = { answerKey: { kind: "CHOICE", correct: ["c"] } as SeedItem["key"] };
    const items = [withFields(bank.items[0], { ...changed, origin: "TEACHER" }), withFields(bank.items[1], { ...changed, origin: "AI" })];
    expect(sync({ stimuli: [], items }).items).toEqual([]);
  });

  it("does not look at status: a RETIRED item is synced but its status is not part of the change", () => {
    const items = [withFields(bank.items[0], { status: "RETIRED", explanation: "alt" })];
    const [change] = sync({ stimuli: [], items }).items;
    expect(change.fields).toEqual(["explanation"]);
    expect(Object.keys(change.set)).not.toContain("status");
  });

  it("syncs an unkeyed starter row through its computed key", () => {
    const items = [withFields(bank.items[0], { seedKey: null, explanation: "alt" })];
    expect(sync({ stimuli: [], items }).items.map((i) => i.id)).toEqual(["id-Eins"]);
  });

  it("ignores starter items the bank no longer has", () => {
    const items = [withFields(choiceItem("Weg"), { seedKey: "old-key", explanation: "alt" })];
    expect(sync({ stimuli: [], items }).items).toEqual([]);
  });

  it("updates a changed reading text unless an item that reads it was edited", () => {
    const plan = sync({ stimuli: [readingStimulus({ body: "Alter Text" })], items: current() });
    expect(plan.stimuli).toEqual([{ id: "s1", key: "r-b1-a", section: "READING", level: "B1", title: "A", body: "Text" }]);
    const kept = sync({ stimuli: [readingStimulus({ body: "Alter Text", itemEdited: true })], items: current() });
    expect(kept.stimuli).toEqual([]);
    expect(kept.stimuliKeptEdited).toBe(1);
  });

  it("never changes a teacher's reading text", () => {
    expect(sync({ stimuli: [readingStimulus({ body: "Anders", origin: "TEACHER" })], items: current() }).stimuli).toEqual([]);
  });

  it("leaves a listening script alone and reports the difference", () => {
    const listening: SeedBankPart = {
      stimuli: [{ key: "l-b1-a", section: "LISTENING", level: "B1", title: "L", body: "A: Neu", topic: "t", speakers: [{ label: "A", voice: "A" }] }],
      items: [],
    };
    const row0 = { id: "l1", seedKey: "l-b1-a", origin: "SEED", section: "LISTENING" as const, level: "B1" as const, title: "L", body: "A: Alt", speakers: [{ label: "A", voice: "A" as const }] };
    const plan = planTopUp(listening, { stimuli: [row0], items: [] }, { syncSeed: true }).sync;
    expect(plan.stimuli).toEqual([]);
    expect(plan.listeningDiffs).toEqual([{ id: "l1", key: "l-b1-a", level: "B1" }]);
    const same = planTopUp(listening, { stimuli: [{ ...row0, body: "A: Neu" }], items: [] }, { syncSeed: true }).sync;
    expect(same.listeningDiffs).toEqual([]);
  });

  it("syncs the play limit of an unedited starter clip and leaves an edited one alone", () => {
    const listening: SeedBankPart = {
      stimuli: [{ key: "l-b2-a", section: "LISTENING", level: "B2", title: "L", body: "A: Neu", topic: "t", speakers: [{ label: "A", voice: "A" }], maxPlays: 1 }],
      items: [],
    };
    const row = { id: "l1", seedKey: "l-b2-a", origin: "SEED", section: "LISTENING" as const, level: "B2" as const, title: "L", body: "A: Neu", speakers: [{ label: "A", voice: "A" as const }], maxPlays: null };
    const plan = planTopUp(listening, { stimuli: [row], items: [] }, { syncSeed: true }).sync;
    expect(plan.plays).toEqual([{ id: "l1", key: "l-b2-a", level: "B2", maxPlays: 1 }]);
    expect(planTopUp(listening, { stimuli: [{ ...row, itemEdited: true }], items: [] }, { syncSeed: true }).sync.plays).toEqual([]);
    expect(planTopUp(listening, { stimuli: [{ ...row, maxPlays: 1 }], items: [] }, { syncSeed: true }).sync.plays).toEqual([]);
    expect(planTopUp(listening, { stimuli: [row], items: [] }).sync.plays).toEqual([]);
    // Rows loaded without the column (undefined) are not touched.
    const unloaded = { ...row, maxPlays: undefined };
    expect(planTopUp(listening, { stimuli: [unloaded], items: [] }, { syncSeed: true }).sync.plays).toEqual([]);
  });

  it("is idempotent: applying the plan leaves nothing for a second run", () => {
    const old = [
      withFields(bank.items[0], { explanation: "alt", difficulty: 9 }),
      withFields(bank.items[1], { answerKey: { kind: "CHOICE", correct: ["c"] } }),
      ...current().slice(2),
    ];
    const first = sync({ stimuli: [readingStimulus({ body: "Alt" })], items: old });
    expect(first.items).toHaveLength(2);
    const applied = old.map((o) => ({ ...o, ...(first.items.find((c) => c.id === o.id)?.set ?? {}) }));
    const second = sync({ stimuli: [readingStimulus({ body: first.stimuli[0].body })], items: applied });
    expect(second.items).toEqual([]);
    expect(second.stimuli).toEqual([]);
  });

  it("prints counts per section and level, examples and the kept lines", () => {
    const items = [withFields(bank.items[0], { explanation: "alt" }), withFields(bank.items[2], { explanation: "alt", edited: true }), ...current().slice(1, 2)];
    const lines = formatSyncSummary(sync({ stimuli: [readingStimulus({ body: "Alt" })], items }));
    expect(lines).toContain("sync items GRAMMAR: B1 1");
    expect(lines).toContain("sync texts READING: B1 1");
    expect(lines.some((l) => l.startsWith("e.g. GRAMMAR B1 [explanation] Eins"))).toBe(true);
    expect(lines).toContain("kept 1 starter items the school edited");
  });
});
