"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMT } from "@/i18n/manager-client";
import type { CreateActionResult, ReviewActions } from "@/solutions/types";
import { Waiting } from "./waiting";

/**
 * Spec 6: the frame every kind's review shares. A summary line, the kind's
 * cards, one line to ask for a change, "Onayla" (primary) and "Vazgeç".
 * The kind's component owns its edits and hands them over through `edits`.
 */
export function ReviewFrame({
  draftId,
  summary,
  actions,
  edits,
  applyDisabled,
  applyLabel,
  children,
}: {
  draftId: string;
  summary: string;
  actions: ReviewActions;
  edits: () => unknown;
  applyDisabled?: boolean;
  applyLabel?: string;
  children: ReactNode;
}) {
  const t = useMT("advancedCreate");
  const router = useRouter();
  const [change, setChange] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"apply" | "revise" | "discard" | null>(null);
  const [pending, start] = useTransition();

  const run = (what: "apply" | "revise" | "discard", call: () => Promise<CreateActionResult>) => {
    setError(null);
    setBusy(what);
    start(async () => {
      const result = await call();
      setBusy(null);
      if (!result.ok) {
        setError(t(`error_${result.code}`));
        return;
      }
      if (what === "revise") setChange("");
      if (result.href) router.push(result.href);
      else router.refresh();
    });
  };

  return (
    <section aria-busy={pending} className="space-y-4">
      {summary ? <p className="text-[14px] text-ink">{summary}</p> : null}
      {busy === "revise" ? <Waiting /> : children}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = change.trim();
          if (text) run("revise", () => actions.revise(draftId, text));
        }}
      >
        <label className="sr-only" htmlFor="create-revise">
          {t("reviseLabel")}
        </label>
        <Input id="create-revise" value={change} maxLength={500} placeholder={t("reviseLabel")} disabled={pending} onChange={(e) => setChange(e.target.value)} />
        <Button type="submit" disabled={pending || !change.trim()}>
          {t("reviseSend")}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={pending || applyDisabled} onClick={() => run("apply", () => actions.apply(draftId, edits()))}>
          {busy === "apply" ? t("applying") : (applyLabel ?? t("apply"))}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => run("discard", () => actions.discard(draftId))}>
          {t("discard")}
        </Button>
      </div>
    </section>
  );
}
