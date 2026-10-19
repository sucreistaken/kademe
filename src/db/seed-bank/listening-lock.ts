import { createHash } from "node:crypto";
import type { SeedStimulus } from "./types";
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
