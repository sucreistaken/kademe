/**
 * Writes a Markdown file a solver can answer WITHOUT the keys: every objective
 * item (grammar, reading, listening) of one level as the candidate sees it,
 * plus the reading passage or the listening script, and an answer template.
 *
 *   pnpm bank:blind-export --level b1 [--only-new-since <keys.json>] [--out <file>] [--write-keys <keys.json>]
 *   pnpm bank:blind-export --course B1.1:A [--out <file>]
 *   pnpm bank:blind-export --course all [--out-dir <dir>]
 *
 * "New" items: `--write-keys` saves the seed keys of the whole bank as a JSON
 * list (do it before authoring starts). `--only-new-since` then exports only
 * items whose seed key is not in that list. A seed key is a hash of the item's
 * text and content, so an edited item counts as new. This is simpler and
 * sturdier than loading an old bank from a git ref.
 *
 * `--course <key>:<form>` exports one course test form (spec 2026-10-28)
 * straight from the seed, no database: its objective items in the order the
 * students are served them (Lesen, Sprachbausteine, Hören), under the seed
 * keys their database rows have. `--course all` writes one file per form into
 * `--out-dir` (default: the current directory). The files are named
 * blind-course-<key>-<form>.md, e.g. blind-course-b1-1-a.md.
 *
 * The solver fills the template lines and the file goes to `pnpm bank:blind-compare`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SEED_BANK } from "../src/db/seed-bank";
import { courseExports, NO_COURSE_FORMS } from "../src/db/seed-bank/blind-course";
import { blindItems, parseArgs, parseLevel } from "../src/db/seed-bank/blind-items";
import { renderBlindFile } from "../src/db/seed-bank/blind-report";
import { COURSE_FORMS_SEED } from "../src/db/seed-bank/course-tests";
import type { Cefr } from "../src/lib/exam/types";

const args = parseArgs(process.argv.slice(2));

function exportCourse() {
  for (const flag of ["level", "only-new-since", "write-keys"]) {
    if (args[flag] !== undefined) throw new Error(`--${flag} belongs to the bank's export (--level), not to --course`);
  }
  const files = courseExports(args.course, COURSE_FORMS_SEED, { out: args.out, outDir: args["out-dir"] });
  if (files.length === 0) console.log(`${NO_COURSE_FORMS} Nothing to export.`);
  for (const f of files) {
    mkdirSync(path.dirname(f.file), { recursive: true });
    writeFileSync(f.file, f.text);
    console.log(`${f.items} objective items of ${f.formKey} written to ${f.file}`);
  }
}

function exportBank() {
  const level = parseLevel(args.level);

  if (args["write-keys"]) {
    const all = (["A1", "A2", "B1", "B2", "C1", "C2"] as Cefr[]).flatMap((l) => blindItems(SEED_BANK, l).map((i) => i.seedKey));
    writeFileSync(args["write-keys"], `${JSON.stringify(all.sort(), null, 2)}\n`);
    console.log(`wrote ${all.length} seed keys to ${args["write-keys"]}`);
  }

  let items = blindItems(SEED_BANK, level);
  const since = args["only-new-since"];
  if (since) {
    if (!existsSync(since)) throw new Error(`--only-new-since expects a keys file written by --write-keys, not found: ${since}`);
    const old = new Set<string>(JSON.parse(readFileSync(since, "utf8")));
    items = items.filter((i) => !old.has(i.seedKey));
  }
  const outFile = args.out ?? `blind-${level.toLowerCase()}.md`;
  writeFileSync(outFile, renderBlindFile(`Blind solve: ${level}`, items));
  console.log(`${items.length} objective ${level} items written to ${outFile}`);
}

if (args.course !== undefined) exportCourse();
else exportBank();
