"use client";

import { UserRound } from "lucide-react";
import { ListeningGateCard, ListeningPlayerCard } from "@/components/candidate/exam/media-cards";
import { SPEAKING_VIDEO, SpeakingPanel } from "@/components/candidate/exam/SpeakingPanel";
import type { SpeakingPhase } from "@/components/candidate/exam/speaking-flow";
import { TaskImages } from "@/components/candidate/exam/ExamImage";
import { TaskExpectations } from "@/components/candidate/exam/TaskExpectations";
import { TaskPromptCard } from "@/components/candidate/exam/TaskPromptCard";
import { TASK_LEFT, TASK_RIGHT, TASK_SPLIT } from "@/components/candidate/exam/item-parts";
import type { CandidateItem, CandidateStimulus } from "@/lib/exam/safe";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The listening player and the speaking task as the exam draws them, driven
 * by the tutorial's clock instead of audio and a recorder: the same cards
 * (media-cards.tsx, SpeakingPanel.tsx), no request, no microphone, no camera.
 */

/** A recording with no length given plays this long in the demo. */
const DEMO_CLIP_MS = 30_000;

/** Listening: the read-first gate until the script presses it, then a playing player. */
export function DemoListeningPlayer({
  stimulus,
  presses,
  t,
  heading,
  note,
}: {
  stimulus: Extract<CandidateStimulus, { kind: "LISTENING" }>;
  /** When the script pressed the player. */
  presses: readonly number[];
  t: number;
  heading?: string;
  note?: string;
}) {
  const e = useT("exam");
  const started = presses[0];
  let card: React.ReactNode;
  if (started === undefined) {
    card = <ListeningGateCard title={stimulus.title} playsLeft={stimulus.playsLeft} press />;
  } else {
    const progress = Math.min(1, Math.max(0, (t - started) / (stimulus.durationMs ?? DEMO_CLIP_MS)));
    const playing = progress < 1;
    const playsLeft = Math.max(0, stimulus.playsLeft - 1);
    card = (
      <ListeningPlayerCard
        title={stimulus.title}
        label={playing ? e("listenPlaying") : e("listenPlay")}
        playMode={playing ? "busy" : playsLeft > 0 ? "ready" : "off"}
        progress={progress}
        playsLeft={playsLeft}
        note={note}
        press
      />
    );
  }
  return (
    <div>
      {heading ? <h2 className="mb-3 text-title text-ink">{heading}</h2> : null}
      <div data-demo="player">{card}</div>
    </div>
  );
}

/** Where the demo's recorder is: before the first press it prepares, after it records, after the second it is saved. */
export function demoSpeakingPhase(presses: readonly number[]): SpeakingPhase {
  return presses.length === 0 ? "THINKING" : presses.length === 1 ? "RECORDING" : "DONE";
}

/**
 * Speaking: the task on the left; on the right the recorder panel, the same
 * one the exam draws. The first press of its button starts the recording, the
 * second stops it; nothing is recorded. The camera is a drawing and the
 * microphone level a made-up wave, to show where they sit.
 */
export function DemoSpeaking({ item, presses, t }: { item: CandidateItem; presses: readonly number[]; t: number }) {
  if (item.content.kind !== "SPEAKING") return null;
  const content = item.content;
  const [start] = presses;
  const phase = demoSpeakingPhase(presses);
  const recording = phase === "RECORDING";
  return (
    <div className={TASK_SPLIT}>
      <div className={TASK_LEFT} data-demo-task="">
        <TaskImages sequence={item.sequence} images={content.images} />
        <TaskPromptCard text={item.prompt} points={content.studentPoints} />
        <TaskExpectations section="SPEAKING" thinkSeconds={content.thinkSeconds} answerSeconds={content.answerSeconds} />
      </div>
      <div className={TASK_RIGHT}>
        <div data-demo="record" className="flex flex-col lg:flex-1">
          <SpeakingPanel
            phase={phase}
            leftMs={recording ? content.answerSeconds * 1000 - (t - start) : content.thinkSeconds * 1000 - t}
            totalMs={(recording ? content.answerSeconds : content.thinkSeconds) * 1000}
            video={
              <div className={cn(SPEAKING_VIDEO, "flex items-center justify-center")}>
                <UserRound aria-hidden className="size-16 text-ink-3" strokeWidth={1.5} />
              </div>
            }
            micLevel={recording ? 0.1 + 0.12 * Math.abs(Math.sin(t / 220)) : null}
            retakesLeft={Math.max(0, content.maxTakes - 1)}
            press
          />
        </div>
      </div>
    </div>
  );
}
