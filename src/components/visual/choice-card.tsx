// kademe-owned
"use client";

import { Check, type LucideIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { nextChoiceIndex } from "./choice-keys";
import { IconTile } from "./icon-tile";

export type ChoiceItem = {
  value: string;
  label: ReactNode;
  marker?: string | LucideIcon;
  shortcut?: string | null;
  description?: ReactNode;
  disabled?: boolean;
  /** Panel looks only: a card that adds something new (a new position), drawn dashed. */
  tone?: "new";
};

/**
 * G6: a choice is a card you click; the chosen card is the active state
 * (accent edge, brand-soft ground). Native radios or checkboxes inside, so
 * Space, Tab and a screen reader work as everywhere: radios move and choose
 * with the arrow keys by themselves, and checkbox cards move the focus with
 * the arrow keys, Home and End here (nextChoiceIndex), never the choice. The
 * keys 1-9 are the caller's shortcut, shown here only as a hint; a caller that
 * passes `shortcut` listens with useChoiceShortcuts (one shared hook, Task 4
 * carry 7). The group itself listens to nothing outside itself, so typing in
 * a field is never caught. A closed card is dashed and offers no key; the
 * reason it is closed is the caller's, linked through `describedBy`.
 */
/**
 * Manager mockup 3, 4, 6: the panel's choice card. Big and soft: the icon tile
 * (or the person's initials) on the left, the title and one line, and the
 * radio or checkbox mark at the right, drawn from the native input before it
 * (peer). The chosen card has the accent edge, the accent-soft ground and a
 * soft ring; on "panel-lg" its tile turns white. The keyboard and the reader
 * work as on the default card (the same native input). No key hint here.
 */
function PanelChoice({
  item,
  type,
  name,
  checked,
  off,
  large,
  onToggle,
}: {
  item: ChoiceItem;
  type: "single" | "multi";
  name: string;
  checked: boolean;
  off: boolean;
  large: boolean;
  onToggle(): void;
}) {
  const Marker = typeof item.marker === "string" || !item.marker ? null : item.marker;
  return (
    <label
      className={cn(
        "group/choice relative flex cursor-pointer gap-4 border-[1.5px] text-ink transition-colors duration-[120ms] ease-out motion-reduce:transition-none",
        large ? "items-start rounded-2xl px-[22px] py-5" : "min-h-14 items-center rounded-[14px] px-[18px] py-4",
        item.tone === "new" ? "border-dashed border-line bg-transparent" : "border-line bg-surface hover:bg-canvas",
        "has-[:checked]:border-solid has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:shadow-[0_0_0_3px_rgb(14_106_87/0.08)]",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-dashed has-[:disabled]:text-muted has-[:disabled]:hover:bg-surface",
      )}
    >
      <input type={type === "single" ? "radio" : "checkbox"} name={name} value={item.value} checked={checked} disabled={off} onChange={onToggle} className="peer sr-only" />
      {typeof item.marker === "string" ? (
        <span
          aria-hidden
          className={cn(
            "tnum grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent group-has-[:checked]/choice:bg-surface",
            large ? "size-[52px] text-[15px]" : "size-10 text-[13px]",
          )}
        >
          {item.marker}
        </span>
      ) : Marker ? (
        <IconTile icon={Marker} size={large ? "lg" : "md"} tone={item.tone === "new" ? "dashed" : "soft"} className={large ? "group-has-[:checked]/choice:bg-surface" : undefined} />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block font-semibold", large ? "text-[16px] leading-6" : "text-[15px] leading-[22px]")}>{item.label}</span>
        {item.description ? (
          <span className={cn("mt-0.5 block", large ? "text-[14px] leading-5 text-ink-2" : "text-[13px] leading-5 text-muted")}>{item.description}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center border-[1.5px] border-line-mute text-transparent peer-disabled:border-dashed",
          large && "mt-1",
          type === "single" ? "size-5 rounded-full peer-checked:border-[6px] peer-checked:border-accent" : "size-[22px] rounded-md peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white",
        )}
      >
        {type === "multi" ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
      </span>
    </label>
  );
}

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
  look = "default",
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
  /** "panel" and "panel-lg": the manager's cards (mockup 3, 4, 6); the default is the candidate side's card, unchanged. */
  look?: "default" | "panel" | "panel-lg";
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
      className={cn(look === "default" ? "grid gap-2" : "grid gap-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", columns === 5 && "grid-cols-5")}
    >
      {items.map((item) => {
        if (look !== "default") {
          return (
            <PanelChoice
              key={item.value}
              item={item}
              type={type}
              name={name}
              checked={value.includes(item.value)}
              off={disabled || Boolean(item.disabled)}
              large={look === "panel-lg"}
              onToggle={() => toggle(item.value)}
            />
          );
        }
        const Marker = typeof item.marker === "string" || !item.marker ? null : item.marker;
        const off = disabled || item.disabled;
        return (
          <label
            key={item.value}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface text-[16px] leading-6 text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas motion-reduce:transition-none",
              "has-[:checked]:border-accent has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              // Task 4 carry 9: a closed card says so by its dashed edge too, not by its grey alone; a chosen one stays chosen.
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-dashed has-[:disabled]:text-muted has-[:disabled]:hover:bg-surface",
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
            {/* A closed card offers no key: the shortcut does nothing then (useChoiceShortcuts listens only while the group is open). */}
            {item.shortcut && !off ? (
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
