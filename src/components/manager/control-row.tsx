// kademe-owned
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ControlAttention = { key: string; icon: LucideIcon; text: ReactNode; note?: ReactNode };

const ACTION =
  "inline-flex min-h-11 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";

/** A link to another page is a Next link; one with a hash is a plain anchor, so the flow on that page hears the hash (W3). */
function ToLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return href.includes("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * KG1 (K12): one object, one row, one next step. The name opens the object;
 * status as dot and words; progress (a setup count or a small funnel); what
 * needs attention, only when something does; the facts (team, last day); and
 * one text action on the right ("Sıradaki: Ekibi ata ›"). No filled button on
 * a row: the page's one filled button is its own work (KG5). Columns line up
 * from 1024px; below it the row stacks.
 */
export function ControlRow({
  title,
  href,
  status,
  progress,
  attention = [],
  facts,
  next,
}: {
  title: ReactNode;
  href: string;
  status: ReactNode;
  progress?: ReactNode;
  attention?: ControlAttention[];
  facts?: ReactNode;
  next: { label: ReactNode; href: string } | null;
}) {
  return (
    <li className="grid gap-x-6 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
      <div className="min-w-0">
        <ToLink href={href} className="text-[15px] leading-6 font-semibold text-ink hover:underline">
          {title}
        </ToLink>
        <div className="mt-1 text-[13px] leading-5">{status}</div>
      </div>
      <div className="min-w-0 text-[13px] leading-5 text-ink-2">{progress}</div>
      {/* KG4: the attention column says something only when something needs it (an empty list would still be announced). */}
      {attention.length ? (
        <ul className="min-w-0 space-y-1">
          {attention.map(({ key, icon: Icon, text, note }) => (
            <li key={key} className="flex gap-2 text-[13px] leading-5 text-ink">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                {text}
                {note ? <span className="block text-muted">{note}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="hidden lg:block" />
      )}
      <div className="tnum min-w-0 text-[13px] leading-5 text-muted lg:text-right">{facts}</div>
      {next ? (
        <div className="flex justify-end lg:col-span-4">
          <ToLink href={next.href} className={ACTION}>
            {next.label}
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </ToLink>
        </div>
      ) : null}
    </li>
  );
}
