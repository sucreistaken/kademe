# Kademe design rules

Source of truth: `docs/design/kademe-canvas.html` (exported from Claude Design).
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

1. **One accent colour** (`accent`, `#0E6A57`), used in exactly three places:
   the primary CTA, the active state, and the timer. Card borders, background
   blocks and secondary buttons are never accent-coloured.
2. **One filled button per screen.** Everything else is outline or text.
3. **Status is a dot plus text, never a badge pill.** Colour only on active.
4. **No "are you sure?" dialogs.** The action happens immediately and an 8
   second undo strip appears. Also: browser `alert`/`confirm` are banned, they
   block automation and read as amateur.
5. **A disabled button always states its reason** next to it, not in a tooltip.
   Use `<DisabledReason>` from `@/components/ui/button`.
6. **Shadows only** on sticky panels and modals.
7. **No dead ends.** Empty lists, zero-result filters and finished flows all
   point at a concrete next action.
8. Font: Figtree, weights 400/500/600/700 (700 only for large numbers on new
   screens, HIRING-UX 8.4). Radius 8 / 10 / 12 / 16 plus full (HIRING-UX 8.3:
   sm 8 small items inside fields, md 10 buttons and fields, lg 12 cards,
   xl 16 the main candidate card and sheet edges). Existing exam screens still
   use literal px radii and move over screen by screen. Spacing base 4px.
9. Manager layouts are 1360px wide, candidate layouts 1000px. The candidate side
   is deliberately narrower: one column, one decision per screen.

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
  `yes n | pnpm exec shadcn add <name> && pnpm ui:normalize && pnpm remove cn`.
  `--yes` still prompts to overwrite `button.tsx` and stalls without a
  terminal, so answering "n" keeps the Kademe files.
- `button.tsx` and `card.tsx` are Kademe files merged with shadcn; the CLI
  skips them. Keep `DisabledReason` and the one-filled-button rule there.
- Never add: `badge` (status is a dot plus text), `alert-dialog` (no "are you
  sure"), `chart`, `toast`, `sonner` (undo is `UndoStrip`). A disabled
  button's reason never goes in a `Tooltip`.
- `Tooltip` needs a `TooltipProvider` above it; add it to the screen that first
  uses a tooltip, not to the root layout.
- `dark:` classes in copied components are inert: there is no dark theme.

## Copy

All user-facing text is Turkish. Code, comments, identifiers and commit messages
are English. Never use an em-dash in any output.
