import { and, eq, gt, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, candidateRequests, candidates, deletionRequests, hiringAssessments, hiringOpenings, hiringVersions, users } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import type { TodayItem } from "@/solutions/types";
import { EXPIRING_SOON_MS } from "../rules/invitation";

const DETAIL_MAX = 140;

/**
 * HIRING-VISUAL-FLOW 4.3 (M2): hiring's rows on Today, for someone who runs
 * openings (owners and managers; a reviewer gets none: requests are for the
 * people who run the opening, STATUS 321). One "task" row per open
 * accommodation request (K10 may pick it as "Sıradaki iş"); per opening, one
 * "attention" row each for its open requests, its links expiring within 48
 * hours and a draft waiting to be published. Data-rights requests are not
 * tasks in plan 2b (ruling C6, the user's "plan 3 te gelsin"): they are
 * counted in the opening's requests row, which says so in a plain note; their
 * handling place and their top rank come with plan 3 (RANK keeps the order).
 *
 * Every read is scoped to the organisation and runs after the one before
 * (ruling C21: the pool of five connections is shared with the live exam's
 * writes). The candidate's name is shown to the people who run openings
 * (blind mode masks only non-runners, ruling C12).
 */
export async function hiringToday(orgId: string, userId: string, locale: Locale, now: Date = new Date()): Promise<TodayItem[]> {
  const [viewer] = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), isNull(users.disabledAt)))
    .limit(1);
  if (!viewer || !can({ role: viewer.role }, "opening:write")) return [];
  const t = managerT(locale);

  const requests = await db
    .select({ id: candidateRequests.id, kind: candidateRequests.kind, message: candidateRequests.message, createdAt: candidateRequests.createdAt, name: candidates.fullName, openingId: hiringAssessments.openingId, openingName: hiringOpenings.name })
    .from(candidateRequests)
    .innerJoin(hiringAssessments, and(eq(hiringAssessments.assessmentId, candidateRequests.assessmentId), eq(hiringAssessments.orgId, orgId)))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, orgId)))
    .innerJoin(assessments, and(eq(assessments.id, candidateRequests.assessmentId), eq(assessments.orgId, orgId)))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(candidateRequests.orgId, orgId), isNull(candidateRequests.handledAt)));
  const rights = await db
    .select({ id: deletionRequests.id, createdAt: deletionRequests.createdAt, openingId: hiringAssessments.openingId, openingName: hiringOpenings.name })
    .from(deletionRequests)
    .innerJoin(candidates, and(eq(candidates.id, deletionRequests.candidateId), eq(candidates.orgId, orgId)))
    .innerJoin(assessments, and(eq(assessments.candidateId, candidates.id), eq(assessments.orgId, orgId), eq(assessments.solution, "HIRING")))
    .innerJoin(hiringAssessments, and(eq(hiringAssessments.assessmentId, assessments.id), eq(hiringAssessments.orgId, orgId)))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, orgId)))
    .where(isNull(deletionRequests.handledAt));
  const links = await db
    .select({ openingId: hiringAssessments.openingId, openingName: hiringOpenings.name })
    .from(assessmentLinks)
    .innerJoin(hiringAssessments, and(eq(hiringAssessments.assessmentId, assessmentLinks.assessmentId), eq(hiringAssessments.orgId, orgId)))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, orgId)))
    .where(and(inArray(assessmentLinks.status, ["NOT_STARTED", "IN_PROGRESS"]), gt(assessmentLinks.expiresAt, now), lt(assessmentLinks.expiresAt, new Date(now.getTime() + EXPIRING_SOON_MS))));
  const drafts = await db
    .select({ openingId: hiringVersions.openingId, openingName: hiringOpenings.name, number: hiringVersions.versionNumber })
    .from(hiringVersions)
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringVersions.openingId), eq(hiringOpenings.orgId, orgId)))
    .where(and(eq(hiringVersions.orgId, orgId), eq(hiringVersions.status, "DRAFT"), ne(hiringOpenings.status, "CLOSED")));

  const name = (n: string | null) => n ?? t("hiringToday.anonymous");
  const detail = (m: string | null) => (m ? (m.length > DETAIL_MAX ? `${m.slice(0, DETAIL_MAX - 1)}…` : m) : null);
  const candidatesTab = (id: string) => `/hiring/openings/${id}/candidates`;

  const tasks: TodayItem[] = requests
    .filter((r) => r.kind === "ACCOMMODATION")
    .map((r) => ({ id: `hiring:request:${r.id}`, solution: "hiring", lane: "task", task: "ACCOMMODATION", title: t("hiringToday.accommodation", { name: name(r.name) }), subtitle: r.openingName, detail: detail(r.message), href: candidatesTab(r.openingId), sortAt: r.createdAt, cells: [] }));

  // One row per opening and kind; a data-rights request reached through two invitations of the same person counts once.
  const perOpening = <T extends { openingId: string; openingName: string }>(rows: T[]) => {
    const groups = new Map<string, { name: string; rows: T[] }>();
    for (const row of rows) groups.set(row.openingId, { name: row.openingName, rows: [...(groups.get(row.openingId)?.rows ?? []), row] });
    return [...groups.entries()];
  };
  const open = [...requests.map((r) => ({ ...r, rights: false })), ...[...new Map(rights.map((r) => [`${r.openingId}:${r.id}`, r])).values()].map((r) => ({ ...r, rights: true }))];
  const attention: TodayItem[] = [
    ...perOpening(open).map(([id, g]): TodayItem => {
      const counted = g.rows.filter((r) => r.rights).length;
      return {
        id: `hiring:requests:${id}`,
        solution: "hiring",
        lane: "attention",
        attention: "requests",
        title: t("hiringCommon.openRequests", { count: g.rows.length }),
        subtitle: g.name,
        detail: counted ? t("hiringCommon.rightsNote", { count: counted }) : null,
        href: candidatesTab(id),
        sortAt: new Date(Math.min(...g.rows.map((r) => r.createdAt.getTime()))),
        cells: [],
      };
    }),
    ...perOpening(links).map(([id, g]): TodayItem => ({ id: `hiring:expiring:${id}`, solution: "hiring", lane: "attention", attention: "expiring", title: t("hiringCommon.expiringLinks", { count: g.rows.length }), subtitle: g.name, href: candidatesTab(id), sortAt: null, cells: [] })),
    ...drafts.map((d): TodayItem => ({
      id: `hiring:draft:${d.openingId}`,
      solution: "hiring",
      lane: "attention",
      attention: "draft",
      title: t("hiringCommon.draftWaitingPublish", { number: d.number }),
      subtitle: d.openingName,
      actionLabel: t("hiringCommon.continueSetup"),
      href: `/hiring/openings/${d.openingId}`,
      sortAt: null,
      cells: [],
    })),
  ];
  return [...tasks, ...attention];
}
