// kademe-owned
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { FooterAction } from "@/components/visual/footer-action";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { useKeepFocus, useStepFocus } from "@/hooks/use-step-focus";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import { currentHash, leaveHashStep, noHash, pushHash, replaceHash, subscribeHash } from "@/lib/client/hash-step";
import { exitKey, flowFocusKey, flowHashFix, flowStepOf, type FlowJourney } from "./flow-model";

/** One screen of a guided flow (W1): one question as its title, its one decision as the body, the footer's one filled button. */
export type FlowStep = {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  layout: "single" | "split";
  body: ReactNode;
  primary: FooterAction;
  secondary?: FooterAction | null;
  /** Under the footer's bar: a refusal in the server's words, a "Düzelt ›" link. */
  note?: ReactNode;
};

/** W7: where leaving goes, and whether something typed would be lost (the label says so; nothing asks). */
export type FlowExit = { dirty: boolean; href: string } | { dirty: boolean; onClick: () => void };

const LINK =
  "inline-flex min-h-11 items-center text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";

/**
 * W3, W4: the step of a flow. On a page it lives in the address's hash (the
 * browser's back button steps back, a reload opens the same step, a link can
 * open a step); inside a Sheet, whose page owns the hash, it lives in memory.
 * The values live in the caller's one state, so no step change loses one.
 * `moved` turns true at the first step change on this page (2.3: the first
 * load never animates).
 */
export function useFlowStep<S extends string>(input: { steps: readonly S[]; firstInvalid: S | null; mode: "hash" | "memory" }) {
  const hash = useSyncExternalStore(subscribeHash, currentHash, noHash);
  const [memory, setMemory] = useState<S>(input.steps[0]);
  const [moved, setMoved] = useState(false);
  const mode = input.mode;
  // The browser's own back and forward buttons are a step change too.
  useEffect(() => (mode === "hash" ? subscribeHash(() => setMoved(true)) : undefined), [mode]);
  const step = flowStepOf(mode === "hash" ? hash : `#${memory}`, input);
  // W3: the address never runs ahead of the step shown (a reload or a copied
  // link on a step that is not ready yet): it is rewritten in place, without a
  // new entry and without an event, so nothing moves and no focus is taken.
  const fix = mode === "hash" ? flowHashFix(hash, step, input.steps[0]) : null;
  useEffect(() => {
    if (fix !== null) replaceHash(fix);
  }, [fix]);
  return {
    step,
    moved,
    go(to: S) {
      setMoved(true);
      if (mode === "hash") pushHash(`#${to}`);
      else setMemory(to);
    },
    /** The footer's "Geri": the browser's back on a page; in memory, the step named (or the one before). */
    back(to?: S) {
      setMoved(true);
      if (mode === "hash") leaveHashStep();
      else setMemory(to ?? input.steps[Math.max(0, input.steps.indexOf(step) - 1)]);
    },
  };
}

/**
 * W2, W7: the flow's name on the left, the way out on the right ("Çık", or
 * "Kaydetmeden çık" while values changed; none when the caller gives no
 * exit). An exit to an address with a hash is a plain anchor (next/link fires
 * no hashchange, Part 2 placement rule).
 */
export function FlowHeader({ kicker, exit }: { kicker: ReactNode; exit?: FlowExit | null }) {
  const t = useMT("flow");
  const label = exit ? t(exitKey(exit.dirty)) : null;
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-line pb-2">
      <p className="min-w-0 truncate text-[14px] leading-[22px] text-muted">{kicker}</p>
      {!exit ? null : "href" in exit ? (
        exit.href.includes("#") ? (
          <a href={exit.href} className={LINK}>
            {label}
          </a>
        ) : (
          <Link href={exit.href} className={LINK}>
            {label}
          </Link>
        )
      ) : (
        <button type="button" onClick={exit.onClick} className={LINK}>
          {label}
        </button>
      )}
    </div>
  );
}

/**
 * K12, W1-W10: a multi-field job as a guided flow inside the panel (the side
 * menu stays, D12). One step at a time: its question as the heading (focused on
 * every step change, and again when the control a keyboard user was on
 * unmounts or turns disabled), its one decision, and the sticky footer with
 * "‹ Geri", "Adım n / N" and the one filled button. On a page the step is a
 * StepScreen (single 640px for fields, split for choices and summaries); in a
 * Sheet (480px) it is a compact column, and the Sheet's own close button is
 * the exit (W7). Never used on the exam's pages (4.12).
 */
export function GuidedFlow({
  kicker,
  step,
  journey,
  back,
  exit,
  enter = false,
  arrive = false,
  container = "page",
}: {
  kicker: ReactNode;
  step: FlowStep;
  journey: FlowJourney | null;
  back: { label: string; onClick?: () => void; href?: string } | null;
  /** The page's way out (W7); a Sheet closes through its own button. Without it the page still shows the kicker. */
  exit?: FlowExit | null;
  /** True once the step changed in place (useFlowStep's `moved`): only then the step fades in. */
  enter?: boolean;
  /**
   * The flow comes back in place of a view that replaced it (the invite's
   * ready view and "Başka aday davet et"): the control the keyboard user was
   * on is gone, so the heading takes the focus once, when the flow mounts.
   */
  arrive?: boolean;
  container?: "page" | "sheet";
}) {
  const t = useMT("flow");
  // W10, 2.3: the heading takes the focus on an in-page step change only. A
  // move is the caller's `enter`, any hash change heard here (go, back and the
  // browser's buttons all fire one), or, in a Sheet, any step change (memory
  // steps never hydrate from the address). The first load, also on a later
  // step's hash, keeps the key "load" and takes no focus.
  const [heard, setHeard] = useState(false);
  useEffect(() => subscribeHash(() => setHeard(true)), []);
  const heading = useStepFocus<HTMLHeadingElement>(flowFocusKey(enter || heard || container === "sheet", step.id));
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  useKeepFocus(area, heading);
  // Read once: only the mount after a replaced view takes the focus.
  const arriving = useRef(arrive);
  useEffect(() => {
    if (!arriving.current) return;
    arriving.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [heading]);
  const label = journey && journey.current > 0 ? t("stepLabel", { n: journey.current, total: journey.steps }) : null;
  const footer = (
    <StepFooter
      placement="sticky"
      primary={step.primary}
      secondary={step.secondary ?? null}
      back={back}
      journey={journey && label ? { steps: journey.steps, current: journey.current, label } : null}
      note={step.note}
    />
  );
  // W10: the position is said once per step, politely; the heading takes the focus.
  // The region stays mounted (empty off the path), so a change of its words is announced.
  const position = (
    <p aria-live="polite" className="sr-only">
      {label ?? ""}
    </p>
  );
  if (container === "sheet") {
    return (
      <div ref={setArea} className="flex min-h-full flex-col">
        <section key={step.id} className={cn("flex-1 space-y-4 pt-2 pb-6", enter && "motion-safe:animate-[step-in_200ms_ease-out] motion-reduce:animate-[fade-in_200ms_ease-out]")}>
          <h2 ref={heading} tabIndex={-1} className="text-[20px] leading-7 font-semibold text-ink outline-none">
            {step.title}
          </h2>
          {step.lead ? <div className="text-[14px] leading-[22px] text-ink-2">{step.lead}</div> : null}
          <div>{step.body}</div>
        </section>
        {position}
        {footer}
      </div>
    );
  }
  return (
    <div ref={setArea} className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <FlowHeader kicker={kicker} exit={exit} />
      <div className="flex-1">
        <StepScreen key={step.id} layout={step.layout} width={step.layout === "single" ? 640 : 1000} title={step.title} titleRef={heading} lead={step.lead} enter={enter}>
          {step.body}
        </StepScreen>
      </div>
      {position}
      {footer}
    </div>
  );
}
