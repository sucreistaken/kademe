"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";

/**
 * The submit button of a server-action form that must not be sent twice
 * (publish, start editing, close and reopen, the undo strip). A plain
 * server-action button gives no sign of life while the action runs (in
 * development the first call also compiles), so a second click would queue a
 * second publish or close. While the form is on its way this one says so
 * (`pendingLabel`), is disabled and aria-busy. A `reason` keeps it disabled;
 * the caller shows the reason next to it (RULES 5).
 */
export function PendingButton({
  label,
  pendingLabel,
  reason = null,
  id,
  variant = "secondary",
  size,
}: {
  label: string;
  pendingLabel: string;
  reason?: string | null;
  id?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      id={id}
      type="submit"
      variant={variant}
      size={size}
      disabled={pending || reason !== null}
      disabledReason={reason ?? undefined}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
