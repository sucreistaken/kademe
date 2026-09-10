"use client";

import { useEffect, useState } from "react";
import { useMT } from "@/i18n/manager-client";
import { Button } from "./button";

const UNDO_SECONDS = 8;

/**
 * The replacement for "are you sure?". The action already happened; this strip
 * gives it back for eight seconds and then gets out of the way.
 *
 * It is deliberately a sticky panel, which is one of the two places the design
 * rules allow a shadow.
 *
 * `message` arrives already translated from the caller, because only the caller
 * knows what just happened. The button label is the same word every time, so it
 * comes from the shared dictionary instead of being passed in at seven call
 * sites. Every strip in the product renders inside the manager shell, which is
 * what puts the provider above this component.
 */
export function UndoStrip({
  message,
  action,
  hiddenFields,
}: {
  message: string;
  /** Server action that reverses what just happened. */
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
}) {
  const t = useMT("common");
  const [secondsLeft, setSecondsLeft] = useState(UNDO_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  if (secondsLeft <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
      <div
        className={cnStrip}
        role="status"
        aria-live="polite"
      >
        <span className="text-sm text-ink">{message}</span>
        <form action={action} className="contents">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Button type="submit" variant="secondary" size="sm">
            {t("undo")}
          </Button>
        </form>
        <span className="tnum w-6 text-right text-[13px] text-muted">{secondsLeft}</span>
      </div>
    </div>
  );
}

const cnStrip =
  "pointer-events-auto flex items-center gap-4 rounded-[14px] border border-line " +
  "bg-surface px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.16)]";
