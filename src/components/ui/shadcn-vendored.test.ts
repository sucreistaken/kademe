import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const UI = path.resolve(process.cwd(), "src/components/ui");
const KADEME_OWNED = new Set(["button.tsx", "card.tsx", "status-dot.tsx", "undo-strip.tsx", "inline-link.tsx", "avatar.tsx"]);
const EXPECTED = [
  "input", "textarea", "label", "select", "checkbox", "radio-group", "switch", "tabs", "dialog", "sheet",
  "dropdown-menu", "popover", "tooltip", "table", "separator", "skeleton", "sidebar", "command",
  "collapsible", "field", "empty", "spinner", "kbd", "input-group",
];
const vendored = readdirSync(UI).filter((f) => f.endsWith(".tsx") && !KADEME_OWNED.has(f));
const BORDER = "border(?:-[xytrblse])?";
const UTILITY = `(bg|text|${BORDER}|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)`;
const SURFACE_UTILITY = `(bg|${BORDER}|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)`;

describe("copied shadcn components", () => {
  it.each(EXPECTED)("%s is present", (name) => {
    expect(existsSync(path.join(UI, `${name}.tsx`))).toBe(true);
  });

  it.each(["badge", "alert-dialog", "chart", "toast", "sonner"])("%s is banned and absent", (name) => {
    expect(existsSync(path.join(UI, `${name}.tsx`))).toBe(false);
  });

  it("are normalized", () => {
    for (const file of vendored) {
      const src = readFileSync(path.join(UI, file), "utf8");
      expect(src, file).not.toMatch(/from "cn"/);
      expect(src, file).not.toMatch(new RegExp(`\\b${UTILITY}-accent(?![\\w-])`));
      expect(src, file).not.toMatch(new RegExp(`\\b${UTILITY}-accent-foreground\\b`));
      expect(src, file).not.toMatch(new RegExp(`\\b${SURFACE_UTILITY}-muted(?![\\w-])`));
      // Standalone shadow-* only: drop-shadow-*, inset-shadow-* and text-shadow-* are not rewritten.
      expect(src, file).not.toMatch(/(?<![\w-])shadow-(xs|sm|md|lg|xl|2xl)\b/);
    }
  });

  it("the cn package is not a dependency", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(pkg.dependencies?.cn).toBeUndefined();
  });
});
