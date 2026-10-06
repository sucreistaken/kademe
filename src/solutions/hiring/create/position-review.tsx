"use client";

import { useState } from "react";
import { ReviewFrame } from "@/components/advanced/review-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/locale";
import { useMT } from "@/i18n/manager-client";
import type { ReviewActions } from "@/solutions/types";
import type { PositionAnchors, PositionDraft } from "./position";
import { weightTotal } from "./position-weights";

type Row = { key: string; weight: number; anchors: PositionAnchors };
const LEVELS = ["1", "3", "5"] as const;

/** POSITION review (spec 5.4): name, job ad (collapsed), profile rows with weights, anchors 1/3/5 of new competencies. */
export function PositionReview({ draftId, summary, draft, locale, actions }: { draftId: string; summary: string; draft: PositionDraft; locale: Locale; actions: ReviewActions }) {
  const t = useMT("createPosition");
  const [rows, setRows] = useState<Row[]>(() => draft.competencies.map((c) => ({ key: c.key, weight: c.weight, anchors: c.anchors })));
  const byKey = new Map(draft.competencies.map((c) => [c.key, c]));
  const total = weightTotal(rows.map((r) => r.weight));
  const label = (key: string) => {
    const name = byKey.get(key)?.name;
    return name ? name[locale] || name.tr : key;
  };
  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setAnchor = (key: string, level: (typeof LEVELS)[number], value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, anchors: { ...r.anchors, [level]: { ...r.anchors[level], [locale]: value } } } : r)));

  return (
    <ReviewFrame
      draftId={draftId}
      summary={summary}
      actions={actions}
      edits={() => ({ competencies: rows.map((r) => ({ key: r.key, weight: r.weight, ...(byKey.get(r.key)?.libraryId ? {} : { anchors: r.anchors }) })) })}
      applyDisabled={rows.length === 0 || total !== 100}
    >
      <Card className="space-y-4 p-card">
        <div>
          <p className="text-[13px] text-muted">{t("name")}</p>
          <p className="text-[16px] font-semibold text-ink">{draft.name}</p>
          {draft.team ? <p className="text-[13px] text-muted">{draft.team}</p> : null}
        </div>
        <p className="text-[13px] text-muted">{draft.source === "TEMPLATE" ? t("fromTemplate") : t("fromAi")}</p>
        <details>
          <summary className="cursor-pointer text-[13.5px] text-ink">{t("jobAd")}</summary>
          <p className="mt-2 whitespace-pre-line text-[13.5px] text-ink-2">{draft.jobAd}</p>
        </details>
        <h3 className="text-[14px] font-semibold text-ink">{t("profile")}</h3>
        <ul className="space-y-3">
          {rows.map((r) => {
            const isNew = !byKey.get(r.key)?.libraryId;
            return (
              <li key={r.key} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-[14px] font-medium text-ink">{label(r.key)}</span>
                  <span className="text-[12px] text-muted">{isNew ? t("isNew") : t("inLibrary")}</span>
                  <Input
                    aria-label={t("weightFor", { name: label(r.key) })}
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    value={r.weight}
                    onChange={(e) => setRow(r.key, { weight: Math.max(0, Math.min(100, Math.round(Number(e.target.value)) || 0)) })}
                  />
                  <span className="text-[13px] text-muted">%</span>
                  <Button size="sm" variant="ghost" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                    {t("remove")}
                  </Button>
                </div>
                {isNew ? (
                  <div className="mt-3 space-y-2">
                    {LEVELS.map((level) => (
                      <div key={level} className="space-y-1">
                        <label htmlFor={`anchor-${r.key}-${level}`} className="text-[12.5px] text-muted">
                          {t(`anchor${level}`)}
                        </label>
                        <Textarea id={`anchor-${r.key}-${level}`} rows={2} value={r.anchors[level][locale]} onChange={(e) => setAnchor(r.key, level, e.target.value)} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className={total === 100 ? "text-[13.5px] text-muted" : "text-[13.5px] font-medium text-danger"}>{t("total", { total })}</p>
      </Card>
    </ReviewFrame>
  );
}
