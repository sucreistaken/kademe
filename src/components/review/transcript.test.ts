import { describe, it, expect } from "vitest";
import { toSegments } from "./transcript";

const w = (text: string, startMs: number, endMs: number) => ({
  text,
  startMs,
  endMs,
});

describe("transcript segmentation", () => {
  it("breaks on sentence ends and keeps the first word's timestamp", () => {
    const segments = toSegments(
      [w("Önce", 1000, 1400), w("ölçerdim.", 1400, 2000), w("Sonra", 2100, 2500)],
      "",
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ startMs: 1000, endMs: 2000 });
    expect(segments[0].text).toBe("Önce ölçerdim.");
    expect(segments[1].startMs).toBe(2100);
  });

  it("does not leave a space before punctuation", () => {
    const segments = toSegments([w("evet", 0, 100), w(",", 100, 120)], "");
    expect(segments[0].text).toBe("evet,");
  });

  it("falls back to plain text when there are no word timings", () => {
    const segments = toSegments([], "zaman damgasız metin");
    expect(segments).toEqual([
      { startMs: 0, endMs: 0, text: "zaman damgasız metin" },
    ]);
  });

  it("returns nothing when there is neither words nor text", () => {
    expect(toSegments([], "")).toEqual([]);
  });
});
