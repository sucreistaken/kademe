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
 * @/lib/exam/*, @/server/{panel,invite,simulate,bank-import,item-generation-job}.
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
  /^src\/server\/(panel|invite|simulate|bank-import|item-generation-job)\.ts$/,
  /^src\/db\//,
  /\.test\.tsx?$/,
];
const EXAM_IMPORT = [
  /["']@\/lib\/(?:exam-flow|exam-results|exam-candidate-api|exam\/)/,
  /["']@\/server\/(?:panel|invite|simulate|bank-import|item-generation-job)["']/,
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
        return EXAM_IMPORT.some((re) => re.test(text));
      })
      .sort();
    expect(offenders).toEqual([...KNOWN_COUPLINGS].sort());
  });
});

/** A solution never imports another solution (spec 2: each one is a folder on the core). */
const HIRING_CODE = [/^src\/solutions\/hiring\//, /^src\/app\/.*\/hiring\//, /^src\/components\/hiring\//];
const OTHER_SOLUTION = [
  ...EXAM_IMPORT,
  /["']@\/solutions\/language-exam/,
  /["'](?:\.\.?\/)+(?:solutions\/)?language-exam/,
  /["']@\/components\/panel\//,
  /["']@\/components\/candidate\/exam\//,
];

describe("solutions do not import each other", () => {
  it("the pattern list recognises an exam import", () => {
    expect(OTHER_SOLUTION.some((re) => re.test('import { loadState } from "@/lib/exam-flow";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { PageHead } from "@/components/panel/bits";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { today } from "../../language-exam/today";'))).toBe(true);
    expect(OTHER_SOLUTION.some((re) => re.test('import { gate } from "./rules/gate";'))).toBe(false);
  });

  it("hiring code never imports the exam", () => {
    const root = process.cwd();
    const hiring = files(path.join(root, "src"))
      .map((f) => path.relative(root, f).split(path.sep).join("/"))
      .filter((f) => HIRING_CODE.some((re) => re.test(f)));
    expect(hiring.length).toBeGreaterThan(0);
    const offenders = hiring.filter((f) => OTHER_SOLUTION.some((re) => re.test(readFileSync(path.join(root, f), "utf8"))));
    expect(offenders).toEqual([]);
  });
});
