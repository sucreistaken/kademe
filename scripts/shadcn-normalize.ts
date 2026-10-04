/**
 * Applies normalizeShadcnSource to every shadcn component on disk and to the
 * hooks the CLI copied. Kademe files are skipped: the six primitives listed in
 * KADEME_OWNED and any file whose first line is `// kademe-owned`.
 *
 *   yes n | pnpm exec shadcn add <names> && pnpm ui:normalize
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NORMALIZED_HOOKS, isKademeOwned, normalizeShadcnSource } from "../src/lib/shadcn-normalize";

const UI = "src/components/ui";
const HOOKS = "src/hooks";

const targets = [
  ...readdirSync(UI)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join(UI, f)),
  ...NORMALIZED_HOOKS.map((f) => path.join(HOOKS, f)).filter((f) => existsSync(f)),
];

let changed = 0;
let skipped = 0;
for (const file of targets) {
  const before = readFileSync(file, "utf8");
  if (isKademeOwned(path.basename(file), before)) {
    skipped += 1;
    continue;
  }
  const after = normalizeShadcnSource(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
    console.log(`normalized ${file}`);
  }
}
console.log(`${changed} of ${targets.length - skipped} file(s) changed (${skipped} Kademe-owned skipped)`);
