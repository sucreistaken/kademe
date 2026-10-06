import { panelShortfall } from "@/components/hiring/invite/form-rules";
import { openingNextStep, type OpeningNext } from "@/components/hiring/opening-next-step";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { can } from "@/lib/authorize";
import { loadPanelUsers } from "@/server/settings";
import type { Viewer } from "@/solutions/hiring/rules/access";
import { invitableOpenings, openingCardFacts, type OpeningCardFacts } from "@/solutions/hiring/server/invitations";
import { listOpenings, type OpeningListRow } from "@/solutions/hiring/server/openings";
import { workingState } from "@/solutions/hiring/server/working";
import { setupNext, setupProgress, setupRowsOf, type SetupKey } from "./[id]/setup-steps";

/** D14: the drafts' setup paths are read one draft after another until this much time went by; the rest say "Kuruluma devam et ›" without a count. */
export const SETUP_BUDGET_MS = 300;

export type CockpitRow = {
  opening: OpeningListRow;
  /** Live and closed openings (the funnel and the expiring links); null for a draft. */
  facts: OpeningCardFacts | null;
  /** A draft's "Kurulum n / N" for someone who runs openings; null otherwise or past the budget. */
  setup: { done: number; total: number } | null;
  /** A live opening's team below its rule (panelShortfall), for someone who runs openings. */
  shortfall: { evaluators: number; min: number } | null;
  next: OpeningNext<SetupKey>;
};

/**
 * HIRING-VISUAL-FLOW 4.4: everything the openings' control view shows, read
 * one statement after another (ruling C21). A reviewer's openings are only
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
  const facts = await openingCardFacts(user.orgId, [...open, ...closed].map((o) => o.id), { runs });
  const invitable = runs && open.length > 0 ? await invitableOpenings(user.orgId) : [];
  const setups = new Map<string, { done: number; total: number; next: { key: SetupKey; href: string } }>();
  if (runs && drafts.length > 0) {
    const people = await loadPanelUsers(user.orgId);
    const started = clock();
    for (const draft of drafts) {
      if (clock() - started > SETUP_BUDGET_MS) break;
      const rows = setupRowsOf({ state: await workingState(user.orgId, draft.id), opening: draft, people, t, locale });
      if (rows.length === 0) continue;
      const progress = setupProgress(rows);
      setups.set(draft.id, { done: progress.done, total: progress.total, next: setupNext(rows, draft.id) });
    }
  }
  const row = (opening: OpeningListRow): CockpitRow => {
    const f = opening.status === "DRAFT" ? null : (facts[opening.id] ?? null);
    const setup = setups.get(opening.id) ?? null;
    const shortfall = runs && opening.status === "OPEN" ? panelShortfall(invitable.find((o) => o.id === opening.id) ?? null) : null;
    return {
      opening,
      facts: f,
      setup: setup ? { done: setup.done, total: setup.total } : null,
      shortfall,
      next: openingNextStep({
        id: opening.id,
        status: opening.status,
        runs,
        setup: setup?.next ?? null,
        facts: f,
        shortfall: shortfall !== null,
        draftWaiting: opening.liveNumber !== null && opening.draftNumber !== null,
      }),
    };
  };
  return { runs, drafts: drafts.map(row), open: open.map(row), closed: closed.map(row) };
}
