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
import { blindItems, parseArgs, parseLevel, type BlindItem } from "../src/db/seed-bank/blind-items";
import type { Cefr } from "../src/lib/exam/types";
import type { CandidateContent } from "../src/lib/exam/safe";
import { matchingTargets } from "../src/lib/exam/safe";

const args = parseArgs(process.argv.slice(2));

function picture(x: unknown): string {
  const o = x as { picture?: { alt?: string }; image?: { alt?: string }; alt?: string } | null;
  const alt = o?.picture?.alt ?? o?.image?.alt ?? o?.alt;
  return alt ? `[Bild: ${alt}] ` : "";
}

function renderSlots(item: BlindItem): { lines: string[]; template: string } {
  const c: CandidateContent = item.candidate.content;
  const lines: string[] = [];
  switch (c.kind) {
    case "CHOICE":
      for (const o of c.options) lines.push(`- (${o.id}) ${picture(o)}${o.text}`);
      return {
        lines,
        template: `${item.seedKey}: choice=${c.multiple ? "... (several ids, comma separated)" : "..."}`,
      };
    case "TFNG": {
      const raw = item.item.content;
      c.statements.forEach((s, i) => {
        const src = raw.kind === "TFNG" ? raw.statements[i] : null;
        lines.push(`${s.id}. ${picture(src)}${s.text}`);
      });
      lines.push(c.twoWay ? "Antwort je Aussage: R (richtig) oder F (falsch)." : "Antwort je Aussage: R (richtig), F (falsch) oder NG (nicht im Text).");
      return { lines, template: `${item.seedKey}: ${c.statements.map((s) => `${s.id}=...`).join(", ")}` };
    }
    case "GAP":
      for (const g of c.gaps) {
        const hint = g.choices ? ` Auswahl: ${g.choices.join(" | ")}` : "";
        lines.push(`- [${g.id}]${hint}`);
      }
      if (c.pool) lines.push(`Teile / Wörter zur Auswahl: ${c.pool.join(" | ")}`);
      if (c.attached) lines.push("Jede Lücke setzt das Wort davor fort: schreibe das ganze Wort.");
      return { lines, template: `${item.seedKey}: ${c.gaps.map((g) => `${g.id}=...`).join(", ")}` };
    case "MATCHING": {
      const rightRaw = item.item.content.kind === "MATCHING" ? item.item.content.right : [];
      for (const l of c.left) lines.push(`- ${l.id}: ${l.text}`);
      lines.push("Zuordnen zu:");
      for (const t of matchingTargets(rightRaw)) lines.push(`- ${t.badge}: ${t.label}`);
      return { lines, template: `${item.seedKey}: ${c.left.map((l) => `${l.id}=...`).join(", ")}` };
    }
    default:
      return { lines, template: `${item.seedKey}: ...` };
  }
}

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
