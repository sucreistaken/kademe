import { CEFR_LEVELS, type Cefr, type Section } from "../types";
import { COURSE_KEYS, type CourseKey, type CourseRules, type CourseTest, type CourseTestKind } from "./types";

/**
 * The eight course tests and their shape (spec 2026-10-28, "The eight tests"
 * and "Format"). Section order is telc's (Lesen, Sprachbausteine, Hören,
 * Schreiben, Sprechen), which keeps Halil Bey's written order. `units` is the
 * number of scored units a form must have in that section (one point each);
 * writing and speaking are counted in tasks.
 */
export type CourseSectionPlan = { section: Section; minutes: number; units: number };

export const INTERIM_RULES: CourseRules = {
  passPct: 60,
  secondHalfPct: null,
  firstHalfPct: null,
  speakingMinPct: null,
  writingContentZeroFails: true,
};

/** Halil Bey's B1 sheet as shares: 42/64 pass, 38/64 to L.2, 28/64 to L.1, speaking 12/20. */
export const FINAL_RULES: CourseRules = {
  passPct: 65,
  secondHalfPct: 59,
  firstHalfPct: 43.75,
  speakingMinPct: 60,
  writingContentZeroFails: true,
};

export const INTERIM_SECTIONS: CourseSectionPlan[] = [
  { section: "READING", minutes: 12, units: 6 },
  { section: "GRAMMAR", minutes: 12, units: 15 },
  { section: "LISTENING", minutes: 10, units: 6 },
  { section: "WRITING", minutes: 15, units: 1 },
  { section: "SPEAKING", minutes: 10, units: 2 },
];

export const FINAL_SECTIONS: CourseSectionPlan[] = [
  { section: "READING", minutes: 20, units: 10 },
  { section: "GRAMMAR", minutes: 20, units: 25 },
  { section: "LISTENING", minutes: 15, units: 10 },
  { section: "WRITING", minutes: 25, units: 1 },
  { section: "SPEAKING", minutes: 15, units: 3 },
];

const kindOf = (key: CourseKey): CourseTestKind => (key.includes(".") ? "INTERIM" : "FINAL");
const levelOf = (key: CourseKey): Cefr => key.slice(0, 2) as Cefr;

export const COURSE_TESTS: Record<CourseKey, CourseTest> = Object.fromEntries(
  COURSE_KEYS.map((key) => {
    const kind = kindOf(key);
    return [key, { key, kind, level: levelOf(key), germanName: `${kind === "INTERIM" ? "Zwischentest" : "Abschlusstest"} ${key}` }];
  }),
) as Record<CourseKey, CourseTest>;

export const courseSections = (key: CourseKey): CourseSectionPlan[] => (kindOf(key) === "INTERIM" ? INTERIM_SECTIONS : FINAL_SECTIONS);
export const defaultCourseRules = (key: CourseKey): CourseRules => ({ ...(kindOf(key) === "INTERIM" ? INTERIM_RULES : FINAL_RULES) });

/** "B1" + 1 -> "B1.1". The course labels a recommendation names. */
export const courseLabel = (level: Cefr, half: 1 | 2): string => `${level}.${half}`;

/** The level above, or null at C2. */
export function levelAbove(level: Cefr): Cefr | null {
  const i = CEFR_LEVELS.indexOf(level);
  return i >= 0 && i < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[i + 1] : null;
}

/** The level below, or null at A1. */
export function levelBelow(level: Cefr): Cefr | null {
  const i = CEFR_LEVELS.indexOf(level);
  return i > 0 ? CEFR_LEVELS[i - 1] : null;
}
