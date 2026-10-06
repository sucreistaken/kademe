import type { Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import { listCompetencies, listPositions } from "@/server/library";
import { solutionModules } from "@/solutions/registry.server";
import type { AdvancedCard, SolutionModule } from "@/solutions/types";

/**
 * "What you have" on the Advanced page (spec 4): each solution's cards, then
 * the organisation library's, which is core. Counts only active rows.
 */
export async function advancedAreaCards(orgId: string, locale: Locale, modules: readonly SolutionModule[] = solutionModules()): Promise<AdvancedCard[]> {
  const t = managerT(locale);
  const [fromSolutions, positions, competencies] = await Promise.all([
    Promise.all(modules.map((m) => (m.advancedCards ? m.advancedCards(orgId, locale) : Promise.resolve([] as AdvancedCard[])))),
    listPositions(orgId),
    listCompetencies(orgId),
  ]);
  const active = (rows: Array<{ archivedAt: Date | null }>) => rows.filter((r) => !r.archivedAt).length;
  return [
    ...fromSolutions.flat(),
    { key: "positions", title: t("advancedCreate.positionsCard"), lines: [t("advancedCreate.positionsCount", { count: active(positions) })], href: "/library/positions" },
    {
      key: "competencies",
      title: t("advancedCreate.competenciesCard"),
      lines: [t("advancedCreate.competenciesCount", { count: active(competencies) })],
      href: "/library/competencies",
    },
  ];
}
