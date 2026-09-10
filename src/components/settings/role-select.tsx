"use client";

import { useRef } from "react";

/**
 * Changing a role submits on change, with no separate confirm button.
 *
 * Same reasoning as the filter bar: an "apply" button per row would put a dozen
 * controls on the screen competing with its one filled button. The change is
 * immediately reversible from the undo strip, which is what this product uses
 * instead of an "are you sure?" dialog.
 *
 * The labels arrive as props rather than through `useMT`. `useMT` is typed
 * against the direct children of a top-level namespace, and every string this
 * control needs lives one level deeper (`settings.roles.OWNER`), so the server
 * component that already holds a translator passes them down. Same dictionary,
 * one less copy of it in the client bundle.
 */
export function RoleSelect({
  userId,
  value,
  label,
  options,
  action,
}: {
  userId: string;
  value: string;
  /** Accessible name of the select, naming the person it belongs to. */
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={value}
        aria-label={label}
        onChange={() => form.current?.requestSubmit()}
        className="h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}
