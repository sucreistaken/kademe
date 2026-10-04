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
 *  - Focus: the global `:focus-visible` outline in globals.css (2px accent,
 *    2px gap, HIRING-UX 8.2) is the one focus indicator. The copied parts also
 *    draw a translucent focus ring; it is removed so focus is not drawn twice.
 *    The `focus-visible:border-ring` colour change and the invalid-state rings
 *    stay.
 *
 * The patterns are exported so shadcn-vendored.test.ts checks the copied files
 * with exactly the rules this file applies.
 */

/**
 * Hand-maintained Kademe files in src/components/ui/: the normalizer and the
 * vendored-file test leave them alone. A new Kademe primitive can opt out
 * instead with `// kademe-owned` as its first line.
 */
export const KADEME_OWNED: ReadonlySet<string> = new Set([
  "button.tsx",
  "card.tsx",
  "status-dot.tsx",
  "undo-strip.tsx",
  "inline-link.tsx",
  "avatar.tsx",
]);

export const KADEME_OWNED_HEADER = "// kademe-owned";

/** The hooks the shadcn CLI copied into src/hooks/. Other hooks are Kademe code. */
export const NORMALIZED_HOOKS: readonly string[] = ["use-mobile.ts"];

export function isKademeOwned(fileName: string, source: string): boolean {
  return KADEME_OWNED.has(fileName) || source.split("\n", 1)[0].trim() === KADEME_OWNED_HEADER;
}

const BORDER = "border(?:-[xytrblse])?";
const UTILITY = `(bg|text|${BORDER}|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)`;
/** `text-muted` already means grey text in Kademe, so text is not renamed. */
const SURFACE_UTILITY = `(bg|${BORDER}|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret)`;
/** Characters that end a class name inside a string literal. */
const STOP = "\\s\"'`";

/**
 * RegExp sources (no flags). Each one matches a class the normalizer rewrites,
 * so a normalized file matches none of them.
 */
export const SHADCN_PATTERNS = {
  /** shadcn hover-ground foreground: `text-accent-foreground`. */
  accentForeground: `\\b${UTILITY}-accent-foreground\\b`,
  /** shadcn hover ground: `bg-accent`, `border-t-accent/50`. */
  accent: `\\b${UTILITY}-accent(?![\\w-])`,
  /** shadcn background muted: `bg-muted`, never `text-muted`. */
  mutedSurface: `\\b${SURFACE_UTILITY}-muted(?![\\w-])`,
  /**
   * Standalone shadow-* utilities (after optional variants). The lookbehind
   * keeps drop-shadow-*, inset-shadow-* and text-shadow-* out.
   */
  overlayShadow: "(?<![\\w-])shadow-(md|lg|xl|2xl)\\b",
  smallShadow: "(?<![\\w-])shadow-(xs|sm)\\b",
  /**
   * A focus ring class: a variant chain that mentions focus-visible
   * (`focus-visible:`, `has-[:focus-visible]:`,
   * `has-[[data-slot=x]:focus-visible]:`) followed by a ring width or the
   * translucent ring colour.
   */
  focusRing: `[^${STOP}]*focus-visible[^${STOP}]*:(?:ring-3|ring-\\[3px\\]|ring-2|ring-ring\\/50)(?![^${STOP}])`,
} as const;

const all = (source: string) => new RegExp(source, "g");
const ring = SHADCN_PATTERNS.focusRing;

/** Removes every focus ring class together with one neighbouring space. */
function dropFocusRings(source: string): string {
  return source
    .replace(all(`(?<=[ \\t])${ring}`), "\u0000")
    .replace(/[ \t]\u0000/g, "")
    .replace(all(`(?<=["'\`])${ring}[ \\t]?`), "");
}

export function normalizeShadcnSource(source: string): string {
  return dropFocusRings(
    source
      .replace(/from "cn"/g, 'from "@/lib/cn"')
      .replace(all(SHADCN_PATTERNS.accentForeground), "$1-subtle-foreground")
      .replace(all(SHADCN_PATTERNS.accent), "$1-subtle")
      .replace(all(SHADCN_PATTERNS.mutedSurface), "$1-muted-surface")
      .replace(all(SHADCN_PATTERNS.overlayShadow), "shadow-overlay")
      .replace(all(SHADCN_PATTERNS.smallShadow), "shadow-none"),
  );
}
