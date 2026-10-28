import { describe, expect, it } from "vitest";
import { courseSeed, type CourseSeedItem, type CourseSeedStimulus } from "@/db/seed-bank/course-seed";
import { fixtureCourseForm } from "@/db/seed-bank/course-fixture";
import { seedItemKey } from "@/db/seed-bank/seed-key";
import type { SeedBankPart, SeedItem } from "@/db/seed-bank/types";
import { thetaForLevel } from "@/lib/exam/cefr";
import { formatCourseRetire, formatSyncSummary, planCourseTopUp, planSyncSeed, planTopUp, type ExistingItem, type ExistingStimulus } from "./bank-topup";

const course = courseSeed([fixtureCourseForm("B1.1", "A")]);

/** A row as the database holds it after the top-up loaded the course item. */
const courseRow = (c: CourseSeedItem, over: Partial<ExistingItem> = {}): ExistingItem => ({
  id: `id-${c.seedKey}`,
  seedKey: c.seedKey,
  origin: "SEED",
  status: "APPROVED",
  section: c.item.section,
  level: c.item.level,
  type: c.item.type,
  prompt: c.item.prompt,
  content: c.item.content,
  stimulusSeedKey: c.stimulusSeedKey,
  answerKey: c.item.key,
  difficulty: thetaForLevel(c.item.level, c.item.within ?? "MID"),
  explanation: c.item.explanation ?? null,
  rubric: c.item.rubric ?? null,
  courseForm: c.courseForm,
  courseOrder: c.courseOrder,
  orderInStimulus: c.orderInStimulus,
  ...over,
});

const courseText = (s: CourseSeedStimulus, over: Partial<ExistingStimulus> = {}): ExistingStimulus => ({
  id: `id-${s.seedKey}`,
  seedKey: s.seedKey,
  origin: "SEED",
  section: s.stimulus.section,
  level: s.stimulus.level,
  title: s.stimulus.title,
  body: s.stimulus.body,
  speakers: s.stimulus.speakers ?? null,
  maxPlays: s.stimulus.maxPlays ?? null,
  courseForm: s.courseForm,
  ...over,
});

const loaded = () => ({ stimuli: course.stimuli.map((s) => courseText(s)), items: course.items.map((c) => courseRow(c)) });

const choiceItem = (prompt: string): SeedItem => ({
  section: "GRAMMAR",
  level: "B1",
  type: "SINGLE_CHOICE",
  skillTag: "grammar.x",
  prompt,
  content: { kind: "CHOICE", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }, { id: "c", text: "z" }] },
  key: { kind: "CHOICE", correct: ["a"] },
});
const bank: SeedBankPart = { stimuli: [], items: [choiceItem("Eins"), choiceItem("Zwei")] };
const bankRow = (item: SeedItem, over: Partial<ExistingItem> = {}): ExistingItem => ({
  id: `bank-${item.prompt}`,
  seedKey: seedItemKey(item),
  origin: "SEED",
  status: "APPROVED",
  section: item.section,
  level: item.level,
  type: item.type,
  prompt: item.prompt,
  content: item.content,
  stimulusSeedKey: null,
  answerKey: item.key,
  difficulty: thetaForLevel(item.level, "MID"),
  explanation: null,
  rubric: null,
  courseForm: null,
  ...over,
});

describe("planCourseTopUp", () => {
  it("adds every text and item of the forms to an empty organisation, in serving order", () => {
    const plan = planCourseTopUp(course, { stimuli: [], items: [] });
    expect(plan.stimuli.map((s) => s.seedKey)).toEqual(["course-b1-1-a-fx-r-reise", "course-b1-1-a-fx-l-durchsage"]);
    expect(plan.items).toEqual(course.items);
    expect(plan.items.every((i) => i.seedKey.startsWith("course-b1-1-a-"))).toBe(true);
    expect(plan.retire).toEqual([]);
    expect(plan.stale).toBe(0);
  });

  it("does nothing on a second run", () => {
    expect(planCourseTopUp(course, loaded(), { retireStale: true, syncSeed: true })).toEqual({
      stimuli: [],
      items: [],
      retire: [],
      keptEdited: 0,
      stale: 0,
      sync: { items: [], stimuli: [], plays: [], itemsKeptEdited: 0, stimuliKeptEdited: 0, listeningDiffs: [] },
    });
  });

  it("adds only what the organisation lacks, whatever the status of the rows it has", () => {
    const have = loaded();
    have.items = have.items.filter((_, n) => n !== 2 && n !== 5);
    have.items[0] = { ...have.items[0], status: "RETIRED" };
    have.stimuli = have.stimuli.filter((s) => s.seedKey !== "course-b1-1-a-fx-l-durchsage");
    const plan = planCourseTopUp(course, have);
    expect(plan.items.map((i) => i.item.prompt)).toEqual(["Wann fährt Anna?", "Von welchem Gleis fährt der Zug?"]);
    expect(plan.stimuli.map((s) => s.seedKey)).toEqual(["course-b1-1-a-fx-l-durchsage"]);
  });

  it("treats the same content under another form letter as new rows", () => {
    const both = courseSeed([fixtureCourseForm("B1.1", "A"), fixtureCourseForm("B1.1", "B")]);
    const plan = planCourseTopUp(both, loaded());
    expect(plan.items).toHaveLength(9);
    expect(new Set(plan.items.map((i) => i.courseForm))).toEqual(new Set(["B1.1:B"]));
    expect(plan.stimuli.map((s) => s.courseForm)).toEqual(["B1.1:B", "B1.1:B"]);
  });
});

describe("the bank and the course forms never retire or sync each other", () => {
  const retireAndSync = { retireStale: true, syncSeed: true };

  it("--retire-stale of the bank leaves course rows alone although the bank's seed lacks them", () => {
    const plan = planTopUp(bank, { stimuli: loaded().stimuli, items: [...bank.items.map((i) => bankRow(i)), ...loaded().items] }, retireAndSync);
    expect(plan.retire).toEqual([]);
    expect(plan.keptEdited).toBe(0);
    expect(plan.items).toEqual([]);
    expect(plan.stimuli).toEqual([]);
  });

  it("--retire-stale of the course forms leaves the bank's rows alone although the course seed lacks them", () => {
    const plan = planCourseTopUp(course, { stimuli: [], items: [...bank.items.map((i) => bankRow(i)), ...loaded().items] }, retireAndSync);
    expect(plan.retire).toEqual([]);
    expect(plan.stale).toBe(0);
    expect(plan.items).toEqual([]);
  });

  it("a bank with course rows in the same org still adds its own missing items", () => {
    const plan = planTopUp(bank, { stimuli: loaded().stimuli, items: [bankRow(bank.items[0]), ...loaded().items] });
    expect(plan.items.map((i) => i.item.prompt)).toEqual(["Zwei"]);
  });

  it("--sync-seed of the bank ignores a course row even when its seed key looks like a bank item's", () => {
    // A course row whose content differs from the bank item with the same key could never be written by hand;
    // the point is that the course_form column alone takes the row out of the bank's comparison.
    const impostor = bankRow(bank.items[0], { courseForm: "B1:A", explanation: "different" });
    expect(planSyncSeed(bank, { stimuli: [], items: [impostor] }).items).toEqual([]);
    expect(planTopUp(bank, { stimuli: [], items: [impostor] }, { syncSeed: true }).sync.items).toEqual([]);
  });

  it("--sync-seed of the course forms ignores bank rows", () => {
    const first = course.items[0];
    const bankLookalike = courseRow(first, { courseForm: null, explanation: "different" });
    expect(planCourseTopUp(course, { stimuli: [], items: [bankLookalike] }, { syncSeed: true }).sync.items).toEqual([]);
  });

  it("a bank text and a course text with the same author key are different rows", () => {
    const sameKey: SeedBankPart = { stimuli: [{ key: "fx-r-reise", section: "READING", level: "B1", title: "Reise", body: "x", topic: "t" }], items: [] };
    expect(planTopUp(sameKey, { stimuli: loaded().stimuli, items: [] }).stimuli.map((s) => s.key)).toEqual(["fx-r-reise"]);
    const plan = planCourseTopUp(course, { stimuli: [{ id: "b", seedKey: "fx-r-reise", courseForm: null }], items: [] });
    expect(plan.stimuli).toHaveLength(2);
  });
});

describe("planCourseTopUp with retireStale", () => {
  const stale = (name: string, over: Partial<ExistingItem> = {}): ExistingItem =>
    courseRow(course.items[3], { id: `old-${name}`, seedKey: `course-b1-1-a-old-${name}`, courseForm: "B1.1:A", ...over });

  it("retires the APPROVED starter course items whose key left the forms, and leaves the current ones", () => {
    const plan = planCourseTopUp(course, { ...loaded(), items: [...loaded().items, stale("eins"), stale("zwei", { courseForm: "B1.1:B", section: "READING" })] }, { retireStale: true });
    expect(plan.retire).toEqual([
      { id: "old-eins", section: "GRAMMAR", level: "B1", courseForm: "B1.1:A" },
      { id: "old-zwei", section: "READING", level: "B1", courseForm: "B1.1:B" },
    ]);
    expect(plan.stale).toBe(2);
    expect(formatCourseRetire(plan.retire)).toEqual(["B1.1:A 1", "B1.1:B 1"]);
  });

  it("retires every course row when the seed no longer has any form, as for the bank", () => {
    const plan = planCourseTopUp(courseSeed([]), loaded(), { retireStale: true });
    expect(plan.retire).toHaveLength(9);
  });

  it("retires nothing without the option, but counts what is left so the summary can warn", () => {
    const plan = planCourseTopUp(course, { ...loaded(), items: [...loaded().items, stale("eins")] });
    expect(plan.retire).toEqual([]);
    expect(plan.stale).toBe(1);
  });

  it("leaves rows that are not APPROVED starter rows alone", () => {
    const items = [
      ...loaded().items,
      stale("a", { status: "RETIRED" }),
      stale("b", { status: "DRAFT" }),
      stale("c", { status: "REJECTED" }),
      stale("d", { origin: "TEACHER" }),
      stale("e", { origin: "AI" }),
    ];
    const plan = planCourseTopUp(course, { stimuli: loaded().stimuli, items }, { retireStale: true });
    expect(plan.retire).toEqual([]);
    expect(plan.stale).toBe(0);
  });

  it("keeps a stale item the school edited and counts it", () => {
    const plan = planCourseTopUp(course, { ...loaded(), items: [...loaded().items, stale("edited", { edited: true }), stale("plain")] }, { retireStale: true });
    expect(plan.retire.map((r) => r.id)).toEqual(["old-plain"]);
    expect(plan.keptEdited).toBe(1);
  });

  it("retires a course row without a seed key: the loader always gives one", () => {
    const plan = planCourseTopUp(course, { ...loaded(), items: [...loaded().items, stale("none", { seedKey: null })] }, { retireStale: true });
    expect(plan.retire.map((r) => r.id)).toEqual(["old-none"]);
  });
});

describe("planCourseTopUp with syncSeed", () => {
  const sync = (existing: { stimuli: ExistingStimulus[]; items: ExistingItem[] }) => planCourseTopUp(course, existing, { syncSeed: true }).sync;
  const at = (n: number) => course.items[n];

  it("does nothing unless asked", () => {
    const existing = { stimuli: loaded().stimuli, items: [courseRow(at(0), { explanation: "alt" })] };
    expect(planCourseTopUp(course, existing).sync.items).toEqual([]);
  });

  it("updates key, difficulty, explanation and rubric that differ, like the bank", () => {
    const items = [
      courseRow(at(0), { answerKey: { kind: "TFNG", answers: { s1: "F", s2: "F" } } }),
      courseRow(at(3), { difficulty: 9, explanation: "alt" }),
      courseRow(at(7), { rubric: { contentPoints: ["alt"] } }),
    ];
    const plan = sync({ stimuli: [], items });
    expect(plan.items.map((i) => [i.id, i.fields])).toEqual([
      [`id-${at(0).seedKey}`, ["key"]],
      [`id-${at(3).seedKey}`, ["difficulty", "explanation"]],
      [`id-${at(7).seedKey}`, ["rubric"]],
    ]);
    expect(plan.items[0].set).toEqual({ answerKey: at(0).item.key });
    expect(plan.items[1].set).toEqual({ difficulty: thetaForLevel("B1", "EASY"), explanation: null });
  });

  it("moves an item whose position in the form changed: course_order and order_in_stimulus", () => {
    const plan = sync({ stimuli: [], items: [courseRow(at(2), { courseOrder: 0, orderInStimulus: 1 }), courseRow(at(1), { courseOrder: 4 })] });
    expect(plan.items.map((i) => [i.id, i.fields, i.set])).toEqual([
      [`id-${at(2).seedKey}`, ["order"], { courseOrder: 2, orderInStimulus: 2 }],
      [`id-${at(1).seedKey}`, ["order"], { courseOrder: 1 }],
    ]);
    expect(formatSyncSummary(plan)[0]).toBe("sync items READING: B1 2");
    expect(formatSyncSummary(plan).some((l) => l.includes("[order]"))).toBe(true);
  });

  it("fills a missing position (null course_order), and leaves a position it has not loaded alone", () => {
    expect(sync({ stimuli: [], items: [courseRow(at(1), { courseOrder: null })] }).items[0].set).toEqual({ courseOrder: 1 });
    expect(sync({ stimuli: [], items: [courseRow(at(1), { courseOrder: undefined, orderInStimulus: undefined })] }).items).toEqual([]);
  });

  it("applies a reading text change unless an item that reads it was edited", () => {
    const changed = loaded().stimuli.map((s) => (s.seedKey?.endsWith("fx-r-reise") ? { ...s, body: "Alter Text" } : s));
    const plan = sync({ stimuli: changed, items: [] });
    expect(plan.stimuli).toEqual([
      { id: "id-course-b1-1-a-fx-r-reise", key: "course-b1-1-a-fx-r-reise", section: "READING", level: "B1", title: "Reise", body: "Anna fährt am Freitag nach Berlin." },
    ]);
    const kept = sync({ stimuli: changed.map((s) => ({ ...s, itemEdited: true })), items: [] });
    expect(kept.stimuli).toEqual([]);
    expect(kept.stimuliKeptEdited).toBe(1);
  });

  it("reports a changed listening script under its database key and never rewrites it", () => {
    const changed = loaded().stimuli.map((s) => (s.seedKey?.endsWith("fx-l-durchsage") ? { ...s, body: "A: Alt" } : s));
    const plan = sync({ stimuli: changed, items: [] });
    expect(plan.stimuli).toEqual([]);
    expect(plan.listeningDiffs).toEqual([{ id: "id-course-b1-1-a-fx-l-durchsage", key: "course-b1-1-a-fx-l-durchsage", level: "B1" }]);
  });

  it("syncs the play limit of a course clip", () => {
    const changed = loaded().stimuli.map((s) => (s.seedKey?.endsWith("fx-l-durchsage") ? { ...s, maxPlays: null } : s));
    expect(sync({ stimuli: changed, items: [] }).plays).toEqual([{ id: "id-course-b1-1-a-fx-l-durchsage", key: "course-b1-1-a-fx-l-durchsage", level: "B1", maxPlays: 2 }]);
  });

  it("never touches a row of another origin, and ignores course rows the forms no longer have", () => {
    const items = [courseRow(at(3), { origin: "TEACHER", explanation: "alt" }), courseRow(at(4), { seedKey: "course-b1-1-a-gone", explanation: "alt" })];
    expect(sync({ stimuli: [], items }).items).toEqual([]);
  });

  it("is idempotent: applying the plan leaves nothing for a second run", () => {
    const old = [courseRow(at(1), { courseOrder: 7 }), courseRow(at(3), { explanation: "alt" }), courseRow(at(5), { difficulty: 3 })];
    const first = sync({ stimuli: [], items: old });
    expect(first.items).toHaveLength(3);
    const applied = old.map((o) => ({ ...o, ...(first.items.find((c) => c.id === o.id)?.set ?? {}) }));
    expect(sync({ stimuli: [], items: applied }).items).toEqual([]);
  });
});
