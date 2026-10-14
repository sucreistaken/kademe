import { Card } from "@/components/ui/card";
import { acceptAsCorrect, undoAcceptAsCorrect } from "@/app/(manager)/exam/students/[id]/actions";
import { Trajectory, answerText, keyText } from "@/components/panel/result/format";
import { canAcceptAsCorrect, objectiveBasis, responseState, reviewRows, type ReviewMark } from "@/components/panel/result/review-rows";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import type { Section } from "@/lib/exam/types";
import type { Acceptance } from "@/server/result-review";
import type { loadResultView } from "@/server/panel";

type Responses = Awaited<ReturnType<typeof loadResultView>> extends infer V ? (V extends { responses: infer R } ? R : never) : never;
type Run = { navigable: boolean; completion: string; stopReason: string | null; thetaMean: number | null; thetaSd: number | null; stimulusPlays: Record<string, number> };

/** A section the engine skipped because the bank had no items for it. */
export const isBankEmptySkip = (run: { completion: string; stopReason: string | null } | undefined) =>
  run?.completion === "SKIPPED" && run.stopReason === "BANK_EMPTY";

const MARK_STYLE: Record<ReviewMark, string> = {
  correct: "bg-success-soft text-success",
  wrong: "bg-danger-soft text-danger",
  blank: "bg-canvas text-muted",
};

/**
 * The teacher's view of a reading or listening section: the basis line, the
 * trajectory and every served item. Matching, true/false and gap items are
 * drawn row by row with the student's choice, the key and a mark, so a
 * teacher can see which rows were wrong. A typed answer that scored under full
 * marks can be accepted as correct (and the acceptance undone).
 */
export function ObjectiveSection({
  t,
  section,
  tab,
  responses,
  run,
  acceptances,
  canGrade,
  open,
}: {
  t: ReturnType<typeof managerT>;
  section: Section;
  tab: string;
  responses: Responses;
  run: Run | undefined;
  acceptances: Record<string, Acceptance>;
  canGrade: boolean;
  open: boolean;
}) {
  const basis = objectiveBasis(responses);
  const points = responses.filter((r) => r.thetaAfter !== null).map((r) => ({ theta: r.thetaAfter!, se: r.seAfter ?? 0 }));
  const tf = (code: string) => (code === "NG" && section === "LISTENING" ? t("resultReview.tfNGListening") : t(`resultReview.tf${code as "R" | "F" | "NG"}`));
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center justify-between gap-6 p-5">
        <div>
          <div className="tnum text-[14px] text-ink">
            {t("result.basis", {
              n: basis.answered,
              pct: basis.pct,
              precision: run?.thetaSd == null ? "-" : run.thetaSd < 0.45 ? t("result.precisionGood") : run.thetaSd < 0.7 ? t("result.precisionFair") : t("result.precisionLow"),
            })}
            {basis.partial > 0 ? ` · ${t("resultReview.partialCount", { n: basis.partial })}` : ""}
          </div>
          <div className="mt-1 text-[12.5px] text-muted">{t("result.trajectory")}</div>
        </div>
        <Trajectory points={points} />
      </Card>
      <details open={open}>
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
              {responses.map((r) => {
                const state = responseState(r, run);
                const rows = state === "ANSWERED" ? reviewRows(r.itemSnapshot, r.answer ?? null) : null;
                const accepted = acceptances[r.id];
                const partial = r.score !== null && r.score > 0 && r.score < 1;
                return (
                  <tr key={r.id} id={`r-${r.id}`} className="align-top">
                    <td className="tnum px-4 py-2.5 text-muted">
                      {r.sequence}
                      <span className="block text-[11px]">{r.itemSnapshot.level}</span>
                    </td>
                    <td lang="de" className="max-w-[360px] px-3 py-2.5 text-ink-2">
                      {r.itemSnapshot.stimulus ? <span className="block text-[11.5px] text-muted">{r.itemSnapshot.stimulus.title}</span> : null}
                      {r.itemSnapshot.prompt.replace(/\{\{[^}]+\}\}/g, "___").slice(0, 160)}
                    </td>
                    {state !== "ANSWERED" ? (
                      <>
                        <td className="px-3 py-2.5 text-muted">{state === "BLANK" ? t("resultReview.blank") : t("resultReview.notReached")}</td>
                        <td lang="de" className="px-3 py-2.5 text-ink-2">
                          {keyText(r.itemSnapshot, tf)}
                        </td>
                      </>
                    ) : rows ? (
                      <td colSpan={2} className="px-3 py-2.5">
                        <table className="w-full text-[12.5px]">
                          <thead className="text-left text-[11px] uppercase tracking-[0.04em] text-muted">
                            <tr>
                              <th className="pb-1 pr-3 font-medium" />
                              <th className="pb-1 pr-3 font-medium">{t("resultReview.colStudent")}</th>
                              <th className="pb-1 pr-3 font-medium">{t("resultReview.colKey")}</th>
                              <th className="pb-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.rows.map((row) => (
                              <tr key={row.id} className="align-baseline">
                                <td lang="de" className="w-[34%] py-0.5 pr-3 text-ink-2">
                                  {rows.variant === "GAP" ? t("resultReview.gapN", { n: row.label }) : row.label}
                                </td>
                                <td lang="de" className="py-0.5 pr-3 text-ink">
                                  {row.given ? (rows.variant === "TFNG" ? tf(row.given) : row.given) : <span className="text-muted">{t("resultReview.rowEmpty")}</span>}
                                </td>
                                <td lang="de" className="py-0.5 pr-3 text-ink-2">
                                  {rows.variant === "TFNG" && row.key ? tf(row.key) : row.key}
                                </td>
                                <td className="py-0.5">
                                  <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-medium", MARK_STYLE[row.mark])}>{t(`resultReview.mark_${row.mark}`)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    ) : (
                      <>
                        <td lang="de" className="px-3 py-2.5 text-ink">
                          {answerText(r.itemSnapshot, r.answer ?? null, tf)}
                        </td>
                        <td lang="de" className="px-3 py-2.5 text-ink-2">
                          {keyText(r.itemSnapshot, tf)}
                        </td>
                      </>
                    )}
                    <td className="tnum px-4 py-2.5 font-semibold text-ink">
                      {r.score === null ? "-" : `${Math.round(r.score * 100)}%`}
                      {partial ? <span className="block text-[11.5px] font-medium text-warn">{t("resultReview.partial")}</span> : null}
                      {accepted ? (
                        <span className="mt-1 block text-[11.5px] font-medium text-success">
                          {t("resultReview.acceptedBadge", { pct: Math.round((accepted.originalScore ?? 0) * 100) })}
                        </span>
                      ) : null}
                      {canGrade && accepted ? (
                        <form action={undoAcceptAsCorrect} className="mt-1">
                          <input type="hidden" name="responseId" value={r.id} />
                          <input type="hidden" name="tab" value={tab} />
                          <button type="submit" className="text-[12px] font-medium text-ink underline underline-offset-2">
                            {t("resultReview.undo")}
                          </button>
                        </form>
                      ) : null}
                      {canGrade && !accepted && canAcceptAsCorrect(r) ? (
                        <form action={acceptAsCorrect} className="mt-1">
                          <input type="hidden" name="responseId" value={r.id} />
                          <input type="hidden" name="tab" value={tab} />
                          <button type="submit" title={t("resultReview.acceptHint")} className="rounded-[8px] border border-line-strong px-2 py-1 text-[12px] font-medium text-ink hover:bg-canvas">
                            {t("resultReview.accept")}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </details>
    </div>
  );
}
