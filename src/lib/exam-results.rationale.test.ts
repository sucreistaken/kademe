import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * exam-results.ts reads the database, so it is not imported here. What these checks guard is a
 * line of source: every NEW grading (the model's and the empty-answer rule's) is written in
 * German, whatever language the student sat the exam in. It used to follow the student's
 * language (Turkish or English), which put Turkish text on the German report.
 */
const source = readFileSync(path.resolve(process.cwd(), "src/lib/exam-results.ts"), "utf8");

describe("the language of a new grading's notes", () => {
  it("is the default rationale locale, not derived from the student's locale", () => {
    expect(source).toContain("DEFAULT_RATIONALE_LOCALE");
    expect(source).not.toContain("panelLocaleOf");
    expect(source).not.toContain("contentLocale");
    expect(source).not.toMatch(/rationaleLocale\s*=\s*"(tr|en)"/);
  });

  it("is stored on the proposal, so the German report can tell a German note from an older one", () => {
    expect(source).toMatch(/aiProposal:\s*\{\s*\.\.\.proposal,\s*rationaleLocale\s*\}/);
  });

  it("covers the rule proposal for an empty answer too", () => {
    expect(source).toMatch(/ruleProposal\([^)]*\{ reason: "EMPTY", flags: \["EMPTY"\] \}, DEFAULT_RATIONALE_LOCALE\)/);
  });
});
