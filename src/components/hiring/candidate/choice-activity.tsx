"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { choiceLetter, choiceShortcut } from "@/components/visual/choice-keys";
import { useChoiceShortcuts } from "@/components/visual/use-choice-shortcuts";
import { useT } from "@/i18n/candidate-client";
import { ActivityHeader, VersionText } from "./activity-header";
import { useAutosave } from "./autosave";
import type { ActivityProps } from "./text-activity";

/**
 * HIRING-UX 6.8, HIRING-VISUAL-FLOW 3.7: letter cards to click (A, B, C; no
 * radio dot; two columns past four options), keys 1-9 with the key shown on
 * the card on desktop (never while the candidate types into a field),
 * "Birden fazla seçebilirsin" only for multiple choice, and no right or wrong
 * feedback. Every pick saves at once. A closed group points at the reason the
 * runner shows (`reasonId`).
 */
export function ChoiceActivity({ token, position, activity, initial, locale, headingRef, flushes, onChange, disabled, onRefused, reasonId }: ActivityProps) {
  const t = useT("hiringChoice");
  const multi = activity.type === "MULTI_CHOICE";
  const choices = activity.choices ?? [];
  const [chosen, setChosen] = useState<string[]>(initial.choiceIds ?? []);
  const { save } = useAutosave({ token, position, activityId: activity.id, flushes, onRefused });

  function choose(next: string[]) {
    setChosen(next);
    save({ choiceIds: next }, true);
    onChange({ choiceIds: next });
  }
  const toggle = (id: string) => (multi ? choose(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]) : choose([id]));
  // Task 4 carry 7: the keys come from the one shared hook; only the first nine choices have a key.
  useChoiceShortcuts({ count: Math.min(9, choices.length), disabled, onPick: (i) => toggle(choices[i].id) });

  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={multi ? t("multiKicker") : t("single")} icon={ListChecks} headingRef={headingRef} />
      {multi ? <p className="text-[16px] text-ink-2">{t("multi")}</p> : null}
      <ChoiceCardGroup
        type={multi ? "multi" : "single"}
        name={`choice-${activity.id}`}
        value={chosen}
        onChange={(next) => choose(next)}
        labelledBy={`prompt-${activity.id}`}
        describedBy={disabled && reasonId ? reasonId : undefined}
        disabled={disabled}
        columns={choices.length > 4 ? 2 : 1}
        items={choices.map((c, i) => ({
          value: c.id,
          marker: choiceLetter(i),
          shortcut: choiceShortcut(i),
          label: (
            <>
              <span className="sr-only">{t("marker", { letter: choiceLetter(i) })}: </span>
              <VersionText value={c.label} locale={locale} />
            </>
          ),
        }))}
      />
    </div>
  );
}
