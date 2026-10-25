import { Star } from "lucide-react";
import { Dot, shortDateTime } from "@/components/panel/bits";
import { Card } from "@/components/ui/card";
import { FEEDBACK_SCALE } from "@/lib/exam/feedback";
import type { managerT } from "@/i18n/manager";
import type { StoredFeedback } from "@/server/exam-feedback";

type T = ReturnType<typeof managerT>;

/**
 * A rating as five small stars. The word beside it ("4 von 5") carries the
 * meaning; the stars are the glance, so they are hidden from a screen reader.
 */
export function StarsReadout({ value, className }: { value: number; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex items-center gap-0.5 ${className ?? ""}`}>
      {FEEDBACK_SCALE.map((n) => (
        <Star key={n} strokeWidth={1.75} className={n <= Math.round(value) ? "size-4 fill-yellow text-ink" : "size-4 fill-transparent text-line-strong"} />
      ))}
    </span>
  );
}

/**
 * "Rückmeldung des Prüflings" on the result page: what the student rated after
 * the exam. Small and read-only; it is about the exam experience and never
 * touches the result (the note says so). A question the student skipped reads
 * as skipped, not as a zero.
 */
export function ExamFeedbackBox({ feedback, locale, t, className }: { feedback: StoredFeedback; locale: string; t: T; className?: string }) {
  const rating = (value: number | null) => (value === null ? t("examFeedback.skipped") : t("examFeedback.ratingOf", { n: value }));
  return (
    <Card className={`p-5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-semibold text-ink">
          {t("examFeedback.boxTitle")}
        </h2>
        <span className="tnum text-[12.5px] text-muted">{t("examFeedback.boxSent", { date: shortDateTime(feedback.createdAt, locale) })}</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-[13px] text-muted">{t("examFeedback.overall")}</span>
        <StarsReadout value={feedback.overall} />
        <span className="tnum text-[14px] font-semibold text-ink">{t("examFeedback.ratingOf", { n: feedback.overall })}</span>
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
        <div>
          <dt className="text-[12.5px] text-muted">{t("examFeedback.clarity")}</dt>
          <dd className="tnum mt-0.5 text-[14px] font-medium text-ink">{rating(feedback.clarity)}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-muted">{t("examFeedback.usability")}</dt>
          <dd className="tnum mt-0.5 text-[14px] font-medium text-ink">{rating(feedback.usability)}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-muted">{t("examFeedback.technical")}</dt>
          <dd className="mt-0.5 text-[14px] font-medium text-ink">
            {feedback.technicalProblem === null ? (
              t("examFeedback.skipped")
            ) : feedback.technicalProblem ? (
              <Dot tone="warn">{t("examFeedback.technicalYes")}</Dot>
            ) : (
              t("examFeedback.technicalNo")
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <h3 className="text-[12.5px] text-muted">{t("examFeedback.comment")}</h3>
        {feedback.comment ? (
          <p lang={feedback.locale} dir="auto" className="mt-0.5 text-[14px] leading-[1.55] whitespace-pre-line text-ink">
            {feedback.comment}
          </p>
        ) : (
          <p className="mt-0.5 text-[14px] text-muted">{t("examFeedback.noComment")}</p>
        )}
      </div>
      <p className="mt-4 text-[12px] text-muted">{t("examFeedback.boxNote")}</p>
    </Card>
  );
}
