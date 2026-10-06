// kademe-owned
import { HashAwareLink } from "./hash-aware-link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "@/components/visual/icon-tile";

export type ControlAttention = { key: string; icon: LucideIcon; text: ReactNode; note?: ReactNode };

const ACTION =
  "inline-flex min-h-11 items-center gap-0.5 justify-self-start whitespace-nowrap text-[14px] font-semibold text-accent transition-colors duration-[120ms] ease-out hover:underline lg:justify-self-end";

/**
 * KG1 (K12) in the look of the manager mockup (screen 2): one object, one row,
 * one next step. The role's tile; the name (it opens the object), status as
 * dot and words and one meta line (team, last day); progress (a setup count
 * with segments, or the funnel line); what needs attention as quiet pills,
 * only when something does (no amber: globals.css); and one accent text
 * action at the right ("Sıradaki: Ekibi ata ›"). No filled button on a row:
 * the page's one filled button is its own work (KG5). Columns line up from
 * 1024px; below it the row stacks.
 */
export function ControlRow({
  icon,
  title,
  href,
  status,
  meta,
  progress,
  attention = [],
  next,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  href: string;
  status: ReactNode;
  meta?: ReactNode;
  progress?: ReactNode;
  attention?: ControlAttention[];
  next: { label: ReactNode; href: string } | null;
}) {
  return (
    <li className="grid items-center gap-x-[18px] gap-y-2 px-5 py-4 lg:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_auto]">
      {icon ? <IconTile icon={icon} className="hidden lg:grid" /> : <span className="hidden lg:block" />}
      <div className="min-w-0">
        <HashAwareLink href={href} className="text-[15px] leading-6 font-semibold text-ink hover:underline">
          {title}
        </HashAwareLink>
        <div className="mt-0.5 text-[13px] leading-5">{status}</div>
        {meta ? <div className="tnum mt-0.5 text-[13px] leading-5 text-muted">{meta}</div> : null}
      </div>
      <div className="min-w-0 text-[13px] leading-5 text-ink-2">{progress}</div>
      {/* KG4: the attention column says something only when something needs it (an empty list would still be announced). */}
      {attention.length ? (
        <ul className="min-w-0 space-y-1.5">
          {attention.map(({ key, icon: Icon, text, note }) => (
            <li key={key} className="text-[13px] leading-5 text-ink">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1">
                <Icon className="size-[15px] shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                {text}
              </span>
              {note ? <span className="mt-1 block text-muted">{note}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="hidden lg:block" />
      )}
      {next ? (
        <HashAwareLink href={next.href} className={ACTION}>
          {next.label}
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </HashAwareLink>
      ) : (
        <span className="hidden lg:block" />
      )}
    </li>
  );
}
