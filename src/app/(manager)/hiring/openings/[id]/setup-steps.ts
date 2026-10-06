import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { canDecide, type Viewer } from "@/solutions/hiring/rules/access";
import { previewIsCurrent } from "@/solutions/hiring/rules/versions";
import type { WorkingState } from "@/solutions/hiring/server/working";
import { describeProblem } from "./problems";
import { readinessRows, rowHref, type ReadinessKey, type ReadinessRow, type ReadinessState } from "./readiness";

/** A step of a draft's setup path (4.5): the readiness rows, then "Yayınla". */
export type SetupKey = ReadinessKey | "publish";
export type SetupRow = { key: ReadinessKey; state: ReadinessState; href: string | null; row: ReadinessRow; fixText: string | null };
export type SetupProgress = { done: number; total: number; left: number; current: number };
export type SetupNext = { key: SetupKey; href: string };

/** The step's words: the overview's row labels (hiringOverview.*). */
export const SETUP_LABEL = {
  assessment: "rowAssessment",
  anchors: "rowAnchors",
  weights: "rowWeights",
  team: "rowTeam",
  preview: "rowPreview",
  publish: "rowPublish",
} as const satisfies Record<SetupKey, string>;

/** Team and preview are advice (STATUS decision 7): "Atla ›" passes them; a missing row cannot be skipped. */
const SKIPPABLE: ReadonlySet<ReadinessKey> = new Set(["team", "preview"]);
const passed = (r: { key: ReadinessKey; state: ReadinessState }, skipped: readonly ReadinessKey[]) => r.state === "done" || (r.state === "advisory" && SKIPPABLE.has(r.key) && skipped.includes(r.key));

/**
 * HIRING-VISUAL-FLOW 4.5 (P6, H7): a draft's readiness rows read as one path
 * ending in "Yayınla". "Kurulum n / N" and "k adım kaldı" answer "how far am
 * I?"; `current` (the first row neither done nor skipped, else the publish
 * step) answers "what now?". Skipping never counts as done.
 */
export function setupProgress(rows: ReadonlyArray<{ key: ReadinessKey; state: ReadinessState }>, skipped: readonly ReadinessKey[] = []): SetupProgress {
  const done = rows.filter((r) => r.state === "done").length;
  const total = rows.length + 1;
  const firstOpen = rows.findIndex((r) => !passed(r, skipped));
  return { done, total, left: total - done, current: firstOpen < 0 ? rows.length : firstOpen };
}

/**
 * KG3, H7: where "Kuruluma devam et" and a cockpit row's "Sıradaki: … ›" go:
 * the first step neither done nor skipped, to the place that fixes it (the
 * row's href), and the publish summary when nothing is left before it.
 */
export function setupNext(rows: ReadonlyArray<Pick<SetupRow, "key" | "state" | "href">>, openingId: string, skipped: readonly ReadinessKey[] = []): SetupNext {
  const base = `/hiring/openings/${openingId}`;
  const next = rows.find((r) => !passed(r, skipped));
  if (!next) return { key: "publish", href: `${base}#publish` };
  return { key: next.key, href: next.href ?? base };
}

/**
 * KG3: the team step opens the team flow (4.10) at the decision it lacks: who
 * reviews while nobody active is on the team or a member is disabled (B-M1),
 * else who decides.
 */
export function teamHref(openingId: string, input: { memberCount: number; decisionMakerActive: boolean; disabledMembers?: number }): string {
  const base = `/hiring/openings/${openingId}/settings`;
  return input.memberCount > 0 && !input.disabledMembers && !input.decisionMakerActive ? `${base}#team-decider` : `${base}#team-members`;
}

/** `?skip=team,preview` after "Atla ›": only the advisory steps, each once. */
export function setupSkips(value: string | string[] | undefined): ReadinessKey[] {
  const raw = (Array.isArray(value) ? value.join(",") : (value ?? "")).split(",");
  return [...new Set(raw.filter((k): k is ReadinessKey => k === "team" || k === "preview"))];
}

/**
 * The setup rows of an opening's draft, with the page that fixes each one
 * (describeProblem's link for a gate problem). `people` are the
 * organisation's users (one loadPanelUsers per page): the team row counts the
 * members who are active users (as the publish summary, the rules card and the
 * control view do), is not done while a member is disabled (B-M1), and asks
 * for an active owner or manager as decision maker. No draft or no content:
 * no rows.
 */
export function setupRowsOf(input: {
  state: Pick<WorkingState, "draft" | "content" | "facts" | "problems">;
  opening: { id: string; memberIds: readonly string[]; decisionMakerId: string | null };
  people: ReadonlyArray<{ id: string; role: Viewer["role"]; disabledAt: Date | null }>;
  t: ReturnType<typeof managerT>;
  locale: Locale;
}): SetupRow[] {
  const { state, opening, people, t, locale } = input;
  const content = state.content;
  if (!state.draft || !content) return [];
  const decider = people.find((u) => u.id === opening.decisionMakerId && u.disabledAt === null);
  const active = new Set(people.filter((u) => u.disabledAt === null).map((u) => u.id));
  const disabled = new Set(people.filter((u) => u.disabledAt !== null).map((u) => u.id));
  const team = {
    memberCount: opening.memberIds.filter((id) => active.has(id)).length,
    disabledMembers: opening.memberIds.filter((id) => disabled.has(id)).length,
    decisionMakerActive: decider !== undefined && canDecide(decider.role),
  };
  const rows = readinessRows({ problems: state.problems, content, previewed: previewIsCurrent(state.draft), ...team });
  return rows.map((row) => {
    const fix = row.problem ? describeProblem(row.problem, { content, facts: state.facts, locale, openingId: opening.id }, t) : null;
    const href = row.key === "team" ? teamHref(opening.id, team) : rowHref(row, fix?.href, opening.id);
    return { key: row.key, state: row.state, href, row, fixText: fix?.text ?? null };
  });
}
