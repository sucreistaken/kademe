import type { Section } from "@/lib/exam/types";
import type { TutorialScript } from "../script-types";
import { GRAMMAR_SCRIPT } from "./grammar";
import { LISTENING_SCRIPT } from "./listening";
import { READING_SCRIPT } from "./reading";
import { SPEAKING_SCRIPT } from "./speaking";
import { WRITING_SCRIPT } from "./writing";

/** One "how it works" tutorial per section. */
export const TUTORIAL_SCRIPTS: Record<Section, TutorialScript> = {
  GRAMMAR: GRAMMAR_SCRIPT,
  READING: READING_SCRIPT,
  LISTENING: LISTENING_SCRIPT,
  WRITING: WRITING_SCRIPT,
  SPEAKING: SPEAKING_SCRIPT,
};
