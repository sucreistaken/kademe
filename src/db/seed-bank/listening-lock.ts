import { createHash } from "node:crypto";
import { courseSeed } from "./course-seed";
import type { SeedCourseForm } from "./course-tests/types";
import type { SeedBankPart, SeedStimulus } from "./types";
import { canonicalJson } from "./seed-key";

/**
 * Fingerprint of a listening script as the audio was made from it: the body
 * and the voices. The bank sync never rewrites a listening script whose key it
 * already has (the audio would no longer match), so a changed script needs a
 * new key. listening-scripts.lock.json records the fingerprint of every key
 * that may already be in a database; listening-lock.test.ts fails when a
 * locked script changes under the same key.
 */
export function listeningScriptHash(s: Pick<SeedStimulus, "body" | "speakers">): string {
  return createHash("sha256")
    .update([s.body, canonicalJson(s.speakers ?? [])].join("\n"))
    .digest("hex")
    .slice(0, 16);
}

export type LockedScript = { key: string; hash: string };

/**
 * Every listening script the lock covers, under the key its database row has:
 * the bank's clips by their key, and the clips of the course test forms by
 * their form-prefixed seed key ("course-b1-1-a-..."), which is what --sync-seed
 * and `pnpm bank:tts` find them by. A script that moves to another form is a
 * new key, and so a new clip with new audio.
 */
export function listeningScripts(bank: SeedBankPart, courseForms: readonly SeedCourseForm[]): LockedScript[] {
  const clips = [
    ...bank.stimuli.filter((s) => s.section === "LISTENING").map((s) => ({ key: s.key, stimulus: s })),
    ...courseSeed(courseForms)
      .stimuli.filter((s) => s.stimulus.section === "LISTENING")
      .map((s) => ({ key: s.seedKey, stimulus: s.stimulus })),
  ];
  return clips.map(({ key, stimulus }) => ({ key, hash: listeningScriptHash(stimulus) }));
}

/** What the lock says about the given scripts: keys whose script changed since it was locked, and keys it does not know yet. */
export function lockProblems(lock: Record<string, string>, scripts: readonly LockedScript[]): { changed: string[]; unlocked: string[] } {
  return {
    changed: scripts.filter((s) => lock[s.key] && lock[s.key] !== s.hash).map((s) => s.key),
    unlocked: scripts.filter((s) => !lock[s.key]).map((s) => s.key),
  };
}
