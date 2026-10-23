/**
 * Writes a Markdown file a solver can answer WITHOUT the keys: every objective
 * item (grammar, reading, listening) of one level as the candidate sees it,
 * plus the reading passage or the listening script, and an answer template.
 *
 *   pnpm bank:blind-export --level b1 [--only-new-since <keys.json>] [--out <file>] [--write-keys <keys.json>]
 *
 * "New" items: `--write-keys` saves the seed keys of the whole bank as a JSON
 * list (do it before authoring starts). `--only-new-since` then exports only
 * items whose seed key is not in that list. A seed key is a hash of the item's
 * text and content, so an edited item counts as new. This is simpler and
 * sturdier than loading an old bank from a git ref.
 *
 * The solver fills the template lines and the file goes to `pnpm bank:blind-compare`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SEED_BANK } from "../src/db/seed-bank";
import { blindItems, parseArgs, parseLevel, renderSlots, type BlindItem } from "../src/db/seed-bank/blind-items";
import type { Cefr } from "../src/lib/exam/types";

const args = parseArgs(process.argv.slice(2));

function render(level: Cefr, items: BlindItem[]): string {
  const out: string[] = [
    `# Blind solve: ${level}`,
    "",
    "Answer every item below without any key. Fill the answer template block of each item (replace `...`), keep the line format, and save the file.",
    "",
  ];
  const shown = new Set<string>();
  let n = 0;
  for (const it of items) {
    n++;
    const st = it.stimulus;
    out.push(`## ${n}. ${it.item.section}`, "");
    if (st) {
      if (!shown.has(st.key)) {
        shown.add(st.key);
        out.push(st.section === "LISTENING" ? `### Hörtext (Skript): ${st.title}` : `### Text: ${st.title}`, "", st.body.trim(), "");
      } else {
        out.push(`(${st.section === "LISTENING" ? "Hörtext" : "Text"} wie oben: ${st.title})`, "");
      }
    }
    out.push(`**Aufgabe:** ${it.candidate.prompt.replace(/\{\{\s*([^}\s]+)\s*\}\}/gu, "[$1]")}`, "");
    const { lines, template } = renderSlots(it);
    if (lines.length) out.push(...lines, "");
    out.push("```", template, "```", "");
  }
  return out.join("\n");
}

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
writeFileSync(outFile, render(level, items));
console.log(`${items.length} objective ${level} items written to ${outFile}`);
