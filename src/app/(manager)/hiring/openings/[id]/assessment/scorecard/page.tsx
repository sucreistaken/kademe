import { notFound } from "next/navigation";
import { ScorecardView, type ScorecardRow } from "@/components/hiring/scorecard/scorecard-view";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { pickText } from "@/lib/i18n-text";
import { missingAnchorLevels } from "@/lib/library/anchors";
import { loadDefaultScale } from "@/server/library";
import { isUuid } from "@/server/settings";
import { isChoice, orderedActivities, orderedStages, usedCompetencyIds } from "@/solutions/hiring/rules/content";
import { defaultWeights } from "@/solutions/hiring/rules/weights";
import { loadScorecard, positionProfile } from "@/solutions/hiring/server/content";
import { liveWeights } from "@/solutions/hiring/server/weight-sets";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";

export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * HIRING-UX 5.7: the scorecard of the version being worked on. A draft shows
 * its measured competencies with the library's anchors and its draft weights
 * (the position profile's when none are saved). With no draft, the live
 * version's card is read from its published snapshot and its newest weight
 * set; only the weights change there, as a new set with a reason.
 * `?anchors=<competency>` opens that anchor Sheet and `?weights=1` the
 * weights, the places the overview's readiness rows send to.
 */
export default async function ScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const state = await workingState(user.orgId, opening.id);
  const content = state.content;
  const shownVersion = state.draft ?? state.live;
  if (!content || !shownVersion) notFound();

  // Questions in screen order; choice questions are the knowledge test and measure no competency.
  const all = orderedStages(content).flatMap((s, si) =>
    orderedActivities(s).map((a, ai) => ({ a, label: `${si + 1}.${ai + 1}`, title: pickText(a.prompt, locale) || `${si + 1}.${ai + 1}` })),
  );
  const measuring = all.filter((x) => !isChoice(x.a.type));
  const columns = measuring.map((x) => ({ id: x.a.id, label: x.label, title: x.title }));
  const measuredBy = (cid: string) => measuring.filter((x) => x.a.competencyIds.includes(cid)).map((x) => x.a.id);

  let rows: ScorecardRow[];
  let enabled: boolean;
  let weights: Record<string, number>;
  let levels: Array<{ value: number; label: string }>;
  let activeSetLabel: string | null = null;
  if (state.draft) {
    const used = usedCompetencyIds(content);
    const [profile, scale] = await Promise.all([positionProfile(user.orgId, opening.positionId), loadDefaultScale(user.orgId)]);
    rows = used.map((cid) => {
      const f = state.facts.get(cid);
      return {
        id: cid,
        name: pickText(f?.name, locale),
        missingLevels: f ? missingAnchorLevels(f.anchors) : [],
        measuredBy: measuredBy(cid),
        anchors: f?.anchors ?? {},
        state: !f ? "unknown" : f.archived ? "archived" : "active",
      };
    });
    enabled = content.weightsEnabled;
    // Saved weights as they are (a competency added since has none: WEIGHTS_MISSING); otherwise the profile's.
    weights = content.weightsEnabled && content.draftWeights ? content.draftWeights : defaultWeights(used, profile);
    levels = (scale?.levels ?? []).map((l) => ({ value: l.value, label: pickText(l.label, locale) }));
  } else {
    const [card, latest] = await Promise.all([loadScorecard(user.orgId, shownVersion.id), liveWeights(user.orgId, shownVersion.id)]);
    if (!card) notFound();
    rows = card.competencies.map((c) => ({
      id: c.id,
      name: pickText(c.name, locale),
      missingLevels: [],
      measuredBy: measuredBy(c.id),
      anchors: c.anchors,
      state: "active",
    }));
    enabled = latest?.enabled ?? card.weightsEnabled;
    weights = latest?.weights ?? Object.fromEntries(card.competencies.map((c) => [c.id, c.weight]));
    activeSetLabel = latest?.label ?? null;
    levels = card.scale.levels.map((l) => ({ value: l.value, label: pickText(l.label, locale) }));
  }

  const editReason =
    opening.status === "CLOSED" ? t("hiringScorecard.closed") : !access.edit ? t("hiringScorecard.noEdit") : null;
  const sheet = one(sp.anchors);

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="scorecard" t={t} />
      </div>
      <div className="max-w-[960px]">
        <ScorecardView
          // A new version (published, or a new draft) is a new form: nothing typed for the old one carries over.
          key={shownVersion.id}
          openingId={opening.id}
          versionId={shownVersion.id}
          mode={state.draft ? "draft" : "live"}
          liveNumber={state.live?.number ?? null}
          activeSetLabel={activeSetLabel}
          rows={rows}
          columns={columns}
          choiceCount={all.length - measuring.length}
          initialEnabled={enabled}
          initialWeights={Object.fromEntries(rows.map((r) => [r.id, Object.hasOwn(weights, r.id) ? String(weights[r.id]) : ""]))}
          openWeights={one(sp.weights) === "1"}
          initialSheet={sheet && isUuid(sheet) ? sheet : null}
          levels={levels}
          editReason={editReason}
          anchorsReason={can(user, "library:write") ? null : t("hiringScorecard.sheetNoPermission")}
        />
      </div>
    </main>
  );
}
