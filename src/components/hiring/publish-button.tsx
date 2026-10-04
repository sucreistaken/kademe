"use client";

import { useFormStatus } from "react-dom";
import { Button, DisabledReason } from "@/components/ui/button";

/**
 * "Yayınla" inside the publish form. While the server publishes, the button
 * says so and is disabled, so a second click cannot queue a second publish
 * (which would land on "no draft" and hide the success notice). A gate reason
 * keeps it disabled with the reason next to it (RULES 5).
 */
export function PublishButton({ id, label, pendingLabel, reason, note }: { id: string; label: string; pendingLabel: string; reason: string | null; note: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <Button id={id} type="submit" variant="primary" disabled={pending || reason !== null} disabledReason={reason ?? undefined} aria-busy={pending || undefined}>
        {pending ? pendingLabel : label}
      </Button>
      {reason ? <DisabledReason id={`${id}-why`}>{reason}</DisabledReason> : <p className="text-[12px] leading-4 text-muted">{note}</p>}
    </>
  );
}
