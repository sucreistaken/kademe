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
  const start = css.indexOf(`${header} {`);
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

  it("uses the 8/12/16 radius scale from HIRING-UX 8.3", () => {
    expect(theme["--radius-sm"]).toBe("8px");
    expect(theme["--radius-md"]).toBe("10px");
    expect(theme["--radius-lg"]).toBe("12px");
    expect(theme["--radius-xl"]).toBe("16px");
    expect(root["--radius"]).toBe("0.75rem");
  });

  it("never lets a shadcn mapping redefine a Kademe colour", () => {
    expect(inline["--color-accent"]).toBeUndefined();
    expect(inline["--color-muted"]).toBeUndefined();
    expect(inline["--color-accent-foreground"]).toBeUndefined();
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

  it("keeps dark: inert", () => {
    expect(css).toContain("@custom-variant dark (&:is(.dark *));");
  });
});
