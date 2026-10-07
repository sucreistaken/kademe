import { describe, expect, it, vi } from "vitest";
import { stepFocusController } from "@/hooks/use-step-focus";
import { exitKey, flowFocusKey, flowHashFix, flowJourney, flowStepOf, isDirty, saveWait, sameValue, stepOfProblem, summaryRows } from "./flow-model";

const steps = ["members", "decider", "min", "review"] as const;

describe("the step in the address (W3)", () => {
  it("opens the step the hash names, and the first step for no hash or an unknown one", () => {
    expect(flowStepOf("#decider", { steps, firstInvalid: null })).toBe("decider");
    expect(flowStepOf("", { steps, firstInvalid: null })).toBe("members");
    expect(flowStepOf("#nothing", { steps, firstInvalid: null })).toBe("members");
  });

  it("never skips a decision: a step past the first one not ready opens that one", () => {
    expect(flowStepOf("#review", { steps, firstInvalid: "decider" })).toBe("decider");
    expect(flowStepOf("#min", { steps, firstInvalid: "decider" })).toBe("decider");
    // A step before the gap, or the gap itself, opens as asked.
    expect(flowStepOf("#members", { steps, firstInvalid: "decider" })).toBe("members");
    expect(flowStepOf("#decider", { steps, firstInvalid: "decider" })).toBe("decider");
  });
});

describe("the journey and the exit (W2, W7)", () => {
  it("counts the main path, and a step outside it keeps the place of the step it came from", () => {
    expect(flowJourney(["person", "summary"], "person")).toEqual({ steps: 2, current: 1 });
    expect(flowJourney(["opening", "person", "summary"], "summary")).toEqual({ steps: 3, current: 3 });
    expect(flowJourney<string>(["person", "summary"], "language", "summary")).toEqual({ steps: 2, current: 2 });
  });

  it("says 'Kaydetmeden çık' only while something typed would be lost", () => {
    expect(exitKey(false)).toBe("exit");
    expect(exitKey(true)).toBe("exitUnsaved");
  });
});

describe("the summary (W5, P8)", () => {
  const saved = { memberIds: ["a", "b"], decisionMakerId: "d", feedbackDays: 7, deadline: null as string | null };

  it("marks only the rows whose value changed; the same people in another order is no change", () => {
    const now = { ...saved, memberIds: ["b", "a"], feedbackDays: 14 };
    expect(summaryRows(saved, now, ["memberIds", "decisionMakerId", "feedbackDays"])).toEqual([
      { field: "memberIds", changed: false },
      { field: "decisionMakerId", changed: false },
      { field: "feedbackDays", changed: true },
    ]);
    expect(isDirty(saved, now, ["memberIds"])).toBe(false);
    expect(isDirty(saved, now, ["memberIds", "feedbackDays"])).toBe(true);
  });

  it("compares lists as sets and everything else strictly", () => {
    expect(sameValue(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameValue(["a"], ["a", "b"])).toBe(false);
    expect(sameValue(null, "")).toBe(false);
    expect(sameValue(Number.NaN, Number.NaN)).toBe(true);
  });

  it("waits with 'Değişiklik yok.' while nothing changed", () => {
    expect(saveWait(false)).toBe("noChanges");
    expect(saveWait(true)).toBeNull();
  });
});

describe("a refusal opens its step (W8)", () => {
  it("maps a problem to its step, and leaves an unmapped one on the summary", () => {
    const map = { NAME: "person", DEADLINE_PAST: "deadline" } as const;
    expect(stepOfProblem<"NAME" | "DEADLINE_PAST" | "CLOSED", string>(map, "NAME")).toBe("person");
    expect(stepOfProblem<"NAME" | "DEADLINE_PAST" | "CLOSED", string>(map, "CLOSED")).toBeNull();
  });
});

describe("the heading takes the focus only on an in-page step change (W10, 2.3)", () => {
  it("is 'load' until the first move, then the step id", () => {
    expect(flowFocusKey(false, "review")).toBe("load");
    expect(flowFocusKey(true, "review")).toBe("review");
  });

  it("a page opened on a later step's hash takes no focus while it hydrates; the first move does", () => {
    const c = stepFocusController();
    const h = { focus: vi.fn() };
    // Server snapshot (no hash) opens the first step, then the real hash re-renders on #min.
    const at = (moved: boolean, hash: string) => flowFocusKey(moved, flowStepOf(hash, { steps, firstInvalid: null }));
    c.onStep(at(false, ""), h);
    c.onStep(at(false, "#min"), h);
    expect(h.focus).not.toHaveBeenCalled();
    c.onStep(at(true, "#review"), h);
    expect(h.focus).toHaveBeenCalledTimes(1);
  });

  it("without the key, the hydration re-render would steal the focus (positive control)", () => {
    const c = stepFocusController();
    const h = { focus: vi.fn() };
    c.onStep(flowStepOf("", { steps, firstInvalid: null }), h);
    c.onStep(flowStepOf("#min", { steps, firstInvalid: null }), h);
    expect(h.focus).toHaveBeenCalledTimes(1);
  });
});

describe("the address never runs ahead of the step shown (W3)", () => {
  it("leaves an address that already names the shown step, or no hash on the first step", () => {
    expect(flowHashFix("#min", "min", "members")).toBeNull();
    expect(flowHashFix("", "members", "members")).toBeNull();
    expect(flowHashFix("#members", "members", "members")).toBeNull();
  });

  it("a later step's hash over a step that is not ready yet (a reload, a copied link) is taken back to the step shown", () => {
    // Shown "members" while the hash asks "#review": the address loses the hash, so a ready step later shows the first step, not a jump.
    expect(flowHashFix("#review", flowStepOf("#review", { steps, firstInvalid: "members" }), "members")).toBe("");
    expect(flowHashFix("#review", flowStepOf("#review", { steps, firstInvalid: "decider" }), "members")).toBe("#decider");
  });

  it("an unknown hash on the first step is cleared", () => {
    expect(flowHashFix("#nothing", flowStepOf("#nothing", { steps, firstInvalid: null }), "members")).toBe("");
  });
});
