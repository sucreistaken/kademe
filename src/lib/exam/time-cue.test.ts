import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { crossedCue, TIME_NOTICE_MS, timeCue, timeCueKey } from "./time-cue";

const LONG = 20 * 60_000;
const SHORT = 8 * 60_000;

describe("timeCue", () => {
  it("is normal while plenty of time is left", () => {
    expect(timeCue(LONG, LONG)).toBe("normal");
    expect(timeCue(300_001, LONG)).toBe("normal");
  });
  it("is low from 5 minutes in sections longer than 10 minutes", () => {
    expect(timeCue(300_000, LONG)).toBe("low");
    expect(timeCue(120_001, LONG)).toBe("low");
    expect(timeCue(300_000, SHORT)).toBe("normal");
    expect(timeCue(300_000, 600_000)).toBe("normal");
  });
  it("is last in the final 2 minutes of any section", () => {
    expect(timeCue(120_000, LONG)).toBe("last");
    expect(timeCue(1, SHORT)).toBe("last");
  });
  it("is up at zero or below", () => {
    expect(timeCue(0, LONG)).toBe("up");
    expect(timeCue(-5, LONG)).toBe("up");
  });
});

describe("crossedCue", () => {
  it("announces a step into low or last", () => {
    expect(crossedCue("normal", "low")).toBe("low");
    expect(crossedCue("low", "last")).toBe("last");
    expect(crossedCue("normal", "last")).toBe("last");
  });
  it("stays silent otherwise", () => {
    expect(crossedCue("low", "low")).toBeNull();
    expect(crossedCue("last", "last")).toBeNull();
    expect(crossedCue("last", "low")).toBeNull();
    expect(crossedCue("last", "up")).toBeNull();
    expect(crossedCue("normal", "normal")).toBeNull();
    expect(crossedCue("normal", "up")).toBeNull();
  });
});

describe("timeCueKey", () => {
  it("is per attempt token and section position", () => {
    expect(timeCueKey("abc", 2)).toBe("kademe.exam.timecue.abc.2");
  });
});

describe("time callout", () => {
  it("hides itself after 12 seconds (spec)", () => {
    expect(TIME_NOTICE_MS).toBe(12_000);
  });
  it("is the duration the timer pill uses", () => {
    const pill = readFileSync(path.join(process.cwd(), "src/components/candidate/exam/TimerPill.tsx"), "utf8");
    expect(pill).toContain("setTimeout(() => setNotice(null), TIME_NOTICE_MS)");
    expect(pill).not.toMatch(/NOTICE_MS = /);
  });
});
