import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider, buildReviewProvider, costFor, type MessagesClient } from "@/lib/ai-anthropic";
import { AiUnavailable, type AiJsonRequest } from "@/lib/ai";

function fakeClient(reply: Record<string, unknown>) {
  const create = vi.fn(async () => ({
    model: "claude-sonnet-5-5",
    stop_reason: "end_turn",
    stop_details: null,
    content: [{ type: "text", text: '{"verdict":"UNCLEAR"}' }],
    usage: { input_tokens: 1000, output_tokens: 200 },
    ...reply,
  }));
  return { client: { create } as unknown as MessagesClient, create };
}

const request: AiJsonRequest = {
  messages: [
    { role: "system", content: "Facts only." },
    { role: "user", content: "Look at the frames." },
  ],
  schemaName: "proctor_review",
  jsonSchema: { type: "object", additionalProperties: false, properties: {}, required: [] },
  maxTokens: 2000,
  images: [{ mime: "image/jpeg", base64: "AAAA" }],
};

describe("AnthropicProvider", () => {
  it("sends the system prompt apart, the frames before the last user text, and the JSON schema", async () => {
    const { client, create } = fakeClient({});
    const response = await new AnthropicProvider("claude-sonnet-5-5", { client }).completeJson(request);
    const body = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(body.system).toBe("Facts only.");
    expect(body.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } },
          { type: "text", text: "Look at the frames." },
        ],
      },
    ]);
    expect(body.output_config).toEqual({ format: { type: "json_schema", schema: request.jsonSchema }, effort: "medium" });
    expect(body.fallbacks).toBe("default");
    expect(body.betas).toEqual(["server-side-fallback-2026-07-01"]);
    // Thinking counts against the cap, so the caller's 2000 is only a floor.
    expect(body.max_tokens).toBe(16000);
    expect(response).toMatchObject({ text: '{"verdict":"UNCLEAR"}', model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 200, fellBackTo: null });
    expect(response.costUsd).toBeCloseTo(0.004);
  });

  it("sends Haiku no effort and no fallback, and keeps the caller's cap", async () => {
    const { client, create } = fakeClient({ model: "claude-haiku-4-5" });
    await new AnthropicProvider("claude-haiku-4-5", { client }).completeJson(request);
    const body = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(body.output_config).toEqual({ format: { type: "json_schema", schema: request.jsonSchema } });
    expect(body).not.toHaveProperty("fallbacks");
    expect(body).not.toHaveProperty("betas");
    expect(body.max_tokens).toBe(2000);
  });

  it("reports the model that answered after a fallback", async () => {
    const { client } = fakeClient({ model: "claude-opus-4-8" });
    const response = await new AnthropicProvider("claude-sonnet-5-5", { client }).completeJson(request);
    expect(response.fellBackTo).toBe("claude-opus-4-8");
    expect(response.costUsd).toBeCloseTo((1000 * 5 + 200 * 25) / 1_000_000);
  });

  it("throws instead of returning an empty answer when the request is declined or cut off", async () => {
    const refused = fakeClient({ stop_reason: "refusal", stop_details: { type: "refusal", category: "general_harms" }, content: [] });
    await expect(new AnthropicProvider("claude-sonnet-5-5", { client: refused.client }).completeJson(request)).rejects.toBeInstanceOf(AiUnavailable);
    const cut = fakeClient({ stop_reason: "max_tokens" });
    await expect(new AnthropicProvider("claude-sonnet-5-5", { client: cut.client }).completeJson(request)).rejects.toThrow(/ran out of tokens/);
  });
});

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("buildReviewProvider", () => {
  it("is off without a key and defaults to Haiku with one", () => {
    expect(buildReviewProvider(env({}))).toBeNull();
    expect(buildReviewProvider(env({ ANTHROPIC_API_KEY: "  " }))).toBeNull();
    const provider = buildReviewProvider(env({ ANTHROPIC_API_KEY: "test-key" }));
    expect(provider?.name).toBe("anthropic");
    expect(provider?.model).toBe("claude-haiku-4-5");
    expect(buildReviewProvider(env({ ANTHROPIC_API_KEY: "test-key", ANTHROPIC_REVIEW_MODEL: "claude-sonnet-5-5" }))?.model).toBe("claude-sonnet-5-5");
  });

  it("prices only the models it knows", () => {
    expect(costFor("claude-haiku-4-5", 1_000_000, 1_000_000)).toBe(6);
    expect(costFor("some-other-model", 10, 10)).toBeNull();
  });
});
