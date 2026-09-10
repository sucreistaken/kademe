import { createHash } from "node:crypto";

/**
 * Text generation, behind an interface.
 *
 * The same two rules the transcription pipeline follows apply here, for the
 * same reasons:
 *  1. A call that fails writes nothing. There is no fallback that invents a
 *     plausible assessment, because a manager cannot tell an invented draft
 *     from a real one and would go on to interview people with it.
 *  2. Every call lands in `ai_runs`, successful or not.
 *
 * Only the three purposes in `ai_purpose` may use this. Scoring, ranking or
 * reading emotion off a candidate are not among them and never will be.
 */

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiJsonRequest = {
  messages: AiMessage[];
  /** Name reported to the provider for the schema. Diagnostics only. */
  schemaName: string;
  /** JSON Schema the answer must satisfy. Validation still happens locally. */
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
};

export type AiJsonResponse = {
  /** Raw model output. The caller parses and validates it. */
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  /** How many requests this answer took, including the ones that failed. */
  attempts: number;
  /** The transient failures that were retried, so the caller can log them. */
  transientErrors: string[];
  /**
   * Set to the provider that actually answered when the preferred one gave up
   * and a second one was tried. Null on the normal path.
   *
   * The caller has to be able to say this out loud: falling back from a ten
   * second model to a three minute one changes what the manager is waiting for,
   * and a spinner that silently grew twentyfold reads as a hang.
   */
  fellBackTo: string | null;
};

export class AiUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailable";
  }
}

export interface AiProvider {
  readonly name: string;
  /** False when the provider is not configured. Callers must check first. */
  readonly available: boolean;
  readonly model: string;
  completeJson(request: AiJsonRequest): Promise<AiJsonResponse>;
}

/**
 * Default model on OpenRouter.
 *
 * Picked on 2026-09-08 from the live OpenRouter catalogue, on three grounds:
 *  - it lists `structured_outputs` in its supported parameters, so the schema
 *    is enforced by the provider and not just requested in the prompt;
 *  - the draft it produces is read by a Turkish speaking manager, and the
 *    weaker and cheaper models write stiff, translated sounding Turkish;
 *  - at 2 USD per million input and 10 per million output tokens a draft costs
 *    roughly two cents.
 *
 * `OPENROUTER_MODEL` overrides it. Note that this model does not accept a
 * `temperature` parameter, which is why none is sent.
 */
export const DEFAULT_AI_MODEL = "anthropic/claude-sonnet-5";

/**
 * Default model on NVIDIA's hosted endpoint.
 *
 * Verified in this project on 2026-09-08: it honours `response_format`
 * json_schema and answers with clean JSON in usable Turkish. Its smaller
 * sibling, nemotron-3-super-120b-a12b, does not: it narrates its reasoning into
 * the content field even with a schema attached, so it is not a fallback here.
 *
 * It is a reasoning model, so it thinks before it answers and a draft takes
 * noticeably longer than the OpenRouter default. Hence the longer timeout and
 * the larger token ceiling below.
 */
export const DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";

/**
 * Default model on Google's Generative Language endpoint.
 *
 * Picked on 2026-09-09 for latency. A smoke test against AI Studio answered in
 * 9.4 seconds with valid JSON honouring a `responseSchema`, against 131, 152,
 * 227 and 275 seconds for the NVIDIA reasoning model on the real prompt. That
 * is the difference between a server action and a platform timeout.
 *
 * The 9.4 seconds came from a short probe prompt, not from this product's
 * prompt, so nothing here is sized from it. Real numbers come from
 * `pnpm verify:ai`.
 *
 * `GEMINI_MODEL` overrides it.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export type ProviderKind = "openrouter" | "nvidia" | "gemini";

export type ProviderConfig = {
  kind: ProviderKind;
  /**
   * Where the request goes. The OpenAI compatible providers put the whole chat
   * completions URL here; Gemini puts the API root, because its model name and
   * its method are part of the path.
   */
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  headers: Record<string, string>;
  /** Provider specific request fields merged into the body as they are. */
  extraBody: Record<string, unknown>;
  /**
   * How long to wait before each retry, and therefore how many retries there
   * are. Per provider on purpose: fifteen seconds of dead air is a rounding
   * error next to a three minute reasoning model and most of the wall clock
   * next to a ten second one.
   */
  retryDelaysMs: number[];
  /**
   * Read the answer as a stream.
   *
   * Not a nicety: Node's fetch gives up on a response whose headers have not
   * arrived within five minutes, and a slow reasoning model hits that wall with
   * a bare "fetch failed" after ten minutes of retries. A streamed response
   * answers immediately and then keeps the socket busy.
   */
  stream: boolean;
};

/**
 * Which provider a given environment selects.
 *
 * Pure, so the selection rules can be tested without touching `process.env`.
 *
 * `AI_PROVIDER` decides when it is set. With no explicit choice the order is
 * Gemini, then NVIDIA, then OpenRouter.
 *
 * Gemini leads on latency, not on price. The rule used to be "spending money is
 * opt in", and the free NVIDIA endpoint won; that rule was written before the
 * wait was measured. A draft that takes 131 to 275 seconds does not fit in a
 * server action, and a manager watching a spinner for four minutes abandons the
 * screen. Ten seconds does fit. OpenRouter, which bills per call, still comes
 * last and still has to be asked for by name.
 */
export function chooseProvider(
  env: Record<string, string | undefined>,
): ProviderConfig | null {
  const openrouterKey = env.OPENROUTER_API_KEY?.trim();
  const nvidiaKey = env.NVIDIA_API_KEY?.trim();
  const geminiKey = env.GOOGLE_AI_API_KEY?.trim();
  const asked = env.AI_PROVIDER?.trim().toLowerCase();

  const openrouter = (): ProviderConfig | null =>
    openrouterKey
      ? {
          kind: "openrouter",
          baseUrl: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: openrouterKey,
          model: env.OPENROUTER_MODEL?.trim() || DEFAULT_AI_MODEL,
          timeoutMs: 120_000,
          maxTokens: 8000,
          // Shown in the OpenRouter dashboard, so a spike in spend can be
          // traced back to this product rather than to an anonymous key.
          headers: { "X-Title": "Kademe" },
          extraBody: {},
          retryDelaysMs: [...SLOW_RETRY_DELAYS_MS],
          stream: false,
        }
      : null;

  const nvidia = (): ProviderConfig | null =>
    nvidiaKey
      ? {
          kind: "nvidia",
          baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
          apiKey: nvidiaKey,
          model: env.NVIDIA_MODEL?.trim() || DEFAULT_NVIDIA_MODEL,
          // A reasoning model thinks before it answers, and a draft is a long
          // answer. Measured runs: 131, 152, 227 and 275 seconds, and one that
          // was still thinking at 300. Ten minutes is the ceiling that stops
          // the manager losing a run they already waited five minutes for.
          timeoutMs: 600_000,
          // Reasoning tokens are billed against the completion, so a ceiling
          // sized for a non reasoning model truncates the JSON. 16000 was not
          // enough: a real run stopped mid object after 275 seconds. The
          // endpoint accepts 32000.
          maxTokens: 32_000,
          headers: {},
          // Capping the thinking would be the better answer to the latency,
          // but this endpoint refuses it: chat_template_kwargs.reasoning_budget
          // comes back as 400 "thinking_token_budget is not yet supported by
          // the V2 model runner". So the deadline above absorbs it instead.
          extraBody: {},
          retryDelaysMs: [...SLOW_RETRY_DELAYS_MS],
          stream: true,
        }
      : null;

  const gemini = (): ProviderConfig | null =>
    geminiKey
      ? {
          kind: "gemini",
          // The model and the method are path segments on this API, so only the
          // root lives here and `GeminiProvider` composes the rest.
          baseUrl: "https://generativelanguage.googleapis.com/v1beta",
          apiKey: geminiKey,
          model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
          // Two minutes, not the ten the reasoning model needed. This model
          // answers in seconds; a two minute wait already means something is
          // wrong, and the fallback below is a better answer than more waiting.
          timeoutMs: 120_000,
          // Thinking is billed as output here too, so the ceiling has to leave
          // room for it on top of the JSON.
          maxTokens: 32_000,
          headers: {},
          // thinkingConfig is deliberately left at its default in this pass.
          // Capping the thinking is the obvious lever on latency, but the size
          // of the cap has to come from `pnpm verify:ai` measurements on the
          // real prompt rather than from a guess: NVIDIA's equivalent attempt
          // (chat_template_kwargs.reasoning_budget) came back 400, and a cap
          // set too low here truncates the JSON instead of speeding it up.
          extraBody: {},
          retryDelaysMs: [...FAST_RETRY_DELAYS_MS],
          stream: false,
        }
      : null;

  if (asked === "openrouter") return openrouter();
  if (asked === "nvidia") return nvidia();
  if (asked === "gemini") return gemini();
  return gemini() ?? nvidia() ?? openrouter();
}

/**
 * Waits between retries for a slow model. Two extra attempts, five then fifteen
 * seconds.
 *
 * Sized against the observed failure: NVIDIA's shared endpoint answered 503
 * "Service temporarily overloaded" on two of five runs. A manager who waited
 * three minutes for a draft should not be handed an error the provider itself
 * calls temporary.
 */
const SLOW_RETRY_DELAYS_MS = [5_000, 15_000];

/**
 * The same two extra attempts, sized for a model that answers in seconds.
 *
 * Google's endpoint produced an empty bodied 404 several times and a 503 "high
 * demand" once during a few minutes of probing, so the retries earn their keep.
 * But twenty seconds of waiting on top of a ten second call is most of the run,
 * and the failures seen were instant edge hiccups rather than a queue that
 * needs draining.
 */
const FAST_RETRY_DELAYS_MS = [1_000, 4_000];

/**
 * Whether a status is worth waiting out.
 *
 * 402 is deliberately absent: an account out of credit is not going to have
 * credit fifteen seconds later, and retrying only makes the manager wait longer
 * for the same answer. Same for 401 and 400, which are configuration mistakes.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The retry loop both providers share.
 *
 * `attempt` is handed the attempt number, which ends up in `ai_runs`, and the
 * list of transient failures so far, which the caller logs one row each. Only a
 * `TransientProviderError` is retried; everything else is the provider's real
 * answer and is passed straight through.
 */
async function runWithRetries<T>(
  delays: number[],
  attempt: (attemptNumber: number, transientErrors: string[]) => Promise<T>,
): Promise<T> {
  const transientErrors: string[] = [];

  for (let index = 0; ; index += 1) {
    try {
      return await attempt(index + 1, transientErrors);
    } catch (error) {
      if (!(error instanceof TransientProviderError)) throw error;
      if (index >= delays.length) {
        // Out of retries. The message says how hard we tried, because
        // "service overloaded" reads very differently after three attempts.
        throw new RetriesExhaustedError(
          `${error.message} (${index + 1} deneme yapıldı, hepsi başarısız)`,
        );
      }
      transientErrors.push(error.message);
      await sleep(delays[index]);
    }
  }
}

type ChatCompletionBody = {
  choices?: Array<{
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    /** OpenRouter reports credits here. It sells one credit per US dollar, so
     *  this is stored in `ai_runs.cost_usd` as is. NVIDIA's endpoint reports no
     *  cost, and the column stays null rather than carrying a guess. */
    cost?: number;
  };
  error?: { message?: string };
};

/**
 * One client for both providers. OpenRouter and NVIDIA both speak the OpenAI
 * chat completions shape, so a second class would only duplicate the parts that
 * can actually break: the error handling and the usage mapping.
 */
class OpenAiCompatibleProvider implements AiProvider {
  readonly available = true;

  constructor(private readonly config: ProviderConfig) {}

  get name() {
    return this.config.kind;
  }

  get model() {
    return this.config.model;
  }

  async completeJson(request: AiJsonRequest): Promise<AiJsonResponse> {
    return runWithRetries(this.config.retryDelaysMs, (attempt, transientErrors) =>
      this.attempt(request, attempt, transientErrors),
    );
  }

  private async attempt(
    request: AiJsonRequest,
    attempts: number,
    transientErrors: string[],
  ): Promise<AiJsonResponse> {
    let res: Response;
    try {
      res = await fetch(this.config.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify({
          ...this.config.extraBody,
          model: this.config.model,
          messages: request.messages,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.schemaName,
              strict: true,
              schema: request.jsonSchema,
            },
          },
          ...(this.config.stream
            ? { stream: true, stream_options: { include_usage: true } }
            : {}),
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      // A reasoning model that runs past the deadline looks exactly like a
      // network failure unless the message says which one it was.
      if (error instanceof Error && error.name === "TimeoutError") {
        // Not retried: the deadline is already five minutes, and a second wait
        // would leave the manager staring at a spinner for ten.
        throw new Error(
          `${this.name}: model did not answer within ${Math.round(
            this.config.timeoutMs / 1000,
          )}s`,
        );
      }
      // A socket that died on the way out is worth one more try.
      throw new TransientProviderError(
        `${this.name} network error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      const message = `${this.name} ${res.status}: ${detail}`;
      if (isRetryableStatus(res.status)) throw new TransientProviderError(message);
      throw new Error(message);
    }

    const body = this.config.stream
      ? await readStreamedBody(res)
      : ((await res.json()) as ChatCompletionBody);
    if (body.error?.message) {
      throw new Error(`${this.name} error: ${body.error.message}`);
    }

    const choice = body.choices?.[0];
    if (choice?.message?.refusal) {
      throw new Error(`Model refused: ${choice.message.refusal}`);
    }
    // A cut-off answer is invalid JSON and would fail validation anyway, but it
    // fails with a confusing parse error. Say what actually happened.
    if (choice?.finish_reason === "length") {
      throw new Error("Model output was cut off before the JSON was complete");
    }

    const text = choice?.message?.content ?? "";
    if (!text.trim()) throw new Error(`${this.name} returned an empty answer`);

    return {
      text,
      model: this.config.model,
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
      costUsd: typeof body.usage?.cost === "number" ? body.usage.cost : null,
      attempts,
      transientErrors: [...transientErrors],
      fellBackTo: null,
    };
  }
}

/**
 * Folds a server sent event stream back into the shape the non streaming path
 * returns, so everything downstream stays unaware of the difference.
 *
 * Only `content` is collected. A reasoning model also streams its thinking, in
 * `reasoning_content`, and that is deliberately dropped: it is not the answer,
 * and keeping it would put a model's private deliberation about a job ad into
 * the parser and, from there, into a manager's screen.
 */
async function readStreamedBody(res: Response): Promise<ChatCompletionBody> {
  if (!res.body) throw new Error("stream had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | undefined;
  let usage: ChatCompletionBody["usage"];

  const handleEvent = (payload: string) => {
    if (payload === "[DONE]") return;
    let chunk: {
      choices?: Array<{
        delta?: { content?: string | null };
        finish_reason?: string | null;
      }>;
      usage?: ChatCompletionBody["usage"];
      error?: { message?: string };
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      // A half written event is not worth failing the whole answer over.
      return;
    }
    if (chunk.error?.message) throw new Error(chunk.error.message);
    const choice = chunk.choices?.[0];
    if (choice?.delta?.content) content += choice.delta.content;
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (chunk.usage) usage = chunk.usage;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of event.split("\n")) {
        if (line.startsWith("data:")) handleEvent(line.slice(5).trim());
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage,
  };
}

/** A failure the provider itself calls temporary. Retried, then given up on. */
class TransientProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientProviderError";
  }
}

/**
 * A provider that was busy or broken for every attempt we made.
 *
 * Its own class, not a bare Error, so the fallback below can tell "this
 * endpoint is having a bad minute" apart from "this request is wrong": a typo
 * in the model name or a safety block will fail exactly the same way on the
 * second provider, and sending the job ad there would be a pointless second
 * disclosure on top of a pointless extra wait.
 */
class RetriesExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetriesExhaustedError";
  }
}

/* --------------------------------------------------------------------------
 * Gemini
 *
 * Google's Generative Language API is not OpenAI compatible: different request
 * shape, different response shape, key in the query string. Only the request
 * body and the reading of the answer are written again here. The retry loop,
 * the transient/permanent split and the `AiJsonResponse` contract are shared.
 * ----------------------------------------------------------------------- */

/** The parts of Gemini's answer this product reads. */
export type GeminiResponseBody = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

/**
 * The keys Gemini's `responseSchema` understands.
 *
 * It takes an OpenAPI 3.0 subset, not JSON Schema, and rejects the request
 * outright on an unknown key rather than ignoring it.
 */
const GEMINI_SCHEMA_KEYS = [
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "description",
  "nullable",
] as const;

/**
 * Rewrites a JSON Schema into the subset Gemini's `responseSchema` accepts.
 *
 * The one that matters is `additionalProperties: false`, which
 * `TEMPLATE_DRAFT_JSON_SCHEMA` sets at every object level because OpenAI strict
 * mode requires it, and which Gemini refuses.
 *
 * Dropping it does not weaken the guard. The schema sent to a provider was
 * never the thing standing between a model and the database: `parseDraftAnswer`
 * is, and it runs zod over the answer whichever provider produced it. A zod
 * object schema strips keys it does not know about, so a model that invents a
 * field gets it discarded before anything is written. What the provider side
 * schema buys is a better first attempt, not safety.
 *
 * Returns a fresh tree and never touches its argument.
 * `TEMPLATE_DRAFT_JSON_SCHEMA` is a module level singleton that the OpenAI
 * compatible path is handed as well, so mutating it here would quietly corrupt
 * the other providers' requests.
 */
export function toGeminiSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of GEMINI_SCHEMA_KEYS) {
    if (!(key in schema)) continue;
    const value = schema[key];

    if (key === "properties" && isPlainObject(value)) {
      const properties: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(value)) {
        properties[name] = isPlainObject(child) ? toGeminiSchema(child) : child;
      }
      out.properties = properties;
      continue;
    }

    if (key === "items" && isPlainObject(value)) {
      out.items = toGeminiSchema(value);
      continue;
    }

    out[key] = Array.isArray(value) ? [...value] : value;
  }

  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether a failed Gemini request is worth trying again.
 *
 * 404 is the interesting case and is deliberately not retryable in general: a
 * typo in `GEMINI_MODEL` produces a 404 that will never fix itself, and
 * retrying it only makes the manager wait longer for the same mistake. That
 * 404 carries a body naming the model it could not find.
 *
 * An empty bodied 404 is a different animal. It showed up several times while
 * probing an endpoint that answered fine before and after, with no error object
 * at all, which is an edge or proxy hiccup rather than an answer from the API.
 */
export function isRetryableGeminiFailure(status: number, body: string): boolean {
  if (status === 404) return body.trim().length === 0;
  return isRetryableStatus(status);
}

/** What `readGeminiBody` pulls out of an answer. */
export type GeminiReading = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

/**
 * Reads Gemini's answer, or throws with what went wrong.
 *
 * Thinking parts are dropped. A part carrying `thought: true` is the model's
 * private deliberation about a job ad, not its answer, and `readStreamedBody`
 * refuses NVIDIA's `reasoning_content` for exactly the same reason: keeping it
 * would push that text through the parser and onto a manager's screen.
 *
 * Everything thrown here is permanent. A safety block and a truncated answer
 * are both real answers from the API, and neither becomes a draft by being
 * asked again.
 */
export function readGeminiBody(body: GeminiResponseBody): GeminiReading {
  if (body.error?.message) {
    throw new Error(`gemini error: ${body.error.message}`);
  }

  // A blocked prompt comes back with no candidate at all. Reporting it as a
  // network failure would send a manager hunting for a connection problem that
  // is not there, when what happened is that a filter refused the job ad.
  const blockReason = body.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(
      `Gemini istemi güvenlik filtresine takıldı (${blockReason}). İlan metni değiştirilmeden bu istek geçmez.`,
    );
  }

  const candidate = body.candidates?.[0];

  if (candidate?.finishReason === "SAFETY") {
    throw new Error(
      "Gemini cevabı güvenlik filtresine takıldı (SAFETY). İlan metni değiştirilmeden bu istek geçmez.",
    );
  }

  // A cut-off answer is invalid JSON and would fail validation anyway, but it
  // fails with a confusing parse error. Say what actually happened.
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Model output was cut off before the JSON was complete");
  }

  const text = (candidate?.content?.parts ?? [])
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? "")
    .join("");

  const usage = body.usageMetadata;
  // Google bills thinking as output, and on the smoke test the thinking was
  // four times the answer (322 visible against 1248 thought). Reporting only
  // candidatesTokenCount would leave `ai_runs` understating what this product
  // actually consumed, which is the one thing an audit table must not do.
  const outputTokens =
    usage?.candidatesTokenCount === undefined &&
    usage?.thoughtsTokenCount === undefined
      ? null
      : (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);

  return {
    text,
    inputTokens: usage?.promptTokenCount ?? null,
    outputTokens,
  };
}

/** The client for Google's Generative Language API. */
class GeminiProvider implements AiProvider {
  readonly available = true;

  constructor(private readonly config: ProviderConfig) {}

  get name() {
    return this.config.kind;
  }

  get model() {
    return this.config.model;
  }

  async completeJson(request: AiJsonRequest): Promise<AiJsonResponse> {
    return runWithRetries(this.config.retryDelaysMs, (attempt, transientErrors) =>
      this.attempt(request, attempt, transientErrors),
    );
  }

  private async attempt(
    request: AiJsonRequest,
    attempts: number,
    transientErrors: string[],
  ): Promise<AiJsonResponse> {
    // The key is a query parameter on this API, so the URL is a secret and
    // never goes into an error message or a log line.
    const url = `${this.config.baseUrl}/models/${encodeURIComponent(
      this.config.model,
    )}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;

    // Gemini keeps the system prompt out of the turn list, and calls the
    // assistant side "model". The repair attempt replays a previous answer, so
    // that role has to survive the translation.
    const systemText = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const contents = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.config.headers },
        body: JSON.stringify({
          contents,
          ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: toGeminiSchema(request.jsonSchema),
            maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `${this.name}: model did not answer within ${Math.round(
            this.config.timeoutMs / 1000,
          )}s`,
        );
      }
      throw new TransientProviderError(
        `${this.name} network error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      const message = `${this.name} ${res.status}: ${detail}`;
      if (isRetryableGeminiFailure(res.status, detail)) {
        throw new TransientProviderError(message);
      }
      throw new Error(message);
    }

    const body = (await res.json()) as GeminiResponseBody;
    const reading = readGeminiBody(body);
    if (!reading.text.trim()) {
      throw new Error(`${this.name} returned an empty answer`);
    }

    return {
      text: reading.text,
      model: this.config.model,
      inputTokens: reading.inputTokens,
      outputTokens: reading.outputTokens,
      // The REST answer carries no price, same as NVIDIA. A hardcoded tariff
      // would rot silently and an audit table is the wrong place for a guess.
      costUsd: null,
      attempts,
      transientErrors: [...transientErrors],
      fellBackTo: null,
    };
  }
}

/**
 * Tries a second provider when the first one runs out of retries.
 *
 * Only worth doing because the two are so different in speed: Gemini answers in
 * seconds and NVIDIA in minutes, so a manager whose fast provider is having a
 * bad minute would rather wait than start over. The reverse trade would not be
 * worth making.
 *
 * Narrow on purpose. Only `RetriesExhaustedError` falls through, so a wrong
 * model name, a safety block or a request the API rejected fails immediately
 * instead of being asked again, more slowly, of a second subprocessor.
 *
 * The failure that caused the fallback is passed on in `transientErrors`, so it
 * still gets its own `ai_runs` row.
 */
class FallbackAiProvider implements AiProvider {
  readonly available = true;

  constructor(
    private readonly primary: AiProvider,
    private readonly secondary: AiProvider,
  ) {}

  get name() {
    return this.primary.name;
  }

  get model() {
    return this.primary.model;
  }

  async completeJson(request: AiJsonRequest): Promise<AiJsonResponse> {
    try {
      return await this.primary.completeJson(request);
    } catch (error) {
      if (!(error instanceof RetriesExhaustedError)) throw error;

      const answer = await this.secondary.completeJson(request);
      return {
        ...answer,
        transientErrors: [
          `${this.primary.name} vazgeçti, ${this.secondary.name} denendi: ${error.message}`,
          ...answer.transientErrors,
        ],
        fellBackTo: this.secondary.name,
      };
    }
  }
}

/**
 * What runs until an API key exists. It refuses out loud rather than returning
 * something that looks like a draft, because a fabricated assessment is worse
 * than no assessment: nothing in the UI would mark it as fake.
 */
class UnconfiguredAiProvider implements AiProvider {
  readonly name = "unconfigured";
  readonly available = false;
  readonly model = DEFAULT_GEMINI_MODEL;

  async completeJson(): Promise<AiJsonResponse> {
    throw new AiUnavailable(
      "No AI provider is configured: set GOOGLE_AI_API_KEY, NVIDIA_API_KEY or OPENROUTER_API_KEY.",
    );
  }
}

let cached: AiProvider | null = null;

function createProvider(config: ProviderConfig): AiProvider {
  return config.kind === "gemini"
    ? new GeminiProvider(config)
    : new OpenAiCompatibleProvider(config);
}

/**
 * Builds the provider an environment implies, fallback included.
 *
 * Pure in everything but the name, so the wiring can be reasoned about without
 * `process.env`. The fallback is only attached under Gemini, and only when an
 * NVIDIA key is already present: it is a second route to a provider this
 * deployment has already chosen to use, not a new one being introduced behind
 * the operator's back.
 */
function buildAiProvider(env: Record<string, string | undefined>): AiProvider {
  const config = chooseProvider(env);
  if (!config) return new UnconfiguredAiProvider();

  const primary = createProvider(config);
  if (config.kind !== "gemini") return primary;

  const backup = chooseProvider({ ...env, AI_PROVIDER: "nvidia" });
  if (!backup) return primary;
  return new FallbackAiProvider(primary, createProvider(backup));
}

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  cached = buildAiProvider(process.env);
  return cached;
}

/** Only for tests, which must not inherit a provider built from a real key. */
export function resetAiProvider() {
  cached = null;
}

/**
 * What goes into `ai_runs.prompt_hash`. The prompt itself is not stored: it
 * carries the job ad, and the column exists to prove two runs used the same
 * prompt, not to keep a copy of it.
 */
export function hashPrompt(messages: AiMessage[]): string {
  const hash = createHash("sha256");
  for (const message of messages) {
    hash.update(message.role);
    hash.update("\n");
    hash.update(message.content);
    hash.update("\n");
  }
  return hash.digest("hex").slice(0, 32);
}
