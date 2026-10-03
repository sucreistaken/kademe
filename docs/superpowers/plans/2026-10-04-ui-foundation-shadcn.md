# UI Foundation (shadcn/ui) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install shadcn/ui into the existing Tailwind 4 project, map Kademe tokens and the "soft" values of `docs/design/HIRING-UX.md` section 8 onto shadcn CSS variables, and add the primitive set the hiring solution needs, without changing how any existing panel or candidate screen looks.

**Architecture:** shadcn components are copied into `src/components/ui/` (HIRING-UX 8.1) through the shadcn CLI pinned to 4.21.1, style `radix-nova` (Radix primitives), then passed through a tested normalizer that renames the two class names that collide with Kademe tokens (`accent` becomes `subtle`, shadcn's background `muted` becomes `muted-surface`), routes `cn` to `@/lib/cn` and removes shadows the rules forbid. `Button` and `Card` keep their file names and public APIs and gain the shadcn surface (variants used by the copied components, data-slot attributes, card sub-parts). Every new value lives in one place: `src/app/globals.css`, guarded by a vitest test and by a declaration-level diff of the built CSS.

**Tech Stack:** Next.js 16.3.4 (App Router, Turbopack), React 19.2.8, Tailwind CSS 4 (`@tailwindcss/postcss`), shadcn CLI 4.21.1 (`radix-nova` style), `radix-ui` 1.6.x, `class-variance-authority` 0.7.x, `cmdk` 1.1.x, `tw-animate-css` 1.4.x, vitest 5 (node environment), pnpm 11.

**Spec:** `docs/superpowers/specs/2026-10-03-platform-solutions-design.md` section 5 (sub-project 1 in section 8), with the binding token and component decisions in `docs/design/HIRING-UX.md` sections 0 (row 12), 4.1, 8.1-8.5 and 10.4. Read both. HIRING-UX wins where it is more specific than the platform spec.

## Global Constraints

- Existing screens must look the same after every task. "The same" is checked twice: the declaration diff of the production CSS (Task 1 tool) may only add lines, except the two radius lines listed in Task 2, and a Claude in Chrome walkthrough compares before and after screenshots.
- Browser checks use Claude in Chrome (`mcp__claude-in-chrome__*`) only. Never Playwright.
- shadcn CLI pinned to 4.21.1: it is installed as an exact devDependency (Task 2) and always run as `pnpm exec shadcn ...`, never `npx shadcn@latest`.
- shadcn style `radix-nova`, `rsc: true`, `tsx: true`, `tailwind.config: ""`, `cssVariables: true`, `iconLibrary: "lucide"`.
- Token values come from HIRING-UX 8.2 and 8.3 verbatim. Do not invent values.
- Kademe `--color-accent` (`#0e6a57`) and `--color-muted` (`#6e6e69`, a TEXT colour) keep their meaning. No `@theme inline` entry may redefine `--color-accent` or `--color-muted`.
- Banned components (RULES.md and HIRING-UX 8.1): `badge` (status is a dot plus text), `alert-dialog` (no "are you sure"), `chart`, `toast`, `sonner` (see the decision in Task 4). They must not exist under `src/components/ui/`.
- No dark theme: `dark:` applies only under an explicit `.dark` ancestor, which nothing renders.
- Code, comments, identifiers, commit messages: English. User-facing text: Turkish first, English second. Never write the em-dash character in any file or message.
- Commits on branch `platform/solutions`. Message: imperative English subject, a body, final line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only the files the task names (`git add <paths>`, never `git add -A`): several Claude sessions work in this repo.
- Never run `pnpm db:seed` or `pnpm db:reset`. They wipe the shared local database.
- Gates for every task that changes code: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, `pnpm test` (467 tests before this plan; the count only grows), `pnpm build`.
- Local ports: Postgres 5434, dev server 3100 (3000 and 5433 belong to another project).

## Decision: wrap, do not rewrite, the six existing primitives

HIRING-UX 8.1 says the existing `button`, `card`, `status-dot`, `undo-strip`, `inline-link` and `avatar` are "merged with their shadcn counterparts (same file name, `DisabledReason` kept)". This plan merges where a counterpart exists and adds value, and keeps the rest:

| File | Decision | Why |
|---|---|---|
| `button.tsx` | **Merge.** Same exports (`Button`, `DisabledReason`), same Kademe variants and sizes with byte-identical class strings, built with `cva`; adds the variant `outline` and the sizes `xs`, `icon`, `icon-sm`, `icon-xs` that the copied shadcn components call (`dialog`, `sheet`, `sidebar`, `input-group` pass `variant="ghost" size="icon-sm"` or `variant="outline"`), exports `buttonVariants`, adds `data-slot`/`data-variant`/`data-size`. `asChild` keeps the current `cloneElement` + `cn` merge instead of Radix `Slot`, because `Slot` concatenates class names without `tailwind-merge` and could change the look of existing `asChild` links. | The copied components import `@/components/ui/button`; one Button keeps the "one filled button" and `disabledReason` rules in one place. |
| `card.tsx` | **Merge.** `Card` root unchanged (Kademe border, 14px radius, optional elevated shadow) plus `data-slot="card"` and a `--card-spacing` of 20px (HIRING-UX 8.3: card padding 20). Adds shadcn's `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`. | New screens get the structured parts; existing cards render the same markup plus two attributes. |
| `status-dot.tsx` | **Keep.** | shadcn's counterpart is `Badge`, which RULES.md bans for status. |
| `undo-strip.tsx` | **Keep.** No `sonner`. | The strip already implements rule 4 (action first, 8 s undo, server-action form). `sonner` would add a second notification system whose stacking and hover-pause semantics do not match the 8 s contract. HIRING-UX 5.1 lists `Sonner (undo)`; this plan reads that as "the undo strip" and flags it in the final report. |
| `inline-link.tsx` | **Keep.** | shadcn has no inline text link primitive; `Button variant="link"` would colour it with `--primary`, which RULES.md rule 1 forbids for links. |
| `avatar.tsx` | **Keep.** | Kademe avatars are initials only (no photographs, a bias rule). shadcn `Avatar` exists to load images; wrapping initials in it adds DOM and nothing else. |

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/css-decls.mjs` (create) | Prints every declaration in the built CSS as sorted lines, for before/after diffs. |
| `components.json` (create) | shadcn CLI configuration (style, aliases, CSS path). |
| `package.json` (modify) | New dependencies, `ui:normalize` script. |
| `src/app/globals.css` (modify) | The single home of every token: Kademe `@theme`, shadcn `:root` variables, `@theme inline` mapping, scoped base layer for shadcn parts. |
| `src/components/ui/theme.test.ts` (create) | Guards the token mapping against drift and collisions. |
| `src/lib/shadcn-normalize.ts` (create) | Pure function that rewrites a copied shadcn file to Kademe conventions. |
| `src/lib/shadcn-normalize.test.ts` (create) | Unit tests for the normalizer. |
| `scripts/shadcn-normalize.ts` (create) | Applies the normalizer to every copied component on disk. |
| `src/components/ui/button.tsx` (modify) | Merged Button. |
| `src/components/ui/card.tsx` (modify) | Merged Card with sub-parts. |
| `src/components/ui/{input,textarea,label,select,checkbox,radio-group,switch,tabs,dialog,sheet,dropdown-menu,popover,tooltip,table,separator,skeleton,sidebar,command,collapsible,field,empty,spinner,kbd,input-group}.tsx` (create, generated then normalized) | shadcn primitives. |
| `src/hooks/use-mobile.ts` (create, generated then replaced) | Breakpoint hook used by `sidebar`, rewritten to pass the React Compiler lint rules and to use HIRING-UX's 1024px breakpoint. |
| `src/components/ui/shadcn-vendored.test.ts` (create) | Scans the copied components: normalized, no banned files. |
| `src/app/(manager)/dev/ui/page.tsx` (create) | Development-only gallery to see the primitives with Kademe tokens. 404 in production. |
| `docs/design/RULES.md` (modify) | Radius 8/12/16, new tokens, shadcn usage rules. |

Docs used for Next.js specifics: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` and `01-app/01-getting-started/03-layouts-and-pages.md` (the gallery is a plain server page under the existing `(manager)` layout; `notFound()` from `next/navigation` per `01-app/03-api-reference/04-functions/not-found.md`).

Facts verified while writing this plan (2026-10-04, scratch project, not in this repo):
- `npm view shadcn version` = 4.21.1. `https://ui.shadcn.com/r/styles/radix-nova/<name>.json` returns 200 for every component listed above, including `kbd`, `empty`, `field`, `spinner`, `collapsible`.
- `shadcn add` with a hand-written `components.json` writes `import { cn } from "cn"` (not the `utils` alias), adds the `cn` npm package, and did NOT install `class-variance-authority` (and installed `radix-ui` only for some components). Dependencies are therefore installed explicitly below and `cn` is removed after every add.
- `shadcn add` did not modify `globals.css` for any component in the list (including `sidebar`).
- `shadcn add` skips a file that already exists (`button.tsx`), printing "Skipped 1 file".
- Copied components use `bg-accent`, `text-accent-foreground`, `bg-muted`, `bg-muted/50`, `shadow-md`, `shadow-lg`, `shadow-sm`, `focus:bg-accent`, and rely on a global `border-color` for bare `border`/`border-b` (`table`, `card`, `sidebar`).
- The repo's ESLint config reports exactly one error on the copied set: `react-hooks/set-state-in-effect` in `src/hooks/use-mobile.ts`.
- Existing screens use radius tokens only as `rounded-sm` on three 3px-high bars in `src/components/candidate/Countdown.tsx` (radius clamps to 1.5px either way) and never use `rounded-lg`/`rounded-xl`. They use `shadow-panel` (5x) and `shadow-modal` (2x), so those two keep their current values here.

---

### Task 1: CSS declaration snapshot and the "before" baseline

**Files:**
- Create: `scripts/css-decls.mjs`

**Interfaces:**
- Produces: `node scripts/css-decls.mjs` prints sorted lines `context | property: value` for every declaration under `.next/static/**/*.css`. Later tasks diff against `~/kademe-ui-baseline/before.txt`.

- [ ] **Step 1: Write the script**

```js
// scripts/css-decls.mjs
/**
 * Prints every CSS declaration the production build ships, one per line, as
 * "at-rule > selector | property: value", sorted and de-duplicated.
 *
 * Two runs, before and after a styling change, compared with `comm`, show
 * exactly which declarations were removed or changed. That is how this repo
 * checks "existing screens look the same" without trusting eyes alone.
 *
 *   pnpm build && node scripts/css-decls.mjs > ~/kademe-ui-baseline/after.txt
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve("package.json"));
// postcss is not hoisted to the root; borrow the copy Tailwind's plugin uses.
const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith(".css") ? [full] : [];
  });
}

const files = cssFiles(path.resolve(".next/static"));
if (files.length === 0) {
  console.error("No CSS under .next/static. Run pnpm build first.");
  process.exit(1);
}
const lines = new Set();
for (const file of files) {
  postcss.parse(readFileSync(file, "utf8")).walkDecls((decl) => {
    const chain = [];
    for (let node = decl.parent; node && node.type !== "root"; node = node.parent) {
      chain.unshift(node.type === "rule" ? node.selector : `@${node.name} ${node.params}`);
    }
    lines.add(`${chain.join(" > ")} | ${decl.prop}: ${decl.value}${decl.important ? " !important" : ""}`);
  });
}
process.stdout.write([...lines].sort().join("\n") + "\n");
```

- [ ] **Step 2: Build the current tree and record the baseline**

Run:
```bash
cd /Users/sucreistaken/Desktop/Projects/recruitement
git status --short   # must be clean apart from this script
pnpm build
mkdir -p ~/kademe-ui-baseline
node scripts/css-decls.mjs > ~/kademe-ui-baseline/before.txt
wc -l ~/kademe-ui-baseline/before.txt
grep -c "radius-sm: 6px" ~/kademe-ui-baseline/before.txt
```
Expected: build succeeds (51 routes per `docs/STATUS.md`), the baseline has several hundred lines (859 on 2026-10-04), and the last command prints `1`. The baseline lives outside the repo on purpose.

- [ ] **Step 3: Take the "before" screenshots with Claude in Chrome**

Start the dev server against the shared local database (read-only use, no seed):
```bash
docker compose up -d
lsof -nP -iTCP:3100 -sTCP:LISTEN || pnpm dev --port 3100
```
If port 3100 is already served by a peer session, use that server and tell the peer you are only reading pages.

Load the Claude in Chrome tools in one call: `ToolSearch` with `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp`. Log in as `kadiraycareer@gmail.com` / `kademe-dev-2026`. Take a full-window screenshot (`computer` action `screenshot`) of each page below at a 1440px wide window and keep them in the conversation for Task 5:

Panel: `/login` (before logging in), `/dashboard`, `/students`, `/students/<id of "Zeynep Arslan">` with `?tab=summary`, `?tab=WRITING`, `?tab=integrity`, `/students/new`, `/exams`, `/exams/<any id>`, `/exams/new`, `/bank`, `/bank/<any id>`, `/settings`, `/settings/users/new`, `/settings/audit`.
Candidate: create a link with `pnpm dev:link` (adds one invitation row, does not wipe anything) and screenshot `/a/<token>` (consent), then `/a/<token>/rights`. Screenshot `/a/<an invalid token of 30 x characters>` (link problem screen).

- [ ] **Step 4: Commit**

```bash
git add scripts/css-decls.mjs
git commit -m "Add a CSS declaration snapshot script for visual regression checks" -m "Prints every declaration of the built CSS as sorted lines so a styling change can be diffed against a baseline before anyone looks at screenshots." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dependencies, components.json and the token mapping

**Files:**
- Create: `components.json`
- Create: `src/components/ui/theme.test.ts`
- Modify: `src/app/globals.css` (whole file shown below)
- Modify: `package.json`, `pnpm-lock.yaml` (through pnpm)

**Interfaces:**
- Produces Tailwind utilities used by later tasks and by Plan 2: `bg-background`, `text-foreground`, `bg-card`, `bg-popover`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted-surface`, `text-muted-foreground`, `bg-subtle`, `text-subtle-foreground`, `bg-brand-soft`, `text-destructive`, `border-border`, `border-input`, `ring-ring`, `bg-sidebar` and the `sidebar-*` family, `rounded-sm|md|lg|xl` = 8/10/12/16px, `shadow-overlay`, `shadow-panel-soft`, spacing `p-card`, `p-card-candidate`, `px-page`, `gap-section`, `h-row`, `gap-field`, easing `ease-soft`.
- The CSS variable names `--subtle`, `--brand-soft`, `--muted` (shadcn background muted) etc. are the names HIRING-UX 8.2 uses.

- [ ] **Step 1: Write the failing token test**

```ts
// src/components/ui/theme.test.ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run src/components/ui/theme.test.ts`
Expected: FAIL with `no "@theme inline {" block in globals.css` (and the radius assertions failing).

- [ ] **Step 3: Install the dependencies**

```bash
pnpm add radix-ui@^1.6.7 class-variance-authority@^0.7.1 cmdk@^1.1.1 tw-animate-css@^1.4.0
pnpm add -D shadcn@4.21.1
```
Expected: `package.json` gains the four dependencies and `"shadcn": "4.21.1"` in devDependencies. `shadcn` is a devDependency because `globals.css` imports `shadcn/tailwind.css` at build time; the production deploy (`pnpm install --frozen-lockfile` without `--prod`, see the memory note on the VM recipe) installs devDependencies.

- [ ] **Step 4: Write `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 5: Replace `src/app/globals.css`**

Keep every existing token and comment; the additions are the imports, the dark variant, the radius and new tokens in `@theme`, the `:root` variables, the `@theme inline` mapping and the scoped base layer. Full file:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

/*
 * shadcn components carry `dark:` classes. Kademe has no dark theme
 * (HIRING-UX 9), so `dark:` applies only under an explicit .dark ancestor,
 * which nothing renders. Without this line `dark:` would follow the operating
 * system and the components would change colour on a dark-mode laptop.
 */
@custom-variant dark (&:is(.dark *));

/*
 * Kademe design tokens.
 * Source of truth: Claude Design canvas "Kademe Canvas.dc.html" (artboard t0),
 * and for the "soft" values docs/design/HIRING-UX.md section 8.
 *
 * Hard rules from the canvas, do not break them:
 *  - One accent colour, used in exactly three places: primary CTA, active state, timer.
 *  - Card borders, background blocks and secondary buttons are NEVER accent-coloured.
 *  - One filled button per screen. Everything else is outline or text.
 *  - Status is a dot plus text, never a badge pill.
 *  - Shadows only on sticky panels and modals.
 */

@theme {
  /* Neutral axis */
  --color-surface: #ffffff;
  --color-canvas: #f6f5f2;
  --color-line: #e7e7e4;
  --color-muted: #6e6e69;
  --color-ink: #131311;

  /* The single accent. Deep green: calm, trustworthy, far from Airbnb coral. */
  --color-accent: #0e6a57;
  --color-accent-hover: #0a5245;
  --color-accent-soft: #f1f7f5; /* selection tint, read off the canvas */

  /*
   * Inline validation only. There is NO amber in this product: the canvas shows
   * "half scored", "expiring" and "expired" as plain grey dots, because a table
   * full of traffic lights reads as a verdict the system has not earned. Anything
   * that wants to warn uses `--color-ink-3` through StatusDot's "warn" tone.
   */
  --color-danger: #8c2f2a;

  /*
   * The rest of the neutral ramp, read straight off the canvas artboards. The
   * five above cover most of the UI, but the candidate screens use a finer set
   * of tints (a softer page ground, a second and third text weight, a lighter
   * hairline) and those had no names. Naming them here keeps the screens off
   * arbitrary hex values.
   */
  --color-paper: #fbfbf9; /* candidate page ground, softer than canvas */
  --color-ink-2: #4a4a45; /* body copy under a heading */
  --color-ink-3: #a8a8a3; /* the quietest text on a screen */
  --color-hairline: #efefec; /* lighter than line, used under bars */
  --color-line-strong: #d8d8d3; /* an input border that must be findable */
  --color-line-mute: #c0c0ba; /* an unchecked control outline */
  --color-underline: #c8c8c3; /* underline colour for inline links */
  --color-disabled: #f2f2ef; /* a disabled filled button */
  --color-row-line: #f4f4f1; /* divider inside a summary card */
  --color-panel: #1a1a17; /* the bar under a video panel */
  --color-panel-top: #26261f; /* video placeholder gradient, start */
  --color-panel-bottom: #131311; /* video placeholder gradient, end */

  /* The dark "manager only" column in the template builder (canvas Y2). */
  --color-vault: #1a1a17; /* panel ground */
  --color-vault-box: #242420; /* a field inside the panel */
  --color-vault-line: #33332e; /* its border */
  --color-vault-chip: #44443e; /* competency chip border */
  --color-vault-flag: #3a2f2c; /* red flag row border */
  --color-vault-mark: #c08a7e; /* the em dash before a red flag */
  --color-vault-label: #8a8a83; /* field labels on the dark ground */
  --color-vault-text: #f2f1ed; /* body text on the dark ground */

  --font-sans: var(--font-figtree), system-ui, sans-serif;

  /*
   * Radius scale 8 / 10 / 12 / 16 (HIRING-UX 8.3, accepted for both solutions
   * in 10.4). Existing screens use literal px radii (rounded-[10px] and so on),
   * so this scale changes nothing they draw; it is the scale new screens and
   * the shadcn parts read.
   */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /*
   * Shadows are reserved for sticky panels and modals. `panel` and `modal`
   * are the values the exam screens use today and keep until they migrate;
   * `panel-soft` and `overlay` are HIRING-UX 8.3 and are what new screens and
   * shadcn overlays use. When the exam screens move over, `--shadow-panel`
   * takes the soft value and the `-soft` name goes away.
   */
  --shadow-panel: 0 1px 3px rgba(0, 0, 0, 0.07);
  --shadow-modal: 0 8px 32px rgba(0, 0, 0, 0.16);
  --shadow-panel-soft: 0 1px 2px rgb(19 19 17 / 0.04), 0 4px 16px rgb(19 19 17 / 0.05);
  --shadow-overlay: 0 12px 40px rgb(19 19 17 / 0.12);

  /* Spacing, HIRING-UX 8.3. Base unit 4px stays Tailwind's. */
  --spacing-page: 2rem; /* panel page edge */
  --spacing-section: 2rem; /* between sections */
  --spacing-card: 1.25rem; /* inside a panel card */
  --spacing-card-candidate: 1.75rem; /* inside a candidate card */
  --spacing-row: 3.25rem; /* table row height */
  --spacing-field: 1rem; /* between form fields */

  /* Motion, HIRING-UX 8.5: open/close and sheet/dialog curve. */
  --ease-soft: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* Canvas widths: manager is dense, candidate is deliberately narrower */
  --container-manager: 1360px;
  --container-candidate: 1000px;
}

/*
 * shadcn variables, values from HIRING-UX 8.2. Two renames keep Kademe names
 * intact: shadcn's `accent` (a hover ground) is `subtle` here, because
 * `accent` is the brand colour; and shadcn's background `muted` is exposed as
 * the utility `muted-surface`, because Kademe's `muted` is a text colour.
 * The copied components are rewritten accordingly by scripts/shadcn-normalize.ts.
 */
:root {
  color-scheme: light;
  --radius: 0.75rem;
  --background: #f6f5f2;
  --foreground: #131311;
  --card: #ffffff;
  --card-foreground: #131311;
  --popover: #ffffff;
  --popover-foreground: #131311;
  --primary: #0e6a57;
  --primary-foreground: #ffffff;
  --secondary: #f1f0ec;
  --secondary-foreground: #131311;
  --muted: #f1f0ec;
  --muted-foreground: #6e6e69;
  --subtle: #f1f0ec;
  --subtle-foreground: #131311;
  --brand-soft: #eef6f3;
  --destructive: #8c2f2a;
  --border: #e7e7e4;
  --input: #d8d8d3;
  --ring: #0e6a57;
  --sidebar: #fbfbf9;
  --sidebar-foreground: #131311;
  --sidebar-primary: #0e6a57;
  --sidebar-primary-foreground: #ffffff;
  /* Hover ground in the menu. The active item is styled by the nav itself
     (brand-soft ground, accent text, 2px accent line), HIRING-UX 4.1. */
  --sidebar-accent: #f1f0ec;
  --sidebar-accent-foreground: #131311;
  --sidebar-border: #e7e7e4;
  --sidebar-ring: #0e6a57;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted-surface: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-subtle: var(--subtle);
  --color-subtle-foreground: var(--subtle-foreground);
  --color-brand-soft: var(--brand-soft);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

/*
 * shadcn parts draw bare `border` and `border-b` and expect a global border
 * colour. A global `*` rule would recolour every existing Kademe border that
 * relies on currentColor, so the default applies only to elements that carry
 * a shadcn `data-slot` attribute.
 */
@layer base {
  [data-slot] {
    border-color: var(--border);
    outline-color: color-mix(in oklab, var(--ring) 50%, transparent);
  }
}

body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Keyboard focus stays visible everywhere. The evaluation screen is driven by
   the keyboard, so this is load-bearing, not decoration. */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Tabular figures for every countdown and score, so digits do not jump. */
.tnum {
  font-variant-numeric: tabular-nums;
}
```

Note: the previous `:root { color-scheme: light; }` block is folded into the new `:root` block; there is exactly one `:root {` in the file (the test reads the first one).

- [ ] **Step 6: Run the token test**

Run: `pnpm exec vitest run src/components/ui/theme.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Diff the built CSS against the baseline**

```bash
pnpm build
node scripts/css-decls.mjs > ~/kademe-ui-baseline/after-tokens.txt
comm -23 ~/kademe-ui-baseline/before.txt ~/kademe-ui-baseline/after-tokens.txt
```
Expected: exactly these removed lines (both are theme variable values, explained in the `@theme` comment; their only legacy consumer is `rounded-sm` on 3px bars, where the radius clamps to 1.5px):
```
@layer theme > :root,:host | --radius-sm: 6px
```
and, only if the baseline contained it, `@layer theme > :root,:host | --radius-lg: 14px`. Any other removed line is a regression: stop and fix before continuing.

Then review the additions:
```bash
comm -13 ~/kademe-ui-baseline/before.txt ~/kademe-ui-baseline/after-tokens.txt | grep -vE '^(@layer theme > :root,:host|:root|@layer base > \[data-slot\]|@layer utilities > \.|@keyframes |@property |@layer properties)' 
```
Expected: no output. Any line printed is a new rule that could reach existing elements; read it and justify it in the commit body or remove its source.

- [ ] **Step 8: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add package.json pnpm-lock.yaml components.json src/app/globals.css src/components/ui/theme.test.ts
git commit -m "Map Kademe and HIRING-UX tokens onto shadcn variables" -m "Adds shadcn, radix-ui, cva, cmdk and tw-animate-css, a components.json for the radix-nova style, and the HIRING-UX 8.2 values as shadcn variables. accent and muted keep their Kademe meaning; the shadcn equivalents are exposed as subtle and muted-surface. A test pins every value and forbids collisions. Built CSS only gained declarations, apart from the radius-sm value whose sole legacy use is a 3px bar." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Normalizer and the merged Button and Card

**Files:**
- Create: `src/lib/shadcn-normalize.ts`
- Create: `src/lib/shadcn-normalize.test.ts`
- Create: `scripts/shadcn-normalize.ts`
- Modify: `src/components/ui/button.tsx` (whole file)
- Modify: `src/components/ui/card.tsx` (whole file)
- Modify: `package.json` (script `ui:normalize`)

**Interfaces:**
- Produces: `normalizeShadcnSource(source: string): string` (idempotent).
- Produces: `pnpm ui:normalize` rewrites every `.tsx` in `src/components/ui/` that is not one of the six Kademe files, and `src/hooks/*.ts`.
- Produces: `Button` props `variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"`, `size?: "sm" | "md" | "lg" | "xs" | "icon" | "icon-sm" | "icon-xs"`, `disabledReason?: string`, `asChild?: boolean`; `buttonVariants` (cva); `DisabledReason` unchanged.
- Produces: `Card` (unchanged props `elevated?: boolean`) plus `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`.

- [ ] **Step 1: Write the failing normalizer test**

```ts
// src/lib/shadcn-normalize.test.ts
import { describe, expect, it } from "vitest";
import { normalizeShadcnSource } from "./shadcn-normalize";

describe("normalizeShadcnSource", () => {
  it("routes cn to the project helper", () => {
    expect(normalizeShadcnSource('import { cn } from "cn"\n')).toBe('import { cn } from "@/lib/cn"\n');
  });

  it("renames shadcn accent to subtle, keeping variants and opacity", () => {
    const src = '"focus:bg-accent focus:text-accent-foreground data-open:bg-accent hover:bg-accent/50"';
    expect(normalizeShadcnSource(src)).toBe(
      '"focus:bg-subtle focus:text-subtle-foreground data-open:bg-subtle hover:bg-subtle/50"',
    );
  });

  it("renames the muted background but leaves muted-foreground alone", () => {
    const src = '"bg-muted bg-muted/50 text-muted-foreground hover:bg-muted"';
    expect(normalizeShadcnSource(src)).toBe(
      '"bg-muted-surface bg-muted-surface/50 text-muted-foreground hover:bg-muted-surface"',
    );
  });

  it("leaves text-muted alone: in Kademe it already means grey text", () => {
    expect(normalizeShadcnSource('"text-muted"')).toBe('"text-muted"');
  });

  it("does not touch the sidebar tokens", () => {
    const src = '"bg-sidebar-accent text-sidebar-accent-foreground"';
    expect(normalizeShadcnSource(src)).toBe(src);
  });

  it("turns overlay shadows into the overlay token and drops small shadows", () => {
    expect(normalizeShadcnSource('"shadow-md"')).toBe('"shadow-overlay"');
    expect(normalizeShadcnSource('"shadow-lg"')).toBe('"shadow-overlay"');
    expect(normalizeShadcnSource('"data-active:shadow-sm"')).toBe('"data-active:shadow-none"');
    expect(normalizeShadcnSource('"shadow-none"')).toBe('"shadow-none"');
  });

  it("is idempotent", () => {
    const once = normalizeShadcnSource('import { cn } from "cn"\n"bg-accent bg-muted shadow-md"');
    expect(normalizeShadcnSource(once)).toBe(once);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run src/lib/shadcn-normalize.test.ts`
Expected: FAIL, `Failed to resolve import "./shadcn-normalize"`.

- [ ] **Step 3: Implement the normalizer and its runner**

```ts
// src/lib/shadcn-normalize.ts
/**
 * Rewrites a component copied by the shadcn CLI to this project's conventions.
 * Run after every `shadcn add` (pnpm ui:normalize). Idempotent.
 *
 *  - `cn` comes from @/lib/cn (clsx + tailwind-merge), not the `cn` package
 *    the CLI installs: one class merger, whose behaviour the screens rely on.
 *  - shadcn's `accent` is a neutral hover ground; in Kademe `accent` is the
 *    brand colour. HIRING-UX 8.1 renames it `subtle`.
 *  - shadcn's `bg-muted` is a background; Kademe's `muted` is a text colour.
 *    The background is exposed as `muted-surface`.
 *  - RULES.md: shadows only on sticky panels and modals. Overlay shadows become
 *    the HIRING-UX overlay token; small decorative shadows are removed.
 */
const UTILITY = "(bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)";
/** `text-muted` already means grey text in Kademe, so text is not renamed. */
const SURFACE_UTILITY = "(bg|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)";

export function normalizeShadcnSource(source: string): string {
  return source
    .replace(/from "cn"/g, 'from "@/lib/cn"')
    .replace(new RegExp(`\\b${UTILITY}-accent-foreground\\b`, "g"), "$1-subtle-foreground")
    .replace(new RegExp(`\\b${UTILITY}-accent(?![\\w-])`, "g"), "$1-subtle")
    .replace(new RegExp(`\\b${SURFACE_UTILITY}-muted(?![\\w-])`, "g"), "$1-muted-surface")
    .replace(/\bshadow-(md|lg|xl|2xl)\b/g, "shadow-overlay")
    .replace(/\bshadow-(xs|sm)\b/g, "shadow-none");
}
```

```ts
// scripts/shadcn-normalize.ts
/**
 * Applies normalizeShadcnSource to every shadcn component on disk. The six
 * Kademe primitives are hand-maintained and skipped.
 *
 *   pnpm exec shadcn add <names> --yes && pnpm ui:normalize
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeShadcnSource } from "../src/lib/shadcn-normalize";

const KADEME_OWNED = new Set(["button.tsx", "card.tsx", "status-dot.tsx", "undo-strip.tsx", "inline-link.tsx", "avatar.tsx"]);
const targets = [
  ...readdirSync("src/components/ui")
    .filter((f) => f.endsWith(".tsx") && !KADEME_OWNED.has(f))
    .map((f) => path.join("src/components/ui", f)),
  ...(() => {
    try {
      return readdirSync("src/hooks").filter((f) => f.endsWith(".ts")).map((f) => path.join("src/hooks", f));
    } catch {
      return [];
    }
  })(),
];
let changed = 0;
for (const file of targets) {
  const before = readFileSync(file, "utf8");
  const after = normalizeShadcnSource(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
    console.log(`normalized ${file}`);
  }
}
console.log(`${changed} of ${targets.length} file(s) changed`);
```

Add to `package.json` `scripts`: `"ui:normalize": "tsx scripts/shadcn-normalize.ts"`.

- [ ] **Step 4: Run the normalizer test**

Run: `pnpm exec vitest run src/lib/shadcn-normalize.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Replace `src/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Canvas rule: exactly ONE filled button per screen. Everything else is outline
 * or text. The accent colour appears here, on active state, and on the timer.
 * Nowhere else.
 *
 * A disabled button must always say why it is disabled, so `disabledReason` is
 * required whenever `disabled` is set. Making the reason a separate prop stops
 * anyone shipping a dead button with no explanation.
 *
 * This is also the shadcn Button (HIRING-UX 8.1): the copied shadcn parts
 * import it, so it carries the extra variant and sizes they use (`outline`,
 * `xs`, `icon`, `icon-sm`, `icon-xs`) and the data-slot attributes. The Kademe
 * variants and sizes keep their exact class strings, so existing screens draw
 * the same pixels.
 */
const SECONDARY =
  "bg-surface text-ink border border-line hover:bg-canvas " +
  "disabled:text-muted disabled:hover:bg-surface";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium " +
    "transition-colors disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted",
        secondary: SECONDARY,
        /** shadcn's name for the same thing; used by the copied dialog footer. */
        outline: SECONDARY,
        ghost: "bg-transparent text-muted hover:text-ink hover:bg-line/50 disabled:text-line",
        danger: "bg-surface text-danger border border-line hover:bg-danger/5 disabled:text-muted",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        xs: "h-6 px-2 text-xs",
        icon: "size-10 p-0",
        "icon-sm": "size-8 p-0",
        "icon-xs": "size-6 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Required when disabled. Rendered next to the button, not as a tooltip. */
    disabledReason?: string;
    /**
     * Render the single child element with the button styling instead of a
     * <button>. Use it for navigation (a Link that should look like the primary
     * action) so the markup stays a real anchor and keeps middle-click, copy link
     * and keyboard behaviour.
     */
    asChild?: boolean;
  };

export function Button({
  className,
  variant = "secondary",
  size = "md",
  disabled,
  disabledReason,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const slot = { "data-slot": "button", "data-variant": variant ?? "secondary", "data-size": size ?? "md" };

  if (asChild) {
    if (!React.isValidElement(children)) {
      throw new Error("Button asChild expects exactly one element child");
    }
    // cloneElement + cn rather than Radix Slot: Slot joins class names without
    // tailwind-merge, which would change existing asChild links.
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      ...slot,
      className: cn(classes, child.props.className),
    });
  }

  return (
    <button
      // Default to "button", not the HTML default of "submit". A button placed
      // inside a form to do something local (reset values, toggle a panel)
      // otherwise submits the form and silently discards its own onClick.
      type={props.type ?? "button"}
      {...slot}
      className={classes}
      disabled={disabled}
      aria-describedby={disabled && disabledReason ? props.id + "-why" : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Renders the reason a button is disabled. Never a tooltip: it must be readable.
 *
 * `className` exists for the one case where the reason cannot take up a line of
 * its own: a disabled control inside a 90px table cell. Pass "sr-only" there and
 * make sure the same reason is already visible elsewhere in the row.
 */
export function DisabledReason({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className={cn("text-[13px] text-muted", className)}>
      {children}
    </p>
  );
}
```

- [ ] **Step 6: Replace `src/components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Canvas rule: card borders are never accent-coloured, and shadow is reserved
 * for sticky panels and modals. A plain card gets a hairline border only.
 *
 * The sub-parts below are shadcn's (HIRING-UX 8.1), for new screens. They read
 * `--card-spacing`, set on the root to 20px (HIRING-UX 8.3: panel card padding);
 * existing cards do not use the sub-parts and draw exactly as before.
 */
export function Card({
  className,
  elevated = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-[14px] border border-line bg-surface [--card-spacing:--spacing(5)]",
        elevated && "shadow-[0_1px_3px_rgba(0,0,0,0.07)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1 px-(--card-spacing) pt-(--card-spacing)",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-[16px] font-semibold text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-[13px] text-muted", className)} {...props} />;
}

export function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-(--card-spacing)", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center border-t border-line px-(--card-spacing) py-4", className)}
      {...props}
    />
  );
}
```

Typography in the sub-parts follows HIRING-UX 8.4 (section heading 16/600, meta 13 muted) instead of shadcn's defaults; the footer has no tinted ground, because RULES.md does not allow background blocks as decoration.

- [ ] **Step 7: Prove Button output did not change**

Add this test to the same commit:

```ts
// src/components/ui/button.test.ts
import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";
import { cn } from "@/lib/cn";

/** The exact strings the pre-shadcn Button produced (commit a99b878). */
const BEFORE = {
  base: "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed select-none",
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas disabled:text-muted disabled:hover:bg-surface",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-line/50 disabled:text-line",
  danger: "bg-surface text-danger border border-line hover:bg-danger/5 disabled:text-muted",
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
} as const;

describe("Button keeps its classes", () => {
  for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
    for (const size of ["sm", "md", "lg"] as const) {
      it(`${variant} ${size}`, () => {
        expect(cn(buttonVariants({ variant, size }))).toBe(cn(BEFORE.base, BEFORE[variant], BEFORE[size]));
      });
    }
  }

  it("outline is the secondary look", () => {
    expect(cn(buttonVariants({ variant: "outline", size: "md" }))).toBe(
      cn(buttonVariants({ variant: "secondary", size: "md" })),
    );
  });
});
```

Run: `pnpm exec vitest run src/components/ui/button.test.ts src/lib/shadcn-normalize.test.ts src/components/ui/theme.test.ts`
Expected: PASS (13 + 7 + theme cases).

- [ ] **Step 8: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/lib/shadcn-normalize.ts src/lib/shadcn-normalize.test.ts scripts/shadcn-normalize.ts src/components/ui/button.tsx src/components/ui/button.test.ts src/components/ui/card.tsx package.json
git commit -m "Merge Button and Card with their shadcn counterparts" -m "Button is built with cva and carries the variant and sizes the copied shadcn parts call, with the Kademe class strings unchanged (a test pins them). Card gains the shadcn sub-parts on the same root. Adds the normalizer that rewrites copied shadcn files to Kademe token names." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Copy the shadcn primitives

**Files:**
- Create (generated, then normalized): `src/components/ui/input.tsx`, `textarea.tsx`, `label.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `tabs.tsx`, `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `tooltip.tsx`, `table.tsx`, `separator.tsx`, `skeleton.tsx`, `sidebar.tsx`, `command.tsx`, `collapsible.tsx`, `field.tsx`, `empty.tsx`, `spinner.tsx`, `kbd.tsx`, `input-group.tsx`
- Create: `src/hooks/use-mobile.ts` (generated by `sidebar`, then replaced)
- Create: `src/components/ui/shadcn-vendored.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `Button` sizes/variants and `pnpm ui:normalize` from Task 3; tokens from Task 2.
- Produces for Plan 2: `Sidebar`, `SidebarProvider`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarHeader`, `SidebarFooter`, `SidebarInset`, `SidebarTrigger` from `@/components/ui/sidebar`; `useIsMobile()` from `@/hooks/use-mobile` (true below 1024px).

- [ ] **Step 1: Write the failing vendored-files test**

```ts
// src/components/ui/shadcn-vendored.test.ts
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
const UTILITY = "(bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)";
const SURFACE_UTILITY = "(bg|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)";

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
      expect(src, file).not.toMatch(/\bshadow-(xs|sm|md|lg|xl|2xl)\b/);
    }
  });

  it("the cn package is not a dependency", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(pkg.dependencies?.cn).toBeUndefined();
  });
});
```

Run: `pnpm exec vitest run src/components/ui/shadcn-vendored.test.ts`
Expected: FAIL (`input is present` and the others).

- [ ] **Step 2: Add the components**

```bash
pnpm exec shadcn add input textarea label select checkbox radio-group switch tabs dialog sheet dropdown-menu popover tooltip table separator skeleton sidebar command collapsible field empty spinner kbd --yes
git status --short
git diff --stat src/app/globals.css
```
Expected: the CLI creates the listed files plus `input-group.tsx` and `src/hooks/use-mobile.ts`, prints `Skipped 1 file` for `button.tsx`, and `git diff --stat src/app/globals.css` prints nothing. If `globals.css` changed, restore it with `git checkout src/app/globals.css` (Task 2 is the source of truth for tokens) and note it in the commit body. If the CLI asks a question, answer so that no existing file is overwritten.

- [ ] **Step 3: Normalize and clean dependencies**

```bash
pnpm ui:normalize
pnpm remove cn
grep -rn 'from "cn"' src/components/ui src/hooks || echo "no cn imports"
```
Expected: the normalizer reports the changed files, `pnpm remove cn` succeeds (if pnpm says `cn` is not a dependency, the CLI did not add it this time; continue), and the grep prints `no cn imports`.

- [ ] **Step 4: Replace `src/hooks/use-mobile.ts`**

The generated hook calls `setState` inside an effect, which the repo's `react-hooks/set-state-in-effect` rule rejects, and it switches at 768px, while HIRING-UX 4.1 switches the panel menu to a sheet below 1024px.

```ts
"use client";

import * as React from "react";

/** HIRING-UX 4.1: below 1024px the panel menu becomes a sheet. */
const MOBILE_BREAKPOINT = 1024;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** Reads the media query through useSyncExternalStore: no effect, no extra render. */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
```

- [ ] **Step 5: Run the test and the gates**

```bash
pnpm exec vitest run src/components/ui/shadcn-vendored.test.ts
pnpm exec tsc --noEmit
pnpm exec eslint src scripts
pnpm test
```
Expected: PASS everywhere. If `tsc` reports a prop that the merged `Button` does not accept (a size or variant name used by a copied file), add exactly that size or variant to `buttonVariants` in `button.tsx` with classes that follow the existing Kademe scale (radius `rounded-[10px]`, heights 24/32/40/48px), and add a line for it to `button.test.ts` only if it changes an existing combination (it must not). Do not edit the copied component to dodge the type.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui src/hooks/use-mobile.ts package.json pnpm-lock.yaml
git commit -m "Add the shadcn primitives the hiring solution needs" -m "radix-nova components copied with the shadcn CLI 4.21.1 and normalized: accent renamed subtle, background muted renamed muted-surface, overlay shadows on the overlay token, small shadows removed, cn from @/lib/cn. Badge, alert dialog, chart, toast and sonner are deliberately absent and a test keeps them out. use-mobile is rewritten on useSyncExternalStore with the 1024px breakpoint from HIRING-UX 4.1." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rules, gallery and the final visual gate

**Files:**
- Modify: `docs/design/RULES.md`
- Create: `src/app/(manager)/dev/ui/page.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `/dev/ui` (development only) for checking primitives against tokens; updated RULES.md that Plan 2 and sub-project 3 follow.

- [ ] **Step 1: Update `docs/design/RULES.md`**

Replace rule 8 and the "Tokens" section, and add a "shadcn/ui" section. The resulting sections:

```markdown
8. Font: Figtree, weights 400/500/600/700 (700 only for large numbers on new
   screens, HIRING-UX 8.4). Radius 8 / 10 / 12 / 16 plus full (HIRING-UX 8.3:
   sm 8 small items inside fields, md 10 buttons and fields, lg 12 cards,
   xl 16 the main candidate card and sheet edges). Existing exam screens still
   use literal px radii and move over screen by screen. Spacing base 4px.

## Tokens

Defined in `src/app/globals.css` and nowhere else.

- Kademe tokens under `@theme`, real Tailwind utilities: `bg-surface`,
  `bg-canvas`, `border-line`, `text-muted`, `text-ink`, `bg-accent`,
  `text-accent`, `bg-accent-soft`, `text-warn`, `text-danger`.
- shadcn variables under `:root` with the HIRING-UX 8.2 values, exposed by
  `@theme inline`: `bg-background`, `bg-card`, `bg-popover`, `bg-primary`,
  `bg-secondary`, `bg-muted-surface` (shadcn's background "muted"),
  `text-muted-foreground`, `bg-subtle` (shadcn's "accent", a neutral hover
  ground), `bg-brand-soft` (active nav and selected row), `text-destructive`,
  `border-border`, `border-input`, `ring-ring`, `bg-sidebar` and `sidebar-*`.
- `accent` always means the brand green and `muted` always means grey text.
  A shadcn class that says `accent` or `muted` for a background is a bug; the
  normalizer (`pnpm ui:normalize`) and `shadcn-vendored.test.ts` catch it.
- Shadows: `shadow-panel` and `shadow-modal` (exam screens, unchanged values),
  `shadow-panel-soft` and `shadow-overlay` (HIRING-UX 8.3, new screens and
  shadcn overlays). Still only on sticky panels and modals.
- Spacing tokens: `px-page`, `gap-section`, `p-card`, `p-card-candidate`,
  `h-row`, `gap-field`. Easing: `ease-soft`.
- Use `.tnum` on every countdown and score so digits do not jump.

## shadcn/ui

- Components live in `src/components/ui/` (style `radix-nova`, CLI pinned in
  devDependencies). Add one with
  `pnpm exec shadcn add <name> --yes && pnpm ui:normalize && pnpm remove cn`.
- `button.tsx` and `card.tsx` are Kademe files merged with shadcn; the CLI
  skips them. Keep `DisabledReason` and the one-filled-button rule there.
- Never add: `badge` (status is a dot plus text), `alert-dialog` (no "are you
  sure"), `chart`, `toast`, `sonner` (undo is `UndoStrip`). A disabled
  button's reason never goes in a `Tooltip`.
- `Tooltip` needs a `TooltipProvider` above it; add it to the screen that first
  uses a tooltip, not to the root layout.
- `dark:` classes in copied components are inert: there is no dark theme.
```

- [ ] **Step 2: Write the gallery page**

```tsx
// src/app/(manager)/dev/ui/page.tsx
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

/**
 * Development-only gallery: every primitive once, on Kademe tokens, so a token
 * change can be judged on one screen. Not linked from the menu; 404 in production.
 * Copy is English on purpose: this page is for developers, not users.
 */
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <TooltipProvider>
      <main className="mx-auto max-w-[1360px] px-page py-8">
        <h1 className="text-[26px] font-semibold text-ink">UI primitives</h1>
        <div className="mt-section grid gap-section lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>One filled button per screen.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button>Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button size="icon-sm" aria-label="Icon">+</Button>
              <Spinner />
              <Kbd>⌘K</Kbd>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fields</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-field">
              <div className="grid gap-2">
                <Label htmlFor="g-name">Name</Label>
                <Input id="g-name" placeholder="Deniz Aydın" />
              </div>
              <Textarea placeholder="Notes" />
              <Select>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Choose a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b1">B1</SelectItem>
                  <SelectItem value="b2">B2</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Checkbox /> Checkbox</label>
                <label className="flex items-center gap-2 text-sm"><Switch /> Switch</label>
              </div>
              <RadioGroup defaultValue="a" className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="a" /> A</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="b" /> B</label>
              </RadioGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Overlays</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild><Button>Dialog</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog</DialogTitle>
                    <DialogDescription>Never an &quot;are you sure&quot;.</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild><Button>Sheet</Button></SheetTrigger>
                <SheetContent>
                  <SheetHeader><SheetTitle>Sheet</SheetTitle></SheetHeader>
                </SheetContent>
              </Sheet>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Candidate</DropdownMenuItem>
                  <DropdownMenuItem>Student</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild><Button>Popover</Button></PopoverTrigger>
                <PopoverContent>Popover body</PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild><Button>Tooltip</Button></TooltipTrigger>
                <TooltipContent>Icon labels only</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lists</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="one">
                <TabsList>
                  <TabsTrigger value="one">One</TabsTrigger>
                  <TabsTrigger value="two">Two</TabsTrigger>
                </TabsList>
                <TabsContent value="one">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Ayşe Demir</TableCell>
                        <TableCell><StatusDot tone="done">Finalized</StatusDot></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="two">
                  <Skeleton className="h-row w-full" />
                </TabsContent>
              </Tabs>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">muted-foreground text</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </TooltipProvider>
  );
}
```

- [ ] **Step 3: Gates**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: all pass; the build lists one more route (`/dev/ui`, 52 in total if the baseline was 51). Record the test count printed by vitest (467 plus the tests added in this plan).

- [ ] **Step 4: Final declaration diff**

```bash
node scripts/css-decls.mjs > ~/kademe-ui-baseline/after.txt
comm -23 ~/kademe-ui-baseline/before.txt ~/kademe-ui-baseline/after.txt
comm -13 ~/kademe-ui-baseline/before.txt ~/kademe-ui-baseline/after.txt | grep -vE '^(@layer theme > :root,:host|:root|@layer base > \[data-slot\]|@layer utilities > \.|@keyframes |@property |@layer properties)'
```
Expected: the first command prints only the `--radius-sm: 6px` line (and `--radius-lg: 14px` if it was in the baseline); the second prints nothing. Paste both outputs into the commit body.

Check that the named spacing tokens produced utilities (Tailwind 4 resolves `p-*`, `gap-*`, `h-*`, `m-*` against the `--spacing-*` namespace; this proves it on this version):
```bash
grep -E '^@layer utilities > \.(px-page|gap-section|mt-section|h-row|gap-field) ' ~/kademe-ui-baseline/after.txt
```
Expected: five lines, one per class, each reading its `var(--spacing-...)`. If a class is missing, the token is not usable as a utility on this Tailwind version: rename it under the matching namespace (for example `--height-row` for `h-row`), update RULES.md, and rebuild.

- [ ] **Step 5: Visual check with Claude in Chrome**

With the dev server on 3100 (Task 1 Step 3), open the same pages in the same order at the same window width and take a screenshot of each. Compare each against its "before" screenshot. Expected: no visible difference on any of the listed panel and candidate pages. Then open `/dev/ui` and check by eye:
- dropdown, select and popover hover rows are light grey (`#F1F0EC`), never green;
- the only green surfaces are the primary button and focus rings;
- dialog and sheet carry a soft shadow; table rows have hairline borders, not black ones;
- nothing changes when the operating system is switched to dark mode.
Report anything that differs as a finding; do not "fix" it by editing copied components outside the normalizer.

- [ ] **Step 6: Commit**

```bash
git add docs/design/RULES.md "src/app/(manager)/dev/ui/page.tsx"
git commit -m "Document the shadcn rules and add a development UI gallery" -m "RULES.md now carries the 8/12/16 radius scale, the token families and the shadcn usage rules. /dev/ui shows every primitive on Kademe tokens and returns 404 in production. Declaration diff against the pre-shadcn build: only radius-sm changed value; Chrome walkthrough of the panel and candidate pages showed no visible change." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review

1. **Spec coverage.** Spec 5 bullets: shadcn installed and copied into the repo (Tasks 2, 4); token mapping with `--primary` = `#0E6A57`, `--background` = canvas, `--card` = surface, `--border` = line, `--muted-foreground` = muted, radius (HIRING-UX 8.3 supersedes "10px, 6/10/14": `--radius` 12px, scale 8/10/12/16), Figtree unchanged (Task 2); RULES.md rules live in the wrappers (Button keeps `disabledReason` and the single filled variant, StatusDot kept, no alert dialog, undo strip kept) (Tasks 3, 4, 5); soft values at token level, in one file (Task 2); existing screens unchanged (Tasks 1, 2, 5). Caller list: button, card, input, textarea, label, select, checkbox, radio-group, switch, tabs, dialog, sheet, dropdown-menu, popover, tooltip, table, separator, skeleton, sidebar, command: all in Task 4 or 3; badge banned; sonner decided against with reasons. HIRING-UX 8.1 extras `kbd`, `empty`, `field`, `spinner` verified in the registry and added; `collapsible` added for HIRING-UX 5.1.
2. **Placeholder scan.** Every code step carries the full file or the full snippet. The one conditional step (Task 4 Step 5, a size the copied files might need beyond `icon-sm`/`outline`) states exactly what to add and where.
3. **Type consistency.** `normalizeShadcnSource` is the name in the module, the test and the script. `buttonVariants` is exported from `button.tsx` and used by `button.test.ts`. Token utility names in RULES.md match `globals.css` and `theme.test.ts`. `useIsMobile` keeps the name the copied `sidebar.tsx` imports.
