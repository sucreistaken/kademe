"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { StageActivity } from "@/lib/candidate-flow";
import {
  ActivityKicker,
  ActivityPrompt,
  SavedMark,
  useAutosave,
} from "@/components/candidate/activities/shared";
import { useT } from "@/i18n/candidate-client";

/**
 * Single and multiple choice. The candidate is never told whether a choice was
 * correct: auto-scored questions feed a separate Knowledge Score on the manager
 * side, and turning this screen into a quiz with feedback would change what is
 * being measured.
 */
export function ChoiceActivity({
  token,
  activity,
  locale,
  onAnswered,
}: {
  token: string;
  activity: StageActivity;
  locale: "tr" | "en";
  onAnswered: (answered: boolean) => void;
}) {
  const t = useT("activity");
  const multi = activity.type === "MULTI_CHOICE";
  const [picked, setPicked] = useState<string[]>(activity.payload?.choiceIds ?? []);
  const { save, status, savedAt } = useAutosave(token, activity.index, 0);
  const choices = activity.config.choices ?? [];

  function toggle(id: string) {
    const next = multi
      ? picked.includes(id)
        ? picked.filter((p) => p !== id)
        : [...picked, id]
      : [id];
    setPicked(next);
    save({ choiceIds: next }, true);
    onAnswered(next.length > 0);
  }

  return (
    <div>
      <ActivityKicker>{multi ? t("multiChoice") : t("singleChoice")}</ActivityKicker>
      <ActivityPrompt
        prompt={activity.prompt}
        note={activity.note || (multi ? t("pickMany") : t("pickOne"))}
      />

      <div className="mt-6 flex flex-col gap-2">
        {choices.map((choice) => {
          const on = picked.includes(choice.id);
          return (
            <label
              key={choice.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[10px] border bg-surface px-4 py-3.5 transition-colors",
                on ? "border-ink" : "border-line hover:bg-canvas",
              )}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={`activity-${activity.index}`}
                checked={on}
                onChange={() => toggle(choice.id)}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span className="text-sm leading-[1.5] text-ink">
                {choice.label[locale] || choice.label.tr || choice.label.en}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-3">
        <SavedMark status={status} savedAt={savedAt} />
      </div>
    </div>
  );
}
