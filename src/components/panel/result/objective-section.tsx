import { Card } from "@/components/ui/card";
import { acceptAsCorrect, undoAcceptAsCorrect } from "@/app/(manager)/exam/students/[id]/actions";
import { Trajectory } from "@/components/panel/result/format";
import { reviewCard, plainPrompt, sectionScoreSummary, type GapSegment, type ReviewCard } from "@/components/panel/result/review-cards";
import { canAcceptAsCorrect, canAcceptGap, responseState, type ReviewMark } from "@/components/panel/result/review-rows";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import type { Section } from "@/lib/exam/types";
import type { Acceptance } from "@/server/result-review";
import type { loadResultView } from "@/server/panel";

type Responses = Awaited<ReturnType<typeof loadResultView>> extends infer V ? (V extends { responses: infer R } ? R : never) : never;
type Response = Responses[number];
type Run = { navigable: boolean; completion: string; stopReason: string | null; thetaMean: number | null; thetaSd: number | null; stimulusPlays: Record<string, number> };
type T = ReturnType<typeof managerT>;

/** A section the engine skipped because the bank had no items for it. */
export const isBankEmptySkip = (run: { completion: string; stopReason: string | null } | undefined) =>
  run?.completion === "SKIPPED" && run.stopReason === "BANK_EMPTY";

const MARK_STYLE: Record<ReviewMark, string> = {
  correct: "bg-success-soft text-success",
  wrong: "bg-danger-soft text-danger",
  blank: "bg-canvas text-muted",
  accepted: "bg-accent-soft text-accent",
};

const Pill = ({ mark, t }: { mark: ReviewMark; t: T }) => (
  <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium", MARK_STYLE[mark])}>{t(`resultReview.mark_${mark}`)}</span>
);

/** One gap of the text, filled in: right in green, wrong struck through with the right word after it. */
function InlineGap({ g, t }: { g: Extract<GapSegment, { kind: "gap" }>; t: T }) {
  const expected = <span className="font-semibold text-success">{g.expected}</span>;
  return (
    <span className="whitespace-nowrap rounded-[6px] bg-canvas px-1">
      {g.mark === "correct" ? <span className="font-semibold text-success">{g.shown}</span> : null}
      {g.mark === "accepted" ? <span className="font-semibold text-accent">{g.shown}</span> : null}
      {g.mark === "wrong" ? (
        <>
          <s className="text-danger">{g.shown}</s> {expected}
        </>
      ) : null}
      {g.mark === "blank" ? (
        <>
          <span className="text-muted">{t("resultReview.blankWord")}</span> {expected}
        </>
      ) : null}
    </span>
  );
}

function CardBody({ card, r, t, tf, tab, canGrade, acceptedGaps }: { card: ReviewCard; r: Response; t: T; tf: (code: string) => string; tab: string; canGrade: boolean; acceptedGaps: readonly string[] }) {
  if (card.kind === "GAP") {
    const gaps = card.segments.flatMap((s) => (s.kind === "gap" ? [s] : []));
    const actions = gaps.filter((g) => g.mark === "accepted" || canAcceptGap(r.itemSnapshot, r.answer ?? null, g.id, acceptedGaps));
    return (
      <>
        <p lang="de" className="whitespace-pre-line text-[15px] leading-[2] text-ink">
          {card.segments.map((s, i) => (s.kind === "text" ? <span key={i}>{s.text}</span> : <InlineGap key={i} g={s} t={t} />))}
        </p>
        <p className="tnum mt-1 text-[12px] text-muted">{t("resultReview.gapsRight", { right: card.right, total: card.total })}</p>
        {canGrade && actions.length ? (
          <ul className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2">
            {actions.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span lang="de" className="text-ink-2">
                  {t("resultReview.gapN", { n: g.n })}: <span className="font-medium text-ink">{g.shown}</span>
                </span>
                {g.mark === "accepted" ? (
                  <>
                    <Pill mark="accepted" t={t} />
                    <form action={undoAcceptAsCorrect}>
                      <input type="hidden" name="responseId" value={r.id} />
                      <input type="hidden" name="gapId" value={g.id} />
                      <input type="hidden" name="tab" value={tab} />
                      <button type="submit" className="text-[12px] font-medium text-ink underline underline-offset-2">
                        {t("resultReview.undo")}
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={acceptAsCorrect}>
                    <input type="hidden" name="responseId" value={r.id} />
                    <input type="hidden" name="gapId" value={g.id} />
                    <input type="hidden" name="tab" value={tab} />
                    <button type="submit" title={t("resultReview.acceptHint")} className="whitespace-nowrap rounded-[8px] border border-line-strong px-2 py-0.5 text-[12px] font-medium text-ink hover:bg-canvas">
                      {t("resultReview.accept")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }
  if (card.kind === "CHOICE") {
    return (
      <ul className="flex flex-col gap-1.5">
        {card.options.map((o) => (
          <li
            key={o.id}
            className={cn(
              "flex flex-wrap items-baseline gap-2 rounded-[10px] border px-3 py-1.5 text-[13.5px]",
              o.correct ? "border-success bg-success-soft" : o.picked ? "border-danger bg-danger-soft" : "border-line bg-surface",
            )}
          >
            <span className="tnum w-4 font-semibold text-muted">{o.letter}</span>
            <span lang="de" className="min-w-0 flex-1 text-ink">
              {o.text}
            </span>
            {o.picked ? <span className="text-[12px] font-medium text-ink">{t("resultReview.studentPicked")}</span> : null}
            {o.correct ? <span className="text-[12px] font-medium text-success">{t("resultReview.keyPicked")}</span> : null}
          </li>
        ))}
        {card.mark === "blank" ? <li className="text-[12.5px] text-muted">{t("resultReview.blank")}</li> : null}
      </ul>
    );
  }
  if (card.kind === "TFNG") {
    return (
      <>
        <ul className="flex flex-col divide-y divide-line">
          {card.rows.map((row) => (
            <li key={row.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-1.5 text-[13.5px]">
              <span lang="de" className="text-ink">
                {row.text}
              </span>
              <span className="tnum flex items-baseline gap-2 text-[12.5px]">
                <span className="text-muted">{t("resultReview.colStudent")}</span>
                <span className={cn("min-w-6 text-center font-bold", row.mark === "correct" ? "text-success" : row.mark === "wrong" ? "text-danger" : "text-muted")}>{row.given || "-"}</span>
                {row.mark === "correct" ? null : (
                  <>
                    <span className="text-muted">{t("resultReview.colKey")}</span>
                    <span className="min-w-6 text-center font-bold text-success">{row.key}</span>
                  </>
                )}
                <Pill mark={row.mark} t={t} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11.5px] text-muted">{t("resultReview.tfLegend", { r: tf("R"), f: tf("F"), ng: tf("NG") })}</p>
      </>
    );
  }
  if (card.kind === "MATCHING") {
    return (
      <ul className="flex flex-col divide-y divide-line">
        {card.rows.map((row) => (
          <li key={row.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-1.5 text-[13.5px]">
            <span lang="de" className="text-ink">
              {row.text}
            </span>
            <span className="tnum flex items-baseline gap-2 text-[12.5px]">
              <span className="text-muted">{t("resultReview.colStudent")}</span>
              <span className={cn("min-w-6 text-center font-bold", row.mark === "correct" ? "text-success" : row.mark === "wrong" ? "text-danger" : "text-muted")}>{row.givenLetter || (row.givenText ? "?" : "-")}</span>
              {row.mark === "correct" ? null : (
                <>
                  <span className="text-muted">{t("resultReview.colKey")}</span>
                  <span className="min-w-6 text-center font-bold text-success">{row.keyLetter || "?"}</span>
                </>
              )}
              <Pill mark={row.mark} t={t} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (card.kind === "TEXT") {
    return (
      <div className="flex flex-col gap-1 text-[13.5px]">
        <p lang="de">
          <span className="text-[12px] text-muted">{t("resultReview.colStudent")}: </span>
          {card.given ? <span className={cn("font-semibold", card.mark === "correct" ? "text-success" : "text-danger")}>{card.given}</span> : <span className="text-muted">{t("resultReview.blank")}</span>}
        </p>
        <p lang="de">
          <span className="text-[12px] text-muted">{t("resultReview.colKey")}: </span>
          <span className="font-semibold text-success">{card.accepted.join(" / ")}</span>
        </p>
      </div>
    );
  }
  return null;
}

/**
 * The teacher's view of a reading or listening section: the score line, the
 * trajectory and every served item as its own card. A card shows what the
 * student answered in the form it was asked: a C-test or gap text with each gap
 * filled in (right in green, wrong struck through with the right word after
 * it), the options with the pick marked, the true/false/not-given letters, the
 * matching letters. A typed answer that scored under full marks can be
 * accepted as correct (and the acceptance undone).
 */
export function ObjectiveSection({
  t,
  section,
  tab,
  level,
  responses,
  run,
  acceptances,
  canGrade,
}: {
  t: T;
  section: Section;
  tab: string;
  /** The skill level the engine settled on, when there is one. */
  level: string | null;
  responses: Responses;
  run: Run | undefined;
  acceptances: Record<string, Acceptance>;
  canGrade: boolean;
}) {
  // The same answer tally as the Summary tab and the report (answer-tally.ts).
  const summary = sectionScoreSummary(responses, acceptances, run);
  const points = responses.filter((r) => r.thetaAfter !== null).map((r) => ({ theta: r.thetaAfter!, se: r.seAfter ?? 0 }));
  const tf = (code: string) => (code === "NG" && section === "LISTENING" ? t("resultReview.tfNGListening") : t(`resultReview.tf${code as "R" | "F" | "NG"}`));
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center justify-between gap-6 p-5">
        <div>
          <div className="tnum text-[20px] font-bold text-ink">
            {t("resultReview.scoreSummary", { right: summary.right, total: summary.total })}
            {level ? <span className="ml-3 text-[15px] font-semibold text-accent">{t("resultReview.sectionLevel", { level })}</span> : null}
          </div>
          {run?.thetaSd == null ? null : (
            <div className="tnum mt-1 text-[13px] text-ink-2">
              {t("result.precisionOnly", { precision: run.thetaSd < 0.45 ? t("result.precisionGood") : run.thetaSd < 0.7 ? t("result.precisionFair") : t("result.precisionLow") })}
            </div>
          )}
          <div className="mt-1 text-[12.5px] text-muted">{t("result.trajectory")}</div>
        </div>
        <Trajectory points={points} />
      </Card>
      <details open>
        <summary className="cursor-pointer text-[13.5px] font-medium text-ink underline underline-offset-2">{t("result.showAll", { n: responses.length })}</summary>
        <ol className="mt-3 flex flex-col gap-3">
          {responses.map((r) => {
            const state = responseState(r, run);
            const accepted = acceptances[r.id];
            const acceptedGaps = accepted?.gapIds ?? [];
            const card = reviewCard(r.itemSnapshot, state === "ANSWERED" ? (r.answer ?? null) : null, acceptedGaps);
            const partial = r.score !== null && r.score > 0 && r.score < 1;
            const prompt = card.kind === "GAP" ? "" : plainPrompt(r.itemSnapshot.prompt);
            return (
              <li key={r.id} id={`r-${r.id}`}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="tnum flex items-baseline gap-2 text-[12.5px] text-muted">
                      <span className="text-[14px] font-bold text-ink">{r.sequence}.</span>
                      <span>{r.itemSnapshot.level}</span>
                      {r.itemSnapshot.stimulus ? <span lang="de">{r.itemSnapshot.stimulus.title}</span> : null}
                    </div>
                    <div className="tnum flex items-baseline gap-2 text-[13px] font-semibold text-ink">
                      {state !== "ANSWERED" ? <span className="text-[12.5px] font-normal text-muted">{state === "BLANK" ? t("resultReview.blank") : t("resultReview.notReached")}</span> : null}
                      {r.score === null ? "-" : `${Math.round(r.score * 100)}%`}
                      {partial ? <span className="text-[11.5px] font-medium text-warn">{t("resultReview.partial")}</span> : null}
                    </div>
                  </div>
                  {prompt ? (
                    <p lang="de" className="mt-1.5 whitespace-pre-line text-[14px] leading-[1.6] text-ink-2">
                      {prompt}
                    </p>
                  ) : null}
                  <div className="mt-2.5">
                    <CardBody card={card} r={r} t={t} tf={tf} tab={tab} canGrade={canGrade} acceptedGaps={acceptedGaps} />
                  </div>
                  {accepted ? (
                    <p className="mt-2 text-[11.5px] font-medium text-success">{t("resultReview.acceptedBadge", { pct: Math.round((accepted.originalScore ?? 0) * 100) })}</p>
                  ) : null}
                  {canGrade && accepted && accepted.gapIds.length === 0 ? (
                    <form action={undoAcceptAsCorrect} className="mt-1">
                      <input type="hidden" name="responseId" value={r.id} />
                      <input type="hidden" name="tab" value={tab} />
                      <button type="submit" className="text-[12px] font-medium text-ink underline underline-offset-2">
                        {t("resultReview.undo")}
                      </button>
                    </form>
                  ) : null}
                  {canGrade && !accepted && canAcceptAsCorrect(r) ? (
                    <form action={acceptAsCorrect} className="mt-2">
                      <input type="hidden" name="responseId" value={r.id} />
                      <input type="hidden" name="tab" value={tab} />
                      <button type="submit" title={t("resultReview.acceptHint")} className="rounded-[8px] border border-line-strong px-2 py-1 text-[12px] font-medium text-ink hover:bg-canvas">
                        {t("resultReview.accept")}
                      </button>
                    </form>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
