"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";

/** What an editor needs from the builder for one stage or question. */
export type EditorBinding = {
  editable: boolean;
  /** A typed value: saved after a short pause (debounced, last value wins). */
  onEdit: (field: string, value: unknown) => void;
  /** Leaving a field: send what is waiting now. */
  onFlush: () => void;
  /** The sentence for a refused field of this item, or null. */
  errorFor: (field: string) => string | null;
};

/** Props for an input that may carry a refusal message (aria-invalid + aria-describedby). */
export function invalidProps(id: string, error: string | null) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}

export function FieldError({ id, error, tone = "light" }: { id: string; error: string | null; tone?: "light" | "vault" }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className={cn("text-[13px] leading-5", tone === "vault" ? "font-medium text-vault-text" : "text-destructive")}>
      {error}
    </p>
  );
}

/**
 * Up and down moves with their labels (carry 8: no drag-only reorder). At an
 * edge the button stays focusable but does nothing and says why next to it,
 * so focus never drops to the page after a move.
 */
export function ItemActions({
  index,
  count,
  onMove,
  onDelete,
  deleteLabel,
  idPrefix,
}: {
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  deleteLabel: string;
  idPrefix: string;
}) {
  const t = useMT("hiringBuilder");
  const atTop = index <= 0;
  const atBottom = index >= count - 1;
  const movable = count > 1;
  const edge = !movable ? null : atTop ? t("atTop") : atBottom ? t("atBottom") : null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
      {movable ? (
        <>
          <Button
            id={`${idPrefix}-up`}
            variant="ghost"
            size="sm"
            aria-disabled={atTop || undefined}
            aria-describedby={atTop && edge ? `${idPrefix}-edge` : undefined}
            className={cn(atTop && "cursor-not-allowed text-line hover:bg-transparent hover:text-line")}
            onClick={() => (atTop ? undefined : onMove(-1))}
          >
            <ArrowUp className="size-4" strokeWidth={1.5} aria-hidden />
            {t("moveUp")}
          </Button>
          <Button
            id={`${idPrefix}-down`}
            variant="ghost"
            size="sm"
            aria-disabled={atBottom || undefined}
            aria-describedby={atBottom && edge ? `${idPrefix}-edge` : undefined}
            className={cn(atBottom && "cursor-not-allowed text-line hover:bg-transparent hover:text-line")}
            onClick={() => (atBottom ? undefined : onMove(1))}
          >
            <ArrowDown className="size-4" strokeWidth={1.5} aria-hidden />
            {t("moveDown")}
          </Button>
          {edge ? (
            <span id={`${idPrefix}-edge`} className="text-[13px] text-muted">
              {edge}
            </span>
          ) : null}
        </>
      ) : null}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onDelete}>
        <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
        {deleteLabel}
      </Button>
    </div>
  );
}

/** Small uppercase heading of a column ("Adayın gördüğü", "Sadece ekip görür"). */
export function ColumnHeading({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "vault" }) {
  return <h2 className={cn("text-[12px] font-medium tracking-[0.06em] uppercase", tone === "vault" ? "text-vault-label" : "text-muted")}>{children}</h2>;
}
