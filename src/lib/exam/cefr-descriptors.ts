import type { Cefr, ProductiveSection } from "./types";

/**
 * Condensed level descriptors for the productive sections.
 *
 * These are our own one line summaries written for the grader prompt, not the
 * published CEFR scales. They are deliberately short: a model reading six
 * levels for six criteria needs a contrast between neighbouring levels, not a
 * page of prose. English, because the grader prompt is English whatever
 * language the rationale is written in.
 */

export const CRITERIA = [
  "TASK_ACHIEVEMENT",
  "COHERENCE",
  "RANGE",
  "ACCURACY",
  "FLUENCY",
  "PRONUNCIATION",
] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERIA_BY_SECTION: Record<ProductiveSection, readonly Criterion[]> = {
  WRITING: ["TASK_ACHIEVEMENT", "COHERENCE", "RANGE", "ACCURACY"],
  SPEAKING: ["TASK_ACHIEVEMENT", "COHERENCE", "RANGE", "ACCURACY", "FLUENCY", "PRONUNCIATION"],
};

/** What each criterion looks at, one line, for the prompt. */
export const CRITERION_FOCUS: Record<Criterion, string> = {
  TASK_ACHIEVEMENT:
    "Does the answer do what the task asks: covers the content points, fits the purpose, register and length.",
  COHERENCE:
    "How ideas are ordered and linked: sentence connection, paragraphing or turn structure, reference words.",
  RANGE: "Breadth and precision of vocabulary and of grammatical structures actually used.",
  ACCURACY: "Control of grammar, word forms, word order and spelling (or word choice when spoken).",
  FLUENCY: "Flow and length of stretches of speech, hesitation, reformulation, pace.",
  PRONUNCIATION: "Sounds, word stress and intonation. Needs audio.",
};

export const DESCRIPTORS: Record<Criterion, Record<Cefr, string>> = {
  TASK_ACHIEVEMENT: {
    A1: "Gives a few basic facts about self or the immediate situation; most content points only touched or missing.",
    A2: "Handles a simple routine message; covers the main points briefly, with little detail.",
    B1: "Covers all content points in a straightforward way with some supporting detail; register mostly right.",
    B2: "Covers every point with relevant detail and some argument or explanation; register consistent.",
    C1: "Develops the points fully and selectively, adapts tone to reader and purpose throughout.",
    C2: "Fulfils the task with complete ease; content, emphasis and register are precisely judged.",
  },
  COHERENCE: {
    A1: "Isolated words and short phrases, linked at most with und or dann.",
    A2: "Short simple sentences joined with basic connectors such as und, aber, weil.",
    B1: "A linear sequence of points that is easy to follow; limited but working set of linking words.",
    B2: "Clear structure with a range of connectors; relations between ideas are signalled, some jumpiness.",
    C1: "Well organised, smooth text; varied cohesive devices used naturally and appropriately.",
    C2: "Seamless, logically structured text that guides the reader without effort; cohesion goes unnoticed.",
  },
  RANGE: {
    A1: "A very small stock of memorised words and fixed phrases for concrete personal needs.",
    A2: "Basic everyday vocabulary and simple sentence patterns; frequent gaps filled by repetition.",
    B1: "Enough vocabulary for familiar topics, some circumlocution; mostly main clauses plus common subordinate clauses.",
    B2: "Good range for general and familiar abstract topics; varies formulation, uses complex sentences with some ease.",
    C1: "Broad lexical repertoire including idiom; wide choice of structures lets the writer say things precisely.",
    C2: "Very broad, precise and idiomatic repertoire; fine shades of meaning are expressed without restriction.",
  },
  ACCURACY: {
    A1: "Only a few memorised forms are correct; errors are pervasive but some meaning gets through.",
    A2: "Simple structures often right, basic errors (verb position, endings, articles) are systematic.",
    B1: "Reasonably accurate in familiar patterns; errors occur, especially in complex forms, but meaning is clear.",
    B2: "Good control; errors are occasional, rarely impede understanding and are often self corrected.",
    C1: "Consistently high accuracy; errors are rare, minor and hard to spot.",
    C2: "Near complete grammatical control, even of complex language, with attention elsewhere.",
  },
  FLUENCY: {
    A1: "Very short isolated utterances with long pauses to search for words.",
    A2: "Short phrases with evident pauses, false starts and reformulation.",
    B1: "Keeps going comprehensibly; pausing for planning and repair is noticeable in longer stretches.",
    B2: "Fairly even tempo over longer stretches; few noticeably long pauses.",
    C1: "Flows almost effortlessly; only a conceptually hard topic slows the pace.",
    C2: "Long, natural, effortless flow; pauses sound like those of a proficient speaker choosing content.",
  },
  PRONUNCIATION: {
    A1: "Pronunciation of a small repertoire can be understood with effort by a listener used to learners.",
    A2: "Generally clear enough despite a noticeable accent; listeners sometimes ask for repetition.",
    B1: "Clearly intelligible; foreign accent and occasional mispronunciation do not block understanding.",
    B2: "Clear, natural pronunciation and intonation in most stretches.",
    C1: "Can vary intonation and stress to express finer meaning; accent does not distract.",
    C2: "Full control of sounds, stress and intonation for nuance and emphasis.",
  },
};
