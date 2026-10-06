// kademe-owned
import { HashAwareLink } from "./hash-aware-link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SummaryRow = {
  id: string;
  icon?: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  /** P8: the value differs from the saved one. */
  changed?: boolean;
  /** W8: why this row stops the save, in the existing words. */
  problem?: ReactNode;
  /** "Değiştir ›": a step of this flow (onClick) or a page that changes it (href; a link with a hash is a plain anchor, so the page hears the hash change). */
  edit?: { href: string } | { onClick: () => void } | null;
};

const ACTION =
  "inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";

/**
 * W5, P8: a flow's summary and a read-only control card (the opening's rules,
 * the publish summary): one row per decision with its value, "değişti" when it
 * differs from the saved value (ink, not bold, no dot), and "Değiştir ›" to the
 * step or page that changes it. `readOnly` drops every "Değiştir" (a reviewer,
 * a closed opening). No hooks: server pages and client flows both draw it.
 */
export function SummaryRows({ rows, readOnly = false, changeLabel, changedLabel }: { rows: SummaryRow[]; readOnly?: boolean; changeLabel: string; changedLabel: string }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const Icon = row.icon;
        const edit = readOnly ? null : (row.edit ?? null);
        const words = (
          <>
            {changeLabel}
            <span className="sr-only">: {row.label}</span>
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </>
        );
        return (
          <li key={row.id} className="flex items-start gap-4 py-4">
            {Icon ? (
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-ink">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-muted">{row.label}</p>
              <p className="mt-0.5 text-[15px] leading-6 break-words text-ink">
                {row.value}
                {row.changed ? <span className="ml-2 text-[13px] font-normal text-ink">· {changedLabel}</span> : null}
              </p>
              {row.detail ? <p className="mt-0.5 text-[13px] leading-5 text-muted">{row.detail}</p> : null}
              {row.problem ? <p className="mt-1 text-[13px] leading-5 font-medium text-ink">{row.problem}</p> : null}
            </div>
            {edit === null ? null : "onClick" in edit ? (
              <button type="button" onClick={edit.onClick} className={ACTION}>
                {words}
              </button>
            ) : (
              <HashAwareLink href={edit.href} className={ACTION}>
                {words}
              </HashAwareLink>
            )}
          </li>
        );
      })}
    </ul>
  );
}
