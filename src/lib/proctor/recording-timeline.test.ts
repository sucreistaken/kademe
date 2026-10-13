import { describe, expect, it } from "vitest";
import {
  buildTracks,
  coverage,
  formatClock,
  nextRecordedAt,
  nextSegmentIndex,
  offsetSeconds,
  recordedMs,
  segmentIndexAt,
  timelineBounds,
} from "./recording-timeline";

const T0 = 1_000_000;
const seg = (id: string, kind: "CAMERA" | "SCREEN", start: number, durationMs = 15_000) => ({ id, kind, start: T0 + start, durationMs });

describe("buildTracks", () => {
  it("orders each kind by start, whatever order the rows came in", () => {
    const tracks = buildTracks([seg("c2", "CAMERA", 15_000), seg("s1", "SCREEN", 0), seg("c1", "CAMERA", 0)]);
    expect(tracks.CAMERA.map((s) => s.id)).toEqual(["c1", "c2"]);
    expect(tracks.SCREEN.map((s) => s.id)).toEqual(["s1"]);
  });

  it("cuts the overlap of a hand-over so exactly one segment covers each instant", () => {
    // The next recorder starts a few ms before the previous one stops.
    const tracks = buildTracks([seg("a", "CAMERA", 0, 15_020), seg("b", "CAMERA", 15_000)]);
    expect(tracks.CAMERA[0].end).toBe(T0 + 15_000);
    expect(segmentIndexAt(tracks.CAMERA, T0 + 15_010)).toBe(1);
  });

  it("drops a segment swallowed whole by the next one and ignores empty ones", () => {
    const tracks = buildTracks([seg("a", "CAMERA", 5_000, 1_000), seg("b", "CAMERA", 5_000), seg("z", "CAMERA", 0, 0)]);
    expect(tracks.CAMERA.map((s) => s.id)).toEqual(["b"]);
  });
});

describe("segment lookup", () => {
  const { CAMERA: track } = buildTracks([
    seg("a", "CAMERA", 0),
    seg("b", "CAMERA", 15_000),
    // a reload: 20 seconds with nothing
    seg("c", "CAMERA", 50_000),
  ]);

  it("finds the segment covering an instant, start inclusive, end exclusive", () => {
    expect(segmentIndexAt(track, T0)).toBe(0);
    expect(segmentIndexAt(track, T0 + 14_999)).toBe(0);
    expect(segmentIndexAt(track, T0 + 15_000)).toBe(1);
  });

  it("reports a gap as a gap rather than the nearest segment", () => {
    expect(segmentIndexAt(track, T0 + 40_000)).toBe(-1);
    expect(segmentIndexAt(track, T0 - 1)).toBe(-1);
    expect(nextSegmentIndex(track, T0 + 40_000)).toBe(2);
    expect(nextSegmentIndex(track, T0 + 60_000)).toBe(-1);
  });

  it("maps wall time to a position inside the file", () => {
    expect(offsetSeconds(track[1], T0 + 21_500)).toBe(6.5);
    expect(offsetSeconds(track[1], T0 + 99_000)).toBe(15);
  });

  it("draws a hand-over as one stretch and a reload as two", () => {
    expect(coverage(track)).toEqual([
      { start: T0, end: T0 + 30_000 },
      { start: T0 + 50_000, end: T0 + 65_000 },
    ]);
    expect(recordedMs(track)).toBe(45_000);
  });
});

describe("timeline", () => {
  const tracks = buildTracks([seg("c", "CAMERA", 10_000), seg("s", "SCREEN", 40_000)]);

  it("spans the attempt, widened to a recording outside it", () => {
    expect(timelineBounds({ start: T0 + 5_000, end: T0 + 30_000 }, tracks)).toEqual({ start: T0 + 5_000, end: T0 + 55_000 });
  });

  it("skips to the next moment either pane has a recording, and stops after the last", () => {
    expect(nextRecordedAt(tracks, T0)).toBe(T0 + 10_000);
    expect(nextRecordedAt(tracks, T0 + 12_000)).toBe(T0 + 12_000);
    expect(nextRecordedAt(tracks, T0 + 30_000)).toBe(T0 + 40_000);
    expect(nextRecordedAt(tracks, T0 + 60_000)).toBeNull();
  });

  it("formats durations as a clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75_400)).toBe("1:15");
    expect(formatClock(3_725_000)).toBe("1:02:05");
  });
});
