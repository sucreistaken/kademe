"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { StageRule } from "@/solutions/hiring/rules/candidate-flow";
import type { CurrentStage } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import { VersionText } from "./activity-header";
import { introMinutes } from "./runner-model";

/**
 * HIRING-UX 6.5 and 6.10: which stage, how long (the clock's own minutes,
 * grace included: C25), how many questions, only the rules that apply, and
 * that the clock starts with the button. Between stages it says how the last
 * one ended; before the last one, that finishing sends everything.
 */
export function StageIntro({
  current,
  deadline,
  locale,
  busy,
  error,
  onStart,
  headingRef,
}: {
  current: CurrentStage;
  deadline: string;
  locale: Locale;
  busy: boolean;
  error: React.ReactNode;
  onStart: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT("hiringStage");
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
  return (
    <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
      {current.previous ? (
        <p role="status" className="mb-6 text-[16px] leading-[26px] text-ink">
          {current.previous.closedByClock ? t("previousTime", { n: current.previous.position }) : t("previousDone", { n: current.previous.position })}
        </p>
      ) : null}
      <h1 ref={headingRef} tabIndex={-1} className="tnum text-[28px] leading-9 font-semibold text-ink outline-none">
        {t("stageOf", { n: current.position, total: current.total })} · <VersionText value={current.stage.name} locale={locale} />
      </h1>
      {current.stage.description.tr.trim() || current.stage.description.en.trim() ? (
        <p className="mt-3 whitespace-pre-line text-[16px] leading-[26px] text-ink-2">
          <VersionText value={current.stage.description} locale={locale} />
        </p>
      ) : null}
      <p className="tnum mt-4 text-[16px] text-ink">{t("meta", { minutes: introMinutes(current), count: current.stage.activities.length })}</p>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-[16px] leading-[26px] text-ink-2">
        {current.rules.map((r) => (
          <li key={r.kind}>{rule(r)}</li>
        ))}
      </ul>
      {current.last ? <p className="mt-5 text-[16px] leading-[26px] font-medium text-ink">{t("lastStage")}</p> : null}
      <p className="mt-5 text-[16px] font-medium text-ink">{t("clockStarts")}</p>
      <ActionBar>
        {/* Disabled only while it works, and then its own label says so ("Başlatılıyor"), like the landing's start. */}
        <Button id="stage-start" variant="primary" size="lg" className="w-full text-[16px] sm:w-auto" disabled={busy} onClick={onStart}>
          {busy ? t("starting") : t("start")}
        </Button>
        {error}
      </ActionBar>
      <p className="tnum mt-6 text-[14px] text-muted">{t("deadline", { date: deadline })}</p>
    </div>
  );
}
