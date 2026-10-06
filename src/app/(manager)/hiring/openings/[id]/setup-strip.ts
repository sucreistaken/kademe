import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { loadPanelUsers } from "@/server/settings";
import type { OpeningDetail } from "@/solutions/hiring/server/openings";
import { workingState, type WorkingState } from "@/solutions/hiring/server/working";
import { setupNext, setupProgress, setupRowsOf, type SetupNext } from "./setup-steps";

export type SetupStripData = { done: number; total: number; next: SetupNext };

/**
 * HIRING-VISUAL-FLOW 4.5: the one-line path ("Kurulum 2 / 5 · Sıradaki: Ekibi
 * ata ›") on a draft opening's pages (the assessment's tabs, team and rules)
 * for someone who may edit it; never on the overview, whose setup card says
 * the same one line lower. Null for anything else, before any read. A page
 * that already read the working state passes it; the people are read once,
 * and only when there is a draft with content to judge.
 */
export async function setupStrip(input: {
  orgId: string;
  opening: OpeningDetail;
  access: { edit: boolean };
  t: ReturnType<typeof managerT>;
  locale: Locale;
  state?: WorkingState;
}): Promise<SetupStripData | null> {
  const { orgId, opening, access, t, locale } = input;
  if (opening.status !== "DRAFT" || !access.edit) return null;
  const state = input.state ?? (await workingState(orgId, opening.id));
  if (!state.draft || !state.content) return null;
  const people = await loadPanelUsers(orgId);
  const rows = setupRowsOf({ state, opening, people, t, locale });
  if (rows.length === 0) return null;
  const progress = setupProgress(rows);
  return { done: progress.done, total: progress.total, next: setupNext(rows, opening.id) };
}
