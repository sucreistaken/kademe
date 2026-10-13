import Anthropic from "@anthropic-ai/sdk";
import { AiUnavailable, getAiProvider, type AiJsonRequest, type AiJsonResponse, type AiProvider } from "@/lib/ai";

/**
 * Claude, for the AI second look at proctoring frames.
 *
 * Gemini stays the main provider for everything else. A caller that asks for
 * the review provider gets Claude when `ANTHROPIC_API_KEY` is set, and the
 * main provider otherwise, so a missing key changes nothing.
 *
 * `ANTHROPIC_REVIEW_MODEL` picks the model. Haiku is the default: the review
 * only reports what is visible in a few frames and a teacher decides every
 * flag, so it does not need Sonnet at twice the price. Sonnet stays available. A key that is not tied to a workspace also needs
 * `ANTHROPIC_WORKSPACE_ID`, or every request is refused.
 */

export const DEFAULT_REVIEW_MODEL = "claude-haiku-4-5";

/** USD per million tokens, input then output. Keyed by model id prefix. */
const PRICES: Array<[prefix: string, input: number, output: number]> = [
  ["claude-sonnet-5-5", 2, 10],
  ["claude-haiku-4-5", 1, 5],
  ["claude-opus-4-8", 5, 25],
];

export function costFor(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = PRICES.find(([prefix]) => model.startsWith(prefix));
  if (!price) return null;
  return (inputTokens * price[1] + outputTokens * price[2]) / 1_000_000;
}

type ImageMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** The part of the SDK client this provider uses, so tests can pass a fake. */
export type MessagesClient = Pick<Anthropic["beta"]["messages"], "create">;

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly available = true;
  private readonly messages: MessagesClient;

  constructor(
    readonly model: string,
    options: { apiKey: string; workspaceId?: string } | { client: MessagesClient },
  ) {
    this.messages =
      "client" in options
        ? options.client
        : new Anthropic({
            apiKey: options.apiKey,
            ...(options.workspaceId ? { defaultHeaders: { "anthropic-workspace-id": options.workspaceId } } : {}),
          }).beta.messages;
  }

  /** Haiku has no effort setting and no server-side fallback. */
  private get isHaiku() {
    return this.model.startsWith("claude-haiku");
  }

  async completeJson(request: AiJsonRequest): Promise<AiJsonResponse> {
    const system = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const turns = request.messages.filter((message) => message.role !== "system");
    const lastUser = turns.map((message) => message.role).lastIndexOf("user");
    const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((message, index) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content:
        index === lastUser && request.images?.length
          ? [
              ...request.images.map((image) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: image.mime as ImageMime, data: image.base64 },
              })),
              { type: "text" as const, text: message.content },
            ]
          : message.content,
    }));

    const response = await this.messages.create({
      model: this.model,
      // Sonnet thinks before it answers and that counts against this cap, so
      // the caller's small JSON budget is a floor, not the limit.
      max_tokens: this.isHaiku ? (request.maxTokens ?? 4000) : Math.max(request.maxTokens ?? 0, 16000),
      ...(system ? { system } : {}),
      messages,
      output_config: {
        format: { type: "json_schema", schema: request.jsonSchema },
        ...(this.isHaiku ? {} : { effort: "medium" as const }),
      },
      // A declined request is re-run on Anthropic's recommended model instead
      // of coming back empty.
      ...(this.isHaiku ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    });

    if (response.stop_reason === "refusal") {
      throw new AiUnavailable(`${response.model} declined the request (${response.stop_details?.category ?? "no category"})`);
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error(`${response.model} ran out of tokens before finishing the answer`);
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    return {
      text,
      model: response.model,
      inputTokens,
      outputTokens,
      costUsd: costFor(response.model, inputTokens, outputTokens),
      attempts: 1,
      transientErrors: [],
      fellBackTo: response.model === this.model ? null : response.model,
    };
  }
}

let cachedReview: AiProvider | null = null;

export function buildReviewProvider(env: NodeJS.ProcessEnv): AiProvider | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new AnthropicProvider(env.ANTHROPIC_REVIEW_MODEL?.trim() || DEFAULT_REVIEW_MODEL, {
    apiKey,
    workspaceId: env.ANTHROPIC_WORKSPACE_ID?.trim() || undefined,
  });
}

/** Claude when it is configured, the main provider otherwise. */
export function getReviewProvider(): AiProvider {
  if (cachedReview) return cachedReview;
  cachedReview = buildReviewProvider(process.env) ?? getAiProvider();
  return cachedReview;
}

/** Only for tests. */
export function resetReviewProvider() {
  cachedReview = null;
}
