/**
 * Applies normalizeShadcnSource to every shadcn component on disk. The six
 * Kademe primitives are hand-maintained and skipped.
 *
 *   pnpm exec shadcn add <names> --yes && pnpm ui:normalize
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeShadcnSource } from "../src/lib/shadcn-normalize";

const KADEME_OWNED = new Set(["button.tsx", "card.tsx", "status-dot.tsx", "undo-strip.tsx", "inline-link.tsx", "avatar.tsx"]);
const targets = [
  ...readdirSync("src/components/ui")
    .filter((f) => f.endsWith(".tsx") && !KADEME_OWNED.has(f))
    .map((f) => path.join("src/components/ui", f)),
  ...(() => {
    try {
      return readdirSync("src/hooks").filter((f) => f.endsWith(".ts")).map((f) => path.join("src/hooks", f));
    } catch {
      return [];
    }
  })(),
];
let changed = 0;
for (const file of targets) {
  const before = readFileSync(file, "utf8");
  const after = normalizeShadcnSource(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
    console.log(`normalized ${file}`);
  }
}
console.log(`${changed} of ${targets.length} file(s) changed`);
