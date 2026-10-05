"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMT } from "@/i18n/manager-client";
import { newLinkAction, type NewLinkResult } from "@/app/(manager)/hiring/openings/[id]/candidates/actions";
import { CopyField } from "@/components/hiring/invite/copy-field";

/**
 * "Yeni link üret" on one candidate's row. It cannot be undone (ruling C9),
 * so what it does is said in visible text right under the button, not in a
 * tooltip, and the button is described by it. While it runs the button waits
 * with its reason (C15). The new link opens in a dialog, shown once, with the
 * ready message; a refusal or a failure is said there in words. `started`:
 * the candidate may be inside a stage, so the help also says that their open
 * page stops while the stage's clock runs on (Task 18 fix round 1).
 */
export function NewLinkButton({ openingId, assessmentId, started = false }: { openingId: string; assessmentId: string; started?: boolean }) {
  const t = useMT("hiringCandidates");
  const ti = useMT("hiringInvite");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<NewLinkResult | null>(null);
  const id = `new-link-${assessmentId}`;
  // The link is shown once: Escape or a click outside must not drop it (as the invite Sheet); "Kapat" and the corner close it.
  const hold = (event: Event) => {
    if (result?.ok) event.preventDefault();
  };

  function create() {
    start(async () => {
      try {
        setResult(await newLinkAction(openingId, assessmentId));
      } catch {
        // A dropped connection or a server error: the calm message, never the raw one.
        setResult({ ok: false, code: "FAILED" });
      }
    });
  }

  return (
    <div className="space-y-1">
      <Button
        id={id}
        size="sm"
        disabled={pending}
        disabledReason={t("newLinkCreating")}
        aria-busy={pending || undefined}
        aria-describedby={`${id}-help`}
        onClick={create}
      >
        {pending ? t("newLinkCreating") : t("newLink")}
      </Button>
      {pending ? <DisabledReason id={`${id}-why`}>{t("newLinkCreating")}</DisabledReason> : null}
      <p id={`${id}-help`} className="max-w-[260px] text-[12px] leading-4 text-muted">
        {t("newLinkHelp")}
        {started ? ` ${t("newLinkHelpStarted")}` : null}
      </p>
      <Dialog open={result !== null} onOpenChange={(open) => (open ? null : setResult(null))}>
        <DialogContent onEscapeKeyDown={hold} onInteractOutside={hold} className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("newLink")}</DialogTitle>
            <DialogDescription className="tnum">
              {result?.ok ? t("newLinkReady", { name: result.name, date: result.expires }) : result ? t(`err${result.code}`) : ""}
            </DialogDescription>
          </DialogHeader>
          {result?.ok ? (
            <div className="space-y-4">
              <CopyField id={`${id}-url`} label={ti("linkLabel")} value={result.url} primary copyLabel={ti("copyLink")} />
              <CopyField id={`${id}-message`} label={ti("messageLabel")} value={result.message.body} multiline copyLabel={ti("copyMessage")} />
              <p className="text-[13px] text-muted">{ti("onceNote")}</p>
            </div>
          ) : null}
          <div>
            <Button variant="ghost" onClick={() => setResult(null)}>
              {t("close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
