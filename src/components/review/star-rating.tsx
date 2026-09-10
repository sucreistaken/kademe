"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useMT } from "@/i18n/manager-client";

/**
 * Scale text is bilingual data. It is resolved to the reader's language on the
 * server, so this control receives plain strings and never picks a language.
 */
export type ScaleLevel = {
  value: number;
  label: string;
  anchor: string | null;
};

/**
 * A bare 1 to 5 is weak: research on structured interviewing is clear that the
 * lift comes from a written definition per level, so the anchor is part of the
 * control rather than documentation hidden somewhere else. Hovering a star
 * shows that level's meaning, and the current value is always spelled out in
 * words next to the stars.
 */
export function StarRating({
  value,
  levels,
  onChange,
  labelledBy,
}: {
  value: number | null;
  levels: ScaleLevel[];
  onChange: (value: number | null) => void;
  labelledBy?: string;
}) {
  const t = useMT("rail");
  const shared = useMT("shared");
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const shownLevel = levels.find((l) => l.value === shown) ?? null;

  /** Scale labels already carry their number ("4 · beklentinin üstünde"), so
   *  prefixing blindly produces "4 · 4 · …". Used by both the visible text and
   *  the accessible name, which is where the duplicate first showed up. */
  const levelText = (level: ScaleLevel) =>
    level.label.startsWith(String(level.value))
      ? level.label
      : t("levelText", { value: level.value, label: level.label });

  return (
    <div>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-labelledby={labelledBy}
        onMouseLeave={() => setHover(null)}
      >
        {levels.map((level) => {
          const filled = shown !== null && level.value <= shown;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={value === level.value}
              aria-label={levelText(level)}
              title={level.anchor ?? level.label}
              onMouseEnter={() => setHover(level.value)}
              onFocus={() => setHover(level.value)}
              onBlur={() => setHover(null)}
              // Clicking the current value clears it: "scored 3" and "not scored
              // yet" are different states and both must be reachable.
              onClick={() => onChange(value === level.value ? null : level.value)}
              className={cn(
                "rounded-[6px] p-0.5 text-[17px] leading-none transition-colors",
                filled ? "text-ink" : "text-line hover:text-muted",
              )}
            >
              {filled ? "★" : "☆"}
            </button>
          );
        })}

        <span className="ml-2 text-[12.5px] text-muted tnum">
          {shownLevel ? levelText(shownLevel) : shared("notScored")}
        </span>
      </div>

      {shownLevel?.anchor ? (
        <p className="mt-1.5 text-[12px] leading-snug text-muted">
          {shownLevel.anchor}
        </p>
      ) : null}
    </div>
  );
}
