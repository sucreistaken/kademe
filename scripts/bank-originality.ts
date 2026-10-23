/**
 * Offline originality check: no bank string may share an 8-word shingle with
 * the real exam books. Prints every hit (seed key / level / section, the 8
 * matched words, the source file name) and exits 1 if there is any.
 *
 *   pnpm bank:originality [--level b1] [--sources <dir>]
 *
 * The sources live outside the repo (default ~/Desktop/Projects/kademe-kaynaklar/text)
 * and are never written anywhere; only the 8 matched words are printed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SEED_BANK } from "../src/db/seed-bank";
import { addSource, findHits, itemStrings, stimulusStrings, type SeedString, type SourceIndex } from "../src/db/seed-bank/originality";
import { seedItemKey } from "../src/db/seed-bank/seed-key";
import { parseArgs } from "../src/db/seed-bank/blind-items";

const args = parseArgs(process.argv.slice(2));
const dir = args.sources ?? join(homedir(), "Desktop/Projects/kademe-kaynaklar/text");
const only = args.level?.toUpperCase();

const started = Date.now();
const index: SourceIndex = new Map();
const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt"));
if (files.length === 0) throw new Error(`no .txt sources in ${dir}`);
for (const f of files) addSource(index, f, readFileSync(join(dir, f), "utf8"));

const strings: SeedString[] = [];
for (const s of SEED_BANK.stimuli) if (!only || s.level === only) strings.push(...stimulusStrings(s));
for (const it of SEED_BANK.items) if (!only || it.level === only) strings.push(...itemStrings(it, seedItemKey(it)));

let hitStrings = 0;
for (const s of strings) {
  const hits = findHits(s.text, index);
  if (hits.length === 0) continue;
  hitStrings++;
  console.log(`HIT ${s.level} ${s.section} ${s.where}: ${hits.length} shingle(s)`);
  for (const h of hits.slice(0, 5)) console.log(`    "${h.shingle}"  <- ${h.source}`);
}
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${files.length} sources, ${index.size} shingles; ${strings.length} bank strings checked${only ? ` (${only})` : ""}, ${hitStrings} with hits, ${secs}s`);
process.exit(hitStrings > 0 ? 1 : 0);
