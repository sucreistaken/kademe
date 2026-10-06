import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));
const m = vi.hoisted(() => ({ synthesize: vi.fn(), recordAiRun: vi.fn(), aiLimitReached: vi.fn() }));
vi.mock("@/lib/tts", () => ({ synthesize: (...a: unknown[]) => m.synthesize(...a) }));
vi.mock("@/lib/ai-runs", () => ({ recordAiRun: (...a: unknown[]) => m.recordAiRun(...a) }));
vi.mock("@/lib/ai-limit", () => ({ aiLimitReached: (...a: unknown[]) => m.aiLimitReached(...a) }));

import { ensureStimulusAudio } from "./audio";

const row = (audioKey: string | null) => [{ id: "s1", body: "A: Hallo.\nB: Hallo!", speakers: [{ label: "A", voice: "A" }], audioKey }];

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
  for (const f of Object.values(m)) f.mockReset();
  m.aiLimitReached.mockResolvedValue(false);
  m.recordAiRun.mockResolvedValue("run");
});

describe("ensureStimulusAudio", () => {
  it("does nothing for a stimulus that has audio", async () => {
    fake.results = [row("bank/audio/x.wav")];
    expect(await ensureStimulusAudio("o1", "u1", "s1")).toEqual({ ok: true });
    expect(m.synthesize).not.toHaveBeenCalled();
  });

  it("answers not found for another organisation's stimulus", async () => {
    fake.results = [[]];
    expect(await ensureStimulusAudio("o1", "u1", "s1")).toEqual({ ok: false, reason: "not found" });
  });

  it("makes the audio, stores it and logs the TTS run", async () => {
    fake.results = [row(null)];
    m.synthesize.mockResolvedValue({ key: "bank/audio/y.wav", mime: "audio/wav", durationMs: 4000, bytes: 10, cached: false, model: "tts" });
    expect(await ensureStimulusAudio("o1", "u1", "s1")).toEqual({ ok: true });
    expect(fake.calls.find(([op]) => op === "set")![1][0]).toEqual({ audioKey: "bank/audio/y.wav", audioMime: "audio/wav", audioDurationMs: 4000 });
    expect(m.recordAiRun).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", purpose: "TTS", inputRef: "stimulus:s1", outputRef: "bank/audio/y.wav" }));
  });

  it("logs a failed synthesis and says why", async () => {
    fake.results = [row(null)];
    m.synthesize.mockRejectedValue(new Error("quota"));
    expect(await ensureStimulusAudio("o1", "u1", "s1")).toEqual({ ok: false, reason: "quota" });
    expect(m.recordAiRun).toHaveBeenCalledWith(expect.objectContaining({ purpose: "TTS", error: "quota" }));
  });

  it("makes no TTS call over the AI limit", async () => {
    fake.results = [row(null)];
    m.aiLimitReached.mockResolvedValue(true);
    expect(await ensureStimulusAudio("o1", "u1", "s1")).toEqual({ ok: false, reason: "rate limited" });
    expect(m.synthesize).not.toHaveBeenCalled();
  });
});
