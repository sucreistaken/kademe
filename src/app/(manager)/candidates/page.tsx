import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button, DisabledReason } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { Avatar } from "@/components/ui/avatar";
import { UndoStrip } from "@/components/ui/undo-strip";
import { FilterForm } from "@/components/manager/filter-form";
import { ScoreBar } from "@/components/manager/score-bar";
import { requireUser } from "@/server/session";
import {
  loadAssessmentRows,
  loadPositions,
  needsReview,
  pipelineState,
  type AssessmentRow,
  type PipelineState,
} from "@/lib/manager-data";
import { loadScale } from "@/lib/library-data";
import { remaining, score as formatScore } from "@/lib/format";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";
import { extendLink, undoExtendLink } from "../actions";

type Tab = "all" | "review" | "progress" | "decided";
type T = ReturnType<typeof managerT>;

const TAB_KEYS = ["all", "review", "progress", "decided"] as const;

const TAB_LABEL: Record<Tab, "tabAll" | "tabReview" | "tabProgress" | "tabDecided"> = {
  all: "tabAll",
  review: "tabReview",
  progress: "tabProgress",
  decided: "tabDecided",
};

type Filters = {
  q: string;
  tab: Tab;
  position: string;
  stage: string;
  score: string;
};

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const params = await searchParams;
  const rows = await loadAssessmentRows(user.orgId);
  const positions = await loadPositions(user.orgId, rows);
  // The score bar is drawn against the org's own ceiling, not a hardcoded 5:
  // the scale is editable in /library/scale.
  const scale = await loadScale(user.orgId);
  const scaleMax = scale?.maxValue ?? 5;
  const now = new Date();

  const filters: Filters = {
    q: single(params.q),
    tab: asTab(single(params.tab)),
    position: single(params.position),
    stage: single(params.stage),
    score: single(params.score),
  };

  const visible = rows.filter((row) => matches(row, filters, now));
  const positionName = positions.find((p) => p.id === filters.position)?.name ?? null;

  // Tab counts ignore the other filters on purpose: a tab whose number changes
  // as you type is not a tab, it is a second search box.
  const inPosition = rows.filter(
    (row) => !filters.position || row.positionId === filters.position,
  );
  const tabCounts: Record<Tab, number> = {
    all: inPosition.length,
    review: inPosition.filter((row) => needsReview(pipelineState(row, now))).length,
    progress: inPosition.filter((row) => pipelineState(row, now) === "IN_PROGRESS").length,
    decided: inPosition.filter((row) => pipelineState(row, now) === "DECIDED").length,
  };

  const active = activeFilters(filters, positionName, t, locale);

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            {t("candidates.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {positionName ? `${positionName} · ` : ""}
            {t("candidates.countLine", { count: inPosition.length })}
          </p>
        </div>
        {/* The zero-result state carries its own primary button. Two filled
            buttons on one screen breaks the single-emphasis rule. */}
        {visible.length > 0 && (
          <Button asChild variant="primary" size="md">
            <Link href="/candidates/new">{t("shared.inviteCandidate")}</Link>
          </Button>
        )}
      </div>

      {/* ---- filter bar: search, tabs and dropdowns on one row ---- */}
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-line bg-paper px-6 py-3.5">
          <FilterForm
            action="/candidates"
            className="flex flex-wrap items-center gap-x-2.5 gap-y-2"
          >
            <input type="hidden" name="tab" value={filters.tab} />
            <input type="hidden" name="position" value={filters.position} />
            {/* No submit button: Enter submits the form, and the dropdowns
                submit on change. One less control competing for attention. */}
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder={t("candidates.searchPlaceholder")}
              aria-label={t("candidates.searchLabel")}
              className="h-9 w-[250px] rounded-[8px] border border-line-strong bg-surface
                         px-3 text-[13px] placeholder:text-ink-3"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              {TAB_KEYS.map((tab) => {
                const isActive = filters.tab === tab;
                return (
                  <Link
                    key={tab}
                    href={withFilters(filters, { tab: tab === "all" ? "" : tab })}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-surface"
                        : "rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-ink-3"
                    }
                  >
                    {t(`candidates.${TAB_LABEL[tab]}`)}{" "}
                    <span className="tnum">{tabCounts[tab]}</span>
                  </Link>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Select
                name="stage"
                value={filters.stage}
                label={t("candidates.stageFilterLabel")}
              >
                <option value="">{t("candidates.stageAll")}</option>
                <option value="1">{t("candidates.stageAtLeast", { n: 1 })}</option>
                <option value="2">{t("candidates.stageAtLeast", { n: 2 })}</option>
                <option value="3">{t("candidates.stageAtLeast", { n: 3 })}</option>
              </Select>
              <Select
                name="score"
                value={filters.score}
                label={t("candidates.scoreFilterLabel")}
              >
                <option value="">{t("candidates.scoreAll")}</option>
                <option value="3">{t("candidates.scoreAtLeast", { n: "3" })}</option>
                <option value="4">{t("candidates.scoreAtLeast", { n: "4" })}</option>
                <option value="4.5">
                  {t("candidates.scoreAtLeast", {
                    n: locale === "tr" ? "4,5" : "4.5",
                  })}
                </option>
              </Select>
            </div>
          </FilterForm>
        </div>

        {visible.length === 0 ? (
          <ZeroResults
            filters={filters}
            active={active}
            rows={rows}
            now={now}
            totalInPosition={inPosition.length}
            t={t}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className="px-5 py-3 font-medium">{t("candidates.colCandidate")}</th>
                  <th className="px-5 py-3 font-medium">{t("candidates.colStage")}</th>
                  <th className="px-5 py-3 font-medium">{t("candidates.colStatus")}</th>
                  <th className="px-5 py-3 font-medium">{t("candidates.colScore")}</th>
                  <th className="px-5 py-3 font-medium">{t("candidates.colDecision")}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <CandidateRow
                    key={row.assessmentId}
                    row={row}
                    now={now}
                    scaleMax={scaleMax}
                    locale={locale}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {params.undo === "link" && typeof params.linkId === "string" && (
        <UndoStrip
          message={t("dashboard.undoExtend", {
            name:
              typeof params.who === "string" && params.who
                ? params.who
                : t("shared.candidate"),
            days: typeof params.days === "string" ? params.days : 3,
          })}
          action={undoExtendLink}
          hiddenFields={{
            linkId: params.linkId,
            prev: typeof params.prev === "string" ? params.prev : "",
            prevStatus: typeof params.prevStatus === "string" ? params.prevStatus : "",
            back: "/candidates",
          }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */

function CandidateRow({
  row,
  now,
  scaleMax,
  locale,
  t,
}: {
  row: AssessmentRow;
  now: Date;
  scaleMax: number;
  locale: Locale;
  t: T;
}) {
  const state = pipelineState(row, now);
  const stageLabel =
    state === "NOT_STARTED"
      ? t("pipeline.NOT_STARTED")
      : state === "IN_PROGRESS"
        ? t("candidates.stageInProgress", {
            done: row.stagesCompleted,
            total: row.stagesTotal,
          })
        : t("candidates.stageCompleted", {
            done: row.stagesCompleted,
            total: row.stagesTotal,
          });

  const statusText =
    state === "NOT_STARTED" && row.linkExpiresAt
      ? t("candidates.linkExpiresIn", {
          time: remaining(row.linkExpiresAt, locale, now),
        })
      : t(`pipeline.${state}`);

  return (
    <tr className="border-b border-line last:border-b-0 hover:bg-canvas/60">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={row.candidateName} />
          <div className="min-w-0">
            <Link
              href={`/candidates/${row.candidateId}`}
              className="block truncate font-medium hover:underline"
            >
              {row.candidateName}
            </Link>
            <span className="block truncate text-[13px] text-muted">
              {row.candidateEmail ?? t("shared.noEmail")}
            </span>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-[13px] text-muted">{stageLabel}</td>
      <td className="px-5 py-3.5">
        <StatusDot tone={statusTone(state)}>{statusText}</StatusDot>
      </td>
      <td className="px-5 py-3.5">
        {row.overall === null ? (
          <span className="text-ink-3">-</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="tnum font-semibold">{formatScore(row.overall, locale)}</span>
            <ScoreBar value={row.overall} max={scaleMax} />
          </div>
        )}
      </td>
      <td className="px-5 py-3.5 text-[13px]">
        {row.decisionStatus ? (
          <span className="text-muted">{t(`decision.${row.decisionStatus}`)}</span>
        ) : state === "NOT_STARTED" || state === "IN_PROGRESS" ? (
          <span className="text-muted">-</span>
        ) : (
          <span className="text-muted">{t("decision.NEW")}</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right">
        {state === "NOT_STARTED" || state === "EXPIRED" ? (
          <form action={extendLink} className="inline">
            <input type="hidden" name="linkId" value={row.linkId ?? ""} />
            <input type="hidden" name="days" value="3" />
            <input type="hidden" name="back" value="/candidates" />
            <input type="hidden" name="candidateName" value={row.candidateName} />
            <Button type="submit" variant="secondary" size="sm">
              {state === "EXPIRED" ? t("candidates.reopen") : t("candidates.extend")}
            </Button>
          </form>
        ) : state === "IN_PROGRESS" ? (
          // The candidate is still recording. Opening the review screen now
          // would show a half-written answer and invite scoring it, so the
          // control is disabled until the stage is submitted. The reason is
          // already visible in this row's status cell, which is why it is
          // repeated for screen readers only rather than printed twice.
          <>
            <Button
              id={`review-${row.assessmentId}`}
              size="sm"
              variant="secondary"
              disabled
              disabledReason={t("candidates.recordingNow")}
            >
              {t("shared.review")}
            </Button>
            <DisabledReason id={`review-${row.assessmentId}-why`} className="sr-only">
              {t("candidates.recordingNowLong")}
            </DisabledReason>
          </>
        ) : (
          <Link
            href={
              state === "DECIDED" || state === "SCORED"
                ? `/candidates/${row.candidateId}`
                : `/candidates/${row.candidateId}/review?assessment=${row.assessmentId}`
            }
            className="rounded-[8px] border border-line px-3 py-1.5 text-[13px] hover:bg-canvas"
          >
            {state === "DECIDED" || state === "SCORED"
              ? t("shared.openRecord")
              : state === "PARTIALLY_SCORED"
                ? t("shared.continue")
                : t("shared.review")}
          </Link>
        )}
      </td>
    </tr>
  );
}

function statusTone(state: PipelineState) {
  if (state === "IN_PROGRESS") return "active" as const;
  if (state === "PARTIALLY_SCORED" || state === "EXPIRED") return "warn" as const;
  if (state === "DECIDED" || state === "SCORED") return "done" as const;
  return "neutral" as const;
}

/**
 * A zero-result filter is the classic dead end. Instead of an empty table this
 * names every active filter and offers to drop each one, with the number of
 * candidates that would come back.
 */
function ZeroResults({
  filters,
  active,
  rows,
  now,
  totalInPosition,
  t,
}: {
  filters: Filters;
  active: Array<{ key: keyof Filters; label: string }>;
  rows: AssessmentRow[];
  now: Date;
  totalInPosition: number;
  t: T;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[15px] font-medium">
        {filters.q
          ? t("candidates.zeroWithQuery", { query: filters.q })
          : t("candidates.zeroWithFilters")}
      </p>
      {active.length > 0 && (
        <p className="mt-1.5 text-[13px] text-muted">
          {t("candidates.activeFilters", {
            count: active.length,
            list: active.map((f) => f.label).join(" · "),
          })}
        </p>
      )}

      <div className="mx-auto mt-5 flex max-w-md flex-col items-stretch gap-2">
        {active.map((filter) => {
          const without = { ...filters, [filter.key]: "" } as Filters;
          const count = rows.filter((row) => matches(row, without, now)).length;
          return (
            <Link
              key={filter.key}
              href={withFilters(filters, { [filter.key]: "" })}
              className="flex items-center justify-between rounded-[10px] border border-line
                         px-4 py-2.5 text-[13px] hover:bg-canvas"
            >
              <span>{t("candidates.dropFilter", { label: filter.label })}</span>
              <span className="tnum text-muted">
                {t("candidates.resultCount", { count })}
              </span>
            </Link>
          );
        })}
        {active.length > 1 && (
          <Link
            href="/candidates"
            className="flex items-center justify-between rounded-[10px] border border-line
                       px-4 py-2.5 text-[13px] hover:bg-canvas"
          >
            <span>{t("candidates.clearFilters")}</span>
            <span className="tnum text-muted">
              {t("candidates.resultCount", { count: rows.length })}
            </span>
          </Link>
        )}
        {active.length === 0 && totalInPosition === 0 && (
          <p className="text-[13px] text-muted">{t("candidates.noneInvited")}</p>
        )}
        <Button asChild variant="primary" size="md">
          <Link href="/candidates/new" className="mt-2">
            {t("shared.inviteCandidate")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Select({
  name,
  value,
  label,
  children,
}: {
  name: string;
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      className="h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink"
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */

function matches(row: AssessmentRow, filters: Filters, now: Date): boolean {
  if (filters.position && row.positionId !== filters.position) return false;

  if (filters.q) {
    const needle = filters.q.toLocaleLowerCase("tr");
    const haystack = `${row.candidateName} ${row.candidateEmail ?? ""}`.toLocaleLowerCase("tr");
    if (!haystack.includes(needle)) return false;
  }

  if (filters.stage) {
    const min = Number(filters.stage);
    if (!Number.isNaN(min) && row.stagesCompleted < min) return false;
  }

  if (filters.score) {
    const min = Number(filters.score);
    if (!Number.isNaN(min) && (row.overall === null || row.overall < min)) return false;
  }

  const state = pipelineState(row, now);
  if (filters.tab === "review" && !needsReview(state)) return false;
  if (filters.tab === "progress" && state !== "IN_PROGRESS") return false;
  if (filters.tab === "decided" && state !== "DECIDED") return false;

  return true;
}

function activeFilters(
  filters: Filters,
  positionName: string | null,
  t: T,
  locale: Locale,
): Array<{ key: keyof Filters; label: string }> {
  const active: Array<{ key: keyof Filters; label: string }> = [];
  if (filters.q) {
    active.push({ key: "q", label: t("candidates.filterQuery", { query: filters.q }) });
  }
  if (filters.tab !== "all") {
    active.push({
      key: "tab",
      label: t(`candidates.${TAB_LABEL[filters.tab]}`),
    });
  }
  if (filters.position && positionName) {
    active.push({ key: "position", label: positionName });
  }
  if (filters.stage) {
    active.push({ key: "stage", label: t("candidates.filterStage", { n: filters.stage }) });
  }
  if (filters.score) {
    active.push({
      key: "score",
      label: t("candidates.filterScore", {
        n: locale === "tr" ? filters.score.replace(".", ",") : filters.score,
      }),
    });
  }
  return active;
}

function withFilters(current: Filters, changes: Partial<Record<keyof Filters, string>>) {
  const next = { ...current, ...changes };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.tab && next.tab !== "all") query.set("tab", next.tab);
  if (next.position) query.set("position", next.position);
  if (next.stage) query.set("stage", next.stage);
  if (next.score) query.set("score", next.score);
  const suffix = query.toString();
  return suffix ? `/candidates?${suffix}` : "/candidates";
}

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function asTab(value: string): Tab {
  return (TAB_KEYS as readonly string[]).includes(value) ? (value as Tab) : "all";
}
