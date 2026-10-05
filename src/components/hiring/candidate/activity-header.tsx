"use client";

import { pickTextLang } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";

/** A version text in the candidate's language; a fallback in the other language carries its own `lang`. */
export function VersionText({ value, locale }: { value: { tr: string; en: string }; locale: Locale }) {
  const shown = pickTextLang(value, locale);
  return shown.lang === locale ? <>{shown.text}</> : <span lang={shown.lang}>{shown.text}</span>;
}

/**
 * HIRING-UX 6.6-6.9: the kind of question, then the question as the screen's
 * heading (it takes focus when the question opens), then the team's note.
 */
export function ActivityHeader({
  activity,
  locale,
  kicker,
  headingRef,
  large = false,
}: {
  activity: Pick<CandidateActivity, "id" | "prompt" | "note">;
  locale: Locale;
  kicker: string;
  headingRef: React.Ref<HTMLHeadingElement>;
  large?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-muted">{kicker}</p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        id={`prompt-${activity.id}`}
        className={cn("whitespace-pre-line text-ink outline-none", large ? "text-[22px] leading-8 font-medium" : "text-[18px] leading-7 font-medium")}
      >
        <VersionText value={activity.prompt} locale={locale} />
      </h2>
      {pickTextLang(activity.note, locale).text ? (
        <p className="whitespace-pre-line text-[16px] leading-[26px] text-ink-2">
          <VersionText value={activity.note} locale={locale} />
        </p>
      ) : null}
    </div>
  );
}
