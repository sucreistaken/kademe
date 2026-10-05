// kademe-owned
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { footerButtonState, type FooterAction } from "./footer-action";
import { JourneyProgress } from "./journey-progress";

function Action({ action, variant }: { action: FooterAction; variant: "primary" | "secondary" }) {
  const size = "h-[52px] min-w-[200px] shrink-0 px-6 text-[16px]";
  if (action.kind === "link") {
    return (
      <Link id={action.id} href={action.href} className={cn(buttonVariants({ variant, size: "lg" }), size)}>
        {action.label}
      </Link>
    );
  }
  const state = footerButtonState(action);
  // A waiting button is truly disabled (grey, its reason next to it). A working
  // one stays focusable and filled (aria-disabled, done.tsx M4), so the focus is
  // still on it when the work ends or fails; a click on it then does nothing.
  return (
    <button
      type="button"
      id={action.id}
      data-slot="button"
      className={cn(buttonVariants({ variant, size: "lg" }), size, "aria-disabled:cursor-wait")}
      disabled={state.mode === "waiting"}
      aria-disabled={state.mode === "busy" || undefined}
      aria-busy={state.mode === "busy" || undefined}
      aria-describedby={state.describedBy}
      onClick={state.mode === "ready" ? action.onClick : undefined}
    >
      {state.mode === "busy" ? <Spinner aria-hidden="true" className="size-4" role={undefined} aria-label={undefined} /> : null}
      {state.label}
    </button>
  );
}

/**
 * G9: the bar under every candidate step screen (and the wizards of the
 * panel): the journey on its top edge, the way back on the left, the reason
 * and the one filled button on the right, always in the same place (last, and
 * never pushed to a new line: a long reason wraps in its own column). On the
 * candidate side it is fixed to the bottom of the window with a spacer before
 * it, so it never covers the content; inside the panel it sticks to the bottom
 * of its column ("sticky"). Enter on a text field never presses it (it is a
 * plain button outside any form).
 */
export function StepFooter({
  primary,
  secondary,
  back,
  journey,
  hint,
  note,
  placement = "viewport",
}: {
  primary?: FooterAction | null;
  secondary?: FooterAction | null;
  back?: { label: string; onClick?: () => void; href?: string } | null;
  journey?: { steps: number; current: number; label: string } | null;
  hint?: string | null;
  note?: ReactNode;
  placement?: "viewport" | "sticky";
}) {
  const reason = primary && primary.kind === "button" ? footerButtonState(primary).reason : null;
  const backClass = "inline-flex min-h-11 items-center gap-1 rounded-lg text-[16px] whitespace-nowrap text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";
  return (
    <>
      {placement === "viewport" ? <div aria-hidden="true" className="h-[112px]" /> : null}
      <div data-step-footer className={placement === "viewport" ? "fixed inset-x-0 bottom-0 z-30" : "sticky bottom-0 z-20"}>
        {journey ? <JourneyProgress steps={journey.steps} current={journey.current} label={journey.label} /> : null}
        <div className="border-t border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex min-h-[84px] max-w-[1000px] items-center justify-between gap-x-6 px-4 py-4 sm:px-7">
            <div className="shrink-0">
              {back ? (
                back.href ? (
                  <Link href={back.href} className={backClass}>
                    <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
                    {back.label}
                  </Link>
                ) : (
                  <button type="button" onClick={back.onClick} className={backClass}>
                    <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
                    {back.label}
                  </button>
                )
              ) : null}
            </div>
            <div className="flex min-w-0 items-center justify-end gap-x-4">
              {journey ? (
                <span aria-hidden className="tnum shrink-0 text-[14px] whitespace-nowrap text-muted">
                  {journey.label}
                </span>
              ) : null}
              {/* The reason is announced politely as it changes (the region exists before its words do). */}
              <div aria-live="polite" className="min-w-0">
                {reason && primary ? (
                  <p id={`${primary.id}-why`} className="max-w-[320px] text-right text-[14px] leading-[22px] text-muted">
                    {reason}
                  </p>
                ) : hint ? (
                  <p className="max-w-[320px] text-right text-[14px] leading-[22px] text-ink">{hint}</p>
                ) : null}
              </div>
              {secondary ? <Action action={secondary} variant="secondary" /> : null}
              {primary ? <Action action={primary} variant="primary" /> : null}
            </div>
          </div>
          {note ? <div className="mx-auto max-w-[1000px] px-4 pb-4 sm:px-7">{note}</div> : null}
        </div>
      </div>
    </>
  );
}
