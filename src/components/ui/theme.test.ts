import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The tokens are the one place the look of the product is decided, and three
 * parties read them: the Kademe screens (via @theme), the shadcn components
 * (via :root variables and @theme inline) and docs/design/HIRING-UX.md section
 * 8.2, which fixed the values. This test keeps the three in agreement and stops
 * a shadcn name from silently taking over a Kademe one.
 */
const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

function block(header: string): Record<string, string> {
  // A rule at the start of a line, so a selector that merely ends the same way does not match.
  const start = css.indexOf(`\n${header} {`);
  if (start < 0) throw new Error(`no "${header} {" block in globals.css`);
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim().toLowerCase();
  return vars;
}

const theme = block("@theme");
const root = block(":root");
const inline = block("@theme inline");

describe("Kademe tokens keep their meaning", () => {
  it.each([
    ["--color-accent", "#0e6a57"],
    ["--color-accent-soft", "#f1f7f5"],
    ["--color-muted", "#6e6e69"],
    ["--color-canvas", "#f6f5f2"],
    ["--color-surface", "#ffffff"],
    ["--color-line", "#e7e7e4"],
    ["--color-ink", "#131311"],
    ["--shadow-panel", "0 1px 3px rgba(0, 0, 0, 0.07)"],
    ["--shadow-modal", "0 8px 32px rgba(0, 0, 0, 0.16)"],
  ])("%s stays %s", (name, value) => {
    expect(theme[name]).toBe(value);
  });

  it("names the radius steps by shadcn role, with the HIRING-UX 8.3 pixels", () => {
    // shadcn radix-nova draws fields, menus and buttons with rounded-lg, cards
    // and dialogs with rounded-xl, items inside fields and menus with
    // rounded-md. The names follow those roles; the pixels per role are the
    // ones HIRING-UX 8.3 fixed (8 item, 10 button and field, 12 card, 16 sheet).
    expect(root["--radius"]).toBe("0.625rem");
    expect(theme["--radius-sm"]).toBe("6px");
    expect(theme["--radius-md"]).toBe("8px");
    expect(theme["--radius-lg"]).toBe("10px");
    expect(theme["--radius-xl"]).toBe("12px");
    expect(theme["--radius-2xl"]).toBe("16px");
  });

  it("never lets a shadcn mapping redefine a Kademe colour", () => {
    expect(inline["--color-accent"]).toBeUndefined();
    expect(inline["--color-muted"]).toBeUndefined();
    expect(inline["--color-accent-foreground"]).toBeUndefined();
  });
});

describe("focus is drawn once, by the global outline", () => {
  const start = css.indexOf("\n:focus-visible {");
  const focus = css.slice(start, css.indexOf("\n}", start));

  it("keeps the 2px accent outline with a 2px gap by default", () => {
    expect(start).toBeGreaterThan(-1);
    expect(focus).toContain("outline: 2px solid var(--color-accent);");
    expect(focus).toContain("outline-offset: var(--focus-offset, 2px);");
  });

  it("gives shadcn parts the full accent as outline colour, never a faded one", () => {
    // A 50% mix measured 2.24:1 on the canvas, below WCAG 1.4.11 (3:1); the
    // solid accent is 5.99:1.
    expect(css).toMatch(/\[data-slot\] \{[^}]*outline-color: var\(--ring\);/);
    expect(css).not.toMatch(/outline-color: color-mix\(/);
  });

  it("draws it inside menu and list items, which sit in scroll containers", () => {
    expect(css).toMatch(/\[data-slot\$="-item"\][^{]*\{\s*--focus-offset: -2px;/);
  });

  it("draws it on an input group's frame instead of the bare inner input", () => {
    expect(css).toMatch(/:is\(\[data-slot="input-group-control"\][^)]*\):focus-visible \{\s*outline: none;/);
    expect(css).toContain('[data-slot="input-group"]:has(> :is([data-slot="input-group-control"]');
  });
});

describe("shadcn variables carry the HIRING-UX 8.2 values", () => {
  it.each([
    ["--background", "#f6f5f2"],
    ["--foreground", "#131311"],
    ["--card", "#ffffff"],
    ["--card-foreground", "#131311"],
    ["--popover", "#ffffff"],
    ["--popover-foreground", "#131311"],
    ["--primary", "#0e6a57"],
    ["--primary-foreground", "#ffffff"],
    ["--secondary", "#f1f0ec"],
    ["--secondary-foreground", "#131311"],
    ["--muted", "#f1f0ec"],
    ["--muted-foreground", "#6e6e69"],
    ["--subtle", "#f1f0ec"],
    ["--subtle-foreground", "#131311"],
    ["--brand-soft", "#eef6f3"],
    ["--destructive", "#8c2f2a"],
    ["--border", "#e7e7e4"],
    ["--input", "#d8d8d3"],
    ["--ring", "#0e6a57"],
    ["--sidebar", "#fbfbf9"],
  ])("%s is %s", (name, value) => {
    expect(root[name]).toBe(value);
  });

  it("maps every shadcn variable to a utility", () => {
    for (const [utility, variable] of [
      ["--color-background", "var(--background)"],
      ["--color-foreground", "var(--foreground)"],
      ["--color-card", "var(--card)"],
      ["--color-popover", "var(--popover)"],
      ["--color-primary", "var(--primary)"],
      ["--color-primary-foreground", "var(--primary-foreground)"],
      ["--color-secondary", "var(--secondary)"],
      ["--color-muted-surface", "var(--muted)"],
      ["--color-muted-foreground", "var(--muted-foreground)"],
      ["--color-subtle", "var(--subtle)"],
      ["--color-subtle-foreground", "var(--subtle-foreground)"],
      ["--color-brand-soft", "var(--brand-soft)"],
      ["--color-destructive", "var(--destructive)"],
      ["--color-border", "var(--border)"],
      ["--color-input", "var(--input)"],
      ["--color-ring", "var(--ring)"],
      ["--color-sidebar", "var(--sidebar)"],
      ["--color-sidebar-accent", "var(--sidebar-accent)"],
    ]) {
      expect(inline[utility], utility).toBe(variable);
    }
  });

  it("does not let test fixtures leak utilities into the build", () => {
    // Test files hold class names as fixtures (normalizer inputs); Tailwind
    // would otherwise turn them into real CSS.
    expect(css).toContain('@source not "../**/*.test.ts";');
  });

  it("keeps dark: inert", () => {
    expect(css).toContain("@custom-variant dark (&:is(.dark *));");
  });
});
