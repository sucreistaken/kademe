import { describe, expect, it } from "vitest";
import {
  GAZE_WARNING_AFTER_MS,
  INITIAL_WARNING_STATE,
  NO_FACE_WARNING_AFTER_MS,
  WARNING_RATE_LIMIT_MS,
  delayUntilLasted,
  dismissWarning,
  extendedDecision,
  parseWarnings,
  raiseWarning,
  resolveWarning,
  secondScreenPresent,
  serializeWarnings,
  warningKindFor,
} from "./cheat-warning";

describe("warningKindFor", () => {
  it("maps the serious events and groups the ones that are one act", () => {
    expect(warningKindFor("PHONE_DETECTED")).toBe("PHONE");
    expect(warningKindFor("MULTIPLE_FACES")).toBe("MULTIPLE_FACES");
    expect(warningKindFor("TAB_HIDDEN")).toBe("LEFT_EXAM");
    expect(warningKindFor("FOCUS_LOST")).toBe("LEFT_EXAM");
    expect(warningKindFor("SECOND_SCREEN_DETECTED")).toBe("SECOND_SCREEN");
    expect(warningKindFor("PASTE_ATTEMPT")).toBe("CLIPBOARD");
    expect(warningKindFor("COPY_ATTEMPT")).toBe("CLIPBOARD");
    expect(warningKindFor("DUPLICATE_SESSION")).toBe("DUPLICATE_TAB");
    expect(warningKindFor("SCREEN_SHARE_WRONG_SURFACE")).toBe("WRONG_SURFACE");
  });

  it("keeps minor events silent", () => {
    expect(warningKindFor("CONTEXT_MENU")).toBeNull();
    expect(warningKindFor("RESUMED")).toBeNull();
    expect(warningKindFor("WINDOW_RESIZED")).toBeNull();
    expect(warningKindFor("BLOCKED_SHORTCUT", { shortcutKey: "f12" })).toBeNull();
    expect(warningKindFor("BLOCKED_SHORTCUT", { shortcutKey: "p" })).toBeNull();
    expect(warningKindFor("BLOCKED_SHORTCUT")).toBeNull();
  });

  it("treats the clipboard shortcuts as a clipboard warning", () => {
    for (const key of ["c", "v", "x"]) expect(warningKindFor("BLOCKED_SHORTCUT", { shortcutKey: key })).toBe("CLIPBOARD");
  });
});

describe("raiseWarning", () => {
  it("opens the first warning as number 1", () => {
    const r = raiseWarning(INITIAL_WARNING_STATE, "PHONE", 1_000);
    expect(r.accepted).toBe(true);
    expect(r.count).toBe(1);
    expect(r.state.open).toMatchObject({ kind: "PHONE", count: 1, persistent: false, resolved: true });
  });

  it("holds back the same kind inside 20 seconds and does not count it", () => {
    const first = raiseWarning(INITIAL_WARNING_STATE, "PHONE", 0);
    const closed = dismissWarning(first.state);
    const again = raiseWarning(closed, "PHONE", WARNING_RATE_LIMIT_MS - 1);
    expect(again.accepted).toBe(false);
    expect(again.count).toBe(1);
    expect(again.state.open).toBeNull();
  });

  it("shows the same kind again after 20 seconds, as number 2", () => {
    const first = raiseWarning(INITIAL_WARNING_STATE, "PHONE", 0);
    const closed = dismissWarning(first.state);
    const again = raiseWarning(closed, "PHONE", WARNING_RATE_LIMIT_MS);
    expect(again.accepted).toBe(true);
    expect(again.count).toBe(2);
  });

  it("limits each kind on its own", () => {
    const a = raiseWarning(INITIAL_WARNING_STATE, "PHONE", 0);
    const b = raiseWarning(a.state, "LEFT_EXAM", 100);
    expect(b.accepted).toBe(true);
    expect(b.count).toBe(2);
  });

  it("queues a warning that arrives while one is open, numbered in order", () => {
    const a = raiseWarning(INITIAL_WARNING_STATE, "PHONE", 0);
    const b = raiseWarning(a.state, "MULTIPLE_FACES", 10);
    expect(b.state.open?.kind).toBe("PHONE");
    expect(b.state.queue.map((w) => [w.kind, w.count])).toEqual([["MULTIPLE_FACES", 2]]);
    const next = dismissWarning(b.state);
    expect(next.open).toMatchObject({ kind: "MULTIPLE_FACES", count: 2 });
    expect(next.queue).toEqual([]);
    expect(dismissWarning(next).open).toBeNull();
  });

  it("does not stack a kind that is already open", () => {
    const a = raiseWarning(INITIAL_WARNING_STATE, "LEFT_EXAM", 0);
    const b = raiseWarning(a.state, "LEFT_EXAM", WARNING_RATE_LIMIT_MS + 5);
    expect(b.accepted).toBe(false);
    expect(b.state.queue).toEqual([]);
  });
});

describe("persistent second screen warning", () => {
  it("cannot be dismissed until the screen is gone, then closes", () => {
    const r = raiseWarning(INITIAL_WARNING_STATE, "SECOND_SCREEN", 0);
    expect(r.state.open).toMatchObject({ persistent: true, resolved: false });
    expect(dismissWarning(r.state).open).not.toBeNull();
    const resolved = resolveWarning(r.state, "SECOND_SCREEN");
    expect(resolved.open?.resolved).toBe(true);
    expect(dismissWarning(resolved).open).toBeNull();
  });

  it("shows again while the screen is still there, without a second count", () => {
    const r = raiseWarning(INITIAL_WARNING_STATE, "SECOND_SCREEN", 0);
    const closed = dismissWarning(resolveWarning(r.state, "SECOND_SCREEN"));
    const back = raiseWarning(closed, "SECOND_SCREEN", 5_000);
    expect(back.accepted).toBe(true);
    expect(back.count).toBe(1);
    expect(back.state.open).toMatchObject({ count: 1, resolved: false });
  });

  it("counts a new appearance after the window as another warning", () => {
    const r = raiseWarning(INITIAL_WARNING_STATE, "SECOND_SCREEN", 0);
    const closed = dismissWarning(resolveWarning(r.state, "SECOND_SCREEN"));
    expect(raiseWarning(closed, "SECOND_SCREEN", WARNING_RATE_LIMIT_MS).count).toBe(2);
  });

  it("resolving a kind that is not open changes nothing", () => {
    expect(resolveWarning(INITIAL_WARNING_STATE, "SECOND_SCREEN")).toBe(INITIAL_WARNING_STATE);
  });
});

describe("persistence", () => {
  it("keeps the count and the rate limit across a reload, never an open overlay", () => {
    const a = raiseWarning(INITIAL_WARNING_STATE, "PHONE", 5_000);
    const restored = parseWarnings(serializeWarnings(a.state));
    expect(restored.count).toBe(1);
    expect(restored.open).toBeNull();
    expect(raiseWarning(restored, "PHONE", 6_000).accepted).toBe(false);
    expect(raiseWarning(restored, "LEFT_EXAM", 6_000).count).toBe(2);
  });

  it("starts from zero on missing or damaged data", () => {
    expect(parseWarnings(null)).toEqual(INITIAL_WARNING_STATE);
    expect(parseWarnings("not json")).toEqual(INITIAL_WARNING_STATE);
    expect(parseWarnings(JSON.stringify({ count: -3, lastShown: { PHONE: "x", NOPE: 1 } }))).toEqual({ count: 0, lastShown: {}, open: null, queue: [] });
  });
});

describe("long signals (gaze and missing face)", () => {
  it("waits out the rest of the threshold, measured from the onset", () => {
    expect(delayUntilLasted(0, 0, GAZE_WARNING_AFTER_MS)).toBe(6_000);
    expect(delayUntilLasted(0, 5_000, GAZE_WARNING_AFTER_MS)).toBe(1_000);
    expect(delayUntilLasted(0, 6_000, GAZE_WARNING_AFTER_MS)).toBe(0);
    expect(delayUntilLasted(0, 9_000, GAZE_WARNING_AFTER_MS)).toBe(0);
  });

  it("uses six seconds for gaze and ten for a missing face", () => {
    expect(GAZE_WARNING_AFTER_MS).toBe(6_000);
    expect(NO_FACE_WARNING_AFTER_MS).toBe(10_000);
    // The tracker reports the start after 5 s of gaze: one more second to the warning.
    expect(delayUntilLasted(1_000, 6_000, GAZE_WARNING_AFTER_MS)).toBe(1_000);
  });
});

describe("second screen reading", () => {
  it("is present when either source says so", () => {
    expect(secondScreenPresent(true, null)).toBe(true);
    expect(secondScreenPresent(false, 2)).toBe(true);
    expect(secondScreenPresent(null, 3)).toBe(true);
  });

  it("is absent only when something could say and nothing did", () => {
    expect(secondScreenPresent(false, null)).toBe(false);
    expect(secondScreenPresent(false, 1)).toBe(false);
    expect(secondScreenPresent(null, 1)).toBe(false);
  });

  it("is unknown when nothing can be read", () => {
    expect(secondScreenPresent(null, null)).toBeNull();
  });

  it("raises once on the first reading, then clears when it is gone (poll or event alike)", () => {
    expect(extendedDecision(true, false)).toBe("RAISE");
    expect(extendedDecision(true, true)).toBe("NONE");
    expect(extendedDecision(false, true)).toBe("CLEAR");
    expect(extendedDecision(null, true)).toBe("CLEAR");
    expect(extendedDecision(false, false)).toBe("NONE");
    expect(extendedDecision(null, false)).toBe("NONE");
  });
});
