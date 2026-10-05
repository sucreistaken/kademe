// kademe-owned
"use client";

import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { nextChoiceIndex } from "./choice-keys";

export type ChoiceItem = { value: string; label: ReactNode; marker?: string | LucideIcon; shortcut?: string | null; description?: ReactNode; disabled?: boolean };

/**
 * G6: a choice is a card you click; the chosen card is the active state
 * (accent edge, brand-soft ground). Native radios or checkboxes inside, so
 * Space, Tab and a screen reader work as everywhere: radios move and choose
 * with the arrow keys by themselves, and checkbox cards move the focus with
 * the arrow keys, Home and End here (nextChoiceIndex), never the choice. The
 * keys 1-9 are the caller's shortcut, shown here only as a hint; the group
 * listens to nothing outside itself, so typing in a field is never caught.
 */
export function ChoiceCardGroup({
  type,
  name,
  value,
  onChange,
  items,
  size = "md",
  columns = 1,
  labelledBy,
  describedBy,
  disabled = false,
}: {
  type: "single" | "multi";
  name: string;
  value: string[];
  onChange(next: string[]): void;
  items: ChoiceItem[];
  size?: "md" | "square";
  columns?: 1 | 2 | 3 | 5;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  const toggle = (v: string) => onChange(type === "single" ? [v] : value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (type !== "multi" || event.altKey || event.ctrlKey || event.metaKey) return;
    const boxes = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const from = boxes.indexOf(event.target as HTMLInputElement);
    if (from < 0) return;
    const to = nextChoiceIndex({ key: event.key, from, enabled: boxes.map((box) => !box.disabled) });
    if (to === null) return;
    event.preventDefault();
    boxes[to].focus();
  };
  return (
    <div
      role={type === "single" ? "radiogroup" : "group"}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={type === "multi" ? onKeyDown : undefined}
      className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", columns === 5 && "grid-cols-5")}
    >
      {items.map((item) => {
        const Marker = typeof item.marker === "string" || !item.marker ? null : item.marker;
        const off = disabled || item.disabled;
        return (
          <label
            key={item.value}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface text-[16px] leading-6 text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas motion-reduce:transition-none",
              "has-[:checked]:border-accent has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted has-[:disabled]:hover:bg-surface",
              size === "square" ? "min-h-16 justify-center px-2 font-semibold" : "min-h-14 px-4 py-3",
            )}
          >
            <input
              type={type === "single" ? "radio" : "checkbox"}
              name={name}
              value={item.value}
              checked={value.includes(item.value)}
              disabled={off}
              onChange={() => toggle(item.value)}
              className="peer sr-only"
            />
            {typeof item.marker === "string" ? (
              <span aria-hidden className="tnum grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-[14px] font-medium text-ink peer-checked:border-accent">
                {item.marker}
              </span>
            ) : Marker ? (
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-ink">
                <Marker className="size-5" strokeWidth={1.75} />
              </span>
            ) : null}
            <span className={cn("min-w-0", size === "md" && "flex-1")}>
              <span className="block">{item.label}</span>
              {item.description ? <span className="mt-0.5 block text-[14px] leading-[22px] text-muted">{item.description}</span> : null}
            </span>
            {item.shortcut ? (
              <kbd aria-hidden className="tnum ml-auto hidden rounded-md border border-line bg-paper px-1.5 text-[13px] text-muted lg:inline">
                {item.shortcut}
              </kbd>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
