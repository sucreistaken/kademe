"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useT } from "@/i18n/candidate-client";
import { ActivityHeader, VersionText } from "./activity-header";
import { useAutosave } from "./autosave";
import { isTypingTarget, keyIndex } from "./runner-model";
import type { ActivityProps } from "./text-activity";

/**
 * HIRING-UX 6.8: large rows to click or tap, keys 1-9 (never while the
 * candidate types into a field), "Birden fazla seçebilirsin" only for
 * multiple choice, and no right or wrong feedback. Every pick saves at once.
 */
export function ChoiceActivity({ token, position, activity, initial, locale, headingRef, flushes, onChange, disabled, onRefused }: ActivityProps) {
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
  // The listener reads the latest toggle through a ref, so it is bound once per question.
  const latest = useRef(toggle);
  useEffect(() => {
    latest.current = toggle;
  });
  const ids = choices.map((c) => c.id).join(",");

  useEffect(() => {
    if (disabled || !ids) return;
    const list = ids.split(",");
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target instanceof HTMLElement ? { tagName: e.target.tagName, type: (e.target as HTMLInputElement).type, isContentEditable: e.target.isContentEditable } : null)) return;
      const i = keyIndex(e.key, list.length);
      if (i === null) return;
      e.preventDefault();
      latest.current(list[i]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [disabled, ids]);

  const row =
    "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[24px] text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft has-[:disabled]:cursor-not-allowed";
  const number = (i: number) =>
    i < 9 ? (
      <span className="tnum w-5 shrink-0 text-[14px] text-muted" aria-hidden>
        {i + 1}
      </span>
    ) : (
      <span className="w-5 shrink-0" aria-hidden />
    );

  return (
    <div className="space-y-5">
      <ActivityHeader activity={activity} locale={locale} kicker={multi ? t("multiKicker") : t("single")} headingRef={headingRef} />
      {multi ? <p className="text-[16px] text-ink-2">{t("multi")}</p> : null}
      {multi ? (
        <div role="group" aria-labelledby={`prompt-${activity.id}`} className="space-y-2">
          {choices.map((c, i) => (
            <label key={c.id} className={row}>
              {number(i)}
              <Checkbox checked={chosen.includes(c.id)} onCheckedChange={() => toggle(c.id)} disabled={disabled} className="size-5" />
              <VersionText value={c.label} locale={locale} />
            </label>
          ))}
        </div>
      ) : (
        <RadioGroup aria-labelledby={`prompt-${activity.id}`} value={chosen[0] ?? ""} onValueChange={(v) => choose([v])} disabled={disabled} className="gap-2">
          {choices.map((c, i) => (
            <label key={c.id} className={row}>
              {number(i)}
              <RadioGroupItem value={c.id} className="size-5" />
              <VersionText value={c.label} locale={locale} />
            </label>
          ))}
        </RadioGroup>
      )}
      {choices.length > 0 ? <p className="tnum text-[14px] text-muted">{t("keys", { max: Math.min(9, choices.length) })}</p> : null}
    </div>
  );
}
