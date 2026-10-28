import Link from "next/link";
import { notFound } from "next/navigation";
import { finalize, overrideOverall, release, setLevelShown, undoAcceptAsCorrect } from "@/app/(manager)/exam/students/[id]/actions";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Dot, INTEGRITY_TONE, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import { CourseResultPage } from "@/components/panel/course/course-result-page";
import { ExamFeedbackBox } from "@/components/panel/result/exam-feedback-box";
import { FeedbackCard } from "@/components/panel/result/feedback-card";
import { GradingCard } from "@/components/panel/result/grading-card";
import { Highlighted } from "@/components/panel/result/format";
import { ObjectiveSection, isBankEmptySkip } from "@/components/panel/result/objective-section";
import { TaskPrompt } from "@/components/panel/result/task-prompt";
import { finalizeBlockers, finalizeChecklist, waitingSections } from "@/lib/exam/finalize-blockers";
import { answerTally } from "@/components/panel/result/answer-tally";
import { groupMarkers } from "@/components/panel/integrity/markers";
import { isNoiseType } from "@/components/panel/integrity/groups";
import { IntegrityPanel } from "@/components/panel/result/integrity-panel";
import { ExamRecordingPlayer } from "@/components/panel/result/recording-player";
import { SpeakingEvidence } from "@/components/panel/result/speaking-evidence";
import { reportAllowed } from "@/components/panel/report/model";
import { can } from "@/lib/authorize";
import { isObjectiveSection, RESULT_LEVELS, type Section } from "@/lib/exam/types";
import { isPreA1, levelLabel } from "@/lib/exam/level-label";
import { FIRST_CLASS, recommendedClassOf } from "@/lib/exam/placement";
import { examFeedbackOf } from "@/server/exam-feedback";
import { listStudents, loadIntegrityView, loadResultView } from "@/server/panel";
import { listProblemReports } from "@/server/problem-reports";
import { isProblemArea, splitProblemMessage } from "@/lib/exam/problem-reports";
import { loadRecordingSegments, recordingConsent } from "@/server/recordings";
import { loadAcceptances } from "@/server/result-review";
import { UndoStrip } from "@/components/ui/undo-strip";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import { intlTag } from "@/lib/format";

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
  // What the student said went wrong (end-of-exam and check-screen reports), newest first.
  const problems = await listProblemReports(user.orgId, view.candidate.id);
  // What the student rated after the exam (the end-of-exam survey), if they answered.
  const feedback = await examFeedbackOf(user.orgId, id);
  const { assessment, candidate, attempt, result } = view;
  // A course test is graded on its own screen: Halil Bey's marking sheet (src/components/panel/course). The level exams keep this page.
  if (assessment.mode === "COURSE_TEST") {
    return <CourseResultPage user={user} locale={locale} view={view} row={row} problems={problems} feedback={feedback} sp={sp} id={id} />;
  }
  const cfg = assessment.blueprintSnapshot;
  const computed = result?.computed ?? null;
  const final = result?.status === "FINAL";
  const levelShownNow = result?.levelShown ?? cfg.resultVisibility !== "NONE";
  const tab = sp.tab ?? "summary";
  const tabs = ["summary", ...view.sections, "integrity"];
  const ended = !!attempt?.completedAt || !!attempt?.terminatedAt;
  const canGrade = can(user, "result:grade") && ended;
  const canFinalize = can(user, "result:finalize");
  const overall = final ? result?.finalOverall : (computed?.overall ?? null);
  const outcome = final ? result?.finalOutcome : computed?.verification?.outcome;
  // Results stored before the placement detail existed have no `placement`.
  const placement = computed?.placement ?? null;
  // A0 is written "A0 (Pre-A1)" wherever there is room; an A0 placement starts in the first course.
  const label = (level: string | null | undefined) => levelLabel(level, t("resultLevel.A0"));
  const firstCourse = !!(overall && placement && recommendedClassOf(overall, placement).preA1);

  const runFor = (s: string) => view.runs.find((r) => r.section === s);
  const responsesFor = (s: string) => {
    const run = runFor(s);
    return run ? view.responses.filter((r) => r.sectionRunId === run.id) : [];
  };

  // What the finalize button waits for: the same rules finalizeResult applies
  // (src/lib/exam/finalize-blockers.ts), so the page and the action cannot disagree.
  const blockers = finalizeBlockers(computed, ended);
  const sectionList = (list: Section[]) => list.map((s) => t(`sectionName.${s}`)).join(", ");
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
  // One line per section that waits for the teacher (a teacher may grade while the AI proposal is still PENDING).
  const waiting = waitingSections(checklist.rows);
  const waitingLines = waiting.map((w) => t(w.open === 1 ? "result.finalizeWaitingOne" : "result.finalizeWaiting", { section: t(`sectionName.${w.section}`), n: w.open }));
  const blockerLines = blockers.flatMap((b) =>
    b.code === "RUNNING"
      ? [t("result.finalizeRunning")]
      : b.code === "GRADING" || b.code === "UNDECIDED"
        ? // The waiting-sections lines cover both; the older wording is only the fallback when no section has a task to grade yet.
          waiting.length
          ? []
          : [b.code === "GRADING" ? t("result.finalizeGrading") : t("result.finalizeNeeds", { sections: sectionList(b.sections) })]
        : [t("result.errNotReady")],
  );
  // Waiting sections are listed once, right after any "exam still running" line.
  if (waitingLines.length && blockers.some((b) => b.code === "GRADING" || b.code === "UNDECIDED")) blockerLines.push(...waitingLines);
  const errorText = sp.error
    ? sp.error === "reason"
      ? t("result.reasonRequired")
      : sp.error === "running"
        ? t("result.errRunning")
        : sp.error === "invalid"
          ? t("result.errInvalid")
          : sp.error === "UNDECIDED"
            ? t("result.errUndecided")
            : sp.error === "feedbackLimit"
              ? t("result.errFeedbackLimit")
              : sp.error === "feedbackFailed"
                ? t("result.errFeedbackFailed")
                : sp.error === "feedbackUnavailable"
                  ? t("result.errFeedbackUnavailable")
                  : sp.error === "feedbackEmpty"
                    ? t("result.errFeedbackEmpty")
                    : t("result.errNotReady")
    : null;

  // The Summary tab tallies every objective section, a skill tab only its own.
  const acceptanceSections = tab === "summary" ? view.sections.filter((s) => isObjectiveSection(s as Section)) : isObjectiveSection(tab as Section) ? [tab] : [];
  const acceptances = await loadAcceptances(user.orgId, acceptanceSections.flatMap((s) => responsesFor(s).map((r) => r.id)));

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
          <h1 className="text-headline text-ink">{candidate.fullName}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {assessment.blueprintName} · {t(`mode.${assessment.mode}`)}
            {assessment.claimedLevel ? ` · ${t("mode.claimed", { level: assessment.claimedLevel })}` : ""} · {shortDateTime(attempt?.completedAt ?? null, locale)}
          </p>
        </div>
        <div className="flex items-end gap-8">
          <div>
            <div className="text-[12px] uppercase tracking-[0.04em] text-muted">{t("result.overall")}</div>
            <div className={cn("tnum text-[40px] font-bold leading-none", final ? "text-ink" : "text-ink-3")}>{overall ?? "-"}</div>
            {isPreA1(overall) ? <div className={cn("mt-1 text-[13px] font-semibold", final ? "text-ink" : "text-ink-3")}>{t("resultLevel.A0Name")}</div> : null}
            {!final && computed?.reviewReasons?.includes("CHANCE_BELOW_POOLED") ? (
              <div className="mt-1 max-w-[260px] text-[12.5px] leading-[1.45] text-ink-2">{t("resultLevel.chanceBelowPooled")}</div>
            ) : null}
          </div>
          {assessment.mode === "PLACEMENT" && placement ? (
            <div className="max-w-[300px]">
              {isPreA1(overall) ? (
                <>
                  {/* An A0 result starts in the first course; the pooled sublevel is only the raw estimate. */}
                  <div className="tnum text-[14px] font-semibold text-ink">{t("result.sublevel", { sublevel: FIRST_CLASS.sublevel })}</div>
                  <div className="text-[12.5px] text-ink-2">{t("resultLevel.A0Class")}</div>
                  {placement.sublevel && placement.sublevel !== FIRST_CLASS.sublevel ? (
                    <div className="tnum text-[12.5px] text-muted">{t("resultLevel.rawEstimate", { sublevel: placement.sublevel })}</div>
                  ) : null}
                </>
              ) : (
                <>
                  {placement.sublevel ? (
                    <div className="tnum text-[14px] font-semibold text-ink">{t("result.sublevel", { sublevel: placement.sublevel })}</div>
                  ) : null}
                  {firstCourse ? <div className="text-[12.5px] text-ink-2">{t("resultLevel.A0Class")}</div> : null}
                </>
              )}
              {placement.borderline ? (
                <>
                  <div className="text-[13px] font-medium text-ink">{t("result.borderline")}</div>
                  {placement.recommended ? (
                    <div className="tnum text-[12.5px] text-muted">
                      {t("result.recommendedClass", { level: isPreA1(placement.recommended) ? FIRST_CLASS.sublevel : placement.recommended })}
                    </div>
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
            <Notice role="alert" className="mb-4">
              {errorText}
            </Notice>
          ) : null}

          {tab === "summary" ? (
            <>
            <Card className="divide-y divide-line">
              {view.sections.map((s) => {
                const skill = computed?.skills[s as Section];
                const run = runFor(s);
                const rs = responsesFor(s);
                const tally = answerTally(rs, acceptances, run);
                const sd = run?.thetaSd ?? null;
                const precision = sd === null ? "" : sd < 0.45 ? t("result.precisionGood") : sd < 0.7 ? t("result.precisionFair") : t("result.precisionLow");
                const decider = skill?.decider;
                return (
                  <Link key={s} href={`/exam/students/${id}?tab=${s}`} className="grid grid-cols-[140px_60px_1fr] items-center gap-4 px-5 py-4 hover:bg-canvas">
                    <span className="text-[14px] font-semibold text-ink">{t(`sectionName.${s as Section}`)}</span>
                    <span className={cn("tnum text-[18px] font-bold", decider === "TEACHER" || decider === "ENGINE" ? "text-ink" : "text-ink-3")}>
                      {skill?.level ?? "-"}
                      {isPreA1(skill?.level) ? <span className="block text-[11px] font-semibold leading-tight">{t("resultLevel.A0Name")}</span> : null}
                    </span>
                    <span className="text-[13px] text-muted">
                      {!run?.submittedAt
                        ? t("result.inProgress")
                        : isBankEmptySkip(run)
                          ? t("resultReview.skippedBankEmpty")
                          : isObjectiveSection(s as Section)
                          ? skill?.reason === "AT_CHANCE"
                            ? skill.chance?.blank
                              ? t("resultLevel.atChanceBlank")
                              : // The tally the rule tested: answered A1-A2 units, not the whole section.
                                t("resultLevel.atChance", { right: skill.chance?.right ?? 0, answered: skill.chance?.answered ?? 0 })
                            : skill?.insufficient
                            ? t("result.insufficient")
                            : precision
                              ? t("result.basis", { correct: tally.correct, total: tally.total, precision })
                              : t("resultReview.scoreSummary", { right: tally.correct, total: tally.total })
                          : decider
                            ? t(`source.${decider}`)
                            : // Same word as the checklist: the teacher can grade now, the AI proposal is only a help.
                              checklist.rows.find((r) => r.section === s)?.state === "todo"
                              ? `${t("result.checklistTodo")} · ${t("result.checklistGo")}`
                              : t("result.pending")}
                    </span>
                  </Link>
                );
              })}
            </Card>
            {result ? (
              <FeedbackCard
                assessmentId={id}
                feedback={result.studentFeedback ?? null}
                ended={ended}
                canGrade={canGrade}
                nameOf={view.nameOf}
                locale={locale}
                t={t}
              />
            ) : null}
            {feedback ? <ExamFeedbackBox feedback={feedback} locale={locale} t={t} className="mt-6" /> : null}
            </>
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
                level={label(computed?.skills[tab as Section]?.level) ?? null}
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
                          <SpeakingEvidence src={view.mediaUrls[media.id]} words={tr?.words ?? []} text={tr?.text ?? ""} noSpeech={!!tr && !tr.text.trim()} name={candidate.fullName ?? "transcript"} />
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
                        ? recording.purgeAfter.toLocaleDateString(intlTag(locale), { day: "numeric", month: "long", year: "numeric", timeZone: ORG_TIMEZONE })
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
                      <span className="tnum text-[15px] font-bold text-ink">{label(skill?.level) ?? "-"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-[13.5px] font-semibold text-ink">{t("result.overall")}</span>
              <span className="tnum text-[20px] font-bold text-ink">{label(overall) ?? "-"}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              {result?.overallOverride ? `${t("source.TEACHER")}: ${result.overallOverrideReason ?? ""}` : t("result.overallRule")}
            </p>

            <div className="mt-5">
              {final ? (
                <>
                  <p className="text-[13px] text-muted">{t("result.finalized", { date: shortDateTime(result?.finalizedAt ?? null, locale) })}</p>
                  {result?.releasedAt ? (
                    <>
                      <p className="mt-1 text-[13px] text-muted">{t("result.released", { date: shortDateTime(result.releasedAt, locale) })}</p>
                      <p className="mt-1 text-[13px] text-muted">{levelShownNow ? t("result.levelShownNow") : t("result.levelHiddenNow")}</p>
                      {canFinalize ? (
                        <form action={setLevelShown} className="mt-2 flex flex-wrap items-center gap-3">
                          <input type="hidden" name="assessmentId" value={id} />
                          <label className="flex items-center gap-2 text-[13px] text-ink">
                            <input type="checkbox" name="levelShown" defaultChecked={levelShownNow} className="size-4 accent-[var(--color-accent)]" />
                            {t("result.showLevel")}
                          </label>
                          <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                            {t("result.levelSave")}
                          </button>
                        </form>
                      ) : null}
                    </>
                  ) : attempt?.integrityOutcome === "INVALID" ? (
                    <p className="mt-1 text-[13px] text-muted">{t("result.errInvalid")}</p>
                  ) : canFinalize ? (
                    <form action={release} className="mt-3">
                      <input type="hidden" name="assessmentId" value={id} />
                      <label className="mb-3 flex items-center gap-2 text-[13px] text-ink">
                        <input type="checkbox" name="levelShown" defaultChecked={cfg.resultVisibility !== "NONE"} className="size-4 accent-[var(--color-accent)]" />
                        {t("result.showLevel")}
                      </label>
                      <p className="-mt-1 mb-3 text-[12px] text-muted">{t("result.levelHint")}</p>
                      <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 w-full")}>
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
                      {checklist.rows.map((row) => {
                        // Every row opens its section; a teacher task jumps to the first open one.
                        const href = `/exam/students/${id}?tab=${row.section}${row.firstOpenResponseId ? `#t-${row.firstOpenResponseId}` : ""}`;
                        const actionable = row.state === "todo" || row.state === "aiPending";
                        return (
                          <li key={row.section}>
                            <Link
                              href={href}
                              className={cn(
                                "block rounded-[10px] px-3 py-2 text-[13px] transition-colors",
                                row.state === "done" ? "bg-success-soft hover:brightness-[0.98]" : "bg-canvas hover:bg-line",
                                row.section === tab && "ring-2 ring-accent",
                              )}
                            >
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
                                  {row.state === "todo" && row.aiPending > 0 ? <span className="ml-1 text-[11.5px] font-normal text-muted">{t("result.checklistAiComing")}</span> : null}
                                </span>
                              </div>
                              {actionable ? (
                                <div className="mt-1 flex items-baseline justify-between gap-2">
                                  <span className="tnum text-[12px] text-muted">{row.total > 1 ? t("result.checklistTasks", { open: row.open, total: row.total }) : ""}</span>
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
                    <button
                      type="submit"
                      disabled={blockers.length > 0}
                      aria-describedby="finalize-why"
                      className={cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 w-full")}
                    >
                      {t("result.finalize")}
                    </button>
                  </form>
                  {/* The reason sits right under the button, and a failed press lands here too (?error=...#finalize). */}
                  <div id="finalize-why" className="mt-2 flex flex-col gap-1">
                    {errorText && sp.error !== "reason" ? (
                      <Notice role="alert">{errorText}</Notice>
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
                          {RESULT_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {label(l)}
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
