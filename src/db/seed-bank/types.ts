import type { Cefr, ItemContent, ItemKey, ItemRubric, ItemType, Section } from "@/lib/exam/types";

/**
 * The shape of the hand-written starter bank.
 *
 * Seed rows land in the database as APPROVED with origin SEED, and the bank
 * screen labels them "Kademe starter content, not reviewed by your school".
 */

export type SeedStimulus = {
  /** Unique within the whole bank, e.g. "r-b1-wohnung". Items point at it. */
  key: string;
  section: "READING" | "LISTENING";
  level: Cefr;
  title: string;
  /**
   * Reading: the passage. Listening: the script, one turn per line written as
   * `Label: text`, where every label appears in `speakers`.
   */
  body: string;
  topic: string;
  /** Listening only. Voice A and B are two different TTS voices. */
  speakers?: Array<{ label: string; voice: "A" | "B" }>;
};

export type SeedItem = {
  section: Section;
  level: Cefr;
  type: ItemType;
  /** e.g. "grammar.dativ", "reading.detail", "listening.gist". */
  skillTag: string;
  /** Position inside the level band; sets the Rasch difficulty. Default MID. */
  within?: "EASY" | "MID" | "HARD";
  stimulusKey?: string;
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  rubric?: ItemRubric;
  /** Teacher-facing note on why the key is right. German or Turkish. */
  explanation?: string;
};

export type SeedBankPart = { stimuli: SeedStimulus[]; items: SeedItem[] };
