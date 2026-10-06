// kademe-owned
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** 4.3: the one thing to do first today (K10), with the screen's one filled button. */
export function NextTaskCard({
  heading,
  solution,
  title,
  detail,
  meta,
  action,
}: {
  heading: string;
  solution: string;
  title: string;
  detail?: string | null;
  meta?: string | null;
  action: { label: string; href: string };
}) {
  return (
    <section aria-labelledby="today-next" className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="today-next" className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
          {heading}
        </h2>
        <span className="text-[13px] text-muted">{solution}</span>
      </div>
      <p className="mt-3 text-[20px] leading-7 font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-1 text-[14px] leading-[22px] text-ink-2">“{detail}”</p> : null}
      {meta ? <p className="tnum mt-1 text-[13px] text-muted">{meta}</p> : null}
      <div className="mt-4 flex justify-end">
        <Button asChild variant="primary">
          <Link id="today-next-action" href={action.href}>
            {action.label}
          </Link>
        </Button>
      </div>
    </section>
  );
}
