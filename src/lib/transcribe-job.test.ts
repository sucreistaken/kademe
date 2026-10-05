import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transcriber } from "@/lib/transcription";

const h = vi.hoisted(() => ({
  /** Rows each awaited statement answers, in order. */
  results: [] as unknown[][],
}));

vi.mock("@/db", () => {
  const statement = () => {
    const chain: Record<string, unknown> = {};
    for (const name of ["from", "leftJoin", "innerJoin", "where", "limit", "values", "onConflictDoNothing", "returning"]) chain[name] = () => chain;
    chain.then = (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(h.results.shift() ?? []).then(resolve, reject);
    return chain;
  };
  return { db: { select: statement, insert: statement } };
});

const t = vi.hoisted(() => ({
  transcribe: vi.fn<Transcriber["transcribe"]>(async () => ({ text: "Merhaba", words: [], language: "tr", model: "scribe_v2", costUsd: null, durationMs: null })),
}));

vi.mock("@/lib/transcription", () => ({
  TranscriberUnavailable: class extends Error {},
  isTranscribableMime: (mime: string) => mime.startsWith("audio/") || mime.startsWith("video/"),
  getTranscriber: () => ({ name: "test", available: true, transcribe: t.transcribe }),
}));
vi.mock("@/lib/exam-results", () => ({ gradeAfterTranscript: async () => undefined }));

import { runTranscription } from "./transcribe-job";

const asset = { id: "m1", orgId: "o", status: "READY", mime: "video/webm", storageKey: "media/o/a/r/m1.webm" };

beforeEach(() => {
  t.transcribe.mockClear();
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
