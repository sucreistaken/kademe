"use client";

import { useEffect, useState } from "react";
import { Clock, CornerUpLeft, Flag, Hourglass, ListChecks, RotateCcw } from "lucide-react";
import { FactTiles } from "@/components/visual/fact-tiles";
import { IconRow } from "@/components/visual/icon-row";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { StageRule } from "@/solutions/hiring/rules/candidate-flow";
import type { CurrentStage } from "@/solutions/hiring/rules/candidate-state";
import { VersionText } from "./activity-header";
import { useWindowWidth } from "./desktop-gate";
import { startWaitsForWidth } from "./device-class";
import { introMinutes } from "./runner-model";

const RULE_ICON: Record<StageRule["kind"], typeof Clock> = {
  think: Hourglass,
  thinkStrict: Hourglass,
  takes: RotateCcw,
  noRetake: RotateCcw,
  noBack: CornerUpLeft,
  back: CornerUpLeft,
  lateAllowed: Clock,
};

/**
 * HIRING-UX 6.5 and 6.10, HIRING-VISUAL-FLOW 3.5: which stage (the company's
 * name for it), its time (the clock's own minutes, grace included: C25), the
 * questions and retakes as tiles, only the rules that apply as icon rows, and
 * that the clock starts with the press (clockStarts) next to the one filled
 * button. Between stages a
 * calm line says how the last one ended. Below 640px an unstarted stage waits
 * (3.0). No question of the stage is shown here (leak rule: the intro is a
 * preparation screen).
 */
export function StageIntro({
  current,
  deadline,
  locale,
  busy,
  error,
  lostPrevious,
  onStart,
  headingRef,
}: {
  current: CurrentStage;
  deadline: string;
  locale: Locale;
  busy: boolean;
  error: React.ReactNode;
  /** The server refused the previous stage's last words after its deadline (Minor 6). */
  lostPrevious: "text" | "choice" | null;
  onStart: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT("hiringStage");
  const tg = useT("hiringGate");
  // 3.0: below 640px a stage that has not started waits with its reason; a started one is never held (the clock runs).
  const narrow = startWaitsForWidth(useWindowWidth());
  // Minor 9: a status that arrives with the page is not read out; it is filled in just after, so it is.
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setAnnounce(true), 250);
    return () => window.clearTimeout(id);
  }, []);
  const rule = (r: StageRule) => {
    switch (r.kind) {
      case "think":
        return r.seconds !== null ? t("ruleThink", { seconds: r.seconds }) : t("ruleThinkAny");
      case "thinkStrict":
        return r.seconds !== null ? t("ruleThinkStrict", { seconds: r.seconds }) : t("ruleThinkStrictAny");
      case "takes":
        return r.count !== null ? t("ruleTakes", { count: r.count }) : t("ruleTakesAny");
      case "noRetake":
        return t("ruleNoRetake");
      case "noBack":
        return t("ruleNoBack");
      case "back":
        return t("ruleBack");
      case "lateAllowed":
        return t("ruleLate");
    }
  };
  const previousText = current.previous
    ? [
        current.previous.closedByClock ? t("previousTime", { n: current.previous.position }) : t("previousDone", { n: current.previous.position }),
        // Honest about words the server refused after the deadline: "up to that moment" is saved, they are not.
        lostPrevious === "text" ? t("previousLost") : lostPrevious === "choice" ? t("previousLostChoice") : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const takes = current.rules.find((r): r is Extract<StageRule, { kind: "takes" }> => r.kind === "takes");
  // Numbers only: how long, how many questions, how many retakes (never a question itself).
  const facts = [
    { icon: Clock, value: t("factMinutes", { minutes: introMinutes(current) }), label: t("factMinutesLabel") },
    { icon: ListChecks, value: t("factQuestions", { count: current.stage.activities.length }), label: t("factQuestionsLabel") },
    ...(takes && takes.count !== null ? [{ icon: RotateCcw, value: t("factTakes", { count: takes.count }), label: t("factTakesLabel") }] : []),
  ];
  const description = current.stage.description.tr.trim() || current.stage.description.en.trim();
  return (
    <>
      {current.previous ? (
        <div className="mx-auto max-w-[640px] pt-8">
          <p aria-hidden className="rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[26px] text-ink">
            {previousText}
          </p>
          <p role="status" className="sr-only">
            {announce ? previousText : ""}
          </p>
        </div>
      ) : null}
      <StepScreen
        layout="single"
        width={640}
        kicker={<span className="tnum tracking-[0.06em] uppercase">{t("stageOf", { n: current.position, total: current.total })}</span>}
        title={<VersionText value={current.stage.name} locale={locale} />}
        titleRef={headingRef}
        lead={
          description ? (
            <p className="whitespace-pre-line">
              <VersionText value={current.stage.description} locale={locale} />
            </p>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <FactTiles items={facts} />
          <div className="space-y-4">
            {current.rules.map((r) => (
              <IconRow key={r.kind} icon={RULE_ICON[r.kind]} title={rule(r)} />
            ))}
            {current.last ? <IconRow icon={Flag} title={t("lastStage")} /> : null}
          </div>
          <p className="tnum text-[14px] text-muted">{t("deadline", { date: deadline })}</p>
          {error}
        </div>
      </StepScreen>
      <StepFooter
        hint={t("clockStarts")}
        primary={{ kind: "button", id: "stage-start", label: t("start"), busy, busyLabel: t("starting"), waitReason: narrow ? tg("narrowStart") : null, onClick: onStart }}
      />
    </>
  );
}
