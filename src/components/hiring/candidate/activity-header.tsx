"use client";

import type { LucideIcon } from "lucide-react";
import { pickTextLang } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/locale";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";

/** A version text in the candidate's language; a fallback in the other language carries its own `lang`. */
export function VersionText({ value, locale }: { value: { tr: string; en: string }; locale: Locale }) {
  const shown = pickTextLang(value, locale);
  return shown.lang === locale ? <>{shown.text}</> : <span lang={shown.lang}>{shown.text}</span>;
}

/**
 * HIRING-UX 6.6-6.9, HIRING-VISUAL-FLOW 3.6: the kind of question as a small
 * chip with its icon, then the question as the screen's heading (24/34; it
 * takes focus when the question opens), then the team's note.
 */
export function ActivityHeader({
  activity,
  locale,
  kicker,
  icon: Icon,
  headingRef,
}: {
  activity: Pick<CandidateActivity, "id" | "prompt" | "note">;
  locale: Locale;
  kicker: string;
  icon?: LucideIcon;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="space-y-3">
      <p className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[14px] text-ink">
        {Icon ? <Icon className="size-4 text-muted" strokeWidth={1.75} aria-hidden /> : null}
        {kicker}
      </p>
      <h2 ref={headingRef} tabIndex={-1} id={`prompt-${activity.id}`} className="text-[24px] leading-[34px] font-medium whitespace-pre-line text-ink outline-none">
        <VersionText value={activity.prompt} locale={locale} />
      </h2>
      {pickTextLang(activity.note, locale).text ? (
        <p className="text-[16px] leading-[26px] whitespace-pre-line text-ink-2">
          <VersionText value={activity.note} locale={locale} />
        </p>
      ) : null}
    </div>
  );
}
