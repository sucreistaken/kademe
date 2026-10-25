import { describe, expect, it } from "vitest";
import { compareLevels, shiftLevel } from "../cefr";
import { CRITERIA_BY_SECTION } from "../cefr-descriptors";
import { countWords } from "../grading";
import { RESULT_LEVELS } from "../types";
import { CALIBRATION_FIXTURES } from "./fixtures";
import { CALIBRATION_TASKS, matchingSeedItems, resolveTask } from "./tasks";
import { metricsFor, timedWords, transcriptWords } from "./timing";

const EM_DASH = "—";
const writing = CALIBRATION_FIXTURES.filter((f) => resolveTask(f.task).section === "WRITING");
const speaking = CALIBRATION_FIXTURES.filter((f) => resolveTask(f.task).section === "SPEAKING");

describe("calibration tasks", () => {
  it("each names exactly one item of the starter bank", () => {
    for (const task of CALIBRATION_TASKS) expect(matchingSeedItems(task), task.id).toHaveLength(1);
  });

  it("has unique ids and covers every CEFR level in both sections", () => {
    expect(new Set(CALIBRATION_TASKS.map((t) => t.id)).size).toBe(CALIBRATION_TASKS.length);
    for (const section of ["WRITING", "SPEAKING"] as const) {
      const levels = new Set(CALIBRATION_TASKS.filter((t) => t.section === section).map((t) => t.level));
      expect([...levels].sort(), section).toEqual(["A1", "A2", "B1", "B2", "C1", ...(section === "WRITING" ? ["C2"] : [])]);
    }
  });

  it("resolves the length of a writing task and the recording time of a speaking task", () => {
    const w = resolveTask("w-b1-hanna");
    expect(w.minWords).toBe(70);
    expect(w.maxWords).toBe(110);
    expect(w.contentPoints.length).toBeGreaterThan(3);
    expect(resolveTask("s-b2-grossraum").answerSeconds).toBeGreaterThan(0);
  });
});

describe("calibration fixtures", () => {
  it("are at least 60, from at least 8 writing and 4 speaking tasks", () => {
    expect(CALIBRATION_FIXTURES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(writing.map((f) => f.task)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(speaking.map((f) => f.task)).size).toBeGreaterThanOrEqual(4);
  });

  it("have unique ids that start with their task id, and every task is used", () => {
    expect(new Set(CALIBRATION_FIXTURES.map((f) => f.id)).size).toBe(CALIBRATION_FIXTURES.length);
    for (const f of CALIBRATION_FIXTURES) expect(f.id.startsWith(`${f.task}/`), f.id).toBe(true);
    for (const task of CALIBRATION_TASKS) expect(CALIBRATION_FIXTURES.some((f) => f.task === task.id), task.id).toBe(true);
  });

  it("never expect a level above the cap of the task", () => {
    for (const f of CALIBRATION_FIXTURES) {
      const cap = shiftLevel(resolveTask(f.task).taskLevel, 1);
      expect(compareLevels(f.target, cap), f.id).toBeLessThanOrEqual(0);
    }
  });

  it("cover every result level, A0 many times", () => {
    for (const level of RESULT_LEVELS) expect(CALIBRATION_FIXTURES.some((f) => f.target === level), level).toBe(true);
    expect(CALIBRATION_FIXTURES.filter((f) => f.target === "A0").length).toBeGreaterThanOrEqual(12);
  });

  it("include every kind of trap, most of them more than once", () => {
    const traps = ["OFF_TOPIC_FLUENT", "MEMORISED_TEMPLATE", "LONG_ERRORS", "TASK_COPIED", "OVER_CAP"] as const;
    for (const trap of traps) expect(CALIBRATION_FIXTURES.filter((f) => f.trap === trap).length, trap).toBeGreaterThanOrEqual(2);
    expect(CALIBRATION_FIXTURES.filter((f) => f.trap === "SHORT_EXCELLENT").length).toBeGreaterThanOrEqual(1);
  });

  it("agree with their kind: A0 targets are kind A0 or a copied task, the others never A0", () => {
    for (const f of CALIBRATION_FIXTURES) {
      if (f.kind === "A0") expect(f.target, f.id).toBe("A0");
      if (f.target === "A0") expect(f.kind === "A0" || f.trap === "TASK_COPIED", f.id).toBe(true);
      if (f.kind === "TRAP") expect(f.trap, f.id).toBeDefined();
      if (f.kind !== "TRAP") expect(f.trap, f.id).toBeUndefined();
    }
  });

  it("give every speaking fixture a speech profile and no writing fixture one", () => {
    for (const f of speaking) expect(f.speech, f.id).toBeDefined();
    for (const f of writing) expect(f.speech, f.id).toBeUndefined();
  });

  it("have a justification, no em dash, and an answer unless the fixture is blank", () => {
    for (const f of CALIBRATION_FIXTURES) {
      expect(f.why.length, f.id).toBeGreaterThan(15);
      expect(f.text.includes(EM_DASH) || f.why.includes(EM_DASH), f.id).toBe(false);
      if (f.id !== "w-a1-tim/blank") expect(f.text.trim().length, f.id).toBeGreaterThan(0);
    }
  });

  it("ask for EMPTY exactly when no word was written", () => {
    for (const f of CALIBRATION_FIXTURES) {
      expect(f.flags.must.includes("EMPTY"), f.id).toBe(countWords(f.text) === 0);
    }
  });

  it("keep the stated length claims honest: long fixtures exceed the maximum, short ones fall below the minimum", () => {
    for (const f of writing) {
      const t = resolveTask(f.task);
      const words = countWords(f.text);
      if (f.trap === "LONG_ERRORS") expect(words, f.id).toBeGreaterThan(t.maxWords!);
      if (f.trap === "SHORT_EXCELLENT") expect(words, f.id).toBeLessThan(t.minWords!);
    }
  });

  it("ask for TOO_SHORT only where the answer is below half of the minimum", () => {
    for (const f of writing) {
      const t = resolveTask(f.task);
      if (f.flags.must.includes("TOO_SHORT")) expect(countWords(f.text), f.id).toBeLessThan(0.5 * t.minWords!);
    }
  });
});

describe("speech timing", () => {
  it("is deterministic and the same for the same fixture", () => {
    const a = timedWords("Ich heiße Ali. Ich wohne in Berlin.", "halting", "x");
    const b = timedWords("Ich heiße Ali. Ich wohne in Berlin.", "halting", "x");
    expect(a).toEqual(b);
    expect(transcriptWords("Ich heiße Ali. Ich wohne in Berlin.")).toEqual(["Ich", "heiße", "Ali", "Ich", "wohne", "in", "Berlin"]);
  });

  it("gives faster, smoother numbers to a more fluent profile", () => {
    const text = CALIBRATION_FIXTURES.find((f) => f.id === "s-b2-grossraum/c1")!.text;
    const halting = metricsFor(text, "halting", "p");
    const fluent = metricsFor(text, "fluent", "p");
    expect(fluent.wordsPerMinute).toBeGreaterThan(halting.wordsPerMinute);
    expect(fluent.longPauses).toBeLessThanOrEqual(halting.longPauses);
    expect(halting.longPauses).toBeGreaterThan(0);
    expect(fluent.wordCount).toBe(halting.wordCount);
  });

  it("covers the criteria a spoken answer is rated on", () => {
    expect(CRITERIA_BY_SECTION.SPEAKING).toContain("FLUENCY");
  });
});
