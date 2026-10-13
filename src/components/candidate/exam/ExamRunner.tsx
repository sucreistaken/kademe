"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { environmentFacts, useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { ItemView } from "@/components/candidate/exam/ItemView";
import { ListeningPlayer, SpeakingItem } from "@/components/candidate/exam/MediaItems";
import { answerProgress, progressState } from "@/components/candidate/exam/answer-progress";
import { ConfirmDialog, NavStrip, ReviewScreen, reviewCounts } from "@/components/candidate/exam/ExamNav";
import { clearPending, readPending, sessionStore, writePending, type PendingAnswer } from "@/components/candidate/exam/pending-answer";
import { StepFooter } from "@/components/visual/step-footer";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useStageClock } from "@/lib/client/use-stage-clock";
import { stepPath } from "@/lib/candidate-routes";
import type { CandidateState } from "@/lib/exam-flow";
import { neighbour, type MoveTo, type NavEntry } from "@/lib/exam/navigation";
import type { ItemAnswer } from "@/lib/exam/types";
import { formatCountdown, SUBMIT_SLACK_MS } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The exam: section introductions and questions on one page, so moving on
 * never reloads the document (a reload would drop the screen share and
 * fullscreen). The server decides every step; this screen renders the state
 * it is given and sends back one answer at a time.
 *
 * Every answer is a draft saved as the student works (debounced), and the
 * draft the server has not confirmed is also kept in this tab's
 * sessionStorage, so a dropped connection or a reload does not lose it.
 * In a navigable (fixed-form) section the bottom bar moves between items and
 * flags them, and the section ends from its review step; a one-way section
 * (adaptive, speaking) keeps "save and continue".
 */

/** Refusals that mean this screen is behind the server: read the state again. */
const STALE = new Set(["SECTION_EXPIRED", "ITEM_MISMATCH", "SECTION_MISMATCH", "NO_SECTION", "SECTION_NOT_STARTED", "NOT_READY"]);
const codeOf = (err: unknown) => (err as { code?: string } | null)?.code ?? "";

type SaveState = "idle" | "pending" | "saving" | "saved" | "failed";
type Confirm = null | "skip" | "partial" | "finish";

export function ExamRunner({ token, initial }: { token: string; initial: CandidateState }) {
  const router = useRouter();
  const t = useT("exam");
  const n = useT("examNav");
  const sec = useT("section");
  const { engine, snap } = useProctor();
  const [state, setState] = useState(initial);
  const [answer, setAnswer] = useState<ItemAnswer>(initial.current?.item?.answer ?? {});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ text: string; retry: () => void } | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [finishing, setFinishing] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const busyRef = useRef(false);
  const answerRef = useRef<ItemAnswer>(answer);
  /** The answer the server has not confirmed yet (also in sessionStorage). */
  const pendingRef = useRef<PendingAnswer | null>(null);
  const inflightRef = useRef<Promise<unknown> | null>(null);
  const saveTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const policy = state.proctoring;
  const proctored = policy.preset !== "OFF";

  const apply = useCallback(
    (next: CandidateState) => {
      if (next.step === "DONE" || next.step === "CHECK" || next.step === "CONSENT" || next.step === "INFO") {
        if (next.step === "DONE") void engine?.stop();
        router.push(stepPath(token, next));
        return;
      }
      setState(next);
      // A draft still on its way to the server outranks the copy the server sent back.
      const nextItem = next.current?.item ?? null;
      const p = pendingRef.current;
      const keep = !!p && !!nextItem && p.sectionPosition === next.current?.position && p.sequence === nextItem.sequence;
      const shown = keep ? p.answer : (nextItem?.answer ?? {});
      answerRef.current = shown;
      setAnswer(shown);
      setSave(keep ? "pending" : "idle");
    },
    [engine, router, token],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${encodeURIComponent(token)}/state`, { cache: "no-store" });
      if (res.ok) apply((await res.json()) as CandidateState);
    } catch {
      /* the next action retries */
    }
  }, [apply, token]);

  /** Sends the unconfirmed draft, if any. True when nothing is left unsaved. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (retryTimer.current) window.clearTimeout(retryTimer.current);
    retryTimer.current = null;
    if (inflightRef.current) await inflightRef.current.catch(() => undefined);
    const p = pendingRef.current;
    if (!p) return true;
    setSave("saving");
    const request = apiSend(token, "/exam/answer", p, "PUT");
    inflightRef.current = request;
    try {
      await request;
      if (pendingRef.current === p) {
        pendingRef.current = null;
        clearPending(sessionStore(), token, p);
        setSave("saved");
      } else setSave("pending");
      return true;
    } catch (err) {
      if (STALE.has(codeOf(err))) {
        // The server will not take this draft any more (its item or section closed).
        if (pendingRef.current === p) {
          pendingRef.current = null;
          clearPending(sessionStore(), token, p);
        }
        setSave("idle");
        void refresh();
        return false;
      }
      setSave("failed");
      retryTimer.current = window.setTimeout(() => void flushRef.current(), 4000);
      return false;
    } finally {
      if (inflightRef.current === request) inflightRef.current = null;
    }
  }, [refresh, token]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // A draft this tab could not deliver before a reload goes out again.
  useEffect(() => {
    const stored = readPending(sessionStore(), token);
    if (!stored) return;
    pendingRef.current = stored;
    const c = initial.current;
    if (c?.item && stored.sectionPosition === c.position && stored.sequence === c.item.sequence) {
      answerRef.current = stored.answer;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswer(stored.answer);
    }
    void flushRef.current();
    // Once, on arrival: later drafts go through change().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    },
    [],
  );

  // Proctoring: start a session after a reload and arm the guards.
  useEffect(() => {
    if (!engine || !proctored) return;
    if (!engine.snapshot.ready) void engine.start(environmentFacts(), "exam").then(() => engine.arm());
    else engine.arm();
  }, [engine, proctored]);

  useEffect(() => {
    // refresh() sets state only after its fetch resolves, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (snap?.terminated) void refresh();
  }, [snap?.terminated, refresh]);

  const cur = state.current;
  const item = cur?.item ?? null;
  const nav = cur?.nav ?? null;
  const clock = useStageClock(
    token,
    {
      serverNow: cur ? Date.parse(cur.serverNow) : 0,
      deadlineAt: cur?.deadlineAt ? Date.parse(cur.deadlineAt) : null,
    },
    () => {
      // Hand in the last draft while the server still takes it (deadline plus
      // slack), then read the state once the section has closed.
      void flushRef.current().finally(() => window.setTimeout(() => void refresh(), SUBMIT_SLACK_MS + 500));
    },
  );
  const timeUp = state.step === "ITEM" && !!cur?.deadlineAt && clock.remainingMs === 0;

  // A new screen starts at the top, with focus on its heading.
  const view = state.step === "ITEM" ? `${cur?.position}:${nav?.review ? "review" : item?.sequence}` : `intro:${cur?.position}`;
  const headingRef = useStepFocus<HTMLHeadingElement>(view);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  function change(next: ItemAnswer) {
    answerRef.current = next;
    setAnswer(next);
    if (!cur || !item) return;
    const p: PendingAnswer = { sectionPosition: cur.position, sequence: item.sequence, answer: next };
    pendingRef.current = p;
    writePending(sessionStore(), token, p);
    setSave("pending");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    // Typing waits for a pause; a click is saved almost at once.
    const typed = item.content.kind === "WRITING" || item.content.kind === "SHORT_TEXT" || item.content.kind === "GAP" || item.content.kind === "SPEAKING";
    saveTimer.current = window.setTimeout(() => void flushRef.current(), typed ? 800 : 300);
  }

  /**
   * One step that changes the screen. The body is built when it is sent, from
   * the answer on screen at that moment, so "try again" sends the newest one.
   */
  async function act(path: string, body: () => Record<string, unknown>, again: () => void) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    try {
      if (inflightRef.current) await inflightRef.current.catch(() => undefined);
      const sent = body();
      const next = await apiSend<CandidateState>(token, path, sent);
      // The step carried the draft of the item it left: that draft is saved now.
      const p = pendingRef.current;
      if (p && p.sectionPosition === sent.sectionPosition && p.sequence === sent.sequence && "answer" in sent) {
        pendingRef.current = null;
        clearPending(sessionStore(), token, p);
      }
      apply(next);
    } catch (err) {
      if (STALE.has(codeOf(err))) await refresh();
      else setFailure({ text: n("actionFailed"), retry: again });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function start() {
    if (!cur) return;
    void act("/exam/section/start", () => ({ sectionPosition: cur.position }), start);
  }

  function goTo(to: MoveTo) {
    if (!cur) return;
    const leaving = item;
    void act(
      "/exam/answer/move",
      () => (leaving ? { sectionPosition: cur.position, sequence: leaving.sequence, answer: answerRef.current, to } : { sectionPosition: cur.position, to }),
      () => goTo(to),
    );
  }

  function commit(blank = false) {
    if (!cur || !item) return;
    const at = item.sequence;
    void act(
      "/exam/answer/commit",
      () => ({ sectionPosition: cur.position, sequence: at, answer: blank ? {} : answerRef.current }),
      () => commit(blank),
    );
  }

  function finishSection() {
    if (!cur) return;
    void act("/exam/section/submit", () => ({ sectionPosition: cur.position }), finishSection);
  }

  function setFlagHere(sequence: number, flagged: boolean) {
    setState((s) =>
      s.current?.nav
        ? { ...s, current: { ...s.current, nav: { ...s.current.nav, entries: s.current.nav.entries.map((e) => (e.sequence === sequence ? { ...e, flagged } : e)) } } }
        : s,
    );
  }

  async function toggleFlag() {
    if (!cur || !item || !nav || busyRef.current) return;
    const sequence = item.sequence;
    const was = nav.entries.find((e) => e.sequence === sequence)?.flagged ?? false;
    setFlagHere(sequence, !was);
    setFailure(null);
    try {
      await apiSend(token, "/exam/answer/flag", { sectionPosition: cur.position, sequence, flagged: !was });
    } catch (err) {
      setFlagHere(sequence, was);
      if (STALE.has(codeOf(err))) await refresh();
      else setFailure({ text: n("actionFailed"), retry: () => void toggleFlag() });
    }
  }

  // "Finish section now" (one-way sections) waits eight seconds, so a slip can be undone.
  useEffect(() => {
    if (finishing === null || !cur) return;
    const id = window.setTimeout(() => {
      if (finishing <= 1) {
        setFinishing(null);
        finishSection();
      } else setFinishing(finishing - 1);
    }, 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishing]);

  const recover = snap?.banner?.kind === "recover" ? snap.banner.reason : null;
  const resumeNeeded = proctored && engine && snap?.ready && snap.guarding ? engine.needsResume() : [];
  const blocked = !!recover || resumeNeeded.length > 0;

  if (!cur) return null;

  const progress = item ? answerProgress(item.content, answer) : null;
  const filling = progress ? progressState(progress) : null;
  // The strip shows the item on screen as it is now, not as last saved.
  const entries: NavEntry[] = nav ? nav.entries.map((e) => (item && progress && e.sequence === item.sequence ? { ...e, ...progress } : e)) : [];
  const sequences = entries.map((e) => e.sequence);
  const flaggedHere = !!item && entries.some((e) => e.sequence === item.sequence && e.flagged);
  const counts = reviewCounts(entries);
  const inputsOff = busy || timeUp;

  const failureLine =
    failure ? (
      <ErrorLine text={failure.text} onRetry={failure.retry} />
    ) : save === "failed" ? (
      <ErrorLine text={n("saveFailed")} onRetry={() => void flush()} />
    ) : null;
  const hint = timeUp
    ? n("timeUpSaving")
    : filling === "PARTIAL" && progress && progress.total > 1
      ? n("partialHint", { filled: progress.filled, total: progress.total })
      : save === "saved"
        ? t("autosaved")
        : null;

  let footer: React.ReactNode = null;
  if (state.step === "ITEM" && nav?.review) {
    footer = (
      <StepFooter
        back={{ label: n("backToQuestions"), onClick: () => (busyRef.current ? undefined : goTo(sequences[sequences.length - 1])) }}
        primary={{ kind: "button", id: "finish-section", label: n("finishSection"), busy, busyLabel: t("saving"), onClick: () => setConfirm("finish") }}
        hint={timeUp ? n("timeUpSaving") : null}
        note={failureLine}
      />
    );
  } else if (state.step === "ITEM" && nav && item) {
    const prev = neighbour(sequences, item.sequence, -1);
    const next = neighbour(sequences, item.sequence, 1);
    footer = (
      <StepFooter
        back={prev !== null ? { label: n("previous"), onClick: () => (busyRef.current ? undefined : goTo(prev)) } : null}
        secondary={{ kind: "button", id: "flag-item", label: flaggedHere ? n("unflag") : n("flag"), onClick: () => void toggleFlag() }}
        primary={{
          kind: "button",
          id: "next-item",
          label: next !== null ? n("next") : n("reviewAndFinish"),
          busy,
          busyLabel: t("saving"),
          onClick: () => goTo(next ?? "REVIEW"),
        }}
        hint={hint}
        note={
          <div className="flex flex-col gap-3">
            {failureLine}
            <NavStrip
              entries={entries}
              current={item.sequence}
              disabled={busy}
              onJump={(s) => goTo(s)}
              onReview={next !== null ? () => goTo("REVIEW") : null}
            />
          </div>
        }
      />
    );
  } else if (state.step === "ITEM" && item && progress) {
    footer = (
      <StepFooter
        secondary={{ kind: "button", id: "skip-item", label: t("skip"), onClick: () => (busyRef.current ? undefined : setConfirm("skip")) }}
        primary={{
          kind: "button",
          id: "save-next",
          label: t("saveNext"),
          busy,
          busyLabel: t("saving"),
          waitReason: progress.filled === 0 ? t("answerFirst") : null,
          onClick: () => (filling === "PARTIAL" ? setConfirm("partial") : commit()),
        }}
        hint={hint}
        note={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {failureLine ?? <span />}
            <button
              type="button"
              disabled={busy || finishing !== null}
              onClick={() => setFinishing(8)}
              className="text-[13.5px] text-muted underline decoration-underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed"
            >
              {t("finishEarly")}
            </button>
          </div>
        }
      />
    );
  }

  return (
    <div className="relative">
      {state.step === "ITEM" ? (
        <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-between gap-4 px-7">
            <div className="flex items-center gap-3 text-[13.5px]">
              <span className="font-semibold text-ink">{sec(cur.section)}</span>
              <span className="tnum text-muted">
                {nav?.review
                  ? n("reviewTitle")
                  : nav && item
                    ? t("questionOf", { n: item.sequence, total: entries.length })
                    : cur.itemTotal
                      ? t("questionOf", { n: cur.answered + 1, total: cur.itemTotal })
                      : t("question", { n: cur.answered + 1 })}
              </span>
            </div>
            <div className="flex items-center gap-5">
              {proctored ? (
                <span className="hidden items-center gap-2 text-[12.5px] text-muted md:flex">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                  {policy.screenShare ? t("recordingOn") : t("cameraOn")}
                </span>
              ) : null}
              <span className="flex items-baseline gap-2">
                <span className="sr-only">{t("timeLeft")}</span>
                {clock.remainingMs < 120_000 ? <span className="text-[12px] text-muted">{t("lastMinutes")}</span> : null}
                <span className="tnum text-[18px] font-bold text-accent">{formatCountdown(clock.remainingMs)}</span>
              </span>
            </div>
          </div>
          <Banner />
        </header>
      ) : null}

      {blocked ? (
        <RecoverPanel reasons={recover ? [recover] : resumeNeeded} resume={!recover && engine?.startedFrom === "exam"} />
      ) : null}

      <div inert={blocked} className={cn(blocked && "pointer-events-none select-none blur-[3px]")}>
        {state.step === "SECTION_INTRO" ? (
          <CandidateColumn width={620}>
            <div className="tnum text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
              {t("sectionOf", { n: cur.position, total: cur.total })}
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="mt-2.5 text-[32px] font-bold leading-[1.2] tracking-[-0.03em] text-ink outline-none">
              {sec(cur.section)}
            </h1>
            {(() => {
              const s = state.sections.find((x) => x.position === cur.position)!;
              const count = s.itemsLabel.includes("-")
                ? t("itemsAdaptive", { range: s.itemsLabel })
                : cur.section === "WRITING" || cur.section === "SPEAKING"
                  ? t("tasks", { n: s.itemsLabel })
                  : t("items", { n: s.itemsLabel });
              return (
                <>
                  <p className="tnum mt-2 text-[15px] text-ink-2">{`${t("minutes", { n: s.minutes })} · ${count}`}</p>
                  <ul className="mt-6 flex list-disc flex-col gap-2 pl-5 text-[14.5px] leading-[1.6] text-ink-2">
                    <li>
                      {s.navigable && cur.section === "GRAMMAR"
                        ? n("ruleGRAMMARFixed")
                        : sec(`rule${cur.section}` as "ruleGRAMMAR", { plays: state.maxPlays })}
                    </li>
                    {s.navigable ? (
                      <>
                        <li>{n("ruleBack")}</li>
                        <li>{n("ruleReview")}</li>
                      </>
                    ) : (
                      <li>{t("ruleNoBack")}</li>
                    )}
                    <li>{t("ruleClock")}</li>
                  </ul>
                </>
              );
            })()}
            <button
              type="button"
              disabled={busy}
              onClick={start}
              className="mt-8 h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted"
            >
              {busy ? t("saving") : t("startSection")}
            </button>
            {failure ? <ErrorLine text={failure.text} onRetry={failure.retry} /> : null}
          </CandidateColumn>
        ) : nav?.review ? (
          <ReviewScreen entries={entries} disabled={busy} onJump={(s) => goTo(s)} headingRef={headingRef} />
        ) : item ? (
          <div className={cn("mx-auto px-7 pb-10 pt-8", item.stimulus?.kind === "READING" ? "max-w-[1200px]" : "max-w-[760px]")}>
            <div className={cn(item.stimulus?.kind === "READING" && "grid gap-8 lg:grid-cols-2")}>
              {item.stimulus?.kind === "READING" ? (
                <article className="rounded-[14px] border border-line bg-surface p-6 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem-var(--step-footer-space,112px))] lg:overflow-y-auto">
                  <div lang="de" className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{item.stimulus.title}</div>
                  <div lang="de" className="mt-3 whitespace-pre-line text-[16px] leading-[1.75] text-ink">
                    {item.stimulus.text}
                  </div>
                </article>
              ) : null}
              <div>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="tnum mb-4 flex items-center gap-2.5 text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted outline-none"
                >
                  {nav ? t("questionOf", { n: item.sequence, total: entries.length }) : t("question", { n: cur.answered + 1 })}
                  {flaggedHere ? <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11.5px] normal-case tracking-normal text-ink">{n("flaggedTag")}</span> : null}
                </h2>
                {item.stimulus?.kind === "LISTENING" ? (
                  <div className="mb-6">
                    <ListeningPlayer
                      token={token}
                      sectionPosition={cur.position}
                      sequence={item.sequence}
                      stimulus={item.stimulus}
                      engine={engine}
                    />
                  </div>
                ) : null}
                {item.content.kind === "SPEAKING" ? (
                  <SpeakingItem
                    key={item.sequence}
                    token={token}
                    sectionPosition={cur.position}
                    item={item}
                    answer={answer}
                    onChange={change}
                    engine={engine}
                  />
                ) : (
                  <ItemView item={item} answer={answer} onChange={change} disabled={inputsOff} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Outside the blurred wrapper: a CSS filter would pin the fixed bar to the wrapper instead of the window. */}
      {footer ? <div inert={blocked}>{footer}</div> : null}

      {finishing !== null ? (
        <div
          role="status"
          style={{ bottom: "var(--step-footer-space, 112px)" }}
          className="fixed inset-x-0 z-30 mx-auto flex w-fit items-center gap-4 rounded-[10px] bg-ink px-5 py-3 text-[13.5px] text-white shadow-panel"
        >
          <span className="tnum">{t("finishingIn", { s: finishing })}</span>
          <button type="button" onClick={() => setFinishing(null)} className="font-semibold underline underline-offset-2">
            {t("undo")}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === "finish"}
        title={n("confirmFinishTitle")}
        body={n("confirmFinishBody", { empty: counts.empty, partial: counts.partial, flagged: counts.flagged })}
        confirmLabel={n("confirmFinishYes")}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          finishSection();
        }}
      />
      <ConfirmDialog
        open={confirm === "skip"}
        title={n("confirmSkipTitle")}
        body={n("confirmSkipBody")}
        confirmLabel={n("confirmSkipYes")}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          commit(true);
        }}
      />
      <ConfirmDialog
        open={confirm === "partial"}
        title={n("confirmPartialTitle")}
        body={n("confirmPartialBody", { filled: progress?.filled ?? 0, total: progress?.total ?? 0 })}
        confirmLabel={n("confirmPartialYes")}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          commit();
        }}
      />

      {proctored && engine?.cameraStream && item?.content.kind !== "SPEAKING" ? <SelfView stream={engine.cameraStream} /> : null}
    </div>
  );
}

function ErrorLine({ text, onRetry }: { text: string; onRetry: () => void }) {
  const t = useT("exam");
  return (
    <p role="alert" className="text-[13.5px] leading-[1.5] text-danger">
      {text}{" "}
      <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
        {t("retry")}
      </button>
    </p>
  );
}

/** Non-modal, calm, under the header. Never an alert(). */
function Banner() {
  const p = useT("proctor");
  const { snap } = useProctor();
  const b = snap?.banner;
  if (!b || b.kind === "recover") return null;
  return (
    <div role="status" className="border-t border-hairline bg-canvas">
      <p className="mx-auto max-w-[1000px] px-7 py-2 text-[13px] text-ink-2">{p(b.reason)}</p>
    </div>
  );
}

/**
 * The one thing on screen while something the exam needs is off. The content
 * behind it is inert: the clock runs, and the student is told so.
 */
function RecoverPanel({ reasons, resume }: { reasons: Array<"FULLSCREEN" | "SCREEN" | "CAMERA">; resume: boolean }) {
  const p = useT("proctor");
  const { engine } = useProctor();
  const [busy, setBusy] = useState(false);
  const first = reasons[0];
  async function fix() {
    if (!engine) return;
    setBusy(true);
    try {
      // One thing per click: screen sharing and fullscreen each need a fresh
      // click of their own, and the list gets shorter with every one.
      if (first === "CAMERA") await engine.startCamera();
      if (first === "SCREEN") await engine.startScreen();
      if (first === "FULLSCREEN") await engine.enterFullscreen();
      if (engine.snapshot.camera === "ok" && engine.snapshot.model === "off") void engine.startVision();
    } finally {
      setBusy(false);
    }
  }
  // Someone who was never in fullscreen did not "leave" it.
  const firstEntry = !resume && first === "FULLSCREEN" && !engine?.everFullscreen;
  const title = resume ? p("resumeTitle") : firstEntry ? p("enterFULLSCREEN") : p(`recover${first}` as "recoverFULLSCREEN");
  const action = firstEntry ? p("enterFULLSCREENAction") : p(`recover${first}Action` as "recoverFULLSCREENAction");
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-paper/70 px-4 pt-[18vh]">
      <div role="alertdialog" aria-labelledby="recover-title" className="w-full max-w-[460px] rounded-[14px] border border-line bg-surface p-6 shadow-modal">
        <h2 id="recover-title" className="text-[20px] font-bold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-2">{resume ? p("resumeBody") : firstEntry ? p("enterBody") : p("clockRuns")}</p>
        {resume ? (
          <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[13.5px] text-ink-2">
            {reasons.map((r) => (
              <li key={r}>{p(`resume${r}` as "resumeCAMERA")}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={fix}
          className="mt-5 h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted"
        >
          {action}
        </button>
      </div>
    </div>
  );
}

/** The camera self-view sits above the bottom bar (its measured height), never on it. */
function SelfView({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const p = useT("proctor");
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => undefined);
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      muted
      playsInline
      aria-label={p("pipLabel")}
      style={{ bottom: "var(--step-footer-space, 112px)" }}
      className="fixed right-4 z-30 h-[90px] w-[120px] rounded-[8px] border border-line bg-ink object-cover shadow-panel"
    />
  );
}
