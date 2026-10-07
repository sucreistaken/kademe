import { openingNextStep, type OpeningNext } from "@/components/hiring/opening-next-step";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { can } from "@/lib/authorize";
import { orgDay } from "@/lib/org-timezone";
import { loadPanelUsers } from "@/server/settings";
import type { Viewer } from "@/solutions/hiring/rules/access";
import { invitableOpenings, openingCardFacts, type OpeningCardFacts } from "@/solutions/hiring/server/invitations";
import { listOpenings, type OpeningListRow } from "@/solutions/hiring/server/openings";
import { workingState } from "@/solutions/hiring/server/working";
import { setupNext, setupProgress, setupRowsOf, type SetupKey } from "./[id]/setup-steps";

/**
 * D14: the drafts' setup paths are read one draft after another until this
 * much time went by; the rest say "Kuruluma devam et ›" without a count. The
 * openings in setup come first, then the live openings with a new version
 * waiting (B-M10), inside the same budget.
 */
export const SETUP_BUDGET_MS = 300;

export type CockpitRow = {
  opening: OpeningListRow;
  /** A live opening's funnel, expiring links and (for someone who runs openings) requests; null for a draft and a closed opening (KG1: its row is "Aç" only). */
  facts: OpeningCardFacts | null;
  /** A draft's "Kurulum n / N" for someone who runs openings; null otherwise or past the budget. */
  setup: { done: number; total: number } | null;
  /**
   * A live opening with no active evaluator (4.4 (2): the invite form refuses
   * then, NO_EVALUATORS, so the row leads to the team, not to an invitation),
   * for someone who runs openings.
   */
  noTeam: boolean;
  /**
   * A live opening whose last day is before today in the organisation's zone
   * (the invite form's openingDeadline, B-M3), for someone who runs openings;
   * false otherwise (a reviewer reads no invite form, H9).
   */
  deadlinePassed: boolean;
  /**
   * The team line: for someone who runs openings, the members who are active
   * users (the people the team rule counts, so the two lines agree); for a
   * reviewer, the listed members (no user list is read for them, H9).
   */
  team: { count: number; onlyYou: boolean };
  next: OpeningNext<SetupKey>;
};

/**
 * HIRING-VISUAL-FLOW 4.4: everything the openings' control view shows, read
 * one statement after another (ruling C21: listOpenings, openingCardFacts,
 * invitableOpenings, loadPanelUsers and the setup paths each await the one
 * before; inside workingState, loadCompetencyFacts still reads a draft's
 * anchors and tags side by side). A reviewer's openings are only
 * the ones they are on (listOpenings), with counts only (H9): no request is
 * read, no setup path is computed, no team rule is checked. `clock` is the
 * budget's clock (tests pass their own).
 */
export async function loadCockpit(
  user: Viewer & { orgId: string },
  t: ReturnType<typeof managerT>,
  locale: Locale,
  clock: () => number = Date.now,
): Promise<{ runs: boolean; drafts: CockpitRow[]; open: CockpitRow[]; closed: CockpitRow[] }> {
  const runs = can(user, "opening:write");
  const drafts = await listOpenings(user.orgId, user, "DRAFT");
  const open = await listOpenings(user.orgId, user, "OPEN");
  const closed = await listOpenings(user.orgId, user, "CLOSED");
  // Only the live rows show counts (design 4.4): a closed opening's invitations are never read, however many there are.
  const facts = await openingCardFacts(user.orgId, open.map((o) => o.id), { runs });
  const invitable = runs && open.length > 0 ? await invitableOpenings(user.orgId) : [];
  const people = runs && drafts.length + open.length + closed.length > 0 ? await loadPanelUsers(user.orgId) : [];
  const active = new Set(people.filter((u) => u.disabledAt === null).map((u) => u.id));
  const today = orgDay();
  const setups = new Map<string, { done: number; total: number; next: { key: SetupKey; href: string } }>();
  // B-M10: a live opening's waiting draft gets its next setup step too (KG3), after the openings in setup and inside the same budget.
  const toSetUp = runs ? [...drafts, ...open.filter((o) => o.liveNumber !== null && o.draftNumber !== null)] : [];
  if (toSetUp.length > 0) {
    const started = clock();
    for (const draft of toSetUp) {
      if (clock() - started > SETUP_BUDGET_MS) break;
      const rows = setupRowsOf({ state: await workingState(user.orgId, draft.id), opening: draft, people, t, locale });
      if (rows.length === 0) continue;
      const progress = setupProgress(rows);
      setups.set(draft.id, { done: progress.done, total: progress.total, next: setupNext(rows, draft.id) });
    }
  }
  const row = (opening: OpeningListRow): CockpitRow => {
    const f = opening.status === "OPEN" ? (facts[opening.id] ?? null) : null;
    const computed = setups.get(opening.id) ?? null;
    // "Kurulum n / N" is a draft's count only; a live opening uses the computed step for its "Kuruluma devam et" alone.
    const setup = opening.status === "DRAFT" ? computed : null;
    const panel = runs && opening.status === "OPEN" ? invitable.find((o) => o.id === opening.id) : undefined;
    const noTeam = panel !== undefined && panel.evaluators === 0;
    const deadlinePassed = panel?.deadlineDay != null && panel.deadlineDay < today;
    const members = runs ? opening.memberIds.filter((id) => active.has(id)) : opening.memberIds;
    return {
      opening,
      facts: f,
      setup: setup ? { done: setup.done, total: setup.total } : null,
      noTeam,
      deadlinePassed,
      team: { count: members.length, onlyYou: members.length === 1 && members[0] === user.id },
      next: openingNextStep({
        id: opening.id,
        status: opening.status,
        runs,
        setup: computed?.next ?? null,
        facts: f,
        noTeam,
        draftWaiting: opening.liveNumber !== null && opening.draftNumber !== null,
        deadlinePassed,
      }),
    };
  };
  return { runs, drafts: drafts.map(row), open: open.map(row), closed: closed.map(row) };
}
