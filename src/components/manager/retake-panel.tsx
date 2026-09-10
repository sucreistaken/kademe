"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Button, DisabledReason } from "@/components/ui/button";
import { InlineButton } from "@/components/ui/inline-link";
import { requestRetake, setPrimaryAttempt } from "@/server/retake";
import { useMT } from "@/i18n/manager-client";

export type RetakeStage = { id: string; name: string; index: number };
export type RetakeAttempt = {
  id: string;
  attemptNumber: number;
  isPrimary: boolean;
  completedAt: string | null;
};

/**
 * Asking a candidate to redo part of an assessment.
 *
 * Scope is the whole point: redoing everything because one stage went wrong
 * wastes twenty minutes of someone's evening. Leaving the selection empty means
 * the whole assessment, which is also the honest default when the manager has
 * not thought about it.
 */
export function RetakePanel({
  assessmentId,
  stages,
  attempts,
  canRequest,
  blockedReason,
}: {
  assessmentId: string;
  stages: RetakeStage[];
  attempts: RetakeAttempt[];
  canRequest: boolean;
  blockedReason?: string;
}) {
  const t = useMT("retake");
  const errors = useMT("retakeErrors");
  const common = useMT("common");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nonPrimaryComplete = attempts.filter(
    (a) => !a.isPrimary && a.completedAt,
  );

  return (
    <div className="border-t border-line pt-4">
      {/* A finished retake that nobody switched to is the trap this warns about. */}
      {nonPrimaryComplete.map((attempt) => (
        <div key={attempt.id} className="mb-3 rounded-[10px] bg-canvas px-4 py-3">
          <p className="text-[12.5px] leading-relaxed">
            {t("pendingAttempt", { number: attempt.attemptNumber })}
          </p>
          <div className="mt-2">
            <InlineButton
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await setPrimaryAttempt(attempt.id);
                  if (!result.ok) setProblem(errors(result.code));
                })
              }
            >
              {t("makePrimary", { number: attempt.attemptNumber })}
            </InlineButton>
          </div>
        </div>
      ))}

      {!open ? (
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canRequest}
            disabledReason={blockedReason}
            onClick={() => setOpen(true)}
          >
            {t("request")}
          </Button>
          {!canRequest && blockedReason ? (
            <DisabledReason>{blockedReason}</DisabledReason>
          ) : null}
          {done ? <p className="mt-2 text-[12.5px] text-muted">{done}</p> : null}
        </div>
      ) : (
        <div>
          <p className="text-[13px] font-medium">{t("whichStages")}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {t("scopeHint")}
          </p>

          <div className="mt-3 space-y-1.5">
            {stages.map((stage) => {
              const on = selected.includes(stage.id);
              return (
                <label
                  key={stage.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3 py-2",
                    on ? "border-ink/25 bg-ink/[0.04]" : "border-line",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setSelected((prev) =>
                        on
                          ? prev.filter((id) => id !== stage.id)
                          : [...prev, stage.id],
                      )
                    }
                  />
                  <span className="text-[13px]">
                    {stage.index + 1} · {stage.name}
                  </span>
                </label>
              );
            })}
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[12.5px] text-muted">
              {t("reasonLabel")}
            </span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              className="w-full resize-y rounded-[6px] border border-line bg-surface px-2.5 py-2
                         text-[12.5px] outline-none placeholder:text-muted/70 focus:border-muted"
            />
          </label>

          <p className="mt-2 text-[12.5px] text-muted">{t("linkNote")}</p>

          {problem ? (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {problem}
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              disabledReason={pending ? t("opening") : undefined}
              onClick={() =>
                start(async () => {
                  setProblem(null);
                  const result = await requestRetake({
                    assessmentId,
                    scopeStageIds: selected,
                    reason,
                  });
                  if (!result.ok) return setProblem(errors(result.code));
                  setOpen(false);
                  setSelected([]);
                  setReason("");
                  setDone(t("done", { number: result.attemptNumber }));
                })
              }
            >
              {pending
                ? t("openingEllipsis")
                : selected.length === 0
                  ? t("requestAll")
                  : t("requestSome", { count: selected.length })}
            </Button>
            <InlineButton onClick={() => setOpen(false)}>
              {common("cancel")}
            </InlineButton>
          </div>
        </div>
      )}
    </div>
  );
}
