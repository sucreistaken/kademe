import Link from "next/link";
import { finalize, release, undoAcceptAsCorrect } from "@/app/(manager)/exam/students/[id]/actions";
import { Dot, INTEGRITY_TONE, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import { isNoiseType } from "@/components/panel/integrity/groups";
import { groupMarkers } from "@/components/panel/integrity/markers";
import { reportAllowed } from "@/components/panel/report/model";
import { ExamFeedbackBox } from "@/components/panel/result/exam-feedback-box";
import { IntegrityPanel } from "@/components/panel/result/integrity-panel";
import { ObjectiveSection, isBankEmptySkip } from "@/components/panel/result/objective-section";
import { ExamRecordingPlayer } from "@/components/panel/result/recording-player";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { UndoStrip } from "@/components/ui/undo-strip";
import { managerT } from "@/i18n/manager";
import type { PanelLocale } from "@/i18n/locale";
import { can } from "@/lib/authorize";
import { cn } from "@/lib/cn";
import { COURSE_TESTS } from "@/lib/exam/course/catalog";
import { SPEAKING_MAX, type CourseKey } from "@/lib/exam/course/types";
import { isObjectiveSection, type Section } from "@/lib/exam/types";
import { intlTag } from "@/lib/format";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import type { SessionUser } from "@/lib/auth";
import { loadIntegrityView, type loadResultView, type StudentRow } from "@/server/panel";
import { loadRecordingSegments, recordingConsent } from "@/server/recordings";
import { loadAcceptances } from "@/server/result-review";
import type { StoredFeedback } from "@/server/exam-feedback";
import { isProblemArea, splitProblemMessage } from "@/lib/exam/problem-reports";
import type { listProblemReports } from "@/server/problem-reports";
import { OutcomeCard, SheetCard } from "./sheet-cards";
import { SpeakingBlock } from "./speaking-block";
import { WritingBlock } from "./writing-block";
import { courseOutcomeOverrideOf, effectiveCourseOutcome } from "./outcome";
import { courseBlockers, courseChecklist, courseHistory, courseThresholds, percentText, sheetRows, taskTotals, type SheetRow } from "./model";
import { isDecidedStatus, type CourseGradingStatus } from "./grading-model";
import type { PanelGrading } from "./grading-panel";

type View = NonNullable<Awaited<ReturnType<typeof loadResultView>>>;

/**
 * One student's course test result (spec 2026-10-28): Halil Bey's
 * Bewertungsbogen as a screen. The sheet tab holds the section table and the
 * Einstufung with its Empfehlung; Schreiben and Sprechen hold the answers with
 * the AI's proposal and the rubric pickers; the other sections open the same
 * question-by-question review the level exams have. The rail keeps the
 * checklist and the one filled button (finalize, then release) in reach from
 * every tab. The other exam modes keep the page in `students/[id]/page.tsx`.
 */
export async function CourseResultPage({
  user,
  locale,
  view,
  row,
  problems,
  feedback,
  sp,
  id,
}: {
  user: SessionUser;
  locale: PanelLocale;
  view: View;
  row: StudentRow | undefined;
  problems: Awaited<ReturnType<typeof listProblemReports>>;
  feedback: StoredFeedback | null;
  sp: Record<string, string | undefined>;
  id: string;
}) {
  const t = managerT(locale);
  const { assessment, candidate, attempt, result } = view;
  const cfg = assessment.blueprintSnapshot;
  const computed = result?.computed ?? null;
  const course = computed?.course ?? null;
  const key: CourseKey | null = cfg.course?.key ?? course?.key ?? null;
  if (!key) {
    return (
      <main className="mx-auto max-w-[1360px] px-6 py-8">
        <Link href="/exam/students" className="text-[13px] text-muted hover:text-ink">
          {t("result.back")}
        </Link>
        <p className="mt-6 text-[14px] text-ink-2">{t("result.errNotReady")}</p>
      </main>
    );
  }

  const final = result?.status === "FINAL";
  const ended = !!attempt?.completedAt || !!attempt?.terminatedAt;
  const canGrade = can(user, "result:grade") && ended;
  const canFinalize = can(user, "result:finalize");
  const tab = sp.tab ?? "summary";
  const tabs = ["summary", ...view.sections, "integrity"];
  const form = course?.form ?? cfg.course?.form ?? null;
  const courseName = `${t(`courseInvite.kind${COURSE_TESTS[key].kind}`)} ${key}`;

  // The outcome as it stands: the frozen one once final, else the teacher's decision, else the engine's.
  const override = courseOutcomeOverrideOf(result?.skillOverrides);
  const frozen = result?.finalOutcome === "PASS" || result?.finalOutcome === "FAIL" ? result.finalOutcome : null;
  const outcome = (final ? frozen : null) ?? effectiveCourseOutcome(course, override);
  const rows = sheetRows(view.sections, course, key);
  const pctText = course?.pct != null ? percentText(course.pct, locale) : null;
  const totalMax = course?.max ?? rows.reduce((sum, r) => sum + r.max, 0);
  const speakingMax = rows.find((r) => r.section === "SPEAKING")?.max ?? SPEAKING_MAX;
  const thresholds = courseThresholds(cfg.course?.rules ?? { passPct: 0, secondHalfPct: null, firstHalfPct: null, speakingMinPct: null, writingContentZeroFails: false }, totalMax, speakingMax);

  const runFor = (s: string) => view.runs.find((r) => r.section === s);
  const responsesFor = (s: string) => {
    const run = runFor(s);
    return run ? view.responses.filter((r) => r.sectionRunId === run.id) : [];
  };
  const gradingOf = (responseId: string): PanelGrading | null => {
    const g = view.gradings.find((x) => x.itemResponseId === responseId);
    return g
      ? { id: g.id, status: g.status, courseProposal: g.courseProposal ?? null, coursePoints: g.coursePoints ?? null, aiError: g.aiError, reason: g.reason, decidedBy: g.decidedBy, updatedAt: g.updatedAt }
      : null;
  };
  const tasksOf = (s: string) => responsesFor(s).flatMap((r) => (gradingOf(r.id) ? [{ id: r.id, grading: gradingOf(r.id)! }] : []));

  const productive = view.sections.filter((s) => !isObjectiveSection(s as Section));
  const checklist = courseChecklist({
    sections: view.sections,
    submitted: new Set(view.runs.filter((r) => r.submittedAt).map((r) => r.section)),
    tasks: Object.fromEntries(productive.map((s) => [s, tasksOf(s).map((x) => ({ id: x.id, status: x.grading.status as CourseGradingStatus }))])),
  });
  const open = checklist.rows.reduce((sum, r) => sum + r.open, 0);
  const blockers = courseBlockers({ ended, hasResult: !!course, open, outcome });
  const blockerLines = blockers.map((b) => (b === "RUNNING" ? t("result.finalizeRunning") : b === "UNDECIDED" ? "" : t("result.errNotReady"))).filter(Boolean);
  const waitingLines = checklist.rows
    .filter((r) => r.kind === "TEACHER" && r.state === "todo")
    .map((r) => t(r.open === 1 ? "result.finalizeWaitingOne" : "result.finalizeWaiting", { section: t(`courseResult.section${r.section}`), n: r.open }));

  const errors: Record<string, string> = {
    reason: t("result.reasonRequired"),
    points: t("courseResult.errPoints"),
    changed: t("courseResult.errChanged"),
    open: t("courseResult.errOpen"),
    errors: t("courseResult.errCommonErrors"),
    undecided: t("courseResult.errUndecided"),
    running: t("result.errRunning"),
    invalid: t("result.errInvalid"),
    UNDECIDED: t("result.errUndecided"),
    NOT_READY: t("result.errNotReady"),
  };
  const errorText = sp.error ? (errors[sp.error] ?? t("result.errNotReady")) : null;

  // The Sheet tab says what each section's points rest on.
  const decidedPoints = (s: string) => tasksOf(s).map((x) => (isDecidedStatus(x.grading.status) ? x.grading.coursePoints : null));
  const remark = (r: SheetRow) => {
    if (!runFor(r.section)?.submittedAt) return t("result.inProgress");
    if (isObjectiveSection(r.section)) return r.pending ? "" : t("courseResult.remarkAuto");
    const decided = decidedPoints(r.section);
    if (decided.length === 0 || decided.some((p) => p === null)) return t("courseResult.remarkWaiting");
    if (r.section === "WRITING") {
      const p = decided[0]!.points;
      return t("courseResult.remarkWriting", { content: p.INHALT ?? "-", vocab: p.WORTSCHATZ ?? "-", grammar: p.GRAMMATIK ?? "-" });
    }
    return t("courseResult.remarkSpeaking", {
      tasks: taskTotals(tasksOf(r.section).map((x) => ({ status: x.grading.status as CourseGradingStatus, points: x.grading.coursePoints?.points ?? null }))).join(" · "),
    });
  };

  // Objective tabs: the question-by-question review the level exams use.
  const acceptanceSections = isObjectiveSection(tab as Section) ? [tab] : [];
  const acceptances = await loadAcceptances(user.orgId, acceptanceSections.flatMap((s) => responsesFor(s).map((r) => r.id)));
  const integrity = tab === "integrity" && attempt ? await loadIntegrityView(attempt.id) : null;
  const canWatch = can(user, "media:view");
  const recording = integrity && attempt && canWatch ? await loadRecordingSegments(user.orgId, attempt.id) : null;
  const consentCoversRecording = integrity ? await recordingConsent(assessment.id) : null;
  const sectionSpans = view.runs
    .filter((r) => r.startedAt)
    .map((r) => ({ section: r.section, start: r.startedAt!.getTime(), end: (r.submittedAt ?? new Date()).getTime() }));

  const history = courseHistory(view.gradingRevs, view.resultRevs);
  const who = (userId: string | null) => (userId ? (view.nameOf[userId] ?? "-") : "-");
  const historyText = (h: (typeof history)[number]) =>
    h.kind === "points"
      ? t("courseResult.historyPoints", { from: h.from ?? "-", to: h.to, reason: h.reason })
      : h.kind === "errors"
        ? t("courseResult.historyErrors", { count: h.count })
        : h.kind === "outcome"
          ? t("courseResult.historyOutcome", {
              from: h.from === "PASS" || h.from === "FAIL" ? t(`courseResult.outcome${h.from}`) : "-",
              to: h.to === "PASS" || h.to === "FAIL" ? t(`courseResult.outcome${h.to}`) : h.to,
              reason: h.reason,
            })
          : h.text;

  const speakingRow = rows.find((r) => r.section === "SPEAKING");

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <Link href="/exam/students" className="text-[13px] text-muted hover:text-ink">
        {t("result.back")}
      </Link>

      {/* Decision line */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <h1 className="text-headline text-ink">{candidate.fullName}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {courseName}
            {form ? ` · ${t("courseStudents.form", { form })}` : ""} · {shortDateTime(attempt?.completedAt ?? null, locale)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-8">
          <div>
            <div className="text-[12px] uppercase tracking-[0.04em] text-muted">{t("courseResult.outcomeLabel")}</div>
            <div className={cn("text-[26px] font-bold leading-tight", final ? "text-ink" : "text-ink-3")}>
              {outcome ? `${final ? "" : `${t("result.preliminary")}: `}${t(`courseResult.outcome${outcome}`)}` : "-"}
            </div>
            {course?.total != null ? (
              <div className="tnum mt-1 text-[13px] text-ink-2">{t("courseResult.pointsAndPct", { points: course.total, max: totalMax, pct: pctText ?? "" })}</div>
            ) : null}
          </div>
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

      {problems.length ? (
        <section id="problems" aria-labelledby="problems-title" className="mt-6 scroll-mt-6">
          <h2 id="problems-title" className="mb-2.5 text-[12px] font-semibold tracking-[0.07em] text-muted uppercase">
            {t("result.problemsTitle")} ({problems.length})
          </h2>
          <Card className="divide-y divide-line">
            {problems.map((report) => {
              const { area, note } = splitProblemMessage(report.message);
              return (
                <div key={report.id} className="px-5 py-3.5">
                  <p className="text-[12.5px] text-muted">
                    <span className="tnum">{shortDateTime(report.createdAt, locale)}</span>
                    {area ? ` · ${isProblemArea(area) ? t(`result.problemArea${area}`) : area}` : ""}
                  </p>
                  <p className="mt-0.5 text-[14px] leading-[1.55] whitespace-pre-line text-ink">{note || t("result.problemNoText")}</p>
                </div>
              );
            })}
          </Card>
        </section>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <nav className="mb-6 flex flex-wrap gap-1">
            {tabs.map((k) => (
              <Link
                key={k}
                href={`/exam/students/${id}?tab=${k}`}
                className={cn("rounded-[8px] px-3 py-1.5 text-[13.5px]", k === tab ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-canvas hover:text-ink")}
              >
                {k === "summary" ? t("courseResult.tabSheet") : k === "integrity" ? t("result.tabIntegrity") : t(`courseResult.section${k as Section}`)}
              </Link>
            ))}
          </nav>

          {errorText ? (
            <Notice role="alert" className="mb-4">
              {errorText}
            </Notice>
          ) : null}

          {tab === "summary" ? (
            <div className="flex flex-col gap-6">
              <SheetCard t={t} assessmentId={id} rows={rows} total={course?.total ?? null} max={totalMax} pctText={pctText} remark={remark} />
              <OutcomeCard
                t={t}
                assessmentId={id}
                course={course}
                outcome={outcome}
                final={final}
                override={override}
                overrideName={who(override?.userId ?? null)}
                thresholds={thresholds}
                speaking={{ points: speakingRow?.points ?? null, max: speakingMax }}
                max={totalMax}
                pctText={pctText}
                canOverride={canFinalize && !final && ended}
                reasonMissing={sp.error === "reason"}
              />
              {feedback ? <ExamFeedbackBox feedback={feedback} locale={locale} t={t} /> : null}
            </div>
          ) : null}

          {isObjectiveSection(tab as Section) ? (
            isBankEmptySkip(runFor(tab)) ? (
              <Card className="p-5 text-[14px] text-ink-2">{t("resultReview.skippedBankEmpty")}</Card>
            ) : (
              <ObjectiveSection t={t} section={tab as Section} tab={tab} responses={responsesFor(tab)} run={runFor(tab)} acceptances={acceptances} canGrade={canGrade && !final} level={null} />
            )
          ) : null}

          {sp.undo === "accept" && sp.response && canGrade && !final && acceptances[sp.response] ? (
            <UndoStrip message={t("resultReview.acceptedUndo")} action={undoAcceptAsCorrect} hiddenFields={{ responseId: sp.response, tab, ...(sp.gap ? { gapId: sp.gap } : {}) }} />
          ) : null}

          {tab === "WRITING" || tab === "SPEAKING" ? (
            <div className="flex flex-col gap-8">
              {tab === "SPEAKING" ? (
                <p className="tnum text-[14px] font-semibold text-ink">
                  {speakingRow && !speakingRow.pending
                    ? t("courseResult.speakingSummary", { points: speakingRow.points ?? 0, max: speakingMax })
                    : t("courseResult.speakingSummaryPending")}
                </p>
              ) : null}
              {responsesFor(tab).length === 0 ? <p className="text-[14px] text-muted">{runFor(tab)?.submittedAt ? t("courseResult.noTasks") : t("result.inProgress")}</p> : null}
              {responsesFor(tab).map((r, i, all) => {
                const grading = gradingOf(r.id);
                if (tab === "WRITING") return <WritingBlock key={r.id} t={t} response={r} grading={grading} tab={tab} canGrade={canGrade && !final} nameOf={view.nameOf} />;
                const media = view.media.find((m) => m.id === r.answer?.mediaAssetId);
                const transcript = view.transcripts.find((x) => x.mediaAssetId === media?.id);
                const src = media ? view.mediaUrls[media.id] : undefined;
                return (
                  <SpeakingBlock
                    key={r.id}
                    t={t}
                    response={r}
                    grading={grading}
                    tab={tab}
                    canGrade={canGrade && !final}
                    nameOf={view.nameOf}
                    index={i + 1}
                    total={all.length}
                    studentName={candidate.fullName ?? "transcript"}
                    recording={src ? { src, words: transcript?.words ?? [], text: transcript?.text ?? "", noSpeech: !!transcript && !transcript.text.trim() } : null}
                  />
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
                    sections={sectionSpans.map((s) => ({ key: s.section, label: t(`courseResult.section${s.section as Section}`), start: s.start, end: s.end }))}
                    markers={groupMarkers(
                      integrity.events
                        .filter(({ event }) => event.severity !== "INFO" && !isNoiseType(event.type))
                        .map(({ event }) => ({ id: event.id, type: event.type, at: event.startedAt.getTime(), severity: event.severity as "HIGH" | "MEDIUM" | "LOW" })),
                    ).map((m) => ({ id: m.id, label: t(`eventType.${m.type}` as "eventType.TAB_HIDDEN"), at: m.at, severity: m.severity, count: m.count }))}
                    purgeOn={
                      recording.purgeAfter
                        ? recording.purgeAfter.toLocaleDateString(intlTag(locale), { day: "numeric", month: "long", year: "numeric", timeZone: ORG_TIMEZONE })
                        : null
                    }
                  />
                ) : (
                  <p className="text-[12.5px] text-muted">
                    {consentCoversRecording === false ? t("recordingSafety.oldConsent") : canWatch ? t("examRecording.empty") : t("examRecording.noPermission")}
                  </p>
                )
              }
            />
          ) : null}
        </div>

        {/* Rail: the points of each part, where the teacher is, and the one action. */}
        <aside id="finalize" className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5 shadow-panel">
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.section} className="flex items-baseline justify-between py-2">
                  <span className="text-[13.5px] text-ink-2">{t(`courseResult.section${r.section}`)}</span>
                  <span className="tnum text-[15px] font-bold text-ink">
                    {r.pending ? "-" : r.points}
                    <span className="text-[12.5px] font-medium text-muted"> / {r.max}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-[13.5px] font-semibold text-ink">{t("courseResult.totalRow")}</span>
              <span className="tnum text-[20px] font-bold text-ink">
                {course?.total ?? "-"}
                <span className="text-[13px] font-medium text-muted"> / {totalMax}</span>
              </span>
            </div>

            <div className="mt-5">
              {final ? (
                <>
                  <p className="text-[13px] text-muted">{t("result.finalized", { date: shortDateTime(result?.finalizedAt ?? null, locale) })}</p>
                  {result?.releasedAt ? (
                    <p className="mt-1 text-[13px] text-muted">{t("result.released", { date: shortDateTime(result.releasedAt, locale) })}</p>
                  ) : attempt?.integrityOutcome === "INVALID" ? (
                    <p className="mt-1 text-[13px] text-muted">{t("result.errInvalid")}</p>
                  ) : canFinalize ? (
                    <form action={release} className="mt-3">
                      <input type="hidden" name="assessmentId" value={id} />
                      {/* A course test shows the student its result (Bestanden or not, the points); there is no CEFR level to hide. */}
                      <input type="hidden" name="levelShown" value="on" />
                      <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 w-full")}>
                        {t("result.release")}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-[13.5px] font-semibold text-ink">{t("result.checklistTitle")}</h2>
                      <span className="tnum text-[12.5px] font-medium text-ink-2">{t("result.checklistProgress", { done: checklist.done, total: checklist.total })}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${checklist.total ? Math.round((checklist.done / checklist.total) * 100) : 0}%` }} />
                    </div>
                    <ul className="mt-3 flex flex-col gap-2">
                      {checklist.rows.map((r) => {
                        const href = `/exam/students/${id}?tab=${r.section}${r.firstOpenResponseId ? `#t-${r.firstOpenResponseId}` : ""}`;
                        const actionable = r.state === "todo" || r.state === "aiPending";
                        return (
                          <li key={r.section}>
                            <Link
                              href={href}
                              className={cn(
                                "block rounded-[10px] px-3 py-2 text-[13px] transition-colors",
                                r.state === "done" ? "bg-success-soft hover:brightness-[0.98]" : "bg-canvas hover:bg-line",
                                r.section === tab && "ring-2 ring-accent",
                              )}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-semibold text-ink">{t(`courseResult.section${r.section}`)}</span>
                                <span className={cn("text-right text-[12.5px]", r.state === "done" ? "font-medium text-success" : "text-ink-2")}>
                                  {r.state === "done"
                                    ? r.kind === "AUTO"
                                      ? t("result.checklistAuto")
                                      : t("result.checklistDone")
                                    : r.state === "todo"
                                      ? t("result.checklistTodo")
                                      : r.state === "aiPending"
                                        ? t("result.checklistAi")
                                        : t("result.checklistRunning")}
                                </span>
                              </div>
                              {actionable ? (
                                <div className="mt-1 flex items-baseline justify-between gap-2">
                                  <span className="tnum text-[12px] text-muted">{r.total > 1 ? t("result.checklistTasks", { open: r.open, total: r.total }) : ""}</span>
                                  <span className="text-[12.5px] font-semibold text-accent underline underline-offset-2">{t("result.checklistGo")}</span>
                                </div>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {canFinalize ? (
                    <>
                      <form action={finalize}>
                        <input type="hidden" name="assessmentId" value={id} />
                        <button type="submit" disabled={blockers.length > 0} aria-describedby="finalize-why" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 w-full")}>
                          {t("result.finalize")}
                        </button>
                      </form>
                      {/* The reason sits right under the button, and a failed press lands here too (?error=...#finalize). */}
                      <div id="finalize-why" className="mt-2 flex flex-col gap-1">
                        {errorText && sp.error !== "reason" && tab !== "WRITING" && tab !== "SPEAKING" ? <Notice role="alert">{errorText}</Notice> : null}
                        {blockers.length > 0 ? (
                          [...blockerLines, ...waitingLines].map((line) => (
                            <p key={line} className="text-[12.5px] text-ink-2">
                              {line}
                            </p>
                          ))
                        ) : (
                          <p className="text-[12.5px] text-muted">{t("result.finalizeReady")}</p>
                        )}
                      </div>
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
                {history.map((h, i) => (
                  <li key={i}>
                    <span className="tnum">{shortDateTime(h.at, locale)}</span> · {who(h.who)} · {historyText(h)}
                  </li>
                ))}
                {history.length === 0 ? <li>{t("result.historyEmpty")}</li> : null}
              </ul>
            </details>
          </Card>
        </aside>
      </div>
    </main>
  );
}
