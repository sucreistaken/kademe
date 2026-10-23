"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { environmentFacts, useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { CheatWarning } from "@/components/candidate/proctor/CheatWarning";
import { Bookmark } from "lucide-react";
import { Illustration } from "@/components/visual/illustrations";
import { RECOVER_PICTURE } from "@/components/candidate/proctor/block-pictures";
import { ItemView } from "@/components/candidate/exam/ItemView";
import { ListeningPlayer, SpeakingItem } from "@/components/candidate/exam/MediaItems";
import { answerProgress, progressState } from "@/components/candidate/exam/answer-progress";
import { nextButtonKind } from "@/components/candidate/exam/exam-bar";
import { WarmupPractice } from "@/components/candidate/exam/warmup/Warmup";
import { INITIAL_WARMUP, warmupReduce, type WarmupAction, type WarmupState } from "@/components/candidate/exam/warmup/warmup-state";
import { practiceFor } from "@/components/candidate/exam/warmup/practice-data";
import { ConfirmDialog, NavStrip, ReviewScreen, reviewCounts } from "@/components/candidate/exam/ExamNav";
import { finishSummaryParts } from "@/components/candidate/exam/finish-summary";
import { entersByTyping } from "@/components/candidate/exam/typed-input";
import { gateKey } from "@/components/candidate/exam/listening-gate";
import { clearPending, readPending, sessionStore, writePending, type PendingAnswer } from "@/components/candidate/exam/pending-answer";
import { leavesGroup, memberRange, memberSequences, nextAfterGroup, prevBeforeGroup } from "@/components/candidate/exam/groups";
import { ABOVE_FOOTER } from "@/components/visual/footer-action";
import { StepFooter } from "@/components/visual/step-footer";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useStageClock } from "@/lib/client/use-stage-clock";
import { stepPath } from "@/lib/candidate-routes";
import type { CandidateState } from "@/lib/exam-flow";
import { type MoveTo, type NavEntry } from "@/lib/exam/navigation";
import type { ItemAnswer, TextGapKind } from "@/lib/exam/types";
import type { CandidateItem } from "@/lib/exam/safe";
import { recordingLabel } from "@/lib/proctor/recording-status";
import { formatCountdown, SUBMIT_SLACK_MS } from "@/lib/timer";
import { ErrorLine } from "@/components/candidate/exam/ErrorLine";
import { ExamTopBar } from "@/components/candidate/exam/ExamTopBar";
import { ItemHeading } from "@/components/candidate/exam/ItemHeading";
import { ReadingPane } from "@/components/candidate/exam/ReadingPane";
import { SectionIntro } from "@/components/candidate/exam/SectionIntro";
import { useT } from "@/i18n/candidate-client";
import type { CandidateLocale } from "@/i18n/locale";
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

/** A section with no texts: a stable empty list for the warm-up. */
const NO_KINDS: TextGapKind[] = [];

/** The questions on the screen: a listening recording's whole group, or the one item. */
function shownItems(c: CandidateState["current"]): CandidateItem[] {
  return c?.group && c.group.length > 0 ? c.group : c?.item ? [c.item] : [];
}

/** The saved draft of every question on the screen, by sequence. */
function answersOf(c: CandidateState["current"]): Record<number, ItemAnswer> {
  return Object.fromEntries(shownItems(c).map((it) => [it.sequence, it.answer ?? {}]));
}

export function ExamRunner({
  token,
  initial,
  locales = [],
}: {
  token: string;
  initial: CandidateState;
  /** Languages the student may switch to; the picker shows on section introductions only. */
  locales?: CandidateLocale[];
}) {
  const router = useRouter();
  const lang = useLocale();
  const t = useT("exam");
  const n = useT("examNav");
  const cw = useT("cheatWarning");
  const sec = useT("section");
  const { engine, snap } = useProctor();
  const [state, setState] = useState(initial);
  const [answers, setAnswers] = useState<Record<number, ItemAnswer>>(() => answersOf(initial.current));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ text: string; retry: () => void } | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  // The "finish section" countdown belongs to the section it was started in.
  const [finishState, setFinishing] = useState<{ position: number; left: number } | null>(null);
  const [warm, setWarm] = useState<Record<number, WarmupState>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  /** A move waiting for "leave anyway" while a recording still plays. */
  const [leave, setLeave] = useState<{ go: () => void } | null>(null);
  const audioActiveRef = useRef(false);
  const busyRef = useRef(false);
  const answersRef = useRef<Record<number, ItemAnswer>>(answers);
  /** The newest draft the server has not confirmed yet (also in sessionStorage). */
  const pendingRef = useRef<PendingAnswer | null>(null);
  /** Drafts of other questions on the same page that a newer edit pushed out of the slot; they go out first. */
  const displacedRef = useRef<PendingAnswer[]>([]);
  const inflightRef = useRef<Promise<unknown> | null>(null);
  const saveTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const policy = state.proctoring;
  const proctored = policy.preset !== "OFF";
  // While the continuous recording runs, the header says all it records, the sound included.
  const recLabel = recordingLabel(snap?.recording ?? null);

  const apply = useCallback(
    (next: CandidateState) => {
      if (next.step === "DONE" || next.step === "CHECK" || next.step === "CONSENT" || next.step === "INFO") {
        if (next.step === "DONE") void engine?.stop();
        router.push(stepPath(token, next));
        return;
      }
      setState(next);
      // A draft still on its way to the server outranks the copy the server sent back.
      const shown = answersOf(next.current);
      let keep = false;
      for (const p of [...displacedRef.current, ...(pendingRef.current ? [pendingRef.current] : [])]) {
        if (p.sectionPosition === next.current?.position && p.sequence in shown) {
          shown[p.sequence] = p.answer;
          keep = true;
        }
      }
      answersRef.current = shown;
      setAnswers(shown);
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
    // Drafts of other questions on this page first, then the newest one.
    for (;;) {
      const displaced = displacedRef.current[0];
      const p = displaced ?? pendingRef.current;
      if (!p) return true;
      setSave("saving");
      const request = apiSend(token, "/exam/answer", p, "PUT");
      inflightRef.current = request;
      try {
        await request;
        if (displaced) {
          displacedRef.current = displacedRef.current.filter((d) => d !== displaced);
          continue;
        }
        if (pendingRef.current === p) {
          pendingRef.current = null;
          clearPending(sessionStore(), token, p);
          setSave("saved");
        } else setSave("pending");
        return true;
      } catch (err) {
        if (STALE.has(codeOf(err))) {
          // The server will not take this draft any more (its item or section closed).
          if (displaced) displacedRef.current = displacedRef.current.filter((d) => d !== displaced);
          else if (pendingRef.current === p) {
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
    if (c && stored.sectionPosition === c.position && shownItems(c).some((it) => it.sequence === stored.sequence)) {
      answersRef.current = { ...answersRef.current, [stored.sequence]: stored.answer };
      setAnswers(answersRef.current);
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
  const finishing = finishState && finishState.position === cur?.position ? finishState.left : null;
  const warmHere: WarmupState = (cur && warm[cur.position]) || INITIAL_WARMUP;
  const sectionHere = cur ? state.sections.find((x) => x.position === cur.position) : undefined;
  const warmDo = (action: WarmupAction) => cur && setWarm((w) => ({ ...w, [cur.position]: warmupReduce(w[cur.position] ?? INITIAL_WARMUP, action) }));
  // The warm-up practice is not the exam: no big warnings there.
  const inPractice = state.step === "SECTION_INTRO" && warmHere.phase === "practice";
  useEffect(() => {
    engine?.suppressWarnings("warmup", inPractice);
    return () => engine?.suppressWarnings("warmup", false);
  }, [engine, inPractice]);
  const item = cur?.item ?? null;
  /** More than one question under one recording: the group page (listening). */
  const group = cur?.group && item ? cur.group : null;
  const shown = shownItems(cur);
  const members = memberSequences(group, item?.sequence ?? 0);
  const listeningHeading = cur?.listening ? t("listenHeading", cur.listening) : t("listenHeadingPlain");
  const answer: ItemAnswer = (item && answers[item.sequence]) || {};
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
  const view =
    state.step === "ITEM"
      ? `${cur?.position}:${nav?.review ? "review" : item?.sequence}`
      : `intro:${cur?.position}:${warmHere.phase}${warmHere.phase === "practice" ? warmHere.step : ""}`;
  const headingRef = useStepFocus<HTMLHeadingElement>(view);
  // A group page opens on the question that was asked for (the first one scrolls to the top).
  const scrollTarget = group && item && !nav?.review && item.sequence !== members[0] ? item.sequence : null;
  useEffect(() => {
    if (scrollTarget !== null) document.getElementById(`item-${scrollTarget}`)?.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
  }, [view, scrollTarget]);
  // The leave question belongs to the screen it was asked on.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeave(null);
  }, [view]);

  function change(next: ItemAnswer, sequence: number | undefined = item?.sequence) {
    if (!cur || sequence === undefined) return;
    answersRef.current = { ...answersRef.current, [sequence]: next };
    setAnswers(answersRef.current);
    const was = pendingRef.current;
    // Another question's unsent draft is not lost by this edit: it goes out first.
    if (was && was.sequence !== sequence) displacedRef.current = [...displacedRef.current, was];
    const p: PendingAnswer = { sectionPosition: cur.position, sequence, answer: next };
    pendingRef.current = p;
    writePending(sessionStore(), token, p);
    setSave("pending");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    // Typing waits for a pause; a click is saved almost at once.
    const typed = entersByTyping(shown.find((it) => it.sequence === sequence)?.content);
    saveTimer.current = window.setTimeout(() => void flushRef.current(), was && was.sequence !== sequence ? 0 : typed ? 800 : 300);
  }

  /** Forgets any unsent draft of one question (its answer went out with a commit). */
  function dropDraft(sequence: number) {
    displacedRef.current = displacedRef.current.filter((d) => d.sequence !== sequence);
    const p = pendingRef.current;
    if (p && p.sequence === sequence && cur) {
      pendingRef.current = null;
      clearPending(sessionStore(), token, p);
    }
  }

  /** Runs `go`, or first asks (in the bottom bar, never a browser dialog) when a recording is still playing. */
  function guarded(go: () => void) {
    if (audioActiveRef.current) setLeave({ go });
    else go();
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
      // A step that does not carry the answer on screen (start, finish) hands in the unsaved draft first.
      if (!("answer" in sent) && (pendingRef.current || displacedRef.current.length > 0)) await flushRef.current();
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
    // A group page's drafts are all saved per question as they are made; the move carries none.
    const leaving = group ? null : item;
    void act(
      "/exam/answer/move",
      () => (leaving ? { sectionPosition: cur.position, sequence: leaving.sequence, answer: answersRef.current[leaving.sequence] ?? {}, to } : { sectionPosition: cur.position, to }),
      () => goTo(to),
    );
  }

  /** A move that asks first when it would walk away from a recording that is playing. */
  function goToGuarded(to: MoveTo) {
    if (leavesGroup(members, to)) guarded(() => goTo(to));
    else goTo(to);
  }

  function commit(blank = false) {
    if (!cur || !item) return;
    if (group) {
      void commitGroup(blank);
      return;
    }
    const at = item.sequence;
    void act(
      "/exam/answer/commit",
      () => ({ sectionPosition: cur.position, sequence: at, answer: blank ? {} : (answersRef.current[at] ?? {}) }),
      () => commit(blank),
    );
  }

  /**
   * One-way section, one recording with several questions: each question is
   * committed in turn (the same call per sequence as for a single item); the
   * state after the last one is the next screen.
   */
  async function commitGroup(blank: boolean) {
    if (!cur || !group || busyRef.current) return;
    const sectionPosition = cur.position;
    const sequences = [...members];
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    try {
      if (inflightRef.current) await inflightRef.current.catch(() => undefined);
      let next: CandidateState | null = null;
      for (const sequence of sequences) {
        next = await apiSend<CandidateState>(token, "/exam/answer/commit", {
          sectionPosition,
          sequence,
          answer: blank ? {} : (answersRef.current[sequence] ?? {}),
        });
        dropDraft(sequence);
      }
      if (next) apply(next);
    } catch (err) {
      if (STALE.has(codeOf(err))) await refresh();
      else setFailure({ text: n("actionFailed"), retry: () => void commitGroup(blank) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
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

  async function toggleFlag(sequence: number | undefined = item?.sequence) {
    if (!cur || sequence === undefined || !nav || busyRef.current) return;
    const was = nav.entries.find((e) => e.sequence === sequence)?.flagged ?? false;
    setFlagHere(sequence, !was);
    setFailure(null);
    try {
      await apiSend(token, "/exam/answer/flag", { sectionPosition: cur.position, sequence, flagged: !was });
    } catch (err) {
      setFlagHere(sequence, was);
      if (STALE.has(codeOf(err))) await refresh();
      else setFailure({ text: n("actionFailed"), retry: () => void toggleFlag(sequence) });
    }
  }

  // "Finish section now" (one-way sections) waits eight seconds, so a slip can be undone.
  useEffect(() => {
    if (finishing === null || !cur) return;
    const position = cur.position;
    const id = window.setTimeout(() => {
      if (finishing <= 1) {
        setFinishing(null);
        finishSection();
      } else setFinishing({ position, left: finishing - 1 });
    }, 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishing, cur?.position]);

  const recover = snap?.banner?.kind === "recover" ? snap.banner.reason : null;
  const resumeNeeded = proctored && engine && snap?.ready && snap.guarding ? engine.needsResume() : [];
  const blocked = !!recover || resumeNeeded.length > 0;
  // The big warning waits behind a recover panel (one thing at a time); it is never shown in the practice.
  const warning = proctored && !blocked && !inPractice ? (snap?.warning ?? null) : null;
  const covered = blocked || !!warning;

  if (!cur) return null;

  // What the student filled in, per question on screen, as it is now (not as last saved).
  const progressOf = new Map(shown.map((it) => [it.sequence, answerProgress(it.content, answers[it.sequence])]));
  const sumProgress = [...progressOf.values()].reduce((a, p) => ({ filled: a.filled + p.filled, total: a.total + p.total }), { filled: 0, total: 0 });
  const progress = item ? sumProgress : null;
  const filling = progress ? progressState(progress) : null;
  const entries: NavEntry[] = nav ? nav.entries.map((e) => ({ ...e, ...progressOf.get(e.sequence) })) : [];
  const sequences = entries.map((e) => e.sequence);
  const flaggedAt = (sequence: number) => entries.some((e) => e.sequence === sequence && e.flagged);
  const flaggedHere = !!item && flaggedAt(item.sequence);
  const counts = reviewCounts(entries);
  const finishParts = finishSummaryParts(counts);
  const finishLeft = finishParts.length
    ? `${finishParts.map(({ part, count }) => n(part === "empty" ? "confirmFinishEmpty" : part === "partial" ? "confirmFinishPartial" : "confirmFinishFlagged", { count })).join(", ")}.`
    : n("confirmFinishAllDone");
  const finishBody = `${finishLeft} ${n("confirmFinishNoReturn")}`;
  const inputsOff = busy || timeUp;
  // The two-column views (reading text, listening group, cloze text with its option panel) outgrow the 1000px column of every other screen.
  const clozeHere = item?.content.kind === "GAP" && !!item.content.cloze;
  // Writing and speaking put the task and the answer side by side from lg width.
  const taskSplit = item?.content.kind === "WRITING" || item?.content.kind === "SPEAKING";
  const wideReading = state.step === "ITEM" && !nav?.review && (item?.stimulus?.kind === "READING" || !!group || clozeHere || taskSplit);

  const failureLine =
    failure ? (
      <ErrorLine text={failure.text} onRetry={failure.retry} />
    ) : save === "failed" ? (
      <ErrorLine text={n("saveFailed")} onRetry={() => void flush()} />
    ) : null;
  // Time-up text is a floating notice (timeUpNotice), never a line in the bar.
  const hint =
    timeUp
      ? null
      : filling === "PARTIAL" && progress && progress.total > 1
        ? group && progressOf.size > 1
          ? n("groupPartialHint", {
              done: [...progressOf.values()].filter((p) => p.total > 0 && p.filled === p.total).length,
              total: progressOf.size,
            })
          : n("partialHint", { filled: progress.filled, total: progress.total })
        : save === "saved"
          ? t("autosaved")
          : null;

  // Floating warnings: they sit over the page just above the bottom bar and add no height to it.
  const noticeAction = "ms-2 min-h-9 font-semibold underline underline-offset-2";
  const failureNotice = failure ? (
    <Notice role="alert" className="max-w-[640px] shadow-panel">
      {failure.text}
      <button type="button" onClick={failure.retry} className={noticeAction}>
        {t("retry")}
      </button>
    </Notice>
  ) : save === "failed" ? (
    <Notice role="alert" className="max-w-[640px] shadow-panel">
      {n("saveFailed")}
      <button type="button" onClick={() => void flush()} className={noticeAction}>
        {t("retry")}
      </button>
    </Notice>
  ) : null;
  // Asked just above the bar, where the student pressed: a recording still plays.
  const leaveNotice = leave ? (
    <Notice role="alert" className="max-w-[640px] shadow-panel">
      {t("leavePlaying")}
      <button
        type="button"
        onClick={() => {
          const go = leave.go;
          setLeave(null);
          go();
        }}
        className={noticeAction}
      >
        {t("leaveAnyway")}
      </button>
      <button type="button" onClick={() => setLeave(null)} className={noticeAction}>
        {t("leaveStay")}
      </button>
    </Notice>
  ) : null;
  const timeUpNotice = timeUp ? (
    <Notice role="status" className="max-w-[640px] shadow-panel">
      {n("timeUpSaving")}
    </Notice>
  ) : null;

  let footer: React.ReactNode = null;
  if (state.step === "ITEM" && nav?.review) {
    footer = (
      <StepFooter
        back={{ label: n("backToQuestions"), onClick: () => (busyRef.current ? undefined : goTo(sequences[sequences.length - 1])) }}
        primary={{ kind: "button", id: "finish-section", label: n("finishSection"), busy, busyLabel: t("saving"), onClick: () => setConfirm("finish") }}
        notice={timeUpNotice}
        note={failureLine}
      />
    );
  } else if (state.step === "ITEM" && nav && item) {
    // A recording's questions are one page: next and previous step over the whole group.
    const prev = prevBeforeGroup(sequences, members);
    const next = nextAfterGroup(sequences, members);
    footer = (
      <StepFooter
        back={{ label: n("back"), disabled: prev === null, onClick: () => (busyRef.current || prev === null ? undefined : goToGuarded(prev)) }}
        // On a group page every question carries its own flag; its slot keeps the width.
        secondary={
          group
            ? null
            : {
                kind: "button",
                id: "flag-item",
                label: flaggedHere ? cw("flagSet") : n("flag"),
                icon: <Bookmark aria-hidden className={cn("size-4", flaggedHere && "fill-ink")} strokeWidth={2} />,
                tone: flaggedHere ? "marked" : undefined,
                ariaLabel: flaggedHere ? cw("flagSetHelp") : undefined,
                onClick: () => void toggleFlag(),
              }
        }
        primary={{
          kind: "button",
          id: "next-item",
          label: nextButtonKind(next) === "next" ? n("next") : n("finish"),
          busy,
          busyLabel: t("saving"),
          onClick: () => goToGuarded(next ?? "REVIEW"),
        }}
        exam
        status={save === "saving" ? t("saving") : save === "saved" ? t("autosaved") : null}
        notice={
          failureNotice || leaveNotice || timeUpNotice ? (
            <>
              {failureNotice}
              {leaveNotice}
              {timeUpNotice}
            </>
          ) : null
        }
        note={<NavStrip entries={entries} current={members} disabled={busy} compact onJump={(s) => goToGuarded(s)} onReview={null} />}
      />
    );
  } else if (state.step === "ITEM" && item && progress) {
    footer = (
      <StepFooter
        secondary={{ kind: "button", id: "skip-item", label: t("skip"), onClick: () => (busyRef.current ? undefined : guarded(() => setConfirm("skip"))) }}
        primary={{
          kind: "button",
          id: "save-next",
          label: t("saveNext"),
          busy,
          busyLabel: t("saving"),
          waitReason: progress.filled === 0 ? t("answerFirst") : null,
          onClick: () => guarded(() => (filling === "PARTIAL" ? setConfirm("partial") : commit())),
        }}
        hint={hint}
        notice={
          failureNotice || leaveNotice || timeUpNotice ? (
            <>
              {failureNotice}
              {leaveNotice}
              {timeUpNotice}
            </>
          ) : null
        }
        note={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              disabled={busy || finishing !== null}
              onClick={() => setFinishing({ position: cur.position, left: 8 })}
              className="text-[13.5px] text-muted underline decoration-underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed"
            >
              {t("finishEarly")}
            </button>
          </div>
        }
      />
    );
  }

  // The bar's "Question 3 of 20" text; only an open question shows it.
  const counter =
    state.step !== "ITEM"
      ? ""
      : nav?.review
        ? n("reviewTitle")
        : nav && item
          ? group && members.length > 1
            ? t("questionRangeOf", { ...memberRange(members), total: entries.length })
            : t("questionOf", { n: item.sequence, total: entries.length })
          : group && members.length > 1
            ? cur.itemTotal
              ? t("questionRangeOf", { from: cur.answered + 1, to: cur.answered + members.length, total: cur.itemTotal })
              : t("questionRange", { from: cur.answered + 1, to: cur.answered + members.length })
            : cur.itemTotal
              ? t("questionOf", { n: cur.answered + 1, total: cur.itemTotal })
              : t("question", { n: cur.answered + 1 });

  return (
    <div className="relative">
      <ExamTopBar
        inQuestion={state.step === "ITEM"}
        sectionName={sec(cur.section)}
        counter={counter}
        wide={wideReading}
        showLanguagePicker={state.step === "SECTION_INTRO" && !inPractice}
        lang={lang}
        locales={locales}
        proctored={proctored}
        recLabel={recLabel}
        screenShare={policy.screenShare}
        remainingMs={clock.remainingMs}
        sectionMs={(state.sections.find((x) => x.position === cur.position)?.minutes ?? 0) * 60_000}
        token={token}
        sectionPosition={cur.position}
      />

      {blocked ? (
        <RecoverPanel reasons={recover ? [recover] : resumeNeeded} resume={!recover && engine?.startedFrom === "exam"} />
      ) : null}

      {warning ? (
        <CheatWarning
          warning={warning}
          timeLeft={state.step === "ITEM" ? formatCountdown(clock.remainingMs) : null}
          onAcknowledge={() => engine?.acknowledgeWarning()}
        />
      ) : null}

      <div inert={covered} className={cn(covered && "pointer-events-none select-none blur-[3px]")}>
        {state.step === "SECTION_INTRO" && warmHere.phase === "practice" ? (
          <WarmupPractice
            section={cur.section}
            textKinds={sectionHere?.textKinds ?? NO_KINDS}
            step={warmHere.step}
            maxPlays={state.maxPlays}
            position={cur.position}
            onNext={() => warmDo({ type: "next", total: practiceFor(cur.section, sectionHere?.textKinds).length })}
            onLeave={() => warmDo({ type: "leave" })}
          />
        ) : state.step === "SECTION_INTRO" ? (
          <SectionIntro
            sections={state.sections}
            cur={cur}
            maxPlays={state.maxPlays}
            mode={state.mode}
            claimedLevel={state.claimedLevel}
            clipboardBlock={policy.clipboardBlock}
            warmHere={warmHere}
            warmDo={warmDo}
            busy={busy}
            onStart={start}
            failure={failure}
            headingRef={headingRef}
          />
        ) : nav?.review ? (
          <ReviewScreen entries={entries} disabled={busy} onJump={(s) => goTo(s)} headingRef={headingRef} />
        ) : group && item?.stimulus?.kind === "LISTENING" ? (
          // One page per recording: the player stays in view on the left, all its questions are on the right.
          <div className="mx-auto max-w-[1200px] px-7 pb-10 pt-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
              <div className="lg:sticky lg:top-24">
                <ListeningPlayer
                  key={`group-${members[0]}`}
                  token={token}
                  sectionPosition={cur.position}
                  sequence={item.sequence}
                  stimulus={item.stimulus}
                  engine={engine}
                  note={t("listenGroupNote")}
                  heading={listeningHeading}
                  gateKey={gateKey(token, cur.position, members[0])}
                  onActiveChange={(active) => {
                    audioActiveRef.current = active;
                    if (!active) setLeave(null);
                  }}
                />
              </div>
              <div className="flex flex-col gap-8">
                {group.map((g, idx) => {
                  const flagged = flaggedAt(g.sequence);
                  return (
                    <section key={g.sequence} id={`item-${g.sequence}`} aria-labelledby={`item-${g.sequence}-label`} className={cn("scroll-mt-24", idx > 0 && "border-t border-line pt-8")}>
                      <ItemHeading
                        variant="group"
                        id={`item-${g.sequence}-label`}
                        label={t("question", { n: nav ? g.sequence : cur.answered + idx + 1 })}
                        progress={progressOf.get(g.sequence)}
                        headingRef={g.sequence === item.sequence ? headingRef : undefined}
                        flagged={flagged}
                        flagBusy={busy}
                        onToggleFlag={nav ? () => void toggleFlag(g.sequence) : undefined}
                      />
                      <ItemView
                        key={g.sequence}
                        item={g}
                        answer={answers[g.sequence] ?? {}}
                        onChange={(a) => change(a, g.sequence)}
                        disabled={inputsOff}
                        hidePrompt={idx > 0 && group[idx - 1].prompt === g.prompt}
                      />
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        ) : item ? (
          <div
            className={cn(
              "mx-auto px-7",
              taskSplit ? "pb-4 pt-4" : "pb-10 pt-8",
              item.stimulus?.kind === "READING" || clozeHere || taskSplit ? "max-w-[1200px]" : "max-w-[760px]",
            )}
          >
            <div className={cn(item.stimulus?.kind === "READING" && "grid gap-8 lg:grid-cols-2")}>
              {item.stimulus?.kind === "READING" ? <ReadingPane title={item.stimulus.title} text={item.stimulus.text} /> : null}
              <div>
                <ItemHeading
                  variant="single"
                  label={nav ? t("questionOf", { n: item.sequence, total: entries.length }) : t("question", { n: cur.answered + 1 })}
                  progress={progressOf.get(item.sequence)}
                  headingRef={headingRef}
                  flagged={flaggedHere}
                  compact={taskSplit}
                />
                {item.stimulus?.kind === "LISTENING" ? (
                  <div className="mb-6">
                    <ListeningPlayer
                      // One player per question: the next recording never draws the last one's open player for a frame.
                      key={item.sequence}
                      token={token}
                      sectionPosition={cur.position}
                      sequence={item.sequence}
                      stimulus={item.stimulus}
                      engine={engine}
                      heading={listeningHeading}
                      gateKey={gateKey(token, cur.position, item.sequence)}
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
                  <ItemView key={item.sequence} item={item} answer={answer} onChange={change} disabled={inputsOff} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Outside the blurred wrapper: a CSS filter would pin the fixed bar to the wrapper instead of the window. */}
      {footer ? <div inert={covered}>{footer}</div> : null}

      {finishing !== null ? (
        <div
          role="status"
          style={{ bottom: ABOVE_FOOTER }}
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
        body={finishBody}
        confirmLabel={n(cur && cur.position >= cur.total ? "confirmFinishYesLast" : "confirmFinishYes")}
        cancelLabel={n("confirmBackToExam")}
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
        cancelLabel={n("confirmBackToQuestion")}
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
        cancelLabel={n("confirmBackToQuestion")}
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
        <Illustration name={RECOVER_PICTURE[first]} size="block" className="mx-auto mb-4" />
        <h2 id="recover-title" className="text-[20px] font-bold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-2">{resume ? p("resumeBody") : firstEntry ? p("enterBody") : p("clockRuns")}</p>
        {resume ? (
          <ul className="mt-3 flex list-disc flex-col gap-1 ps-5 text-[13.5px] text-ink-2">
            {reasons.map((r) => (
              <li key={r}>{p(`resume${r}` as "resumeCAMERA")}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={fix}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-5 h-12 w-full")}
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
      className="fixed end-4 z-30 h-[90px] w-[120px] rounded-[8px] border border-line bg-ink object-cover shadow-panel"
    />
  );
}
