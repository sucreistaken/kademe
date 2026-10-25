import { CRITERIA_BY_SECTION } from "./cefr-descriptors";
import {
  PRONUNCIATION_NOT_ASSESSABLE,
  countWords,
  hasGermanSentence,
  type GradingFlag,
  type GradingProposal,
  type RationaleLocale,
} from "./grading";
import { wordTokens } from "./structure-counts";
import type { ProductiveSection } from "./types";

/**
 * The parts of grading that are decided by counting, not by judging.
 *
 * A model asked "is this the task text copied back?" or "how many words is
 * this?" answers differently from one run to the next. These rules do not, so
 * the cases they cover get the same proposal every time and cost no model
 * call: nothing written, the task text handed back, nothing in German, a few
 * words with no sentence in them. They only ever produce A0 (Pre-A1) and
 * flags; a teacher still confirms or changes the level, as for any proposal.
 */

// ---------------------------------------------------------------------------
// Copy of the task
// ---------------------------------------------------------------------------

export { wordTokens };

/**
 * Share of the answer's words that stand inside a run of three words that the
 * task text holds too. Pasting the prompt, or reading it aloud, gives close to
 * 1; an answer that picks up a phrase or two of the task gives a few tenths.
 */
export function copiedShare(answer: string, taskText: string): number {
  const a = wordTokens(answer);
  const t = wordTokens(taskText);
  if (a.length === 0 || t.length < 3) return 0;
  const runs = new Set<string>();
  for (let i = 0; i + 2 < t.length; i++) runs.add(`${t[i]} ${t[i + 1]} ${t[i + 2]}`);
  const covered = new Array<boolean>(a.length).fill(false);
  for (let i = 0; i + 2 < a.length; i++) {
    if (runs.has(`${a[i]} ${a[i + 1]} ${a[i + 2]}`)) covered[i] = covered[i + 1] = covered[i + 2] = true;
  }
  return covered.filter(Boolean).length / a.length;
}

/** At least this much of the answer is the task text. */
export const COPIED_SHARE = 0.8;
/** An answer shorter than this is never called a copy (a three word match would be one). */
export const COPIED_MIN_WORDS = 6;

export function isCopiedFromTask(answer: string, taskText: string): boolean {
  return wordTokens(answer).length >= COPIED_MIN_WORDS && copiedShare(answer, taskText) >= COPIED_SHARE;
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

/**
 * Function words of the languages candidates write in instead of German, for
 * telling "this is not German" without a model. Words that are also German
 * (in, an, am, was, die, so, man, war, es, las, ...) are left out on purpose.
 */
const OTHER_LANGUAGE_WORDS: Record<"en" | "tr" | "es", Set<string>> = {
  en: new Set(
    ("the and is are to of you we my for with that this have not it can be but your our they he she i " +
      "would could please thank thanks dear regards hello sorry tomorrow today because very know think should " +
      "what when where which there their them then from at as or if do does did will")
      .split(" "),
  ),
  tr: new Set(
    ("ve bir bu için çok ben ile mi ne var yok gibi daha ama ancak olarak ki şu o biz siz onlar lütfen " +
      "teşekkür ederim merhaba evet hayır benim senin bugün yarın sonra önce değil kadar çünkü ya veya bana sana")
      .split(" "),
  ),
  es: new Set(
    ("el la los y que de en por con para mi yo no se lo muy pero como más gracias hola por favor buenos " +
      "días estoy tengo quiero puedo mañana una un del al soy")
      .split(" "),
  ),
};
const TURKISH_LETTERS = /[ışğİŞĞ]/u;
const ARABIC_LETTER = /\p{Script=Arabic}/u;

/**
 * The share of the answer's words that are function words of English, Turkish
 * or Spanish (the largest of the three), plus every word in Arabic script or
 * with a Turkish-only letter. German text, names, dates and form fields score
 * close to 0.
 */
export function otherLanguageShare(text: string): number {
  const words = wordTokens(text);
  if (words.length === 0) return 0;
  const marked = (w: string) => TURKISH_LETTERS.test(w) || ARABIC_LETTER.test(w);
  let best = 0;
  for (const set of Object.values(OTHER_LANGUAGE_WORDS)) {
    best = Math.max(best, words.filter((w) => set.has(w) || marked(w)).length);
  }
  return best / words.length;
}

/** At least this much of the answer is function words of another language: it is not German. */
export const NOT_GERMAN_SHARE = 0.25;
export const NOT_GERMAN_MIN_WORDS = 6;

export function looksNotGerman(text: string): boolean {
  return wordTokens(text).length >= NOT_GERMAN_MIN_WORDS && otherLanguageShare(text) >= NOT_GERMAN_SHARE;
}

// ---------------------------------------------------------------------------
// Length
// ---------------------------------------------------------------------------

/** Below this share of the minimum length a written answer is TOO_SHORT. */
export const TOO_SHORT_SHARE = 0.5;

export function isTooShort(text: string, minWords: number): boolean {
  return countWords(text) < TOO_SHORT_SHARE * minWords;
}

/**
 * TOO_SHORT is the system's flag, not the model's: a model asked whether an
 * answer is "far below the required length" says yes to a third of the answers.
 * The model's flag is dropped and the flag is set exactly when a written answer
 * is below half of the minimum. A spoken answer has no minimum length.
 */
export function withLengthFlag(proposal: GradingProposal, input: { section: ProductiveSection; text: string; minWords?: number }): GradingProposal {
  const flags: GradingFlag[] = proposal.flags.filter((f) => f !== "TOO_SHORT");
  if (input.section === "WRITING" && input.minWords !== undefined && isTooShort(input.text, input.minWords)) flags.push("TOO_SHORT");
  return { ...proposal, flags };
}

/** Up to this many words with no German sentence in them is "a few words". */
export const FEW_WORDS = 12;

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

/** Why a rule decided the answer without a model. */
export type RuleReason = "EMPTY" | "COPIED_TASK" | "NOT_GERMAN" | "FEW_WORDS";

export type RuleVerdict = { reason: RuleReason; flags: GradingFlag[] };

export type RuleInput = {
  section: ProductiveSection;
  /** The written answer or the transcript. */
  text: string;
  /** The text the candidate was shown: the task prompt. */
  taskText: string;
  /** Writing only: the task's minimum length. */
  minWords?: number;
  /** The task's expected register; a form ("Formular (Stichworte)") is answered in field values, not sentences. */
  register?: string;
};

/**
 * Whether a few words with no sentence in them is a failed answer. It is not for a
 * form task (the answer is "Costa", "28195 Bremen", "Karte") nor for a very short
 * writing task; it is for a message, an email or a spoken answer.
 */
function expectsSentences(input: RuleInput): boolean {
  if (input.section === "SPEAKING") return true;
  return (input.minWords ?? 0) >= 20 && !/formular/i.test(input.register ?? "");
}

/**
 * A0 (Pre-A1) by rule, or null when the answer needs judging. Checked in this
 * order, so an answer gets its most specific reason: nothing written, the task
 * handed back, not German, a few words without a sentence.
 */
export function ruleVerdict(input: RuleInput): RuleVerdict | null {
  const words = countWords(input.text);
  if (words === 0) return { reason: "EMPTY", flags: ["EMPTY"] };
  if (isCopiedFromTask(input.text, input.taskText)) return { reason: "COPIED_TASK", flags: ["COPIED_TASK"] };
  const german = hasGermanSentence(input.text);
  if (!german && looksNotGerman(input.text)) return { reason: "NOT_GERMAN", flags: ["NOT_GERMAN"] };
  if (!german && words <= FEW_WORDS && expectsSentences(input)) {
    return { reason: "FEW_WORDS", flags: words <= 3 ? ["EMPTY", "TOO_SHORT"] : ["TOO_SHORT"] };
  }
  return null;
}

const REASON_TEXT: Record<RuleReason, Record<RationaleLocale, { writing: string; speaking: string }>> = {
  EMPTY: {
    en: { writing: "No text was written.", speaking: "No speech could be transcribed." },
    tr: { writing: "Hiçbir metin yazılmadı.", speaking: "Konuşma yazıya dökülemedi." },
  },
  COPIED_TASK: {
    en: {
      writing: "The answer repeats the task text; it holds no German of the candidate's own.",
      speaking: "The answer reads the task text aloud; it holds no German of the candidate's own.",
    },
    tr: {
      writing: "Cevap görev metnini tekrar ediyor; adaya ait Almanca yok.",
      speaking: "Cevap görev metnini sesli okuyor; adaya ait Almanca yok.",
    },
  },
  NOT_GERMAN: {
    en: { writing: "The answer is not in German; there is no German to score.", speaking: "The answer is not in German; there is no German to score." },
    tr: { writing: "Cevap Almanca değil; puanlanabilir Almanca yok.", speaking: "Cevap Almanca değil; puanlanabilir Almanca yok." },
  },
  FEW_WORDS: {
    en: {
      writing: "The answer is only a few words or greetings; there is no sentence of the candidate's own to score.",
      speaking: "The answer is only a few words or sounds; there is no sentence of the candidate's own to score.",
    },
    tr: {
      writing: "Cevap yalnızca birkaç sözcük ya da selamlama; puanlanabilir kendi cümlesi yok.",
      speaking: "Cevap yalnızca birkaç sözcük ya da ses; puanlanabilir kendi cümlesi yok.",
    },
  },
};

const RULE_NOTE: Record<RationaleLocale, string> = {
  en: "A0 (Pre-A1) was set by a fixed rule, not by the model. The teacher decides.",
  tr: "A0 (Pre-A1) modelin değil sabit bir kuralın sonucudur. Karar öğretmenindir.",
};

/**
 * The proposal for an answer a rule decided: A0 in every criterion, the reason
 * in the teacher's language, no quotes. Pronunciation stays "cannot be judged".
 */
export function ruleProposal(section: ProductiveSection, verdict: RuleVerdict, locale: RationaleLocale): GradingProposal {
  const reason = REASON_TEXT[verdict.reason][locale][section === "WRITING" ? "writing" : "speaking"];
  return {
    criteria: CRITERIA_BY_SECTION[section].map((criterion) =>
      section === "SPEAKING" && criterion === "PRONUNCIATION"
        ? { criterion, level: "A0" as const, score: 0, assessable: false, rationale: PRONUNCIATION_NOT_ASSESSABLE, evidence: [] }
        : { criterion, level: "A0" as const, score: 0, assessable: true, rationale: reason, evidence: [] },
    ),
    overallLevel: "A0",
    summary: `${reason} ${RULE_NOTE[locale]}`,
    flags: [...verdict.flags],
  };
}
