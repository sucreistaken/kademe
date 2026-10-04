import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NORMALIZED_HOOKS, SHADCN_PATTERNS, isKademeOwned, normalizeShadcnSource } from "@/lib/shadcn-normalize";

const UI = path.resolve(process.cwd(), "src/components/ui");
const HOOKS = path.resolve(process.cwd(), "src/hooks");
const EXPECTED = [
  "input", "textarea", "label", "select", "checkbox", "radio-group", "switch", "tabs", "dialog", "sheet",
  "dropdown-menu", "popover", "tooltip", "table", "separator", "skeleton", "sidebar", "command",
  "collapsible", "field", "empty", "spinner", "kbd", "input-group",
];
const read = (file: string) => readFileSync(path.join(UI, file), "utf8");
const vendored = readdirSync(UI).filter((f) => f.endsWith(".tsx") && !isKademeOwned(f, read(f)));

describe("copied shadcn components", () => {
  it.each(EXPECTED)("%s is present", (name) => {
    expect(existsSync(path.join(UI, `${name}.tsx`))).toBe(true);
  });

  it.each(["badge", "alert-dialog", "chart", "toast", "sonner"])("%s is banned and absent", (name) => {
    expect(existsSync(path.join(UI, `${name}.tsx`))).toBe(false);
  });

  it("are normalized", () => {
    for (const file of vendored) {
      const src = read(file);
      expect(src, file).not.toMatch(/from "cn"/);
      expect(src, file).not.toMatch(new RegExp(SHADCN_PATTERNS.accent));
      expect(src, file).not.toMatch(new RegExp(SHADCN_PATTERNS.accentForeground));
      expect(src, file).not.toMatch(new RegExp(SHADCN_PATTERNS.mutedSurface));
      // Standalone shadow-* only: drop-shadow-*, inset-shadow-* and text-shadow-* are not rewritten.
      expect(src, file).not.toMatch(new RegExp(SHADCN_PATTERNS.overlayShadow));
      expect(src, file).not.toMatch(new RegExp(SHADCN_PATTERNS.smallShadow));
      // The global :focus-visible outline is the only focus indicator.
      expect(src, file).not.toMatch(new RegExp(SHADCN_PATTERNS.focusRing));
      // Catch-all: running the normalizer again would change nothing.
      expect(normalizeShadcnSource(src), file).toBe(src);
    }
  });

  it.each(NORMALIZED_HOOKS)("hook %s is normalized", (hook) => {
    const src = readFileSync(path.join(HOOKS, hook), "utf8");
    expect(normalizeShadcnSource(src)).toBe(src);
  });

  it("the cn package is not a dependency", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(pkg.dependencies?.cn).toBeUndefined();
  });
});
