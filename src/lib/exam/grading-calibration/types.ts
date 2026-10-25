import type { GradingFlag } from "../grading";
import type { Cefr, ProductiveSection, ResultLevel } from "../types";

/**
 * Calibration fixtures for the AI grader.
 *
 * A fixture is a learner answer written for a real task of the starter bank,
 * with the level a trained Goethe / telc rater would give it. The learner
 * texts are original (nobody's exam paper) and written so that the level is
 * not in doubt: the error patterns are the usual ones of that level. The
 * target is judged against `cefr-descriptors.ts` and the four criteria of the
 * exams (Aufgabenerfuellung, Kohaerenz, Wortschatz, Strukturen), and it is the
 * level for THIS task: an answer never counts for more than one level above
 * the task's own level (the cap, see `capByTaskLevel`), so an excellent answer
 * to an A1 task has target A2.
 *
 * The fixtures are the fixed standard the grader is measured against. They
 * are not edited to fit the grader's output.
 */

/** Why a fixture is in the set. */
export type FixtureKind =
  /** An honest answer at its level. */
  | "LEVEL"
  /** No German to score: blank, another language, a few words, the task copied. */
  | "A0"
  /** A known way graders go wrong. */
  | "TRAP";

export type TrapKind =
  | "OFF_TOPIC_FLUENT"
  | "MEMORISED_TEMPLATE"
  | "LONG_ERRORS"
  | "SHORT_EXCELLENT"
  | "TASK_COPIED"
  | "OVER_CAP";

/** How a spoken answer sounded; turned into word timings by `timedWords`. */
export type SpeechProfile = "halting" | "hesitant" | "steady" | "fluent";

export type FlagExpectation = {
  /** Flags the answer must get. */
  must: GradingFlag[];
  /** Flags that are acceptable but not required (a judgement call either way). */
  may?: GradingFlag[];
};

export type CalibrationFixture = {
  /** Unique, stable: "<task id>/<variant>". */
  id: string;
  /** Key of `CALIBRATION_TASKS`. */
  task: string;
  kind: FixtureKind;
  trap?: TrapKind;
  /** The level for this task (after the cap) a trained rater gives. */
  target: ResultLevel;
  flags: FlagExpectation;
  /** The written answer, or the transcript of the spoken one. */
  text: string;
  /** Speaking only. */
  speech?: SpeechProfile;
  /** One line: why this is the target. */
  why: string;
};

/** A real task of the starter bank, found again by its prompt. */
export type CalibrationTask = {
  id: string;
  section: ProductiveSection;
  level: Cefr;
  /** `skillTag` of the seed item. */
  skillTag: string;
  /** The start of the seed item's prompt; with level and skill tag it names exactly one item. */
  promptStart: string;
};

export type ResolvedTask = {
  id: string;
  section: ProductiveSection;
  taskLevel: Cefr;
  prompt: string;
  contentPoints: string[];
  register?: string;
  /** Writing only. */
  minWords?: number;
  maxWords?: number;
  /** Speaking only: the recording length allowed. */
  answerSeconds?: number;
};
