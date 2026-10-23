import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The tokens are the one place the look of the product is decided, and two
 * parties read them: the Kademe screens (via @theme) and the shadcn components
 * (via :root variables and @theme inline). The values are the Campus German look of
 * 2026-10-16 (the contract comment in globals.css). This test keeps the two
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
    ["--color-accent", "#0b6f84"],
    ["--color-accent-soft", "#dff5fa"],
    ["--color-accent-deep", "#0a5868"],
    ["--color-muted", "#5b6370"],
    ["--color-canvas", "#f7f9fb"],
    ["--color-surface", "#ffffff"],
    ["--color-line", "#e1e5ea"],
    ["--color-ink", "#1d2127"],
    ["--color-ink-3", "#5b6370"],
    ["--color-brand", "#0bbfdf"],
    ["--color-brand-lip", "#0891ab"],
    ["--color-on-brand", "#1d2127"],
    ["--color-yellow", "#fdd31d"],
    ["--color-yellow-soft", "#fff2b8"],
    ["--color-red", "#ff3b3b"],
    ["--color-error", "#d92b2b"],
    ["--color-diff-easy", "#a9e7f3"],
    ["--color-diff-medium", "#ffe680"],
    ["--color-diff-hard", "#ffcaca"],
    ["--color-cream", "#f1f4f7"],
    ["--color-lip", "#d3d9e0"],
    ["--color-edge", "#7d8590"],
  ])("%s is %s", (name, value) => {
    expect(theme[name]).toBe(value);
  });

  it.each([
    ["--color-illus-line", "#2a2f36"],
    ["--color-illus-fill", "#dff5fa"],
    ["--color-illus-tint", "#e6eaef"],
    ["--color-illus-sage", "#79ccdf"],
    ["--color-illus-warm", "#fff2b8"],
  ])("illustration tone %s is %s (light tones only)", (name, value) => {
    expect(theme[name]).toBe(value);
  });

  it("names the radius steps by shadcn role, with the soft pixels", () => {
    // shadcn radix-nova draws fields, menus and buttons with rounded-lg, cards
    // and dialogs with rounded-xl, items inside fields and menus with
    // rounded-md. The names follow those roles; the Campus German look rounds
    // each a step further (9 small, 13 item, 18 button and field, 30 card, 36 sheet).
    expect(root["--radius"]).toBe("1.125rem");
    expect(root["--card-radius"]).toBe("30px");
    expect(theme["--radius-sm"]).toBe("9px");
    expect(theme["--radius-md"]).toBe("13px");
    expect(theme["--radius-lg"]).toBe("18px");
    expect(theme["--radius-xl"]).toBe("30px");
    expect(theme["--radius-2xl"]).toBe("36px");
  });

  it("keeps red out of the legacy pastel families (red is the brand only)", () => {
    for (const family of ["mint", "sky", "grape", "sun", "coral"]) {
      for (const suffix of ["", "-soft", "-fill"]) {
        const name = `--color-${family}${suffix}`;
        for (const red of ["--color-red", "--color-red-lip", "--color-error", "--color-danger"]) {
          expect(theme[name], `${name} must not equal ${red}`).not.toBe(theme[red]);
        }
      }
    }
  });

  it("maps the literal radii older screens draw onto the scale", () => {
    expect(css).toMatch(/\n\.rounded-\\\[6px\\\] \{\s*border-radius: var\(--radius-sm\);/);
    expect(css).toMatch(/\n\.rounded-\\\[8px\\\],\n\.rounded-\\\[10px\\\] \{\s*border-radius: var\(--radius-md\);/);
    expect(css).toMatch(/\n\.rounded-\\\[12px\\\],\n\.rounded-\\\[14px\\\] \{\s*border-radius: var\(--radius-lg\);/);
  });

  it("gives the pressable lip the brand lip and keeps the lips solid (no blur)", () => {
    expect(theme["--shadow-lip"]).toBe("0 4px 0 0 var(--color-brand-lip)");
    expect(theme["--shadow-lip-pressed"]).toBe("0 1px 0 0 var(--color-brand-lip)");
    expect(theme["--shadow-lip-soft"]).toBe("0 4px 0 0 var(--color-lip)");
    expect(theme["--shadow-card"]).toBe("0 6px 0 0 var(--color-lip)");
  });
});

describe("text stays readable (WCAG AA, 4.5:1)", () => {
  const grounds = ["--color-paper", "--color-canvas", "--color-cream", "--color-surface"];

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

  it("puts ink on the brand fill and white on the dark accent, both at 4.5:1 or more", () => {
    expect(contrast(theme["--color-on-brand"], theme["--color-brand"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", theme["--color-brand"])).toBeLessThan(4.5); // the reason white is forbidden on cyan
    expect(contrast("#ffffff", theme["--color-accent"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", theme["--color-accent-hover"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme["--color-accent"], theme["--color-accent-soft"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(root["--primary"], root["--brand-soft"])).toBeGreaterThanOrEqual(4.5);
  });

  it("reads the deep accent as text at 4.5:1 on white, paper and the accent tint (the report sheets set it as text)", () => {
    for (const ground of ["--color-surface", "--color-paper", "--color-accent-soft"]) {
      expect(contrast(theme["--color-accent-deep"], theme[ground]), `accent-deep on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(["--color-yellow-soft", "--color-yellow", "--color-diff-easy", "--color-diff-medium", "--color-diff-hard"])(
    "ink reads on %s",
    (ground) => {
      expect(contrast(theme["--color-ink"], theme[ground])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("draws control boundaries (edge) and the error frame at 3:1 on white and paper", () => {
    for (const ground of ["--color-surface", "--color-paper"]) {
      expect(contrast(theme["--color-edge"], theme[ground])).toBeGreaterThanOrEqual(3);
      expect(contrast(theme["--color-error"], theme[ground])).toBeGreaterThanOrEqual(3);
    }
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
    expect(inline["--color-brand"]).toBeUndefined();
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
    ["--background", "#f7f9fb"],
    ["--foreground", "#1d2127"],
    ["--card", "#ffffff"],
    ["--card-foreground", "#1d2127"],
    ["--popover", "#ffffff"],
    ["--popover-foreground", "#1d2127"],
    ["--primary", "#0b6f84"],
    ["--primary-foreground", "#ffffff"],
    ["--secondary", "#f1f4f7"],
    ["--secondary-foreground", "#1d2127"],
    ["--muted", "#f1f4f7"],
    ["--muted-foreground", "#5b6370"],
    ["--subtle", "#f1f4f7"],
    ["--subtle-foreground", "#1d2127"],
    ["--brand-soft", "#dff5fa"],
    ["--destructive", "#c42424"],
    ["--border", "#e1e5ea"],
    ["--input", "#7d8590"],
    ["--ring", "#0b6f84"],
    ["--sidebar", "#ffffff"],
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

  it("defines the DESIGN.md type scale as font-size tokens", () => {
    // [name, size, line-height, weight, letter-spacing or undefined]
    const scale: [string, string, string, string, string?][] = [
      ["display", "42px", "1.05", "900", "-0.025em"],
      ["headline-lg", "34px", "1.1", "900", "-0.02em"],
      ["headline", "30px", "1.2", "900", "-0.02em"],
      ["title-lg", "24px", "1.25", "900"],
      ["title", "21px", "1.3", "900"],
      ["body-lg", "18px", "1.5", "600"],
      ["body", "15px", "1.5", "600"],
      ["label", "15px", "1.3", "800"],
      ["label-sm", "13px", "1.3", "800"],
      ["caption", "13px", "1.4", "700"],
      ["overline", "13px", "1.3", "900", "0.1em"],
      ["button", "17px", "1", "900"],
      ["button-lg", "20px", "1", "900"],
      ["numeral", "18px", "1", "900"],
      ["passage", "17px", "1.75", "600"],
    ];
    for (const [name, size, lineHeight, weight, spacing] of scale) {
      expect(theme[`--text-${name}`], name).toBe(size);
      expect(theme[`--text-${name}--line-height`], name).toBe(lineHeight);
      expect(theme[`--text-${name}--font-weight`], name).toBe(weight);
      expect(theme[`--text-${name}--letter-spacing`], name).toBe(spacing);
    }
    // A text-* name must not also be a colour, or the utility becomes ambiguous.
    for (const [name] of scale) expect(theme[`--color-${name}`], name).toBeUndefined();
  });

  it("keeps dark: inert", () => {
    expect(css).toContain("@custom-variant dark (&:is(.dark *));");
  });
});
