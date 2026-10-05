// kademe-owned
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { Illustration, type IllustrationName } from "./illustrations";

/**
 * G4, G10: a preparation or finish screen has two regions (title, one
 * sentence and a drawing on the left, the content on the right); a question
 * screen has one focus. Below 1024px both fall to one column. The title takes
 * focus on a step change (the caller passes useStepFocus's ref). A step change
 * fades in and rises 8px; with reduced motion only the fade stays (2.3).
 */
export function StepScreen({
  layout,
  illustration,
  illustrationSize = "hero",
  kicker,
  title,
  titleRef,
  lead,
  aside,
  children,
  width = 760,
}: {
  layout: "split" | "single";
  illustration?: IllustrationName;
  illustrationSize?: "hero" | "spot";
  kicker?: ReactNode;
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  lead?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  width?: 640 | 760 | 1000;
}) {
  // A spot drawing (160px) sits above the title, a hero drawing (400px) under the lead.
  const head = (
    <div className="min-w-0">
      {illustration && illustrationSize === "spot" ? <Illustration name={illustration} size="spot" className="mb-6" /> : null}
      {kicker ? <p className="text-[14px] leading-[22px] text-muted">{kicker}</p> : null}
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="mt-2 text-[28px] leading-9 font-semibold text-ink outline-none lg:text-[34px] lg:leading-[42px] xl:text-[40px] xl:leading-[48px]"
      >
        {title}
      </h1>
      {lead ? <div className="mt-3 text-[16px] leading-[26px] text-ink-2">{lead}</div> : null}
      {illustration && illustrationSize === "hero" ? <Illustration name={illustration} size="hero" className="mt-8" /> : null}
      {aside ? <div className="mt-6">{aside}</div> : null}
    </div>
  );
  const motion = "motion-safe:animate-[step-in_200ms_ease-out] motion-reduce:animate-[fade-in_200ms_ease-out]";
  if (layout === "single") {
    return (
      <section className={cn("mx-auto pt-10 pb-6", motion, width === 640 ? "max-w-[640px]" : width === 1000 ? "max-w-[1000px]" : "max-w-[760px]")}>
        {head}
        {children ? <div className="mt-8">{children}</div> : null}
      </section>
    );
  }
  return (
    <section className={cn("grid gap-8 pt-10 pb-6 lg:grid-cols-[minmax(0,340px)_minmax(0,520px)] lg:justify-between xl:grid-cols-[minmax(0,400px)_minmax(0,520px)]", motion)}>
      {head}
      <div className="min-w-0">{children}</div>
    </section>
  );
}
