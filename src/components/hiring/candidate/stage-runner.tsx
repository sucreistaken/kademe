"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiGet, apiSend } from "@/lib/client/api";
import { FlushRegistry } from "@/lib/client/flush-registry";
import { useStageClock } from "@/lib/client/use-stage-clock";
import { formatCountdown, SUBMIT_SLACK_MS } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import { progressOf } from "@/solutions/hiring/rules/candidate-flow";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import { ActionBar } from "./action-bar";
import { ChoiceActivity } from "./choice-activity";
import { noSubscribe } from "./desktop-gate";
import { FileActivity } from "./file-activity";
import { clearDraft, draftKey, lostWords, markLostWords, sessionDrafts, type LostKind } from "./draft-store";
import { answeredLocally, isLastMinute, minutesLeft, ownsPrimary, primaryKey, resumeOf, tabReply, type LocalAnswer, type TabMessage } from "./runner-model";
import { RecordedActivity } from "./recorded-activity";
import { closeQuestion, commitNeeded, recoveryFor, settleWithin, withTimeout } from "./runner-steps";
import { serverMessage } from "./server-message";
import { StageIntro } from "./stage-intro";
import { SubmitDelay } from "./submit-delay";
import { TextActivity } from "./text-activity";
import { uploadSink } from "./upload-sink";

/** Minor 10: how long a start, commit or submit may take before the runner stops waiting and offers a retry. */
const REQUEST_MS = 20_000;
/**
 * Fix round 2: how long a close waits for pending autosaves. A commit carries
 * its own answer, so a hung save never blocks it; a submit (the candidate's or
 * the one when time is up) carries no answer, so a draft whose save has not
 * landed within this bound is not part of what the stage closes with.
 */
const FLUSH_MS = 5_000;
/**
 * Task 14: how long a close waits for a take that is still finishing (its last
 * part and its completion). Past it the stage still closes (the server counts
 * an uploading take) and the upload goes on in this tab.
 */
const TAKE_FLUSH_MS = 30_000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const codeOf = (err: unknown) => (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "");

/** `retry`: what the filled button does again after a failure ("submit": only the stage's submit, the question is closed already). */
type Failure = { message: string; stale: boolean; retry?: "submit" | "auto" };

/** The answer a question closes with: what this tab holds now (never a copy taken at the click). */
function answerOf(activity: CandidateActivity, a: LocalAnswer | undefined): unknown {
  if (activity.type === "LONG_TEXT" || activity.type === "SHORT_TEXT") return { text: a?.text ?? "" };
  if (activity.type === "SINGLE_CHOICE" || activity.type === "MULTI_CHOICE") return { choiceIds: a?.choiceIds ?? [] };
  // HIRING-UX A7: the written alternative closes with its text; a take is already on the server.
  if ((activity.type === "VIDEO" || activity.type === "AUDIO") && a?.usedTextAlternative) return { usedTextAlternative: true, text: a.text ?? "" };
  return undefined;
}

/** Reads the page again from the server: a fresh runner from the fresh state (router.refresh() keeps this runner when the stage is the same). */
const reloadPage = () => window.location.reload();

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/**
 * One stage (HIRING-UX 6.5-6.12): the intro, a resume gate after a reload,
 * one question at a time under the server's clock, and the way out (the next
 * stage's intro, or the finish after an 8 second delay). The client decides
 * nothing that matters: every write names its stage and question, and the
 * server answers with the next state.
 *
 * Nothing typed is lost (ruling 3): every question saves itself
 * (save-queue.ts), and every close (next question, finish, time up) first
 * flushes all pending saves and then sends the answer the tab holds. At 0:00
 * the runner flushes and asks the server to close the stage; the server
 * decides (a CLOCK close keeps everything written). A second tab steps back
 * without touching the first tab's work, and never submits for it.
 */
export function StageRunner({ token, initial, deadline, locale }: { token: string; initial: HiringCandidateState; deadline: string; locale: Locale }) {
  const t = useT("hiringStage");
  const tm = useT("hiringMedia");
  const tf = useT("hiringFile");
  const router = useRouter();
  const [state, setState] = useState(initial);
  const current = state.current!;
  const activities = current.stage.activities;
  // The stage run's identity (its start): keys the tab's draft copies, so a later run never sees them.
  const runId = current.startedAt ?? "";
  const [phase, setPhase] = useState<"intro" | "resume" | "question">(current.startedAt ? "resume" : "intro");
  // Ruling 2: a reload opens on the first open question, with the saved answers.
  const [index, setIndex] = useState(() => resumeOf(current.responses).index);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(() => resumeOf(current.responses).answers);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [delayed, setDelayed] = useState<null | (() => Promise<void>)>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [flushes] = useState(() => new FlushRegistry());
  // Takes that are recording or finishing (Task 14) and files uploading (Task 15): a close waits for their finish.
  const [takes] = useState(() => new FlushRegistry());
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const activity = activities[Math.min(index, activities.length - 1)] as CandidateActivity | undefined;
  const heading = useStepFocus<HTMLHeadingElement>(`${phase}-${index}`);
  const base = `/a/${encodeURIComponent(token)}`;
  // Read inside async steps that outlive the render they started in.
  const answersRef = useRef(answers);
  const autoStarted = useRef(false);
  const undone = useRef(false);
  useEffect(() => {
    answersRef.current = answers;
  });
  // "Geri al" took the strip away: focus goes back to the button that was pressed, enabled again now.
  useEffect(() => {
    if (delayed || !undone.current) return;
    undone.current = false;
    document.getElementById("activity-next")?.focus();
  }, [delayed]);

  /** Every pending save, and every take still finishing, each within its own bound; never fails. */
  const settlePending = useCallback(
    () => Promise.all([settleWithin(flushes.flushAll(), FLUSH_MS), settleWithin(takes.flushAll(), TAKE_FLUSH_MS)]),
    [flushes, takes],
  );

  const failureOf = useCallback((err: unknown, retry?: Failure["retry"]): Failure => {
    // A server refusal speaks the candidate's language; a dropped connection's browser text is never shown (C15/ruling 5).
    return { message: serverMessage(err) ?? t("failed"), stale: recoveryFor(codeOf(err)) === "reload", retry };
  }, [t]);

  const go = useCallback(
    (next: HiringCandidateState) => {
      router.replace(`${base}${next.path}`);
      router.refresh();
    },
    [router, base],
  );

  const submit = useCallback(
    async (auto: boolean) => {
      setBusy(true);
      setFailure(null);
      await settlePending();
      try {
        let next: HiringCandidateState;
        try {
          next = await withTimeout(apiSend<HiringCandidateState>(token, "/hiring/stage/submit", { stagePosition: current.position }), REQUEST_MS);
        } catch (err) {
          // At 0:00 the request can race the server's own clock; past the slack the server closes the stage either way.
          if (!auto) throw err;
          await wait(SUBMIT_SLACK_MS + 1000);
          await settlePending();
          next = await withTimeout(apiSend<HiringCandidateState>(token, "/hiring/stage/submit", { stagePosition: current.position }), REQUEST_MS);
        }
        go(next);
      } catch (err) {
        const f = failureOf(err, auto ? "auto" : "submit");
        // At 0:00 the server already moved on (a closed stage): show where the candidate really is.
        if (auto && f.stale) return reloadPage();
        setFailure(f);
        setBusy(false);
      }
    },
    [settlePending, token, current.position, go, failureOf],
  );

  const clock = useStageClock(token, { serverNow: Date.parse(current.serverNow), deadlineAt: current.deadlineAt ? Date.parse(current.deadlineAt) : null }, () => {
    setTimeUp(true);
    setDelayed(null);
  });

  // Time up (ruling 4): once nothing else is in flight, flush and let the server close the stage.
  // A tab that stepped back for another one never submits for it.
  const autoDue = timeUp && current.autoSubmit && !busy && !blocked;
  useEffect(() => {
    if (!autoDue || autoStarted.current) return;
    autoStarted.current = true;
    void submit(true);
  }, [autoDue, submit]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const id = crypto.randomUUID();
    const channel = new BroadcastChannel(`kademe-hiring-${token}`);
    let isBlocked = false;
    channel.onmessage = (e: MessageEvent<TabMessage>) => {
      const { reply, blocked: nowBlocked } = tabReply(id, e.data, isBlocked);
      if (reply) channel.postMessage(reply);
      if (nowBlocked && !isBlocked) {
        isBlocked = true;
        setBlocked(true);
      }
    };
    channel.postMessage({ type: "hello", id } satisfies TabMessage);
    return () => channel.close();
  }, [token]);

  /**
   * A save the server refused: say so. A save refused after the deadline carried words that are
   * not kept; the next stage's intro says that honestly (Minor 6). Past 0:00 the time-up flow speaks.
   */
  const onRefused = useCallback(
    (err: unknown, kind: LostKind | null) => {
      // A file refused after the deadline is not "words lost": the earlier file (if any) stays the answer.
      if (kind && codeOf(err) === "STAGE_EXPIRED") markLostWords(sessionDrafts(), token, current.position, kind);
      if (timeUp && codeOf(err) === "STAGE_EXPIRED") return;
      setFailure(failureOf(err));
    },
    [timeUp, failureOf, token, current.position],
  );
  const lostPrevious = useSyncExternalStore(
    noSubscribe,
    () => (current.previous ? lostWords(sessionDrafts(), token, current.previous.position) : null),
    () => null,
  );

  async function start() {
    setBusy(true);
    setFailure(null);
    try {
      const next = await withTimeout(apiSend<HiringCandidateState>(token, "/hiring/stage/start", { stagePosition: current.position }), REQUEST_MS);
      // Another tab may have moved on already: follow the server.
      if (!next.current || next.current.position !== current.position) return go(next);
      const resumed = resumeOf(next.current.responses);
      setState(next);
      setAnswers(resumed.answers);
      setIndex(resumed.index);
      setPhase("question");
      setBusy(false);
    } catch (err) {
      setFailure(failureOf(err));
      setBusy(false);
    }
  }

  /** Closes the open question (with its latest answer) and moves on; the last question also closes the stage. */
  function advance() {
    if (!activity) return void submit(false);
    const target = activity;
    const at = index;
    const last = at === activities.length - 1;
    // Review Critical: a question the server shows closed (no way back) is not committed again;
    // the stage's last one then goes straight to the stage submit (runner-steps closeQuestion).
    const skipCommit = !commitNeeded({ responses: current.responses, activityId: target.id, backNavigation: current.backNavigation });
    const run = async () => {
      setDelayed(null);
      setBusy(true);
      setFailure(null);
      await settlePending();
      try {
        const result = await closeQuestion({
          last,
          skipCommit,
          commit: async () => {
            const answer = answerOf(target, answersRef.current[target.id]);
            const next = await withTimeout(
              apiSend<HiringCandidateState>(token, "/hiring/response/commit", { stagePosition: current.position, activityId: target.id, ...(answer === undefined ? {} : { answer }) }),
              REQUEST_MS,
            );
            // The server holds the closed answer now; the tab's copy is not needed any more.
            clearDraft(sessionDrafts(), draftKey(token, current.position, runId, target.id));
            return next;
          },
          submit: () => submit(false),
        });
        if (result.kind === "advanced") {
          setState(result.next);
          setIndex(at + 1);
          setBusy(false);
        } else if (result.kind === "skipped") {
          // A closed question that is not the last (no way back): move on without a commit.
          setIndex(at + 1);
          setBusy(false);
        }
      } catch (err) {
        setFailure(failureOf(err));
        setBusy(false);
      }
    };
    if (last && current.last) setDelayed(() => run);
    else void run();
  }

  if (blocked) {
    return (
      <div className="mx-auto max-w-[640px] py-16">
        <p role="alert" className="text-[18px] leading-7 text-ink">
          {t("otherTab")}
        </p>
        {/* Minor 7: once the other tab is closed, a reload here takes the assessment over. */}
        <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("otherTabClosed")}</p>
        <Button className="mt-5 min-h-11 text-[16px]" onClick={reloadPage}>
          {t("reload")}
        </Button>
      </div>
    );
  }

  const failureLine = failure ? (
    <p role="alert" className="mt-4 text-[16px] leading-[26px] text-ink">
      {failure.stale ? t("stale") : failure.message}{" "}
      {failure.stale ? (
        <button type="button" onClick={reloadPage} className="min-h-11 underline decoration-underline underline-offset-4">
          {t("reload")}
        </button>
      ) : null}
    </p>
  ) : null;

  const retrying = !!failure?.retry && !busy;
  /** After a failed stage submit, the filled button sends the submit again (Minor 10: on the resume gate too). */
  const retry = () => {
    if (failure?.retry === "auto") return void submit(true);
    if (failure?.retry === "submit") return void submit(false);
  };

  if (phase === "intro")
    return <StageIntro current={current} deadline={deadline} locale={locale} busy={busy} error={failureLine} lostPrevious={lostPrevious} onStart={start} headingRef={heading} />;

  if (phase === "resume") {
    return (
      <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
        <h1 ref={heading} tabIndex={-1} className="text-[28px] leading-9 font-semibold text-ink outline-none">
          {t("resumeTitle")}
        </h1>
        <p className="tnum mt-3 text-[16px] leading-[26px] text-ink">{t("resumeBody", { time: formatCountdown(clock.remainingMs) })}</p>
        {activities.some((a) => a.type === "VIDEO" || a.type === "AUDIO") ? <p className="mt-2 text-[16px] leading-[26px] text-ink-2">{t("resumeDevices")}</p> : null}
        {timeUp ? (
          <p role="status" className="mt-4 text-[16px] font-medium text-ink">
            {current.autoSubmit ? t("timeUpSaving") : t("timeUpLate")}
          </p>
        ) : null}
        <ActionBar>
          <Button id="resume" variant="primary" size="lg" className="w-full text-[16px] sm:w-auto" disabled={busy} onClick={retrying ? retry : () => setPhase("question")}>
            {busy ? t("busy") : retrying ? t("retry") : t("resumeGo")}
          </Button>
          {failureLine}
        </ActionBar>
      </div>
    );
  }

  const locked = timeUp && current.autoSubmit;
  // Fix round 2: a question the server shows closed (no way back; the recovery after a failed stage
  // submit) cannot take edits, so its inputs say so instead of refusing them silently.
  const closedHere = !!activity && !commitNeeded({ responses: current.responses, activityId: activity.id, backNavigation: current.backNavigation });
  const inputsOff = busy || delayed !== null || locked || closedHere;
  let body: React.ReactNode = null;
  if (activity) {
    const common = {
      token,
      position: current.position,
      run: runId,
      activity,
      initial: answers[activity.id] ?? {},
      locale,
      headingRef: heading,
      flushes,
      onChange: (answer: LocalAnswer) => setAnswers((all) => ({ ...all, [activity.id]: { ...all[activity.id], ...answer } })),
      disabled: inputsOff,
      onRefused: (err: unknown) => onRefused(err, activity.type === "FILE_UPLOAD" ? null : activity.type === "SINGLE_CHOICE" || activity.type === "MULTI_CHOICE" ? "choice" : "text"),
    };
    switch (activity.type) {
      case "LONG_TEXT":
      case "SHORT_TEXT":
        body = <TextActivity key={activity.id} {...common} />;
        break;
      case "SINGLE_CHOICE":
      case "MULTI_CHOICE":
        body = <ChoiceActivity key={activity.id} {...common} />;
        break;
      case "VIDEO":
      case "AUDIO": {
        const response = current.responses.find((r) => r.activityId === activity.id);
        const local = answers[activity.id] ?? {};
        body = (
          <RecordedActivity
            key={activity.id}
            mode="answer"
            activity={activity}
            locale={locale}
            headingRef={heading}
            sink={uploadSink(token, current.position, activity.id)}
            takesUsed={response?.takesUsed ?? 0}
            existingRef={response?.recording?.ref ?? null}
            existingStatus={response?.recording?.status ?? null}
            // Only the candidate's own take plays (media/play, Task 9); one still saving answers MEDIA_NOT_READY.
            playbackSrc={async (result) => (result.ref ? (await apiGet<{ src: string }>(token, `/hiring/media/play?ref=${encodeURIComponent(result.ref)}`)).src : null)}
            onTake={() => common.onChange({ hasTake: true })}
            onUse={advance}
            flushes={takes}
            timeUp={locked}
            disabled={inputsOff}
            hidePrimary={retrying || closedHere}
            // C4: during the 8 second send strip the runner is the one that waits; the footer says so instead of a spinner.
            holdReason={delayed ? t("sendingReason") : null}
            alternative={
              activity.textAlternativeEnabled
                ? {
                    node: <TextActivity {...common} alternative kicker={activity.type === "AUDIO" ? tm("writingKickerAudio") : tm("writingKicker")} />,
                    ready: answeredLocally({ type: "LONG_TEXT", minChars: null }, local),
                    using: !!local.usedTextAlternative && !response?.recording,
                    onChoose: (using) => common.onChange({ usedTextAlternative: using }),
                    send: advance,
                  }
                : null
            }
          />
        );
        break;
      }
      case "FILE_UPLOAD": {
        const response = current.responses.find((r) => r.activityId === activity.id);
        // A file this tab uploaded since the page loaded is newer than the server state it was read with.
        body = <FileActivity key={activity.id} {...common} existing={answers[activity.id]?.file ?? response?.file ?? null} uploads={takes} />;
        break;
      }
      // An unknown future type shows nothing.
      default:
        body = null;
    }
  }

  const progress = progressOf({ stagePosition: current.position, stageCount: current.total, activityIndex: index, activityCount: activities.length });
  const answered = activity ? answeredLocally(activity, answers[activity.id] ?? {}) : true;
  // Task 15: a file still uploading is not the answer yet; the close waits for it (the earlier file stays until then).
  const uploadingHere = !!activity && !!answers[activity.id]?.uploading;
  const key = primaryKey(index, activities.length, current.last);
  // C15: every reason the filled button waits is said next to it (busy says it on the button itself).
  const why =
    retrying || busy
      ? null
      : delayed
        ? t("sendingReason")
        : locked
          ? t("timeUpSaving")
          : uploadingHere
            ? tf("waitReason")
            : activity?.required && !answered
              ? t("requiredReason")
              : null;
  const lastMinute = isLastMinute(clock.remainingMs);
  const onPrimary = () => (retrying ? retry() : advance());

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="tnum text-[14px] text-muted">
              {t("stageOf", { n: progress.n, total: progress.total })} · {t("questionOf", { n: index + 1, total: activities.length })}
            </p>
            <div className="mt-2 h-1 rounded-full bg-hairline" aria-hidden>
              <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-[180ms] ease-soft" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
            </div>
          </div>
          {current.deadlineAt ? (
            <p className="shrink-0 text-right">
              <span className="block text-[13px] text-muted">{lastMinute ? t("lastMinute") : t("remaining")}</span>
              <span className="tnum block text-[20px] leading-7 font-semibold text-accent">{formatCountdown(clock.remainingMs)}</span>
            </p>
          ) : null}
        </div>
      </div>
      {/* HIRING-UX 8.7: the time is spoken once a minute, never every second. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {current.deadlineAt && clock.remainingMs > 0 ? t("announceMinutes", { count: minutesLeft(clock.remainingMs) }) : ""}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("announce", { stage: current.position, stages: current.total, n: index + 1, total: activities.length })}
      </p>

      <div className={activity?.type === "VIDEO" ? "mx-auto max-w-[960px] pt-8" : "mx-auto max-w-[640px] pt-8"}>
        {online ? null : (
          <p role="status" className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[26px] text-ink">
            {/* Minor 4: a written answer has no recording to speak of. */}
            {activity && (activity.type === "VIDEO" || activity.type === "AUDIO")
              ? t("offline")
              : activity && (activity.type === "SINGLE_CHOICE" || activity.type === "MULTI_CHOICE")
                ? t("offlineChoice")
                : activity?.type === "FILE_UPLOAD"
                  ? // M2: only an upload in flight is "in this tab" and resumes; otherwise the file is chosen once the connection is back.
                    uploadingHere
                    ? tf("offline")
                    : tf("offlineIdle")
                  : t("offlineText")}
          </p>
        )}
        {timeUp ? (
          <p role="status" className="mb-4 text-[16px] font-medium text-ink">
            {current.autoSubmit ? t("timeUpSaving") : t("timeUpLate")}
          </p>
        ) : null}
        {body}
        {closedHere ? <p className="mt-4 text-[16px] leading-[26px] text-ink-2">{t("closedQuestion")}</p> : null}
        {failureLine}
        {activity && ownsPrimary(activity.type) && !retrying && !closedHere ? null : (
          <ActionBar>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                id="activity-next"
                variant="primary"
                size="lg"
                className="w-full text-[16px] sm:w-auto"
                disabled={busy || why !== null}
                disabledReason={why ?? undefined}
                onClick={onPrimary}
              >
                {busy ? t("busy") : retrying ? t("retry") : t(key)}
              </Button>
              {current.backNavigation && index > 0 && !inputsOff && !uploadingHere ? (
                <button type="button" onClick={() => setIndex(index - 1)} className="min-h-11 text-[16px] text-ink underline decoration-underline underline-offset-4">
                  {t("previous")}
                </button>
              ) : null}
            </div>
            <div role="status">
              {why ? (
                <DisabledReason id="activity-next-why" className="mt-2 text-[14px]">
                  {why}
                </DisabledReason>
              ) : activity && !activity.required && !answered && !busy && !closedHere && !uploadingHere ? (
                <p className="mt-2 text-[14px] text-muted">{t("optionalHint")}</p>
              ) : null}
            </div>
          </ActionBar>
        )}
      </div>
      {delayed ? (
        <SubmitDelay
          onElapsed={() => void delayed()}
          onUndo={() => {
            undone.current = true;
            setDelayed(null);
          }}
        />
      ) : null}
    </div>
  );
}
