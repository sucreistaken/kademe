/**
 * Paints marks with the CSS Custom Highlight API. Several layers may be on one
 * page, so each registers its ranges under its own id and the named highlights
 * are rebuilt from all of them.
 */
export const HIGHLIGHT_NAMES = ["kademe-mark-yellow", "kademe-mark-green", "kademe-mark-pink", "kademe-underline"] as const;
export type HighlightName = (typeof HIGHLIGHT_NAMES)[number];

const layers = new Map<string, Map<HighlightName, Range[]>>();

function flush(): void {
  if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") return;
  for (const name of HIGHLIGHT_NAMES) {
    const ranges: Range[] = [];
    for (const byName of layers.values()) ranges.push(...(byName.get(name) ?? []));
    if (ranges.length === 0) CSS.highlights.delete(name);
    else CSS.highlights.set(name, new Highlight(...ranges));
  }
}

export function setLayerRanges(id: string, ranges: Map<HighlightName, Range[]>): void {
  layers.set(id, ranges);
  flush();
}

export function removeLayer(id: string): void {
  layers.delete(id);
  flush();
}
