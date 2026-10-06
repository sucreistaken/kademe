import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Core files that still import the exam engine directly. The list may only
 * shrink: a new core-to-exam import fails this test, and removing a coupling
 * means deleting its line here. ESLint guards @/solutions; this guards the exam
 * modules that predate it (they live in src/lib and src/server).
 *
 * Exam modules: @/lib/exam-flow, @/lib/exam-results, @/lib/exam-candidate-api,
 * @/lib/exam/*, @/server/{panel,invite,simulate,bank-import,bank-topup,item-generation-job}.
 * The codebase imports them only through the @/ alias.
 */
const KNOWN_COUPLINGS = [
  "src/app/a/[token]/done/page.tsx",
  "src/app/a/[token]/shared.tsx",
  "src/app/api/cron/grade/route.ts",
  "src/components/candidate/Finished.tsx",
  "src/components/candidate/InfoForm.tsx",
  "src/components/candidate/IntroConsent.tsx",
  "src/components/candidate/proctor/SystemCheck.tsx",
  "src/lib/candidate-routes.ts",
  "src/lib/close-expired.ts",
  "src/lib/transcribe-job.ts",
  "src/server/proctor-review-job.ts",
];

const EXEMPT = [
  /^src\/solutions\//,
  /^src\/app\/.*\/exam\//,
  /^src\/app\/.*\/hiring\//,
  /^src\/components\/hiring\//,
  /^src\/components\/panel\//,
  /^src\/components\/candidate\/exam\//,
  /^src\/lib\/exam\//,
  /^src\/lib\/(exam-flow|exam-results|exam-candidate-api)\.ts$/,
  /^src\/server\/(panel|invite|simulate|bank-import|bank-topup|item-generation-job)\.ts$/,
  /^src\/db\//,
  /\.test\.tsx?$/,
];
const EXAM_IMPORT = [
  /["']@\/lib\/(?:exam-flow|exam-results|exam-candidate-api|exam\/)/,
  /["']@\/server\/(?:panel|invite|simulate|bank-import|item-generation-job)["']/,
];

/** Relative paths reach the same modules as the alias: `../../lib/exam-flow` is `@/lib/exam-flow`. */
const EXAM_RELATIVE = [
  /["']\.{1,2}\/(?:[^"']*\/)?(?:exam-flow|exam-results|exam-candidate-api)["']/,
  /["']\.{1,2}\/(?:[^"']*\/)?lib\/exam\//,
  /["']\.{1,2}\/(?:[^"']*\/)?server\/(?:panel|invite|simulate|bank-import|item-generation-job)["']/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx|mts)$/.test(name) ? [full] : [];
  });
}

describe("core to exam imports", () => {
  it("only the known couplings remain", () => {
    const root = process.cwd();
    const offenders = files(path.join(root, "src"))
      .map((f) => path.relative(root, f).split(path.sep).join("/"))
      .filter((f) => !EXEMPT.some((re) => re.test(f)))
      .filter((f) => {
        const text = readFileSync(path.join(root, f), "utf8");
        return [...EXAM_IMPORT, ...EXAM_RELATIVE].some((re) => re.test(text));
      })
      .sort();
    expect(offenders).toEqual([...KNOWN_COUPLINGS].sort());
  });
});

/** A solution never imports another solution (spec 2: each one is a folder on the core). */
const HIRING_CODE = [/^src\/solutions\/hiring\//, /^src\/app\/.*\/hiring\//, /^src\/components\/hiring\//];
const OTHER_SOLUTION = [
  ...EXAM_IMPORT,
  ...EXAM_RELATIVE,
  /["']@\/solutions\/language-exam/,
  /["'](?:\.\.?\/)+(?:solutions\/)?language-exam/,
  /["']@\/components\/panel\//,
  /["']@\/components\/candidate\/exam\//,
];

/** ...and the exam never imports hiring. */
const EXAM_CODE = [/^src\/solutions\/language-exam\//, /^src\/app\/.*\/exam\//, /^src\/components\/panel\//, /^src\/components\/candidate\/exam\//];
const HIRING_IMPORT = [
  /["']@\/solutions\/hiring/,
  /["']@\/components\/hiring\//,
  /["']\.{1,2}\/(?:[^"']*\/)?hiring(?:\/[^"']*)?["']/,
];

function offendersIn(codePatterns: RegExp[], importPatterns: RegExp[]): { scanned: number; offenders: string[] } {
  const root = process.cwd();
  const scanned = files(path.join(root, "src"))
    .map((f) => path.relative(root, f).split(path.sep).join("/"))
    .filter((f) => codePatterns.some((re) => re.test(f)));
  return { scanned: scanned.length, offenders: scanned.filter((f) => importPatterns.some((re) => re.test(readFileSync(path.join(root, f), "utf8")))) };
}

describe("solutions do not import each other", () => {
  it("the pattern list recognises an exam import", () => {
    expect(OTHER_SOLUTION.some((re) => re.test('import { loadState } from "@/lib/exam-flow";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { PageHead } from "@/components/panel/bits";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { today } from "../../language-exam/today";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { loadState } from "../../../lib/exam-flow";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { grade } from "../../lib/exam/grading";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { createInvitation } from "../../server/invite";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { gate } from "./rules/gate";'))).toBe(false);
  });

  it("hiring code never imports the exam", () => {
    const { scanned, offenders } = offendersIn(HIRING_CODE, OTHER_SOLUTION);
    expect(scanned).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("the pattern list recognises a hiring import", () => {
    expect(HIRING_IMPORT.some((re) => re.test('import { x } from "@/solutions/hiring/rules/gate";'))).toBe(true);
    expect(HIRING_IMPORT.some((re) => re.test('import { x } from "@/components/hiring/Card";'))).toBe(true);
    expect(HIRING_IMPORT.some((re) => re.test('import { x } from "../../hiring/rules/gate";'))).toBe(true);
    expect(HIRING_IMPORT.some((re) => re.test('import { x } from "../../../solutions/hiring/rules/gate";'))).toBe(true);
    expect(HIRING_IMPORT.some((re) => re.test('import { x } from "@/lib/exam-flow";'))).toBe(false);
  });

  it("exam code never imports hiring", () => {
    const { scanned, offenders } = offendersIn(EXAM_CODE, HIRING_IMPORT);
    expect(scanned).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
