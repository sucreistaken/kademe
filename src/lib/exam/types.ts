/**
 * The shared vocabulary of the exam engine.
 *
 * Everything here is plain data so the pure modules, the database schema, the
 * seed bank and the client can all agree on one shape. Anything the student
 * must never see (keys, rubrics, difficulty, listening transcripts) lives in
 * its own type and is only ever read on the server. The single function that
 * turns an item into what the browser receives is `toCandidateItem` in
 * `./safe.ts`.
 */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof CEFR_LEVELS)[number];

export const SECTIONS = ["GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"] as const;
export type Section = (typeof SECTIONS)[number];

/** Sections scored by the engine from a key, as opposed to judged by a person. */
export const OBJECTIVE_SECTIONS = ["GRAMMAR", "READING", "LISTENING"] as const;
export type ObjectiveSection = (typeof OBJECTIVE_SECTIONS)[number];
export const PRODUCTIVE_SECTIONS = ["WRITING", "SPEAKING"] as const;
export type ProductiveSection = (typeof PRODUCTIVE_SECTIONS)[number];

export const isObjectiveSection = (s: Section): s is ObjectiveSection =>
  (OBJECTIVE_SECTIONS as readonly string[]).includes(s);

export const EXAM_MODES = ["PLACEMENT", "LEVEL_VERIFICATION"] as const;
export type ExamMode = (typeof EXAM_MODES)[number];

export const ITEM_TYPES = [
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "TRUE_FALSE_NG",
  "GAP_FILL",
  "MATCHING",
  "SHORT_TEXT",
  "WRITING_PROMPT",
  "SPEAKING_PROMPT",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export type TfngValue = "R" | "F" | "NG";

/** What the student may see, besides the prompt. Shape follows the item type. */
export type ItemContent =
  | { kind: "CHOICE"; options: Array<{ id: string; text: string }> }
  | { kind: "TFNG"; statements: Array<{ id: string; text: string }> }
  /** The prompt carries `{{id}}` markers where each gap sits. `choices` turns a
   *  gap into a drop-down; without it the gap is typed. */
  | { kind: "GAP"; gaps: Array<{ id: string; choices?: string[] }> }
  | {
      kind: "MATCHING";
      left: Array<{ id: string; text: string }>;
      right: Array<{ id: string; text: string }>;
    }
  | { kind: "SHORT_TEXT"; maxChars: number }
  | { kind: "WRITING"; minWords: number; maxWords: number }
  | { kind: "SPEAKING"; thinkSeconds: number; answerSeconds: number; maxTakes: number };

/** Server only. */
export type ItemKey =
  | { kind: "CHOICE"; correct: string[] }
  | { kind: "TFNG"; answers: Record<string, TfngValue> }
  /**
   * Every accepted spelling per gap. Compared after `normalizeAnswer`.
   * `distractors`: hand-written wrong word parts for a C-test pool. They live in
   * the key, not the content, so a seed sync can ship them without new items.
   */
  | { kind: "GAP"; answers: Record<string, string[]>; distractors?: string[] }
  | { kind: "MATCHING"; pairs: Record<string, string> }
  | { kind: "SHORT_TEXT"; accepted: string[] }
  | { kind: "NONE" };

/** Server only. Guidance for the grader of a writing or speaking task. */
export type ItemRubric = {
  /** What a complete answer has to do, in the teacher's words. */
  contentPoints: string[];
  /** Expected register, e.g. "informell (du)" or "formell (Sie)". */
  register?: string;
};

/** What the student submitted. Only the keys for the item type are set. */
export type ItemAnswer = {
  choiceIds?: string[];
  gaps?: Record<string, string>;
  matches?: Record<string, string>;
  tfng?: Record<string, TfngValue>;
  text?: string;
  mediaAssetId?: string;
  /** Set when a speaking task was answered in writing because recording failed. */
  usedTextAlternative?: boolean;
};

/** The full item as the server knows it. Frozen into `item_responses.item_snapshot`. */
export type ItemSnapshot = {
  id: string;
  section: Section;
  level: Cefr;
  difficulty: number;
  type: ItemType;
  skillTag: string;
  stimulusId: string | null;
  orderInStimulus: number;
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  rubric: ItemRubric | null;
  points: number;
  stimulus: StimulusSnapshot | null;
};

export type StimulusSnapshot = {
  id: string;
  section: "READING" | "LISTENING";
  level: Cefr;
  title: string;
  /** Reading: the passage. Listening: the transcript, which never leaves the server. */
  body: string;
  audioKey: string | null;
  audioDurationMs: number | null;
};

/**
 * Per served item, fixed when it is first shown so a reload changes nothing.
 * Listening play counts live per stimulus on the section run, since the items
 * of one clip share its audio.
 */
export type Presentation = {
  /** Option / statement / right-column order after shuffling. */
  order?: string[];
  /**
   * Opaque ids the student sees instead of the bank's own option ids, so an
   * id like "a" cannot hint at the option's original position.
   */
  alias?: Record<string, string>;
  /**
   * Drop-down gaps: per gap id, the order of its choices as indexes into the
   * snapshot's `choices`. The answer is the choice text, so it needs no alias.
   */
  choiceOrder?: Record<string, number[]>;
  /** C-test and word bank: seeds the pool (see ctest-pool.ts), so a reload shows the same pool. */
  poolSeed?: number;
};

/**
 * Skill tag of a C-test item. C-tests never enter automatic item selection;
 * a GRAMMAR section serves them only when its `cTest` flag (one, as the first
 * item) or its `cTestLevels` (one per level) is set (see blueprint.ts).
 */
export const C_TEST_SKILL_TAG = "grammar.ctest";
/** Skill tag of a multiple-choice cloze text: every gap has exactly four choices (spec 2026-10-18). */
export const CLOZE_SKILL_TAG = "grammar.cloze";
/** Skill tag of a word-bank text: whole words from a shared pool, the key's distractors included (spec 2026-10-18). */
export const WORD_BANK_SKILL_TAG = "grammar.wordbank";

/**
 * C-test-specific behaviour only: the stem drawn with its gap, the word-part
 * pool, the teacher accepting a typed gap. Engine code shared by every text
 * kind uses `isTextGap`.
 */
export const isCTest = (item: { skillTag: string }): boolean => item.skillTag === C_TEST_SKILL_TAG;

/**
 * The kinds of text-gap item. All are GAP_FILL items told apart by skill tag.
 * None enters automatic item selection; a GRAMMAR section serves them only
 * through its text plan (blueprint.ts `textPlanOf`).
 */
export const TEXT_GAP_KINDS = ["CTEST", "CLOZE", "WORDBANK"] as const;
export type TextGapKind = (typeof TEXT_GAP_KINDS)[number];

export const TEXT_GAP_SKILL_TAGS: Record<TextGapKind, string> = {
  CTEST: C_TEST_SKILL_TAG,
  CLOZE: CLOZE_SKILL_TAG,
  WORDBANK: WORD_BANK_SKILL_TAG,
};

export function textGapKindOf(item: { skillTag: string }): TextGapKind | null {
  switch (item.skillTag) {
    case C_TEST_SKILL_TAG:
      return "CTEST";
    case CLOZE_SKILL_TAG:
      return "CLOZE";
    case WORD_BANK_SKILL_TAG:
      return "WORDBANK";
    default:
      return null;
  }
}

export const isTextGap = (item: { skillTag: string }): boolean => textGapKindOf(item) !== null;

/**
 * The words of a word bank's pool, unshuffled: the first accepted answer of
 * every gap in gap order, then the key's distractors. Empty entries are left
 * out. Two gaps with the same answer put that word in twice, so each pool word
 * fills at most one gap and both gaps can still be filled.
 */
export function wordBankWords(gapIds: string[], answers: Record<string, string[]>, distractors: string[] = []): string[] {
  return [...gapIds.map((g) => answers[g]?.[0] ?? ""), ...distractors].filter((w) => w.trim());
}
