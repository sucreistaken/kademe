/**
 * What a narration file says, as a short hash: the caption text, the voice
 * and the model family. scripts/tutorial-tts.ts skips a step whose hash is
 * unchanged, and a test fails when a caption changed but its file did not.
 * Pure (cyrb53), so it runs in the script, the tests and anywhere else alike;
 * it detects changes and is not a security hash.
 */
export const NARRATION_MODEL_FAMILY = "gemini-tts";

export function narrationHash(text: string, voice: string, family: string = NARRATION_MODEL_FAMILY): string {
  const input = `${family}\u0000${voice}\u0000${text}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
