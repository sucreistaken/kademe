import { speakingMetrics, type SpeakingMetrics, type TimedWord } from "../grading";
import type { SpeechProfile } from "./types";

/**
 * Plausible word timings for a transcript, so a spoken fixture reaches the
 * grader with the same kind of numbers a recording would give it. Made up from
 * the profile and the fixture id alone (no clock, no random source), so the
 * same fixture always has the same numbers.
 *
 * A profile is a speaking rate, a chance of a pause after a word, and the
 * length of such a pause. The figures follow what learners at that stage
 * sound like: a halting speaker is around 45 words a minute with several
 * pauses of two to four seconds, a fluent one around 140 with only the short
 * pauses at clause ends.
 */
type ProfileSpec = {
  /** Words per minute while a word is being said (no pauses). */
  wpm: number;
  /** Chance of a pause after a word. */
  pauseChance: number;
  /** Pause length range in ms. */
  pauseMs: [number, number];
  /** Chance that a pause is a long one (the upper end of `pauseMs`). */
  longShare: number;
};

const PROFILES: Record<SpeechProfile, ProfileSpec> = {
  halting: { wpm: 70, pauseChance: 0.22, pauseMs: [900, 4200], longShare: 0.45 },
  hesitant: { wpm: 105, pauseChance: 0.14, pauseMs: [500, 2800], longShare: 0.2 },
  steady: { wpm: 135, pauseChance: 0.09, pauseMs: [350, 1500], longShare: 0.04 },
  fluent: { wpm: 165, pauseChance: 0.07, pauseMs: [250, 900], longShare: 0 },
};

/** Small deterministic generator (mulberry32) seeded from a string. */
function seeded(key: string): () => number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Words as a recogniser reports them: no punctuation, original spelling. */
export function transcriptWords(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((token) => token.length > 0);
}

export function timedWords(transcript: string, profile: SpeechProfile, key: string): TimedWord[] {
  const spec = PROFILES[profile];
  const rand = seeded(`${profile}:${key}`);
  const perWordMs = 60_000 / spec.wpm;
  const words: TimedWord[] = [];
  let cursor = 600 + Math.round(rand() * 900);
  for (const text of transcriptWords(transcript)) {
    // Longer words take longer to say; the mean stays at the profile's rate.
    const length = Math.min(1.8, Math.max(0.55, (text.length + 2) / 7.5));
    const duration = Math.round(perWordMs * length * (0.85 + rand() * 0.3));
    words.push({ text, startMs: cursor, endMs: cursor + duration });
    cursor += duration + Math.round(40 + rand() * 80);
    if (rand() < spec.pauseChance) {
      const [low, high] = spec.pauseMs;
      cursor += rand() < spec.longShare ? Math.round(high * (0.7 + rand() * 0.3)) : Math.round(low + rand() * (high - low) * 0.4);
    }
  }
  return words;
}

/** The recording length: the last word plus a moment of silence before the stop button. */
export function recordingDurationMs(words: TimedWord[]): number {
  return words.length ? words[words.length - 1].endMs + 900 : 0;
}

export function metricsFor(transcript: string, profile: SpeechProfile, key: string): SpeakingMetrics {
  const words = timedWords(transcript, profile, key);
  return speakingMetrics(words, recordingDurationMs(words));
}
