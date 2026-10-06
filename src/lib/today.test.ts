import { describe, expect, it } from "vitest";
import type { TodayItem } from "@/solutions/types";
import { attentionRows, inviteEmphasis, pickNextTask, reviewQueue, todaySummary } from "./today";

const at = (iso: string) => new Date(iso);
const item = (over: Partial<TodayItem>): TodayItem => ({ id: Math.random().toString(36), solution: "hiring", lane: "attention", title: "t", subtitle: null, href: "/x", sortAt: null, cells: [], ...over });
const review = (id: string, iso: string | null) => item({ id, solution: "language-exam", lane: "review", sortAt: iso ? at(iso) : null });

describe("Today's review queue keeps the exam's order exactly (M2: the exam rows do not change)", () => {
  it("is the same sort the dashboard used: review lane, oldest first, undated first", () => {
    const items = [review("b", "2026-10-03T10:00:00Z"), item({ lane: "running" }), review("a", "2026-10-01T10:00:00Z"), review("c", null)];
    const old = items.filter((i) => i.lane === "review").sort((a, b) => (a.sortAt?.getTime() ?? 0) - (b.sortAt?.getTime() ?? 0));
    expect(reviewQueue(items)).toEqual(old);
    expect(reviewQueue(items).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
});

describe("the next task (K10): data rights > accommodation > decision > the oldest exam review", () => {
  // Hiring emits only accommodation tasks in plan 2b (ruling C6); the reserved ranks are pinned here for plan 3.
  it("takes a data-rights request first, then an accommodation, the oldest of a kind first", () => {
    const items = [
      review("r1", "2026-09-01T00:00:00Z"),
      item({ id: "acc-new", lane: "task", task: "ACCOMMODATION", sortAt: at("2026-10-04T00:00:00Z") }),
      item({ id: "acc-old", lane: "task", task: "ACCOMMODATION", sortAt: at("2026-10-02T00:00:00Z") }),
      item({ id: "rights", lane: "task", task: "DATA_RIGHTS", sortAt: at("2026-10-05T00:00:00Z") }),
    ];
    expect(pickNextTask(items)?.id).toBe("rights");
    expect(pickNextTask(items.filter((i) => i.id !== "rights"))?.id).toBe("acc-old");
    expect(pickNextTask([item({ id: "d", lane: "task", task: "DECISION", sortAt: at("2026-10-01T00:00:00Z") }), review("r1", "2026-09-01T00:00:00Z")])?.id).toBe("d");
  });

  it("falls back to the oldest exam review, and to nothing", () => {
    expect(pickNextTask([review("new", "2026-10-03T00:00:00Z"), review("old", "2026-10-01T00:00:00Z")])?.id).toBe("old");
    expect(pickNextTask([item({ lane: "attention" }), item({ lane: "running" })])).toBeNull();
  });
});

describe("the attention list and the summary", () => {
  it("lists the attention lane only", () => {
    const rows = [item({ id: "a1" }), item({ id: "t", lane: "task", task: "ACCOMMODATION" }), review("r", null)];
    expect(attentionRows(rows).map((r) => r.id)).toEqual(["a1"]);
  });

  it("counts what waits for a person (attention rows and reviews; a task is counted by its opening's attention row) and names the oldest", () => {
    // The requests row carries its oldest request's date, the task's included (hiringToday).
    const rows = [item({ sortAt: at("2026-09-30T00:00:00Z") }), item({ lane: "task", task: "ACCOMMODATION", sortAt: at("2026-09-30T00:00:00Z") }), review("r", "2026-10-01T00:00:00Z"), item({ lane: "running" })];
    expect(todaySummary(rows)).toEqual({ count: 2, oldest: at("2026-09-30T00:00:00Z") });
    expect(todaySummary([])).toEqual({ count: 0, oldest: null });
  });

  it("counts an accommodation request once: its task item and its opening's requests row are the same thing (Task 16 carry)", () => {
    const task = item({ id: "hiring:request:1", lane: "task", task: "ACCOMMODATION", sortAt: at("2026-10-02T00:00:00Z") });
    const requestsRow = item({ id: "hiring:requests:op1", attention: "requests", title: "1 açık talep", sortAt: at("2026-10-02T00:00:00Z") });
    expect(todaySummary([task, requestsRow])).toEqual({ count: 1, oldest: at("2026-10-02T00:00:00Z") });
    expect(todaySummary([task, requestsRow, review("r", "2026-10-03T00:00:00Z")]).count).toBe(2);
  });
});

describe("with the exam's rows only, Today reads as it did before M2 (the live exam's page)", () => {
  it("counts the review queue as the dashboard's title did, names its oldest row, and offers that row next", () => {
    const items = [review("b", "2026-10-03T10:00:00Z"), item({ id: "run", solution: "language-exam", lane: "running" }), review("a", "2026-10-01T10:00:00Z")];
    const queue = items.filter((i) => i.lane === "review").sort((a, b) => (a.sortAt?.getTime() ?? 0) - (b.sortAt?.getTime() ?? 0));
    expect(todaySummary(items)).toEqual({ count: queue.length, oldest: queue[0].sortAt });
    expect(pickNextTask(items)).toBe(queue[0]);
    expect(attentionRows(items)).toEqual([]);
  });

  it("leaves the items it is given untouched (the dashboard still reads its own lanes)", () => {
    const items = [review("b", "2026-10-03T10:00:00Z"), review("a", "2026-10-01T10:00:00Z")];
    reviewQueue(items);
    pickNextTask(items);
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("the invite button's weight on Today (4.3: one filled button)", () => {
  it("is outline when a next task holds the filled button, filled when only attention rows wait, and moves into the empty state otherwise", () => {
    expect(inviteEmphasis({ next: true, attention: 3 })).toBe("outline");
    expect(inviteEmphasis({ next: false, attention: 2 })).toBe("filled");
    expect(inviteEmphasis({ next: false, attention: 0 })).toBe("empty");
  });
});
