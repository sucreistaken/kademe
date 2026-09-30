import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStorage } from "@/lib/storage";

/**
 * Listening audio, made once on the server and stored.
 *
 * Every student hears the same file. The browser's own speech synthesis was
 * rejected on purpose: its voices differ by device, which would make the
 * listening section easier on one laptop than on another.
 *
 * Provider: Gemini TTS (multi-speaker, German). ElevenLabs was the first plan,
 * but the account is on a free tier of 10,000 characters a month and the
 * starter bank alone needs about 18,000.
 *
 * Audio is content addressed: the storage key is a hash of the script and the
 * voices, so an unchanged clip is never paid for twice (a reseed reuses it) and
 * an edited script can never keep playing its old recording.
 */

export const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-tts";
/**
 * Tried in order when a model answers 429. Each Gemini model has its own
 * quota, and the free tier's is small: the starter bank ran out of the first
 * model halfway through on 2026-09-30.
 */
export const TTS_MODELS = [
  TTS_MODEL,
  "gemini-3.8-flash-lite-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
].filter((m, i, all) => all.indexOf(m) === i);
/** Voice A and B of the seed format. Two clearly different prebuilt voices. */
export const VOICES = { A: "Kore", B: "Charon" } as const;

export type Speaker = { label: string; voice: "A" | "B" };

export type ScriptTurn = { speaker: string; text: string };

/** "Label: text" per line. Lines without a known label join the previous turn. */
export function parseScript(body: string, speakers: Speaker[]): ScriptTurn[] {
  const labels = new Set(speakers.map((s) => s.label));
  const turns: ScriptTurn[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    const label = colon > 0 ? line.slice(0, colon).trim() : "";
    if (labels.has(label)) turns.push({ speaker: label, text: line.slice(colon + 1).trim() });
    else if (turns.length) turns[turns.length - 1].text += ` ${line}`;
    else turns.push({ speaker: speakers[0]?.label ?? "Sprecher", text: line });
  }
  return turns.filter((t) => t.text.length > 0);
}

export function audioHash(body: string, speakers: Speaker[]): string {
  // The model is not part of the hash: a clip made by a fallback model is the
  // same clip for caching purposes.
  return createHash("sha256")
    .update(JSON.stringify(speakers.map((s) => [s.label, VOICES[s.voice]])))
    .update("\n")
    .update(body)
    .digest("hex");
}

export const audioKeyFor = (hash: string, ext: "mp3" | "wav") => `bank/audio/${hash.slice(0, 32)}.${ext}`;

export function ttsAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

/**
 * Builds the Gemini request. Pure, so the shape is testable. The 3.x models
 * take one part per turn tagged with its speaker; 2.5 takes a transcript with
 * "Speaker: text" lines.
 */
export function buildTtsRequest(turns: ScriptTurn[], speakers: Speaker[], model: string = TTS_MODEL) {
  const distinct = [...new Set(turns.map((t) => t.speaker))];
  const legacy = model.startsWith("gemini-2.5");
  if (distinct.length <= 1) {
    const voice = VOICES[speakers.find((s) => s.label === distinct[0])?.voice ?? "A"];
    return {
      contents: [{ parts: [{ text: turns.map((t) => t.text).join("\n") }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    };
  }
  return {
    contents: [
      {
        parts: legacy
          ? [{ text: turns.map((t) => `${t.speaker}: ${t.text}`).join("\n") }]
          : turns.map((t) => ({ text: t.text, speechMetadata: { speaker: t.speaker } })),
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: distinct.map((label) => ({
            speaker: label,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: VOICES[speakers.find((s) => s.label === label)?.voice ?? "A"] },
            },
          })),
        },
      },
    },
  };
}

/** Wraps raw 16-bit PCM in a WAV header, for providers that return bare PCM. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.byteLength, 40);
  return new Uint8Array(Buffer.concat([header, Buffer.from(pcm)]));
}

/** WAV byte length to milliseconds, reading the header. */
export function wavDurationMs(wav: Uint8Array): number | null {
  const b = Buffer.from(wav);
  if (b.toString("ascii", 0, 4) !== "RIFF") return null;
  const byteRate = b.readUInt32LE(28);
  const dataIndex = b.indexOf("data", 12, "ascii");
  if (byteRate <= 0 || dataIndex < 0) return null;
  const dataBytes = b.readUInt32LE(dataIndex + 4);
  return Math.round((dataBytes / byteRate) * 1000);
}

function toMp3(wav: Uint8Array): Uint8Array | null {
  const dir = tmpdir();
  const src = join(dir, `kademe-tts-${randomUUID()}.wav`);
  const dst = join(dir, `kademe-tts-${randomUUID()}.mp3`);
  try {
    writeFileSync(src, wav);
    const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-ac", "1", "-b:a", "64k", dst]);
    if (r.status !== 0) return null;
    return new Uint8Array(readFileSync(dst));
  } catch {
    return null;
  } finally {
    rmSync(src, { force: true });
    rmSync(dst, { force: true });
  }
}

export type SynthResult = { key: string; mime: string; durationMs: number | null; bytes: number; cached: boolean; model: string };

async function exists(key: string): Promise<boolean> {
  try {
    const s = await getStorage().openStream(key, { start: 0, end: 0 });
    await s.stream?.cancel?.();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the stored audio for a script, generating it only when no audio for
 * exactly this script and these voices exists yet.
 */
export async function synthesize(body: string, speakers: Speaker[]): Promise<SynthResult> {
  const hash = audioHash(body, speakers);
  for (const ext of ["mp3", "wav"] as const) {
    const key = audioKeyFor(hash, ext);
    if (await exists(key)) return { key, mime: ext === "mp3" ? "audio/mpeg" : "audio/wav", durationMs: null, bytes: 0, cached: true, model: TTS_MODEL };
  }
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("TTS_UNAVAILABLE: GOOGLE_AI_API_KEY is not set");
  const turns = parseScript(body, speakers);
  if (turns.length === 0) throw new Error("TTS: empty script");
  let lastError = "";
  for (const model of TTS_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTtsRequest(turns, speakers, model)),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`;
        if (res.status === 429 || res.status === 404) break; // next model
        if (res.status >= 500) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        break;
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
      };
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!part?.data) {
        lastError = `${model}: no audio in the answer`;
        break;
      }
      const raw = new Uint8Array(Buffer.from(part.data, "base64"));
      const wav = (part.mimeType ?? "").includes("wav") ? raw : pcmToWav(raw);
      const durationMs = wavDurationMs(wav);
      const mp3 = toMp3(wav);
      const [bytes, mime, ext] = mp3 ? [mp3, "audio/mpeg", "mp3" as const] : [wav, "audio/wav", "wav" as const];
      const key = audioKeyFor(hash, ext);
      await getStorage().putObject(key, mime, bytes);
      return { key, mime, durationMs, bytes: bytes.byteLength, cached: false, model };
    }
  }
  throw new Error(`TTS failed after retries: ${lastError}`);
}
