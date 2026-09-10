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
8. Font: Figtree, weights 400/500/600/700. Radius 6/10/14. Spacing base 4px.
9. Manager layouts are 1360px wide, candidate layouts 1000px. The candidate side
   is deliberately narrower: one column, one decision per screen.

## Tokens

Defined in `src/app/globals.css` under `@theme`, so they are real Tailwind
utilities: `bg-surface`, `bg-canvas`, `border-line`, `text-muted`, `text-ink`,
`bg-accent`, `text-accent`, `bg-accent-soft`, `text-warn`, `text-danger`.
Use `.tnum` on every countdown and score so digits do not jump.

## Copy

All user-facing text is Turkish. Code, comments, identifiers and commit messages
are English. Never use an em-dash in any output.
