"use client";

import { useMemo, useState } from "react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { buttonVariants } from "@/components/ui/button";
import { ItemView } from "@/components/candidate/exam/ItemView";
import { hintOf, PRACTICE, practiceItem } from "@/components/candidate/exam/warmup/practice-data";
import type { WarmupState } from "@/components/candidate/exam/warmup/warmup-state";
import { useStepFocus } from "@/hooks/use-step-focus";
import type { ItemAnswer, Section } from "@/lib/exam/types";
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
  tfng: "warmHintTfng",
  matching: "warmHintMatching",
  listening: "warmHintListening",
  writing: "warmHintWriting",
  speaking: "warmHintSpeaking",
} as const;

const quiet = "h-11 rounded-[10px] border border-line-strong bg-surface px-5 text-[14.5px] font-semibold text-ink hover:bg-canvas";
const solid = cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 px-5");

/** On the introduction: the offer, or the line that says the practice is over. */
export function WarmupOffer({ state, onTry, onSkip }: { state: WarmupState; onTry: () => void; onSkip: () => void }) {
  const t = useT("examFlow");
  if (state.phase === "offer") {
    return (
      <div className="mt-7 rounded-[14px] border border-line bg-surface p-5">
        <p className="text-[14.5px] font-medium leading-[1.6] text-ink">{t("warmOffer")}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onTry} className={solid}>
            {t("warmTry")}
          </button>
          <button type="button" onClick={onSkip} className={quiet}>
            {t("warmSkip")}
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === "done") {
    return (
      <p role="status" className="mt-7 rounded-[14px] bg-subtle px-5 py-4 text-[14.5px] font-semibold text-ink">
        {t("warmReady")}
      </p>
    );
  }
  return null;
}

export function WarmupPractice({
  section,
  step,
  maxPlays,
  position,
  onNext,
  onLeave,
}: {
  section: Section;
  step: number;
  maxPlays: number;
  position: number;
  onNext: () => void;
  onLeave: () => void;
}) {
  const t = useT("examFlow");
  const defs = PRACTICE[section];
  const def = defs[step];
  const item = useMemo(() => practiceItem(section, step), [section, step]);
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
          <SpeakingPreview prompt={item.prompt} />
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

/** What the speaking answer area looks like. No camera, no recording. */
function SpeakingPreview({ prompt }: { prompt: string }) {
  const t = useT("examFlow");
  const e = useT("exam");
  return (
    <div>
      <p lang="de" className="whitespace-pre-line text-[17px] font-medium leading-[1.6] text-ink">
        {prompt}
      </p>
      <div className="mt-5 flex flex-col items-start gap-5 md:flex-row">
        <div className="flex aspect-[4/3] w-full max-w-[360px] items-center justify-center rounded-[10px] bg-ink px-6 text-center text-[13.5px] text-white/80">
          {t("warmSpeakingPreview")}
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium text-muted">{e("thinkTime")}</div>
          <div className="tnum mt-1 text-[32px] font-bold text-accent">0:30</div>
          <button type="button" disabled className="mt-3 h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60">
            {e("startNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
