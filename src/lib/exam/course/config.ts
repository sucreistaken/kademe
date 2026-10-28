import { PRESETS } from "@/lib/proctor/policy";
import type { BlueprintConfig, Distribution, PassRules, SectionConfig } from "../blueprint";
import { COURSE_TESTS, courseSections, defaultCourseRules, type CourseSectionPlan } from "./catalog";
import { SPEAKING_MAX, WRITING_MAX, type CourseKey } from "./types";

/**
 * The blueprint of each course test (spec 2026-10-28): the catalog's sections
 * in telc order with the catalog's minutes, every section a fixed form. The
 * items are not drawn by level: a course form serves its own items in their
 * own order (exam-flow.ts), so a section's distribution is empty and the
 * counts live in the catalog.
 *
 * Kept free of runtime imports from blueprint.ts (types only), because
 * blueprint.ts builds its default COURSE_TEST config from here.
 */

const NO_ITEMS: Distribution = { kind: "ABSOLUTE", perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 } };

/** Course tests decide by raw points and the course's own rules (`BlueprintConfig.course`); these switches are all off. */
const NEUTRAL_PASS_RULES: PassRules = { overallAtLeastClaimed: false, minSkillOffset: null, requiredSkills: [], minHoldProbability: null };

/** Speaking tasks of a test: introduce yourself and the card talk, and in the Abschlusstest a third task (spec "Format"). */
export const courseSpeakingTasks = (key: CourseKey): number => (COURSE_TESTS[key].kind === "INTERIM" ? 2 : 3);

/** One section with the editor's starting values (blueprint.ts: section), a fixed form. */
function courseSection(plan: CourseSectionPlan, key: CourseKey): SectionConfig {
  const speaking = plan.section === "SPEAKING";
  return {
    section: plan.section,
    enabled: true,
    durationMinutes: plan.minutes,
    adaptive: false,
    distribution: structuredClone(NO_ITEMS),
    minItems: 8,
    maxItems: 16,
    targetSe: 0.45,
    tasks: speaking ? courseSpeakingTasks(key) : 1,
    // The speaking items carry their own think and answer time; a task is recorded once, with no retake.
    thinkSeconds: null,
    answerSeconds: null,
    maxTakes: speaking ? 1 : null,
  };
}

/** The scored points a form is worth: one per objective unit, the writing rubric and the speaking rubric. */
export function courseMaxPoints(key: CourseKey): number {
  return courseSections(key).reduce((sum, p) => sum + (p.section === "WRITING" ? WRITING_MAX : p.section === "SPEAKING" ? SPEAKING_MAX : p.units), 0);
}

/** The blueprint of one course test; `course.form` stays null until an invitation picks a form. */
export function courseBlueprint(key: CourseKey): BlueprintConfig {
  return {
    version: 1,
    sections: courseSections(key).map((p) => courseSection(p, key)),
    difficultyOffset: 0,
    resultVisibility: "FULL",
    autoRelease: false,
    passRules: { ...NEUTRAL_PASS_RULES, requiredSkills: [] },
    // Watched like the level check: a course test is graded and certified by the school.
    proctoring: structuredClone(PRESETS.STRICT),
    listening: { maxPlays: 2 },
    course: { key, form: null, rules: defaultCourseRules(key) },
  };
}
