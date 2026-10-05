import { describe, expect, it } from "vitest";
import type { CandidateResponseView } from "@/solutions/hiring/rules/candidate-state";
import {
  answeredLocally,
  introMinutes,
  isLastMinute,
  isTypingTarget,
  keyIndex,
  minutesLeft,
  ownsPrimary,
  primaryKey,
  resumeOf,
  tabReply,
  toLocal,
} from "./runner-model";

describe("the stage runner's rules", () => {
  it("mirrors the server's answered rule for the button (the server still decides)", () => {
    expect(answeredLocally({ type: "LONG_TEXT", minChars: 5 }, { text: " abcd " })).toBe(false);
    expect(answeredLocally({ type: "SHORT_TEXT", minChars: null }, { text: "a" })).toBe(true);
    expect(answeredLocally({ type: "MULTI_CHOICE", minChars: null }, { choiceIds: [] })).toBe(false);
    expect(answeredLocally({ type: "VIDEO", minChars: null }, { hasTake: true })).toBe(true);
    expect(answeredLocally({ type: "AUDIO", minChars: null }, { usedTextAlternative: true, text: "yazdım" })).toBe(true);
    expect(answeredLocally({ type: "FILE_UPLOAD", minChars: null }, {})).toBe(false);
  });

  it("starts from what the server already holds", () => {
    expect(
      toLocal({ activityId: "a", text: "x", choiceIds: ["b"], usedTextAlternative: false, takesUsed: 1, recording: { ref: "m", status: "READY", durationMs: 1 }, file: null, answered: true, closed: false }),
    ).toEqual({ text: "x", choiceIds: ["b"], usedTextAlternative: false, hasTake: true, hasFile: false });
  });

  it("lets video and audio questions carry their own filled button", () => {
    expect(ownsPrimary("VIDEO")).toBe(true);
    expect(ownsPrimary("AUDIO")).toBe(true);
    expect(ownsPrimary("FILE_UPLOAD")).toBe(false);
    expect(ownsPrimary("LONG_TEXT")).toBe(false);
  });

  it("names the button: next question, finish the stage, finish the assessment", () => {
    expect(primaryKey(0, 3, false)).toBe("next");
    expect(primaryKey(2, 3, false)).toBe("finishStage");
    expect(primaryKey(2, 3, true)).toBe("finishAll");
  });

  it("changes only the clock's words in the last minute and speaks once a minute", () => {
    expect(isLastMinute(61_000)).toBe(false);
    expect(isLastMinute(60_000)).toBe(true);
    expect(isLastMinute(0)).toBe(false);
    expect(minutesLeft(420_001)).toBe(8);
    expect(minutesLeft(60_000)).toBe(1);
  });

  it("maps keys 1-9 onto the choices there are", () => {
    expect(keyIndex("1", 4)).toBe(0);
    expect(keyIndex("4", 4)).toBe(3);
    expect(keyIndex("5", 4)).toBeNull();
    expect(keyIndex("0", 4)).toBeNull();
    expect(keyIndex("a", 4)).toBeNull();
  });

  it("never takes a digit typed into a text field as a choice", () => {
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "email" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    // The choice rows themselves (Radix renders buttons) and a page with nothing focused take the keys.
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({ tagName: "INPUT", type: "radio" })).toBe(false);
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("lets the first tab keep the assessment and tells a second one to step back", () => {
    expect(tabReply("first", { type: "hello", id: "second" }, false)).toEqual({ reply: { type: "here", id: "first" }, blocked: false });
    expect(tabReply("second", { type: "here", id: "first" }, false)).toEqual({ reply: null, blocked: true });
    expect(tabReply("first", { type: "hello", id: "first" }, false)).toEqual({ reply: null, blocked: false });
    // A tab that already stepped back never claims the assessment, so a reload of the first tab works.
    expect(tabReply("second", { type: "hello", id: "third" }, true)).toEqual({ reply: null, blocked: true });
  });
});

describe("a reload mid-stage (ruling 2, Task 5 Minor 6)", () => {
  const response = (activityId: string, closed: boolean, over: Partial<CandidateResponseView> = {}): CandidateResponseView => ({
    activityId,
    text: "",
    choiceIds: [],
    usedTextAlternative: false,
    takesUsed: 0,
    recording: null,
    file: null,
    answered: false,
    closed,
    ...over,
  });

  it("opens on the first question the candidate has not closed, with every saved answer restored", () => {
    const resumed = resumeOf([
      response("a", true, { text: "Closed answer", answered: true }),
      response("b", false, { text: "Half a sentence the autosave kept" }),
      response("c", false, { choiceIds: ["x"] }),
    ]);
    expect(resumed.index).toBe(1);
    expect(resumed.answers.b).toEqual({ text: "Half a sentence the autosave kept", choiceIds: [], usedTextAlternative: false, hasTake: false, hasFile: false });
    expect(resumed.answers.a.text).toBe("Closed answer");
    expect(resumed.answers.c.choiceIds).toEqual(["x"]);
  });

  it("opens on the last question when every question is closed, and on the first in a fresh stage", () => {
    expect(resumeOf([response("a", true), response("b", true)]).index).toBe(1);
    expect(resumeOf([response("a", false), response("b", false)]).index).toBe(0);
    expect(resumeOf([]).index).toBe(0);
  });
});

describe("the stage intro's minutes (C25)", () => {
  it("counts the grace baked into the deadline, so the intro never promises less than the clock shows", () => {
    expect(introMinutes({ seconds: 600, graceSeconds: 0 })).toBe(10);
    expect(introMinutes({ seconds: 600, graceSeconds: 120 })).toBe(12);
    // 10:30 on the clock: the intro rounds up, like the landing's stage minutes.
    expect(introMinutes({ seconds: 600, graceSeconds: 30 })).toBe(11);
    expect(introMinutes({ seconds: 750, graceSeconds: 0 })).toBe(13);
  });
});
