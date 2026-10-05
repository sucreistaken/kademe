import { describe, expect, it } from "vitest";
import { choiceLetter, choiceShortcut, isTypingTarget, keyIndex, nextChoiceIndex, shortcutChoice } from "./choice-keys";
import { footerButtonState, footerSpace } from "./footer-action";
import { journeyPosition, journeySteps } from "./journey";
import { lastSeconds, ringGeometry, ringMilestone } from "./ring";

describe("the journey (G3): Hazırlık · Cihaz · Isınma · Sorular", () => {
  it("drops the device and warm-up parts the assessment does not have", () => {
    expect(journeySteps({ device: true, warmup: true })).toEqual(["prep", "device", "warmup", "questions"]);
    expect(journeySteps({ device: true, warmup: false })).toEqual(["prep", "device", "questions"]);
    expect(journeySteps({ device: false, warmup: false })).toEqual(["prep", "questions"]);
  });

  it("numbers the part a screen belongs to, 1-based", () => {
    const steps = journeySteps({ device: true, warmup: true });
    expect(journeyPosition(steps, "prep")).toEqual({ current: 1, total: 4 });
    expect(journeyPosition(steps, "questions")).toEqual({ current: 4, total: 4 });
    expect(journeyPosition(journeySteps({ device: false, warmup: false }), "questions")).toEqual({ current: 2, total: 2 });
  });

  it("refuses a part the journey does not have (a screen that should not exist)", () => {
    expect(() => journeyPosition(["prep", "questions"], "device")).toThrow(/device/);
  });
});

describe("the ring timer (K4)", () => {
  it("shortens a step every second, never in between, and never turns past empty or full", () => {
    const full = ringGeometry({ remainingMs: 30_000, totalMs: 30_000, size: 128 });
    expect(full.ratio).toBe(1);
    expect(full.offset).toBe(0);
    expect(full.seconds).toBe(30);
    // 29.4 s left reads as 30 (the clock shows whole seconds, the ring agrees with it).
    expect(ringGeometry({ remainingMs: 29_400, totalMs: 30_000, size: 128 }).seconds).toBe(30);
    const half = ringGeometry({ remainingMs: 15_000, totalMs: 30_000, size: 128 });
    expect(half.ratio).toBe(0.5);
    expect(half.offset).toBeCloseTo(half.circumference / 2, 6);
    expect(ringGeometry({ remainingMs: -5, totalMs: 30_000, size: 96 })).toMatchObject({ ratio: 0, seconds: 0 });
    expect(ringGeometry({ remainingMs: 99_000, totalMs: 30_000, size: 96 }).ratio).toBe(1);
    expect(ringGeometry({ remainingMs: 1000, totalMs: 0, size: 96 }).ratio).toBe(0);
  });

  it("fits the stroke inside the box", () => {
    expect(ringGeometry({ remainingMs: 1, totalMs: 1, size: 128 }).radius).toBe(58);
    expect(ringGeometry({ remainingMs: 1, totalMs: 1, size: 96 }).radius).toBe(42);
  });

  it("names the last ten seconds only by its words (3.8: no red, no blink)", () => {
    expect(lastSeconds(10_000)).toBe(true);
    expect(lastSeconds(10_001)).toBe(false);
    expect(lastSeconds(0)).toBe(false);
  });

  it("speaks only at milestones: each whole minute left, 30 s and 10 s, never at the start, never every second (HIRING-UX 8.7)", () => {
    const spoken = (totalMs: number) =>
      Array.from({ length: totalMs / 1000 + 1 }, (_, i) => totalMs - i * 1000).filter((remainingMs) => ringMilestone({ remainingMs, totalMs }));
    expect(spoken(30_000)).toEqual([10_000]);
    expect(spoken(45_000)).toEqual([30_000, 10_000]);
    expect(spoken(180_000)).toEqual([120_000, 60_000, 30_000, 10_000]);
    // Between two ticks the same whole second stays a milestone (the clock reads 0:10 until 9 s are left).
    expect(ringMilestone({ remainingMs: 9_400, totalMs: 30_000 })).toBe(true);
    expect(ringMilestone({ remainingMs: 9_000, totalMs: 30_000 })).toBe(false);
    expect(ringMilestone({ remainingMs: 0, totalMs: 30_000 })).toBe(false);
  });
});

describe("the footer's filled button (G2, G9, plan decision 4)", () => {
  const base = { kind: "button" as const, id: "next", label: "Sonraki soru", onClick: () => undefined };

  it("is ready with nothing to wait for", () => {
    expect(footerButtonState(base)).toEqual({ mode: "ready", label: "Sonraki soru", reason: null, describedBy: undefined });
  });

  it("never waits without saying why, next to it, linked by id + -why", () => {
    expect(footerButtonState({ ...base, waitReason: "Bir seçenek seç." })).toEqual({ mode: "waiting", label: "Sonraki soru", reason: "Bir seçenek seç.", describedBy: "next-why" });
  });

  it("while it works keeps its filled look and says so on itself (never pale for a second without a word)", () => {
    expect(footerButtonState({ ...base, busy: true, busyLabel: "Kaydediliyor", waitReason: "x" })).toEqual({ mode: "busy", label: "Kaydediliyor", reason: null, describedBy: undefined });
    expect(footerButtonState({ ...base, busy: true }).label).toBe("Sonraki soru");
  });

  it("keeps the content clear of the bar: the bar's measured height plus a 24px gap, 112px before it is measured", () => {
    expect(footerSpace(88)).toBe("112px");
    expect(footerSpace(140.2)).toBe("165px");
    for (const unmeasured of [null, undefined, 0, -4, Number.NaN, Number.POSITIVE_INFINITY]) expect(footerSpace(unmeasured)).toBe("112px");
  });
});

describe("choice cards (G6, 3.7)", () => {
  it("marks choices with letters and offers keys 1-9 only", () => {
    expect([0, 1, 2, 25].map(choiceLetter)).toEqual(["A", "B", "C", "Z"]);
    expect(choiceLetter(26)).toBe("27");
    expect(choiceShortcut(0)).toBe("1");
    expect(choiceShortcut(8)).toBe("9");
    expect(choiceShortcut(9)).toBeNull();
  });

  it("moves between checkbox cards with the arrow keys, Home and End, wrapping and skipping disabled ones", () => {
    const enabled = [true, false, true, true];
    expect(nextChoiceIndex({ key: "ArrowDown", from: 0, enabled })).toBe(2);
    expect(nextChoiceIndex({ key: "ArrowRight", from: 3, enabled })).toBe(0);
    expect(nextChoiceIndex({ key: "ArrowUp", from: 2, enabled })).toBe(0);
    expect(nextChoiceIndex({ key: "ArrowLeft", from: 0, enabled })).toBe(3);
    expect(nextChoiceIndex({ key: "Home", from: 3, enabled })).toBe(0);
    expect(nextChoiceIndex({ key: "End", from: 0, enabled })).toBe(3);
  });

  it("leaves every other key alone (letters, digits, Space, Tab) and does nothing when no card can take focus", () => {
    const enabled = [true, true];
    for (const key of ["a", "1", " ", "Tab", "Enter"]) expect(nextChoiceIndex({ key, from: 0, enabled })).toBeNull();
    expect(nextChoiceIndex({ key: "ArrowDown", from: 0, enabled: [false, false] })).toBeNull();
  });
});

describe("the choice shortcuts (Task 4 carry 7: one shared hook, keys 1-9 as in plan 2)", () => {
  const press = (key: string, over: Partial<Parameters<typeof shortcutChoice>[0]> = {}) => shortcutChoice({ key, target: { tagName: "BODY" }, ...over }, 3);

  it("picks the choice in the place of the digit, and nothing past the last choice", () => {
    expect(press("1")).toBe(0);
    expect(press("3")).toBe(2);
    expect(press("4")).toBeNull();
    expect(press("0")).toBeNull();
    expect(press("a")).toBeNull();
  });

  it("works on the cards themselves (native radios and checkboxes) and on a page with nothing focused", () => {
    expect(press("2", { target: { tagName: "INPUT", type: "radio" } })).toBe(1);
    expect(press("2", { target: { tagName: "INPUT", type: "checkbox" } })).toBe(1);
    expect(press("2", { target: null })).toBe(1);
  });

  it("never takes a digit typed into a field, a key with a modifier, or one already handled", () => {
    expect(press("1", { target: { tagName: "TEXTAREA" } })).toBeNull();
    expect(press("1", { target: { tagName: "INPUT", type: "text" } })).toBeNull();
    expect(press("1", { target: { tagName: "DIV", isContentEditable: true } })).toBeNull();
    expect(press("1", { ctrlKey: true })).toBeNull();
    expect(press("1", { metaKey: true })).toBeNull();
    expect(press("1", { altKey: true })).toBeNull();
    expect(press("1", { defaultPrevented: true })).toBeNull();
  });

  it("keeps the plan 2 helpers (the runner re-exports them)", () => {
    expect(keyIndex("1", 4)).toBe(0);
    expect(keyIndex("5", 4)).toBeNull();
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
  });
});
