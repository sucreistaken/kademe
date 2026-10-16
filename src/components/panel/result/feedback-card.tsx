import { clearFeedback, draftFeedback, saveFeedback } from "@/app/(manager)/exam/students/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingButton } from "@/components/ui/pending-button";
import { shortDateTime } from "@/components/panel/bits";
import { FEEDBACK_FORM, FEEDBACK_LIMITS, type FeedbackContent, type StudentFeedbackStore } from "@/lib/exam/student-feedback";
import type { managerT } from "@/i18n/manager";

type T = ReturnType<typeof managerT>;

const FIELD = "mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] leading-[1.5] text-ink";

/** The AI draft and the teacher's approved text as editable fields; empty rows stay empty. */
function FeedbackForm({ assessmentId, content, t }: { assessmentId: string; content: FeedbackContent; t: T }) {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i);
  return (
    <form action={saveFeedback} className="mt-4 flex flex-col gap-5">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold text-ink">{t("result.feedbackStrengths")}</legend>
        {rows(FEEDBACK_FORM.strengthRows).map((i) => (
          <textarea
            key={i}
            name={`strength${i}`}
            rows={2}
            maxLength={FEEDBACK_LIMITS.line}
            defaultValue={content.strengths[i] ?? ""}
            aria-label={t("result.feedbackStrengthN", { n: i + 1 })}
            className={FIELD}
          />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold text-ink">{t("result.feedbackImprove")}</legend>
        {rows(FEEDBACK_FORM.improveRows).map((i) => {
          const it = content.improve[i];
          return (
            <div key={i} className="rounded-[14px] bg-canvas p-3">
              <input
                name={`topic${i}`}
                maxLength={FEEDBACK_LIMITS.topic}
                defaultValue={it?.topic ?? ""}
                aria-label={t("result.feedbackTopic", { n: i + 1 })}
                placeholder={t("result.feedbackTopic", { n: i + 1 })}
                className={`${FIELD} h-10 font-semibold`}
              />
              <label className="mt-2 block text-[12.5px] text-muted">
                {t("result.feedbackWhy")}
                <textarea name={`why${i}`} rows={2} maxLength={FEEDBACK_LIMITS.why} defaultValue={it?.why ?? ""} className={FIELD} />
              </label>
              <label className="mt-2 block text-[12.5px] text-muted">
                {t("result.feedbackExample")}
                <input name={`example${i}`} lang="de" maxLength={FEEDBACK_LIMITS.example} defaultValue={it?.example ?? ""} className={`${FIELD} h-10`} />
              </label>
            </div>
          );
        })}
      </fieldset>
      <label className="text-[13px] font-semibold text-ink">
        {t("result.feedbackNext")}
        <textarea name="nextStep" rows={2} required maxLength={FEEDBACK_LIMITS.nextStep} defaultValue={content.nextStep} className={`${FIELD} font-normal`} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <PendingButton label={t("result.feedbackApprove")} pendingLabel={t("result.feedbackApproving")} />
        {/* No scope field: clearFeedback treats a missing scope as "draft only". */}
        <Button type="submit" variant="ghost" formAction={clearFeedback} formNoValidate>
          {t("result.feedbackDiscard")}
        </Button>
      </div>
      <p className="text-[12.5px] text-muted">{t("result.feedbackReportNote")}</p>
    </form>
  );
}

function ReadOnly({ content }: { content: FeedbackContent }) {
  return (
    <div className="mt-4 flex flex-col gap-3 text-[13.5px] leading-[1.55] text-ink-2">
      {content.strengths.length ? (
        <ul className="list-disc pl-5">
          {content.strengths.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}
      {content.improve.length ? (
        <ul className="flex flex-col gap-1.5">
          {content.improve.map((i) => (
            <li key={i.topic}>
              <span className="font-semibold text-ink">{i.topic}.</span> {i.why}
              {i.example ? (
                <span lang="de" className="ml-1 italic text-ink">
                  ({i.example})
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p>{content.nextStep}</p>
    </div>
  );
}

/**
 * The note for the student: the AI drafts, the teacher edits and approves, and
 * only the approved text reaches the PDF report. Every button is an outline
 * one (the screen's filled button is "finalize"); the draft is labelled as
 * such until a teacher has approved it.
 */
export function FeedbackCard({
  assessmentId,
  feedback,
  ended,
  canGrade,
  nameOf,
  locale,
  t,
}: {
  assessmentId: string;
  feedback: StudentFeedbackStore | null;
  ended: boolean;
  canGrade: boolean;
  nameOf: Record<string, string>;
  locale: string;
  t: T;
}) {
  const draft = feedback?.draft ?? null;
  const approved = feedback?.approved ?? null;
  const approver = feedback?.approvedBy ? (nameOf[feedback.approvedBy] ?? "") : "";
  const drafting = (
    <form action={draftFeedback}>
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <PendingButton
        label={draft || approved ? t("result.feedbackRedraft") : t("result.feedbackDraftButton")}
        pendingLabel={t("result.feedbackDrafting")}
        reason={ended ? null : t("result.feedbackNotEnded")}
      />
      {ended ? null : <DisabledReason>{t("result.feedbackNotEnded")}</DisabledReason>}
    </form>
  );
  return (
    <Card id="feedback" className="mt-6 scroll-mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-ink">{t("result.feedbackTitle")}</h2>
          <p className="mt-1 max-w-[520px] text-[13px] leading-[1.5] text-muted">{t("result.feedbackIntro")}</p>
        </div>
        {canGrade ? drafting : null}
      </div>

      {draft ? (
        <>
          <Badge tone="sun" size="md" className="mt-4">
            {t("result.feedbackBadgeDraft")}
          </Badge>
          {canGrade ? <FeedbackForm assessmentId={assessmentId} content={draft} t={t} /> : <ReadOnly content={draft} />}
        </>
      ) : approved && feedback ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="mint" size="md">
              {t("result.feedbackBadgeApproved")}
            </Badge>
            <span className="text-[12.5px] text-muted">
              {t("result.feedbackApprovedBy", { name: approver || "-", date: shortDateTime(feedback.approvedAt ? new Date(feedback.approvedAt) : null, locale) })}
              {feedback.edited ? ` · ${t("result.feedbackEdited")}` : ""}
            </span>
          </div>
          <ReadOnly content={approved} />
          {canGrade ? (
            <div className="mt-4 flex flex-wrap items-start gap-4">
              <details className="min-w-[280px] flex-1">
                <summary className="cursor-pointer text-[13px] font-medium text-ink underline underline-offset-2">{t("result.feedbackEdit")}</summary>
                <FeedbackForm assessmentId={assessmentId} content={approved} t={t} />
              </details>
              <form action={clearFeedback}>
                <input type="hidden" name="assessmentId" value={assessmentId} />
                <input type="hidden" name="scope" value="all" />
                <Button type="submit" variant="ghost" size="sm">
                  {t("result.feedbackRemove")}
                </Button>
              </form>
            </div>
          ) : null}
          <p className="mt-3 text-[12.5px] text-muted">{t("result.feedbackReportNote")}</p>
        </>
      ) : (
        <p className="mt-4 text-[13.5px] leading-[1.55] text-ink-2">{t("result.feedbackNone")}</p>
      )}
    </Card>
  );
}
