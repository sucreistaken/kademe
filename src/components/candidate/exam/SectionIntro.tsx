"use client";

import { useEffect, useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import { Clock, ListChecks } from "lucide-react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { buttonVariants } from "@/components/ui/button";
import { SectionTile } from "@/components/visual/section-look";
import { SectionCheer } from "@/components/candidate/exam/SectionCheer";
import { ErrorLine } from "@/components/candidate/exam/ErrorLine";
import { WarmupOffer } from "@/components/candidate/exam/warmup/Warmup";
import { TutorialButton } from "@/components/candidate/exam/tutorial/TutorialButton";
import { TutorialPlayer } from "@/components/candidate/exam/tutorial/TutorialPlayer";
import { TUTORIAL_SCRIPTS } from "@/components/candidate/exam/tutorial/scripts";
import { useProctor } from "@/components/candidate/proctor/ProctorProvider";
import type { WarmupAction, WarmupState } from "@/components/candidate/exam/warmup/warmup-state";
import { textRuleKey } from "@/components/candidate/exam/section-rule";
import type { CandidateState } from "@/lib/exam-flow";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";
import { introNeedsMixedPlaysRule } from "@/lib/exam/listening-plays";

/**
 * The screen before a section: its length, its rules, the "get ready" row
 * (the how-it-works video and the warm-up offer) and the start button.
 */
export function SectionIntro({
  sections,
  cur,
  maxPlays,
  mode,
  claimedLevel,
  clipboardBlock,
  warmHere,
  warmDo,
  busy,
  onStart,
  failure,
  headingRef,
}: {
  sections: CandidateState["sections"];
  cur: NonNullable<CandidateState["current"]>;
  maxPlays: number;
  mode: CandidateState["mode"];
  claimedLevel: CandidateState["claimedLevel"];
  /** Writing: whether pasting is blocked, which changes the writing rule. */
  clipboardBlock: boolean;
  warmHere: WarmupState;
  warmDo: (action: WarmupAction) => unknown;
  busy: boolean;
  onStart: () => void;
  failure: { text: string; retry: () => void } | null;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const t = useT("exam");
  const n = useT("examNav");
  const sec = useT("section");
  const f = useT("examFlow");
  const tt = useTranslations("tutorial");
  const { engine } = useProctor();
  const [watching, setWatching] = useState(false);
  // The tutorial speaks and is not the exam: while it is open its voice is not
  // "talking during the exam" and no big warning covers it; both come back on close.
  useEffect(() => {
    if (!watching || !engine) return;
    engine.suppressVoice("tutorial", true);
    engine.suppressWarnings("tutorial", true);
    return () => {
      engine.suppressVoice("tutorial", false);
      engine.suppressWarnings("tutorial", false);
    };
  }, [engine, watching]);
  return (
    <CandidateColumn width={720} padding="px-7 pt-6 pb-6">
      <SectionCheer sections={sections} current={cur.section} position={cur.position} />
      {sections.some((x) => x.position === cur.position - 1 && x.skipped) ? (
        <p role="status" className="mb-4 rounded-[10px] bg-subtle px-4 py-3 text-[14px] leading-[1.6] text-ink-2">
          {f("skippedNote")}
        </p>
      ) : null}
      <div className="tnum text-overline uppercase text-muted">
        {t("sectionOf", { n: cur.position, total: cur.total })}
      </div>
      {(() => {
        const s = sections.find((x) => x.position === cur.position)!;
        const count = s.itemsLabel.includes("-")
          ? t("itemsAdaptive", { range: s.itemsLabel })
          : cur.section === "WRITING" || cur.section === "SPEAKING"
            ? t("tasks", { n: s.itemsLabel })
            : s.textOnly
              ? n("texts", { n: s.itemsLabel })
              : t("items", { n: s.itemsLabel });
        return (
          <>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="flex items-center gap-4">
                <SectionTile section={cur.section} size="lg" className="size-14 rounded-2xl [&_svg]:size-7" />
                <h1 ref={headingRef} tabIndex={-1} className="text-headline-lg text-ink outline-none">
                  {sec(cur.section)}
                </h1>
              </div>
              <div className="tnum flex flex-wrap gap-2">
                <span className="inline-flex h-9 items-center gap-2 rounded-full bg-cream px-3.5 text-[14px] font-bold text-ink">
                  <Clock aria-hidden className="size-4 text-ink-2" strokeWidth={2.25} />
                  {t("minutes", { n: s.minutes })}
                </span>
                <span className="inline-flex h-9 items-center gap-2 rounded-full bg-cream px-3.5 text-[14px] font-bold text-ink">
                  <ListChecks aria-hidden className="size-4 text-ink-2" strokeWidth={2.25} />
                  {count}
                </span>
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-1.5 text-[15px] leading-[1.5] text-ink">
              {[
                s.textOnly
                  ? n(textRuleKey(s.textKinds), { n: s.itemsLabel, minutes: Math.max(1, Math.round(s.minutes / Number(s.itemsLabel))) })
                  : s.navigable && cur.section === "GRAMMAR"
                    ? n("ruleGRAMMARFixed")
                    : cur.section === "WRITING"
                      ? f(clipboardBlock ? "ruleWritingPaste" : "ruleWritingPlain")
                      : cur.section === "LISTENING" && introNeedsMixedPlaysRule(maxPlays, mode, claimedLevel)
                        ? sec("ruleLISTENINGMixed", { plays: maxPlays })
                        : sec(`rule${cur.section}` as "ruleGRAMMAR", { plays: maxPlays }),
                ...(s.navigable ? [n("ruleBack"), n("ruleReview")] : [t("ruleNoBack")]),
                t("ruleClock"),
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-3">
                  <span aria-hidden className="mt-[8px] size-2 shrink-0 rounded-full bg-accent" />
                  {rule}
                </li>
              ))}
            </ul>
          </>
        );
      })()}
      <WarmupOffer
        state={warmHere}
        onTry={() => warmDo({ type: "try" })}
        onSkip={() => warmDo({ type: "skip" })}
        video={<TutorialButton script={TUTORIAL_SCRIPTS[cur.section]} onOpen={() => setWatching(true)} />}
        videoLead={tt("watchLead")}
      />
      <TutorialPlayer script={TUTORIAL_SCRIPTS[cur.section]} open={watching} onOpenChange={setWatching} />
      <button
        type="button"
        disabled={busy}
        onClick={onStart}
        className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-5 h-12 w-full")}
      >
        {busy ? t("saving") : t("startSection")}
      </button>
      {failure ? <ErrorLine text={failure.text} onRetry={failure.retry} /> : null}
    </CandidateColumn>
  );
}
