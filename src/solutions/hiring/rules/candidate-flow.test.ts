import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "@/db/migration-files";
import { activity } from "./test-fixtures";
import { activityConfigSchema, HIRING_LIMITS } from "./patches";
import {
  autoScore,
  cleanFileName,
  DEFAULT_MAX_FILE_BYTES,
  effectiveSeconds,
  EXTRA_TIME_OPTIONS,
  extraTimeRefusal,
  firstOpenIndex,
  hiringStepPath,
  hiringStepSuffix,
  isExtraTimePct,
  isOverdue,
  MAX_TEXT_CHARS,
  maxCharsOf,
  minCharsOf,
  missingRequired,
  progressOf,
  responseAnswered,
  runCompletion,
  sanitizeResponse,
  stageDeadline,
  stageRules,
  writeRefusal,
} from "./candidate-flow";

const T0 = new Date("2026-10-05T09:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe("stage clock with the candidate's extra time (spec 2.4)", () => {
  it("knows only 0, 25 and 50 percent", () => {
    expect([0, 25, 50].every(isExtraTimePct)).toBe(true);
    expect([10, "25", null, 100].some(isExtraTimePct)).toBe(false);
  });

  it("stretches the stage by the chosen percentage, rounded up to a whole second", () => {
    expect(effectiveSeconds(600, 0)).toBe(600);
    expect(effectiveSeconds(600, 25)).toBe(750);
    expect(effectiveSeconds(601, 50)).toBe(902);
  });

  it("writes the deadline from the start, adding grace only for ALLOW_GRACE", () => {
    const stage = { durationSeconds: 600, graceSeconds: 60, onTimeout: "AUTO_SUBMIT" as const };
    expect(stageDeadline(T0, stage, 25).toISOString()).toBe(at(750).toISOString());
    expect(stageDeadline(T0, { ...stage, onTimeout: "ALLOW_GRACE" }, 0).toISOString()).toBe(at(660).toISOString());
  });

  it("calls a run overdue only after the deadline plus the write slack, never for ALLOW_LATE", () => {
    const run = { startedAt: T0, deadlineAt: at(600), submittedAt: null };
    expect(isOverdue(run, "AUTO_SUBMIT", at(603))).toBe(false);
    expect(isOverdue(run, "AUTO_SUBMIT", at(606))).toBe(true);
    expect(isOverdue(run, "ALLOW_LATE", at(6000))).toBe(false);
    expect(isOverdue({ ...run, submittedAt: at(500) }, "AUTO_SUBMIT", at(6000))).toBe(false);
    expect(isOverdue({ startedAt: null, deadlineAt: null, submittedAt: null }, "AUTO_SUBMIT", at(6000))).toBe(false);
  });
});

describe("answers as the server keeps them", () => {
  it("cuts text to the question's limit and keeps nothing else the candidate sent", () => {
    const short = activity("a", { type: "SHORT_TEXT", config: { maxChars: 5 } });
    expect(sanitizeResponse(short, { text: "1234567", choiceIds: ["x"], file: { name: "evil" } }, {})).toEqual({ text: "12345" });
    expect(maxCharsOf(activity("b", { type: "LONG_TEXT", config: {} }))).toBe(3000);
    expect(maxCharsOf(activity("c", { type: "SHORT_TEXT", config: {} }))).toBe(300);
    expect(maxCharsOf(activity("d", { type: "LONG_TEXT", config: { maxChars: 999999 } }))).toBe(20000);
  });

  it("keeps only choices the candidate could see, one for a single choice, without repeats", () => {
    const config = { choices: [{ id: "a", label: { tr: "A", en: "" } }, { id: "b", label: { tr: "B", en: "" }, correct: true }, { id: "c", label: { tr: "", en: "" } }] };
    const single = activity("s", { type: "SINGLE_CHOICE", config });
    const multi = activity("m", { type: "MULTI_CHOICE", config });
    expect(sanitizeResponse(single, { choiceIds: ["b", "a"] }, {})).toEqual({ choiceIds: ["b"] });
    expect(sanitizeResponse(multi, { choiceIds: ["a", "a", "c", "zz", 4] }, {})).toEqual({ choiceIds: ["a"] });
  });

  it("takes a written alternative for a recording only where the team allowed it", () => {
    const allowed = activity("v", { type: "VIDEO", config: { textAlternativeEnabled: true } });
    const notAllowed = activity("w", { type: "VIDEO", config: {} });
    expect(sanitizeResponse(allowed, { usedTextAlternative: true, text: "Yazıyla" }, {})).toEqual({ usedTextAlternative: true, text: "Yazıyla" });
    expect(sanitizeResponse(notAllowed, { usedTextAlternative: true, text: "Yazıyla" }, {})).toEqual({});
  });

  it("never lets the client name or drop an attached file", () => {
    const file = activity("f", { type: "FILE_UPLOAD", config: {} });
    const previous = { file: { name: "cv.pdf", bytes: 10, mime: "application/pdf" } };
    expect(sanitizeResponse(file, { file: null, text: "x" }, previous)).toEqual(previous);
  });

  it("knows when a question has an answer", () => {
    expect(responseAnswered(activity("t", { type: "LONG_TEXT", config: { minChars: 3 } }), { text: " ab " }, false)).toBe(false);
    expect(responseAnswered(activity("t", { type: "LONG_TEXT", config: { minChars: 3 } }), { text: "abc" }, false)).toBe(true);
    expect(responseAnswered(activity("c", { type: "SINGLE_CHOICE" }), { choiceIds: [] }, false)).toBe(false);
    expect(responseAnswered(activity("v", { type: "VIDEO" }), {}, true)).toBe(true);
    expect(responseAnswered(activity("v", { type: "VIDEO" }), { usedTextAlternative: true, text: "  " }, false)).toBe(false);
    expect(responseAnswered(activity("f", { type: "FILE_UPLOAD" }), { pendingFile: { assetId: "x", name: "a", bytes: 1, mime: "a" } }, false)).toBe(false);
    expect(responseAnswered(activity("f", { type: "FILE_UPLOAD" }), { file: { name: "a", bytes: 1, mime: "a" } }, false)).toBe(true);
  });

  it("scores a choice question 1 or 0 and nothing else at all", () => {
    const config = { choices: [{ id: "a", label: { tr: "A", en: "" }, correct: true }, { id: "b", label: { tr: "B", en: "" }, correct: true }, { id: "c", label: { tr: "C", en: "" } }] };
    const multi = activity("m", { type: "MULTI_CHOICE", config });
    expect(autoScore(multi, { choiceIds: ["b", "a"] })).toBe(1);
    expect(autoScore(multi, { choiceIds: ["a"] })).toBe(0);
    expect(autoScore(multi, { choiceIds: ["a", "b", "c"] })).toBe(0);
    expect(autoScore(multi, {})).toBe(0);
    expect(autoScore(activity("v", { type: "VIDEO" }), {})).toBeNull();
    expect(autoScore(activity("n", { type: "SINGLE_CHOICE", config: { choices: [{ id: "a", label: { tr: "A", en: "" } }] } }), { choiceIds: ["a"] })).toBeNull();
  });

  it("lists the required questions still without an answer", () => {
    const answered = new Set(["b"]);
    expect(missingRequired([{ id: "a", required: true }, { id: "b", required: true }, { id: "c", required: false }], (id) => answered.has(id))).toEqual(["a"]);
  });
});

describe("closing a stage", () => {
  const counts = { requiredCount: 2, answeredRequired: 2, answeredAny: 2 };
  it("a submit with every required answer is COMPLETE, with one missing PARTIAL", () => {
    expect(runCompletion({ reason: "SUBMIT", late: false, behaviour: "AUTO_SUBMIT", ...counts })).toEqual({ completion: "COMPLETE", late: false });
    expect(runCompletion({ reason: "SUBMIT", late: true, behaviour: "ALLOW_LATE", ...counts, answeredRequired: 1 })).toEqual({ completion: "PARTIAL", late: true });
  });

  it("the clock keeps what was written: PARTIAL with something, EXPIRED with nothing, always late", () => {
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "AUTO_SUBMIT", ...counts, answeredRequired: 1, answeredAny: 1 })).toEqual({ completion: "PARTIAL", late: true });
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "AUTO_SUBMIT", requiredCount: 2, answeredRequired: 0, answeredAny: 0 })).toEqual({ completion: "EXPIRED", late: true });
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "AUTO_CLOSE", ...counts })).toEqual({ completion: "EXPIRED", late: true });
  });
});

describe("write order (decision 7)", () => {
  const current = { position: 1, startedAt: T0, deadlineAt: at(600), onTimeout: "AUTO_SUBMIT" as const, backNavigation: false };
  const activities = [
    { id: "a1", closed: true },
    { id: "a2", closed: false },
    { id: "a3", closed: false },
  ];
  const ask = (over: Partial<Parameters<typeof writeRefusal>[0]>) => writeRefusal({ current, position: 1, activityId: "a2", activities, now: at(10), ...over });

  it("accepts the first open question of the running stage", () => {
    expect(ask({})).toBeNull();
  });

  it("refuses a stale tab, an unstarted or expired stage, an unknown, closed or later question", () => {
    expect(ask({ current: null })).toBe("NO_STAGE");
    expect(ask({ position: 2 })).toBe("STAGE_MISMATCH");
    expect(ask({ position: "1" })).toBe("STAGE_MISMATCH");
    expect(ask({ current: { ...current, startedAt: null, deadlineAt: null } })).toBe("STAGE_NOT_STARTED");
    expect(ask({ now: at(606) })).toBe("STAGE_EXPIRED");
    expect(ask({ activityId: "zz" })).toBe("ACTIVITY_NOT_FOUND");
    expect(ask({ activityId: "a1" })).toBe("ACTIVITY_CLOSED");
    expect(ask({ activityId: "a3" })).toBe("ACTIVITY_ORDER");
  });

  it("with back navigation, any question of the running stage may be written", () => {
    const back = { ...current, backNavigation: true };
    expect(ask({ current: back, activityId: "a1" })).toBeNull();
    expect(ask({ current: back, activityId: "a3" })).toBeNull();
  });

  it("an ALLOW_LATE stage keeps accepting after its deadline", () => {
    expect(ask({ current: { ...current, onTimeout: "ALLOW_LATE" }, now: at(6000) })).toBeNull();
  });

  it("resumes at the first open question", () => {
    expect(firstOpenIndex([true, false, false])).toBe(1);
    expect(firstOpenIndex([true, true])).toBe(1);
    expect(firstOpenIndex([])).toBe(0);
  });
});

describe("what the stage intro promises (HIRING-UX 6.5)", () => {
  const video = (over: Record<string, unknown> = {}) => ({ type: "VIDEO" as const, thinkSeconds: 30, flexibleThink: true, maxTakes: 2, ...over });
  it("says think time, retakes and that there is no way back, only where they apply", () => {
    expect(stageRules({ activities: [video(), video()] }, { backNavigation: false, onTimeout: "AUTO_SUBMIT" })).toEqual([
      { kind: "think", seconds: 30 },
      { kind: "takes", count: 1 },
      { kind: "noBack" },
    ]);
    expect(stageRules({ activities: [{ type: "LONG_TEXT", thinkSeconds: 0, flexibleThink: true, maxTakes: 1 }] }, { backNavigation: true, onTimeout: "ALLOW_LATE" })).toEqual([{ kind: "back" }, { kind: "lateAllowed" }]);
  });

  it("says when recording starts by itself and when numbers differ between questions", () => {
    expect(stageRules({ activities: [video({ flexibleThink: false }), video({ thinkSeconds: 60, maxTakes: 1 })] }, { backNavigation: false, onTimeout: "AUTO_SUBMIT" })).toEqual([
      { kind: "thinkStrict", seconds: null },
      { kind: "takes", count: null },
      { kind: "noBack" },
    ]);
    expect(stageRules({ activities: [video({ maxTakes: 1 })] }, { backNavigation: false, onTimeout: "AUTO_SUBMIT" })).toContainEqual({ kind: "noRetake" });
  });
});

describe("progress and paths", () => {
  it("one definition of progress: done stages plus the share of the current stage", () => {
    expect(progressOf({ stagePosition: 1, stageCount: 2, activityIndex: 0, activityCount: 4 })).toEqual({ n: 1, total: 2, ratio: 0 });
    expect(progressOf({ stagePosition: 2, stageCount: 2, activityIndex: 2, activityCount: 4 })).toEqual({ n: 2, total: 2, ratio: 0.75 });
    expect(progressOf({ stagePosition: 1, stageCount: 0, activityIndex: 0, activityCount: 0 }).ratio).toBe(0);
  });

  it("maps every step to its page", () => {
    expect(hiringStepSuffix("CONSENT", null)).toBe("");
    expect(hiringStepSuffix("STAGE", 3)).toBe("/stage/3");
    expect(hiringStepPath("t k", "CONSENT", null)).toBe("/a/t%20k");
    expect(hiringStepPath("tok", "CLOSED", null)).toBe("/a/tok");
    expect(hiringStepPath("tok", "INFO", null)).toBe("/a/tok/info");
    expect(hiringStepPath("tok", "CHECK", null)).toBe("/a/tok/check");
    expect(hiringStepPath("tok", "STAGE", 2)).toBe("/a/tok/stage/2");
    expect(hiringStepPath("tok", "DONE", null)).toBe("/a/tok/done");
  });

  it("locks extra time only while a stage is running", () => {
    expect(extraTimeRefusal([])).toBeNull();
    expect(extraTimeRefusal([{ startedAt: T0, submittedAt: at(5) }])).toBeNull();
    expect(extraTimeRefusal([{ startedAt: T0, submittedAt: null }])).toBe("EXTRA_TIME_LOCKED");
  });

  it("keeps a file's own name but never a path or a control character", () => {
    expect(cleanFileName("C:\\Users\\elif\\Özgeçmiş.pdf")).toBe("Özgeçmiş.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("a\u0000b\nc.pdf")).toBe("abc.pdf");
    expect(cleanFileName(42)).toBe("dosya");
    expect(cleanFileName("x".repeat(300) + ".pdf").length).toBe(200);
  });
});

describe("hostile input", () => {
  const choices = [{ id: "a", label: { tr: "A", en: "" }, correct: true }, { id: "b", label: { tr: "B", en: "" } }];

  it("falls back to no extra time for a percentage the database would refuse", () => {
    expect(effectiveSeconds(600, 100 as never)).toBe(600);
    expect(effectiveSeconds(600, NaN as never)).toBe(600);
    expect(stageDeadline(T0, { durationSeconds: 600, graceSeconds: 0, onTimeout: "AUTO_SUBMIT" }, 7 as never).toISOString()).toBe(at(600).toISOString());
  });

  it("ignores a body that is not an object, and unknown keys", () => {
    const long = activity("l", { type: "LONG_TEXT", config: {} });
    for (const raw of [null, undefined, "x", 4, [], ["text"], true]) {
      expect(sanitizeResponse(long, raw, {})).toEqual({});
    }
    expect(sanitizeResponse(long, { text: "ok", __proto__: { text: "no" }, isAdmin: true, autoScore: 1, file: { name: "x" }, pendingFile: { assetId: "x" } }, {})).toEqual({ text: "ok" });
  });

  it("keeps the previous text when the client sends none, and a non-string text changes nothing", () => {
    const short = activity("s", { type: "SHORT_TEXT", config: {} });
    expect(sanitizeResponse(short, {}, { text: "kept" })).toEqual({ text: "kept" });
    expect(sanitizeResponse(short, { text: { $ne: 1 } }, { text: "kept" })).toEqual({ text: "kept" });
    expect(sanitizeResponse(short, { text: 12 }, {})).toEqual({});
  });

  it("never stores what the jsonb column refuses: NUL, a lone surrogate, a cut surrogate pair", () => {
    const short = activity("s", { type: "SHORT_TEXT", config: { maxChars: 3 } });
    expect(sanitizeResponse(short, { text: "a\u0000b" }, {})).toEqual({ text: "ab" });
    expect(sanitizeResponse(short, { text: "a\ud800b\udc00c" }, {})).toEqual({ text: "abc" });
    // The emoji is two code units; cutting after the first would leave half of it.
    expect(sanitizeResponse(short, { text: "ab\u{1F600}" }, {})).toEqual({ text: "ab" });
    expect(sanitizeResponse(short, { text: "a\u{1F600}" }, {})).toEqual({ text: "a\u{1F600}" });
    // Line breaks and tabs are an answer's own.
    expect(sanitizeResponse(activity("l", { type: "LONG_TEXT" }), { text: "a\n\tb" }, {})).toEqual({ text: "a\n\tb" });
  });

  it("falls back to the default limit when the stored limit is unusable", () => {
    for (const maxChars of [0, -5, NaN, Infinity, "10" as never]) {
      expect(maxCharsOf(activity("l", { type: "LONG_TEXT", config: { maxChars } }))).toBe(3000);
    }
    expect(maxCharsOf(activity("l", { type: "LONG_TEXT", config: { maxChars: 12.9 } }))).toBe(12);
    expect(minCharsOf(activity("l", { type: "LONG_TEXT", config: { minChars: -3 } }))).toBe(0);
    expect(minCharsOf(activity("l", { type: "LONG_TEXT", config: { minChars: NaN } }))).toBe(0);
    expect(minCharsOf(activity("l", { type: "LONG_TEXT", config: { minChars: 8 } }))).toBe(8);
    expect(minCharsOf(activity("c", { type: "SINGLE_CHOICE", config: { minChars: 8 } }))).toBe(0);
    expect(maxCharsOf(activity("c", { type: "SINGLE_CHOICE" }))).toBe(0);
    expect(maxCharsOf(activity("f", { type: "FILE_UPLOAD" }))).toBe(0);
  });

  it("cuts a recording's written alternative to the same limit and keeps the old one when none is sent", () => {
    const video = activity("v", { type: "VIDEO", config: { textAlternativeEnabled: true } });
    expect(sanitizeResponse(video, { usedTextAlternative: true, text: "x".repeat(5000) }, {}).text?.length).toBe(3000);
    expect(sanitizeResponse(video, { usedTextAlternative: true }, { text: "old" })).toEqual({ usedTextAlternative: true, text: "old" });
    expect(sanitizeResponse(video, { usedTextAlternative: "true", text: "x" }, {})).toEqual({});
    expect(sanitizeResponse(video, { text: "x", file: { name: "a" } }, {})).toEqual({});
  });

  it("drops hostile choice ids of every kind and a choice list that is not a list", () => {
    const multi = activity("m", { type: "MULTI_CHOICE", config: { choices } });
    expect(sanitizeResponse(multi, { choiceIds: ["__proto__", "constructor", "", null, {}, ["a"], "a"] }, {})).toEqual({ choiceIds: ["a"] });
    expect(sanitizeResponse(multi, { choiceIds: "a" }, { choiceIds: ["b"] })).toEqual({ choiceIds: ["b"] });
    expect(sanitizeResponse(multi, { choiceIds: { 0: "a", length: 1 } }, {})).toEqual({});
    expect(sanitizeResponse(multi, { choiceIds: [] }, { choiceIds: ["a"] })).toEqual({ choiceIds: [] });
    expect(sanitizeResponse(activity("n", { type: "SINGLE_CHOICE", config: {} }), { choiceIds: ["a"] }, {})).toEqual({ choiceIds: [] });
  });

  it("keeps the server's own file fields whatever the type or the body", () => {
    const previous = { file: { name: "cv.pdf", bytes: 10, mime: "application/pdf" }, pendingFile: { assetId: "x", name: "n", bytes: 1, mime: "a" } };
    expect(sanitizeResponse(activity("l", { type: "LONG_TEXT" }), { text: "t", file: null, pendingFile: null }, previous)).toEqual({ ...previous, text: "t" });
    expect(sanitizeResponse(activity("f", { type: "FILE_UPLOAD" }), { pendingFile: { assetId: "evil" } }, previous)).toEqual(previous);
  });

  it("does not trust a stored payload of the wrong shape when deciding an answer", () => {
    const long = activity("l", { type: "LONG_TEXT", config: {} });
    expect(responseAnswered(long, { text: 5 } as never, false)).toBe(false);
    expect(responseAnswered(long, { text: "   " }, false)).toBe(false);
    expect(responseAnswered(long, { text: "a" }, false)).toBe(true);
    expect(responseAnswered(activity("c", { type: "MULTI_CHOICE" }), { choiceIds: "a" } as never, false)).toBe(false);
    expect(responseAnswered(activity("c", { type: "MULTI_CHOICE" }), { choiceIds: ["a"] }, false)).toBe(true);
    expect(responseAnswered(activity("v", { type: "AUDIO" }), { usedTextAlternative: true, text: "yazı" }, false)).toBe(true);
    expect(responseAnswered(activity("v", { type: "AUDIO" }), { text: "yazı" }, false)).toBe(false);
  });

  it("scores only from the exact set, ignores repeats and unknown ids, and says nothing for a question with no right answer", () => {
    const single = activity("s", { type: "SINGLE_CHOICE", config: { choices } });
    expect(autoScore(single, { choiceIds: ["a", "a"] })).toBe(1);
    expect(autoScore(single, { choiceIds: ["a", "zz"] })).toBe(0);
    expect(autoScore(single, { choiceIds: ["b"] })).toBe(0);
    expect(autoScore(single, { choiceIds: "a" } as never)).toBe(0);
    expect(autoScore(activity("n", { type: "MULTI_CHOICE", config: {} }), {})).toBeNull();
    expect(autoScore(activity("t", { type: "LONG_TEXT", config: { choices } }), { choiceIds: ["a"] })).toBeNull();
  });

  it("needs only the required questions with no answer, in order, and survives an empty stage", () => {
    expect(missingRequired([], () => false)).toEqual([]);
    expect(missingRequired([{ id: "a", required: true }, { id: "b", required: true }], () => false)).toEqual(["a", "b"]);
  });

  it("completes a stage that has nothing required on submit, and treats a late allow-late clock close as the counts say", () => {
    expect(runCompletion({ reason: "SUBMIT", late: false, behaviour: "AUTO_SUBMIT", requiredCount: 0, answeredRequired: 0, answeredAny: 0 })).toEqual({ completion: "COMPLETE", late: false });
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "ALLOW_LATE", requiredCount: 2, answeredRequired: 1, answeredAny: 1 })).toEqual({ completion: "PARTIAL", late: true });
    expect(runCompletion({ reason: "CLOCK", late: false, behaviour: "ALLOW_GRACE", requiredCount: 1, answeredRequired: 1, answeredAny: 1 })).toEqual({ completion: "COMPLETE", late: true });
  });

  it("refuses hostile write requests without throwing", () => {
    const current = { position: 1, startedAt: T0, deadlineAt: at(600), onTimeout: "AUTO_SUBMIT" as const, backNavigation: false };
    const activities = [{ id: "a1", closed: false }];
    const ask = (over: Record<string, unknown>) => writeRefusal({ current, position: 1, activityId: "a1", activities, now: at(1), ...over } as never);
    expect(ask({ position: undefined })).toBe("STAGE_MISMATCH");
    expect(ask({ position: NaN })).toBe("STAGE_MISMATCH");
    expect(ask({ position: { valueOf: () => 1 } })).toBe("STAGE_MISMATCH");
    expect(ask({ activityId: undefined })).toBe("ACTIVITY_NOT_FOUND");
    expect(ask({ activityId: { id: "a1" } })).toBe("ACTIVITY_NOT_FOUND");
    expect(ask({ activityId: "a1", activities: [] })).toBe("ACTIVITY_NOT_FOUND");
    expect(ask({ now: new Date("nope") })).toBe("STAGE_EXPIRED");
  });

  it("writes exactly up to the deadline plus slack", () => {
    const current = { position: 1, startedAt: T0, deadlineAt: at(600), onTimeout: "AUTO_SUBMIT" as const, backNavigation: false };
    const ask = (s: number) => writeRefusal({ current, position: 1, activityId: "a", activities: [{ id: "a", closed: false }], now: at(s) });
    expect(ask(605)).toBeNull();
    expect(ask(605.001)).toBe("STAGE_EXPIRED");
  });

  it("states rules from stages with odd settings: no recordings, a zero or negative take count", () => {
    expect(stageRules({ activities: [] }, { backNavigation: false, onTimeout: "AUTO_CLOSE" })).toEqual([{ kind: "noBack" }]);
    expect(stageRules({ activities: [{ type: "AUDIO", thinkSeconds: 0, flexibleThink: true, maxTakes: 0 }] }, { backNavigation: false, onTimeout: "ALLOW_GRACE" })).toEqual([{ kind: "noRetake" }, { kind: "noBack" }]);
    // Think time and takes are said for recordings only; a text question's numbers never count.
    expect(
      stageRules({ activities: [{ type: "LONG_TEXT", thinkSeconds: 99, flexibleThink: false, maxTakes: 5 }, video2()] }, { backNavigation: false, onTimeout: "AUTO_SUBMIT" }),
    ).toEqual([{ kind: "think", seconds: 10 }, { kind: "takes", count: 2 }, { kind: "noBack" }]);
  });

  it("keeps progress inside 0..1 for positions and counts that make no sense", () => {
    expect(progressOf({ stagePosition: 9, stageCount: 2, activityIndex: 9, activityCount: 2 }).ratio).toBe(1);
    expect(progressOf({ stagePosition: -3, stageCount: 2, activityIndex: -1, activityCount: 2 }).ratio).toBe(0);
    const odd = progressOf({ stagePosition: NaN, stageCount: 2, activityIndex: NaN, activityCount: NaN });
    expect(Number.isFinite(odd.ratio) && Number.isFinite(odd.n) && Number.isFinite(odd.total)).toBe(true);
    expect(odd.ratio).toBeGreaterThanOrEqual(0);
    expect(odd.ratio).toBeLessThanOrEqual(1);
  });

  it("never builds a stage path from a position that is not a positive whole number", () => {
    for (const position of [null, 0, -2, NaN, Infinity, 1.7]) {
      expect(hiringStepSuffix("STAGE", position as never)).toBe("/stage/1");
    }
    expect(hiringStepSuffix("STAGE", 12)).toBe("/stage/12");
    expect(hiringStepSuffix("DONE", 5)).toBe("/done");
  });

  it("escapes a token that tries to leave its path", () => {
    expect(hiringStepPath("../x?y=1#z", "INFO", null)).toBe("/a/..%2Fx%3Fy%3D1%23z/info");
  });

  it("resumes at the last question when every one is closed, and at zero for no questions", () => {
    expect(firstOpenIndex([true, false, true])).toBe(1);
    expect(firstOpenIndex([true, true, true])).toBe(2);
  });

  it("locks extra time for a stage that started and has not ended, however many others ended", () => {
    expect(extraTimeRefusal([{ startedAt: null, submittedAt: null }])).toBeNull();
    expect(extraTimeRefusal([{ startedAt: T0, submittedAt: at(1) }, { startedAt: at(2), submittedAt: null }])).toBe("EXTRA_TIME_LOCKED");
  });

  it("cleans file names of dots, direction overrides, odd controls and half characters", () => {
    expect(cleanFileName("")).toBe("dosya");
    expect(cleanFileName("..")).toBe("dosya");
    expect(cleanFileName(".")).toBe("dosya");
    expect(cleanFileName("a/")).toBe("dosya");
    expect(cleanFileName(null)).toBe("dosya");
    expect(cleanFileName({ toString: () => "x" })).toBe("dosya");
    expect(cleanFileName("  cv.pdf  ")).toBe("cv.pdf");
    expect(cleanFileName("evil\u202Efdp.exe")).toBe("evilfdp.exe");
    expect(cleanFileName("a\u0085b\u007fc")).toBe("abc");
    expect(cleanFileName("a\ud800b")).toBe("ab");
    // Cutting at 200 never leaves half of an emoji.
    expect(cleanFileName("x".repeat(199) + "\u{1F600}")).toBe("x".repeat(199));
  });
});

function video2() {
  return { type: "VIDEO" as const, thinkSeconds: 10, flexibleThink: true, maxTakes: 3 };
}

describe("agreement with the database (migrations 0010 and 0011)", () => {
  const sql = (tag: string) => readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");
  const m0010 = sql("0010_hiring_candidate_flow");
  const m0011 = sql("0011_hiring_tenancy_keys");

  it("offers exactly the extra times hiring_extra_time_pct allows", () => {
    const allowed = /"hiring_extra_time_pct" CHECK \("hiring_assessments"\."extra_time_pct" IN \(([\d, ]+)\)\)/.exec(m0010);
    expect(allowed, "the CHECK is in 0010").not.toBeNull();
    expect([...EXTRA_TIME_OPTIONS]).toEqual(allowed![1].split(",").map((n) => Number(n.trim())));
    for (const pct of EXTRA_TIME_OPTIONS) expect(isExtraTimePct(pct)).toBe(true);
    for (const pct of [-25, 1, 24, 51, 75, 100]) expect(isExtraTimePct(pct)).toBe(false);
  });

  it("keeps auto_score inside the range hiring_response_auto_score allows", () => {
    const range = /"hiring_response_auto_score" CHECK \("hiring_responses"\."auto_score" IS NULL OR \("hiring_responses"\."auto_score" >= (\d+) AND "hiring_responses"\."auto_score" <= (\d+)\)\)/.exec(m0010);
    expect(range, "the CHECK is in 0010").not.toBeNull();
    const [low, high] = [Number(range![1]), Number(range![2])];
    const choices = [{ id: "a", label: { tr: "A", en: "" }, correct: true }, { id: "b", label: { tr: "B", en: "" }, correct: true }, { id: "c", label: { tr: "C", en: "" } }];
    const multi = activity("m", { type: "MULTI_CHOICE", config: { choices } });
    const scores = [{}, { choiceIds: ["a"] }, { choiceIds: ["a", "b"] }, { choiceIds: ["a", "b", "c"] }, { choiceIds: ["c"] }].map((p) => autoScore(multi, p));
    for (const score of scores) {
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(low);
      expect(score!).toBeLessThanOrEqual(high);
    }
  });

  it("lets a stage give as many takes as hiring_response_takes_max counts", () => {
    const max = /"hiring_response_takes_max" CHECK \("hiring_responses"\."takes_used" <= (\d+)\)/.exec(m0011);
    expect(max, "the CHECK is in 0011").not.toBeNull();
    expect(HIRING_LIMITS.maxTakes.max).toBe(Number(max![1]));
  });

  it("keeps its text and file ceilings inside what the builder accepts", () => {
    expect(MAX_TEXT_CHARS).toBe(20000);
    expect(activityConfigSchema.safeParse({ maxChars: MAX_TEXT_CHARS }).success).toBe(true);
    expect(activityConfigSchema.safeParse({ maxChars: MAX_TEXT_CHARS + 1 }).success).toBe(false);
    expect(DEFAULT_MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(activityConfigSchema.safeParse({ maxFileBytes: DEFAULT_MAX_FILE_BYTES }).success).toBe(true);
  });
});
