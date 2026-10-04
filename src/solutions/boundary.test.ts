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
  "src/app/(manager)/dashboard/page.tsx",
  "src/app/a/[token]/done/page.tsx",
  "src/app/a/[token]/shared.tsx",
  "src/app/api/c/[token]/consent/route.ts",
  "src/app/api/c/[token]/device-check/route.ts",
  "src/app/api/c/[token]/heartbeat/route.ts",
  "src/app/api/c/[token]/info/route.ts",
  "src/app/api/c/[token]/media/complete/route.ts",
  "src/app/api/c/[token]/problem/route.ts",
  "src/app/api/c/[token]/proctor/events/route.ts",
  "src/app/api/c/[token]/proctor/evidence/route.ts",
  "src/app/api/c/[token]/proctor/heartbeat/route.ts",
  "src/app/api/c/[token]/proctor/session/route.ts",
  "src/app/api/c/[token]/state/route.ts",
  "src/app/api/cron/grade/route.ts",
  "src/components/candidate/Finished.tsx",
  "src/components/candidate/InfoForm.tsx",
  "src/components/candidate/IntroConsent.tsx",
  "src/components/candidate/proctor/SystemCheck.tsx",
  "src/lib/candidate-routes.ts",
  "src/lib/close-expired.ts",
  "src/lib/transcribe-job.ts",
  "src/server/proctor-review-job.ts",
  "src/server/proctoring.ts",
];

const EXEMPT = [
  /^src\/solutions\//,
  /^src\/app\/.*\/exam\//,
  /^src\/app\/\(manager\)\/(students|exams|bank)\//,
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
