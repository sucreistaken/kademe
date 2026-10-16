# Campus German Redesign, Plan 1: Foundation and Brand

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repaint the whole product in the approved "Sıcak Yumuşak" Campus German look by changing the shared tokens and primitives (colors, radii, lips, buttons, mark, mascot, notices, difficulty chip), so every screen picks it up without being rewritten one by one.

**Architecture:** Kademe screens use semantic Tailwind tokens from `src/app/globals.css` (`accent`, `canvas`, `ink`, the pastel families...). This plan keeps those names and gives them the new values (accent becomes the dark brand cyan used for text, focus and progress), adds new brand tokens (`brand`, `yellow`, `red`, `diff-*`, `lip`, `edge`), and changes the few shared primitives that encode the look (Button, BrandMark, Mascot, IconTile, section look). Screen-by-screen fidelity to the mockups is Plan 2 (candidate) and Plan 3 (panel, report, hiring), listed at the end.

**Tech Stack:** Next.js 16 (see AGENTS.md: read `node_modules/next/dist/docs/` before Next-specific code), React 19, Tailwind CSS 4 (`@theme` tokens), Vitest, `react-dom/server` for markup tests, pnpm.

**Spec:** `docs/design/ux-designs/ux-kademe-2026-10-16/DESIGN.md` (look, tokens) and `EXPERIENCE.md` (behavior); decisions log `.memlog.md`; mockups in `mockups/` (`direction-sicak-yumusak.html`, `key-*.html`). Spines win over mockups on conflict.

## Global Constraints

- Brand colors: red `#FF3B3B`, yellow `#FDD31D`, cyan `#0BBFDF`, ink `#1D2127`.
- Primary action = cyan `#0BBFDF` fill with ink `#1D2127` text (7.34:1). White text on cyan is forbidden (2.20:1).
- Red is only for the brand (mark, mascot, celebration), the recording dot and a small error frame (`#D92B2B`). Never a button, never text, never a result, level, timer or warning.
- Difficulty Kolay/Orta/Zor = `#A9E7F3` / `#FFE680` / `#FFCACA` tints with ink text and a 1/2/3 step glyph plus the word; teacher panel only, never on a candidate screen or the printed level report.
- Warnings and error notices: yellow-soft `#FFF2B8` ground, ink text, yellow glyph. The five exam sections are neutral (icon + word), never five colors.
- Font stays Nunito. No dark theme (`dark:` stays inert).
- Every text/background pair at least 4.5:1 (WCAG AA); control boundaries at least 3:1.
- Code, comments and commit messages in English; UI copy Turkish + English via the i18n JSON files. Never write the em-dash character (U+2014) anywhere.
- Browser checks only with Claude in Chrome (`mcp__claude-in-chrome__*`), never Playwright. Local dev: port 3100, DB `kademe_platform` (see `docs/STATUS.md`).
- Commit after each task on branch `platform/solutions`; do not deploy (deploy needs the owner's "canlıya al").

## Review Focus

1. A filled button somewhere still renders white text on the new cyan (hand-rolled `bg-accent text-white` is fine because `accent` becomes dark cyan, but a hand-rolled `bg-brand text-white` would be 2.2:1): Task 2 adds a source scan test that forbids `bg-brand` together with `text-white`.
2. A text tone that read on the old green-grey grounds fails on the new cream grounds (`#FAF7F2`, `#F3EEE5`): Task 1's contrast tests cover every text token on paper, canvas, cream and surface.
3. Old screens draw literal radii (`rounded-[10px]`, `rounded-[14px]`) that are remapped to the scale in `globals.css`; a button drawn with `rounded-[14px]` would become a 30px card corner: Task 1 maps `rounded-[14px]` to `--radius-lg` instead and pins it.
4. The proctoring "recording" dot and the celebration confetti are the only red on candidate screens; a red notice box left over (`bg-danger-soft`) would break the red rule: Task 6 adds a scan test that forbids `bg-danger-soft` in `src/components/candidate/**`.
5. Frozen default markup (`*.default-markup.json`) pins shared blocks; a class change in Button flows into StepFooter's frozen markup. Task 2 re-captures it deliberately and the diff must show only the button classes.

---

### Task 1: New tokens in globals.css

**Files:**
- Modify: `src/app/globals.css` (the `@theme` block, `:root`, the literal radius remaps at the end)
- Test: `src/components/ui/theme.test.ts`

**Interfaces:**
- Produces (Tailwind utilities later tasks use): `bg-brand`, `text-on-brand`, `border-brand-lip`, `fill-brand`, `fill-brand-lip`, `bg-yellow`, `fill-yellow`, `bg-yellow-soft`, `border-yellow-soft-lip`, `fill-mascot-yellow-lip`, `stroke-mascot-sleep`, `fill-red`, `fill-red-lip`, `border-error`, `bg-diff-easy`, `bg-diff-medium`, `bg-diff-hard` (+ `-lip`), `bg-cream`, `bg-track`, `border-lip`, `fill-lip`, `border-edge`; shadows `shadow-lip` (brand lip), `shadow-lip-soft`, `shadow-card`.

- [ ] **Step 1: Rewrite the pinned values in the test first**

In `src/components/ui/theme.test.ts`, replace the first `it.each` table and the illustration table with:

```ts
  it.each([
    ["--color-accent", "#0b6f84"],
    ["--color-accent-soft", "#dff5fa"],
    ["--color-muted", "#5e656e"],
    ["--color-canvas", "#faf7f2"],
    ["--color-surface", "#ffffff"],
    ["--color-line", "#e7e0d3"],
    ["--color-ink", "#1d2127"],
    ["--color-ink-3", "#5e656e"],
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
    ["--color-cream", "#f3eee5"],
    ["--color-lip", "#ddd5c6"],
    ["--color-edge", "#8a8377"],
  ])("%s is %s", (name, value) => {
    expect(theme[name]).toBe(value);
  });

  it.each([
    ["--color-illus-line", "#2a2f36"],
    ["--color-illus-fill", "#dff5fa"],
    ["--color-illus-tint", "#e9e3d8"],
    ["--color-illus-sage", "#79ccdf"],
    ["--color-illus-warm", "#fff2b8"],
  ])("illustration tone %s is %s (light tones only)", (name, value) => {
    expect(theme[name]).toBe(value);
  });
```

Replace the radius test body with:

```ts
    expect(root["--radius"]).toBe("1.125rem");
    expect(root["--card-radius"]).toBe("30px");
    expect(theme["--radius-sm"]).toBe("9px");
    expect(theme["--radius-md"]).toBe("13px");
    expect(theme["--radius-lg"]).toBe("18px");
    expect(theme["--radius-xl"]).toBe("30px");
    expect(theme["--radius-2xl"]).toBe("36px");
```

Replace the literal-radius test with (buttons drawn with 12/14px stay button-sized, Review Focus 3):

```ts
  it("maps the literal radii older screens draw onto the scale", () => {
    expect(css).toMatch(/\n\.rounded-\\\[6px\\\] \{\s*border-radius: var\(--radius-sm\);/);
    expect(css).toMatch(/\n\.rounded-\\\[8px\\\],\n\.rounded-\\\[10px\\\] \{\s*border-radius: var\(--radius-md\);/);
    expect(css).toMatch(/\n\.rounded-\\\[12px\\\],\n\.rounded-\\\[14px\\\] \{\s*border-radius: var\(--radius-lg\);/);
  });
```

Replace the lip test with:

```ts
  it("gives the pressable lip the brand lip and keeps the lips solid (no blur)", () => {
    expect(theme["--shadow-lip"]).toBe("0 4px 0 0 var(--color-brand-lip)");
    expect(theme["--shadow-lip-pressed"]).toBe("0 1px 0 0 var(--color-brand-lip)");
    expect(theme["--shadow-lip-soft"]).toBe("0 4px 0 0 var(--color-lip)");
    expect(theme["--shadow-card"]).toBe("0 6px 0 0 var(--color-lip)");
  });
```

In `describe("text stays readable ...")`, replace `grounds` and the filled-button test, and add the brand pairs:

```ts
  const grounds = ["--color-paper", "--color-canvas", "--color-cream", "--color-surface"];
```

```ts
  it("puts ink on the brand fill and white on the dark accent, both at 4.5:1 or more", () => {
    expect(contrast(theme["--color-on-brand"], theme["--color-brand"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", theme["--color-brand"])).toBeLessThan(4.5); // the reason white is forbidden on cyan
    expect(contrast("#ffffff", theme["--color-accent"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", theme["--color-accent-hover"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme["--color-accent"], theme["--color-accent-soft"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(root["--primary"], root["--brand-soft"])).toBeGreaterThanOrEqual(4.5);
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
```

Replace the `shadcn variables carry the soft values` table with:

```ts
    ["--background", "#faf7f2"],
    ["--foreground", "#1d2127"],
    ["--card", "#ffffff"],
    ["--card-foreground", "#1d2127"],
    ["--popover", "#ffffff"],
    ["--popover-foreground", "#1d2127"],
    ["--primary", "#0b6f84"],
    ["--primary-foreground", "#ffffff"],
    ["--secondary", "#f3eee5"],
    ["--secondary-foreground", "#1d2127"],
    ["--muted", "#f3eee5"],
    ["--muted-foreground", "#5e656e"],
    ["--subtle", "#f3eee5"],
    ["--subtle-foreground", "#1d2127"],
    ["--brand-soft", "#dff5fa"],
    ["--destructive", "#c42424"],
    ["--border", "#e7e0d3"],
    ["--input", "#8a8377"],
    ["--ring", "#0b6f84"],
    ["--sidebar", "#faf7f2"],
```

Also add `--color-brand` to the "never lets a shadcn mapping redefine a Kademe colour" test:

```ts
    expect(inline["--color-brand"]).toBeUndefined();
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/components/ui/theme.test.ts`
Expected: FAIL on the changed values (e.g. `--color-accent is #0b6f84`: expected '#157a5a').

- [ ] **Step 3: Change the tokens**

In `src/app/globals.css`, replace the contract comment's bullet list (the block starting ` * The rules now:`) with:

```css
 * The rules now (Campus German redesign, docs/design/ux-designs/ux-kademe-2026-10-16/DESIGN.md):
 *  - A warm neutral page (paper/canvas #FAF7F2, cream #F3EEE5) with ink text. Brand colours are
 *    small accents only ("çok da renk renk kokmasın").
 *  - `brand` (logo cyan) is the primary action's fill, always with ink text (`on-brand`); white on
 *    it is 2.2:1 and forbidden. `accent` is the dark brand cyan for text, links, focus and progress.
 *  - Yellow is the flag, the warning glyph and the notice ground (yellow-soft, ink text).
 *  - Red is brand only (mark, mascot, celebration), the recording dot and a small error frame
 *    (`error`). Never a button, text, result, level, timer or warning.
 *  - Difficulty tints (`diff-*`) are for the teacher panel only.
 *  - The pastel families keep their names for old call sites but now resolve to the brand-aligned
 *    neutral set: sections are icon + word, never five colours.
 *  - Corners: 9 small, 13 items, 18 buttons and fields, 30 cards, 36 the big candidate card.
 *  - Depth: a solid lip under pressables (4px) and cards (6px); blur only on floating things.
 *  - Text contrast is WCAG AA (4.5:1) on paper, canvas, cream and surface; boundaries 3:1.
 *  - No dark theme; `dark:` stays inert (below).
```

Replace the `@theme` color, radius and shadow declarations (from `--color-surface` down to `--shadow-overlay`) with:

```css
  /* Neutral axis: warm, so the brand accents sit on it calmly. */
  --color-surface: #ffffff;
  --color-canvas: #faf7f2; /* page ground (panel and candidate) */
  --color-cream: #f3eee5; /* secondary ground: chips, subtle rows, the section tile */
  --color-track: #e9e3d8; /* progress and meter tracks */
  --color-line: #e7e0d3; /* rim: card and divider borders */
  --color-lip: #ddd5c6; /* the solid lip under cards and secondary buttons */
  --color-edge: #8a8377; /* control boundaries, 3.75:1 on white */
  --color-muted: #5e656e; /* secondary text, 5.1:1 on cream */
  --color-ink: #1d2127;

  /* Dark brand cyan: text, links, focus, progress. White on it 5.8:1. */
  --color-accent: #0b6f84;
  --color-accent-hover: #095c6e;
  --color-accent-soft: #dff5fa; /* selection and current-place tint */
  --color-accent-deep: #0891ab;

  /* Brand (Campus German logo). */
  --color-brand: #0bbfdf; /* the primary action's fill, ink text only */
  --color-brand-lip: #0891ab;
  --color-on-brand: #1d2127;
  --color-yellow: #fdd31d;
  --color-yellow-lip: #d9ae00;
  --color-yellow-soft: #fff2b8;
  --color-yellow-soft-lip: #f0dc7a;
  --color-red: #ff3b3b;
  --color-red-lip: #d92b2b;
  --color-error: #d92b2b; /* a field frame or "!" glyph; messages stay ink */
  --color-mascot-yellow-lip: #e3b400;
  --color-mascot-sleep: #8a6f00;

  /* Difficulty, teacher panel only (DESIGN.md "Color psychology"). Ink text on all three. */
  --color-diff-easy: #a9e7f3;
  --color-diff-easy-lip: #79ccdf;
  --color-diff-medium: #ffe680;
  --color-diff-medium-lip: #ebc63c;
  --color-diff-hard: #ffcaca;
  --color-diff-hard-lip: #f2a0a0;

  /* Semantic tones. Warnings and notices are yellow-soft with ink text. */
  --color-danger: #c42424;
  --color-danger-soft: #fbe9e7;
  --color-success: #0b6f84;
  --color-success-soft: #dff5fa;
  --color-warn: #1d2127;
  --color-warn-soft: #fff2b8;

  /*
   * The old pastel families, kept as names so existing call sites compile,
   * resolved to the brand-aligned set: mint = the cyan "done", sun = yellow,
   * the rest neutral. `-fill` is a shape colour (never text).
   */
  --color-mint: #0b6f84;
  --color-mint-soft: #dff5fa;
  --color-mint-fill: #0bbfdf;
  --color-sky: #3f454d;
  --color-sky-soft: #f3eee5;
  --color-sky-fill: #8a8377;
  --color-grape: #3f454d;
  --color-grape-soft: #f3eee5;
  --color-grape-fill: #8a8377;
  --color-sun: #1d2127;
  --color-sun-soft: #fff2b8;
  --color-sun-fill: #fdd31d;
  --color-coral: #3f454d;
  --color-coral-soft: #f3eee5;
  --color-coral-fill: #ff3b3b;

  /* The rest of the neutral ramp. */
  --color-paper: #faf7f2;
  --color-ink-2: #3f454d;
  --color-ink-3: #5e656e;
  --color-hairline: #ece6db;
  --color-line-strong: #8a8377; /* = edge: an input border that must be findable */
  --color-line-mute: #8a8377;
  --color-underline: #c9c1b3;
  --color-disabled: #f3eee5;
  --color-row-line: #f1ece3;
  --color-panel: #1d2127;
  --color-panel-top: #2a2f36;
  --color-panel-bottom: #15181c;

  /* The dark "manager only" column in the template builder. */
  --color-vault: #1d2127;
  --color-vault-box: #2a2f36;
  --color-vault-line: #3a4049;
  --color-vault-chip: #4b525c;
  --color-vault-flag: #4a3532;
  --color-vault-mark: #f2a0a0;
  --color-vault-label: #a9afb7;
  --color-vault-text: #f3eee5;

  /* Illustration tones: light only, used by components/visual/illustrations.tsx. */
  --color-illus-line: #2a2f36;
  --color-illus-fill: #dff5fa;
  --color-illus-tint: #e9e3d8;
  --color-illus-sage: #79ccdf;
  --color-illus-warm: #fff2b8;

  /* Nunito: rounded terminals, latin-ext for Turkish and German. ui-rounded is SF Rounded on Apple. */
  --font-sans: var(--font-nunito), ui-rounded, system-ui, sans-serif;

  /* Radius under shadcn's role names: sm 9, md 13 (items), lg 18 (buttons, fields, menus), xl 30 (cards, dialog), 2xl 36. */
  --radius-sm: 9px;
  --radius-md: 13px;
  --radius-lg: 18px;
  --radius-xl: 30px;
  --radius-2xl: 36px;

  /* Depth: solid lips under pressables and cards; blur only for floating things. */
  --shadow-lip: 0 4px 0 0 var(--color-brand-lip);
  --shadow-lip-pressed: 0 1px 0 0 var(--color-brand-lip);
  --shadow-lip-soft: 0 4px 0 0 var(--color-lip);
  --shadow-card: 0 6px 0 0 var(--color-lip);
  --shadow-panel: 0 1px 2px rgb(29 33 39 / 0.05), 0 8px 20px -8px rgb(29 33 39 / 0.12);
  --shadow-modal: 0 24px 56px -16px rgb(29 33 39 / 0.28);
  --shadow-panel-soft: 0 6px 0 0 var(--color-lip), 0 12px 28px -14px rgb(29 33 39 / 0.16);
  --shadow-overlay: 0 18px 44px -10px rgb(29 33 39 / 0.22);
```

Replace the `:root` block's values (keep the keys and comments) with:

```css
  --radius: 1.125rem; /* 18px: buttons and fields */
  --card-radius: 30px;
  --background: #faf7f2;
  --foreground: #1d2127;
  --card: #ffffff;
  --card-foreground: #1d2127;
  --popover: #ffffff;
  --popover-foreground: #1d2127;
  --primary: #0b6f84;
  --primary-foreground: #ffffff;
  --secondary: #f3eee5;
  --secondary-foreground: #1d2127;
  --muted: #f3eee5;
  --muted-foreground: #5e656e;
  --subtle: #f3eee5;
  --subtle-foreground: #1d2127;
  --brand-soft: #dff5fa;
  --destructive: #c42424;
  --border: #e7e0d3;
  --input: #8a8377;
  --ring: #0b6f84;
  --sidebar: #faf7f2;
  --sidebar-foreground: #1d2127;
  --sidebar-primary: #0b6f84;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f3eee5;
  --sidebar-accent-foreground: #1d2127;
  --sidebar-border: #e7e0d3;
  --sidebar-ring: #0b6f84;
```

Replace the literal radius remaps at the end of the file with:

```css
.rounded-\[6px\] {
  border-radius: var(--radius-sm);
}
.rounded-\[8px\],
.rounded-\[10px\] {
  border-radius: var(--radius-md);
}
.rounded-\[12px\],
.rounded-\[14px\] {
  border-radius: var(--radius-lg);
}
```

Update the `.vault :focus-visible` comment's numbers to "(#F3EEE5 on #1D2127, about 14:1)".

- [ ] **Step 4: Run the token test and the whole suite**

Run: `npx vitest run src/components/ui/theme.test.ts`
Expected: PASS.
Run: `npx vitest run`
Expected: PASS except tests that pin old family colors or markup; for each failure, read it: a test asserting an old hex or an old family class for a shared block is updated to the new value in this task; anything else is a real regression to fix.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit -p . && npx eslint src/app src/components/ui
git add src/app/globals.css src/components/ui/theme.test.ts
git commit -m "Give the tokens the Campus German look

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Buttons in the brand look

**Files:**
- Modify: `src/components/ui/button.tsx` (the `SECONDARY` constant and `buttonVariants`)
- Modify: `src/components/ui/button.test.ts`
- Create: `src/components/ui/no-white-on-brand.test.ts`
- Regenerate: `src/components/visual/step-footer.default-markup.json` (and any other `*.default-markup.json` whose test fails only on button classes)

**Interfaces:**
- Consumes: Task 1 utilities `bg-brand`, `text-on-brand`, `border-brand-lip`, `shadow-lip`, `shadow-lip-soft`, `border-line-strong`.
- Produces: `buttonVariants({ variant: "primary" })` = cyan + ink + 4px brand lip; Plan 2 and 3 use it for every filled action.

- [ ] **Step 1: Write the failing tests**

In `src/components/ui/button.test.ts` replace the primary and secondary/danger tests with:

```ts
  it("primary: the brand cyan with ink text and a solid 4px lip it presses into, flat and grey when disabled", () => {
    const c = classes("primary");
    expect(c).toEqual(expect.arrayContaining(["bg-brand", "text-on-brand", "border-2", "border-brand-lip", "shadow-lip", "font-extrabold"]));
    expect(c).not.toContain("text-white");
    expect(c).toEqual(
      expect.arrayContaining(["active:not-disabled:not-aria-disabled:translate-y-[3px]", "active:not-disabled:not-aria-disabled:shadow-lip-pressed"]),
    );
    expect(c).toEqual(expect.arrayContaining(["disabled:bg-disabled", "disabled:text-muted", "disabled:border-line", "disabled:shadow-none"]));
  });

  it("secondary and danger: a white button with a 2px edge and a soft lip; neither uses red text", () => {
    for (const variant of ["secondary", "danger"] as const) {
      const c = classes(variant);
      expect(c).toEqual(expect.arrayContaining(["bg-surface", "text-ink", "border-2", "border-line-strong", "shadow-lip-soft", "disabled:shadow-none"]));
      expect(c).not.toContain("text-danger");
    }
    expect(classes("danger")).toContain("hover:border-error");
  });
```

Change `expect(c).toContain("font-bold")` in the first test to `expect(c.some((x) => x === "font-bold" || x === "font-extrabold")).toBe(true)`.

Create `src/components/ui/no-white-on-brand.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to see the button test fail**

Run: `npx vitest run src/components/ui/button.test.ts src/components/ui/no-white-on-brand.test.ts`
Expected: button test FAIL (`bg-brand` missing); the scan test PASS (nothing uses `bg-brand` yet).

- [ ] **Step 3: Change the variants**

In `src/components/ui/button.tsx` replace `SECONDARY` and the `primary` and `danger` variants:

```ts
const SECONDARY =
  "bg-surface text-ink border-2 border-line-strong shadow-lip-soft hover:bg-canvas " +
  "active:not-disabled:not-aria-disabled:translate-y-[3px] active:not-disabled:not-aria-disabled:shadow-none " +
  "disabled:text-muted disabled:hover:bg-surface disabled:shadow-none";
```

```ts
        primary:
          "bg-brand text-on-brand border-2 border-brand-lip shadow-lip font-extrabold hover:bg-brand/90 " +
          "active:not-disabled:not-aria-disabled:translate-y-[3px] active:not-disabled:not-aria-disabled:shadow-lip-pressed " +
          "disabled:bg-disabled disabled:text-muted disabled:border-line disabled:shadow-none",
```

```ts
        danger:
          "bg-surface text-ink border-2 border-line-strong shadow-lip-soft hover:border-error " +
          "active:not-disabled:not-aria-disabled:translate-y-[3px] active:not-disabled:not-aria-disabled:shadow-none " +
          "disabled:text-muted disabled:shadow-none",
```

Update the comment above `SECONDARY` to say the lip is 4px and the press is 3px; and the component doc comment: "primary is the brand cyan with ink text (never white)".

- [ ] **Step 4: Run the tests; re-capture the frozen step footer markup**

Run: `npx vitest run src/components/ui`
Expected: PASS.
Run: `npx vitest run src/components/visual`
Expected: frozen-markup tests that render a Button fail. For each: run `CAPTURE_MARKUP=1 npx vitest run <that test file>`, then `git diff -- '*.default-markup.json'` and confirm the only changes are the button classes from Step 3. Re-run `npx vitest run src/components/visual`: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/button.test.ts src/components/ui/no-white-on-brand.test.ts src/components/visual/*.default-markup.json
git commit -m "Draw the primary button in the brand cyan with ink text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The mark, the Campus German petal glyph and the lockup

**Files:**
- Modify: `src/components/visual/brand-mark.tsx`
- Create: `src/components/visual/brand-mark.test.ts`

**Interfaces:**
- Consumes: Task 1 utilities `fill-brand`, `fill-brand-lip`, `fill-red`, `fill-red-lip`, `fill-yellow`, `fill-mascot-yellow-lip`, `fill-lip`, `stroke-lip`, `fill-surface`, `fill-ink`.
- Produces: `BrandMark({ className?, tone?: "color" | "ink" })`, `PetalGlyph({ className? })`, `BrandLockup({ byline, markClassName? })` (same props as today, so call sites do not change).

- [ ] **Step 1: Write the failing test**

Create `src/components/visual/brand-mark.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLockup, BrandMark, PetalGlyph } from "./brand-mark";

const html = (el: Parameters<typeof createElement>[0], props: object = {}) => renderToStaticMarkup(createElement(el as never, props));

describe("BrandMark", () => {
  it("draws three steps in cyan, red and yellow (the tallest), each on its own lip", () => {
    const h = html(BrandMark);
    for (const c of ["fill-brand", "fill-brand-lip", "fill-red", "fill-red-lip", "fill-yellow", "fill-mascot-yellow-lip"]) expect(h).toContain(c);
    expect(h).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(h).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("has a one-colour ink version for print", () => {
    const h = html(BrandMark, { tone: "ink" });
    expect(h).toContain("fill-ink");
    for (const c of ["fill-brand", "fill-red", "fill-yellow"]) expect(h).not.toContain(c);
  });
});

describe("PetalGlyph", () => {
  it("is the Campus German three-petal sign in red, yellow and cyan, decorative", () => {
    const h = html(PetalGlyph);
    for (const c of ["fill-red", "fill-yellow", "fill-brand"]) expect(h).toContain(c);
    expect(h).toContain('aria-hidden="true"');
  });
});

describe("BrandLockup", () => {
  it("puts the petal glyph before the byline and keeps the name", () => {
    const h = html(BrandLockup, { byline: "bir Campus German ürünü" });
    expect(h).toContain("Kademe");
    expect(h.indexOf("fill-yellow", h.indexOf("Kademe"))).toBeGreaterThan(-1);
    expect(h).toContain("bir Campus German ürünü");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/visual/brand-mark.test.ts`
Expected: FAIL (`PetalGlyph` is not exported; no `fill-brand`).

- [ ] **Step 3: Write the components**

Replace the body of `src/components/visual/brand-mark.tsx` (keep the `// kademe-owned` header) with:

```tsx
// kademe-owned
import { cn } from "@/lib/cn";

/**
 * Kademe means "step": three rounded steps rising in the Campus German colours
 * (cyan, red, yellow: the tallest), each on a solid lip, on a white tile with a
 * cream lip (DESIGN.md, Brand & Style). `tone="ink"` is the one-colour version
 * for print and the level report. Decorative; the word next to it is the name.
 */
export function BrandMark({ className, tone = "color" }: { className?: string; tone?: "color" | "ink" }) {
  const ink = tone === "ink";
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false" className={cn("size-7 shrink-0", className)}>
      <rect x="0.8" y="2.4" width="26.4" height="25" rx="9" className={ink ? "fill-line" : "fill-lip"} />
      <rect x="0.8" y="0.8" width="26.4" height="25" rx="9" strokeWidth="1.6" className={cn("fill-surface", ink ? "stroke-line" : "stroke-lip")} />
      {ink ? null : <rect x="4.4" y="16.2" width="5.6" height="8" rx="2.8" className="fill-brand-lip" />}
      <rect x="4.4" y="15" width="5.6" height="7.6" rx="2.8" className={ink ? "fill-ink" : "fill-brand"} />
      {ink ? null : <rect x="11.2" y="12.2" width="5.6" height="12" rx="2.8" className="fill-red-lip" />}
      <rect x="11.2" y="11" width="5.6" height="11.6" rx="2.8" className={ink ? "fill-ink" : "fill-red"} />
      {ink ? null : <rect x="18" y="7.2" width="5.6" height="17" rx="2.8" className="fill-mascot-yellow-lip" />}
      <rect x="18" y="6" width="5.6" height="16.6" rx="2.8" className={ink ? "fill-ink" : "fill-yellow"} />
    </svg>
  );
}

/** The Campus German petals (red, yellow, cyan) as a small sign before the byline. Decorative. */
export function PetalGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 112" aria-hidden="true" focusable="false" className={cn("h-[13px] w-auto shrink-0", className)}>
      <path d="M30.8,0 H30.8 A30.8,30.8 0 0 1 61.6,30.8 V61.6 L61.6,61.6 H30.8 A30.8,30.8 0 0 1 0,30.8 V30.8 A30.8,30.8 0 0 1 30.8,0 Z" className="fill-red" />
      <path d="M80.95,23.3 H80.95 A19.35,19.35 0 0 1 100.3,42.65 V42.65 A19.35,19.35 0 0 1 80.95,62 H61.6 L61.6,62 V42.65 A19.35,19.35 0 0 1 80.95,23.3 Z" className="fill-yellow" />
      <path d="M37.2,62.3 H61.6 L61.6,62.3 V86.7 A24.4,24.4 0 0 1 37.2,111.1 H37.2 A24.4,24.4 0 0 1 12.8,86.7 V86.7 A24.4,24.4 0 0 1 37.2,62.3 Z" className="fill-brand" />
    </svg>
  );
}

/**
 * The mark, the name and its maker underneath. Kademe is presented as a Campus
 * German product on the front doors and frames: the login, the invite page, the
 * panel menu and the candidate bar. Not on the running exam's bar.
 */
export function BrandLockup({ byline, markClassName }: { byline: string; markClassName?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className="flex flex-col">
        <span className="text-[20px] font-black leading-[1.05] tracking-[-0.015em] text-ink">Kademe</span>
        <span className="flex items-center gap-1 text-[11.5px] font-bold leading-[1.1] text-muted">
          <PetalGlyph />
          {byline}
        </span>
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/visual`
Expected: PASS (if a frozen markup that includes the lockup fails, re-capture it as in Task 2 Step 4 and check the diff shows only the mark and byline).

- [ ] **Step 5: Commit**

```bash
git add src/components/visual/brand-mark.tsx src/components/visual/brand-mark.test.ts src/components/visual/*.default-markup.json
git commit -m "Draw the Kademe mark in the Campus German colours with the petal byline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The mascot, redrawn

**Files:**
- Modify: `src/components/visual/mascot.tsx`
- Modify: `src/components/visual/mascot.test.ts`

**Interfaces:**
- Consumes: Task 1 utilities (`fill-yellow`, `fill-mascot-yellow-lip`, `fill-brand`, `fill-brand-lip`, `fill-red`, `fill-red-lip`, `stroke-yellow`, `stroke-mascot-sleep`, `fill-ink`, `stroke-ink`).
- Produces: unchanged API `Mascot({ pose, size?, className? })`, `MASCOT_POSES`, `MascotPose`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/visual/mascot.test.ts` inside the describe:

```ts
  it.each(MASCOT_POSES)("%s is the yellow tallest step on a cyan and a red step, each with its lip", (pose) => {
    const html = render({ pose });
    for (const c of ["fill-yellow", "fill-mascot-yellow-lip", "fill-brand", "fill-brand-lip", "fill-red", "fill-red-lip"]) expect(html).toContain(c);
    expect(html).not.toContain("fill-accent");
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/visual/mascot.test.ts`
Expected: FAIL (`fill-yellow` missing).

- [ ] **Step 3: Redraw**

In `src/components/visual/mascot.tsx`, update the doc comment's color sentence to "Inline SVG in brand tokens only: a yellow body (the mark's tallest step) on a cyan and a red step, ink face, red cheeks at 40%." Replace `Steps`, `Body`, `cheeks`, `Eyes` and `POSES` with:

```tsx
/** A step with a flat lip under it: the lip is the same shape moved 5px down. */
function Step({ d, fill, lip }: { d: string; fill: string; lip: string }) {
  return (
    <>
      <path d={d} className={lip} transform="translate(0,5)" />
      <path d={d} className={fill} />
    </>
  );
}

const SMALL = "M42,140 H44 A16,16 0 0 1 60,156 V171 A9,9 0 0 1 51,180 H35 A9,9 0 0 1 26,171 V156 A16,16 0 0 1 42,140 Z";
const MIDDLE = "M79,116 H79 A17,17 0 0 1 96,133 V171 A9,9 0 0 1 87,180 H71 A9,9 0 0 1 62,171 V133 A17,17 0 0 1 79,116 Z";
const TALL = "M128,56 H130 A30,30 0 0 1 160,86 V166 A14,14 0 0 1 146,180 H112 A14,14 0 0 1 98,166 V86 A30,30 0 0 1 128,56 Z";

/** The two small steps every pose stands on; `stepUp` hides the arm that rests on them. */
function Steps({ stepUp = false }: { stepUp?: boolean }) {
  return (
    <>
      <Step d={SMALL} fill="fill-brand" lip="fill-brand-lip" />
      <Step d={MIDDLE} fill="fill-red" lip="fill-red-lip" />
      {stepUp ? null : <path d="M101 124 L88 140" strokeWidth="9" strokeLinecap="round" fill="none" className="stroke-yellow" />}
    </>
  );
}

/** The big step: the body every pose shares. */
function Body() {
  return <Step d={TALL} fill="fill-yellow" lip="fill-mascot-yellow-lip" />;
}

const cheeks = (y: number): ReactNode => (
  <>
    <circle cx="109" cy={y} r="5" className="fill-red opacity-40" />
    <circle cx="149" cy={y} r="5" className="fill-red opacity-40" />
  </>
);

/** Open eyes with a pupil; `up` shifts the pupils to look upwards. */
function Eyes({ up = false }: { up?: boolean }) {
  const dy = up ? -5 : 0;
  return (
    <>
      <ellipse cx="117" cy="92" rx="8" ry="9" className="fill-white" />
      <ellipse cx="141" cy="92" rx="8" ry="9" className="fill-white" />
      <circle cx="119" cy={94 + dy} r="4" className="fill-ink" />
      <circle cx="143" cy={94 + dy} r="4" className="fill-ink" />
      <circle cx="120.5" cy={92 + dy} r="1.3" className="fill-white" />
      <circle cx="144.5" cy={92 + dy} r="1.3" className="fill-white" />
    </>
  );
}

const LINE = { strokeWidth: 3.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none", className: "stroke-ink" } as const;
const ARM = { strokeWidth: 9, strokeLinecap: "round", fill: "none", className: "stroke-yellow" } as const;

const POSES: Record<MascotPose, ReactNode> = {
  wave: (
    <>
      <Steps />
      <Body />
      <path d="M156 112 Q174 98 171 78" {...ARM} />
      <circle cx="171" cy="74" r="7" className="fill-yellow" />
      <Eyes />
      {cheeks(110)}
      <path d="M121 110 Q129 118 137 110" {...LINE} />
    </>
  ),
  celebrate: (
    <>
      <Steps stepUp />
      <Body />
      <path d="M102 112 Q86 96 88 76" {...ARM} />
      <circle cx="88" cy="72" r="7" className="fill-yellow" />
      <path d="M156 112 Q174 96 171 76" {...ARM} />
      <circle cx="171" cy="72" r="7" className="fill-yellow" />
      <path d="M110 93 Q117 85 124 93" {...LINE} />
      <path d="M134 93 Q141 85 148 93" {...LINE} />
      {cheeks(108)}
      <path d="M119 106 Q129 122 139 106 Z" className="fill-ink" />
      <ellipse cx="129" cy="113" rx="4.5" ry="2.6" className="fill-red opacity-70" />
      <circle cx="46" cy="44" r="4" className="fill-yellow" />
      <circle cx="170" cy="34" r="4" className="fill-red" />
      <circle cx="186" cy="84" r="3.5" className="fill-brand" />
    </>
  ),
  // One hand on the chin: the white edge keeps the hand readable against the body.
  think: (
    <>
      <Steps />
      <Body />
      <path d="M158 150 Q178 142 168 126 Q158 116 143 120" {...ARM} />
      <Eyes up />
      {cheeks(108)}
      <circle cx="140" cy="121" r="8" strokeWidth="2.5" className="fill-yellow stroke-white" />
      <path d="M118 112 Q124 109 130 112" {...LINE} />
      <circle cx="176" cy="48" r="5" className="fill-brand" />
      <circle cx="166" cy="30" r="3.4" className="fill-red" />
    </>
  ),
  rest: (
    <>
      <Steps />
      <Body />
      <path d="M110 92 Q117 99 124 92" {...LINE} />
      <path d="M134 92 Q141 99 148 92" {...LINE} />
      {cheeks(110)}
      <path d="M124 113 Q129 117 134 113" {...LINE} />
      <path d="M172 50 H184 L172 64 H184" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-mascot-sleep" />
      <path d="M160 28 H168 L160 38 H168" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-mascot-sleep" />
    </>
  ),
};
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/visual/mascot.test.ts`
Expected: PASS (the existing "tokens only, no hex" test must still pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/visual/mascot.tsx src/components/visual/mascot.test.ts
git commit -m "Redraw the mascot as the yellow step of the Campus German mark

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Neutral sections, icon tiles, badges and status dots

**Files:**
- Modify: `src/components/visual/section-look.tsx`, `src/components/visual/icon-tile.tsx`, `src/components/ui/status-dot.tsx`
- Test: `src/components/visual/section-look.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 tokens (`bg-cream`, `text-ink`, the remapped families).
- Produces: `SECTION_LOOK[section].color === "neutral"` for all five; `IconTile` neutral = cream ground, ink icon; `StatusDot` keeps its four tones (active, done, neutral, warn), which now resolve to the brand-aligned families from Task 1.

- [ ] **Step 1: Write the failing test**

Create `src/components/visual/section-look.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SECTION_LOOK, SectionTile, type SectionKey } from "./section-look";

const SECTIONS: SectionKey[] = ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"];

describe("sections are icon + word, never five colours", () => {
  it.each(SECTIONS)("%s uses the neutral tile", (s) => {
    expect(SECTION_LOOK[s].color).toBe("neutral");
    expect(renderToStaticMarkup(createElement(SectionTile, { section: s }))).toContain("bg-cream");
  });

  it("keeps one distinct icon per section", () => {
    expect(new Set(SECTIONS.map((s) => SECTION_LOOK[s].icon)).size).toBe(5);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/visual/section-look.test.ts`
Expected: FAIL (`expected 'grape' to be 'neutral'`).

- [ ] **Step 3: Change the looks**

In `section-look.tsx` change the type to `Record<SectionKey, { color: TileColor; icon: LucideIcon }>`, set every `color` to `"neutral"`, and replace the doc comment's first sentence with: "Each exam section keeps one icon wherever it appears; the tile is neutral (Campus German redesign: sections are icon + word, never five colours)."

In `icon-tile.tsx` change `neutral: "bg-secondary text-ink"` to `neutral: "bg-cream text-ink"` and `accent: "bg-accent-soft text-accent"` stays.

In `status-dot.tsx` update the tone comment to: "active: cyan ring dot (something is happening now). done: the cyan check tone. neutral: grey. warn: yellow (needs a person's attention). No red tone: a status is never a verdict." Leave the class maps as they are (they now resolve to the brand-aligned families).

- [ ] **Step 4: Run the visual and candidate tests**

Run: `npx vitest run src/components`
Expected: PASS; a test that asserted a section family color (`grape`, `sky`...) is updated to `neutral` in this task.

- [ ] **Step 5: Commit**

```bash
git add src/components/visual/section-look.tsx src/components/visual/section-look.test.ts src/components/visual/icon-tile.tsx src/components/ui/status-dot.tsx
git commit -m "Make the five sections icon and word, without section colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Notices in yellow, no red boxes on candidate screens

**Files:**
- Create: `src/components/ui/notice.tsx`, `src/components/ui/notice.test.ts`, `src/components/candidate/no-red-notice.test.ts`
- Modify: `src/components/candidate/IntroConsent.tsx:244`, `src/components/candidate/proctor/SystemCheck.tsx:275`, `src/app/(manager)/exam/students/[id]/page.tsx:230` and `:509`

**Interfaces:**
- Produces: `NOTICE_CLASS: Record<"warn" | "neutral", string>`; `Notice({ tone?, role?, className?, children })` rendering a `<p>` with a yellow "!" glyph tile for `warn`.

- [ ] **Step 1: Write the failing tests**

`src/components/ui/notice.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice, NOTICE_CLASS } from "./notice";

describe("Notice", () => {
  it("warn is yellow-soft with ink text and a yellow glyph, never red", () => {
    expect(NOTICE_CLASS.warn).toContain("bg-yellow-soft");
    expect(NOTICE_CLASS.warn).toContain("text-ink");
    const h = renderToStaticMarkup(createElement(Notice, { role: "alert" }, "Kamera açılamadı."));
    expect(h).toContain('role="alert"');
    expect(h).toContain("bg-yellow");
    expect(h).not.toMatch(/danger|text-red|bg-red/);
  });

  it("neutral is cream with ink text", () => {
    expect(NOTICE_CLASS.neutral).toContain("bg-cream");
  });
});
```

`src/components/candidate/no-red-notice.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? files(f) : f.endsWith(".tsx") ? [f] : [];
  });
}

describe("no red notice box on a candidate screen (red rule)", () => {
  it("nothing under components/candidate draws bg-danger-soft", () => {
    const hits = files(path.resolve(process.cwd(), "src/components/candidate")).filter((f) => readFileSync(f, "utf8").includes("bg-danger-soft"));
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/ui/notice.test.ts src/components/candidate/no-red-notice.test.ts`
Expected: notice test FAIL (module missing); scan FAIL listing `IntroConsent.tsx` and `SystemCheck.tsx`.

- [ ] **Step 3: Write the component and replace the boxes**

`src/components/ui/notice.tsx`:

```tsx
import { cn } from "@/lib/cn";

/**
 * A notice: something the reader must know or fix (DESIGN.md notice-warn,
 * notice-neutral). Yellow-soft with ink text and a small yellow "!" tile for
 * a warning or an error message; cream for a neutral note. Never red: red is
 * reserved for the brand, the recording dot and a field's error frame.
 */
export const NOTICE_CLASS = {
  warn: "flex items-start gap-3 rounded-lg border-2 border-yellow-soft-lip bg-yellow-soft px-4 py-3 text-[14.5px] font-semibold leading-[1.5] text-ink",
  neutral: "flex items-start gap-3 rounded-lg border-2 border-line bg-cream px-4 py-3 text-[14.5px] font-semibold leading-[1.5] text-ink",
} as const;

export function Notice({
  tone = "warn",
  role,
  className,
  children,
}: {
  tone?: keyof typeof NOTICE_CLASS;
  role?: "alert" | "status";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p role={role} className={cn(NOTICE_CLASS[tone], className)}>
      {tone === "warn" ? (
        <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] bg-yellow text-[13px] font-black text-ink">
          !
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}
```

`IntroConsent.tsx` around line 244, replace the `<p role="alert" ...>{error}</p>` with:

```tsx
            <Notice role="alert" className="mt-2.5 justify-center text-center">
              {error}
            </Notice>
```

and add `import { Notice } from "@/components/ui/notice";`.

`SystemCheck.tsx` around line 275, replace the issue branch class `"rounded-[14px] bg-danger-soft px-5 py-3 font-semibold text-danger"` with `NOTICE_CLASS.warn` (import `NOTICE_CLASS` from `@/components/ui/notice`).

`src/app/(manager)/exam/students/[id]/page.tsx` lines 230 and 509: replace each `<p role="alert" className="... bg-danger-soft ... text-danger">{x}</p>` with `<Notice role="alert" className="mb-4">{x}</Notice>` (line 509 without `mb-4`), keeping the inner expression unchanged; add the import.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/components && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/notice.tsx src/components/ui/notice.test.ts src/components/candidate/no-red-notice.test.ts src/components/candidate/IntroConsent.tsx src/components/candidate/proctor/SystemCheck.tsx "src/app/(manager)/exam/students/[id]/page.tsx"
git commit -m "Show error and warning notices in yellow with ink text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Difficulty chip with the step glyph (teacher panel)

**Files:**
- Create: `src/components/panel/difficulty-chip.tsx`, `src/components/panel/difficulty-chip.test.ts`

**Interfaces:**
- Consumes: Task 1 tokens `bg-diff-easy`, `bg-diff-medium`, `bg-diff-hard` and their `-lip`.
- Produces: `type Difficulty = "EASY" | "MEDIUM" | "HARD"`; `DifficultyChip({ difficulty, label, className? })` (label is the translated word, the caller passes it); `StepGlyph({ steps: 1 | 2 | 3 })`. Plan 3 maps the invite wizard's shift `-1 | 0 | 1` to `EASY | MEDIUM | HARD`.

- [ ] **Step 1: Write the failing test**

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DifficultyChip } from "./difficulty-chip";

const r = (difficulty: "EASY" | "MEDIUM" | "HARD", label: string) => renderToStaticMarkup(createElement(DifficultyChip, { difficulty, label }));

describe("DifficultyChip", () => {
  it.each([
    ["EASY", "Kolay", "bg-diff-easy", 1],
    ["MEDIUM", "Orta", "bg-diff-medium", 2],
    ["HARD", "Zor", "bg-diff-hard", 3],
  ] as const)("%s says the word, shows %s filled steps and uses its tint with ink text", (d, label, tint, filled) => {
    const h = r(d, label);
    expect(h).toContain(label);
    expect(h).toContain(tint);
    expect(h).toContain("text-ink");
    expect(h.match(/data-step="on"/g)?.length).toBe(filled);
    expect(h.match(/data-step="off"/g)?.length ?? 0).toBe(3 - filled);
  });

  it("never fills red with white text", () => {
    expect(r("HARD", "Zor")).not.toMatch(/text-white|bg-red\b/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/panel/difficulty-chip.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the component**

```tsx
// kademe-owned
import { cn } from "@/lib/cn";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

const TINT: Record<Difficulty, string> = {
  EASY: "bg-diff-easy border-diff-easy-lip",
  MEDIUM: "bg-diff-medium border-diff-medium-lip",
  HARD: "bg-diff-hard border-diff-hard-lip",
};

const STEPS: Record<Difficulty, 1 | 2 | 3> = { EASY: 1, MEDIUM: 2, HARD: 3 };

/** Three rising steps, the first `steps` filled in ink: the order without relying on colour. */
export function StepGlyph({ steps }: { steps: 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 22 18" aria-hidden="true" focusable="false" className="h-3.5 w-auto shrink-0">
      {[
        { x: 1, y: 10, h: 7 },
        { x: 8, y: 5, h: 12 },
        { x: 15, y: 1, h: 16 },
      ].map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width="6" height={s.h} rx="2" data-step={i < steps ? "on" : "off"} className={i < steps ? "fill-ink" : "fill-ink/20"} />
      ))}
    </svg>
  );
}

/**
 * The difficulty of an invite (Kolay, Orta, Zor), teacher panel only: a soft
 * tint with ink text, the step glyph and the word (DESIGN.md "Color
 * psychology": the user kept cyan/yellow/red here; students never see it and
 * the printed level report never shows it).
 */
export function DifficultyChip({ difficulty, label, className }: { difficulty: Difficulty; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border-2 px-2.5 text-[13px] font-extrabold text-ink", TINT[difficulty], className)}>
      <StepGlyph steps={STEPS[difficulty]} />
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/panel/difficulty-chip.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/panel/difficulty-chip.tsx src/components/panel/difficulty-chip.test.ts
git commit -m "Add the difficulty chip with a step glyph for the teacher panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Hand-rolled filled buttons use the brand primary

**Files:**
- Modify: every `.tsx` under `src` whose class string has `bg-accent` together with `text-white` and is a primary action button (list with the command in Step 1).
- Modify: `src/components/ui/no-white-on-brand.test.ts` (add a second scan)

**Interfaces:**
- Consumes: `buttonVariants` from Task 2.

- [ ] **Step 1: List the call sites**

Run: `grep -rnE --include='*.tsx' '"[^"]*bg-accent[^"]*text-white|"[^"]*text-white[^"]*bg-accent' src`
Expected: about 20 to 40 lines (exam RecoverPanel, IntroConsent start button, SystemCheck, Finished, panel screens...). Write the list into the commit message body.

- [ ] **Step 2: Add the failing scan**

Append to `src/components/ui/no-white-on-brand.test.ts`:

```ts
describe("filled actions use the brand primary, not a hand-rolled dark fill", () => {
  it("no button class string combines bg-accent with text-white", () => {
    const offenders = files(path.resolve(process.cwd(), "src")).filter((f) => {
      const src = readFileSync(f, "utf8");
      return [...src.matchAll(/<button[^>]*className=\{?[^>]*"([^"]*)"/g)].some((m) => /\bbg-accent\b/.test(m[1]) && /\btext-white\b/.test(m[1]));
    });
    expect(offenders).toEqual([]);
  });
});
```

Run: `npx vitest run src/components/ui/no-white-on-brand.test.ts`
Expected: FAIL listing the files from Step 1 that draw a `<button>`.

- [ ] **Step 3: Replace each one**

For a `<button>` (or `Link`) whose class string is a filled primary action, replace the color part of the string (`bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted` and similar) with `buttonVariants({ variant: "primary", size: "lg" })` merged with the element's own layout classes, e.g. RecoverPanel in `src/components/candidate/exam/ExamRunner.tsx`:

```tsx
        <button
          type="button"
          disabled={busy}
          onClick={fix}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-5 h-12 w-full")}
        >
```

(import `buttonVariants` from `@/components/ui/button`). Elements that only show a state (a progress fill, a chosen matching letter, a question cell) are not actions: they stay dark cyan with white text (5.8:1). The scan only looks at class strings on `<button>` openings; if it flags a state toggle (for example a chosen radio drawn as a `<button>`), keep it as is and narrow the scan with an explicit allow list naming that file and line, with a comment saying why.

- [ ] **Step 4: Run all tests, typecheck and lint**

```bash
npx vitest run && npx tsc --noEmit -p . && npx eslint src
```

Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "Use the brand primary for every hand-rolled filled button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Look at it in the browser, then document

**Files:**
- Modify: `docs/design/RULES.md` (top: a pointer that DESIGN.md/EXPERIENCE.md of the 2026-10-16 run are the current visual contract; remove or mark superseded the color rules that contradict it)
- Modify: `docs/STATUS.md` (a "Campus German redesign, Plan 1" entry: what changed, what Plans 2 and 3 cover, not deployed)

- [ ] **Step 1: Run the app**

Run (own dev server, see `docs/STATUS.md` for the DB URL): `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform PROCTOR_DEV_FAKE=1 pnpm dev --port 3100` (only if 3100 is free; otherwise ask the owner before stopping the existing server).

- [ ] **Step 2: Check five screens with Claude in Chrome**

Open and screenshot: the sign-in page, a candidate invite welcome (`pnpm dev:link` prints a link), the system check, one C-test question, and the panel invite list. For each, compare with `docs/design/ux-designs/ux-kademe-2026-10-16/mockups/` and note: primary button cyan with ink text; no white text on cyan; no red except the recording dot; sections neutral; the mark in three colours. Write the findings (screenshot names, what differs) into the STATUS entry as Plan 2/3 input. Turn `PROCTOR_DEV_FAKE` off afterwards (never left on).

- [ ] **Step 3: Update the docs and commit**

```bash
git add docs/design/RULES.md docs/STATUS.md
git commit -m "Document the Campus German foundation and what the screen plans cover

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After this plan

- **Plan 2, candidate screens to mockup fidelity** (written after Plan 1 ships): welcome page fits 650px visible height; exam top bar, progress strip and bottom bar per DESIGN.md "Exam screen" (the bottom bar height is an open owner decision, see below); C-test and chip sizes; section intro; review; finish with the celebrate mascot; proctor warning card (yellow tile, counter pill); system check steps.
- **Plan 3, panel, report and hiring**: sign-in copy "Sınav linkinizi okulunuz iletir"; panel nav; invite Zorluk tiles and the difficulty chip in result rows (shift -1/0/+1 to EASY/MEDIUM/HARD); "Gözden geçir" yellow-soft row for "doğrulanamadı"; printed level report (ink mark, no hue, the new declared-level outcome row); integrity severities without red; hiring screens.
- **Owner decisions taken 2026-10-16 (for Plan 2 and 3):** (1) the exam bottom bar and the C-test keep the shipped sizes (one-row bar about 66px, passage 17px); only the new colors and shapes are applied there, not the spec's 92px bar and 23px passage. (2) Teacher-side wrong answers in the result review (`objective-section.tsx`) become an ink cross on cream, no red; right answers keep the cyan tick.
