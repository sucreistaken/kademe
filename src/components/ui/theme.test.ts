import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The tokens are the one place the look of the product is decided, and two
 * parties read them: the Kademe screens (via @theme) and the shadcn components
 * (via :root variables and @theme inline). The values are the soft look of
 * 2026-10-14 (the contract comment in globals.css). This test keeps the two
 * in agreement, keeps text readable (WCAG AA) and stops a shadcn name from
 * silently taking over a Kademe one.
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

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("Kademe tokens keep their meaning", () => {
  it.each([
    ["--color-accent", "#157a5a"],
    ["--color-accent-soft", "#e4f4ec"],
    ["--color-muted", "#5a6963"],
    ["--color-canvas", "#f2f6f4"],
    ["--color-surface", "#ffffff"],
    ["--color-line", "#dde7e2"],
    ["--color-ink", "#1c2b26"],
    ["--color-ink-3", "#627069"],
  ])("%s is %s", (name, value) => {
    expect(theme[name]).toBe(value);
  });

  it.each([
    ["--color-illus-line", "#24352f"],
    ["--color-illus-fill", "#e9f6f0"],
    ["--color-illus-tint", "#cbe8da"],
    ["--color-illus-sage", "#8fcdb2"],
    ["--color-illus-warm", "#fff6e3"],
  ])("illustration tone %s is %s (light tones only, never the accent)", (name, value) => {
    expect(theme[name]).toBe(value);
  });

  it("names the radius steps by shadcn role, with the soft pixels", () => {
    // shadcn radix-nova draws fields, menus and buttons with rounded-lg, cards
    // and dialogs with rounded-xl, items inside fields and menus with
    // rounded-md. The names follow those roles; the soft look rounds each a
    // step further (10 item, 14 button and field, 20 card, 26 sheet).
    expect(root["--radius"]).toBe("0.875rem");
    expect(root["--card-radius"]).toBe("20px");
    expect(theme["--radius-sm"]).toBe("8px");
    expect(theme["--radius-md"]).toBe("10px");
    expect(theme["--radius-lg"]).toBe("14px");
    expect(theme["--radius-xl"]).toBe("20px");
    expect(theme["--radius-2xl"]).toBe("26px");
  });

  it("maps the literal radii older screens draw onto the scale", () => {
    expect(css).toMatch(/\n\.rounded-\\\[10px\\\] \{\s*border-radius: var\(--radius-lg\);/);
    expect(css).toMatch(/\n\.rounded-\\\[8px\\\] \{\s*border-radius: var\(--radius-md\);/);
    expect(css).toMatch(/\n\.rounded-\\\[12px\\\],\n\.rounded-\\\[14px\\\] \{\s*border-radius: var\(--radius-xl\);/);
  });

  it("gives the pressable lip the deep accent and keeps the lips solid (no blur)", () => {
    expect(theme["--shadow-lip"]).toBe("0 3px 0 0 var(--color-accent-deep)");
    expect(theme["--shadow-lip-pressed"]).toBe("0 1px 0 0 var(--color-accent-deep)");
    expect(theme["--shadow-lip-soft"]).toBe("0 2px 0 0 var(--color-line)");
    expect(theme["--shadow-card"]).toBe("0 2px 0 0 var(--color-hairline)");
  });
});

describe("text stays readable (WCAG AA, 4.5:1)", () => {
  const grounds = ["--color-paper", "--color-canvas", "--color-surface"];

  it.each(["--color-ink", "--color-ink-2", "--color-muted", "--color-ink-3", "--color-danger", "--color-warn", "--color-success"])(
    "%s reads on paper, canvas and white",
    (text) => {
      for (const ground of grounds) expect(contrast(theme[text], theme[ground]), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["mint", "sky", "grape", "sun", "coral"])("the %s text tone reads on its own soft ground and on white", (family) => {
    expect(contrast(theme[`--color-${family}`], theme[`--color-${family}-soft`])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme[`--color-${family}`], theme["--color-surface"])).toBeGreaterThanOrEqual(4.5);
  });

  it("puts white on the filled button at 4.5:1 or more, and the accent on its soft ground too", () => {
    expect(contrast("#ffffff", theme["--color-accent"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", theme["--color-accent-hover"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme["--color-accent"], theme["--color-accent-soft"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(root["--primary"], root["--brand-soft"])).toBeGreaterThanOrEqual(4.5);
  });

  it("draws an unchecked control's outline at 3:1 on white (WCAG 1.4.11)", () => {
    expect(contrast(theme["--color-line-mute"], theme["--color-surface"])).toBeGreaterThanOrEqual(3);
  });

  it("keeps the dark panel's labels readable", () => {
    expect(contrast(theme["--color-vault-label"], theme["--color-vault"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme["--color-vault-text"], theme["--color-vault"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the shadcn variables follow the Kademe tokens", () => {
  it.each([
    ["--background", "--color-canvas"],
    ["--foreground", "--color-ink"],
    ["--primary", "--color-accent"],
    ["--muted-foreground", "--color-muted"],
    ["--destructive", "--color-danger"],
    ["--border", "--color-line"],
    ["--input", "--color-line-strong"],
    ["--ring", "--color-accent"],
    ["--sidebar", "--color-paper"],
  ])("%s equals %s", (shadcn, kademe) => {
    expect(root[shadcn]).toBe(theme[kademe]);
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

  it("draws no box on a heading that takes the focus by script on a step change, and nothing else loses it (Task 5 review fix 5)", () => {
    expect(css).toMatch(/\n:is\(h1, h2, h3\)\[tabindex="-1"\]:focus-visible \{\s*outline: none;\s*\}/);
    expect(css.match(/outline: none;/g)?.length).toBe(2);
  });

  it("draws it on an input group's frame instead of the bare inner input", () => {
    expect(css).toMatch(/:is\(\[data-slot="input-group-control"\][^)]*\):focus-visible \{\s*outline: none;/);
    expect(css).toContain('[data-slot="input-group"]:has(> :is([data-slot="input-group-control"]');
  });
});

describe("shadcn variables carry the soft values", () => {
  it.each([
    ["--background", "#f2f6f4"],
    ["--foreground", "#1c2b26"],
    ["--card", "#ffffff"],
    ["--card-foreground", "#1c2b26"],
    ["--popover", "#ffffff"],
    ["--popover-foreground", "#1c2b26"],
    ["--primary", "#157a5a"],
    ["--primary-foreground", "#ffffff"],
    ["--secondary", "#eaf0ed"],
    ["--secondary-foreground", "#1c2b26"],
    ["--muted", "#eaf0ed"],
    ["--muted-foreground", "#5a6963"],
    ["--subtle", "#eaf0ed"],
    ["--subtle-foreground", "#1c2b26"],
    ["--brand-soft", "#e9f6f0"],
    ["--destructive", "#b23a30"],
    ["--border", "#dde7e2"],
    ["--input", "#c9d5cf"],
    ["--ring", "#157a5a"],
    ["--sidebar", "#f7faf8"],
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
