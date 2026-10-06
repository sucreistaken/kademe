// kademe-owned
import type { ReactNode } from "react";
import { RowMenu, type RowMenuItem } from "./row-menu";

/**
 * P2: a page's head: kicker, title (26/32, 600), one meta line, at most one
 * filled action, everything else behind "⋯". The exam pages draw it through
 * PageHead, the hiring and library pages through PageTitle.
 */
export function PanelHeader({
  kicker,
  title,
  meta,
  primary,
  menu,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  primary?: ReactNode;
  menu?: { label: string; items: RowMenuItem[] };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <div className="mb-1 text-[13px] text-muted">{kicker}</div> : null}
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {meta ? <div className="mt-1 text-[14px] leading-[22px] text-muted">{meta}</div> : null}
      </div>
      {primary || menu ? (
        <div className="flex items-start gap-2">
          {menu ? <RowMenu label={menu.label} items={menu.items} /> : null}
          {primary ? <div className="flex flex-col items-end gap-1">{primary}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
