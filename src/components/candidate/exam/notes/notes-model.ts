/**
 * Pure model of the student's exam notes: text marks (highlight, underline) as
 * offsets into a container's text, and pen strokes in container coordinates.
 * Nothing here touches the DOM, the network or the clock.
 */

export type MarkKind = "highlight" | "underline";
export type MarkColor = "yellow" | "green" | "pink" | "ink";

export type Mark = { start: number; end: number; kind: MarkKind; color: MarkColor };
export type Point = [number, number];
export type Stroke = { tool: "pen"; points: Point[] };
export type NotesData = { marks: Mark[]; strokes: Stroke[] };

export const MAX_MARKS = 200;
export const MAX_STROKES = 300;
export const MAX_BYTES = 100 * 1024;
/** A stroke is erased when the pointer passes within this many px of it. */
export const ERASE_RADIUS = 8;

export const emptyNotes = (): NotesData => ({ marks: [], strokes: [] });

export const isEmptyNotes = (d: NotesData): boolean => d.marks.length === 0 && d.strokes.length === 0;

const sortMarks = (marks: Mark[]): Mark[] =>
  [...marks].sort((a, b) => a.start - b.start || a.end - b.end || a.kind.localeCompare(b.kind));

/** Marks of one kind lie side by side: neighbours of the same colour that touch or overlap become one. */
function mergeKind(marks: Mark[]): Mark[] {
  const out: Mark[] = [];
  for (const m of sortMarks(marks)) {
    const last = out[out.length - 1];
    if (last && last.kind === m.kind && last.color === m.color && m.start <= last.end) {
      last.end = Math.max(last.end, m.end);
    } else out.push({ ...m });
  }
  return out;
}

/**
 * Add a mark. It replaces whatever it covers of the same kind (a new highlight
 * colour paints over the old one; underlines are replaced by underlines), splits
 * the marks it cuts into, and merges with touching marks of the same colour.
 */
export function addMark(marks: readonly Mark[], mark: Mark): Mark[] {
  if (!(mark.end > mark.start)) return [...marks];
  const kept: Mark[] = [];
  for (const m of marks) {
    if (m.kind !== mark.kind || m.end <= mark.start || m.start >= mark.end) {
      kept.push({ ...m });
      continue;
    }
    if (m.start < mark.start) kept.push({ ...m, end: mark.start });
    if (m.end > mark.end) kept.push({ ...m, start: mark.end });
  }
  kept.push({ ...mark });
  const highlights = mergeKind(kept.filter((m) => m.kind === "highlight"));
  const underlines = mergeKind(kept.filter((m) => m.kind === "underline"));
  return sortMarks([...highlights, ...underlines]);
}

/** Remove every mark that covers the character boundary `offset` (a click with the eraser). */
export function eraseMarksAt(marks: readonly Mark[], offset: number): Mark[] {
  return marks.filter((m) => !(m.start <= offset && offset <= m.end)).map((m) => ({ ...m }));
}

function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/** Whether the point lies within `radius` of any part of the stroke. */
export function strokeNear(stroke: Stroke, x: number, y: number, radius = ERASE_RADIUS): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= radius;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(x, y, pts[i - 1], pts[i]) <= radius) return true;
  }
  return false;
}

/** Drop every stroke the eraser touches at (x, y). */
export function eraseStrokesAt(strokes: readonly Stroke[], x: number, y: number, radius = ERASE_RADIUS): Stroke[] {
  return strokes.filter((s) => !strokeNear(s, x, y, radius));
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** A finished stroke with points rounded to a tenth of a pixel (keeps the stored notes small). */
export function makeStroke(points: readonly Point[]): Stroke {
  return { tool: "pen", points: points.map(([x, y]) => [round1(x), round1(y)] as Point) };
}

export const serializeNotes = (d: NotesData): string => JSON.stringify(d);

/** Enforce the caps: the oldest marks and strokes go first, then strokes until the size fits. */
export function capNotes(data: NotesData): NotesData {
  let marks = data.marks.length > MAX_MARKS ? data.marks.slice(data.marks.length - MAX_MARKS) : data.marks;
  let strokes = data.strokes.length > MAX_STROKES ? data.strokes.slice(data.strokes.length - MAX_STROKES) : data.strokes;
  let out: NotesData = { marks, strokes };
  while (serializeNotes(out).length > MAX_BYTES && (strokes.length > 0 || marks.length > 0)) {
    if (strokes.length > 0) strokes = strokes.slice(1);
    else marks = marks.slice(1);
    out = { marks, strokes };
  }
  return out;
}

const KINDS: readonly MarkKind[] = ["highlight", "underline"];
const COLORS: readonly MarkColor[] = ["yellow", "green", "pink", "ink"];

/** Read stored text back; anything malformed is dropped rather than trusted. */
export function parseNotes(raw: string | null | undefined): NotesData {
  if (!raw) return emptyNotes();
  try {
    const v = JSON.parse(raw) as { marks?: unknown; strokes?: unknown };
    const marks: Mark[] = [];
    if (Array.isArray(v.marks)) {
      for (const m of v.marks as Array<Record<string, unknown>>) {
        if (
          m &&
          Number.isInteger(m.start) &&
          Number.isInteger(m.end) &&
          (m.start as number) >= 0 &&
          (m.end as number) > (m.start as number) &&
          KINDS.includes(m.kind as MarkKind) &&
          COLORS.includes(m.color as MarkColor)
        ) {
          marks.push({ start: m.start as number, end: m.end as number, kind: m.kind as MarkKind, color: m.color as MarkColor });
        }
      }
    }
    const strokes: Stroke[] = [];
    if (Array.isArray(v.strokes)) {
      for (const s of v.strokes as Array<Record<string, unknown>>) {
        if (!s || s.tool !== "pen" || !Array.isArray(s.points)) continue;
        const points: Point[] = [];
        for (const p of s.points as unknown[]) {
          if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number" && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
            points.push([p[0], p[1]]);
          }
        }
        if (points.length > 0) strokes.push({ tool: "pen", points });
      }
    }
    return capNotes({ marks: sortMarks(marks), strokes });
  } catch {
    return emptyNotes();
  }
}
