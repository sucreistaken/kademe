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
