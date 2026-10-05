import { describe, expect, it } from "vitest";
import { recordedFooterState, refocusAfterTimeUp } from "./recorded-footer";

const REASON = "Süre doldu; yeni kayıt başlatılamaz.";
const base = { timeUpReason: REASON };

describe("recordedFooterState (C4)", () => {
  it("is free when nothing holds the screen", () => {
    expect(recordedFooterState({ ...base, timeUp: false, disabled: false })).toEqual({ waitReason: null, busy: false });
  });

  it("is busy while the runner works (a save, a close), with no reason", () => {
    expect(recordedFooterState({ ...base, timeUp: false, disabled: true })).toEqual({ waitReason: null, busy: true });
  });

  it("when time is up the button waits with its reason and never shows a spinner for work that is not happening", () => {
    expect(recordedFooterState({ ...base, timeUp: true, disabled: true })).toEqual({ waitReason: REASON, busy: false });
    expect(recordedFooterState({ ...base, timeUp: true, disabled: false })).toEqual({ waitReason: REASON, busy: false });
  });

  it("during the 8 second send strip the runner's own reason is the reason, not a spinner", () => {
    expect(recordedFooterState({ ...base, timeUp: false, disabled: true, holdReason: "Gönderiliyor." })).toEqual({ waitReason: "Gönderiliyor.", busy: false });
  });

  it("time up wins over the strip's reason", () => {
    expect(recordedFooterState({ ...base, timeUp: true, disabled: true, holdReason: "Gönderiliyor." })).toEqual({ waitReason: REASON, busy: false });
  });

  it("an empty strip reason is no reason", () => {
    expect(recordedFooterState({ ...base, timeUp: false, disabled: true, holdReason: null })).toEqual({ waitReason: null, busy: true });
  });
});

describe("refocusAfterTimeUp (Task 4 carry 6)", () => {
  it("moves focus to the heading when time up left it on a disabled button or on nothing", () => {
    expect(refocusAfterTimeUp({ timeUp: true, wasTimeUp: false, active: "disabled-control" })).toBe(true);
    expect(refocusAfterTimeUp({ timeUp: true, wasTimeUp: false, active: "body" })).toBe(true);
  });

  it("leaves focus alone elsewhere: a working button, a field, or when time was already up", () => {
    expect(refocusAfterTimeUp({ timeUp: true, wasTimeUp: false, active: "other" })).toBe(false);
    expect(refocusAfterTimeUp({ timeUp: true, wasTimeUp: true, active: "body" })).toBe(false);
    expect(refocusAfterTimeUp({ timeUp: false, wasTimeUp: false, active: "body" })).toBe(false);
  });
});
