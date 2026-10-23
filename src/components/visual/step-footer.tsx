// kademe-owned
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { ABOVE_FOOTER, FOOTER_SPACE_VAR, footerButtonState, footerSpace, NOTICE_SPACE_VAR, noticeSpace, type FooterAction } from "./footer-action";
import { JourneyProgress } from "./journey-progress";

function Action({ action, variant, compact = false, exam = false }: { action: FooterAction; variant: "primary" | "secondary"; compact?: boolean; exam?: boolean }) {
  // Compact (a 480px Sheet): the button takes the column's width, no 200px minimum.
  // Exam (the question bar): one fixed-size row, so each button has a fixed width
  // (the flag is as wide in "Flag" as in "Flagged") and the bar never changes size.
  // The widths are EXAM_BAR_WIDTH; while it works, the button shows only its
  // spinner and says the work to screen readers, so a long "saving" never overflows.
  const size = compact
    ? "h-12 w-full px-4 text-[16px]"
    : exam
      ? cn("h-11 shrink-0 px-3 text-[16px] whitespace-nowrap", variant === "primary" ? "w-[176px]" : "w-[168px]")
      : "h-[52px] min-w-[200px] shrink-0 px-6 text-[16px]";
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
  // No aria-busy: it can hold back what is said about the button, so the
  // footer's polite region says the work instead.
  return (
    <button
      type="button"
      id={action.id}
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size: "lg" }),
        size,
        "aria-disabled:cursor-wait",
        // A switched-on toggle (the question flag): filled amber, still a quiet button.
        action.tone === "flagged" && "border-sun-fill bg-sun-fill text-ink hover:border-sun-fill hover:bg-sun-fill",
      )}
      disabled={state.mode === "waiting"}
      aria-disabled={state.mode === "busy" || undefined}
      aria-describedby={state.describedBy}
      aria-pressed={action.tone === "flagged" ? true : undefined}
      aria-label={action.ariaLabel}
      title={action.ariaLabel}
      onClick={state.mode === "ready" ? action.onClick : undefined}
    >
      {state.mode === "busy" ? <Spinner aria-hidden="true" className="size-4" role={undefined} aria-label={undefined} /> : action.icon}
      {exam && state.mode === "busy" ? <span className="sr-only">{state.label}</span> : state.label}
    </button>
  );
}

const buttonState = (action: FooterAction | null | undefined) => (action && action.kind === "button" ? { id: action.id, ...footerButtonState(action) } : null);

/**
 * G9: the bar under every candidate step screen (and the wizards of the
 * panel): the journey on its top edge, the way back on the left, the reasons
 * and the one filled button on the right, always in the same place (last, and
 * never pushed to a new line: a long reason wraps in its own column). On the
 * candidate side it is fixed to the bottom of the window with a spacer before
 * it, so it never covers the content; inside the panel it sticks to the bottom
 * of its column ("sticky"). The bar measures itself into one CSS variable that
 * the spacer and the page's scroll padding read (112px until measured). Enter
 * on a text field never presses it (it is a plain button outside any form).
 */
export function StepFooter({
  primary,
  secondary,
  back,
  journey,
  hint,
  note,
  placement = "viewport",
  measure = true,
  compact = false,
  exam = false,
  notice,
  status,
}: {
  primary?: FooterAction | null;
  secondary?: FooterAction | null;
  back?: { label: string; onClick?: () => void; href?: string; disabled?: boolean } | null;
  journey?: { steps: number; current: number; label: string } | null;
  hint?: string | null;
  note?: ReactNode;
  /**
   * "viewport": fixed to the window with a spacer before it. "sticky": sticks to the
   * bottom of its column. "contained": a plain relative bar inside its parent (no
   * fixed or sticky position, no spacer), for a bar shown inside a demo frame.
   */
  placement?: "viewport" | "sticky" | "contained";
  /**
   * Write the bar's measured height into --step-footer-space and --step-notice-space on
   * the page root. On by default; off for a contained demo bar that must not move the
   * real page's room.
   */
  measure?: boolean;
  /**
   * A narrow column (the panel's Sheet, 480px): the way back and the step
   * label on one line, the buttons under it at full width (the filled one
   * last), then the reasons and the work under way at full width. Off by
   * default: every other footer draws exactly as before.
   */
  compact?: boolean;
  /**
   * The exam's question bar: ONE row of a fixed height that never wraps. The way
   * back is a button on the left (shown disabled, not hidden, when there is no
   * way back), the note (the question strip) fills the middle, and the flag and
   * the primary button have fixed widths on the right (an invisible slot keeps
   * the flag's width when there is no flag). No hint and no reasons: what used
   * to wrap in the bar goes in `notice` and `status`. Off by default.
   */
  exam?: boolean;
  /**
   * Warnings (a recording still plays, a save failed, time is up): drawn in a
   * layer fixed to the top edge of the bar, over the page above it. They add no
   * height to the bar, so the measured room (--step-footer-space) stays put;
   * the layer measures itself into --step-notice-space instead, and the spacer
   * and whatever is pinned above the bar add that room while a notice shows.
   * Ignored by the compact layout.
   */
  notice?: ReactNode;
  /** Exam bar only: what the screen reader hears politely (Saving / Saved); never drawn. */
  status?: string | null;
}) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = bar.current;
    if (!measure || !node || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const write = () => root.style.setProperty(FOOTER_SPACE_VAR, footerSpace(node.getBoundingClientRect().height));
    write();
    const observer = new ResizeObserver(write);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty(FOOTER_SPACE_VAR);
    };
  }, [measure]);
  // The notice layer, measured the same way (a state ref: it comes and goes, and moves between layouts).
  const [noticeNode, setNoticeNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!measure || !noticeNode || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const write = () => root.style.setProperty(NOTICE_SPACE_VAR, noticeSpace(noticeNode.getBoundingClientRect().height));
    write();
    const observer = new ResizeObserver(write);
    observer.observe(noticeNode);
    return () => {
      observer.disconnect();
      root.style.removeProperty(NOTICE_SPACE_VAR);
    };
  }, [noticeNode, measure]);

  const states = [buttonState(secondary), buttonState(primary)];
  const reasons = states.flatMap((s) => (s && s.reason ? [{ id: `${s.id}-why`, text: s.reason }] : []));
  const working = states.find((s) => s?.mode === "busy")?.label ?? null;
  const backClass = "inline-flex min-h-11 items-center gap-1 rounded-lg text-[16px] whitespace-nowrap text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";
  const backLink = back ? (
    back.href ? (
      <Link href={back.href} className={backClass}>
        <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden />
        {back.label}
      </Link>
    ) : (
      <button type="button" onClick={back.onClick} className={backClass}>
        <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden />
        {back.label}
      </button>
    )
  ) : null;
  // With a notice the spacer also leaves room for it, so the end of the page can still be scrolled clear.
  const spacerHeight = notice && !compact ? ABOVE_FOOTER : `var(${FOOTER_SPACE_VAR}, 112px)`;
  const placeClass = placement === "viewport" ? "fixed inset-x-0 bottom-0 z-30" : placement === "sticky" ? "sticky bottom-0 z-20" : "relative";
  const spacer = placement === "viewport" ? <div aria-hidden="true" className="h-[112px]" style={{ height: spacerHeight }} /> : null;
  if (compact) {
    return (
      <>
        {spacer}
        <div ref={bar} data-step-footer className={placeClass}>
          {journey ? <JourneyProgress steps={journey.steps} current={journey.current} label={journey.label} /> : null}
          <div className="space-y-3 border-t border-line bg-paper/95 py-3 backdrop-blur">
            {backLink || journey ? (
              <div className="flex min-h-11 items-center justify-between gap-4">
                <div className="shrink-0">{backLink}</div>
                {journey ? (
                  <span aria-hidden className="tnum text-[14px] whitespace-nowrap text-muted">
                    {journey.label}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              {secondary ? <Action action={secondary} variant="secondary" compact /> : null}
              {primary ? <Action action={primary} variant="primary" compact /> : null}
            </div>
            {/* Reasons and the work under way, politely, at the column's full width. */}
            <div aria-live="polite" className="space-y-1">
              {reasons.map((r) => (
                <p key={r.id} id={r.id} className="text-[14px] leading-[22px] text-ink">
                  {r.text}
                </p>
              ))}
              {reasons.length === 0 && hint ? <p className="text-[14px] leading-[22px] text-ink">{hint}</p> : null}
              {working ? <p className="sr-only">{working}</p> : null}
            </div>
            {note ? <div>{note}</div> : null}
          </div>
        </div>
      </>
    );
  }
  const noticeLayer = notice ? (
    <div ref={setNoticeNode} data-step-footer-notice className="pointer-events-none absolute inset-x-0 bottom-full">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-2 px-4 pb-3 sm:px-7 [&>*]:pointer-events-auto">{notice}</div>
    </div>
  ) : null;
  if (exam) {
    return (
      <>
        {spacer}
        <div ref={bar} data-step-footer className={placeClass}>
          {noticeLayer}
          <div className="border-t border-line bg-paper/95 backdrop-blur">
            {/* 65px of row + the 1px edge above it: 66px at every state. */}
            <div className="mx-auto flex h-[65px] max-w-[1200px] flex-nowrap items-center gap-x-3 px-4 sm:px-7">
              {back ? (
                <button
                  type="button"
                  disabled={back.disabled}
                  onClick={back.onClick}
                  className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-11 w-[112px] shrink-0 px-3 text-[16px] whitespace-nowrap")}
                >
                  <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
                  {back.label}
                </button>
              ) : (
                <div aria-hidden className="w-[112px] shrink-0" />
              )}
              <div className="min-w-0 flex-1">{note}</div>
              {secondary ? <Action action={secondary} variant="secondary" exam /> : <div aria-hidden className="w-[168px] shrink-0" />}
              {primary ? <Action action={primary} variant="primary" exam /> : null}
            </div>
            {/* The work under way and the save state, said politely and never drawn (the region exists before its words do). */}
            <div aria-live="polite" className="sr-only">
              {status ? <p>{status}</p> : null}
              {working ? <p>{working}</p> : null}
            </div>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      {spacer}
      <div ref={bar} data-step-footer className={placeClass}>
        {noticeLayer}
        {journey ? <JourneyProgress steps={journey.steps} current={journey.current} label={journey.label} /> : null}
        <div className="border-t border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex min-h-[84px] max-w-[1000px] items-center justify-between gap-x-6 px-4 py-4 sm:px-7">
            <div className="shrink-0">{backLink}</div>
            <div className="flex min-w-0 items-center justify-end gap-x-4">
              {journey ? (
                <span aria-hidden className="tnum shrink-0 text-[14px] whitespace-nowrap text-muted">
                  {journey.label}
                </span>
              ) : null}
              {/* Reasons and the work under way are announced politely as they change (the region exists before its words do). */}
              <div aria-live="polite" className="min-w-0 space-y-1">
                {reasons.map((r) => (
                  <p key={r.id} id={r.id} className="max-w-[320px] text-end text-[14px] leading-[22px] text-ink">
                    {r.text}
                  </p>
                ))}
                {reasons.length === 0 && hint ? <p className="max-w-[320px] text-end text-[14px] leading-[22px] text-ink">{hint}</p> : null}
                {working ? <p className="sr-only">{working}</p> : null}
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
