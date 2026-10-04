"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { hasText } from "@/lib/library/anchors";
import type { AnchorProposal } from "@/lib/library/anchor-draft";
import { draftAnchorsAction } from "@/app/(manager)/library/actions";

type State = { kind: "idle" } | { kind: "ready"; anchors: AnchorProposal } | { kind: "failed"; unconfigured: boolean } | { kind: "applied" };

/**
 * "AI ile çapa öner" (HIRING-UX 5.10): a proposal card. Copying it into the
 * fields is a click, saving is another; the AI never writes the competency.
 */
export function AnchorAssist({
  competencyId,
  name,
  description,
  onApply,
}: {
  competencyId: string;
  name: I18nText;
  description: I18nText;
  onApply: (anchors: AnchorProposal) => void;
}) {
  const t = useMT("libAnchorAi");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, start] = useTransition();
  const reason = hasText(name) ? null : t("needName");

  return (
    <div className="w-full space-y-3 md:w-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          id="anchor-ai-suggest"
          variant="outline"
          size="sm"
          disabled={pending || reason !== null}
          disabledReason={reason ?? (pending ? t("working") : undefined)}
          onClick={() =>
            start(async () => {
              const result = await draftAnchorsAction(competencyId, { name, description });
              setState(result.status === "OK" ? { kind: "ready", anchors: result.anchors } : { kind: "failed", unconfigured: result.status === "UNCONFIGURED" });
            })
          }
        >
          {t("suggest")}
        </Button>
        {reason && !pending ? <DisabledReason id="anchor-ai-suggest-why">{reason}</DisabledReason> : null}
      </div>
      {pending ? (
        <Card className="space-y-2 p-card" aria-busy>
          <p id="anchor-ai-suggest-why" className="text-[13px] text-muted">
            {t("working")}
          </p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </Card>
      ) : null}
      {!pending && state.kind === "failed" ? (
        <p role="status" className="text-[13px] text-muted">
          {state.unconfigured ? t("unconfigured") : t("failed")}
        </p>
      ) : null}
      {!pending && state.kind === "applied" ? (
        <p role="status" className="text-[13px] text-muted">
          {t("applied")}
        </p>
      ) : null}
      {!pending && state.kind === "ready" ? (
        <Card className="space-y-3 p-card" data-testid="anchor-ai-proposal">
          <p className="text-[13px] text-muted">{t("label")}</p>
          <ol className="space-y-2">
            {([1, 2, 3, 4, 5] as const).map((level) => (
              <li key={level} className="text-[14px] text-ink">
                <span className="tnum mr-2 font-semibold">{level}</span>
                {state.anchors[level].tr || "-"}
                <span className="block text-[13px] text-muted">{state.anchors[level].en}</span>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onApply(state.anchors);
                setState({ kind: "applied" });
              }}
            >
              {t("apply")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setState({ kind: "idle" })}>
              {t("dismiss")}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
