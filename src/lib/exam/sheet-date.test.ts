import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { examDateOf, studentSheetDate } from "./sheet-date";

const finalized = new Date("2026-10-20T09:00:00Z");
const completed = new Date("2026-10-18T14:30:00Z");
const started = new Date("2026-10-18T13:00:00Z");

describe("studentSheetDate", () => {
  it("is the day the teacher finalized the result", () => {
    expect(studentSheetDate({ finalizedAt: finalized, examDate: completed })).toBe(finalized);
  });

  it("falls back to the exam day, then to nothing", () => {
    expect(studentSheetDate({ finalizedAt: null, examDate: completed })).toBe(completed);
    expect(studentSheetDate({})).toBeNull();
  });

  it("takes the exam day from the finish, else the start", () => {
    expect(examDateOf({ completedAt: completed, startedAt: started })).toBe(completed);
    expect(examDateOf({ completedAt: null, startedAt: started })).toBe(started);
    expect(examDateOf({})).toBeNull();
  });
});

describe("the student print page and the panel's student copy print the same date", () => {
  const root = process.cwd();
  const print = readFileSync(path.join(root, "src/app/a/[token]/done/print/page.tsx"), "utf8");
  const panel = readFileSync(path.join(root, "src/app/(manager)/exam/students/[id]/report/page.tsx"), "utf8");
  const flow = readFileSync(path.join(root, "src/lib/exam-flow.ts"), "utf8");

  it("the print page never prints today's date", () => {
    expect(print).not.toContain("new Date()");
    expect(print).toContain("finishedSheetDate(ctx)");
  });

  it("both go through studentSheetDate with the finalized day and the exam day", () => {
    expect(panel).toContain("studentSheetDate({ finalizedAt: built.model.finalizedAt, examDate: built.model.examDate })");
    expect(panel).toContain("examDate: examDateOf(attempt)");
    expect(flow).toContain("studentSheetDate({ finalizedAt: result?.finalizedAt, examDate: examDateOf(attempt) })");
  });
});
