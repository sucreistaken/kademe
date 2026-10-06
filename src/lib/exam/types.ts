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
  /** Every accepted spelling per gap. Compared after `normalizeAnswer`. */
  | { kind: "GAP"; answers: Record<string, string[]> }
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
};

/**
 * Skill tag of a C-test item. C-tests never enter automatic item selection;
 * a GRAMMAR section serves one only when its `cTest` flag is on, as the first
 * item (see blueprint.ts).
 */
export const C_TEST_SKILL_TAG = "grammar.ctest";

export const isCTest = (item: { skillTag: string }): boolean => item.skillTag === C_TEST_SKILL_TAG;
