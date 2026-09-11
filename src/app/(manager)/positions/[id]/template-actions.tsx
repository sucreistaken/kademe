"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  archiveTemplate,
  createDraftFrom,
  renameTemplate,
  restoreTemplate,
} from "@/app/(manager)/positions/actions";
import { useMT } from "@/i18n/manager-client";

/**
 * A link, not an action. Creating the template is now the second half of a
 * decision the manager has not made yet: by hand, or from the job ad. That
 * decision lives on its own screen, which is also where the AI builder is
 * reachable from.
 */
export function NewTemplateButton({
  positionId,
  label,
  variant = "primary",
}: {
  positionId: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const t = useMT("positionDetail");

  return (
    <Button variant={variant} size="md" asChild>
      <Link href={`/positions/${positionId}/templates/new`}>
        {label ?? t("createTemplate")}
      </Link>
    </Button>
  );
}

export function TemplateActions({
  positionId,
  templateId,
  versionId,
  status,
  stageCount,
  mayWrite,
}: {
  positionId: string;
  templateId: string;
  versionId: string;
  status: string;
  stageCount: number;
  mayWrite: boolean;
}) {
  const t = useMT("positionDetail");
  const shared = useMT("shared");
  const router = useRouter();
  const [pending, start] = useTransition();
  const base = `/positions/${positionId}/templates/${templateId}/versions/${versionId}`;
  // An empty version has nothing to preview and nothing to weigh. Offering
  // either is a dead end, and it buries the one action that matters.
  const empty = stageCount === 0;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {!empty ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${base}/preview`}>{t("preview")}</Link>
        </Button>
      ) : null}

      {status === "DRAFT" && mayWrite ? (
        <>
          {/* Only on a draft. A published version is frozen, and offering the
              AI there would make silently forking a new draft the normal path
              rather than the accident it is. "Yeni taslak aç" is the door, and
              the AI link appears on the draft that produces. */}
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${base}/ai`}>{t("aiSuggest")}</Link>
          </Button>
          <Button variant={empty ? "primary" : "secondary"} size="sm" asChild>
            <Link href={`${base}/builder`}>{empty ? t("fillIt") : shared("edit")}</Link>
          </Button>
        </>
      ) : status !== "DRAFT" && mayWrite ? (
        // A published version cannot be edited, so "edit" means branching a new
        // draft from it. Saying that out loud beats a disabled button.
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          disabledReason={pending ? t("openingDraft") : undefined}
          onClick={() =>
            start(async () => {
              const result = await createDraftFrom(versionId);
              if (result.ok) {
                router.push(
                  `/positions/${positionId}/templates/${templateId}/versions/${result.versionId}/builder`,
                );
              }
            })
          }
        >
          {pending ? t("opening") : t("newDraft")}
        </Button>
      ) : null}

      {/* The weights screen is requireUser("template:write"), like the builder. */}
      {!empty && mayWrite ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${base}/weights`}>{t("weights")}</Link>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The template's own row: its name, and the two things a manager can do to it.
 *
 * The name is a text input that looks like text until it is focused, so there
 * is no separate edit mode to discover and no pencil icon to decode. It saves
 * on blur and on Enter, which is the same autosave contract the builder uses.
 */
export function TemplateHeader({
  templateId,
  name,
  archived,
  mayWrite,
}: {
  templateId: string;
  name: string;
  archived: boolean;
  mayWrite: boolean;
}) {
  const t = useMT("positionDetail");

  if (!mayWrite) {
    return (
      <p className="text-[14px] font-medium">
        {name}
        {archived ? (
          <span className="ml-2 text-[13px] font-normal text-muted">
            {t("archived")}
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <form action={renameTemplate} className="min-w-0 flex-1">
        <input type="hidden" name="templateId" value={templateId} />
        <label htmlFor={`name-${templateId}`} className="sr-only">
          {t("renameLabel")}
        </label>
        <input
          id={`name-${templateId}`}
          name="name"
          defaultValue={name}
          maxLength={160}
          placeholder={t("renamePlaceholder")}
          aria-label={t("renameLabel")}
          onBlur={(event) => event.currentTarget.form?.requestSubmit()}
          className="w-full max-w-[46ch] rounded-[8px] border border-transparent
                     bg-transparent px-2 py-1 text-[14px] font-medium
                     hover:border-line focus:border-line-strong focus:bg-surface
                     focus:outline-none"
        />
      </form>

      {archived ? (
        <span className="text-[13px] text-muted">{t("archived")}</span>
      ) : null}

      <form action={archived ? restoreTemplate : archiveTemplate}>
        <input type="hidden" name="templateId" value={templateId} />
        <input type="hidden" name="name" value={name} />
        <Button type="submit" variant="ghost" size="sm">
          {archived ? t("restore") : t("archive")}
        </Button>
      </form>
    </div>
  );
}
