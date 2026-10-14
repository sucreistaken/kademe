// kademe-owned
import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Illustration, type IllustrationName } from "@/components/visual/illustrations";
import { Mascot, type MascotPose } from "@/components/visual/mascot";
import { cn } from "@/lib/cn";

/**
 * P4: an empty list says what it is and leads on: a drawing (decorative,
 * hidden from screen readers), a title read as a heading, one sentence, one
 * action (a text link may follow). "page" (manager mockup 8): no card, the
 * drawing at 380px, a 24px title; the card look is unchanged. With `mascot`
 * the mascot in that pose stands in for the drawing (`rest` for "nothing
 * here", `think` for "start something"); `illustration` stays the fallback.
 */
export function EmptyState({
  illustration,
  mascot,
  title,
  body,
  action,
  secondary,
  variant = "card",
  className,
}: {
  illustration: IllustrationName;
  mascot?: MascotPose;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  variant?: "card" | "page";
  className?: string;
}) {
  const page = variant === "page";
  return (
    <Empty className={cn(page ? "mx-auto mt-[60px] max-w-[460px] border-0 bg-transparent p-0" : "rounded-2xl border-2 border-dashed border-line bg-surface py-14", className)}>
      {mascot ? (
        <Mascot pose={mascot} size={page ? "hero" : "spot"} />
      ) : (
        <Illustration name={illustration} size="spot" className={page ? "w-[380px] max-w-full" : undefined} />
      )}
      <EmptyHeader>
        <EmptyTitle role="heading" aria-level={2} className={page ? "mt-2 text-[24px] leading-8 font-extrabold text-ink" : "text-[18px] leading-7 font-extrabold text-ink"}>
          {title}
        </EmptyTitle>
        {body ? <EmptyDescription className={page ? "text-[14.5px] leading-[22px] text-ink-2" : "text-[14px] leading-[22px] text-muted"}>{body}</EmptyDescription> : null}
      </EmptyHeader>
      {action || secondary ? (
        <EmptyContent>
          {action}
          {secondary}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
