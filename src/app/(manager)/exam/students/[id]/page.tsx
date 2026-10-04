import Link from "next/link";
import { notFound } from "next/navigation";
import { finalize, overrideOverall, release } from "@/app/(manager)/exam/students/[id]/actions";
import { Card } from "@/components/ui/card";
import { Dot, INTEGRITY_TONE, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import { GradingCard } from "@/components/panel/result/grading-card";
import { Highlighted, Trajectory, answerText, keyText } from "@/components/panel/result/format";
import { IntegrityPanel } from "@/components/panel/result/integrity-panel";
import { SpeakingEvidence } from "@/components/panel/result/speaking-evidence";
import { can } from "@/lib/authorize";
import { isObjectiveSection, CEFR_LEVELS, type Section } from "@/lib/exam/types";
import { listStudents, loadIntegrityView, loadResultView } from "@/server/panel";
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

  // What the finalize button waits for, in words.
  let blockedBy: string | null = null;
  if (!attempt?.completedAt && !attempt?.terminatedAt) blockedBy = t("result.finalizeRunning");
  else if (computed?.status === "AWAITING_GRADING") blockedBy = t("result.finalizeGrading");
  else {
    const undecided = Object.entries(computed?.skills ?? {}).find(([, s]) => s?.decider === "AI" || s?.pending);
    if (undecided) blockedBy = t("result.finalizeBlocked", { section: t(`sectionName.${undecided[0] as Section}`) });
  }

  const runFor = (s: string) => view.runs.find((r) => r.section === s);
  const responsesFor = (s: string) => {
    const run = runFor(s);
    return run ? view.responses.filter((r) => r.sectionRunId === run.id) : [];
  };

  const integrity = tab === "integrity" && attempt ? await loadIntegrityView(attempt.id) : null;

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

          {sp.error ? (
            <p className="mb-4 text-[13px] text-danger">
              {sp.error === "reason"
                ? t("result.reasonRequired")
                : sp.error === "running"
                  ? t("result.errRunning")
                  : sp.error === "invalid"
                    ? t("result.errInvalid")
                    : sp.error === "UNDECIDED"
                      ? t("result.errUndecided")
                      : t("result.errNotReady")}
            </p>
          ) : null}

          {tab === "summary" ? (
            <Card className="divide-y divide-line">
              {view.sections.map((s) => {
                const skill = computed?.skills[s as Section];
                const run = runFor(s);
                const rs = responsesFor(s);
                const answered = rs.filter((r) => r.answeredAt).length;
                const correct = rs.filter((r) => r.isCorrect).length;
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
                        : isObjectiveSection(s as Section)
                          ? skill?.insufficient
                            ? t("result.insufficient")
                            : t("result.basis", { n: answered, pct: answered ? Math.round((correct / answered) * 100) : 0, precision })
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
            <ObjectiveSection t={t} responses={responsesFor(tab)} run={runFor(tab)} />
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
                  <section key={r.id} className="grid gap-5 xl:grid-cols-[1fr_340px]">
                    <div className="min-w-0">
                      <div className="text-[12.5px] uppercase tracking-[0.04em] text-muted">{t("result.taskLevel", { level: r.itemSnapshot.level })}</div>
                      <p lang="de" className="mt-1 whitespace-pre-line text-[14px] leading-[1.6] text-ink-2">
                        {r.itemSnapshot.prompt}
                      </p>
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
              showAll={sp.show === "all"}
              startedAt={(attempt.startedAt ?? attempt.createdAt).getTime()}
              endedAt={(attempt.completedAt ?? new Date()).getTime()}
              sections={view.runs
                .filter((r) => r.startedAt)
                .map((r) => ({ section: r.section, start: r.startedAt!.getTime(), end: (r.submittedAt ?? new Date()).getTime() }))}
            />
          ) : null}
        </div>

        {/* Rail: the skills with their source, and the one action. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
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
              ) : canFinalize ? (
                <>
                  <form action={finalize}>
                    <input type="hidden" name="assessmentId" value={id} />
                    <button
                      type="submit"
                      disabled={!!blockedBy}
                      className="h-11 w-full rounded-[10px] bg-accent text-[14.5px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                    >
                      {t("result.finalize")}
                    </button>
                  </form>
                  {blockedBy ? <p className="mt-2 text-[12.5px] text-muted">{blockedBy}</p> : null}
                  {attempt?.completedAt ? (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-[12.5px] text-ink underline underline-offset-2">{t("result.overallChange")}</summary>
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

function ObjectiveSection({
  t,
  responses,
  run,
}: {
  t: ReturnType<typeof managerT>;
  responses: Awaited<ReturnType<typeof loadResultView>> extends infer V ? (V extends { responses: infer R } ? R : never) : never;
  run: { thetaMean: number | null; thetaSd: number | null; stimulusPlays: Record<string, number> } | undefined;
}) {
  const answered = responses.filter((r) => r.answeredAt);
  const points = responses.filter((r) => r.thetaAfter !== null).map((r) => ({ theta: r.thetaAfter!, se: r.seAfter ?? 0 }));
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center justify-between gap-6 p-5">
        <div>
          <div className="tnum text-[14px] text-ink">
            {t("result.basis", {
              n: answered.length,
              pct: answered.length ? Math.round((responses.filter((r) => r.isCorrect).length / answered.length) * 100) : 0,
              precision: run?.thetaSd == null ? "-" : run.thetaSd < 0.45 ? t("result.precisionGood") : run.thetaSd < 0.7 ? t("result.precisionFair") : t("result.precisionLow"),
            })}
          </div>
          <div className="mt-1 text-[12.5px] text-muted">{t("result.trajectory")}</div>
        </div>
        <Trajectory points={points} />
      </Card>
      <details>
        <summary className="cursor-pointer text-[13.5px] font-medium text-ink underline underline-offset-2">{t("result.showAll", { n: responses.length })}</summary>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-line text-[11.5px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">{t("result.colItem")}</th>
                <th className="px-3 py-2.5 font-medium">{t("result.colAnswer")}</th>
                <th className="px-3 py-2.5 font-medium">{t("result.colKey")}</th>
                <th className="px-4 py-2.5 font-medium">{t("result.colScore")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {responses.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="tnum px-4 py-2.5 text-muted">
                    {r.sequence}
                    <span className="block text-[11px]">{r.itemSnapshot.level}</span>
                  </td>
                  <td lang="de" className="max-w-[360px] px-3 py-2.5 text-ink-2">
                    {r.itemSnapshot.stimulus ? <span className="block text-[11.5px] text-muted">{r.itemSnapshot.stimulus.title}</span> : null}
                    {r.itemSnapshot.prompt.replace(/\{\{[^}]+\}\}/g, "___").slice(0, 160)}
                  </td>
                  <td lang="de" className="px-3 py-2.5 text-ink">
                    {r.notReached ? <span className="text-muted">{t("result.notReached")}</span> : answerText(r.itemSnapshot, r.answer ?? null) || <span className="text-muted">{t("result.blank")}</span>}
                  </td>
                  <td lang="de" className="px-3 py-2.5 text-ink-2">
                    {keyText(r.itemSnapshot)}
                  </td>
                  <td className="tnum px-4 py-2.5 font-semibold text-ink">{r.score === null ? "-" : `${Math.round(r.score * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </details>
    </div>
  );
}
