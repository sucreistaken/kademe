"use client";

import { useId, useState } from "react";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { FEEDBACK_COMMENT_MAX, FEEDBACK_SCALE } from "@/lib/exam/feedback";
import { useT } from "@/i18n/candidate-client";

export type FeedbackPhase = "open" | "sending" | "failed" | "sent" | "skipped";

/** What the student has chosen so far; `null` is "not answered". */
export type FeedbackDraft = {
  overall: number | null;
  clarity: number | null;
  usability: number | null;
  technicalProblem: boolean | null;
  comment: string;
};

export const EMPTY_FEEDBACK: FeedbackDraft = { overall: null, clarity: null, usability: null, technicalProblem: null, comment: "" };

/** The body the route takes: the comment trimmed, empty as null. */
export function feedbackBody(draft: FeedbackDraft) {
  const comment = draft.comment.trim();
  return {
    overall: draft.overall,
    clarity: draft.clarity,
    usability: draft.usability,
    technicalProblem: draft.technicalProblem,
    comment: comment ? comment : null,
  };
}

/**
 * Sends the answer; "failed" is anything that did not arrive (the card then keeps
 * what was typed and offers a retry). Nothing is sent without the one required
 * answer, the overall rating. `post` is the transport, injectable for tests.
 */
export async function submitFeedback(
  token: string,
  draft: FeedbackDraft,
  post: (token: string, path: string, body: unknown) => Promise<unknown> = apiSend,
): Promise<"sent" | "failed" | "incomplete"> {
  if (draft.overall === null) return "incomplete";
  try {
    await post(token, "/exam/feedback", feedbackBody(draft));
    return "sent";
  } catch {
    return "failed";
  }
}

const FOCUS = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
const SEGMENT =
  "tnum grid h-11 cursor-pointer place-items-center rounded-lg border-2 border-line bg-surface text-[15px] font-bold text-ink shadow-lip-soft " +
  "transition-[color,background-color,border-color] duration-[120ms] ease-out hover:bg-canvas motion-reduce:transition-none " +
  "has-[:checked]:border-accent has-[:checked]:bg-brand-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 " +
  FOCUS;

/**
 * The overall rating: five stars as a radio group (native radios, so Tab,
 * the arrow keys and a screen reader work as everywhere). The filled stars are
 * the chosen value and every star has a name ("4 out of 5"); the chosen value
 * also appears in words under the row, so colour is never the only cue.
 */
function StarRating({
  name,
  value,
  onChange,
  disabled,
  starName,
  word,
}: {
  name: string;
  value: number | null;
  onChange(next: number): void;
  disabled: boolean;
  starName(n: number): string;
  word: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        {FEEDBACK_SCALE.map((n) => (
          <label key={n} className={cn("relative grid size-11 cursor-pointer place-items-center rounded-lg has-[:disabled]:cursor-not-allowed", FOCUS)}>
            <input type="radio" name={name} value={n} checked={value === n} disabled={disabled} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="sr-only">{starName(n)}</span>
            <Star
              aria-hidden
              strokeWidth={1.75}
              className={cn(
                "size-8 transition-colors duration-[120ms] motion-reduce:transition-none",
                value !== null && n <= value ? "fill-yellow text-ink" : "fill-transparent text-line-strong peer-enabled:hover:text-ink-3",
              )}
            />
          </label>
        ))}
      </div>
      <p aria-live="polite" className="mt-1 min-h-6 text-[15px] font-bold text-ink">
        {word}
      </p>
    </div>
  );
}

/** A 1-5 question with its two ends named under the row, or a two-way (yes/no) question. */
function Scale({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
  hint,
  ends,
  className,
}: {
  name: string;
  legend: string;
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange(next: string): void;
  disabled: boolean;
  hint?: string;
  ends?: { low: string; high: string };
  className?: string;
}) {
  const hintId = useId();
  return (
    <fieldset className="min-w-0" aria-describedby={ends || hint ? hintId : undefined}>
      <legend className="text-[15px] font-bold leading-[1.4] text-ink">{legend}</legend>
      <div className={cn("mt-2 grid gap-2", options.length === 5 ? "grid-cols-5" : "grid-cols-2", className)}>
        {options.map((o) => (
          <label key={o.value} className={SEGMENT}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={disabled} onChange={() => onChange(o.value)} className="peer sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {ends ? (
        <p id={hintId} className="mt-1 flex justify-between gap-4 text-[13.5px] leading-[1.4] text-ink-2">
          <span>{ends.low}</span>
          <span className="text-end">{ends.high}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-[13.5px] leading-[1.4] text-ink-2">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The survey card, as a pure view of its state. Calm and skippable: it sits
 * under the closing card, never over it, and asks for nothing but the stars.
 * Choosing a star opens the rest (two quick questions, the technical-problem
 * question, an optional comment) and the one filled button. It shows no score
 * and no level of the exam, and says its answer does not change the result.
 */
export function FeedbackCard({
  phase,
  draft,
  onChange,
  onSend,
  onSkip,
}: {
  phase: FeedbackPhase;
  draft: FeedbackDraft;
  onChange(patch: Partial<FeedbackDraft>): void;
  onSend(): void;
  onSkip(): void;
}) {
  const t = useT("feedback");
  const id = useId();
  // The heading takes focus when the form gives way to the thanks (the button that was pressed is gone).
  const heading = useStepFocus<HTMLHeadingElement>(phase === "sent" ? "sent" : "form");
  if (phase === "skipped") return null;
  const locked = phase === "sending";
  const sent = phase === "sent";
  const rated = draft.overall !== null;
  const triState = (v: boolean | null) => (v === null ? null : v ? "yes" : "no");
  const scaleOptions = FEEDBACK_SCALE.map((n) => ({ value: String(n), label: String(n) }));

  return (
    <section aria-labelledby={`${id}-title`} className="mt-4 rounded-2xl border border-line bg-surface px-6 py-6 shadow-card sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="text-[18px] font-extrabold leading-[1.3] text-ink outline-none">
          {t("title")}
        </h2>
        {sent ? null : <span className="text-[13px] font-semibold text-ink-3">{t("optional")}</span>}
      </div>

      {sent ? (
        <p role="status" className="mt-3 flex items-start gap-2.5 text-[15px] font-semibold leading-[1.55] text-ink">
          <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
            <Check className="size-3" strokeWidth={3.5} />
          </span>
          {t("thanks")}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[14px] leading-[1.55] text-ink-2">{t("intro")}</p>

          <fieldset className="mt-4 min-w-0">
            <legend className="text-[15px] font-bold leading-[1.4] text-ink">{t("overallLabel")}</legend>
            <div className="mt-1">
              <StarRating
                name={`${id}-overall`}
                value={draft.overall}
                onChange={(overall) => onChange({ overall })}
                disabled={locked}
                starName={(n) => t("star", { n })}
                word={draft.overall === null ? "" : t(`word${draft.overall as 1 | 2 | 3 | 4 | 5}`)}
              />
            </div>
          </fieldset>

          {rated ? (
            <div className="mt-2 space-y-5 border-t border-row-line pt-5">
              <Scale
                name={`${id}-clarity`}
                legend={t("clarityLabel")}
                options={scaleOptions}
                value={draft.clarity === null ? null : String(draft.clarity)}
                onChange={(v) => onChange({ clarity: Number(v) })}
                disabled={locked}
                ends={{ low: t("clarityLow"), high: t("clarityHigh") }}
              />
              <Scale
                name={`${id}-usability`}
                legend={t("usabilityLabel")}
                options={scaleOptions}
                value={draft.usability === null ? null : String(draft.usability)}
                onChange={(v) => onChange({ usability: Number(v) })}
                disabled={locked}
                ends={{ low: t("usabilityLow"), high: t("usabilityHigh") }}
              />
              <Scale
                name={`${id}-technical`}
                legend={t("technicalLabel")}
                hint={t("technicalHint")}
                options={[
                  { value: "yes", label: t("yes") },
                  { value: "no", label: t("no") },
                ]}
                value={triState(draft.technicalProblem)}
                onChange={(v) => onChange({ technicalProblem: v === "yes" })}
                disabled={locked}
                className="max-w-[18rem]"
              />
              <div>
                <label htmlFor={`${id}-comment`} className="text-[15px] font-bold leading-[1.4] text-ink">
                  {t("commentLabel")}
                </label>
                <Textarea
                  id={`${id}-comment`}
                  rows={3}
                  value={draft.comment}
                  maxLength={FEEDBACK_COMMENT_MAX}
                  disabled={locked}
                  aria-describedby={`${id}-count`}
                  onChange={(e) => onChange({ comment: e.target.value })}
                  className="mt-2 text-[16px] md:text-[16px]"
                />
                <p id={`${id}-count`} className="tnum mt-1 text-end text-[13.5px] text-ink-3">
                  {t("commentCount", { used: draft.comment.length, max: FEEDBACK_COMMENT_MAX })}
                </p>
              </div>
            </div>
          ) : null}

          {phase === "failed" ? (
            <Notice role="alert" className="mt-4">
              {t("failed")}
            </Notice>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" onClick={onSkip} disabled={locked}>
              {t("skip")}
            </Button>
            {rated ? (
              <Button variant="primary" onClick={onSend} disabled={locked} aria-busy={locked}>
                {locked ? t("sending") : phase === "failed" ? t("retry") : t("send")}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The survey on the finished screen. `answered` is the server's word that this
 * invitation already has an answer: then the card does not come back (reload,
 * second tab). The answer goes to the exam's feedback route; a second send is
 * absorbed by the server, so a retry after a lost reply ends on the thanks too.
 */
export function ExamFeedback({ token, answered }: { token: string; answered: boolean }) {
  const [phase, setPhase] = useState<FeedbackPhase>("open");
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_FEEDBACK);
  if (answered) return null;

  async function send() {
    if (draft.overall === null || phase === "sending") return;
    setPhase("sending");
    const outcome = await submitFeedback(token, draft);
    setPhase(outcome === "sent" ? "sent" : "failed");
  }

  return (
    <FeedbackCard
      phase={phase}
      draft={draft}
      onChange={(patch) => {
        setDraft((d) => ({ ...d, ...patch }));
        if (phase === "failed") setPhase("open");
      }}
      onSend={send}
      onSkip={() => setPhase("skipped")}
    />
  );
}
