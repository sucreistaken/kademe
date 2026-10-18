import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import { splitTextLead } from "@/lib/exam/prompt-instruction";
import type { GapSegment, ReviewCard } from "./review-cards";
import type { ReviewMark } from "./review-rows";

type T = ReturnType<typeof managerT>;
type Gap = Extract<GapSegment, { kind: "gap" }>;

/**
 * The teacher's view of an MC cloze or word-bank text. Right is a cyan tick,
 * wrong an ink cross on the light ground (docs/design DESIGN.md: never red in
 * the answer review), and the word always comes with the glyph, so colour is
 * never the only signal. There is no "accept as correct" here: the student
 * picked a given word, and accepting a wrong pick would score a guess.
 */

const isRight = (m: ReviewMark) => m === "correct" || m === "accepted";

/** The tick or the cross of one gap, with its word for screen readers. Nothing for a blank gap. */
function Glyph({ mark, t }: { mark: ReviewMark; t: T }) {
  if (mark === "blank") return null;
  return (
    <span className={cn("font-bold", isRight(mark) ? "text-accent" : "text-ink")}>
      <span aria-hidden>{isRight(mark) ? "✓" : "✗"}</span>
      <span className="sr-only">{t(`resultReview.mark_${mark}`)}</span>
    </span>
  );
}

/** One gap in the running text: its number, the student's word and the tick or cross. */
function InlineGap({ g, t }: { g: Gap; t: T }) {
  return (
    <span className="whitespace-nowrap rounded-[6px] bg-canvas px-1">
      <sup className="tnum mr-0.5 text-[10.5px] font-semibold text-muted">{g.n}</sup>
      {g.mark === "blank" ? <span className="text-muted">{t("resultReview.blankWord")}</span> : <span className={cn("font-semibold", !isRight(g.mark) && "line-through")}>{g.shown}</span>} <Glyph mark={g.mark} t={t} />
    </span>
  );
}

/** The four words of a cloze gap: the key outlined in cyan with a tick, the student's wrong pick in ink with a cross. */
function Options({ g, t }: { g: Gap; t: T }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("resultReview.options")}>
      {g.options.map((o, i) => (
        <li
          key={i}
          lang="de"
          className={cn(
            "rounded-[6px] border px-1.5 py-px text-[12px]",
            o.correct ? "border-accent bg-accent-soft font-semibold text-ink" : o.picked ? "border-ink bg-surface font-semibold text-ink" : "border-line bg-surface text-ink-2",
          )}
        >
          {o.text}
          {o.correct ? (
            <>
              {" "}
              <span aria-hidden className="font-bold text-accent">
                ✓
              </span>
              <span className="sr-only"> ({t("resultReview.keyPicked")})</span>
            </>
          ) : null}
          {o.picked && !o.correct ? (
            <>
              {" "}
              <span aria-hidden className="font-bold">
                ✗
              </span>
              <span className="sr-only"> ({t("resultReview.studentPicked")})</span>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function TextGapBody({ card, t }: { card: Extract<ReviewCard, { kind: "GAP" }>; t: T }) {
  const gaps = card.segments.flatMap((s) => (s.kind === "gap" ? [s] : []));
  const cloze = card.textKind === "CLOZE";
  // The text starts with the instruction and the German title: the title is a heading, not the first line of the text.
  const first = card.segments[0];
  const lead = first?.kind === "text" ? splitTextLead(first.text) : null;
  return (
    <>
      {lead?.title && lead.instruction ? (
        <p lang="de" className="text-[15px] leading-[1.6] text-ink-2">
          {lead.instruction}
        </p>
      ) : null}
      {lead?.title ? (
        <h4 lang="de" className="mb-1 mt-2 text-[16px] font-bold leading-[1.4] text-ink">
          {lead.title}
        </h4>
      ) : null}
      <p lang="de" className="whitespace-pre-line text-[15px] leading-[2] text-ink">
        {card.segments.map((s, i) => (s.kind === "text" ? <span key={i}>{i === 0 && lead?.title ? lead.rest : s.text}</span> : <InlineGap key={i} g={s} t={t} />))}
      </p>
      <p className="tnum mt-1 text-[12px] text-muted">{t("resultReview.gapsRight", { right: card.right, total: card.total })}</p>
      <ol className="mt-2 flex flex-col divide-y divide-line border-t border-line">
        {gaps.map((g) => (
          <li key={g.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-1.5 text-[12.5px]">
            <span className="tnum w-16 shrink-0 font-semibold text-muted">{t("resultReview.gapN", { n: g.n })}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted">{t("resultReview.colStudent")}</span>
              <span lang="de" className={cn("font-medium", g.mark === "blank" ? "text-muted" : "text-ink", g.mark === "wrong" && "line-through")}>
                {g.shown || t("resultReview.blankWord")}
              </span>
              <Glyph mark={g.mark} t={t} />
            </span>
            {isRight(g.mark) ? null : (
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted">{t("resultReview.colKey")}</span>
                <span lang="de" className="font-semibold text-ink">
                  {g.expected}
                </span>
              </span>
            )}
            {cloze && g.options.length ? <Options g={g} t={t} /> : null}
          </li>
        ))}
      </ol>
    </>
  );
}
