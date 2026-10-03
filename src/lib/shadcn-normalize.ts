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
