# Kademe design rules

Layout source: `docs/design/kademe-canvas.html` (exported from Claude Design). Its
colours, font and corners are the earlier look; for those, `src/app/globals.css` wins.
Artboards are `<div class="dv-opt" id="Y1">` … `Y7` (manager) and `A8` … `A12`
(candidate). To read one:

```bash
python3 - <<'PY'
import re,html
s=open('docs/design/kademe-canvas.html').read()
m=re.search(r'<div class="dv-opt" id="Y5">(.*?)<div class="dv-opt" id="Y6">',s,re.S)
print(html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',m.group(1)))))
PY
```

## Non-negotiable rules

Since 2026-10-14 the app uses the "soft" look (user decision): softer colours,
a light gamified feel and a rounded font. The full token contract is the
comment at the top of `src/app/globals.css`; the rules below follow it.

1. **One brand green** (`accent`, `#157a5a`) for the primary action, the
   current place (active nav, chosen card, focus ring) and progress. Five
   pastel families (mint, sky, grape, sun, coral) mark categories such as the
   exam sections, never a verdict: no screen a student sees while answering
   colours anything as right or wrong. Warn (sun, amber allowed) and success
   (mint) exist as semantic tones.
2. **One filled button per screen.** Everything else is outline or text.
3. **Status may be a soft pill** (`Badge`, `StatusDot` with `pill`) with a word
   in it. Colour is never the only signal.
4. **Undo over "are you sure?"** in the panel: the action happens and an 8
   second undo strip appears. The exam is the exception: skipping a question
   and finishing a section cannot be undone, so they ask once, in-app. Browser
   `alert`/`confirm` stay banned: they block automation and read as amateur.
5. **A disabled button always states its reason** next to it, not in a tooltip.
   Use `<DisabledReason>` from `@/components/ui/button`.
6. **Depth is a solid lip** under pressable things and cards (`shadow-lip`,
   `shadow-lip-soft`, `shadow-card`); blurred shadows only on things that float
   (sticky bars, menus, dialogs).
7. **No dead ends.** Empty lists, zero-result filters and finished flows all
   point at a concrete next action.
8. Font: Nunito (rounded, latin + latin-ext), via `next/font` in
   `src/app/layout.tsx`. Corners are round everywhere: 10 small items, 14
   buttons and fields, 20 cards, 26 the large candidate cards, full for pills.
   Some exam screens still use literal px radii; a bridge block at the end of
   `globals.css` maps them onto the scale until they move over. Spacing base 4px.
9. **The mascot** is the tallest logo step come alive ("canlı basamak"): it is
   the only drawing with a face. It appears on empty screens, the candidate
   welcome and finish screens, between sections and at the top of wizard
   steps, never on a question screen. It speaks only in short encouraging
   lines between sections and at the end, never about right or wrong. Badges
   are for students only and never show a score or level.
10. Manager layouts are 1360px wide, candidate layouts 1000px. The candidate side
   is deliberately narrower: one decision per screen (preparation and finish screens may use two regions, question screens keep one focus; HIRING-VISUAL-FLOW G10).

## Tokens

Defined in `src/app/globals.css` and nowhere else.

- Kademe tokens under `@theme`, real Tailwind utilities: `bg-surface`,
  `bg-canvas`, `border-line`, `text-muted`, `text-ink`, `bg-accent`,
  `text-accent`, `bg-accent-soft`, `text-danger`, plus `success`, `warn` and
  the pastel families (`mint`, `sky`, `grape`, `sun`, `coral`, each with
  `-soft` and `-fill`).
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
  `yes n | pnpm exec shadcn add <name> && pnpm ui:normalize && pnpm remove cn`.
  Even with `--yes` the CLI asks before overwriting a file that already
  exists (for example `button.tsx`, which most parts depend on) and stalls
  without a terminal. `yes n |` answers "n" to every such prompt, so existing
  files, the Kademe ones included, are never overwritten; a part that has to
  be refreshed from the registry is deleted first and then added.
- `button.tsx` and `card.tsx` are Kademe files merged with shadcn. The CLI
  does not skip them on its own; they survive only because of the "n" answer
  above. Keep `DisabledReason` and the one-filled-button rule there.
- Never add: `badge` (status is a dot plus text), `alert-dialog` (no "are you
  sure"), `chart`, `toast`, `sonner` (undo is `UndoStrip`). A disabled
  button's reason never goes in a `Tooltip`.
- `Card` draws `rounded-[var(--card-radius,14px)]`: exam screens keep their
  14px cards, and a solution whose screens use the 12px card of HIRING-UX 8.3
  sets `--card-radius: 12px` once on its layout root instead of overriding
  every card.
- Fields (`Input`, `SelectTrigger`, `InputGroup`) are 40px tall (`h-10`),
  like the Kademe md `Button`. Table cells are `h-row` (52px) and a selected
  row uses `bg-brand-soft`. `shadcn-vendored.test.ts` guards these and the
  sidebar's 1024px (`lg:`) breakpoint, so a part re-added from the registry
  fails the test until the change is made again.
- `Tooltip` needs a `TooltipProvider` above it; add it to the screen that first
  uses a tooltip, not to the root layout.
- `dark:` classes in copied components are inert: there is no dark theme.
- Focus has one indicator: the global `:focus-visible` outline in
  `globals.css` (2px accent, 2px gap). The normalizer removes the extra
  `focus-visible:ring-*` rings the copied parts carry. Items in menus and
  lists (`data-slot` ending in `-item`) draw the outline 2px inside, because
  their scroll container would clip it; an input group shows it on its frame.
- The normalizer and `shadcn-vendored.test.ts` share their rules
  (`src/lib/shadcn-normalize.ts`). They skip the Kademe files listed there
  and any file whose first line is `// kademe-owned`; a new Kademe primitive
  in `src/components/ui/` carries that header. Of `src/hooks/`, only
  `use-mobile.ts` came from the CLI and is normalized.

## Copy

All user-facing text is Turkish. Code, comments, identifiers and commit messages
are English. Never use an em-dash in any output.
