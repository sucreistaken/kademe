/**
 * Position bounds (HIRING-UX 5.9), checked by the server actions and set as
 * maxLength on the inputs. Pure: the form, the actions and the writes share it.
 */
export const POSITION_NAME_MAX = 160;
export const POSITION_TEAM_MAX = 160;
export const POSITION_SHORT_MAX = 1000;
export const POSITION_JOB_AD_MAX = 20000;
export const POSITION_SKILL_MAX = 80;
export const POSITION_SKILLS_MAX = 30;
export const POSITION_LANGUAGE_MAX = 40;
export const POSITION_LANGUAGES_MAX = 10;
export const POSITION_PROFILE_MAX = 20;

/** A comma-separated input as a list: trimmed, no blanks, no repeats. */
export function splitList(value: string): string[] {
  return [...new Set(value.split(",").map((x) => x.trim()).filter(Boolean))];
}

/** Importance is a whole number from 0 to 100, typed as text in the form. */
export function validWeight(value: string): boolean {
  return /^\d{1,3}$/.test(value) && Number(value) <= 100;
}

/** The position form's state: text as typed, lists as comma text, numbers as text. */
export type PositionFormValue = {
  name: string;
  team: string;
  shortDescription: string;
  jobDescription: string;
  skills: string;
  languages: string;
  profile: Array<{ competencyId: string; weight: string; expectedLevel: string; archived: boolean }>;
};

/**
 * A stored position as form state: from the page's read, and from a save's
 * result, so the form shows exactly what the database holds after a save.
 */
export function positionFormValue(p: {
  name: string;
  team: string | null;
  shortDescription: string | null;
  jobDescription: string | null;
  skills: string[];
  languages: string[];
  profile: Array<{ competencyId: string; weight: number; expectedLevel: number | null; archived?: boolean }>;
}): PositionFormValue {
  return {
    name: p.name,
    team: p.team ?? "",
    shortDescription: p.shortDescription ?? "",
    jobDescription: p.jobDescription ?? "",
    skills: p.skills.join(", "),
    languages: p.languages.join(", "),
    profile: p.profile.map((row) => ({
      competencyId: row.competencyId,
      weight: String(row.weight),
      expectedLevel: row.expectedLevel === null ? "none" : String(row.expectedLevel),
      archived: row.archived ?? false,
    })),
  };
}
