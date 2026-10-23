"use client";

import { UserRound } from "lucide-react";
import { ListeningGateCard, ListeningPlayerCard, SPEAKING_VIDEO, SpeakingClock } from "@/components/candidate/exam/media-cards";
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
 * (media-cards.tsx), no request, no microphone, no camera.
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

/**
 * Speaking: the task on the left; on the right the camera box and the clock.
 * The first press of the record button starts the recording, the second
 * stops it; nothing is recorded.
 */
export function DemoSpeaking({ item, presses, t }: { item: CandidateItem; presses: readonly number[]; t: number }) {
  const e = useT("exam");
  if (item.content.kind !== "SPEAKING") return null;
  const content = item.content;
  const [start, stop] = presses;
  return (
    <div className={TASK_SPLIT}>
      <div className={TASK_LEFT} data-demo-task="">
        <TaskImages sequence={item.sequence} images={content.images} />
        <TaskPromptCard text={item.prompt} points={content.studentPoints} />
        <TaskExpectations section="SPEAKING" thinkSeconds={content.thinkSeconds} answerSeconds={content.answerSeconds} />
      </div>
      <div className={cn(TASK_RIGHT, "gap-4")}>
        <div className={cn(SPEAKING_VIDEO, "flex items-center justify-center")}>
          <UserRound aria-hidden className="size-16 text-ink-3" strokeWidth={1.5} />
        </div>
        <div className="shrink-0" data-demo="record">
          {start === undefined ? (
            <SpeakingClock phase="THINKING" leftMs={content.thinkSeconds * 1000 - t} press />
          ) : stop === undefined ? (
            <SpeakingClock phase="RECORDING" leftMs={content.answerSeconds * 1000 - (t - start)} press />
          ) : (
            <p className="text-[14px] font-medium text-ink">{e("recorded")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
