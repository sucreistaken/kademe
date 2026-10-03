/**
 * Prints every CSS declaration the production build ships, one per line, as
 * "at-rule > selector | property: value", sorted and de-duplicated.
 *
 * Two runs, before and after a styling change, compared with `comm`, show
 * exactly which declarations were removed or changed. That is how this repo
 * checks "existing screens look the same" without trusting eyes alone.
 *
 *   pnpm build && node scripts/css-decls.mjs > ~/kademe-ui-baseline/after.txt
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve("package.json"));
// postcss is not hoisted to the root; borrow the copy Tailwind's plugin uses.
const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith(".css") ? [full] : [];
  });
}

const files = cssFiles(path.resolve(".next/static"));
if (files.length === 0) {
  console.error("No CSS under .next/static. Run pnpm build first.");
  process.exit(1);
}
const lines = new Set();
for (const file of files) {
  postcss.parse(readFileSync(file, "utf8")).walkDecls((decl) => {
    const chain = [];
    for (let node = decl.parent; node && node.type !== "root"; node = node.parent) {
      chain.unshift(node.type === "rule" ? node.selector : `@${node.name} ${node.params}`);
    }
    lines.add(`${chain.join(" > ")} | ${decl.prop}: ${decl.value}${decl.important ? " !important" : ""}`);
  });
}
process.stdout.write([...lines].sort().join("\n") + "\n");
