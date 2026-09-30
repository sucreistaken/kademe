import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_NVIDIA_MODEL,
  chooseProvider,
  isRetryableGeminiFailure,
  isRetryableStatus,
  readGeminiBody,
  toGeminiSchema,
  withImagesOpenAi,
} from "@/lib/ai";
import { GRADING_JSON_SCHEMA as TEMPLATE_DRAFT_JSON_SCHEMA } from "@/lib/exam/grading";

/**
 * Which provider a deployment ends up talking to is a money question as much as
 * a technical one: one of the two bills per call. These tests pin the rules so
 * that adding a key to `.env` never quietly starts spending.
 */

describe("chooseProvider", () => {
  it("returns nothing when no key is configured", () => {
    expect(chooseProvider({})).toBeNull();
  });

  it("uses the only configured provider", () => {
    expect(chooseProvider({ OPENROUTER_API_KEY: "or-key" })?.kind).toBe(
      "openrouter",
    );
    expect(chooseProvider({ NVIDIA_API_KEY: "nv-key" })?.kind).toBe("nvidia");
    expect(chooseProvider({ GOOGLE_AI_API_KEY: "g-key" })?.kind).toBe("gemini");
  });

  it("prefers the fastest endpoint when several keys exist", () => {
    // This replaces an earlier rule, "spending money is opt in", under which
    // the free NVIDIA endpoint won. That rule was written before the wait was
    // measured: NVIDIA takes 131 to 275 seconds on this prompt and Gemini
    // answers in seconds, which is the difference between a server action and a
    // platform timeout. OpenRouter, the one that bills per call, still loses.
    const chosen = chooseProvider({
      OPENROUTER_API_KEY: "or-key",
      NVIDIA_API_KEY: "nv-key",
      GOOGLE_AI_API_KEY: "g-key",
    });
    expect(chosen?.kind).toBe("gemini");

    const withoutGemini = chooseProvider({
      OPENROUTER_API_KEY: "or-key",
      NVIDIA_API_KEY: "nv-key",
    });
    expect(withoutGemini?.kind).toBe("nvidia");
  });

  it("obeys an explicit AI_PROVIDER", () => {
    const chosen = chooseProvider({
      AI_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "or-key",
      NVIDIA_API_KEY: "nv-key",
    });
    expect(chosen?.kind).toBe("openrouter");
  });

  it("refuses rather than falling back when the named provider has no key", () => {
    // Silently answering with the other provider would send the job ad to a
    // subprocessor nobody named.
    const chosen = chooseProvider({
      AI_PROVIDER: "openrouter",
      NVIDIA_API_KEY: "nv-key",
    });
    expect(chosen).toBeNull();

    expect(
      chooseProvider({ AI_PROVIDER: "gemini", NVIDIA_API_KEY: "nv-key" }),
    ).toBeNull();
  });

  it("carries each provider's default model and its own limits", () => {
    const openrouter = chooseProvider({ OPENROUTER_API_KEY: "or-key" })!;
    expect(openrouter.model).toBe(DEFAULT_AI_MODEL);

    const nvidia = chooseProvider({ NVIDIA_API_KEY: "nv-key" })!;
    expect(nvidia.model).toBe(DEFAULT_NVIDIA_MODEL);
    // A reasoning model needs both more time and more room than the other one.
    expect(nvidia.timeoutMs).toBeGreaterThan(openrouter.timeoutMs);
    expect(nvidia.maxTokens).toBeGreaterThan(openrouter.maxTokens);

    const gemini = chooseProvider({ GOOGLE_AI_API_KEY: "g-key" })!;
    expect(gemini.model).toBe(DEFAULT_GEMINI_MODEL);
    // Ten minutes of patience only made sense for a model that thinks for
    // minutes. This one answers in seconds, so a long deadline would just be a
    // long hang.
    expect(gemini.timeoutMs).toBeLessThan(nvidia.timeoutMs);
    // Twenty seconds of dead air is a rounding error next to a three minute
    // model and most of the run next to a ten second one.
    expect(gemini.retryDelaysMs).toEqual([1_000, 4_000]);
    expect(nvidia.retryDelaysMs).toEqual([5_000, 15_000]);
    expect(openrouter.retryDelaysMs).toEqual([5_000, 15_000]);
    const geminiWait = gemini.retryDelaysMs.reduce((a, b) => a + b, 0);
    const nvidiaWait = nvidia.retryDelaysMs.reduce((a, b) => a + b, 0);
    expect(geminiWait).toBeLessThan(nvidiaWait);
  });

  it("lets the model be overridden per provider", () => {
    const chosen = chooseProvider({
      NVIDIA_API_KEY: "nv-key",
      NVIDIA_MODEL: "nvidia/other-model",
    });
    expect(chosen?.model).toBe("nvidia/other-model");

    const gemini = chooseProvider({
      GOOGLE_AI_API_KEY: "g-key",
      GEMINI_MODEL: "gemini-other",
    });
    expect(gemini?.model).toBe("gemini-other");
  });

  it("treats a blank key as no key", () => {
    expect(chooseProvider({ NVIDIA_API_KEY: "   " })).toBeNull();
    expect(chooseProvider({ GOOGLE_AI_API_KEY: "   " })).toBeNull();
    // A blank Gemini key must not shadow a real one further down the order,
    // or an empty line in .env would silently disable the whole feature.
    expect(
      chooseProvider({ GOOGLE_AI_API_KEY: "   ", NVIDIA_API_KEY: "nv-key" })
        ?.kind,
    ).toBe("nvidia");
  });
});

/**
 * The shared NVIDIA endpoint answered 503 on two runs out of five, after the
 * manager had already waited minutes. What is worth waiting out and what is not
 * is the difference between a retry that helps and one that wastes their time.
 */
describe("isRetryableStatus", () => {
  it("retries a busy or broken endpoint", () => {
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
  });

  it("does not retry an account with no credit", () => {
    // 402 will not become 200 in fifteen seconds. Retrying it only makes the
    // manager wait longer for the same answer.
    expect(isRetryableStatus(402)).toBe(false);
  });

  it("does not retry a configuration mistake", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

/**
 * Gemini takes an OpenAPI 3.0 subset for `responseSchema`, not JSON Schema, and
 * rejects the whole request over a key it does not know. The draft schema is
 * written for OpenAI strict mode, which requires exactly the key Gemini refuses.
 */
describe("toGeminiSchema", () => {
  const nested = {
    type: "object",
    additionalProperties: false,
    required: ["rows"],
    $schema: "https://json-schema.org/draft/2020-12/schema",
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "tags"],
          properties: {
            kind: {
              type: "string",
              enum: ["A", "B"],
              description: "Which kind of row this is",
            },
            tags: {
              type: "array",
              items: { type: "object", additionalProperties: false, properties: {} },
            },
          },
        },
      },
    },
  };

  /** Walks into a rewritten schema, and fails loudly if the path is gone. */
  const node = (
    schema: Record<string, unknown>,
    path: string,
  ): Record<string, unknown> => {
    let current: unknown = schema;
    for (const key of path.split(".")) {
      if (typeof current !== "object" || current === null) {
        throw new Error(`no node at ${path}`);
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (typeof current !== "object" || current === null) {
      throw new Error(`no node at ${path}`);
    }
    return current as Record<string, unknown>;
  };

  it("strips additionalProperties at every depth", () => {
    const out = toGeminiSchema(nested);
    expect(out.additionalProperties).toBeUndefined();
    expect(node(out, "properties.rows.items").additionalProperties).toBeUndefined();
    expect(
      node(out, "properties.rows.items.properties.tags.items")
        .additionalProperties,
    ).toBeUndefined();
  });

  it("drops keys Gemini does not know", () => {
    expect(toGeminiSchema(nested).$schema).toBeUndefined();
  });

  it("keeps what the model actually needs", () => {
    const out = toGeminiSchema(nested);
    expect(out.type).toBe("object");
    expect(out.required).toEqual(["rows"]);
    const kind = node(out, "properties.rows.items.properties.kind");
    expect(kind.enum).toEqual(["A", "B"]);
    expect(kind.description).toBe("Which kind of row this is");
    expect(node(out, "properties.rows.items").required).toEqual(["kind", "tags"]);
  });

  it("leaves its input untouched", () => {
    // TEMPLATE_DRAFT_JSON_SCHEMA is a module level singleton that the OpenAI
    // compatible providers are handed as well. Rewriting it in place here would
    // strip `additionalProperties` out of their requests too, and strict mode
    // would start failing for a reason nothing in that path mentions.
    const before = structuredClone(TEMPLATE_DRAFT_JSON_SCHEMA);
    toGeminiSchema(TEMPLATE_DRAFT_JSON_SCHEMA);
    expect(TEMPLATE_DRAFT_JSON_SCHEMA).toEqual(before);
  });

  it("leaves no additionalProperties anywhere in the real draft schema", () => {
    const found: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, `${path}[${index}]`));
        return;
      }
      if (typeof node !== "object" || node === null) return;
      for (const [key, value] of Object.entries(node)) {
        if (key === "additionalProperties") found.push(`${path}.${key}`);
        walk(value, `${path}.${key}`);
      }
    };
    walk(toGeminiSchema(TEMPLATE_DRAFT_JSON_SCHEMA), "(root)");
    expect(found).toEqual([]);
  });
});

/**
 * The 404 is the one that matters. A typo in GEMINI_MODEL produces one that
 * never fixes itself, and the same endpoint also produced empty bodied 404s
 * while it was otherwise answering fine.
 */
describe("isRetryableGeminiFailure", () => {
  it("retries an empty bodied 404, which is an edge hiccup", () => {
    expect(isRetryableGeminiFailure(404, "")).toBe(true);
    expect(isRetryableGeminiFailure(404, "   \n")).toBe(true);
  });

  it("does not retry a 404 that names the missing model", () => {
    // The body is the API answering. Waiting will not conjure the model up.
    expect(
      isRetryableGeminiFailure(
        404,
        '{"error":{"message":"models/gemini-x is not found"}}',
      ),
    ).toBe(false);
  });

  it("follows the shared rules for everything else", () => {
    expect(isRetryableGeminiFailure(503, '{"error":{"message":"high demand"}}')).toBe(
      true,
    );
    expect(isRetryableGeminiFailure(429, "")).toBe(true);
    expect(isRetryableGeminiFailure(400, '{"error":{"message":"bad schema"}}')).toBe(
      false,
    );
    expect(isRetryableGeminiFailure(401, "")).toBe(false);
  });
});

describe("readGeminiBody", () => {
  const answer = {
    candidates: [
      {
        content: {
          parts: [
            { text: "The manager should not see this.", thought: true },
            { text: '{"stages":' },
            { text: "[]}" },
          ],
        },
        finishReason: "STOP",
      },
    ],
    // The measured numbers from the smoke test: thinking was four times the
    // answer, so the difference is not a rounding error.
    usageMetadata: {
      promptTokenCount: 185,
      candidatesTokenCount: 322,
      thoughtsTokenCount: 1248,
    },
  };

  it("concatenates the answer parts", () => {
    expect(readGeminiBody(answer).text).toBe('{"stages":[]}');
  });

  it("drops the model's private thinking", () => {
    // Same rule as readStreamedBody and NVIDIA's reasoning_content: a model's
    // deliberation about a job ad is not the answer and must not reach the
    // parser or a manager's screen.
    expect(readGeminiBody(answer).text).not.toContain("should not see");
  });

  it("counts thinking as output, because Google bills it that way", () => {
    const reading = readGeminiBody(answer);
    expect(reading.inputTokens).toBe(185);
    expect(reading.outputTokens).toBe(322 + 1248);
  });

  it("reports no usage as null rather than as zero", () => {
    const reading = readGeminiBody({ candidates: [{ content: { parts: [{ text: "{}" }] } }] });
    expect(reading.inputTokens).toBeNull();
    expect(reading.outputTokens).toBeNull();
  });

  it("says a truncated answer was truncated", () => {
    expect(() =>
      readGeminiBody({
        candidates: [
          { content: { parts: [{ text: '{"stages":' }] }, finishReason: "MAX_TOKENS" },
        ],
      }),
    ).toThrow(/cut off before the JSON was complete/);
  });

  it("names a safety block instead of calling it a network failure", () => {
    // A job ad tripping a filter is plausible, and a manager sent hunting for a
    // connection problem will not find one.
    expect(() => readGeminiBody({ promptFeedback: { blockReason: "OTHER" } })).toThrow(
      /OTHER/,
    );
    expect(() =>
      readGeminiBody({ candidates: [{ finishReason: "SAFETY" }] }),
    ).toThrow(/SAFETY/);
  });
});

describe("images for the proctoring second look", () => {
  const request = {
    messages: [
      { role: "system" as const, content: "rules" },
      { role: "user" as const, content: "look at these" },
    ],
    schemaName: "x",
    jsonSchema: { type: "object" },
    images: [{ mime: "image/jpeg", base64: "AAAA" }],
  };

  it("puts images on the last user turn as data URLs for chat completions", () => {
    const out = withImagesOpenAi(request) as Array<{ role: string; content: unknown }>;
    expect(out[0]).toEqual({ role: "system", content: "rules" });
    expect(out[1].content).toEqual([
      { type: "text", text: "look at these" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
    ]);
  });

  it("leaves text-only requests unchanged", () => {
    const { images: _drop, ...plain } = request;
    void _drop;
    expect(withImagesOpenAi(plain)).toBe(plain.messages);
  });
});
