import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateCostUsd, getTranscriber, mapScribeResponse } from "@/lib/transcription";

// Local storage posts the file itself; the provider call is stubbed per test.
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    name: "local",
    openStream: async () => ({ stream: new Response("audio bytes").body }),
  }),
}));

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

  it("maps a response with no speech to an empty transcript, not to an error", () => {
    // A silent recording is a successful call with nothing in it. It has to reach the
    // grading as "no words" (rule: A0, EMPTY), so it must not look like a failed call.
    const silent = mapScribeResponse({ language_code: "deu", text: "   ", words: [] }, model);
    expect(silent).toEqual({
      text: "",
      words: [],
      language: "deu",
      model,
      costUsd: null,
      durationMs: null,
    });
  });

  it("treats a response that holds only spacing as empty", () => {
    const result = mapScribeResponse(
      { text: "", words: [{ text: " ", type: "spacing", start: 0, end: 1 }] },
      model,
    );
    expect(result.text).toBe("");
    expect(result.words).toEqual([]);
  });

  it("still refuses a response that is not a transcript at all", () => {
    // No `text` is a malformed answer from the provider, a technical failure that has to
    // be retried. Only a response that says "no speech" may become an empty transcript.
    expect(() => mapScribeResponse({}, model)).toThrow(/without a text field/);
    expect(() => mapScribeResponse({ words: [] }, model)).toThrow(/without a text field/);
    expect(() => mapScribeResponse({ text: null } as never, model)).toThrow(/without a text field/);
  });
});

describe("the Scribe call: only a successful answer without speech is an empty transcript", () => {
  const input = { storageKey: "media/o/a/r/m1.webm", mime: "video/webm", languageHint: "de" };
  const transcribe = () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    return getTranscriber().transcribe(input);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns an empty transcript for a 200 with blank text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ language_code: "deu", text: "", words: [] })));
    const result = await transcribe();
    expect(result.text).toBe("");
    expect(result.words).toEqual([]);
  });

  it("throws on a server error, so the job is retried", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream down", { status: 503 })));
    await expect(transcribe()).rejects.toThrow(/Scribe 503/);
  });

  it("throws on a rejected key, so the job is retried", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid api key", { status: 401 })));
    await expect(transcribe()).rejects.toThrow(/Scribe 401/);
  });

  it("throws when the network call itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(transcribe()).rejects.toThrow(/fetch failed/);
  });

  it("throws on a 200 that is not a transcript", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "something else" })));
    await expect(transcribe()).rejects.toThrow(/without a text field/);
  });
});
