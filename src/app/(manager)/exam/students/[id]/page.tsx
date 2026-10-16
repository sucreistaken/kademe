import Link from "next/link";
import { notFound } from "next/navigation";
import { finalize, overrideOverall, release, undoAcceptAsCorrect } from "@/app/(manager)/exam/students/[id]/actions";
import { Card } from "@/components/ui/card";
import { Dot, INTEGRITY_TONE, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import { GradingCard } from "@/components/panel/result/grading-card";
import { Highlighted } from "@/components/panel/result/format";
import { ObjectiveSection, isBankEmptySkip } from "@/components/panel/result/objective-section";
import { TaskPrompt } from "@/components/panel/result/task-prompt";
import { finalizeBlockers, finalizeChecklist } from "@/lib/exam/finalize-blockers";
import { objectiveBasis } from "@/components/panel/result/review-rows";
import { groupMarkers } from "@/components/panel/integrity/markers";
import { isNoiseType } from "@/components/panel/integrity/groups";
import { IntegrityPanel } from "@/components/panel/result/integrity-panel";
import { ExamRecordingPlayer } from "@/components/panel/result/recording-player";
import { SpeakingEvidence } from "@/components/panel/result/speaking-evidence";
import { reportAllowed } from "@/components/panel/report/model";
import { can } from "@/lib/authorize";
import { isObjectiveSection, CEFR_LEVELS, type Section } from "@/lib/exam/types";
import { listStudents, loadIntegrityView, loadResultView } from "@/server/panel";
import { loadRecordingSegments, recordingConsent } from "@/server/recordings";
import { loadAcceptances } from "@/server/result-review";
import { UndoStrip } from "@/components/ui/undo-strip";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/**
 * One student's result: the critical teacher screen. It answers "can I trust
 * this level, and will I sign it?". The decision line comes first, then each
 * skill with its evidence, and the one filled button (finalize, then show to
 * the student) sits in the rail and says what it is waiting for.
 */
export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  const sp = await searchParams;
  const view = await loadResultView(user.orgId, id);
  if (!view) notFound();
  const row = (await listStudents(user.orgId)).find((r) => r.assessmentId === id);
  const { assessment, candidate, attempt, result } = view;
  const cfg = assessment.blueprintSnapshot;
  const computed = result?.computed ?? null;
  const final = result?.status === "FINAL";
  const tab = sp.tab ?? "summary";
  const tabs = ["summary", ...view.sections, "integrity"];
  const ended = !!attempt?.completedAt || !!attempt?.terminatedAt;
  const canGrade = can(user, "result:grade") && ended;
  const canFinalize = can(user, "result:finalize");
  const overall = final ? result?.finalOverall : (computed?.overall ?? null);
  const outcome = final ? result?.finalOutcome : computed?.verification?.outcome;
  // Results stored before the placement detail existed have no `placement`.
  const placement = computed?.placement ?? null;

  const runFor = (s: string) => view.runs.find((r) => r.section === s);
  const responsesFor = (s: string) => {
    const run = runFor(s);
    return run ? view.responses.filter((r) => r.sectionRunId === run.id) : [];
  };

  // What the finalize button waits for: the same rules finalizeResult applies
  // (src/lib/exam/finalize-blockers.ts), so the page and the action cannot disagree.
  const blockers = finalizeBlockers(computed, ended);
  const sectionList = (list: Section[]) => list.map((s) => t(`sectionName.${s}`)).join(", ");
  const blockerLines = blockers.map((b) =>
    b.code === "RUNNING"
      ? t("result.finalizeRunning")
      : b.code === "GRADING"
        ? t("result.finalizeGrading")
        : b.code === "UNDECIDED"
          ? t("result.finalizeNeeds", { sections: sectionList(b.sections) })
          : t("result.errNotReady"),
  );
  const checklist = finalizeChecklist({
    sections: view.sections,
    computed,
    submitted: new Set(view.runs.filter((r) => r.submittedAt).map((r) => r.section)),
    tasks: Object.fromEntries(
      view.sections
        .filter((s) => !isObjectiveSection(s as Section))
        .map((s) => [
          s,
          responsesFor(s).flatMap((r) => {
            const g = view.gradings.find((x) => x.itemResponseId === r.id);
            return g ? [{ id: r.id, status: g.status, decided: !!g.finalLevel }] : [];
          }),
        ]),
    ),
  });
  const errorText = sp.error
    ? sp.error === "reason"
      ? t("result.reasonRequired")
      : sp.error === "running"
        ? t("result.errRunning")
        : sp.error === "invalid"
          ? t("result.errInvalid")
          : sp.error === "UNDECIDED"
            ? t("result.errUndecided")
            : t("result.errNotReady")
    : null;

  const acceptances = await loadAcceptances(user.orgId, tab !== "summary" && isObjectiveSection(tab as Section) ? responsesFor(tab).map((r) => r.id) : []);

  const integrity = tab === "integrity" && attempt ? await loadIntegrityView(attempt.id) : null;
  // The continuous recording, only for a role that may watch recordings.
  const canWatch = can(user, "media:view");
  const recording = integrity && attempt && canWatch ? await loadRecordingSegments(user.orgId, attempt.id) : null;
  // False when the student accepted a consent text that does not announce the recording: nothing was recorded.
  const consentCoversRecording = integrity ? await recordingConsent(assessment.id) : null;
  const sectionSpans = view.runs
    .filter((r) => r.startedAt)
    .map((r) => ({ section: r.section, start: r.startedAt!.getTime(), end: (r.submittedAt ?? new Date()).getTime() }));

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <Link href="/exam/students" className="text-[13px] text-muted hover:text-ink">
        {t("result.back")}
      </Link>

      {/* Decision line */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">{candidate.fullName}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {assessment.blueprintName} · {t(`mode.${assessment.mode}`)}
            {assessment.claimedLevel ? ` · ${t("mode.claimed", { level: assessment.claimedLevel })}` : ""} · {shortDateTime(attempt?.completedAt ?? null, locale)}
          </p>
        </div>
        <div className="flex items-end gap-8">
          <div>
            <div className="text-[12px] uppercase tracking-[0.04em] text-muted">{t("result.overall")}</div>
            <div className={cn("tnum text-[40px] font-bold leading-none", final ? "text-ink" : "text-ink-3")}>{overall ?? "-"}</div>
          </div>
          {assessment.mode === "PLACEMENT" && placement ? (
            <div className="max-w-[300px]">
              {placement.sublevel ? (
                <div className="tnum text-[14px] font-semibold text-ink">{t("result.sublevel", { sublevel: placement.sublevel })}</div>
              ) : null}
              {placement.borderline ? (
                <>
                  <div className="text-[13px] font-medium text-ink">{t("result.borderline")}</div>
                  {placement.recommended ? (
                    <div className="tnum text-[12.5px] text-muted">{t("result.recommendedClass", { level: placement.recommended })}</div>
                  ) : null}
                  <ul className="mt-0.5 text-[12.5px] text-muted">
                    {placement.reasons.map((r) => (
                      <li key={r}>
                        {r.startsWith("PRODUCTIVE_GAP:")
                          ? t("result.borderlinePRODUCTIVE_GAP", { section: t(`sectionName.${r.slice("PRODUCTIVE_GAP:".length) as Section}`) })
                          : t(`result.borderline${r as "NEAR_CUT" | "HIGH_UNCERTAINTY"}`)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
          {assessment.mode === "LEVEL_VERIFICATION" ? (
            <div className="max-w-[260px]">
              <div className={cn("text-[14px] font-semibold", final ? "text-ink" : "text-ink-3")}>
                {outcome ? `${final ? "" : `${t("result.preliminary")}: `}${t(`result.outcome${outcome}`)}` : "-"}
              </div>
              {computed?.verification?.holdProbability != null ? (
                <div className="tnum text-[12.5px] text-muted">
                  {t("result.hold", { p: Math.round(computed.verification.holdProbability * 100) })}
                </div>
              ) : null}
            </div>
          ) : null}
          {row ? <Dot tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</Dot> : null}
          {reportAllowed(result?.status) ? (
            <Link href={`/exam/students/${id}/report`} className="inline-flex h-9 items-center rounded-[8px] border border-line-strong px-3 text-[13px] font-medium text-ink hover:bg-canvas">
              {t("resultReport.button")}
            </Link>
          ) : (
            <span title={t("resultReport.buttonBlocked")} aria-disabled="true" className="inline-flex h-9 cursor-not-allowed items-center rounded-[8px] border border-line px-3 text-[13px] font-medium text-muted">
              {t("resultReport.button")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <nav className="mb-6 flex flex-wrap gap-1">
            {tabs.map((k) => (
              <Link
                key={k}
                href={`/exam/students/${id}?tab=${k}`}
                className={cn(
                  "rounded-[8px] px-3 py-1.5 text-[13.5px]",
                  k === tab ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {k === "summary" ? t("result.tabSummary") : k === "integrity" ? t("result.tabIntegrity") : t(`sectionName.${k as Section}`)}
              </Link>
            ))}
          </nav>

          {errorText ? (
            <p role="alert" className="mb-4 rounded-[10px] bg-danger-soft px-3 py-2 text-[13.5px] font-medium text-danger">
              {errorText}
            </p>
          ) : null}

          {tab === "summary" ? (
            <Card className="divide-y divide-line">
              {view.sections.map((s) => {
                const skill = computed?.skills[s as Section];
                const run = runFor(s);
                const rs = responsesFor(s);
                const basis = objectiveBasis(rs);
                const sd = run?.thetaSd ?? null;
                const precision = sd === null ? "" : sd < 0.45 ? t("result.precisionGood") : sd < 0.7 ? t("result.precisionFair") : t("result.precisionLow");
                const decider = skill?.decider;
                return (
                  <Link key={s} href={`/exam/students/${id}?tab=${s}`} className="grid grid-cols-[140px_60px_1fr] items-center gap-4 px-5 py-4 hover:bg-canvas">
                    <span className="text-[14px] font-semibold text-ink">{t(`sectionName.${s as Section}`)}</span>
                    <span className={cn("tnum text-[18px] font-bold", decider === "TEACHER" || decider === "ENGINE" ? "text-ink" : "text-ink-3")}>
                      {skill?.level ?? "-"}
                    </span>
                    <span className="text-[13px] text-muted">
                      {!run?.submittedAt
                        ? t("result.inProgress")
                        : isBankEmptySkip(run)
                          ? t("resultReview.skippedBankEmpty")
                          : isObjectiveSection(s as Section)
                          ? skill?.insufficient
                            ? t("result.insufficient")
                            : `${t("result.basis", { n: basis.answered, pct: basis.pct, precision })}${basis.partial > 0 ? ` · ${t("resultReview.partialCount", { n: basis.partial })}` : ""}`
                          : decider
                            ? t(`source.${decider}`)
                            : t("result.pending")}
                    </span>
                  </Link>
                );
              })}
            </Card>
          ) : null}

          {tab !== "summary" && tab !== "integrity" && isObjectiveSection(tab as Section) ? (
            isBankEmptySkip(runFor(tab)) ? (
              <Card className="p-5 text-[14px] text-ink-2">{t("resultReview.skippedBankEmpty")}</Card>
            ) : (
              <ObjectiveSection
                t={t}
                section={tab as Section}
                tab={tab}
                responses={responsesFor(tab)}
                run={runFor(tab)}
                acceptances={acceptances}
                canGrade={canGrade && !final}
                level={computed?.skills[tab as Section]?.level ?? null}
              />
            )
          ) : null}

          {sp.undo === "accept" && sp.response && canGrade && !final && acceptances[sp.response] ? (
            <UndoStrip message={t("resultReview.acceptedUndo")} action={undoAcceptAsCorrect} hiddenFields={{ responseId: sp.response, tab, ...(sp.gap ? { gapId: sp.gap } : {}) }} />
          ) : null}

          {tab === "WRITING" || tab === "SPEAKING" ? (
            <div className="flex flex-col gap-8">
              {responsesFor(tab).length === 0 ? <p className="text-[14px] text-muted">{t("result.inProgress")}</p> : null}
              {responsesFor(tab).map((r) => {
                const g = view.gradings.find((x) => x.itemResponseId === r.id);
                const quotes = g?.aiProposal?.criteria.flatMap((c) => c.evidence) ?? [];
                const media = view.media.find((m) => m.id === r.answer?.mediaAssetId);
                const tr = view.transcripts.find((x) => x.mediaAssetId === media?.id);
                return (
                  <section key={r.id} id={`t-${r.id}`} className="grid scroll-mt-6 gap-5 xl:grid-cols-[1fr_340px]">
                    <div className="min-w-0">
                      <TaskPrompt prompt={r.itemSnapshot.prompt} label={t("result.taskLevel", { level: r.itemSnapshot.level })} />
                      <div className="mt-4 rounded-[14px] border border-line bg-surface p-5">
                        {tab === "WRITING" || r.answer?.usedTextAlternative ? (
                          <>
                            {r.answer?.usedTextAlternative ? <p className="mb-2 text-[12.5px] text-muted">{t("result.typedAlternative")}</p> : null}
                            {r.answer?.text ? <Highlighted text={r.answer.text} quotes={quotes} /> : <p className="text-[14px] text-muted">{t("result.noAnswer")}</p>}
                            {r.answer?.text ? (
                              <p className="tnum mt-3 text-[12.5px] text-muted">{t("result.words", { n: r.answer.text.trim().split(/\s+/).filter(Boolean).length })}</p>
                            ) : null}
                          </>
                        ) : media && view.mediaUrls[media.id] ? (
                          <SpeakingEvidence src={view.mediaUrls[media.id]} words={tr?.words ?? []} text={tr?.text ?? ""} name={candidate.fullName ?? "transcript"} />
                        ) : (
                          <p className="text-[14px] text-muted">{t("result.noRecording")}</p>
                        )}
                      </div>
                    </div>
                    {g ? <GradingCard grading={g} t={t} tab={tab} canGrade={canGrade && !final} nameOf={view.nameOf} /> : null}
                  </section>
                );
              })}
            </div>
          ) : null}

          {tab === "integrity" && integrity && attempt ? (
            <IntegrityPanel
              t={t}
              view={integrity}
              summary={attempt.integritySummary ?? null}
              proctored={cfg.proctoring.preset !== "OFF"}
              assessmentId={id}
              outcome={attempt.integrityOutcome}
              canDecide={can(user, "integrity:decide")}
              startedAt={(attempt.startedAt ?? attempt.createdAt).getTime()}
              endedAt={(attempt.completedAt ?? new Date()).getTime()}
              sections={sectionSpans}
              hasRecording={!!recording?.segments.length}
              recording={
                recording?.segments.length ? (
                  <ExamRecordingPlayer
                    attemptId={attempt.id}
                    segments={recording.segments}
                    window={{ start: (attempt.startedAt ?? attempt.createdAt).getTime(), end: (attempt.completedAt ?? attempt.terminatedAt ?? new Date()).getTime() }}
                    sections={sectionSpans.map((s) => ({ key: s.section, label: t(`sectionName.${s.section as Section}`), start: s.start, end: s.end }))}
                    markers={groupMarkers(
                      integrity.events
                        .filter(({ event }) => event.severity !== "INFO" && !isNoiseType(event.type))
                        .map(({ event }) => ({ id: event.id, type: event.type, at: event.startedAt.getTime(), severity: event.severity as "HIGH" | "MEDIUM" | "LOW" })),
                    ).map((m) => ({
                      id: m.id,
                      label: t(`eventType.${m.type}` as "eventType.TAB_HIDDEN"),
                      at: m.at,
                      severity: m.severity,
                      count: m.count,
                    }))}
                    purgeOn={
                      recording.purgeAfter
                        ? recording.purgeAfter.toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: ORG_TIMEZONE })
                        : null
                    }
                  />
                ) : (
                  <p className="text-[12.5px] text-muted">
                    {consentCoversRecording === false
                      ? t("recordingSafety.oldConsent")
                      : canWatch
                        ? t("examRecording.empty")
                        : t("examRecording.noPermission")}
                  </p>
                )
              }
            />
          ) : null}
        </div>

        {/* Rail: the skills with their source, and the one action. */}
        <aside id="finalize" className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5 shadow-panel">
            <ul className="divide-y divide-line">
              {view.sections.map((s) => {
                const skill = computed?.skills[s as Section];
                const override = result?.skillOverrides?.[s];
                return (
                  <li key={s} className="flex items-baseline justify-between py-2">
                    <span className="text-[13.5px] text-ink-2">{t(`sectionName.${s as Section}`)}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-[11.5px] text-muted">{skill?.decider ? t(`source.${override ? "TEACHER" : skill.decider}`) : ""}</span>
                      <span className="tnum text-[15px] font-bold text-ink">{skill?.level ?? "-"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-[13.5px] font-semibold text-ink">{t("result.overall")}</span>
              <span className="tnum text-[20px] font-bold text-ink">{overall ?? "-"}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              {result?.overallOverride ? `${t("source.TEACHER")}: ${result.overallOverrideReason ?? ""}` : t("result.overallRule")}
            </p>

            <div className="mt-5">
              {final ? (
                <>
                  <p className="text-[13px] text-muted">{t("result.finalized", { date: shortDateTime(result?.finalizedAt ?? null, locale) })}</p>
                  {result?.releasedAt ? (
                    <p className="mt-1 text-[13px] text-muted">{t("result.released", { date: shortDateTime(result.releasedAt, locale) })}</p>
                  ) : cfg.resultVisibility === "NONE" ? (
                    <p className="mt-1 text-[13px] text-muted">{t("result.visibilityNone")}</p>
                  ) : attempt?.integrityOutcome === "INVALID" ? (
                    <p className="mt-1 text-[13px] text-muted">{t("result.errInvalid")}</p>
                  ) : canFinalize ? (
                    <form action={release} className="mt-3">
                      <input type="hidden" name="assessmentId" value={id} />
                      <button type="submit" className="h-11 w-full rounded-[10px] bg-accent text-[14.5px] font-semibold text-white hover:bg-accent-hover">
                        {t("result.release")}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Where the teacher is: one row per section, then the one next step. */}
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-[13.5px] font-semibold text-ink">{t("result.checklistTitle")}</h2>
                      <span className="tnum text-[12.5px] font-medium text-ink-2">{t("result.checklistProgress", { done: checklist.done, total: checklist.total })}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${checklist.total ? Math.round((checklist.done / checklist.total) * 100) : 0}%` }} />
                    </div>
                    <ul className="mt-3 flex flex-col gap-2">
                      {checklist.rows.map((row) => (
                        <li key={row.section} className={cn("rounded-[10px] px-3 py-2 text-[13px]", row.state === "done" ? "bg-success-soft" : "bg-canvas")}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-ink">{t(`sectionName.${row.section}`)}</span>
                            <span className={cn("text-right text-[12.5px]", row.state === "done" ? "font-medium text-success" : "text-ink-2")}>
                              {row.state === "done"
                                ? row.kind === "AUTO"
                                  ? t("result.checklistAuto")
                                  : t("result.checklistDone")
                                : row.state === "todo"
                                  ? t("result.checklistTodo")
                                  : row.state === "aiPending"
                                    ? t("result.checklistAi")
                                    : t("result.checklistRunning")}
                            </span>
                          </div>
                          {row.state === "todo" ? (
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="tnum text-[12px] text-muted">{row.total > 1 ? t("result.checklistTasks", { open: row.open, total: row.total }) : ""}</span>
                              <Link
                                href={`/exam/students/${id}?tab=${row.section}${row.firstOpenResponseId ? `#t-${row.firstOpenResponseId}` : ""}`}
                                className="text-[12.5px] font-semibold text-accent underline underline-offset-2"
                              >
                                {t("result.checklistGo")}
                              </Link>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {canFinalize ? (
                    <>
                  <form action={finalize}>
                    <input type="hidden" name="assessmentId" value={id} />
                    <button
                      type="submit"
                      disabled={blockers.length > 0}
                      aria-describedby="finalize-why"
                      className="h-11 w-full rounded-[10px] bg-accent text-[14.5px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                    >
                      {t("result.finalize")}
                    </button>
                  </form>
                  {/* The reason sits right under the button, and a failed press lands here too (?error=...#finalize). */}
                  <div id="finalize-why" className="mt-2 flex flex-col gap-1">
                    {errorText && sp.error !== "reason" ? (
                      <p role="alert" className="rounded-[10px] bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                        {errorText}
                      </p>
                    ) : null}
                    {blockerLines.length ? (
                      blockerLines.map((line) => (
                        <p key={line} className="text-[12.5px] text-ink-2">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-muted">{t("result.finalizeReady")}</p>
                    )}
                  </div>
                  {attempt?.completedAt ? (
                    <details className="mt-4" open={sp.error === "reason"}>
                      <summary className="cursor-pointer text-[12.5px] text-ink underline underline-offset-2">{t("result.overallChange")}</summary>
                      {sp.error === "reason" ? <p className="mt-2 text-[12.5px] font-medium text-danger">{t("result.reasonRequired")}</p> : null}
                      <form action={overrideOverall} className="mt-2 flex flex-col gap-2">
                        <input type="hidden" name="assessmentId" value={id} />
                        <select name="level" required defaultValue="" className="h-9 rounded-[8px] border border-line bg-surface px-2 text-[13.5px]">
                          <option value="" disabled>
                            {t("result.pickLevel")}
                          </option>
                          {CEFR_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <textarea name="reason" required minLength={3} rows={2} placeholder={t("result.reasonPlaceholder")} className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13px]" />
                        <button type="submit" className="h-9 rounded-[8px] border border-line-strong text-[13px] font-medium text-ink hover:bg-canvas">
                          {t("result.saveLevel")}
                        </button>
                      </form>
                    </details>
                  ) : null}
                    </>
                  ) : null}
                </>
              )}
            </div>

            {row ? (
              <div className="mt-5 border-t border-line pt-4">
                <Dot tone={INTEGRITY_TONE[row.integrity]}>{t("result.integrityLine", { level: t(`integrityLevel.${row.integrity}`) })}</Dot>
                {cfg.proctoring.preset !== "OFF" ? (
                  <Link href={`/exam/students/${id}?tab=integrity`} className="mt-1 block text-[12.5px] text-ink underline underline-offset-2">
                    {t("result.openIntegrity")}
                  </Link>
                ) : null}
              </div>
            ) : null}

            <details className="mt-5 border-t border-line pt-4">
              <summary className="cursor-pointer text-[12.5px] font-medium text-ink">{t("result.history")}</summary>
              <ul className="mt-2 flex flex-col gap-1.5 text-[12px] text-muted">
                {[...view.gradingRevs.map((r) => ({ at: r.at, who: r.changedBy, text: `${JSON.stringify(r.before?.level ?? "-")} → ${JSON.stringify(r.after?.level ?? "-")}: ${r.reason}` })),
                  ...view.resultRevs.map((r) => ({ at: r.at, who: r.changedBy, text: `${r.field}: ${r.after ?? ""}${r.reason ? ` (${r.reason})` : ""}` }))]
                  .sort((a, b) => b.at.getTime() - a.at.getTime())
                  .map((h, i) => (
                    <li key={i}>
                      <span className="tnum">{shortDateTime(h.at, locale)}</span> · {h.who ? view.nameOf[h.who] : "-"} · {h.text.replaceAll('"', "")}
                    </li>
                  ))}
                {view.gradingRevs.length + view.resultRevs.length === 0 ? <li>{t("result.historyEmpty")}</li> : null}
              </ul>
            </details>
          </Card>
        </aside>
      </div>
    </main>
  );
}
