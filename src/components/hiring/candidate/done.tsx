"use client";

import { useEffect, useRef, useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import { mailTo } from "./closed";
import { devicesLine, surveyAfterFailure, takeLastLostWords } from "./done-model";
import { sessionDrafts, type LostKind } from "./draft-store";
import { withTimeout } from "./runner-steps";
import { serverMessage } from "./server-message";
import { stopAllStreams } from "./streams";

/** The server cuts a comment at 1000 UTF-16 units; the field counts the same units and says the limit. */
const COMMENT_MAX = 1000;
/** A send that hangs gives the button back with a retry instead of "Gönderiliyor" forever. */
const REQUEST_MS = 20_000;
const RATINGS = ["1", "2", "3", "4", "5"] as const;

type Finished = NonNullable<HiringCandidateState["finished"]>;

/**
 * HIRING-UX 6.13 and A9: done, thanks, what happens next, by when and who to
 * write to; the devices are switched off and the candidate is told so; then
 * the optional survey, once. Without the survey the page has no filled button:
 * it is a closing page. The same link brings the candidate back here (the
 * server sends a finished link nowhere else). The decision's status line
 * arrives with plan 3, so nothing here says the status will be shown.
 */
export function Done({ token, state, feedbackBy }: { token: string; state: HiringCandidateState & { finished: Finished }; feedbackBy: string }) {
  const t = useT("hiringDone");
  const finished = state.finished;
  const devices = devicesLine(state.devices);
  const [lost, setLost] = useState<LostKind | null>(null);
  // M3: the "switched off" line appears only once the stop has run.
  const [stopped, setStopped] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [rating, setRating] = useState<string>("");
  const [comment, setComment] = useState("");
  // Task 5: the server says whether this invitation's survey is answered, so a reload shows the thanks.
  // "closed" (M2): the survey was switched off or the server sees no finish; the form is gone for good.
  const [survey, setSurvey] = useState<"open" | "sending" | "sent" | "failed" | "closed">(finished.survey.answered ? "sent" : "open");
  const [error, setError] = useState<string | null>(null);
  // M4: one send at a time, also against a second click in the same tick.
  const sending = useRef(false);
  // When the form gives way (sent or closed) focus moves to the survey's heading; a retry keeps it on the button.
  const surveyHeading = useStepFocus<HTMLHeadingElement>(survey === "sent" || survey === "closed" ? survey : "form");

  useEffect(() => {
    // Task 12 carry: every stream this tab still holds is stopped here; the device check and each
    // take stop their own already, so the line does not wait on a count. It is said only when the
    // assessment used a device at all (devicesLine).
    stopAllStreams();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStopped(true);
    // Task 13 carry: a save the server refused after the last stage's deadline is said once, here.
    const kind = takeLastLostWords(
      sessionDrafts(),
      token,
      state.stages.map((s) => s.position),
    );
    // React may run this effect twice in development: the second read finds the flag cleared and keeps the first.
    if (kind) setLost(kind);
    // Minor 9 (Task 13): a status that arrives with a client navigation is read out only when filled in after it.
    const id = window.setTimeout(() => setAnnounce(true), 250);
    return () => window.clearTimeout(id);
  }, [token, state.stages]);

  async function send() {
    if (sending.current || !rating) return;
    sending.current = true;
    setSurvey("sending");
    setError(null);
    try {
      await withTimeout(apiSend(token, "/hiring/survey", { rating: Number(rating), comment }), REQUEST_MS);
      setSurvey("sent");
    } catch (err) {
      const next = surveyAfterFailure(err);
      setSurvey(next);
      // Never the browser's raw network text: the server's own words for a refusal, else ours.
      if (next === "failed") setError(serverMessage(err) ?? t("surveyFailed"));
      if (next === "closed") setError(serverMessage(err) ?? t("surveyClosed"));
    } finally {
      sending.current = false;
    }
  }

  const title = state.candidateName ? t("title", { name: state.candidateName }) : t("titleNoName");
  const saved = t("saved", { count: finished.stagesDone });
  const lostLine = lost === "text" ? t("lostText") : lost === "choice" ? t("lostChoice") : null;
  const devicesText = !stopped ? null : devices === "cameraAndMicrophone" ? t("devicesOff") : devices === "microphone" ? t("micOff") : null;
  const why = !rating ? t("surveyPick") : undefined;

  return (
    <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
      {/* One polite line for a screen reader after the 8 second send navigates here (the button it pressed is gone). */}
      <p role="status" className="sr-only">
        {announce ? [title, saved, lostLine, devicesText].filter(Boolean).join(" ") : ""}
      </p>
      <h1 className="text-[28px] leading-9 font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink">{saved}</p>
      {lostLine ? <p className="mt-2 text-[16px] leading-[26px] text-ink-2">{lostLine}</p> : null}
      <div className="mt-6 space-y-2 rounded-2xl border border-line bg-surface p-card-candidate text-[16px] leading-[26px] text-ink">
        <p>{t("next", { count: state.reviewers })}</p>
        <p className="tnum font-medium">{t("byDate", { date: feedbackBy })}</p>
        {state.contactEmail ? <p>{t.rich("contact", { email: state.contactEmail, mail: mailTo(state.contactEmail) })}</p> : null}
      </div>
      {devicesText ? (
        <p className="mt-4 flex items-center gap-2 text-[14px] leading-[22px] text-muted">
          <span className="size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
          {devicesText}
        </p>
      ) : null}

      {finished.survey.enabled ? (
        <section className="mt-10" aria-labelledby="survey-title">
          <h2 id="survey-title" ref={surveyHeading} tabIndex={-1} className="text-[20px] leading-7 font-semibold text-ink outline-none">
            {t("surveyTitle")}
          </h2>
          {survey === "sent" ? (
            <p role="status" className="mt-3 text-[16px] leading-[26px] text-ink">
              {t("surveyThanks")}
            </p>
          ) : survey === "closed" ? (
            // M2: no form and no retry; the server's words say why.
            <p role="status" className="mt-3 text-[16px] leading-[26px] text-ink">
              {error ?? t("surveyClosed")}
            </p>
          ) : (
            <>
              <RadioGroup
                value={rating}
                onValueChange={setRating}
                disabled={survey === "sending"}
                aria-labelledby="survey-title"
                aria-describedby="survey-scale"
                className="mt-4 grid grid-cols-5 gap-2"
              >
                {RATINGS.map((value) => (
                  <label
                    key={value}
                    className="relative flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-[16px] text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft has-[[data-state=checked]]:font-semibold"
                  >
                    {/* The scale's ends are named on the ends themselves, not only in the hint below. */}
                    <RadioGroupItem
                      value={value}
                      aria-label={value === "1" ? `1, ${t("surveyLow")}` : value === "5" ? `5, ${t("surveyHigh")}` : value}
                      // The shadcn item is `relative size-4`: these win the merge, so the dot takes no room and the tile shows focus.
                      className="sr-only absolute size-px"
                    />
                    <span className="tnum" aria-hidden>
                      {value}
                    </span>
                  </label>
                ))}
              </RadioGroup>
              <div id="survey-scale" className="mt-1 flex justify-between text-[14px] leading-[22px] text-muted">
                <span>1: {t("surveyLow")}</span>
                <span>5: {t("surveyHigh")}</span>
              </div>
              <label className="mt-5 block" htmlFor="survey-comment">
                <span className="text-[16px] font-medium text-ink">{t("surveyComment")}</span>
              </label>
              <Textarea
                id="survey-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
                maxLength={COMMENT_MAX}
                disabled={survey === "sending"}
                rows={3}
                aria-describedby="survey-comment-count"
                className="mt-2 resize-y bg-surface px-4 py-3 text-[16px] leading-[26px] md:text-[16px]"
              />
              <p id="survey-comment-count" className="tnum mt-1 text-right text-[14px] text-muted">
                {t("surveyCount", { used: comment.length, max: COMMENT_MAX })}
              </p>
              <p className="mt-2 text-[14px] leading-[22px] text-muted">{t("surveyNote")}</p>
              <ActionBar>
                {/* Disabled for want of a rating says why. While it sends it stays focusable (aria-disabled, M4),
                    so a keyboard user's focus is still here when a failure offers the retry; its label says so. */}
                <Button
                  id="survey-send"
                  variant="primary"
                  size="lg"
                  className="w-full text-[16px] aria-disabled:cursor-wait aria-disabled:opacity-70 sm:w-auto"
                  disabled={!rating}
                  disabledReason={why}
                  aria-disabled={survey === "sending" || undefined}
                  onClick={send}
                >
                  {survey === "sending" ? t("surveySending") : t("surveySend")}
                </Button>
                {why ? (
                  <DisabledReason id="survey-send-why" className="mt-2 text-[14px]">
                    {why}
                  </DisabledReason>
                ) : null}
                {survey === "failed" && error ? (
                  <p role="alert" className="mt-2 text-[14px] leading-[22px] text-ink">
                    {error}
                  </p>
                ) : null}
              </ActionBar>
            </>
          )}
        </section>
      ) : null}

      <p className="mt-10 text-center text-[14px]">
        <a
          href={`/a/${encodeURIComponent(token)}/rights`}
          className="inline-flex min-h-11 items-center text-muted underline decoration-underline underline-offset-4 hover:text-ink"
        >
          {t("rights")}
        </a>
      </p>
    </div>
  );
}
