import { describe, expect, it } from "vitest";
import {
  addMark,
  capNotes,
  eraseMarksAt,
  eraseStrokesAt,
  makeStroke,
  MAX_BYTES,
  MAX_MARKS,
  MAX_STROKES,
  parseNotes,
  serializeNotes,
  type Mark,
  type Stroke,
} from "@/components/candidate/exam/notes/notes-model";

const hl = (start: number, end: number, color: Mark["color"] = "yellow"): Mark => ({ start, end, kind: "highlight", color });

describe("addMark", () => {
  it("ignores an empty range", () => {
    expect(addMark([], hl(3, 3))).toEqual([]);
  });
  it("merges touching and overlapping marks of the same colour", () => {
    expect(addMark([hl(0, 5)], hl(5, 9))).toEqual([hl(0, 9)]);
    expect(addMark([hl(0, 5)], hl(3, 9))).toEqual([hl(0, 9)]);
  });
  it("splits a mark of another colour that it cuts into", () => {
    expect(addMark([hl(0, 10, "green")], hl(3, 6, "pink"))).toEqual([hl(0, 3, "green"), hl(3, 6, "pink"), hl(6, 10, "green")]);
  });
  it("keeps highlights and underlines apart", () => {
    const u: Mark = { start: 2, end: 4, kind: "underline", color: "ink" };
    expect(addMark([hl(0, 10)], u)).toHaveLength(2);
  });
});

describe("eraseMarksAt", () => {
  it("removes the marks covering the offset only", () => {
    expect(eraseMarksAt([hl(0, 3), hl(10, 14)], 11)).toEqual([hl(0, 3)]);
    expect(eraseMarksAt([hl(0, 3)], 8)).toEqual([hl(0, 3)]);
  });
});

describe("strokes", () => {
  const s: Stroke = makeStroke([[0, 0], [100, 0]]);
  it("erases a stroke within 8px, even between two points", () => {
    expect(eraseStrokesAt([s], 50, 7)).toEqual([]);
  });
  it("keeps a stroke farther than 8px", () => {
    expect(eraseStrokesAt([s], 50, 9)).toEqual([s]);
  });
  it("rounds points to a tenth", () => {
    expect(makeStroke([[1.234, 5.678]]).points).toEqual([[1.2, 5.7]]);
  });
});

describe("caps", () => {
  it("drops the oldest marks beyond 200", () => {
    const marks = Array.from({ length: MAX_MARKS + 5 }, (_, i) => hl(i * 3, i * 3 + 1));
    const out = capNotes({ marks, strokes: [] });
    expect(out.marks).toHaveLength(MAX_MARKS);
    expect(out.marks[0].start).toBe(15);
  });
  it("drops the oldest strokes beyond 300", () => {
    const strokes = Array.from({ length: MAX_STROKES + 2 }, (_, i) => makeStroke([[i, 0]]));
    const out = capNotes({ marks: [], strokes });
    expect(out.strokes).toHaveLength(MAX_STROKES);
    expect(out.strokes[0].points[0][0]).toBe(2);
  });
  it("keeps the serialized size under 100 KB", () => {
    const big = makeStroke(Array.from({ length: 4000 }, (_, i) => [i + 0.5, i + 0.5] as [number, number]));
    const out = capNotes({ marks: [hl(0, 4)], strokes: [big, big, big, big, big, big] });
    expect(serializeNotes(out).length).toBeLessThanOrEqual(MAX_BYTES);
  });
});

describe("parseNotes", () => {
  it("round-trips", () => {
    const d = { marks: [hl(1, 4)], strokes: [makeStroke([[1, 2], [3, 4]])] };
    expect(parseNotes(serializeNotes(d))).toEqual(d);
  });
  it("drops malformed input", () => {
    expect(parseNotes("nope")).toEqual({ marks: [], strokes: [] });
    expect(parseNotes(JSON.stringify({ marks: [{ start: 5, end: 2, kind: "highlight", color: "yellow" }, { start: 0, end: 1, kind: "x", color: "red" }], strokes: [{ tool: "pen", points: [["a", 1]] }] }))).toEqual({ marks: [], strokes: [] });
  });
});
