import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => {
  const inner = (await import("@/server/create/test-fake-db")).proxyDb(fake) as Record<string | symbol, unknown>;
  // The fake records chains; a transaction runs its callback on the same fake.
  return { db: new Proxy(inner, { get: (target, prop) => (prop === "transaction" ? (fn: (tx: unknown) => unknown) => fn(inner) : target[prop]) }) };
});
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ openStream: async () => ({ stream: null }), putObject: async () => ({ bytes: 0 }) }) }));
vi.mock("@/lib/tts", () => ({ synthesize: vi.fn(), ttsAvailable: () => false }));
// A two-item bank, so the scenarios stay small; the bank's own rows are not the point here.
vi.mock("@/db/seed-bank", () => {
  const item = (prompt: string) => ({
    section: "GRAMMAR",
    level: "B1",
    type: "SINGLE_CHOICE",
    skillTag: "grammar.x",
    prompt,
    content: { kind: "CHOICE", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }] },
    key: { kind: "CHOICE", correct: ["a"] },
  });
  return { SEED_BANK: { stimuli: [], items: [item("Bank eins"), item("Bank zwei")] } };
});

import { SEED_BANK } from "@/db/seed-bank";
import { courseSeed } from "@/db/seed-bank/course-seed";
import { fixtureCourseForm } from "@/db/seed-bank/course-fixture";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import { thetaForLevel } from "@/lib/exam/cefr";
import { clipsWithoutAudio, courseSeedCounts, importSeedBank, previewTopUp, seedCounts, topUpSeedBank } from "./bank-import";

const form = fixtureCourseForm("B1.1", "A");
const course = courseSeed([form]);
const dialect = new PgDialect();
const sqlOf = (where: unknown) => dialect.sqlToQuery(where as never);
const calls = (op: string) => fake.calls.filter(([o]) => o === op).map(([, a]) => a);

/** The `where` of every `update(table)` chain, in order, with the `set` values next to it. */
function updates(table: "items" | "stimuli") {
  const out: Array<{ set: Record<string, unknown>; sql: string; params: unknown[] }> = [];
  fake.calls.forEach(([op, args], n) => {
    if (op !== "update") return;
    const name = (args[0] as unknown as Record<symbol, string>)[Object.getOwnPropertySymbols(args[0] as object).find((s) => s.description === "drizzle:Name")!];
    if (name !== table) return;
    const set = fake.calls.slice(n).find(([o]) => o === "set")![1][0] as Record<string, unknown>;
    const where = fake.calls.slice(n).find(([o]) => o === "where")![1][0];
    const q = sqlOf(where);
    out.push({ set, sql: q.sql, params: q.params });
  });
  return out;
}

/** Rows as the database holds them after a first load of the tiny bank and the fixture form. */
const loadedStimuli = () =>
  course.stimuli.map((s, n) => ({
    id: `cs-${n}`,
    seedKey: s.seedKey,
    origin: "SEED",
    section: s.stimulus.section,
    level: s.stimulus.level,
    title: s.stimulus.title,
    body: s.stimulus.body,
    speakers: s.stimulus.speakers ?? null,
    maxPlays: s.stimulus.maxPlays ?? null,
    courseForm: s.courseForm,
  }));
const bankRow = (prompt: string, over: Record<string, unknown> = {}) => {
  const i = SEED_BANK.items.find((x) => x.prompt === prompt)!;
  return {
    id: `b-${prompt}`,
    seedKey: seedItemKey(i),
    origin: "SEED",
    status: "APPROVED",
    section: i.section,
    level: i.level,
    type: i.type,
    prompt: i.prompt,
    content: i.content,
    stimulusId: null,
    stimulusSeedKey: null,
    answerKey: i.key,
    difficulty: thetaForLevel(i.level, "MID"),
    explanation: null,
    rubric: null,
    courseForm: null,
    courseOrder: null,
    orderInStimulus: 0,
    ...over,
  };
};
const loadedCourseItems = () =>
  course.items.map((c, n) => ({
    id: `ci-${n}`,
    seedKey: c.seedKey,
    origin: "SEED",
    status: "APPROVED",
    section: c.item.section,
    level: c.item.level,
    type: c.item.type,
    prompt: c.item.prompt,
    content: c.item.content,
    stimulusId: null,
    stimulusSeedKey: c.stimulusSeedKey,
    answerKey: c.item.key,
    difficulty: thetaForLevel(c.item.level, c.item.within ?? "MID"),
    explanation: null,
    rubric: c.item.rubric ?? null,
    courseForm: c.courseForm,
    courseOrder: c.courseOrder,
    orderInStimulus: c.orderInStimulus,
  }));

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
});

describe("topUpSeedBank loads the course forms as their own rows", () => {
  it("writes the form's texts and items with course_form, course_order, the form's keys and the bank's defaults", async () => {
    // reads (texts, items, edits), bank items, two course texts, course items
    fake.results = [[], [], [], [], [{ id: "t-reading" }], [{ id: "t-listening" }], []];
    const r = await topUpSeedBank("org-1", { courseForms: [form] });
    const inserts = calls("values") as Array<[Record<string, unknown> | Array<Record<string, unknown>>]>;
    const [bankItems, readingText, listeningText, courseItems] = inserts.map(([v]) => v) as [Array<Record<string, unknown>>, Record<string, unknown>, Record<string, unknown>, Array<Record<string, unknown>>];

    // The bank's rows carry no course form.
    expect(bankItems.map((x) => x.prompt)).toEqual(["Bank eins", "Bank zwei"]);
    for (const x of bankItems) expect(x.courseForm).toBeUndefined();

    expect(readingText).toMatchObject({ orgId: "org-1", section: "READING", origin: "SEED", seedKey: "course-b1-1-a-fx-r-reise", courseForm: "B1.1:A" });
    expect(listeningText).toMatchObject({ section: "LISTENING", seedKey: "course-b1-1-a-fx-l-durchsage", courseForm: "B1.1:A", maxPlays: 2 });

    expect(courseItems).toHaveLength(9);
    for (const x of courseItems) expect(x).toMatchObject({ orgId: "org-1", status: "APPROVED", origin: "SEED", courseForm: "B1.1:A" });
    expect(courseItems.map((x) => [x.section, x.courseOrder, x.orderInStimulus])).toEqual([
      ["READING", 0, 1],
      ["READING", 1, 0],
      ["READING", 2, 2],
      ["GRAMMAR", 0, 0],
      ["GRAMMAR", 1, 0],
      ["LISTENING", 0, 1],
      ["LISTENING", 1, 2],
      ["WRITING", 0, 0],
      ["SPEAKING", 0, 0],
    ]);
    expect(courseItems.map((x) => x.stimulusId)).toEqual(["t-reading", null, "t-reading", null, null, "t-listening", "t-listening", null, null]);
    expect(courseItems.map((x) => x.seedKey)).toEqual(course.items.map((c) => c.seedKey));
    // Difficulty from the level and the item's word, as for the bank.
    expect(courseItems[3].difficulty).toBeLessThan(courseItems[4].difficulty as number);

    expect(r).toMatchObject({ itemsAdded: 2, stimuliAdded: 0, course: { itemsAdded: 9, stimuliAdded: 2, itemsRetired: 0, staleLeft: 0 } });
    expect(r.course.listeningWithoutAudio).toEqual(["course-b1-1-a-fx-l-durchsage"]);
    expect(r.listeningWithoutAudio).toEqual([]);
  });

  it("does nothing when the organisation already has the bank and the form", async () => {
    fake.results = [loadedStimuli(), [bankRow("Bank eins"), bankRow("Bank zwei"), ...loadedCourseItems()], []];
    const r = await topUpSeedBank("org-1", { retireStale: true, syncSeed: true, courseForms: [form] });
    expect(calls("values")).toEqual([]);
    expect(updates("items")).toEqual([]);
    expect(r).toMatchObject({ itemsAdded: 0, itemsRetired: 0, itemsSynced: 0, course: { itemsAdded: 0, stimuliAdded: 0, itemsRetired: 0, itemsSynced: 0 } });
  });

  it("--retire-stale retires bank rows only among bank rows and course rows only among course rows", async () => {
    const staleBank = bankRow("Bank eins", { id: "stale-bank", seedKey: "old-bank-key", prompt: "Alt" });
    const staleCourse = { ...loadedCourseItems()[3], id: "stale-course", seedKey: "course-b1-1-a-old", prompt: "Alt im Kurs" };
    fake.results = [loadedStimuli(), [bankRow("Bank eins"), bankRow("Bank zwei"), staleBank, ...loadedCourseItems(), staleCourse], [], [{ id: "stale-bank" }], [], [{ id: "stale-course" }], []];
    const r = await topUpSeedBank("org-1", { retireStale: true, courseForms: [form] });

    const retires = updates("items").filter((u) => u.set.status === "RETIRED");
    expect(retires).toHaveLength(2);
    expect(retires[0].sql).toContain('"items"."course_form" is null');
    expect(retires[0].sql).not.toContain("is not null");
    expect(retires[0].params).toContain("stale-bank");
    expect(retires[0].params).not.toContain("stale-course");
    expect(retires[1].sql).toContain('"items"."course_form" is not null');
    expect(retires[1].params).toContain("stale-course");
    expect(retires[1].params).not.toContain("stale-bank");
    for (const u of retires) expect(u.sql).toMatch(/"origin" = \$\d+/);

    const audits = (calls("values") as Array<[Record<string, unknown>]>).map(([v]) => v).filter((v) => typeof v.action === "string");
    expect(audits.map((a) => a.action)).toEqual(["bank.retire_stale", "course.retire_stale"]);
    expect(audits[1].meta).toMatchObject({ retired: 1, byForm: { "B1.1:A": 1 } });
    expect(r).toMatchObject({ itemsRetired: 1, course: { itemsRetired: 1, staleLeft: 0 } });
  });

  it("a bank run without course forms in the seed leaves the loaded course rows alone, retire-stale included", async () => {
    // A seed with no course forms: the course rows are absent from it, yet only a course run may retire them.
    fake.results = [loadedStimuli(), [bankRow("Bank eins"), bankRow("Bank zwei"), ...loadedCourseItems()], []];
    const r = await topUpSeedBank("org-1", { retireStale: true, courseForms: [] });
    // Nothing retired in the bank; the (empty) course seed retires every course row, which is its own plan's call.
    expect(r.itemsRetired).toBe(0);
    expect(r.course.itemsAdded).toBe(0);
    const retires = updates("items").filter((u) => u.set.status === "RETIRED");
    expect(retires).toHaveLength(1);
    expect(retires[0].sql).toContain('"items"."course_form" is not null');
  });

  it("--sync-seed updates the bank inside the bank and the form inside the form, order included", async () => {
    const bankChanged = bankRow("Bank eins", { explanation: "alt" });
    const moved = { ...loadedCourseItems()[1], courseOrder: 5 };
    fake.results = [loadedStimuli(), [bankChanged, bankRow("Bank zwei"), loadedCourseItems()[0], moved, ...loadedCourseItems().slice(2)], [], [{ id: bankChanged.id }], [], [{ id: moved.id }], []];
    const r = await topUpSeedBank("org-1", { syncSeed: true, courseForms: [form] });
    const syncs = updates("items");
    expect(syncs).toHaveLength(2);
    expect(syncs[0].set).toMatchObject({ explanation: null });
    expect(syncs[0].sql).toContain('"items"."course_form" is null');
    expect(syncs[1].set).toMatchObject({ courseOrder: 1 });
    expect(syncs[1].sql).toContain('"items"."course_form" is not null');
    expect(syncs[1].params).toContain(moved.id);
    const audits = (calls("values") as Array<[Record<string, unknown>]>).map(([v]) => v).filter((v) => typeof v.action === "string");
    expect(audits.map((a) => a.action)).toEqual(["bank.sync_seed", "course.sync_seed"]);
    expect(r).toMatchObject({ itemsSynced: 1, course: { itemsSynced: 1 } });
  });

  it("without --retire-stale it leaves a stale course item APPROVED and says how many", async () => {
    const stale = { ...loadedCourseItems()[3], id: "stale-course", seedKey: "course-b1-1-a-old", prompt: "Alt im Kurs" };
    fake.results = [loadedStimuli(), [bankRow("Bank eins"), bankRow("Bank zwei"), ...loadedCourseItems(), stale], []];
    const r = await topUpSeedBank("org-1", { courseForms: [form] });
    expect(updates("items")).toEqual([]);
    expect(r.course).toMatchObject({ itemsRetired: 0, staleLeft: 1 });
  });
});

describe("previewTopUp", () => {
  it("counts the course part on its own and says when the course forms are not part of the run", async () => {
    fake.results = [[], [], []];
    const p = await previewTopUp("org-1", { courseForms: [form] });
    expect(p.itemsToInsert).toBe(2);
    expect(p.course).toMatchObject({ active: true, itemsToInsert: 9, stimuliToInsert: 2, stale: 0 });

    fake.results = [[], [], []];
    const none = await previewTopUp("org-1", { courseForms: [] });
    expect(none.course.active).toBe(false);

    // No forms in the seed but course rows in the org: still part of the run (--retire-stale would retire them).
    fake.results = [loadedStimuli(), [bankRow("Bank eins"), bankRow("Bank zwei"), ...loadedCourseItems()], []];
    const rows = await previewTopUp("org-1", { courseForms: [], retireStale: true });
    expect(rows.course).toMatchObject({ active: true, itemsToInsert: 0 });
    expect(rows.course.retire).toHaveLength(9);
    expect(rows.retire).toEqual([]);
  });
});

describe("importSeedBank loads the course forms next to the bank", () => {
  it("inserts the bank's items, then the form's texts and items with their course columns", async () => {
    fake.results = [[], [{ id: "t-reading" }], [{ id: "t-listening" }], []];
    const r = await importSeedBank("org-2", { audio: false, courseForms: [form] });
    const inserts = (calls("values") as Array<[Record<string, unknown> | Array<Record<string, unknown>>]>).map(([v]) => v);
    expect(inserts).toHaveLength(4);
    expect((inserts[0] as Array<Record<string, unknown>>).map((x) => x.prompt)).toEqual(["Bank eins", "Bank zwei"]);
    expect(inserts[1]).toMatchObject({ seedKey: "course-b1-1-a-fx-r-reise", courseForm: "B1.1:A" });
    expect(inserts[2]).toMatchObject({ seedKey: "course-b1-1-a-fx-l-durchsage", courseForm: "B1.1:A" });
    const courseItems = inserts[3] as Array<Record<string, unknown>>;
    expect(courseItems.map((x) => x.courseOrder)).toEqual([0, 1, 2, 0, 1, 0, 1, 0, 0]);
    expect(courseItems[0].stimulusId).toBe("t-reading");
    expect(r).toMatchObject({ stimuli: 0, items: 2, courseStimuli: 2, courseItems: 9 });
  });
});

describe("the counts of the top-up summary", () => {
  it("count the bank without course rows and the course rows by themselves", async () => {
    const q = (n: number) => [{ n }];
    fake.results = [q(5), q(4), q(3)];
    expect(await seedCounts("org-1")).toEqual({ items: 5, approved: 4, stimuli: 3 });
    const bankWheres = (calls("where") as unknown[][]).map((a) => sqlOf(a[0]).sql);
    expect(bankWheres).toHaveLength(3);
    for (const w of bankWheres) expect(w).toContain('"course_form" is null');

    fake.calls = [];
    fake.results = [q(9), q(9), q(2)];
    expect(await courseSeedCounts("org-1")).toEqual({ items: 9, approved: 9, stimuli: 2 });
    const courseWheres = (calls("where") as unknown[][]).map((a) => sqlOf(a[0]).sql);
    expect(courseWheres).toHaveLength(3);
    for (const w of courseWheres) expect(w).toContain('"course_form" is not null');
  });
});

describe("clipsWithoutAudio (pnpm bank:tts)", () => {
  it("asks for every listening clip without audio, whatever its course form", async () => {
    const clips = [{ id: "c1", seedKey: "l-b1-x", courseForm: null }, { id: "c2", seedKey: "course-b1-1-a-fx-l-durchsage", courseForm: "B1.1:A" }];
    fake.results = [clips];
    expect(await clipsWithoutAudio()).toEqual(clips);
    const [where] = calls("where")[0] as [unknown];
    const q = sqlOf(where);
    expect(q.sql).toContain('"section" = $1');
    expect(q.sql).toContain('"audio_key" is null');
    expect(q.sql).not.toContain("course_form");
    expect(q.params).toEqual(["LISTENING"]);
  });
});
