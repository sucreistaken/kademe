// kademe-owned
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/visual/illustrations";

/**
 * 4.3 in the look of the manager mockup (screen 1): the one thing to do first
 * today (K10). A small drawing on the left, the eyebrow (what and for which
 * solution), the task in 22px, its quote and time, and the screen's one
 * filled button under the text.
 */
export function NextTaskCard({
  heading,
  solution,
  title,
  detail,
  meta,
  action,
  withDrawing = false,
}: {
  heading: string;
  solution: string;
  title: string;
  detail?: string | null;
  meta?: string | null;
  action: { label: string; href: string };
  /** The drawing is hiring's; an exam task gets the card without it. */
  withDrawing?: boolean;
}) {
  return (
    <section aria-labelledby="today-next" className="flex items-center gap-7 rounded-2xl border border-line bg-surface px-[26px] py-[22px] shadow-panel-soft">
      {withDrawing ? <Illustration name="inviteReady" size="small" className="hidden w-[220px] md:block" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          <h2 id="today-next">{heading}</h2>
          <span aria-hidden>·</span>
          <span>{solution}</span>
        </div>
        <p className="mt-1.5 text-[22px] leading-7 font-semibold text-ink">{title}</p>
        {detail ? <p className="mt-1.5 text-[14.5px] leading-[22px] text-ink-2">“{detail}”</p> : null}
        {meta ? <p className="tnum mt-0.5 text-[13px] text-muted">{meta}</p> : null}
        <Button asChild variant="primary" className="mt-4">
          <Link id="today-next-action" href={action.href}>
            {action.label}
          </Link>
        </Button>
      </div>
    </section>
  );
}
