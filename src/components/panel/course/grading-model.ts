import {
  COMMON_WRITING_ERRORS,
  CRITERION_MAX,
  SPEAKING_CRITERIA,
  WRITING_CRITERIA,
  type CommonWritingError,
  type CourseCriterion,
  type CoursePoints,
  type CourseRubricProposal,
} from "@/lib/exam/course/types";

/**
 * Grading a writing or speaking answer of a course test (spec 2026-10-28): the
 * rubric points a teacher confirms or sets, and the rules the course actions
 * and the grading screen share. Pure, so the server checks exactly what the
 * screen offers. Points are whole numbers (Halil Bey: "keine halben Punkte"):
 * 0-3 per writing criterion, 0-4 per speaking criterion.
 */

export type GradedSection = "WRITING" | "SPEAKING";

export const isGradedSection = (s: unknown): s is GradedSection => s === "WRITING" || s === "SPEAKING";

export const criteriaOf = (section: GradedSection): readonly CourseCriterion[] => (section === "WRITING" ? WRITING_CRITERIA : SPEAKING_CRITERIA);

/** The most one criterion of this section can earn. */
export const criterionMax = (section: GradedSection): number => CRITERION_MAX[section];

/** The most the whole rubric can earn: 9 for writing, 20 for one speaking task. */
export const rubricMax = (section: GradedSection): number => criteriaOf(section).length * criterionMax(section);

/** The form field that carries one criterion's points. */
export const pointsField = (criterion: CourseCriterion): string => `points.${criterion}`;
const POINTS_PREFIX = "points.";

/** The form field that says the common-error boxes were part of the form (an unticked form is not "none ticked" otherwise). */
export const COMMON_ERRORS_SENT = "commonErrorsSent";

/** The common-error box fields, in the order the sheet prints them. */
export const COMMON_ERROR_IDS = Object.keys(COMMON_WRITING_ERRORS) as CommonWritingError[];
export const isCommonError = (v: unknown): v is CommonWritingError => typeof v === "string" && Object.hasOwn(COMMON_WRITING_ERRORS, v);

export type PointsFault = "UNKNOWN_CRITERION" | "MISSING" | "RANGE";

/** A whole number from 0 to `max` as typed in a form field; anything else (empty, "2.5", "-1", "1e1", " 3") is null. */
export function wholePoints(raw: FormDataEntryValue | null | undefined, max: number): number | null {
  if (typeof raw !== "string" || !/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= max ? n : null;
}

/**
 * Every criterion of the section from a submitted form: a field for each, whole
 * numbers within the criterion's maximum, and no field for a criterion the
 * section does not have (a writing form carrying AUSSPRACHE is refused).
 */
export function readCoursePoints(section: GradedSection, form: FormData): { ok: true; points: CoursePoints } | { ok: false; code: PointsFault } {
  const wanted = criteriaOf(section);
  for (const key of form.keys()) {
    if (key.startsWith(POINTS_PREFIX) && !wanted.includes(key.slice(POINTS_PREFIX.length) as CourseCriterion)) return { ok: false, code: "UNKNOWN_CRITERION" };
  }
  const points: CoursePoints = {};
  for (const criterion of wanted) {
    const raw = form.get(pointsField(criterion));
    if (raw === null || raw === "") return { ok: false, code: "MISSING" };
    const n = wholePoints(raw, criterionMax(section));
    if (n === null) return { ok: false, code: "RANGE" };
    points[criterion] = n;
  }
  return { ok: true, points };
}

/** The ticked "Häufigste Fehler" boxes of a form: known ids only, once each, in the sheet's order; an unknown id refuses the form. */
export function readCommonErrors(form: FormData): { ok: true; errors: CommonWritingError[] } | { ok: false } {
  const asked = form.getAll("commonErrors");
  if (!asked.every(isCommonError)) return { ok: false };
  const set = new Set<string>(asked);
  return { ok: true, errors: COMMON_ERROR_IDS.filter((id) => set.has(id)) };
}

/** What the AI proposed per criterion, and the criteria it left open (not assessable, missing, or out of range). */
export function proposalPoints(proposal: CourseRubricProposal | null | undefined, section: GradedSection): { points: CoursePoints; open: CourseCriterion[] } {
  const points: CoursePoints = {};
  const open: CourseCriterion[] = [];
  for (const criterion of criteriaOf(section)) {
    const proposed = proposal?.criteria.find((c) => c.id === criterion)?.points;
    if (typeof proposed === "number" && Number.isInteger(proposed) && proposed >= 0 && proposed <= criterionMax(section)) points[criterion] = proposed;
    else open.push(criterion);
  }
  return { points, open };
}

/**
 * Confirming the proposal as it stands. A criterion the AI judged keeps its
 * points (a form that sends another value is a change, which needs a reason
 * and its own action); a criterion it left open, typically AUSSPRACHE from a
 * transcript, takes the teacher's value, which is required.
 */
export function confirmCoursePoints(
  section: GradedSection,
  proposal: CourseRubricProposal | null | undefined,
  form: FormData,
): { ok: true; points: CoursePoints; filled: CourseCriterion[] } | { ok: false; code: "CHANGED" | "OPEN" } {
  const { points: proposed, open } = proposalPoints(proposal, section);
  const points: CoursePoints = { ...proposed };
  for (const criterion of criteriaOf(section)) {
    const raw = form.get(pointsField(criterion));
    if (!open.includes(criterion)) {
      if (raw !== null && raw !== "" && wholePoints(raw, criterionMax(section)) !== proposed[criterion]) return { ok: false, code: "CHANGED" };
      continue;
    }
    const n = wholePoints(raw, criterionMax(section));
    if (n === null) return { ok: false, code: "OPEN" };
    points[criterion] = n;
  }
  return { ok: true, points, filled: open };
}

export function pointsTotal(points: CoursePoints | null | undefined): number {
  return Object.values(points ?? {}).reduce<number>((sum, n) => sum + (typeof n === "number" ? n : 0), 0);
}

/** True when two point sets agree on every criterion of the section. */
export function samePoints(section: GradedSection, a: CoursePoints | null | undefined, b: CoursePoints | null | undefined): boolean {
  return criteriaOf(section).every((c) => (a?.[c] ?? null) === (b?.[c] ?? null));
}

/** The same ids as a set, regardless of order. */
export function sameErrors(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const x = new Set(a ?? []);
  const y = new Set(b ?? []);
  return x.size === y.size && [...x].every((id) => y.has(id));
}

/** The minimum length of a reason, as for every other change of a teacher's decision (overrideGrading). */
export const MIN_REASON_LENGTH = 3;
export const reasonOk = (reason: string): boolean => reason.trim().length >= MIN_REASON_LENGTH;

export type CourseGradingStatus = "PENDING" | "AI_PROPOSED" | "AI_FAILED" | "CONFIRMED" | "OVERRIDDEN";

/** A grading counts as decided once a teacher confirmed or changed it (WP2's recompute reads `course_points` from then on). */
export const isDecidedStatus = (status: CourseGradingStatus): boolean => status === "CONFIRMED" || status === "OVERRIDDEN";

export type EditorState = {
  section: GradedSection;
  status: CourseGradingStatus;
  proposal: CourseRubricProposal | null;
  /** `course_points` once decided. */
  decided: { points: CoursePoints; commonErrors?: CommonWritingError[] } | null;
  /** The pickers as they stand now; a criterion nobody picked is absent. */
  picks: CoursePoints;
  ticks: readonly CommonWritingError[];
  reason: string;
};

/** What the grading form's one button does for the state of its pickers. */
export type EditorAction =
  | { kind: "confirm" }
  | { kind: "change" }
  | { kind: "errors" }
  | { kind: "none"; why: "INCOMPLETE" | "REASON" | "NO_CHANGE" };

/** The common errors the boxes start from: the teacher's when decided, else the AI's (writing only). */
export function startingErrors(state: Pick<EditorState, "section" | "decided" | "proposal">): CommonWritingError[] {
  if (state.section !== "WRITING") return [];
  return [...(state.decided?.commonErrors ?? state.proposal?.commonErrors ?? [])];
}

/** The points the pickers start from: the teacher's when decided, else the AI's (a criterion it left open starts empty). */
export function startingPoints(state: Pick<EditorState, "section" | "decided" | "proposal">): CoursePoints {
  return state.decided ? { ...state.decided.points } : proposalPoints(state.proposal, state.section).points;
}

/**
 * Which action the one button takes, so the screen cannot offer a button the
 * server would refuse. Confirming needs no reason: the pickers still agree with
 * the AI on everything it judged (a criterion it left open may be filled in).
 * Any other change of points needs a reason of at least three characters.
 * Ticking a box on a decided grading alone is its own action.
 */
export function editorAction(state: EditorState): EditorAction {
  const criteria = criteriaOf(state.section);
  if (!criteria.every((c) => typeof state.picks[c] === "number")) return { kind: "none", why: "INCOMPLETE" };
  const errorsChanged = state.section === "WRITING" && !sameErrors(state.ticks, startingErrors(state));
  if (state.decided) {
    if (!samePoints(state.section, state.picks, state.decided.points)) return reasonOk(state.reason) ? { kind: "change" } : { kind: "none", why: "REASON" };
    return errorsChanged ? { kind: "errors" } : { kind: "none", why: "NO_CHANGE" };
  }
  const { points: proposed } = proposalPoints(state.proposal, state.section);
  const usable = state.status === "AI_PROPOSED" && state.proposal !== null;
  const changed = criteria.some((c) => c in proposed && proposed[c] !== state.picks[c]);
  if (usable && !changed) return { kind: "confirm" };
  return reasonOk(state.reason) ? { kind: "change" } : { kind: "none", why: "REASON" };
}

/**
 * Whether the form asks for a reason: a grading with no proposal to confirm
 * (the teacher grades from scratch), or any criterion that now differs from
 * what the AI proposed or the teacher decided before.
 */
export function needsReason(state: EditorState): boolean {
  if (!state.decided && !(state.status === "AI_PROPOSED" && state.proposal)) return true;
  const base = state.decided?.points ?? proposalPoints(state.proposal, state.section).points;
  return criteriaOf(state.section).some((c) => typeof base[c] === "number" && state.picks[c] !== base[c]);
}
