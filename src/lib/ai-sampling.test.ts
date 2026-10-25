import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAiProvider, resetAiProvider } from "./ai";

/**
 * Temperature and seed reach the Gemini request when a caller sets them (grading
 * does, so that the same answer gets the same proposal) and are left out when
 * not; the OpenAI compatible providers never get them.
 */

const request = { messages: [{ role: "user" as const, content: "hi" }], schemaName: "s", jsonSchema: { type: "object" } };

const geminiAnswer = () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] }), { status: 200 });
const chatAnswer = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }), { status: 200 });

describe("sampling settings", () => {
  const fetchMock = vi.fn<(url: string, init: { body: string }) => Promise<Response>>();

  beforeEach(() => {
    resetAiProvider();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    for (const name of ["NVIDIA_API_KEY", "OPENROUTER_API_KEY", "GOOGLE_AI_API_KEY", "AI_PROVIDER"]) vi.stubEnv(name, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetAiProvider();
  });

  it("sends temperature and seed to Gemini when set", async () => {
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
    fetchMock.mockResolvedValue(geminiAnswer());
    await getAiProvider().completeJson({ ...request, temperature: 0, seed: 7 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.seed).toBe(7);
  });

  it("sends neither when they are not set, as before", async () => {
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
    fetchMock.mockResolvedValue(geminiAnswer());
    await getAiProvider().completeJson(request);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig).not.toHaveProperty("temperature");
    expect(body.generationConfig).not.toHaveProperty("seed");
  });

  it("does not send them to an OpenAI compatible provider, whose model may refuse a temperature", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("AI_PROVIDER", "openrouter");
    fetchMock.mockResolvedValue(chatAnswer());
    await getAiProvider().completeJson({ ...request, temperature: 0, seed: 7 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("seed");
  });
});
