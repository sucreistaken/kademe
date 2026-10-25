"use client";

import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import { Bookmark } from "lucide-react";
import { ExamTopBar } from "@/components/candidate/exam/ExamTopBar";
import { ItemHeading } from "@/components/candidate/exam/ItemHeading";
import { ItemView } from "@/components/candidate/exam/ItemView";
import { ReadingPane } from "@/components/candidate/exam/ReadingPane";
import { NavStrip } from "@/components/candidate/exam/ExamNav";
import { ImageSrcContext, type ImageSrc } from "@/components/candidate/exam/ExamImage";
import { ScratchPad } from "@/components/candidate/exam/notes/ScratchPad";
import { StemNotes } from "@/components/candidate/exam/notes/StemNotes";
import { answerProgress } from "@/components/candidate/exam/answer-progress";
import { speakingBarMode, speakingFooter } from "@/components/candidate/exam/exam-bar";
import { WithoutProctor } from "@/components/candidate/proctor/ProctorProvider";
import { StepFooter } from "@/components/visual/step-footer";
import type { CandidateItem } from "@/lib/exam/safe";
import type { NavEntry } from "@/lib/exam/navigation";
import type { ItemAnswer } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { DemoListeningPlayer, DemoSpeaking, demoSpeakingPhase } from "./demo-media";
import { FakeCursor, glideMs } from "./FakeCursor";
import { ITEM_ATTR, pressPoint, resolveTarget } from "./resolve-target";
import type { Target, TutorialScript, UiName } from "./script-types";
import type { DemoState } from "./timeline";

/**
 * The exam screen of a tutorial: the real top bar, item components and
 * bottom bar, drawn at a fixed desktop size (the player scales it to fit) and
 * inert. Nothing in it takes input or focus: every handler is a no-op, there
 * is no invitation token, no proctor engine (WithoutProctor) and no request;
 * pictures come from static files. The script's state decides what is filled
 * in; the cursor and the spotlight are drawn over it.
 */

export const STAGE_W = 1120;
export const STAGE_H = 630;

/**
 * Not an invitation token: only the storage-key prefix the note tools and the
 * clock would use if they ever stored something, which an inert stage never makes them do.
 */
export const DEMO_KEY = "tutorial-demo";

export const DEMO_IMAGES: ImageSrc = { demo: (_sequence, slot) => `/tutorial/img/${encodeURIComponent(slot)}.webp` };

const noop = () => undefined;

/** "24:30" to milliseconds. */
export function clockMs(clock: string): number {
  const [m, s] = clock.split(":").map(Number);
  return ((m || 0) * 60 + (s || 0)) * 1000;
}

/** The strip's cells: earlier questions answered, the stage's items as the script fills them, later ones empty. */
export function stageEntries(script: TutorialScript, answers: readonly ItemAnswer[], marks: readonly boolean[]): NavEntry[] {
  const { current, total } = script.stage.nav;
  const items = script.stage.items;
  return Array.from({ length: total }, (_, k) => {
    const sequence = k + 1;
    const i = items.findIndex((it) => it.sequence === sequence);
    if (i >= 0) return { sequence, ...answerProgress(items[i].content, answers[i]), flagged: !!marks[i] };
    return { sequence, filled: sequence < current ? 1 : 0, total: 1, flagged: false };
  });
}

/**
 * The stage's own room: the task columns and the reading pane size themselves
 * from 100dvh minus the bottom bar's measured space. Inside the stage that
 * space is set from the stage's own bar so the sum comes out at the stage's
 * height, not the window's (the exam measures its bar the same way).
 */
const footerSpace = (barPx: number) => `calc(100dvh - ${STAGE_H}px + ${Math.round(barPx)}px)`;
const STAGE_VARS = { "--step-footer-space": footerSpace(66), "--step-notice-space": "0px" } as CSSProperties;

type StageProps = {
  script: TutorialScript;
  answers: readonly ItemAnswer[];
  marks: readonly boolean[];
  uiPresses: DemoState["uiPresses"];
  /** Stage time, in steps of 100 ms (the clocks and the player's progress read it). */
  t: number;
};

const StageContent = memo(function StageContent({ script, answers, marks, uiPresses, t, content }: StageProps & { content: React.Ref<HTMLDivElement> }) {
  const e = useT("exam");
  const n = useT("examNav");
  const cw = useT("cheatWarning");
  const sec = useT("section");
  const lang = useLocale();
  const { layout, items, passage, nav } = script.stage;
  const first = items[0] as CandidateItem | undefined;
  const members = items.map((it) => it.sequence);
  const last = members[members.length - 1] ?? nav.current;
  const next = last < nav.total ? last + 1 : null;
  const entries = stageEntries(script, answers, marks);
  const progressOf = (i: number) => answerProgress(items[i].content, answers[i]);
  const presses = (name: UiName) => uiPresses[name] ?? [];
  const oneWay = script.section === "SPEAKING";
  const group = layout === "listening" && items.length > 1;
  const clozeHere = first?.content.kind === "GAP" && !!first.content.cloze;
  const wide = layout !== "single" || clozeHere;
  const counter = group ? e("questionRangeOf", { from: members[0], to: last, total: nav.total }) : e("questionOf", { n: nav.current, total: nav.total });
  const remaining = clockMs(script.stage.clock);
  const frame = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const bar = frame.current?.querySelector<HTMLElement>("[data-step-footer]");
    if (bar) frame.current?.style.setProperty("--step-footer-space", footerSpace(bar.offsetHeight));
  }, [oneWay]);

  let body: React.ReactNode = null;
  if (layout === "listening" && first?.stimulus?.kind === "LISTENING") {
    const stimulus = first.stimulus;
    body = (
      <div className="mx-auto max-w-[1200px] px-7 pb-10 pt-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="lg:sticky lg:top-24">
            <DemoListeningPlayer stimulus={stimulus} presses={presses("player")} t={t} heading={e("listenHeading", { index: 2, total: 4 })} note={e("listenGroupNote")} />
            <ScratchPad token={DEMO_KEY} sectionPosition={0} padKey={`group-${members[0]}`} />
          </div>
          <StemNotes token={DEMO_KEY} sectionPosition={0} contentKey={items.map((g) => g.prompt).join("\n")}>
            <div className="flex flex-col gap-8">
              {items.map((g, idx) => (
                <section key={g.sequence} {...{ [ITEM_ATTR]: idx }} className={cn("scroll-mt-24", idx > 0 && "border-t border-line pt-8")}>
                  <ItemHeading variant="group" label={e("question", { n: g.sequence })} progress={progressOf(idx)} flagged={!!marks[idx]} onToggleFlag={noop} />
                  <ItemView item={g} answer={answers[idx] ?? {}} onChange={noop} hidePrompt={idx > 0 && items[idx - 1].prompt === g.prompt} />
                </section>
              ))}
            </div>
          </StemNotes>
        </div>
      </div>
    );
  } else if (first) {
    const reading = layout === "reading" && passage;
    const task = layout === "task";
    body = (
      <div className={cn("mx-auto px-7", task ? "pb-4 pt-4" : "pb-10 pt-8", reading || clozeHere || task ? "max-w-[1200px]" : "max-w-[760px]")}>
        <div className={cn(reading && "grid gap-8 lg:grid-cols-2")}>
          {reading ? <ReadingPane title={passage.title} text={passage.text} token={DEMO_KEY} sectionPosition={0} /> : null}
          <div {...{ [ITEM_ATTR]: 0 }}>
            <ItemHeading variant="single" label={e("questionOf", { n: first.sequence, total: nav.total })} progress={progressOf(0)} flagged={!!marks[0]} compact={task} />
            {first.content.kind === "SPEAKING" ? (
              <DemoSpeaking item={first} presses={presses("record")} t={t} />
            ) : (
              <ItemView item={first} answer={answers[0] ?? {}} onChange={noop} />
            )}
          </div>
        </div>
      </div>
    );
  }

  const strip = (
    <div data-demo="strip" className="w-fit max-w-full">
      <NavStrip entries={entries} current={members} disabled={false} compact onJump={noop} onReview={null} />
    </div>
  );
  const marked = !!marks[0];
  // The speaking bar follows the demo recorder exactly as the exam's bar follows the real one.
  const speakingBar = oneWay
    ? speakingFooter({
        mode: speakingBarMode(demoSpeakingPhase(presses("record"))),
        filled: !!first && progressOf(0).filled > 0,
        hasNext: nav.current < nav.total,
        busy: false,
        t: e,
        onSkip: noop,
        onSave: noop,
      })
    : null;
  const footer = speakingBar ? (
    <StepFooter
      placement="contained"
      measure={false}
      secondary={speakingBar.secondary ? { ...speakingBar.secondary, id: "tutorial-skip" } : null}
      primary={{ ...speakingBar.primary, id: "tutorial-next" }}
      note={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="text-[13.5px] text-muted underline decoration-underline underline-offset-2">
            {e("finishEarly")}
          </button>
        </div>
      }
    />
  ) : (
    <StepFooter
      placement="contained"
      measure={false}
      exam
      back={{ label: n("back"), disabled: members[0] <= 1, onClick: noop }}
      secondary={
        group
          ? null
          : {
              kind: "button",
              id: "tutorial-mark",
              label: marked ? cw("flagSet") : n("flag"),
              icon: <Bookmark aria-hidden className={cn("size-4", marked && "fill-ink")} strokeWidth={2} />,
              tone: marked ? "marked" : undefined,
              onClick: noop,
            }
      }
      primary={{ kind: "button", id: "tutorial-next", label: next === null ? n("finish") : n("next"), onClick: noop }}
      note={strip}
    />
  );

  return (
    <div ref={frame} className="flex h-full flex-col" style={STAGE_VARS}>
      {/* The page scrolls under the sticky top bar, as the exam's window does; the bottom bar stays below it. */}
      <div ref={content} className="min-h-0 flex-1 overflow-hidden">
        <ExamTopBar
          inQuestion
          sectionName={sec(script.section)}
          counter={counter}
          wide={wide}
          showLanguagePicker={false}
          lang={lang}
          locales={[]}
          proctored={false}
          recLabel={null}
          screenShare={false}
          remainingMs={Math.max(0, remaining - t)}
          sectionMs={Math.max(remaining * 2, 30 * 60_000)}
          token={DEMO_KEY}
          sectionPosition={0}
        />
        {body}
      </div>
      {footer}
    </div>
  );
});

/** The same object for as long as its content stays the same. */
function useStable<T>(value: T): T {
  const key = JSON.stringify(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => value, [key]);
}

type Box = { x: number; y: number; w: number; h: number };
/** What is drawn over the stage; `glide` is how long the cursor takes to its new place (0 jumps). */
type Overlay = { cursor: { x: number; y: number } | null; spot: Box | null; carry: string | null; glide: number };

const same = (a: Box | { x: number; y: number } | null, b: Box | { x: number; y: number } | null) =>
  a === b || (!!a && !!b && JSON.stringify(a) === JSON.stringify(b));

/** The stage with its cursor and spotlight. `jump` changes when the player seeks: the cursor then jumps instead of gliding. */
export function DemoStage({ script, state, jump, reducedMotion }: { script: TutorialScript; state: DemoState; jump: number; reducedMotion: boolean }) {
  const stage = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ cursor: null, spot: null, carry: null, glide: 0 });
  const shown = useRef<Overlay>(overlay);
  const lastJump = useRef(jump);
  const t = Math.floor(state.t / 100) * 100;
  // stateAt builds new arrays every frame; the stage redraws only when what it shows changes.
  const answers = useStable(state.answers);
  const marks = useStable(state.marks);
  const uiPresses = useStable(state.uiPresses);

  // Measured after each render: the targets move when the script fills an answer, and the content may scroll to show one.
  useLayoutEffect(() => {
    const root = stage.current;
    const area = content.current;
    if (!root || !area) return;
    const rootBox = root.getBoundingClientRect();
    const scale = rootBox.width / STAGE_W || 1;
    const seeking = lastJump.current !== jump;
    lastJump.current = jump;
    // A seek starts the page from the top, so a step looks the same however it was reached.
    if (seeking) area.scrollTop = 0;
    const boxOf = (target: Target | null, press: boolean): Box | null => {
      if (!target) return null;
      const found = resolveTarget(root, target);
      if (!found) return null;
      const el = press ? pressPoint(found) : found;
      // A target in the page under the top bar is scrolled into view first (to the middle of the room).
      const bar = area.querySelector("header");
      if (area.contains(el) && !bar?.contains(el)) {
        const a = area.getBoundingClientRect();
        const top = a.top + (bar?.getBoundingClientRect().height ?? 0);
        const r = el.getBoundingClientRect();
        if (r.bottom > a.bottom - 8 * scale || r.top < top + 8 * scale) {
          const delta = (r.top - top) / scale - Math.max(0, (a.bottom - top - r.height) / scale / 2);
          area.scrollTop = Math.max(0, area.scrollTop + delta);
        }
      }
      const r = el.getBoundingClientRect();
      return { x: (r.left - rootBox.left) / scale, y: (r.top - rootBox.top) / scale, w: r.width / scale, h: r.height / scale };
    };
    const spot = boxOf(state.spotlight, false);
    const aim = boxOf(state.cursor, true);
    const prev = shown.current;
    // A target the click made go away (a cloze word once its gap is filled) leaves the cursor where it pressed.
    const cursor = aim ? { x: Math.round(aim.x + aim.w / 2), y: Math.round(aim.y + aim.h / 2) } : state.cursor ? prev.cursor : null;
    const carryEl = state.carry ? resolveTarget(root, state.carry.from) : null;
    const carry = carryEl ? (carryEl.textContent ?? "").trim() || null : null;
    if (same(prev.cursor, cursor) && same(prev.spot, spot) && prev.carry === carry) return;
    let glide = prev.glide;
    if (!same(prev.cursor, cursor)) {
      const distance = prev.cursor && cursor ? Math.hypot(cursor.x - prev.cursor.x, cursor.y - prev.cursor.y) : 0;
      glide = reducedMotion || seeking || !prev.cursor ? 0 : glideMs(distance);
    }
    shown.current = { cursor, spot, carry, glide };
    // Positions come from the laid out page, so they can only be set after it is drawn.
    setOverlay(shown.current);
  }, [state, jump, reducedMotion]);

  // Where the cursor waits before its first move: the middle of the stage, low.
  const cursor = overlay.cursor ?? { x: STAGE_W / 2, y: STAGE_H * 0.72 };
  const pressKey = state.press && state.t - state.press.at < 600 ? state.press.at : null;
  return (
    <WithoutProctor>
      <ImageSrcContext.Provider value={DEMO_IMAGES}>
        <div ref={stage} className="relative overflow-hidden bg-paper" style={{ width: STAGE_W, height: STAGE_H }}>
          <div inert aria-hidden="true" className="h-full">
            <StageContent script={script} answers={answers} marks={marks} uiPresses={uiPresses} t={t} content={content} />
          </div>
          {overlay.spot ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-40 rounded-[12px] border-[3px] border-brand shadow-[0_0_0_9999px_rgba(29,33,39,0.38)] motion-safe:transition-all motion-safe:duration-300"
              style={{ left: overlay.spot.x - 6, top: overlay.spot.y - 6, width: overlay.spot.w + 12, height: overlay.spot.h + 12 }}
            />
          ) : null}
          <FakeCursor x={cursor.x} y={cursor.y} glide={overlay.glide} pressKey={reducedMotion ? null : pressKey} carry={overlay.carry} />
        </div>
      </ImageSrcContext.Provider>
    </WithoutProctor>
  );
}
