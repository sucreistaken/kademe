"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { buttonVariants } from "@/components/ui/button";
import { ItemView } from "@/components/candidate/exam/ItemView";
import { SPEAKING_VIDEO, SpeakingPanel } from "@/components/candidate/exam/SpeakingPanel";
import { hintOf, practiceFor, practiceItem } from "@/components/candidate/exam/warmup/practice-data";
import type { WarmupState } from "@/components/candidate/exam/warmup/warmup-state";
import { useStepFocus } from "@/hooks/use-step-focus";
import type { ItemAnswer, Section, TextGapKind } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The optional practice on a section introduction (see warmup-state.ts).
 * Everything here lives in the browser: the sample answers are local state,
 * no request is made and nothing is scored or timed.
 */

const HINT_KEY = {
  choice: "warmHintChoice",
  ctest: "warmHintCTest",
  cloze: "warmHintCloze",
  wordbank: "warmHintWordBank",
  open: "warmHintOpen",
  tfng: "warmHintTfng",
  matching: "warmHintMatching",
  listening: "warmHintListening",
  writing: "warmHintWriting",
  speaking: "warmHintSpeaking",
} as const;

/** The offer on the intro: "Try" is secondary and "Skip" a text button, so "Start the section" stays the only primary. */
const trySecondary = cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-11 px-5");
const skipText = cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11 px-4 text-ink");
const solid = cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 px-5");

/**
 * On the introduction, the "get ready" row: the offer, or the line that says
 * the practice is over. `video` (the how-it-works button) sits before "Try" and
 * stays when the offer is gone, with `videoLead` as its line.
 */
export function WarmupOffer({
  state,
  onTry,
  onSkip,
  video,
  videoLead,
}: {
  state: WarmupState;
  onTry: () => void;
  onSkip: () => void;
  video?: ReactNode;
  videoLead?: string;
}) {
  const t = useT("examFlow");
  const row = "mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl bg-cream px-5 py-3";
  const line = "min-w-0 flex-1 basis-64 text-[15px] font-medium leading-[1.5] text-ink";
  if (state.phase === "offer") {
    return (
      <div className={row}>
        <p className={line}>{t("warmOffer")}</p>
        <div className="flex gap-3">
          {video}
          <button type="button" onClick={onTry} className={trySecondary}>
            {t("warmTry")}
          </button>
          <button type="button" onClick={onSkip} className={skipText}>
            {t("warmSkip")}
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === "done") {
    return video ? (
      <div className={row}>
        <p role="status" className={cn(line, "font-semibold")}>
          {t("warmReady")}
        </p>
        {video}
      </div>
    ) : (
      <p role="status" className="mt-4 rounded-2xl bg-cream px-5 py-3 text-[15px] font-semibold text-ink">
        {t("warmReady")}
      </p>
    );
  }
  if (state.phase === "skipped" && video) {
    return (
      <div className={row}>
        <p className={line}>{videoLead}</p>
        {video}
      </div>
    );
  }
  return null;
}

export function WarmupPractice({
  section,
  textKinds,
  step,
  maxPlays,
  position,
  onNext,
  onLeave,
}: {
  section: Section;
  /** The kinds of text the section holds, so the practice shows the way of answering the exam asks for. */
  textKinds: readonly TextGapKind[];
  step: number;
  maxPlays: number;
  position: number;
  onNext: () => void;
  onLeave: () => void;
}) {
  const t = useT("examFlow");
  const defs = practiceFor(section, textKinds);
  const def = defs[step];
  const item = useMemo(() => practiceItem(section, step, textKinds), [section, step, textKinds]);
  const [answers, setAnswers] = useState<Record<number, ItemAnswer>>({});
  const answer = answers[step] ?? {};
  const headingRef = useStepFocus<HTMLHeadingElement>(`warm:${position}:${step}`);
  const hint = hintOf(def);
  const last = step + 1 >= defs.length;
  const hintText =
    def.content.kind === "SPEAKING"
      ? t("warmHintSpeaking", { think: def.content.thinkSeconds, answer: def.content.answerSeconds })
      : hint === "listening"
        ? t("warmHintListening", { plays: maxPlays })
        : t(HINT_KEY[hint]);
  return (
    <CandidateColumn width={760}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-subtle px-3 py-1 text-[12.5px] font-bold uppercase tracking-[0.04em] text-ink-2">{t("warmBadge")}</span>
        <span className="tnum text-[12.5px] font-medium text-muted">{t("warmStep", { n: step + 1, total: defs.length })}</span>
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-[15px] font-medium leading-[1.6] text-ink-2 outline-none">
        {t("warmNote")}
      </h1>
      <p className="mt-2 rounded-[10px] bg-canvas px-4 py-3 text-[14px] leading-[1.6] text-ink-2">{hintText}</p>

      <div className="mt-6">
        {def.passage ? (
          <article className="mb-6 rounded-[14px] border border-line bg-surface p-5">
            <div lang="de" className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
              {def.passage.title}
            </div>
            <div lang="de" className="mt-2 whitespace-pre-line text-[16px] leading-[1.75] text-ink">
              {def.passage.body}
            </div>
          </article>
        ) : null}
        {def.sample ? (
          <article className="mb-6 rounded-[14px] border border-dashed border-line-strong bg-surface p-5">
            <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{t("warmSampleListening")}</div>
            <div lang="de" className="mt-2 text-[16px] leading-[1.75] text-ink">
              {def.sample.text}
            </div>
          </article>
        ) : null}
        {item.content.kind === "SPEAKING" ? (
          <SpeakingPreview prompt={item.prompt} thinkSeconds={item.content.thinkSeconds} />
        ) : (
          <ItemView item={item} answer={answer} onChange={(next) => setAnswers((a) => ({ ...a, [step]: next }))} />
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onNext} className={solid}>
          {last ? t("warmFinish") : t("warmNext")}
        </button>
        <button type="button" onClick={onLeave} className="text-[13.5px] text-muted underline decoration-underline underline-offset-2 hover:text-ink">
          {t("warmLeave")}
        </button>
      </div>
    </CandidateColumn>
  );
}

/**
 * What the speaking answer area looks like: the exam's own recorder panel
 * (steps, ring, big button) at its first step, switched off. No camera, no
 * recording; the page's hint line says so.
 */
function SpeakingPreview({ prompt, thinkSeconds }: { prompt: string; thinkSeconds: number }) {
  const t = useT("examFlow");
  return (
    <div>
      <p lang="de" className="whitespace-pre-line text-[17px] font-medium leading-[1.6] text-ink">
        {prompt}
      </p>
      <div className="mt-5 max-w-[560px]">
        <SpeakingPanel
          phase="THINKING"
          leftMs={thinkSeconds * 1000}
          totalMs={thinkSeconds * 1000}
          video={<div className={cn(SPEAKING_VIDEO, "flex items-center justify-center px-4 text-center text-[13.5px] text-white/80")}>{t("warmSpeakingPreview")}</div>}
          disabled
        />
      </div>
    </div>
  );
}
