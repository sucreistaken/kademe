import { compareLevels, isResultLevel } from "./cefr";
import type { ComputedResult } from "./result";
import { SECTIONS, type Cefr, type Section } from "./types";
import { skillShown, type SkillShown, type SkillVerdict, type VerificationBands } from "./verification";

/**
 * What a level verification shows for each skill, from the stored computed
 * result. One place for every screen (teacher result page, list, report,
 * student finish screen), so none of them prints a letter for a verification:
 * a skill is reached, not reached, or waits for a teacher.
 *
 * Results computed before 2026-11-24 carry no verdict: their skill level
 * (the final one when frozen) is compared with the claim instead.
 */

export type VerificationOutcome = "PASS" | "FAIL" | "INCONCLUSIVE";

export type VerificationSkillState = {
  section: Section;
  shown: SkillShown;
  verdict: SkillVerdict | null;
  /** Objective skills, teacher only: earned and served units per band. */
  bands: VerificationBands | null;
  /** Writing and speaking, teacher only: a take reached the answer time cap. */
  truncated: boolean;
};

export function verificationSkillStates(input: {
  claimed: Cefr;
  computed: Pick<ComputedResult, "skills"> | null | undefined;
  finalSkills?: Record<string, { level: string } | undefined> | null;
  outcome: VerificationOutcome | null | undefined;
}): VerificationSkillState[] {
  const outcome = input.outcome ?? "INCONCLUSIVE";
  const present = new Set<string>([...Object.keys(input.computed?.skills ?? {}), ...Object.keys(input.finalSkills ?? {})]);
  return SECTIONS.filter((s) => present.has(s)).map((section) => {
    const skill = input.computed?.skills[section];
    let verdict: SkillVerdict | null = skill?.verdict ?? null;
    if (!verdict) {
      // Stored before verdicts existed: the level against the claim.
      const level = input.finalSkills?.[section]?.level ?? skill?.level ?? null;
      if (isResultLevel(level)) verdict = compareLevels(level, input.claimed) >= 0 ? "PASS" : "FAIL";
    }
    return {
      section,
      shown: skillShown(verdict ?? undefined, outcome),
      verdict,
      bands: skill?.bands ?? null,
      truncated: !!skill?.tasks?.some((t) => t.truncated) && verdict === "TRUNCATED",
    };
  });
}

/**
 * The student's view of those states: reached or not reached, never a letter or
 * a point. A skill still waiting for a teacher is left out, except under a
 * confirmed claim, where the teacher has accepted it.
 */
export function studentVerificationSkills(states: VerificationSkillState[], outcome: VerificationOutcome | null | undefined): Array<{ section: Section; reached: boolean }> {
  return states.flatMap((s): Array<{ section: Section; reached: boolean }> => {
    if (s.shown === "REACHED") return [{ section: s.section, reached: true }];
    if (s.shown === "NOT_REACHED") return [{ section: s.section, reached: false }];
    return outcome === "PASS" ? [{ section: s.section, reached: true }] : [];
  });
}
