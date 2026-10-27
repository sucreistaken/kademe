import { z } from "zod";
import type { Cefr, Section } from "../types";

/**
 * Course tests (spec docs/superpowers/specs/2026-10-28-course-tests-design.md):
 * a syllabus-bound test at the end of a sub-course, scored by raw points and
 * fixed cut scores, not by the Rasch level estimate. Pure types and
 * constants, safe for client code.
 */

/** INTERIM tests close the first half of a level (Zwischentest), FINAL tests the whole level (Abschlusstest). */
export const COURSE_KEYS = ["A1.1", "A1", "A2.1", "A2", "B1.1", "B1", "B2.1", "B2"] as const;
export type CourseKey = (typeof COURSE_KEYS)[number];
export const isCourseKey = (v: unknown): v is CourseKey => typeof v === "string" && (COURSE_KEYS as readonly string[]).includes(v);

export type CourseTestKind = "INTERIM" | "FINAL";

/** Two parallel forms per test. */
export const COURSE_FORMS = ["A", "B"] as const;
export type CourseForm = (typeof COURSE_FORMS)[number];

/** The value of `items.course_form` and `stimuli.course_form`, e.g. "B1.1:A". */
export type CourseFormKey = `${CourseKey}:${CourseForm}`;
export const courseFormKey = (key: CourseKey, form: CourseForm): CourseFormKey => `${key}:${form}`;
export function parseCourseFormKey(v: string): { key: CourseKey; form: CourseForm } | null {
  const [key, form, ...rest] = v.split(":");
  if (rest.length || !isCourseKey(key) || (form !== "A" && form !== "B")) return null;
  return { key, form };
}

/**
 * Cut scores as percentages of the form's maximum; a rule holds when
 * `points >= ceil(pct * max / 100)` (Halil Bey's sheet: 65% of 64 is 42).
 */
export const courseRulesSchema = z.object({
  passPct: z.number().min(0).max(100),
  /** FINAL only: not passed but at least this share goes back to L.2 (Halil Bey: 38/64). */
  secondHalfPct: z.number().min(0).max(100).nullable(),
  /** FINAL only: not passed but at least this share goes back to L.1 (Halil Bey: 28/64); below it, the level below. */
  firstHalfPct: z.number().min(0).max(100).nullable(),
  /** Speaking must reach this share of its own maximum to pass (Halil Bey: 12/20). Null: no speaking minimum. */
  speakingMinPct: z.number().min(0).max(100).nullable(),
  /** Writing INHALT 0 fails the test whatever the total (Halil Bey's sheet). */
  writingContentZeroFails: z.boolean(),
});
export type CourseRules = z.infer<typeof courseRulesSchema>;

/** `BlueprintConfig.course`: which test, which form (set per invitation; null on the published exam), the rules. */
export const courseConfigSchema = z.object({
  key: z.enum(COURSE_KEYS),
  form: z.enum(COURSE_FORMS).nullable(),
  rules: courseRulesSchema,
});
export type CourseConfig = z.infer<typeof courseConfigSchema>;

/** Rubric criteria. Writing 3 x 0-3 (max 9), speaking 5 x 0-4 per task (Halil Bey's sheets). */
export const WRITING_CRITERIA = ["INHALT", "WORTSCHATZ", "GRAMMATIK"] as const;
export const SPEAKING_CRITERIA = ["KOMMUNIKATION", "WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "KOHAERENZ"] as const;
export type WritingCriterion = (typeof WRITING_CRITERIA)[number];
export type SpeakingCriterion = (typeof SPEAKING_CRITERIA)[number];
export type CourseCriterion = WritingCriterion | SpeakingCriterion;
export const CRITERION_MAX: Record<"WRITING" | "SPEAKING", number> = { WRITING: 3, SPEAKING: 4 };
export const WRITING_MAX = WRITING_CRITERIA.length * CRITERION_MAX.WRITING; // 9
export const SPEAKING_MAX = SPEAKING_CRITERIA.length * CRITERION_MAX.SPEAKING; // 20

/** German criterion names for the panel and the German report. */
export const CRITERION_LABEL_DE: Record<CourseCriterion, string> = {
  INHALT: "Inhalt / Aufgabenerfüllung",
  WORTSCHATZ: "Wortschatz",
  GRAMMATIK: "Grammatik",
  KOMMUNIKATION: "Kommunikation und Aufgabenerfüllung",
  AUSSPRACHE: "Aussprache und Verständlichkeit",
  KOHAERENZ: "Kohärenz und Flüssigkeit",
};

/** Halil Bey's "Häufigste Fehler" boxes for writing; the AI ticks them, the teacher corrects. */
export const COMMON_WRITING_ERRORS = {
  POINTS_MISSING: "Nicht alle Leitpunkte bearbeitet",
  DETAIL_MISSING: "Eine geforderte Angabe fehlt oder ist unklar",
  SALUTATION_MISSING: "Anrede fehlt",
  CLOSING_MISSING: "Grußformel fehlt oder passt nicht",
  WRONG_REGISTER: "Falsche Anredeform (du statt Sie oder umgekehrt)",
  TEXT_TYPE: "Textsorte nicht getroffen",
  TOO_SHORT: "Text zu kurz",
  COPIED: "Sätze aus der Aufgabe abgeschrieben",
  VERB_POSITION: "Verbstellung im Nebensatz falsch",
  VERB_BRACKET: "Verbklammer nicht geschlossen",
  INFINITIVE_ZU: "Infinitiv mit „zu“ falsch oder fehlt",
  KONJUNKTIV_POLITE: "Höfliche Formen (Konjunktiv II) fehlen",
  CASE: "Kasusfehler (Artikel, Nomen, Pronomen)",
  PREPOSITION: "Falsche Präposition oder Präpositionalkasus",
  VOCAB_TOO_SIMPLE: "Wortschatz zu einfach für das Niveau",
  SPELLING: "Rechtschreibung / Groß- und Kleinschreibung",
} as const;
export type CommonWritingError = keyof typeof COMMON_WRITING_ERRORS;

/**
 * What the AI proposes for one writing or speaking answer of a course test
 * (`response_gradings.ai_proposal` for purpose COURSE_RUBRIC). German text.
 */
export type CourseRubricProposal = {
  kind: "COURSE_RUBRIC";
  section: "WRITING" | "SPEAKING";
  /** Points per criterion; null when the criterion cannot be judged (AUSSPRACHE from a transcript). */
  criteria: Array<{ id: CourseCriterion; points: number | null; max: number; rationale: string }>;
  /** Writing only. */
  wordCount?: number;
  /** Writing only: one row per Leitpunkt of the task. */
  leitpunkte?: Array<{ point: string; done: "YES" | "PARTLY" | "NO"; evidence: string }>;
  /** Writing only. */
  errors?: Array<{ original: string; correction: string; type: "GRAMMATIK" | "WORTSCHATZ" | "ORTHOGRAFIE" | "SATZBAU" | "REGISTER" }>;
  commonErrors?: CommonWritingError[];
  /** One sentence for the teacher: which structure to practise first. */
  advice: string;
  /** A rule, not the model, made this proposal (empty or missing answer). */
  byRule?: "EMPTY";
};

/** The teacher's (or the confirmed) points: `response_gradings.final_criteria` for a course test. */
export type CoursePoints = Partial<Record<CourseCriterion, number>>;

export type CourseOutcome = "PASS" | "FAIL";
export type CourseReason = "BELOW_PASS" | "SPEAKING_BELOW_MIN" | "WRITING_CONTENT_ZERO";

/** `ComputedResult.course`: what the engine says about a course test right now. */
export type CourseResult = {
  key: CourseKey;
  form: CourseForm | null;
  sections: Partial<Record<Section, { points: number | null; max: number; pending: boolean }>>;
  /** Null while any section is pending. */
  total: number | null;
  max: number;
  pct: number | null;
  outcome: CourseOutcome | null;
  reasons: CourseReason[];
  /** The course to continue in, e.g. "B1.2", "B2.1", "A2.2". Null while pending. */
  recommendation: string | null;
  /** Not passed only because of speaking or writing: practise that skill. */
  focus: "SPEAKING" | "WRITING" | null;
};

export type CourseTest = {
  key: CourseKey;
  kind: CourseTestKind;
  level: Cefr;
  /** "Zwischentest A1.1" / "Abschlusstest A1": the German name on candidate screens and reports. */
  germanName: string;
};
