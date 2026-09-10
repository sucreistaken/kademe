"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { evenWeightSplit } from "@/lib/scoring";
import { useMT } from "@/i18n/manager-client";
import {
  saveWeights,
  setWeightingEnabled,
  recalculateScores,
  type WeightsResult,
} from "./actions";

type Row = { id: string; name: string; percentage: number };

export function WeightsEditor({
  versionId,
  heading,
  enabled: initialEnabled,
  competencies,
}: {
  versionId: string;
  heading: string;
  enabled: boolean;
  competencies: Row[];
}) {
  const t = useMT("weights");
  const shared = useMT("shared");
  const errors = useMT("weightsErrors");
  const [rows, setRows] = useState(competencies);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [recalcNote, setRecalcNote] = useState<string | null>(null);
  const [pendingToggle, startToggle] = useTransition();
  const [state, action, saving] = useActionState<WeightsResult, FormData>(
    saveWeights,
    { status: "idle" },
  );

  const total = rows.reduce((acc, r) => acc + r.percentage, 0);
  const balanced = Math.abs(total - 100) < 0.01;
  /** Never round the total in the error text: "Total is 100, must be 100" is
   *  worse than no message at all. */
  const totalText = Number.isInteger(total) ? String(total) : total.toFixed(2);

  if (competencies.length === 0) {
    return (
      <main className="mx-auto max-w-[760px] px-6 py-8">
        <h1 className="text-[19px] font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-[13px] text-muted">{heading}</p>
        <Card className="mt-6 p-6">
          <p className="text-[13.5px]">{t("emptyTitle")}</p>
          <p className="mt-1.5 text-[13px] text-muted">{t("emptyBody")}</p>
          <div className="mt-4">
            <Button variant="secondary" size="md" asChild>
              <Link href="/compare">{shared("backToCompare")}</Link>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <h1 className="text-[19px] font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-[13px] text-muted">{heading}</p>

      <Card className="mt-6 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13.5px] font-medium">{t("weightedTitle")}</p>
            <p className="mt-1 max-w-[46ch] text-[13px] leading-relaxed text-muted">
              {t("weightedBody")}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={pendingToggle}
            disabledReason={pendingToggle ? t("applying") : undefined}
            onClick={() =>
              startToggle(async () => {
                const next = !enabled;
                const result = await setWeightingEnabled(versionId, next);
                if (result.ok) setEnabled(next);
              })
            }
          >
            {enabled ? t("turnOff") : t("turnOn")}
          </Button>
        </div>
        <p className="mt-3">
          <StatusDot tone={enabled ? "active" : "neutral"}>
            {enabled ? t("enabled") : t("disabled")}
          </StatusDot>
        </p>
      </Card>

      <form action={action} className="mt-4">
        <input type="hidden" name="versionId" value={versionId} />
        <input type="hidden" name="entries" value={JSON.stringify(
          rows.map((r) => ({ competencyId: r.id, percentage: r.percentage })),
        )} />

        <Card className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-4 px-6 py-3.5">
              <label htmlFor={`w-${row.id}`} className="flex-1 text-[13.5px]">
                {row.name}
              </label>
              <input
                id={`w-${row.id}`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={row.percentage}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.id === row.id
                        ? { ...r, percentage: Number(e.target.value) || 0 }
                        : r,
                    ),
                  )
                }
                className="h-9 w-20 rounded-[6px] border border-line bg-surface px-2.5
                           text-right text-[13.5px] tnum outline-none focus:border-muted"
              />
              <span className="w-4 text-[13px] text-muted">%</span>
            </div>
          ))}

          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-[13px] text-muted">{t("total")}</span>
            <span className="text-[14px] font-semibold tnum">
              {shared("percent", { value: totalText })}
            </span>
          </div>
        </Card>

        <div className="mt-4 flex items-center gap-3">
          {/* Stored weights can be invalid: an older set may have been written
              with rounded values that sum to 100.02. Without a one click way
              back to a valid state the manager is stuck on a form that refuses
              to save and offers no way forward. */}
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              const split = evenWeightSplit(rows.length);
              setRows((prev) =>
                prev.map((r, i) => ({ ...r, percentage: split[i] })),
              );
            }}
          >
            {t("evenSplit")}
          </Button>

          <Button
            id="save-weights"
            type="submit"
            variant="primary"
            size="md"
            disabled={!balanced || saving}
            disabledReason={
              !balanced
                ? t("mustTotal", { total: totalText })
                : saving
                  ? t("savingReason")
                  : undefined
            }
          >
            {saving ? t("saving") : t("save")}
          </Button>

          {!balanced ? (
            <DisabledReason id="save-weights-why">
              {t("mustTotal", { total: totalText })}
            </DisabledReason>
          ) : null}
        </div>

        {state.status === "error" ? (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {state.code === "NOT_100"
              ? t("mustTotal", { total: state.total })
              : errors(state.code)}
          </p>
        ) : null}
        {state.status === "saved" ? (
          <p className="mt-2 text-[13px] text-muted">{t("savedNote")}</p>
        ) : null}
      </form>

      <Card className="mt-6 p-6">
        <p className="text-[13.5px] font-medium">{t("recalcTitle")}</p>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-muted">
          {t("recalcBody")}
        </p>
        <div className="mt-4">
          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              startToggle(async () => {
                const result = await recalculateScores(versionId);
                setRecalcNote(
                  result.ok
                    ? t("recalcDone", { count: result.updated })
                    : t("recalcFailed"),
                );
              })
            }
          >
            {t("recalc")}
          </Button>
        </div>
        {recalcNote ? (
          <p className="mt-2 text-[13px] text-muted">{recalcNote}</p>
        ) : null}
      </Card>

      <p className="mt-6 text-[13px] text-muted">
        <Link href="/compare" className="underline underline-offset-2">
          {shared("backToCompare")}
        </Link>
      </p>
    </main>
  );
}
