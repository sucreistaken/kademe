"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { ANCHOR_LEVELS, hasText } from "@/lib/library/anchors";
import { fillEmptyAnchors, replaceAnchorLevel, type AnchorLevel, type AnchorProposal } from "@/lib/library/anchor-draft";
import { draftAnchorsAction } from "@/app/(manager)/library/actions";

type Failure = "FAILED" | "UNCONFIGURED" | "RATE_LIMITED";
type State =
  | { kind: "idle" }
  | { kind: "ready"; anchors: AnchorProposal }
  | { kind: "failed"; reason: Failure }
  | { kind: "applied"; anchors: AnchorProposal; filled: number; kept: AnchorLevel[] };

const FAILURE_KEY = { FAILED: "failed", UNCONFIGURED: "unconfigured", RATE_LIMITED: "rateLimited" } as const;

function Pair({ text }: { text: I18nText }) {
  return (
    <>
      {text.tr || "-"}
      <span className="block text-[13px] text-muted">{text.en}</span>
    </>
  );
}

/**
 * "AI ile çapa öner" (HIRING-UX 5.10): a proposal card. Copying it fills only
 * empty levels; a level the person already wrote stays, and the card keeps
 * offering the proposal for it with a per-level "Bununla değiştir". Saving is
 * still the form's own "Kaydet"; the AI never writes the competency.
 */
export function AnchorAssist({
  competencyId,
  name,
  description,
  anchors,
  onAnchorsChange,
}: {
  competencyId: string;
  name: I18nText;
  description: I18nText;
  /** The form's current anchors, so kept levels show what is there now. */
  anchors: Record<number, I18nText>;
  onAnchorsChange: (next: Record<number, I18nText>) => void;
}) {
  const t = useMT("libAnchorAi");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, start] = useTransition();
  const reason = hasText(name) ? null : t("needName");

  function apply(proposal: AnchorProposal) {
    const result = fillEmptyAnchors(anchors, proposal);
    onAnchorsChange(result.anchors);
    setState({ kind: "applied", anchors: proposal, filled: result.filled.length, kept: result.kept });
  }

  function replace(proposal: AnchorProposal, kept: AnchorLevel[], filled: number, level: AnchorLevel) {
    onAnchorsChange(replaceAnchorLevel(anchors, proposal, level));
    setState({ kind: "applied", anchors: proposal, filled, kept: kept.filter((l) => l !== level) });
  }

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
              setState(result.status === "OK" ? { kind: "ready", anchors: result.anchors } : { kind: "failed", reason: result.status });
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
          {t(FAILURE_KEY[state.reason])}
        </p>
      ) : null}
      {!pending && state.kind === "applied" && state.filled > 0 ? (
        <p role="status" className="text-[13px] text-muted">
          {t("applied")}
        </p>
      ) : null}
      {!pending && state.kind === "applied" && state.kept.length > 0 ? (
        <Card className="space-y-3 p-card" data-testid="anchor-ai-kept">
          <p className="text-[13px] text-muted">{t("label")}</p>
          <p className="text-[13px] text-ink">{t("keptNote")}</p>
          <ul className="space-y-4">
            {state.kept.map((level) => (
              <li key={level} className="space-y-2 text-[14px] text-ink" data-level={level}>
                <p className="font-semibold">{t("level", { level })}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[13px] text-muted">{t("current")}</p>
                    <Pair text={anchors[level] ?? { tr: "", en: "" }} />
                  </div>
                  <div>
                    <p className="text-[13px] text-muted">{t("suggestion")}</p>
                    <Pair text={state.anchors[level]} />
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => replace(state.anchors, state.kept, state.filled, level)}>
                  {t("replace")}
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => setState({ kind: "idle" })}>
            {t("dismiss")}
          </Button>
        </Card>
      ) : null}
      {!pending && state.kind === "ready" ? (
        <Card className="space-y-3 p-card" data-testid="anchor-ai-proposal">
          <p className="text-[13px] text-muted">{t("label")}</p>
          <ol className="space-y-2">
            {ANCHOR_LEVELS.map((level) => (
              <li key={level} className="text-[14px] text-ink">
                <span className="tnum mr-2 font-semibold">{level}</span>
                <Pair text={state.anchors[level]} />
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => apply(state.anchors)}>
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
