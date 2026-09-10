import type { TranscriptWord } from "@/db/schema/types";
import { getStorage } from "@/lib/storage";

/**
 * Speech to text, behind an interface.
 *
 * The manager side is built to read rather than watch: the review screen shows
 * a transcript next to the player and a click on a line seeks the video. That
 * only works with word level timestamps, so a provider that cannot give them is
 * not usable here.
 *
 * Two hard rules:
 *  1. A failed transcription writes nothing. The review screen already says
 *     "this answer has no transcript yet"; inventing text would put words in a
 *     candidate's mouth and be scored as if they had said them.
 *  2. Every call is recorded in `ai_runs`, because the EU AI Act traceability
 *     story for this product is "we can show you every model call we made".
 */

export type TranscriptionInput = {
  storageKey: string;
  mime: string;
  /** The language the assessment was sent in. A hint, never a constraint: a
   *  candidate invited in Turkish may well answer in English. */
  languageHint?: string | null;
};

export type TranscriptionResult = {
  text: string;
  words: TranscriptWord[];
  /** What the provider decided the language actually was. */
  language: string | null;
  model: string;
  costUsd: number | null;
  durationMs: number | null;
};

export class TranscriberUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriberUnavailable";
  }
}

export interface Transcriber {
  readonly name: string;
  /** False when the provider is not configured. Callers must check first. */
  readonly available: boolean;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

/** Only spoken words carry timestamps worth seeking to. */
export type ScribeWord = {
  text?: string;
  type?: "word" | "spacing" | "audio_event";
  start?: number;
  end?: number;
};

export type ScribeResponse = {
  language_code?: string;
  language_probability?: number;
  text?: string;
  words?: ScribeWord[];
};

const SCRIBE_URL = "https://api.elevenlabs.io/v1/speech-to-text";

/**
 * Published rate at the time of writing, kept in configuration because a price
 * that drifts silently makes the `ai_runs` cost column a lie. The number stored
 * per run is an estimate derived from media duration, not an invoice.
 */
const DEFAULT_USD_PER_HOUR = 0.22;

class ElevenLabsTranscriber implements Transcriber {
  readonly name = "elevenlabs-scribe";
  readonly available = true;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const storage = getStorage();
    const form = new FormData();
    form.set("model_id", this.model);
    form.set("timestamps_granularity", "word");
    if (input.languageHint) form.set("language_code", input.languageHint);

    if (storage.name === "r2") {
      // Object storage can hand out a signed URL the provider fetches itself,
      // so the bytes never travel through this process.
      form.set("source_url", await storage.getSignedUrl(input.storageKey, 900));
    } else {
      // Local development has no publicly reachable URL, so the file is posted.
      const { stream } = await storage.openStream(input.storageKey);
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      form.set(
        "file",
        new Blob([bytes], { type: input.mime.split(";")[0] }),
        input.storageKey.split("/").pop() ?? "answer",
      );
    }

    const res = await fetch(SCRIBE_URL, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey },
      body: form,
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      throw new Error(`Scribe ${res.status}: ${detail}`);
    }

    return mapScribeResponse((await res.json()) as ScribeResponse, this.model);
  }
}

/**
 * Turns a Scribe response into what the database stores. Split out from the
 * request so the mapping can be tested without an API key: this is the part
 * that would quietly ruin transcript seeking if it drifted.
 *
 * Only `word` entries are kept. `spacing` and `audio_event` entries carry no
 * position a manager would want to click on, and would clutter the transcript
 * with blanks.
 */
export function mapScribeResponse(
  body: ScribeResponse,
  model: string,
): TranscriptionResult {
  const words = (body.words ?? [])
    .filter(
      (w): w is ScribeWord & { text: string; start: number; end: number } =>
        w.type === "word" &&
        typeof w.text === "string" &&
        typeof w.start === "number" &&
        typeof w.end === "number",
    )
    .map((w) => ({
      text: w.text,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
    }));

  const text = (body.text ?? "").trim();
  if (!text) throw new Error("Scribe returned an empty transcript");

  const durationMs = words.length > 0 ? words[words.length - 1].endMs : null;

  return {
    text,
    words,
    language: body.language_code ?? null,
    model,
    costUsd: durationMs === null ? null : estimateCostUsd(durationMs),
    durationMs,
  };
}

/**
 * What runs until the API key exists. It refuses rather than pretending, so a
 * developer never sees a green pipeline that is quietly transcribing nothing.
 */
class NoopTranscriber implements Transcriber {
  readonly name = "noop";
  readonly available = false;

  async transcribe(): Promise<TranscriptionResult> {
    throw new TranscriberUnavailable(
      "ELEVENLABS_API_KEY is not set, so no transcription provider is configured.",
    );
  }
}

export function estimateCostUsd(durationMs: number): number {
  const perHour = Number(
    process.env.ELEVENLABS_STT_USD_PER_HOUR ?? DEFAULT_USD_PER_HOUR,
  );
  const hours = durationMs / 3_600_000;
  return Number((hours * perHour).toFixed(6));
}

let cached: Transcriber | null = null;

export function getTranscriber(): Transcriber {
  if (cached) return cached;
  const key = process.env.ELEVENLABS_API_KEY;
  cached = key
    ? new ElevenLabsTranscriber(
        key,
        process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2",
      )
    : new NoopTranscriber();
  return cached;
}

/** Only speech carries a transcript. An uploaded PDF does not. */
export function isTranscribableMime(mime: string): boolean {
  const base = mime.split(";")[0].trim().toLowerCase();
  return base.startsWith("audio/") || base.startsWith("video/");
}
