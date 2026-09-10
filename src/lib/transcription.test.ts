import { describe, expect, it } from "vitest";
import { estimateCostUsd, mapScribeResponse } from "@/lib/transcription";

/**
 * The review screen seeks the video from a click on a transcript word, so the
 * timestamps are load bearing. These tests pin the mapping, which is the part
 * that can drift without anybody noticing until a manager clicks a word and
 * lands in the wrong place.
 */

const model = "scribe_v2";

describe("mapScribeResponse", () => {
  it("keeps only spoken words and converts seconds to milliseconds", () => {
    const result = mapScribeResponse(
      {
        language_code: "tr",
        text: "  Merhaba dünya  ",
        words: [
          { text: "Merhaba", type: "word", start: 0.24, end: 0.81 },
          { text: " ", type: "spacing", start: 0.81, end: 0.86 },
          { text: "dünya", type: "word", start: 0.86, end: 1.415 },
          { text: "[laughter]", type: "audio_event", start: 1.5, end: 2 },
        ],
      },
      model,
    );

    expect(result.text).toBe("Merhaba dünya");
    expect(result.language).toBe("tr");
    expect(result.words).toEqual([
      { text: "Merhaba", startMs: 240, endMs: 810 },
      { text: "dünya", startMs: 860, endMs: 1415 },
    ]);
  });

  it("drops word entries that arrive without timestamps", () => {
    const result = mapScribeResponse(
      {
        text: "bir iki",
        words: [
          { text: "bir", type: "word", start: 0, end: 0.4 },
          { text: "iki", type: "word" },
        ],
      },
      model,
    );
    expect(result.words).toHaveLength(1);
  });

  it("derives duration from the last word and prices it", () => {
    const result = mapScribeResponse(
      {
        text: "x",
        words: [{ text: "x", type: "word", start: 0, end: 3600 }],
      },
      model,
    );
    expect(result.durationMs).toBe(3_600_000);
    // One hour at the configured rate.
    expect(result.costUsd).toBe(estimateCostUsd(3_600_000));
    expect(result.costUsd).toBeCloseTo(0.22, 6);
  });

  it("has no duration and no cost when nothing was timestamped", () => {
    const result = mapScribeResponse({ text: "sessiz", words: [] }, model);
    expect(result.durationMs).toBeNull();
    expect(result.costUsd).toBeNull();
  });

  it("refuses an empty transcript rather than writing a blank row", () => {
    expect(() => mapScribeResponse({ text: "   ", words: [] }, model)).toThrow(
      /empty transcript/,
    );
  });
});
