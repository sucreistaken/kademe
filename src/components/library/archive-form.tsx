import { Button } from "@/components/ui/button";

/** Archive or restore a library row from its detail page (HIRING-UX 4.2 rule 3: archive, never delete). */
export function ArchiveForm({
  id,
  archived,
  archiveAction,
  restoreAction,
  archiveLabel,
  restoreLabel,
  hint,
}: {
  id: string;
  archived: boolean;
  archiveAction: (formData: FormData) => Promise<void>;
  restoreAction: (formData: FormData) => Promise<void>;
  archiveLabel: string;
  restoreLabel: string;
  /** Shown under the archive button only. */
  hint?: string;
}) {
  return (
    <form action={archived ? restoreAction : archiveAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" size="sm">
        {archived ? restoreLabel : archiveLabel}
      </Button>
      {hint && !archived ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </form>
  );
}
