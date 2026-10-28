/**
 * Adds the listening scripts the lock does not know yet to
 * src/db/seed-bank/listening-scripts.lock.json. Never changes an entry: a
 * locked script that changed needs a new stimulus key instead.
 *
 * Covers the bank's clips and the clips of the course test forms (under their
 * form-prefixed seed key, e.g. "course-b1-1-a-..."), the keys their database
 * rows have.
 *
 * Run with: pnpm bank:lock-listening
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SEED_BANK } from "../src/db/seed-bank";
import { COURSE_FORMS_SEED } from "../src/db/seed-bank/course-tests";
import { listeningScripts } from "../src/db/seed-bank/listening-lock";

const path = "src/db/seed-bank/listening-scripts.lock.json";
const lock: Record<string, string> = JSON.parse(readFileSync(path, "utf8"));
let added = 0;
for (const s of listeningScripts(SEED_BANK, COURSE_FORMS_SEED)) {
  if (lock[s.key]) continue;
  lock[s.key] = s.hash;
  added++;
}
const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`added ${added}, ${Object.keys(sorted).length} scripts locked`);
