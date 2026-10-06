"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useLocale } from "next-intl";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { PathSteps } from "@/components/visual/path-steps";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { Textarea } from "@/components/ui/textarea";
import { useArrivalFocus, useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { mailTo } from "./closed";
import { devicesLine, doneFooter, surveyAfterFailure, takeLastLostWords } from "./done-model";
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
  const appLocale = useLocale();
  const locale = isLocale(appLocale) ? appLocale : DEFAULT_LOCALE;
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
  // Task 6 pattern: the page is reached by a navigation (the runner's last send, or the link again), so its title takes focus once on arrival.
  const titleRef = useArrivalFocus<HTMLHeadingElement>();

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
  const footer = doneFooter({ surveyEnabled: finished.survey.enabled, survey });

  const summary = (
    <div className="space-y-6">
      {lostLine ? <p className="text-[16px] leading-[26px] text-ink-2">{lostLine}</p> : null}
      <section aria-labelledby="done-next" className="rounded-2xl border border-line bg-surface p-card-candidate">
        <h2 id="done-next" className="mb-4 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
          {t("nextTitle")}
        </h2>
        <PathSteps
          locale={locale}
          steps={[
            { title: t("nextToday"), detail: t("sentToday"), state: "done" },
            { title: t("next", { count: state.reviewers }) },
            { title: <span className="tnum">{t("byDate", { date: feedbackBy })}</span> },
          ]}
        />
      </section>
      <div className="space-y-1 text-[14px] leading-[22px] text-muted">
        {devicesText ? <p>{devicesText}</p> : null}
        {state.contactEmail ? <p>{t.rich("contact", { email: state.contactEmail, mail: mailTo(state.contactEmail) })}</p> : null}
        {/* C19: a quiet link in the page, not the footer's back slot (whose chevron would say "back"). */}
        <p>
          <a
            href={`/a/${encodeURIComponent(token)}/rights`}
            className="inline-flex min-h-11 items-center text-muted underline decoration-underline underline-offset-4 hover:text-ink"
          >
            {t("rights")}
          </a>
        </p>
      </div>
    </div>
  );

  const surveyBlock = finished.survey.enabled ? (
    <section aria-labelledby="survey-title" className="space-y-4">
      <h2 id="survey-title" ref={surveyHeading} tabIndex={-1} className="text-[20px] leading-7 font-semibold text-ink outline-none">
        {t("surveyTitle")}
      </h2>
      {survey === "sent" ? (
        <p role="status" className="text-[16px] leading-[26px] text-ink">
          {t("surveyThanks")}
        </p>
      ) : survey === "closed" ? (
        // M2: no form and no retry; the server's words say why.
        <p role="status" className="text-[16px] leading-[26px] text-ink">
          {error ?? t("surveyClosed")}
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <ChoiceCardGroup
              type="single"
              name="survey-rating"
              size="square"
              columns={5}
              value={rating ? [rating] : []}
              onChange={(next) => setRating(next[0] ?? "")}
              labelledBy="survey-title"
              describedBy="survey-scale"
              disabled={survey === "sending"}
              items={RATINGS.map((value) => ({
                value,
                label: (
                  <>
                    <span className="tnum" aria-hidden>
                      {value}
                    </span>
                    {/* The scale's ends are named on the ends themselves, not only in the words below. */}
                    <span className="sr-only">{value === "1" ? `1, ${t("surveyLow")}` : value === "5" ? `5, ${t("surveyHigh")}` : value}</span>
                  </>
                ),
              }))}
            />
            <div id="survey-scale" className="flex justify-between text-[14px] leading-[22px] text-muted">
              <span>{t("surveyLow")}</span>
              <span>{t("surveyHigh")}</span>
            </div>
          </div>
          <Disclosure label={t("addComment")} icon={NotebookPen}>
            <label htmlFor="survey-comment" className="sr-only">
              {t("surveyComment")}
            </label>
            <Textarea
              id="survey-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              maxLength={COMMENT_MAX}
              disabled={survey === "sending"}
              rows={3}
              aria-describedby="survey-comment-count"
              className="resize-y bg-surface px-4 py-3 text-[16px] leading-[26px] md:text-[16px]"
            />
            <p id="survey-comment-count" className="tnum mt-1 text-right text-[14px] text-muted">
              {t("surveyCount", { used: comment.length, max: COMMENT_MAX })}
            </p>
          </Disclosure>
          <p className="text-[14px] leading-[22px] text-muted">{t("surveyNote")}</p>
          {survey === "failed" && error ? (
            <p role="alert" className="text-[14px] leading-[22px] text-ink">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  ) : null;

  return (
    <>
      {/* One polite line for a screen reader after the 8 second send navigates here (the button it pressed is gone).
          The title itself is said when it takes focus on arrival, so the line carries the rest. */}
      <p role="status" className="sr-only">
        {announce ? [saved, lostLine, devicesText].filter(Boolean).join(" ") : ""}
      </p>
      {surveyBlock ? (
        <StepScreen layout="split" illustration="done" title={title} titleRef={titleRef} lead={<p>{saved}</p>} aside={summary}>
          {surveyBlock}
        </StepScreen>
      ) : (
        // 3.10: without a survey the page closes: one centred column, the drawing above the title, no filled button.
        <StepScreen layout="single" width={640} illustration="done" illustrationSize="spot" title={title} titleRef={titleRef} lead={<p>{saved}</p>}>
          {summary}
        </StepScreen>
      )}
      {footer === "send" ? (
        <StepFooter
          primary={{
            kind: "button",
            id: "survey-send",
            label: t("surveySend"),
            busy: survey === "sending",
            busyLabel: t("surveySending"),
            waitReason: !rating ? t("surveyPick") : null,
            onClick: () => void send(),
          }}
        />
      ) : null}
    </>
  );
}
