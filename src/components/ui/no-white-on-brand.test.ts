import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Every .tsx file under src. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

describe("white text never sits on the brand cyan (2.2:1)", () => {
  it("no class string combines bg-brand with text-white", () => {
    const offenders = files(path.resolve(process.cwd(), "src")).filter((f) => {
      const src = readFileSync(f, "utf8");
      return [...src.matchAll(/"[^"]*\bbg-brand\b[^"]*"/g)].some((m) => /\btext-white\b/.test(m[0]));
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * The string literals inside the className attribute of every <button>, <a>
 * and <Link> opening tag. The opening tag is walked with a small brace/quote
 * tracker so `=>` inside a handler does not end it early and a ternary inside
 * className={...} yields each branch as its own literal. A multiline
 * className={cn(...)} is read too; a class string kept in a const is not.
 */
function actionClassLiterals(src: string): string[] {
  const literals: string[] = [];
  for (const open of src.matchAll(/<(?:button|a|Link)\b/g)) {
    let depth = 0;
    let inClass = false;
    for (let i = open.index + open[0].length; i < src.length; i++) {
      const ch = src[i];
      if (depth === 0 && !inClass && src.startsWith("className=", i)) {
        inClass = true;
        i += "className=".length - 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        const end = src.indexOf(ch, i + 1);
        if (end === -1) break;
        if (inClass) literals.push(src.slice(i + 1, end));
        i = end;
        if (inClass && depth === 0) inClass = false;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) inClass = false;
      } else if (ch === ">" && depth === 0) break;
    }
  }
  return literals;
}

/**
 * Buttons that only show a chosen state, not an action. A chosen radio drawn as
 * a <button> stays the dark cyan with white text (5.8:1); it is not a primary
 * action. Each entry names the file, the exact class literal and how many
 * buttons use it, so a new action with the same classes still fails the scan.
 */
const STATE_TOGGLES = [
  {
    file: "src/components/candidate/exam/ItemView.tsx",
    classes: "border-accent bg-accent text-white",
    uses: 2, // the chosen True/False/Not given radio, and the chosen matching letter
    why: "a chosen answer in a role=radio group, not an action",
  },
];

describe("filled actions use the brand primary, not a hand-rolled dark fill", () => {
  it("no button or link class string combines bg-accent with text-white", () => {
    const offenders: string[] = [];
    for (const f of files(path.resolve(process.cwd(), "src"))) {
      const rel = path.relative(process.cwd(), f);
      const hits = actionClassLiterals(readFileSync(f, "utf8")).filter((c) => /\bbg-accent\b/.test(c) && /\btext-white\b/.test(c));
      for (const classes of new Set(hits)) {
        const count = hits.filter((h) => h === classes).length;
        const allowed = STATE_TOGGLES.find((a) => a.file === rel && a.classes === classes);
        if (!allowed || count > allowed.uses) offenders.push(`${rel}: ${classes}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every allow-list entry still matches a real button (no stale entries)", () => {
    for (const a of STATE_TOGGLES) {
      const hits = actionClassLiterals(readFileSync(path.resolve(process.cwd(), a.file), "utf8")).filter((c) => c === a.classes);
      expect(hits, a.why).toHaveLength(a.uses);
    }
  });
});
