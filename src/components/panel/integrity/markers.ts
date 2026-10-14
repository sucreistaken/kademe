import type { Severity } from "@/lib/proctor/taxonomy";

/**
 * Recording-timeline markers, grouped: the same flag type within 30 seconds
 * of the previous one is a single marker with a count, so a burst of sixteen
 * voice events is one mark and not sixteen on top of each other.
 */

export const MARKER_GAP_MS = 30_000;

export type MarkerSeverity = Exclude<Severity, "INFO">;
export type RawMarker = { id: string; type: string; at: number; severity: MarkerSeverity };
export type GroupedMarker = { id: string; type: string; at: number; count: number; severity: MarkerSeverity; ids: string[] };

const RANK: Record<MarkerSeverity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export function groupMarkers(raw: readonly RawMarker[], gapMs = MARKER_GAP_MS): GroupedMarker[] {
  const out: GroupedMarker[] = [];
  const open = new Map<string, { marker: GroupedMarker; lastAt: number }>();
  for (const m of [...raw].sort((a, b) => a.at - b.at)) {
    const cur = open.get(m.type);
    if (cur && m.at - cur.lastAt <= gapMs) {
      cur.marker.count += 1;
      cur.marker.ids.push(m.id);
      if (RANK[m.severity] > RANK[cur.marker.severity]) cur.marker.severity = m.severity;
      cur.lastAt = m.at;
      continue;
    }
    const marker: GroupedMarker = { id: m.id, type: m.type, at: m.at, count: 1, severity: m.severity, ids: [m.id] };
    out.push(marker);
    open.set(m.type, { marker, lastAt: m.at });
  }
  return out;
}
