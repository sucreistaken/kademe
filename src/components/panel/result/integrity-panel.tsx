import Link from "next/link";
import { decideFlag, setIntegrityOutcome } from "@/app/(manager)/exam/students/[id]/actions";
import { Dot, INTEGRITY_TONE } from "@/components/panel/bits";
import { decideFlagGroup } from "@/components/panel/integrity/group-action";
import { clockTime, summarizeFlags, warningCountOf, type FlagEvent, type FlagGroup } from "@/components/panel/integrity/groups";
import { groupMarkers } from "@/components/panel/integrity/markers";
import { FlagKeys } from "@/components/panel/result/flag-keys";
import type { loadIntegrityView } from "@/server/panel";
import type { IntegrityResult } from "@/lib/proctor/integrity";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";

type T = ReturnType<typeof managerT>;
type View = Awaited<ReturnType<typeof loadIntegrityView>>;
type Row = View["events"][number];

export const SEVERITY_STYLE = {
  HIGH: { chip: "bg-danger-soft text-danger", edge: "border-l-danger" },
  MEDIUM: { chip: "bg-warn-soft text-warn", edge: "border-l-warn" },
  LOW: { chip: "bg-subtle text-muted", edge: "border-l-line-strong" },
  INFO: { chip: "bg-subtle text-muted", edge: "border-l-line" },
} as const;

/** The raw rows as the pure grouping code wants them. */
export function toFlagEvents(rows: View["events"]): FlagEvent[] {
  return rows.map(({ event, review }) => ({
    id: event.id,
    type: event.type,
    severity: event.severity,
    startedAt: event.startedAt.getTime(),
    durationMs: event.durationMs,
    teacherStatus: event.teacherStatus,
    review: review ? { status: review.status, verdict: review.verdict } : null,
    warningCount: warningCountOf(event.meta),
  }));
}

/**
 * The integrity tab. Summary first ("3 serious, 2 medium"; no verdict words,
 * and "could not verify" is never presented as cheating), then one card per
 * flag type with its count, times, the AI's second look and the actions, then
 * the connection and system records folded away. Confirm and dismiss are equal
 * outline buttons; nothing here is final until the teacher says so.
 *
 * When the attempt has a continuous recording, its player (passed in as
 * `recording`) takes the place of the static timeline: it draws the same
 * sections and flags, and every flag group gets a link to its first moment.
 */
export function IntegrityPanel({
  t,
  view,
  summary,
  proctored,
  assessmentId,
  outcome,
  canDecide,
  startedAt,
  endedAt,
  sections,
  recording,
  hasRecording,
}: {
  t: T;
  view: View;
  summary: IntegrityResult | null;
  proctored: boolean;
  assessmentId: string;
  outcome: "VALID" | "RETAKE" | "INVALID" | null;
  canDecide: boolean;
  startedAt: number;
  endedAt: number;
  sections: Array<{ section: string; start: number; end: number }>;
  /** The recording player, or a line saying why there is none to watch. */
  recording?: React.ReactNode;
  hasRecording?: boolean;
}) {
  if (!proctored) return <p className="text-[14px] text-muted">{t("integrity.off")}</p>;
  const level = summary?.level ?? "CLEAR";
  const flat = toFlagEvents(view.events);
  const sum = summarizeFlags(flat);
  const rowById = new Map(view.events.map((r) => [r.event.id, r]));
  const reference = view.evidence.find((e) => e.trigger === "REFERENCE");
  const span = Math.max(1, endedAt - startedAt);
  const xPct = (ms: number) => `${Math.max(0, Math.min(100, ((ms - startedAt) / span) * 100))}%`;
  const env = (view.sessions[0]?.env ?? {}) as Record<string, unknown>;
  const coverage: string[] = [];
  if (summary?.coverageGaps.includes("MODEL_UNAVAILABLE")) coverage.push(t("integrity.modelDown"));
  else coverage.push(t("integrity.modelOn"));
  if (summary?.coverageGaps.includes("SHARE_UNVERIFIED")) coverage.push(t("integrity.shareUnverified"));
  if (env.isExtendedSupported === false) coverage.push(t("integrity.secondUnverifiable"));

  const headParts = [
    sum.serious > 0 ? t("integrityFlags.headSerious", { n: sum.serious }) : null,
    sum.medium > 0 ? t("integrityFlags.headMedium", { n: sum.medium }) : null,
    sum.low > 0 ? t("integrityFlags.headLow", { n: sum.low }) : null,
  ].filter((x): x is string => !!x);
  const headline = headParts.length ? headParts.join(", ") : t("integrityFlags.headNone");

  const staticMarkers = groupMarkers(
    sum.flags.flatMap((g) => g.eventIds.map((id) => rowById.get(id)!)).filter((r) => r.event.severity !== "INFO").map((r) => ({
      id: r.event.id,
      type: r.event.type,
      at: r.event.startedAt.getTime(),
      severity: r.event.severity as "HIGH" | "MEDIUM" | "LOW",
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[14px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[22px] font-bold tracking-[-0.01em] text-ink" data-testid="integrity-headline">
              {headline}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {[
                sum.settled > 0 ? t("integrityFlags.headSettled", { n: sum.settled }) : null,
                sum.technicalEvents > 0 ? t("integrityFlags.headTechnical", { n: sum.technicalEvents }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Link
            href={`/exam/students/${assessmentId}/integrity-report`}
            className="inline-flex h-9 items-center rounded-[8px] border border-line-strong px-3 text-[13px] font-medium text-ink hover:bg-canvas"
          >
            {t("integrityFlags.reportButton")}
          </Link>
        </div>
        <div className="mt-3">
          <Dot tone={INTEGRITY_TONE[level]} strong>
            {t(`integrityLevel.${level}`)}
          </Dot>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          {t("integrity.coverage")}: {coverage.join(" · ")}
        </p>
      </div>

      {hasRecording ? (
        recording
      ) : (
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink">{t("integrity.timeline")}</div>
          <div className="relative h-14 rounded-[10px] border border-line bg-surface">
            {sections.map((s) => (
              <div
                key={s.section}
                className="absolute top-0 h-full border-r border-line bg-canvas/60"
                style={{ left: xPct(s.start), width: `calc(${xPct(s.end)} - ${xPct(s.start)})` }}
              >
                <span className="absolute left-1 top-1 text-[10.5px] text-muted">{t(`sectionName.${s.section}` as "sectionName.GRAMMAR")}</span>
              </div>
            ))}
            {staticMarkers.map((m) => (
              <a
                key={m.id}
                href={`#group-${m.type}`}
                title={`${t(`eventType.${m.type}` as "eventType.TAB_HIDDEN")}${m.count > 1 ? ` ×${m.count}` : ""}`}
                className={cn(
                  "absolute bottom-1 w-[3px] rounded-full",
                  m.severity === "HIGH" ? "h-8 bg-danger" : m.severity === "MEDIUM" ? "h-5 bg-warn" : "h-3 bg-line-strong",
                )}
                style={{ left: xPct(m.at) }}
              />
            ))}
          </div>
          {recording ? <div className="mt-2">{recording}</div> : null}
        </div>
      )}

      {reference ? (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.urls[reference.id]} alt="" className="h-[90px] w-[120px] rounded-[8px] border border-line object-cover" />
          <p className="text-[13px] text-muted">{t("integrity.reference")}</p>
        </div>
      ) : null}

      <div className="text-[13px] font-semibold text-ink">{t("integrityFlags.flagsTitle")}</div>
      {sum.flags.length === 0 ? <p className="-mt-3 text-[13.5px] text-muted">{t("integrity.empty")}</p> : null}
      <FlagKeys />
      <ol className="-mt-3 flex flex-col gap-3">
        {sum.flags.map((g) => (
          <GroupCard key={g.type} g={g} t={t} view={view} rowById={rowById} assessmentId={assessmentId} canDecide={canDecide} hasRecording={!!hasRecording} />
        ))}
      </ol>

      {sum.technical.length > 0 ? (
        <details className="rounded-[14px] border border-line bg-surface px-5 py-3" data-testid="technical-events">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">{t("integrityFlags.technicalTitle", { n: sum.technicalEvents })}</summary>
          <p className="mt-2 text-[12.5px] text-muted">{t("integrityFlags.technicalHint")}</p>
          <ul className="mt-2 divide-y divide-line">
            {sum.technical.map((g) => (
              <li key={g.type} className="flex flex-wrap items-baseline justify-between gap-3 py-2 text-[13px]">
                <span className="text-ink-2">{t(`eventType.${g.type}` as "eventType.TAB_HIDDEN")}</span>
                <span className="tnum text-muted">
                  {t("integrityFlags.times", { n: g.count })} · {clockTime(g.first)} - {clockTime(g.last)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {canDecide ? (
        <div className="rounded-[14px] border border-line bg-surface p-5">
          <div className="text-[13px] font-semibold text-ink">{t("integrity.outcomeTitle")}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["VALID", "RETAKE", "INVALID"] as const).map((o) => (
              <form key={o} action={setIntegrityOutcome}>
                <input type="hidden" name="assessmentId" value={assessmentId} />
                <input type="hidden" name="outcome" value={o} />
                <button
                  type="submit"
                  aria-pressed={outcome === o}
                  className={cn(
                    "h-9 rounded-[8px] border px-4 text-[13.5px] font-medium",
                    outcome === o ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:bg-canvas",
                  )}
                >
                  {t(`integrity.outcome${o}`)}
                </button>
              </form>
            ))}
          </div>
          {outcome === "RETAKE" ? <p className="mt-2 text-[12.5px] text-muted">{t("integrity.retakeHint")}</p> : null}
          <p className="mt-3 text-[12px] text-muted">{t("integrity.keys")}</p>
        </div>
      ) : null}
    </div>
  );
}

function GroupCard({
  g,
  t,
  view,
  rowById,
  assessmentId,
  canDecide,
  hasRecording,
}: {
  g: FlagGroup;
  t: T;
  view: View;
  rowById: Map<string, Row>;
  assessmentId: string;
  canDecide: boolean;
  hasRecording: boolean;
}) {
  const style = SEVERITY_STYLE[g.severity];
  const frames = view.evidence.filter((e) => g.eventIds.includes(e.eventId ?? "")).slice(0, 3);
  const aiParts = [
    g.ai.CONFIRMED > 0 ? t("integrityFlags.aiConfirmed", { n: g.ai.CONFIRMED }) : null,
    g.ai.UNCLEAR > 0 ? t("integrityFlags.aiUnclear", { n: g.ai.UNCLEAR }) : null,
    g.ai.NOT_CONFIRMED > 0 ? t("integrityFlags.aiNotConfirmed", { n: g.ai.NOT_CONFIRMED }) : null,
    g.ai.pending > 0 ? t("integrityFlags.aiPending", { n: g.ai.pending }) : null,
  ].filter(Boolean);
  const states = [
    g.open > 0 ? t("integrityFlags.stateOpen", { n: g.open }) : null,
    g.confirmed > 0 ? t("integrityFlags.stateConfirmed", { n: g.confirmed }) : null,
    g.dismissed > 0 ? t("integrityFlags.stateDismissed", { n: g.dismissed }) : null,
  ].filter(Boolean);
  const firstRow = rowById.get(g.firstEventId)!;
  return (
    <li
      id={`group-${g.type}`}
      data-flag={g.type}
      data-severity={g.severity}
      className={cn("scroll-mt-24 rounded-[14px] border border-l-[5px] border-line bg-surface p-4 focus-within:border-line-strong", style.edge, g.settled && "opacity-70")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[15px] font-semibold text-ink">{t(`eventType.${g.type}` as "eventType.TAB_HIDDEN")}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", style.chip)}>{t(`integrity.severity${g.severity}`)}</span>
          <span className="tnum text-[13px] font-semibold text-ink-2">{t("integrityFlags.times", { n: g.count })}</span>
          {g.settled ? <span className="text-[12.5px] text-muted">{t("integrityFlags.settled")}</span> : null}
        </div>
        <span className="tnum text-[12.5px] text-muted">
          {g.count > 1 ? `${clockTime(g.first)} - ${clockTime(g.last)}` : clockTime(g.first)}
          {g.totalMs >= 1000 ? ` · ${t("integrityFlags.total", { s: Math.round(g.totalMs / 1000) })}` : ""}
        </span>
      </div>
      {aiParts.length ? (
        <p className="mt-1.5 text-[13px] text-ink-2">
          <span className="font-medium">{t("integrityFlags.aiLabel")}</span> {aiParts.join(", ")}
        </p>
      ) : null}
      {g.maxWarning !== null ? <p className="mt-1 text-[12.5px] text-muted">{t("integrityFlags.warnings", { n: g.maxWarning })}</p> : null}
      {frames.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {frames.map((f) => (
            <a key={f.id} href={view.urls[f.id]} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={view.urls[f.id]} alt={f.kind === "SCREEN_FRAME" ? t("integrity.screen") : t("integrity.webcam")} className="h-[72px] rounded-[6px] border border-line object-cover" />
            </a>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasRecording ? (
          <a href="#exam-recording" data-rec-at={firstRow.event.startedAt.getTime()} className="text-[13px] font-medium text-ink underline underline-offset-2">
            {t("examRecording.watch")}
          </a>
        ) : null}
        {canDecide && g.open > 0
          ? (["CONFIRMED", "DISMISSED"] as const).map((s) => (
              <form key={s} action={decideFlagGroup}>
                <input type="hidden" name="assessmentId" value={assessmentId} />
                <input type="hidden" name="type" value={g.type} />
                <input type="hidden" name="status" value={s} />
                <button
                  type="submit"
                  data-key={s === "CONFIRMED" ? "c" : "d"}
                  className="h-8 rounded-[8px] border border-line px-3 text-[12.5px] font-medium text-ink hover:bg-canvas"
                >
                  {g.count > 1 ? (s === "CONFIRMED" ? t("integrityFlags.confirmAll", { n: g.open }) : t("integrityFlags.dismissAll", { n: g.open })) : s === "CONFIRMED" ? t("integrity.confirm") : t("integrity.dismiss")}
                </button>
              </form>
            ))
          : null}
        {states.length ? <span className="text-[12.5px] text-muted">{states.join(" · ")}</span> : null}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[12.5px] font-medium text-ink-2">{t("integrityFlags.showEvents", { n: g.count })}</summary>
        <ol className="mt-2 divide-y divide-line">
          {g.eventIds.map((id) => {
            const { event, review } = rowById.get(id)!;
            return (
              <li key={id} id={`flag-${id}`} className="scroll-mt-24 flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0 text-[13px] text-ink-2">
                  <span className="tnum">
                    {event.startedAt.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul" })}
                    {event.durationMs ? ` · ${t("integrity.duration", { s: Math.round(event.durationMs / 1000) })}` : ""}
                  </span>
                  {event.severity !== g.severity ? <span className="ml-2 text-muted">{t(`integrity.severity${event.severity}`)}</span> : null}
                  {review ? (
                    <span className="ml-2 text-muted">
                      {review.verdict ? t(`integrity.ai${review.verdict}` as "integrity.aiUNCLEAR") : t(`integrity.ai${review.status}` as "integrity.aiQUEUED")}
                      {review.summary ? `: ${review.summary}` : ""}
                    </span>
                  ) : null}
                  {hasRecording ? (
                    <a href="#exam-recording" data-rec-at={event.startedAt.getTime()} className="ml-2 text-ink underline underline-offset-2">
                      {t("examRecording.watch")}
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {event.teacherStatus !== "OPEN" ? (
                    <span className="text-[12.5px] font-medium text-ink">{event.teacherStatus === "CONFIRMED" ? t("integrity.confirmed") : t("integrity.dismissed")}</span>
                  ) : null}
                  {canDecide
                    ? (["CONFIRMED", "DISMISSED"] as const).map((s) =>
                        event.teacherStatus === s ? null : (
                          <form key={s} action={decideFlag}>
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="status" value={s} />
                            <button type="submit" className="h-7 rounded-[8px] border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-canvas">
                              {s === "CONFIRMED" ? t("integrity.confirm") : t("integrity.dismiss")}
                            </button>
                          </form>
                        ),
                      )
                    : null}
                  {canDecide && event.teacherStatus !== "OPEN" ? (
                    <form action={decideFlag}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="status" value="OPEN" />
                      <button type="submit" className="text-[12px] text-muted underline underline-offset-2">
                        {t("result.reopen")}
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </details>
    </li>
  );
}
