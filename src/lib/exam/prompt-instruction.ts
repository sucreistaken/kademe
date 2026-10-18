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

/**
 * "Ergänzen Sie", "Lesen Sie", "Wählen Sie": a capitalised verb in the polite imperative.
 * Modal and auxiliary verbs are excluded ("Können Sie mir helfen?", "Haben Sie ...?"):
 * those open a question, not an instruction.
 */
const IMPERATIVE = /^(?!(?:Können|Könnten|Müssen|Wollen|Sollen|Dürfen|Möchten|Mögen|Haben|Hätten|Werden|Würden|Wären)\s)\p{Lu}\p{L}+(?:en|ln|rn) Sie\b/u;
/** An imperative first sentence with no gap marker in it, followed by the content. */
const FIRST_SENTENCE = /^((?!(?:Können|Könnten|Müssen|Wollen|Sollen|Dürfen|Möchten|Mögen|Haben|Hätten|Werden|Würden|Wären)\s)\p{Lu}\p{L}+(?:en|ln|rn) Sie[^{}\n]*?[.:])\s+(?=\p{Lu})([\s\S]+)$/u;

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

/** A wh-question: "Welche Anzeige passt?", "Wer vertritt welche Ansicht?". "Richtig, falsch oder nicht im Text?" is a scheme, not one. */
const WH_QUESTION = /^(?:Welch\p{L}*|Wer|Wen|Wem|Wessen|Wie|Was|Wo|Wohin|Woher|Wann|Warum|Wieso|Weshalb|Wozu|Womit|Worauf)\b[^]*\?$/u;

export type PromptBlock = { kind: "instruction" | "question"; text: string };

/**
 * A true/false or matching prompt is mostly instruction, but it often holds
 * the question too ("Lesen Sie die Situationen. Welche Anzeige passt? Jede
 * Anzeige passt höchstens einmal."). Splits it by sentence into runs, in the
 * original order, so the screen can set the question as a stem and keep the
 * ruled style for the instruction around it.
 */
export function splitPromptBlocks(prompt: string): PromptBlock[] {
  const sentences = prompt
    .trim()
    .split(/(?<=[.?!])\s+(?=[\p{Lu}„"“])/u)
    .map((x) => x.trim())
    .filter(Boolean);
  const blocks: PromptBlock[] = [];
  for (const sentence of sentences) {
    const kind = WH_QUESTION.test(sentence) ? "question" : "instruction";
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind) last.text = `${last.text} ${sentence}`;
    else blocks.push({ kind, text: sentence });
  }
  return blocks;
}

/**
 * A cloze or word-bank prompt is instruction, title and text as three
 * paragraphs. The title is a short line with no gap and no closing
 * punctuation; it heads the text instead of reading as its first line.
 * `passage` is what is left after the instruction (see `splitInstruction`).
 */
export function splitTitle(passage: string): { title: string | null; text: string } {
  const m = passage.match(/^([^\n]+)\n[ \t]*\n([\s\S]+)$/);
  if (!m) return { title: null, text: passage };
  const title = m[1].trim();
  if (title.length === 0 || title.length > 60 || title.includes("{{") || /[.!?:;,]$/.test(title)) return { title: null, text: passage };
  return { title, text: m[2].trim() };
}

/** Instruction, title and the start of the text of a cloze or word-bank prompt (or of its first text piece). */
export function splitTextLead(text: string): { instruction: string | null; title: string | null; rest: string } {
  const { instruction, content } = splitInstruction(text, "stem");
  const { title, text: rest } = splitTitle(content);
  return { instruction, title, rest };
}
