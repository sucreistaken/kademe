"use client";

import { useEffect, useRef } from "react";
import { AppWindow, ClipboardX, Copy, EyeOff, MonitorX, Monitor, Smartphone, UserX, Users, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ActiveWarning, WarningKind } from "@/lib/proctor/cheat-warning";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The big warning: a modal over the exam, in the same family as the recover
 * panel (fixed, centred card, the content behind it inert). It says what was
 * recorded, the rule in one sentence, which warning of the attempt this is,
 * and that the clock keeps running. One button closes it; Escape does not, and
 * Tab stays on the button. It never ends the exam.
 */

const ICON: Record<WarningKind, LucideIcon> = {
  PHONE: Smartphone,
  MULTIPLE_FACES: Users,
  LEFT_EXAM: AppWindow,
  SECOND_SCREEN: Monitor,
  CLIPBOARD: ClipboardX,
  DUPLICATE_TAB: Copy,
  WRONG_SURFACE: MonitorX,
  GAZE: EyeOff,
  NO_FACE: UserX,
};


export function CheatWarning({ warning, timeLeft, onAcknowledge }: { warning: ActiveWarning; timeLeft: string | null; onAcknowledge: () => void }) {
  const t = useT("cheatWarning");
  const card = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const waiting = warning.persistent && !warning.resolved;
  const Icon = ICON[warning.kind];

  // Focus goes into the card on open and returns where it was on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => {
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, []);

  // A new warning (or the button becoming usable) takes the focus again.
  useEffect(() => {
    (waiting ? card.current : button.current)?.focus({ preventScroll: true });
  }, [warning.kind, warning.count, waiting]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === "Tab") {
      // One control only: the focus never leaves the card.
      e.preventDefault();
      (waiting ? card.current : button.current)?.focus({ preventScroll: true });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 px-4 backdrop-blur-[3px]" onKeyDown={onKeyDown}>
      <div
        ref={card}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cheat-warning-title"
        aria-describedby="cheat-warning-body"
        className="w-full max-w-[520px] rounded-[14px] border border-line bg-surface p-7 text-center shadow-modal outline-none"
      >
        <div aria-hidden className="mx-auto grid size-16 place-items-center rounded-full bg-coral-soft text-coral">
          <Icon className="size-8" strokeWidth={1.75} />
        </div>
        <p className="tnum mx-auto mt-4 w-fit rounded-full bg-sun-soft px-3.5 py-1 text-[14px] font-bold text-sun">{t("counter", { n: warning.count })}</p>
        <h2 id="cheat-warning-title" className="mt-4 text-[24px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink">
          {t(`title${warning.kind}` as "titlePHONE")}
        </h2>
        <div id="cheat-warning-body">
          <p className="mt-2 text-[16px] leading-[1.6] text-ink-2">{t(`rule${warning.kind}` as "rulePHONE")}</p>
          {warning.persistent ? <p className="mt-2 text-[16px] font-bold leading-[1.6] text-ink">{t(`act${warning.kind}` as "actSECOND_SCREEN")}</p> : null}
          <p className="mt-4 text-[14.5px] leading-[1.6] text-ink-2">{t("recorded")}</p>
          {timeLeft ? <p className="tnum mt-1 text-[14.5px] leading-[1.6] text-muted">{t("clockRuns", { time: timeLeft })}</p> : null}
        </div>
        <button
          ref={button}
          type="button"
          disabled={waiting}
          onClick={onAcknowledge}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-6 h-14 w-full text-[16px]")}
        >
          {waiting ? t("waitingSecondScreen") : t("dismiss")}
        </button>
      </div>
    </div>
  );
}
