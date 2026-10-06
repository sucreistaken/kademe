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
import { currentHash, leaveHashStep, noHash, pushHash, subscribeHash } from "@/lib/client/hash-step";
import { exitKey, flowStepOf, type FlowJourney } from "./flow-model";

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
 * "Kaydetmeden çık" while values changed). An exit to an address with a hash
 * is a plain anchor (next/link fires no hashchange, Part 2 placement rule).
 */
export function FlowHeader({ kicker, exit }: { kicker: ReactNode; exit: FlowExit }) {
  const t = useMT("flow");
  const label = t(exitKey(exit.dirty));
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2">
      <p className="min-w-0 truncate text-[14px] leading-[22px] text-muted">{kicker}</p>
      {"href" in exit ? (
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
  container = "page",
}: {
  kicker: ReactNode;
  step: FlowStep;
  journey: FlowJourney | null;
  back: { label: string; onClick?: () => void; href?: string } | null;
  /** Required on a page; a Sheet closes through its own button. */
  exit?: FlowExit | null;
  /** True once the step changed in place (useFlowStep's `moved`): only then the step fades in. */
  enter?: boolean;
  container?: "page" | "sheet";
}) {
  const t = useMT("flow");
  const heading = useStepFocus<HTMLHeadingElement>(step.id);
  const area = useRef<HTMLDivElement>(null);
  useKeepFocus(area, heading);
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
  const position = label ? (
    <p aria-live="polite" className="sr-only">
      {label}
    </p>
  ) : null;
  if (container === "sheet") {
    return (
      <div ref={area} className="flex min-h-full flex-col">
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
    <div ref={area} className="flex min-h-[calc(100dvh-8rem)] flex-col">
      {exit ? <FlowHeader kicker={kicker} exit={exit} /> : null}
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
