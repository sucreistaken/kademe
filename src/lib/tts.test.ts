import { afterEach, describe, expect, it, vi } from "vitest";

const putObject = vi.fn(async () => undefined);
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    openStream: async () => {
      throw new Error("missing");
    },
    putObject,
  }),
}));

import { buildTtsRequest, chunkTurns, parseScript, pcmToWav, synthesize, synthesizeSpeech, wavDurationMs, type Speaker } from "@/lib/tts";

const four: Speaker[] = [
  { label: "Anna", voice: "A" },
  { label: "Ben", voice: "B" },
  { label: "Clara", voice: "C" },
  { label: "Dirk", voice: "D" },
];

function okResponse(samples: number) {
  const pcm = Buffer.alloc(samples * 2, 1);
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: pcm.toString("base64") } }] } }] }), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  putObject.mockClear();
});

describe("chunkTurns", () => {
  it("keeps a clip with two speakers or fewer as one chunk", () => {
    const turns = parseScript("Anna: Hallo.\nBen: Hi.\nAnna: Wie geht's?", four);
    expect(chunkTurns(turns)).toEqual([turns]);
    expect(chunkTurns([])).toEqual([]);
  });

  it("splits greedily in turn order with at most two speakers per chunk", () => {
    const turns = parseScript("Anna: 1\nBen: 2\nAnna: 3\nClara: 4\nDirk: 5\nClara: 6\nAnna: 7", four);
    const chunks = chunkTurns(turns);
    expect(chunks.map((c) => c.map((t) => t.text))).toEqual([["1", "2", "3"], ["4", "5", "6"], ["7"]]);
    expect(chunks.flat()).toEqual(turns);
    for (const c of chunks) expect(new Set(c.map((t) => t.speaker)).size).toBeLessThanOrEqual(2);
  });
});

describe("synthesize requests", () => {
  it("sends one request identical to buildTtsRequest for a two-speaker clip", async () => {
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => okResponse(2400));
    vi.stubGlobal("fetch", fetchMock);
    const body = "Anna: Hallo.\nBen: Hi.";
    const speakers = four.slice(0, 2);
    await synthesize(body, speakers);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    const expected = JSON.parse(JSON.stringify(buildTtsRequest(parseScript(body, speakers), speakers, "gemini-3.8-flash-tts")));
    expect(sent).toEqual(expected);
  });

  it("makes one request per chunk for four speakers and joins them with 300 ms of silence", async () => {
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => okResponse(2400)); // 100 ms each
    vi.stubGlobal("fetch", fetchMock);
    await synthesize("Anna: 1\nBen: 2\nClara: 3\nDirk: 4", four);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const put = putObject.mock.calls[0] as unknown as [string, string, Uint8Array];
    if (put[1] === "audio/wav") expect(wavDurationMs(put[2])).toBe(500);
  });
});

describe("synthesizeSpeech", () => {
  it("makes a single-voice request with only the text and returns wav", async () => {
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => okResponse(24000));
    vi.stubGlobal("fetch", fetchMock);
    const r = await synthesizeSpeech("Willkommen bei Kademe.", { voice: "C", language: "de" });
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.contents[0].parts).toEqual([{ text: "Willkommen bei Kademe." }]);
    expect(sent.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Puck");
    expect(r.durationMs).toBe(1000);
    expect(r.wav.byteLength).toBe(pcmToWav(new Uint8Array(48000)).byteLength);
    expect(putObject).not.toHaveBeenCalled();
  });
});
