/**
 * Compares a filled blind-solve file with the bank's keys, using the engine's
 * own scoring. A report only: it always exits 0.
 *
 *   pnpm bank:blind-compare --level b1 --answers <file>
 *   pnpm bank:blind-compare --course B1.1:A --answers <file>
 *   pnpm bank:blind-compare --course all --answers <file or folder>
 *
 * `--course <key>:<form>` compares against a course test form (spec 2026-10-28)
 * of the seed, item by item and, per section, in scored units (a gap, a
 * statement or a row is a unit, as in the test's points). `--course all`
 * compares every form; `--answers` may then be a folder, and every .md file in
 * it is read, so one file per form (as `pnpm bank:blind-export --course all`
 * writes them) can be compared in one run.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { SEED_BANK } from "../src/db/seed-bank";
import { parseAnswerFile } from "../src/db/seed-bank/blind-answers";
import { courseComparison } from "../src/db/seed-bank/blind-course";
import { blindItems, parseArgs, parseLevel } from "../src/db/seed-bank/blind-items";
import { compareBlind } from "../src/db/seed-bank/blind-report";
import { COURSE_FORMS_SEED } from "../src/db/seed-bank/course-tests";

const args = parseArgs(process.argv.slice(2));
if (!args.answers) throw new Error("--answers <file> is required");

/** One file, or every .md file of a folder in name order. */
function readAnswers(target: string): string {
  if (!statSync(target).isDirectory()) return readFileSync(target, "utf8");
  return readdirSync(target)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => readFileSync(path.join(target, f), "utf8"))
    .join("\n");
}

const raw = parseAnswerFile(readAnswers(args.answers));

if (args.course !== undefined) {
  if (args.level !== undefined) throw new Error("--level belongs to the bank's comparison, not to --course");
  for (const line of courseComparison(args.course, COURSE_FORMS_SEED, raw)) console.log(line);
} else {
  const level = parseLevel(args.level);
  const items = blindItems(SEED_BANK, level);
  const r = compareBlind(items, raw);
  for (const line of r.lines) console.log(line);
  for (const k of r.unknown) console.log(`UNKNOWN KEY in answers file (not an objective ${level} item): ${k}`);
  console.log(`\n${items.length} items: ${r.agree} agree, ${r.disagree} disagree, ${r.unanswered} unanswered`);
}
