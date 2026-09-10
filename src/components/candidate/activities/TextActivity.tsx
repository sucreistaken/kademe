"use client";

import { useState } from "react";
import type { StageActivity } from "@/lib/candidate-flow";
import {
  ActivityKicker,
  SavedMark,
  useAutosave,
} from "@/components/candidate/activities/shared";
import { useT } from "@/i18n/candidate-client";

/**
 * Artboard A11. LONG_TEXT, SHORT_TEXT and SCENARIO all end in the same place: a
 * field that saves itself, with the save mark and the character count on the
 * strip underneath. SCENARIO only changes the kicker.
 */
export function TextActivity({
  token,
  activity,
  onAnswered,
  asAlternative = false,
  kicker,
}: {
  token: string;
  activity: StageActivity;
  onAnswered: (answered: boolean) => void;
  /**
   * Set when this field stands in for a video or audio answer. The response is
   * then flagged, so the manager reads it knowing it was the written
   * alternative rather than a candidate who ignored the instructions.
   */
  asAlternative?: boolean;
  kicker?: string;
}) {
  const t = useT("activity");
  const [text, setText] = useState(activity.payload?.text ?? "");
  const { save, status, savedAt } = useAutosave(token, activity.index);

  const maxChars =
    activity.config.maxChars ?? (activity.type === "SHORT_TEXT" ? 280 : 2000);
  const minChars = activity.config.minChars ?? 0;
  const short = activity.type === "SHORT_TEXT";

  function update(value: string) {
    const next = value.slice(0, maxChars);
    setText(next);
    save(asAlternative ? { text: next, usedTextAlternative: true } : { text: next });
    onAnswered(next.trim().length >= Math.max(1, minChars));
  }

  return (
    <div>
      <ActivityKicker>
        {kicker ?? (activity.type === "SCENARIO" ? t("scenario") : t("writtenAnswer"))}
      </ActivityKicker>
      <h2 className="mt-2.5 text-[23px] font-semibold leading-[1.42] text-ink text-pretty">
        {activity.prompt}
      </h2>
      {/* Artboard A11 always has a line under the question. An activity with no
          note of its own gets the general one rather than a gap. */}
      <p className="mt-2.5 text-[13.5px] leading-[1.6] text-muted">
        {activity.note || t("noteFallback")}
      </p>

      <div className="mt-[22px] overflow-hidden rounded-xl border border-line-strong focus-within:border-ink/40">
        {short ? (
          <input
            value={text}
            onChange={(e) => update(e.target.value)}
            placeholder={t("placeholderShort")}
            className="w-full bg-surface px-[22px] py-5 text-[15px] leading-[1.75] text-ink outline-none placeholder:text-ink-3"
          />
        ) : (
          <textarea
            value={text}
            onChange={(e) => update(e.target.value)}
            rows={10}
            placeholder={t("placeholderLong")}
            className="min-h-[260px] w-full resize-y bg-surface px-[22px] py-5 text-[15px] leading-[1.75] text-ink outline-none placeholder:text-ink-3"
          />
        )}
        <div className="flex items-center justify-between border-t border-hairline bg-paper px-4 py-[11px]">
          <SavedMark status={status} savedAt={savedAt} />
          <span className="tnum text-[12px] text-muted">
            {t("charCount", { used: text.length, max: maxChars })}
          </span>
        </div>
      </div>

      {minChars > 0 && text.trim().length < minChars ? (
        <p className="mt-2 text-[13px] text-muted">
          {t("minChars", { count: minChars })}
        </p>
      ) : null}
    </div>
  );
}
