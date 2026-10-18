/**
 * Separates the instruction part of an item prompt ("Ergänzen Sie das fehlende
 * Wort.", "Lesen Sie die Situationen. Welche Anzeige passt?") from the content
 * the candidate works on, so the screen can set the two apart.
 *
 * Display only: the text itself is never changed, and nothing here reads the
 * key, the level or any other server-side field.
 */

export type SplitPrompt = {
  /** The instruction, or null when the prompt is only content (a question stem, a sentence with gaps). */
  instruction: string | null;
  /** What remains, "" when the whole prompt is an instruction. */
  content: string;
};

/** "Ergänzen Sie", "Lesen Sie", "Wählen Sie": a capitalised verb in the polite imperative. */
const IMPERATIVE = /^\p{Lu}\p{L}+(?:en|ln|rn) Sie\b/u;
/** An imperative first sentence with no gap marker in it, followed by the content. */
const FIRST_SENTENCE = /^(\p{Lu}\p{L}+(?:en|ln|rn) Sie[^{}\n]*?[.:])\s+(?=\p{Lu})([\s\S]+)$/u;

/**
 * `whole`: the prompt is all instruction (true/false/not given and matching
 * prompts say how to answer, not what to read). `stem`: a question or a
 * sentence; only an imperative lead-in, either a paragraph of its own or a
 * first sentence, counts as the instruction.
 */
export function splitInstruction(prompt: string, mode: "whole" | "stem"): SplitPrompt {
  const text = prompt.trim();
  if (mode === "whole") return { instruction: text || null, content: "" };
  const paragraphs = text.match(/^([\s\S]*?)\n[ \t]*\n([\s\S]+)$/);
  if (paragraphs && IMPERATIVE.test(paragraphs[1].trim()) && !paragraphs[1].includes("{{")) {
    return { instruction: paragraphs[1].trim(), content: paragraphs[2].trim() };
  }
  const sentence = text.match(FIRST_SENTENCE);
  if (sentence) return { instruction: sentence[1].trim(), content: sentence[2].trim() };
  return { instruction: null, content: text };
}
