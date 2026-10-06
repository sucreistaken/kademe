// kademe-owned
import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Illustration, type IllustrationName } from "@/components/visual/illustrations";
import { cn } from "@/lib/cn";

/**
 * P4: an empty list says what it is and leads on: a drawing (decorative,
 * hidden from screen readers), a title read as a heading, one sentence, one
 * action (a text link may follow).
 */
export function EmptyState({
  illustration,
  title,
  body,
  action,
  secondary,
  className,
}: {
  illustration: IllustrationName;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border border-line bg-surface py-14", className)}>
      <Illustration name={illustration} size="spot" />
      <EmptyHeader>
        <EmptyTitle role="heading" aria-level={2} className="text-[18px] leading-7 font-semibold text-ink">
          {title}
        </EmptyTitle>
        {body ? <EmptyDescription className="text-[14px] leading-[22px] text-muted">{body}</EmptyDescription> : null}
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
