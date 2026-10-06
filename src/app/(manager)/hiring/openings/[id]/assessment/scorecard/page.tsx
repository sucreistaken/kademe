import Link from "next/link";
import { notFound } from "next/navigation";
import { ScorecardView, type ScorecardRow } from "@/components/hiring/scorecard/scorecard-view";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { pickText } from "@/lib/i18n-text";
import { missingAnchorLevels } from "@/lib/library/anchors";
import { one } from "@/lib/url-notice";
import { loadDefaultScale } from "@/server/library";
import { isUuid } from "@/server/settings";
import { usedCompetencyIds } from "@/solutions/hiring/rules/content";
import { defaultWeights } from "@/solutions/hiring/rules/weights";
import { loadScorecard, loadVersionContent, positionProfile } from "@/solutions/hiring/server/content";
import { liveWeights } from "@/solutions/hiring/server/weight-sets";
import { workingState } from "@/solutions/hiring/server/working";
import { openingFor } from "../../access";
import { AssessmentTabs, OpeningHeader } from "../../opening-header";
import { setupStrip } from "../../setup-strip";
import { matrixOf, pickVersion, viewContent } from "./data";

export const dynamic = "force-dynamic";


/**
 * HIRING-UX 5.7: the scorecard of the version being worked on. A draft shows
 * its measured competencies with the library's anchors and its draft weights
 * (the position profile's when none are saved), and says the live version
 * beside it stays as it is; `?version=live` shows that live version, whose
 * card is read from its published snapshot and its newest weight set (only
 * the weights change there, as a new set with a reason, also while a draft
 * exists). `?anchors=<competency>` opens that anchor Sheet and `?weights=1`
 * the weights, the places the overview's readiness rows send to.
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
  const pick = pickVersion(state, one(sp.version));
  if (!pick || !state.content) notFound();
  // 4.5: where a draft's setup path stands, for someone who may edit it (only the people are read; null otherwise).
  const setup = await setupStrip({ orgId: user.orgId, opening, access, t, locale, state });
  const content = await viewContent(pick, state.content, (versionId) => loadVersionContent(user.orgId, versionId));
  if (!content) notFound();
  const matrix = matrixOf(content, locale, t);

  let rows: ScorecardRow[];
  let enabled: boolean;
  let weights: Record<string, number>;
  let levels: Array<{ value: number; label: string }>;
  let baseline: { enabled: boolean; weights: Record<string, number> } | null = null;
  let setNote: string | null = null;
  if (pick.mode === "draft") {
    const used = usedCompetencyIds(content);
    const [profile, scale] = await Promise.all([positionProfile(user.orgId, opening.positionId), loadDefaultScale(user.orgId)]);
    rows = used.map((cid) => {
      const f = state.facts.get(cid);
      return {
        id: cid,
        name: pickText(f?.name, locale),
        missingLevels: f ? missingAnchorLevels(f.anchors) : [],
        measuredBy: matrix.measuredBy(cid),
        anchors: f?.anchors ?? {},
        state: !f ? "unknown" : f.archived ? "archived" : "active",
      };
    });
    enabled = content.weightsEnabled;
    // Saved weights as they are (a competency added since has none: WEIGHTS_MISSING); otherwise the profile's.
    weights = content.weightsEnabled && content.draftWeights ? content.draftWeights : defaultWeights(used, profile);
    levels = (scale?.levels ?? []).map((l) => ({ value: l.value, label: pickText(l.label, locale) }));
  } else {
    const [card, latest] = await Promise.all([loadScorecard(user.orgId, pick.version.id), liveWeights(user.orgId, pick.version.id)]);
    if (!card) notFound();
    rows = card.competencies.map((c) => ({
      id: c.id,
      name: pickText(c.name, locale),
      missingLevels: [],
      measuredBy: matrix.measuredBy(c.id),
      anchors: c.anchors,
      state: "active",
    }));
    baseline = latest
      ? { enabled: latest.enabled, weights: latest.weights }
      : { enabled: card.weightsEnabled, weights: Object.fromEntries(card.competencies.map((c) => [c.id, c.weight])) };
    enabled = baseline.enabled;
    weights = baseline.weights;
    levels = card.scale.levels.map((l) => ({ value: l.value, label: pickText(l.label, locale) }));
    if (latest) {
      const date = shortDate(latest.createdAt, locale);
      setNote = latest.reason ? t("hiringScorecard.activeSetDated", { date, reason: latest.reason }) : t("hiringScorecard.activeSetPublished", { date });
    }
  }

  const editReason = opening.status === "CLOSED" ? t("hiringScorecard.closed") : !access.edit ? t("hiringScorecard.noEdit") : null;
  const sheet = one(sp.anchors);
  const base = `/hiring/openings/${opening.id}/assessment/scorecard`;
  const note =
    pick.mode === "live"
      ? `${t("hiringScorecard.liveMode", { number: pick.version.number })}${setNote ? ` ${setNote}` : ""}`
      : pick.live
        ? t("hiringScorecard.draftNote", { draft: pick.version.number, live: pick.live.number })
        : null;
  const switchItems =
    pick.draft && pick.live
      ? [
          { href: `${base}?version=live`, label: t("hiringScorecard.switchLive", { number: pick.live.number }), active: pick.mode === "live" },
          { href: base, label: t("hiringScorecard.switchDraft", { number: pick.draft.number }), active: pick.mode === "draft" },
        ]
      : [];

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="assessment" locale={locale} t={t} setup={setup} />
      <div className="mt-4">
        <AssessmentTabs openingId={opening.id} active="scorecard" t={t} />
      </div>
      <div className="max-w-[960px]">
        {note || switchItems.length ? (
          <div className="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            {note ? <p className="tnum max-w-[640px] text-[13px] leading-5 text-muted">{note}</p> : null}
            {switchItems.length ? (
              <nav aria-label={t("hiringScorecard.versionSwitchLabel")} className="inline-flex shrink-0 rounded-[10px] border border-line bg-surface p-0.5">
                {switchItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "tnum rounded-[8px] px-3 py-1.5 text-[13px] transition-colors duration-[120ms] ease-out",
                      item.active ? "bg-brand-soft font-medium text-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        ) : null}
        <ScorecardView
          // A new version (published, or a new draft) is a new form: nothing typed for the old one carries over.
          key={pick.version.id}
          openingId={opening.id}
          versionId={pick.version.id}
          mode={pick.mode}
          liveNumber={pick.live?.number ?? null}
          baseline={baseline}
          rows={rows}
          columns={matrix.columns}
          choiceCount={matrix.choiceCount}
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
