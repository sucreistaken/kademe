"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * A form's submit button that says the server is working and takes no second
 * click meanwhile (like PublishButton). A plain server-action button gives no
 * sign of life while the action runs (in development the first call also
 * compiles), so a second click would queue a second close or reopen.
 */
export function PendingSubmitButton({ label, pendingLabel, variant = "secondary" }: { label: string; pendingLabel: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending || undefined}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
