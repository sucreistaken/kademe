/**
 * Adds the listening scripts the lock does not know yet to
 * src/db/seed-bank/listening-scripts.lock.json. Never changes an entry: a
 * locked script that changed needs a new stimulus key instead.
 *
 * Run with: pnpm bank:lock-listening
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SEED_BANK } from "../src/db/seed-bank";
import { listeningScriptHash } from "../src/db/seed-bank/listening-lock";

const path = "src/db/seed-bank/listening-scripts.lock.json";
const lock: Record<string, string> = JSON.parse(readFileSync(path, "utf8"));
let added = 0;
for (const s of SEED_BANK.stimuli.filter((x) => x.section === "LISTENING")) {
  if (lock[s.key]) continue;
  lock[s.key] = listeningScriptHash(s);
  added++;
}
const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`added ${added}, ${Object.keys(sorted).length} scripts locked`);
