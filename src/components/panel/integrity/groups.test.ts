import { describe, expect, it } from "vitest";
import { groupMarkers } from "./markers";
import { integrityVerificationCode, summarizeFlags, warningCountOf, type FlagEvent } from "./groups";

let n = 0;
const ev = (type: FlagEvent["type"], severity: FlagEvent["severity"], at: number, extra: Partial<FlagEvent> = {}): FlagEvent => ({
  id: `e${++n}`,
  type,
  severity,
  startedAt: at,
  durationMs: null,
  teacherStatus: "OPEN",
  ...extra,
});

describe("summarizeFlags", () => {
  const events = [
    ev("TAB_HIDDEN", "HIGH", 1000),
    ev("TAB_HIDDEN", "HIGH", 5000, { durationMs: 4000 }),
    ev("PHONE_DETECTED", "HIGH", 3000, { review: { status: "DONE", verdict: "CONFIRMED" } }),
    ev("VOICE_DETECTED", "MEDIUM", 2000),
    ev("FOCUS_LOST", "LOW", 2500),
    ev("FOCUS_LOST", "MEDIUM", 2600),
    ev("HEARTBEAT_GAP", "MEDIUM", 100),
    ev("HEARTBEAT_GAP", "MEDIUM", 200),
    ev("RESUMED", "INFO", 50),
  ];
  const s = summarizeFlags(events);

  it("counts one flag per type by its highest severity", () => {
    expect(s.serious).toBe(2);
    expect(s.medium).toBe(2); // VOICE_DETECTED and FOCUS_LOST (lifted by its MEDIUM event)
    expect(s.low).toBe(0);
  });

  it("keeps connection noise out of the flags and counts it apart", () => {
    expect(s.flags.map((g) => g.type)).not.toContain("HEARTBEAT_GAP");
    expect(s.technical.map((g) => g.type).sort()).toEqual(["HEARTBEAT_GAP", "RESUMED"]);
    expect(s.technicalEvents).toBe(3);
  });

  it("orders by severity, then count, and carries count, first, last and duration", () => {
    expect(s.flags.map((g) => g.type)).toEqual(["TAB_HIDDEN", "PHONE_DETECTED", "FOCUS_LOST", "VOICE_DETECTED"]);
    const tab = s.flags[0];
    expect([tab.count, tab.first, tab.last, tab.totalMs]).toEqual([2, 1000, 5000, 4000]);
  });

  it("tallies AI verdicts", () => {
    const phone = s.flags.find((g) => g.type === "PHONE_DETECTED")!;
    expect(phone.ai).toEqual({ CONFIRMED: 1, NOT_CONFIRMED: 0, UNCLEAR: 0, pending: 0 });
  });

  it("stops counting a group once every event is dismissed, and lists it last", () => {
    const dismissed = events.map((e) => (e.type === "TAB_HIDDEN" ? { ...e, teacherStatus: "DISMISSED" as const } : e));
    const d = summarizeFlags(dismissed);
    expect(d.serious).toBe(1);
    expect(d.settled).toBe(1);
    expect(d.flags[d.flags.length - 1].type).toBe("TAB_HIDDEN");
  });

  it("a dismissed high event no longer lifts its group", () => {
    const d = summarizeFlags([ev("NO_FACE", "HIGH", 1, { teacherStatus: "DISMISSED" }), ev("NO_FACE", "MEDIUM", 2)]);
    expect([d.serious, d.medium]).toEqual([0, 1]);
  });

  it("reads warningCount only when present", () => {
    expect(summarizeFlags([ev("FOCUS_LOST", "LOW", 1)]).flags[0].maxWarning).toBeNull();
    expect(summarizeFlags([ev("FOCUS_LOST", "LOW", 1, { warningCount: 1 }), ev("FOCUS_LOST", "LOW", 2, { warningCount: 3 })]).flags[0].maxWarning).toBe(3);
    expect(warningCountOf({ warningCount: 2 })).toBe(2);
    expect(warningCountOf({ warningCount: "x" })).toBeNull();
    expect(warningCountOf(null)).toBeNull();
  });
});

describe("groupMarkers", () => {
  const m = (id: string, type: string, at: number, severity: "HIGH" | "MEDIUM" | "LOW") => ({ id, type, at, severity });
  it("merges the same type within 30 s into one marker with a count", () => {
    const out = groupMarkers([m("a", "VOICE_DETECTED", 0, "MEDIUM"), m("b", "VOICE_DETECTED", 20_000, "MEDIUM"), m("c", "VOICE_DETECTED", 45_000, "MEDIUM")]);
    expect(out).toHaveLength(1); // chained: each is within 30 s of the previous one
    expect(out[0]).toMatchObject({ id: "a", at: 0, count: 3 });
  });
  it("starts a new marker after a gap longer than 30 s", () => {
    const out = groupMarkers([m("a", "TAB_HIDDEN", 0, "HIGH"), m("b", "TAB_HIDDEN", 31_000, "HIGH")]);
    expect(out.map((x) => x.count)).toEqual([1, 1]);
  });
  it("keeps different types apart and takes the highest severity", () => {
    const out = groupMarkers([m("a", "FOCUS_LOST", 0, "LOW"), m("b", "FOCUS_LOST", 1000, "MEDIUM"), m("c", "NO_FACE", 500, "HIGH")]);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.type === "FOCUS_LOST")).toMatchObject({ count: 2, severity: "MEDIUM" });
  });
  it("sorts its input", () => {
    expect(groupMarkers([m("b", "NO_FACE", 5000, "HIGH"), m("a", "NO_FACE", 1000, "HIGH")])[0].id).toBe("a");
  });
});

describe("integrityVerificationCode", () => {
  it("is stable, 8 uppercase hex, and differs from another attempt", () => {
    const a = integrityVerificationCode("att-1", "s");
    expect(a).toMatch(/^[0-9A-F]{8}$/);
    expect(integrityVerificationCode("att-1", "s")).toBe(a);
    expect(integrityVerificationCode("att-2", "s")).not.toBe(a);
  });
});
