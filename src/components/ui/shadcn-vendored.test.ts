import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Input } from "./input";
import { InputGroup, InputGroupButton } from "./input-group";
import { SelectTrigger } from "./select";
import { TableCell, TableRow } from "./table";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = React.ReactElement<Record<string, any>>;
/** The classes a component renders, read off the element it returns. */
function classesOf<P>(component: (props: P) => React.ReactNode, props: P): string[] {
  return String((component(props) as AnyElement).props.className).split(/\s+/);
}

describe("Kademe adjustments to the copied parts", () => {
  it("fields are 40px tall, like the Kademe md Button", () => {
    expect(classesOf(Input, {})).toContain("h-10");
    expect(classesOf(Input, {})).not.toContain("h-8");
    expect(classesOf(SelectTrigger, {})).toContain("data-[size=default]:h-10");
    expect(classesOf(InputGroup, {})).toContain("h-10");
  });

  it("a small input-group button fits inside the 40px group", () => {
    const el = InputGroupButton({ size: "sm", children: "Go" }) as AnyElement;
    const classes = classesOf(Button, el.props);
    expect(classes).toContain("h-8");
    expect(classes).not.toContain("h-10");
  });

  it("the sidebar switches at 1024px, the same breakpoint as useIsMobile", () => {
    // md: is 768px; between 768 and 1023 the server-rendered desktop sidebar
    // would flash before the mobile sheet takes over, and touch tablets would
    // lose the menu actions.
    expect(read("sidebar.tsx")).not.toMatch(/(?<![\w-])md:/);
  });

  it("the dialog carries the overlay shadow (RULES 6: modals may)", () => {
    expect(read("dialog.tsx")).toMatch(/data-slot="dialog-content"\s*className=\{cn\(\s*"[^"]*\bshadow-overlay\b/);
  });

  it("table rows are 52px and a selected row uses the brand-soft ground", () => {
    expect(classesOf(TableCell, {})).toContain("h-row");
    const row = classesOf(TableRow, {});
    expect(row).toContain("data-[state=selected]:bg-brand-soft");
    expect(row).not.toContain("data-[state=selected]:bg-muted-surface");
  });
});
