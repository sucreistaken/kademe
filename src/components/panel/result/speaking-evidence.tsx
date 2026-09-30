"use client";

import { useRef, useState } from "react";
import { VideoPlayer, type PlayerHandle } from "@/components/review/video-player";
import { Transcript } from "@/components/review/transcript";
import type { TranscriptWord } from "@/db/schema/types";

/** The recording and its transcript, linked: a click on a line seeks the video. */
export function SpeakingEvidence({
  src,
  words,
  text,
  name,
}: {
  src: string;
  words: TranscriptWord[];
  text: string;
  name: string;
}) {
  const player = useRef<PlayerHandle | null>(null);
  const [ms, setMs] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <VideoPlayer src={src} onTimeUpdate={setMs} handleRef={player} transcriptText={text} transcriptName={name} />
      <Transcript words={words} text={text} currentMs={ms} onSeek={(t) => player.current?.seekTo(t)} />
    </div>
  );
}
