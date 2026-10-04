import { usedCompetencyIds, type VersionContent } from "@/solutions/hiring/rules/content";
import { ANCHOR_PROBLEMS, STRUCTURE_PROBLEMS, WEIGHT_PROBLEMS, type PublishProblem } from "@/solutions/hiring/rules/gate";

export type ReadinessKey = "assessment" | "anchors" | "weights" | "team" | "preview";
/** done; missing (the gate refuses until it is fixed); advisory (recommended, never blocks publishing). */
export type ReadinessState = "done" | "missing" | "advisory";
export type ReadinessRow = {
  key: ReadinessKey;
  state: ReadinessState;
  /** The first gate problem of this row, in screen order. */
  problem: PublishProblem | null;
  /**
   * NO_COMPETENCIES: nothing is measured yet and the gate names no anchor problem (no question yet,
   * or an open question without a competency, which the assessment row reports). A choice-only
   * draft gets the gate's own NO_MEASURED_COMPETENCY instead, so the row and the gate agree.
   */
  reason: "NO_COMPETENCIES" | null;
};

const row = (key: ReadinessKey, problems: PublishProblem[]): ReadinessRow => ({
  key,
  state: problems.length ? "missing" : "done",
  problem: problems[0] ?? null,
  reason: null,
});

/**
 * The readiness list of a draft (HIRING-UX 5.4), in screen order. The weights
 * row appears only with weighting on (or when the gate names a weights problem).
 */
export function readinessRows(input: { problems: PublishProblem[]; content: VersionContent; memberCount: number; previewed: boolean }): ReadinessRow[] {
  const of = (group: ReadonlyArray<PublishProblem["code"]>) => input.problems.filter((p) => group.includes(p.code));
  const anchors = of(ANCHOR_PROBLEMS);
  const weights = of(WEIGHT_PROBLEMS);
  const rows: ReadinessRow[] = [
    row("assessment", of(STRUCTURE_PROBLEMS)),
    usedCompetencyIds(input.content).length === 0 && anchors.length === 0
      ? { key: "anchors", state: "missing", problem: null, reason: "NO_COMPETENCIES" }
      : row("anchors", anchors),
  ];
  if (input.content.weightsEnabled || weights.length) rows.push(row("weights", weights));
  rows.push(
    { key: "team", state: input.memberCount > 0 ? "done" : "advisory", problem: null, reason: null },
    { key: "preview", state: input.previewed ? "done" : "advisory", problem: null, reason: null },
  );
  return rows;
}

/**
 * Where a row that is not done sends the editor (ruling C7: only to pages that
 * exist): the gate's own fix when it has one, the builder when nothing is
 * measured yet, team and rules for the team, the candidate preview.
 */
export function rowHref(row: ReadinessRow, fixHref: string | null | undefined, openingId: string): string | null {
  const base = `/hiring/openings/${openingId}`;
  if (fixHref) return fixHref;
  if (row.reason === "NO_COMPETENCIES") return `${base}/assessment/edit`;
  if (row.key === "team") return `${base}/settings`;
  if (row.key === "preview") return `${base}/assessment/preview`;
  return null;
}

/** The link's words follow where it goes: the builder, a library competency, the scorecard, the preview or the team. */
export function rowAction(href: string): "goBuilder" | "goLibrary" | "goScorecard" | "goPreview" | "goTeam" {
  if (href.startsWith("/library/")) return "goLibrary";
  if (href.endsWith("/settings")) return "goTeam";
  if (href.includes("/assessment/scorecard")) return "goScorecard";
  if (href.includes("/assessment/preview")) return "goPreview";
  return "goBuilder";
}
