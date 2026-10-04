import { decideFlag, setIntegrityOutcome } from "@/app/(manager)/exam/students/[id]/actions";
import { Dot, INTEGRITY_TONE } from "@/components/panel/bits";
import { FlagKeys } from "@/components/panel/result/flag-keys";
import type { loadIntegrityView } from "@/server/panel";
import type { IntegrityResult } from "@/lib/proctor/integrity";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";

type T = ReturnType<typeof managerT>;
type View = Awaited<ReturnType<typeof loadIntegrityView>>;

/**
 * The integrity tab. Summary line first (no verdict words, and "could not
 * verify" is never presented as cheating), then the timeline, then the flags
 * that deserve a look, each with the frames around it and the AI's factual
 * note. Confirm and dismiss are equal outline buttons; nothing here is final
 * until the teacher says so.
 */
export function IntegrityPanel({
  t,
  view,
  summary,
  proctored,
  assessmentId,
  outcome,
  canDecide,
  showAll,
  startedAt,
  endedAt,
  sections,
}: {
  t: T;
  view: View;
  summary: IntegrityResult | null;
  proctored: boolean;
  assessmentId: string;
  outcome: "VALID" | "RETAKE" | "INVALID" | null;
  canDecide: boolean;
  showAll: boolean;
  startedAt: number;
  endedAt: number;
  sections: Array<{ section: string; start: number; end: number }>;
}) {
  if (!proctored) return <p className="text-[14px] text-muted">{t("integrity.off")}</p>;
  const level = summary?.level ?? "CLEAR";
  const shown = view.events.filter(({ event }) =>
    showAll ? true : event.teacherStatus !== "OPEN" || event.severity === "HIGH" || event.severity === "MEDIUM",
  );
  const flagged = shown.filter(({ event }) => event.type !== "RESUMED");
  const reference = view.evidence.find((e) => e.trigger === "REFERENCE");
  const span = Math.max(1, endedAt - startedAt);
  const xPct = (ms: number) => `${Math.max(0, Math.min(100, ((ms - startedAt) / span) * 100))}%`;
  const env = (view.sessions[0]?.env ?? {}) as Record<string, unknown>;
  const coverage: string[] = [];
  if (summary?.coverageGaps.includes("MODEL_UNAVAILABLE")) coverage.push(t("integrity.modelDown"));
  else coverage.push(t("integrity.modelOn"));
  if (summary?.coverageGaps.includes("SHARE_UNVERIFIED")) coverage.push(t("integrity.shareUnverified"));
  if (env.isExtendedSupported === false) coverage.push(t("integrity.secondUnverifiable"));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[14px] border border-line bg-surface p-5">
        <Dot tone={INTEGRITY_TONE[level]} strong>
          {t(`integrityLevel.${level}`)}
        </Dot>
        {summary?.reasons.length ? (
          <p className="mt-2 text-[13.5px] text-ink-2">
            {summary.reasons.map((r) => `${t(`eventType.${r.type}` as "eventType.TAB_HIDDEN")} (${r.count})`).join(" · ")}
          </p>
        ) : null}
        <p className="mt-1 text-[12.5px] text-muted">
          {t("integrity.coverage")}: {coverage.join(" · ")}
        </p>
      </div>

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
          {view.events
            .filter(({ event }) => event.severity !== "INFO")
            .map(({ event }) => (
              <a
                key={event.id}
                href={`#flag-${event.id}`}
                title={t(`eventType.${event.type}` as "eventType.TAB_HIDDEN")}
                className={cn(
                  "absolute bottom-1 w-[3px] rounded-full",
                  event.severity === "HIGH" ? "h-8 bg-ink" : event.severity === "MEDIUM" ? "h-5 bg-ink-3" : "h-3 bg-line-strong",
                )}
                style={{ left: xPct(event.startedAt.getTime()) }}
              />
            ))}
        </div>
      </div>

      {reference ? (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.urls[reference.id]} alt="" className="h-[90px] w-[120px] rounded-[8px] border border-line object-cover" />
          <p className="text-[13px] text-muted">{t("integrity.reference")}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-ink">{showAll ? t("integrity.showAll") : t("integrity.filterOpen")}</div>
        <a href={`?tab=integrity${showAll ? "" : "&show=all"}`} className="text-[13px] text-ink underline underline-offset-2">
          {showAll ? t("integrity.filterOpen") : t("integrity.showAll")}
        </a>
      </div>
      {flagged.length === 0 ? <p className="text-[13.5px] text-muted">{t("integrity.empty")}</p> : null}
      <FlagKeys />
      <ol className="flex flex-col gap-3">
        {flagged.map(({ event, review }) => {
          const frames = view.evidence.filter((e) => e.eventId === event.id).slice(0, 4);
          return (
            <li key={event.id} id={`flag-${event.id}`} data-flag={event.id} className="scroll-mt-24 rounded-[14px] border border-line bg-surface p-4 focus-within:border-line-strong">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-[14px] font-semibold text-ink">{t(`eventType.${event.type}` as "eventType.TAB_HIDDEN")}</span>
                <span className="tnum text-[12.5px] text-muted">
                  {event.startedAt.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul" })}
                  {event.durationMs ? ` · ${t("integrity.duration", { s: Math.round(event.durationMs / 1000) })}` : ""}
                  {" · "}
                  {t(`integrity.severity${event.severity}` as "integrity.severityHIGH")}
                </span>
              </div>
              {frames.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {frames.map((f) => (
                    <a key={f.id} href={view.urls[f.id]} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={view.urls[f.id]} alt={f.kind === "SCREEN_FRAME" ? t("integrity.screen") : t("integrity.webcam")} className="h-[96px] rounded-[6px] border border-line object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
              {review ? (
                <p className="mt-2 text-[13px] text-ink-2">
                  <span className="font-medium">
                    {review.verdict ? t(`integrity.ai${review.verdict}` as "integrity.aiUNCLEAR") : t(`integrity.ai${review.status}` as "integrity.aiQUEUED")}
                  </span>
                  {review.summary ? `: ${review.summary}` : ""}
                </p>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                {event.teacherStatus !== "OPEN" ? (
                  <span className="text-[12.5px] font-medium text-ink">
                    {event.teacherStatus === "CONFIRMED" ? t("integrity.confirmed") : t("integrity.dismissed")}
                  </span>
                ) : null}
                {canDecide ? (
                  <>
                    {(["CONFIRMED", "DISMISSED"] as const).map((s) =>
                      event.teacherStatus === s ? null : (
                        <form key={s} action={decideFlag}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="status" value={s} />
                          <input type="hidden" name="show" value={showAll ? "all" : ""} />
                          <button
                            type="submit"
                            data-key={s === "CONFIRMED" ? "c" : "d"}
                            className="h-8 rounded-[8px] border border-line px-3 text-[12.5px] font-medium text-ink hover:bg-canvas"
                          >
                            {s === "CONFIRMED" ? t("integrity.confirm") : t("integrity.dismiss")}
                          </button>
                        </form>
                      ),
                    )}
                    {event.teacherStatus !== "OPEN" ? (
                      <form action={decideFlag}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="status" value="OPEN" />
                        <button type="submit" className="text-[12.5px] text-muted underline underline-offset-2">
                          {t("result.reopen")}
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

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
