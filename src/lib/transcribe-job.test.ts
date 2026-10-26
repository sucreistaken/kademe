import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiRuns, transcripts } from "@/db/schema";
import type { Transcriber } from "@/lib/transcription";

const h = vi.hoisted(() => ({
  /** Rows each awaited statement answers, in order. */
  results: [] as unknown[][],
  /** What each insert wrote, with the table it went into. */
  inserted: [] as Array<{ table: unknown; values: unknown }>,
}));

vi.mock("@/db", () => {
  const statement = (table?: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const name of ["from", "leftJoin", "innerJoin", "where", "limit", "onConflictDoNothing", "returning"]) chain[name] = () => chain;
    chain.values = (values: unknown) => {
      h.inserted.push({ table, values });
      return chain;
    };
    chain.then = (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(h.results.shift() ?? []).then(resolve, reject);
    return chain;
  };
  return { db: { select: () => statement(), insert: (table: unknown) => statement(table) } };
});

const t = vi.hoisted(() => ({
  transcribe: vi.fn<Transcriber["transcribe"]>(async () => ({ text: "Merhaba", words: [], language: "tr", model: "scribe_v2", costUsd: null, durationMs: null })),
}));

vi.mock("@/lib/transcription", () => ({
  TranscriberUnavailable: class extends Error {},
  isTranscribableMime: (mime: string) => mime.startsWith("audio/") || mime.startsWith("video/"),
  getTranscriber: () => ({ name: "test", available: true, transcribe: t.transcribe }),
}));
const graded = vi.hoisted(() => ({ gradeAfterTranscript: vi.fn<(mediaAssetId: string) => Promise<void>>(async () => undefined) }));
vi.mock("@/lib/exam-results", () => ({ gradeAfterTranscript: graded.gradeAfterTranscript }));

import { runTranscription } from "./transcribe-job";

const asset = { id: "m1", orgId: "o", status: "READY", mime: "video/webm", storageKey: "media/o/a/r/m1.webm" };

beforeEach(() => {
  t.transcribe.mockClear();
  graded.gradeAfterTranscript.mockClear();
  h.inserted = [];
});

describe("runTranscription's language hint comes from the solution's manifest (transcriptionHint)", () => {
  it("forces nothing for a hiring recording: the provider detects the candidate's language", async () => {
    h.results = [[{ asset, locale: "tr", solution: "HIRING" }], [], [{ id: "tr-1" }], []];
    expect(await runTranscription("m1")).toEqual({ status: "DONE", words: 0 });
    expect(t.transcribe).toHaveBeenCalledTimes(1);
    expect(t.transcribe.mock.calls[0][0]).toEqual({ storageKey: asset.storageKey, mime: "video/webm", languageHint: null });
  });

  it("keeps German for the language exam whatever the interface language", async () => {
    h.results = [[{ asset, locale: "tr", solution: "LANGUAGE_EXAM" }], [], [{ id: "tr-1" }], []];
    await runTranscription("m1");
    expect(t.transcribe.mock.calls[0][0].languageHint).toBe("de");
  });
});

const emptyResult = { text: "", words: [], language: "deu", model: "scribe_v2", costUsd: null, durationMs: null };

describe("a recording with no speech in it", () => {
  it("is stored as a transcript with empty text and goes on to grading", async () => {
    t.transcribe.mockResolvedValueOnce(emptyResult);
    h.results = [[{ asset, locale: "tr", solution: "LANGUAGE_EXAM" }], [], [{ id: "tr-1" }], []];

    expect(await runTranscription("m1")).toEqual({ status: "DONE", words: 0 });

    const written = h.inserted.find((i) => i.table === transcripts);
    expect(written?.values).toMatchObject({ mediaAssetId: "m1", text: "", words: [], language: "deu" });
    // The call is traced like any other, and the grading is started: without this the
    // answer would wait for a transcript for ever.
    expect(h.inserted.some((i) => i.table === aiRuns && (i.values as { error?: string }).error === undefined)).toBe(true);
    expect(graded.gradeAfterTranscript).toHaveBeenCalledWith("m1");
  });
});

describe("a transcription that fails is retried, not turned into an empty transcript", () => {
  it("rethrows a transport or provider error, writes no transcript and does not grade", async () => {
    t.transcribe.mockRejectedValueOnce(new Error("Scribe 503: upstream down"));
    h.results = [[{ asset, locale: "tr", solution: "LANGUAGE_EXAM" }], []];

    await expect(runTranscription("m1")).rejects.toThrow(/Scribe 503/);

    expect(h.inserted.some((i) => i.table === transcripts)).toBe(false);
    // The failure is recorded for the audit trail, nothing else.
    const runs = h.inserted.filter((i) => i.table === aiRuns);
    expect(runs).toHaveLength(1);
    expect((runs[0].values as { error?: string }).error).toContain("Scribe 503");
    expect(graded.gradeAfterTranscript).not.toHaveBeenCalled();
  });

  it("rethrows the error of a response that is not a transcript", async () => {
    t.transcribe.mockRejectedValueOnce(new Error("Scribe returned a response without a text field"));
    h.results = [[{ asset, locale: "tr", solution: "LANGUAGE_EXAM" }], []];
    await expect(runTranscription("m1")).rejects.toThrow(/without a text field/);
    expect(h.inserted.some((i) => i.table === transcripts)).toBe(false);
  });
});

describe("what runTranscription leaves alone", () => {
  it("skips an asset that is not audio or video and writes nothing", async () => {
    h.results = [[{ asset: { ...asset, mime: "application/pdf" }, locale: "tr", solution: "LANGUAGE_EXAM" }]];
    expect(await runTranscription("m1")).toEqual({ status: "SKIPPED", reason: "mime is application/pdf" });
    expect(t.transcribe).not.toHaveBeenCalled();
    expect(h.inserted).toEqual([]);
  });
});
