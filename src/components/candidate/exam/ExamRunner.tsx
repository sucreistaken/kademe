"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { environmentFacts, useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { ItemView, hasAnyAnswer } from "@/components/candidate/exam/ItemView";
import { ListeningPlayer, SpeakingItem } from "@/components/candidate/exam/MediaItems";
import { apiSend } from "@/lib/client/api";
import { useStageClock } from "@/lib/client/use-stage-clock";
import { stepPath } from "@/lib/candidate-routes";
import type { CandidateState } from "@/lib/exam-flow";
import type { ItemAnswer } from "@/lib/exam/types";
import { formatCountdown } from "@/lib/timer";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The exam: section introductions and questions on one page, so moving on
 * never reloads the document (a reload would drop the screen share and
 * fullscreen). The server decides every step; this screen renders the state
 * it is given and sends back one answer at a time.
 */
export function ExamRunner({ token, initial }: { token: string; initial: CandidateState }) {
  const router = useRouter();
  const t = useT("exam");
  const sec = useT("section");
  const { engine, snap } = useProctor();
  const [state, setState] = useState(initial);
  const [answer, setAnswer] = useState<ItemAnswer>(initial.current?.item?.answer ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [finishing, setFinishing] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);
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
      setAnswer(next.current?.item?.answer ?? {});
      setSavedAt(null);
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
  const clock = useStageClock(
    token,
    {
      serverNow: cur ? Date.parse(cur.serverNow) : 0,
      deadlineAt: cur?.deadlineAt ? Date.parse(cur.deadlineAt) : null,
    },
    () => void refresh(),
  );

  // Autosave of typed answers; choices save on "continue".
  const item = cur?.item ?? null;
  const typedItem = item && (item.content.kind === "WRITING" || item.content.kind === "SHORT_TEXT" || item.content.kind === "GAP");
  function change(next: ItemAnswer) {
    setAnswer(next);
    if (!typedItem || !cur || !item) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await apiSend(token, "/answer", { sectionPosition: cur.position, sequence: item.sequence, answer: next }, "PUT");
        setSavedAt(Date.now());
      } catch {
        /* commit sends it again */
      }
    }, 800);
  }

  async function act(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      apply(await apiSend<CandidateState>(token, path, body));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "SECTION_EXPIRED" || code === "ITEM_MISMATCH" || code === "SECTION_MISMATCH") await refresh();
      else setError(t("connectionProblem"));
    } finally {
      setBusy(false);
    }
  }

  // "Finish section now" waits eight seconds, so a slip can be undone.
  useEffect(() => {
    if (finishing === null || !cur) return;
    const id = window.setTimeout(() => {
      if (finishing <= 1) {
        setFinishing(null);
        void act("/section/submit", { sectionPosition: cur.position });
      } else setFinishing(finishing - 1);
    }, 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishing]);

  const recover = snap?.banner?.kind === "recover" ? snap.banner.reason : null;
  const resumeNeeded = proctored && engine && snap?.ready && snap.guarding ? engine.needsResume() : [];
  const blocked = !!recover || resumeNeeded.length > 0;

  if (!cur) return null;

  return (
    <div className="relative">
      {state.step === "ITEM" ? (
        <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-between gap-4 px-7">
            <div className="flex items-center gap-3 text-[13.5px]">
              <span className="font-semibold text-ink">{sec(cur.section)}</span>
              <span className="tnum text-muted">
                {cur.itemTotal ? t("questionOf", { n: cur.answered + 1, total: cur.itemTotal }) : t("question", { n: cur.answered + 1 })}
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
            <h1 className="mt-2.5 text-[32px] font-bold leading-[1.2] tracking-[-0.03em] text-ink">{sec(cur.section)}</h1>
            <p className="tnum mt-2 text-[15px] text-ink-2">
              {(() => {
                const s = state.sections.find((x) => x.position === cur.position)!;
                const count = s.itemsLabel.includes("-")
                  ? t("itemsAdaptive", { range: s.itemsLabel })
                  : cur.section === "WRITING" || cur.section === "SPEAKING"
                    ? t("tasks", { n: s.itemsLabel })
                    : t("items", { n: s.itemsLabel });
                return `${t("minutes", { n: s.minutes })} · ${count}`;
              })()}
            </p>
            <ul className="mt-6 flex list-disc flex-col gap-2 pl-5 text-[14.5px] leading-[1.6] text-ink-2">
              <li>{sec(`rule${cur.section}` as "ruleGRAMMAR", { plays: state.maxPlays })}</li>
              <li>{t("ruleNoBack")}</li>
              <li>{t("ruleClock")}</li>
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("/section/start", { sectionPosition: cur.position })}
              className="mt-8 h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted"
            >
              {busy ? t("saving") : t("startSection")}
            </button>
            {error ? <ErrorLine text={error} onRetry={() => void refresh()} /> : null}
          </CandidateColumn>
        ) : item ? (
          <div className={cn("mx-auto px-7 pb-16 pt-8", item.stimulus?.kind === "READING" ? "max-w-[1200px]" : "max-w-[760px]")}>
            <div className={cn(item.stimulus?.kind === "READING" && "grid gap-8 lg:grid-cols-2")}>
              {item.stimulus?.kind === "READING" ? (
                <article className="rounded-[14px] border border-line bg-surface p-6 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
                  <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{item.stimulus.title}</div>
                  <div lang="de" className="mt-3 whitespace-pre-line text-[16px] leading-[1.75] text-ink">
                    {item.stimulus.text}
                  </div>
                </article>
              ) : null}
              <div>
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
                    onChange={setAnswer}
                    engine={engine}
                  />
                ) : (
                  <ItemView item={item} answer={answer} onChange={change} disabled={busy} />
                )}

                <div className="mt-8">
                  <button
                    type="button"
                    disabled={busy || !hasAnyAnswer(item, answer)}
                    aria-describedby={!hasAnyAnswer(item, answer) ? "save-why" : undefined}
                    onClick={() => act("/answer/commit", { sectionPosition: cur.position, sequence: item.sequence, answer })}
                    className="h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                  >
                    {busy ? t("saving") : t("saveNext")}
                  </button>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
                    <span id="save-why" className="text-muted">
                      {!hasAnyAnswer(item, answer) ? t("answerFirst") : savedAt ? t("autosaved") : ""}
                    </span>
                    <span className="flex gap-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("/answer/commit", { sectionPosition: cur.position, sequence: item.sequence, answer: {} })}
                        className="text-muted underline decoration-underline underline-offset-2 hover:text-ink"
                      >
                        {t("skip")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinishing(8)}
                        className="text-muted underline decoration-underline underline-offset-2 hover:text-ink"
                      >
                        {t("finishEarly")}
                      </button>
                    </span>
                  </div>
                  {error ? <ErrorLine text={error} onRetry={() => void refresh()} /> : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {finishing !== null ? (
        <div role="status" className="fixed inset-x-0 bottom-6 z-30 mx-auto flex w-fit items-center gap-4 rounded-[10px] bg-ink px-5 py-3 text-[13.5px] text-white shadow-panel">
          <span className="tnum">{t("finishingIn", { s: finishing })}</span>
          <button type="button" onClick={() => setFinishing(null)} className="font-semibold underline underline-offset-2">
            {t("undo")}
          </button>
        </div>
      ) : null}

      {proctored && engine?.cameraStream && item?.content.kind !== "SPEAKING" ? <SelfView stream={engine.cameraStream} /> : null}
    </div>
  );
}

function ErrorLine({ text, onRetry }: { text: string; onRetry: () => void }) {
  const t = useT("exam");
  return (
    <p className="mt-3 text-center text-[13px] text-danger">
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
  const title = resume ? p("resumeTitle") : p(`recover${first}` as "recoverFULLSCREEN");
  const action = p(`recover${first}Action` as "recoverFULLSCREENAction");
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-paper/70 px-4 pt-[18vh]">
      <div role="alertdialog" aria-labelledby="recover-title" className="w-full max-w-[460px] rounded-[14px] border border-line bg-surface p-6 shadow-modal">
        <h2 id="recover-title" className="text-[20px] font-bold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-2">{resume ? p("resumeBody") : p("clockRuns")}</p>
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
      className="fixed bottom-4 right-4 z-30 h-[90px] w-[120px] rounded-[8px] border border-line bg-ink object-cover shadow-panel"
    />
  );
}
