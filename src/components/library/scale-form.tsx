"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { hasText } from "@/lib/library/anchors";
import { saveScaleAction } from "@/app/(manager)/library/actions";

/** HIRING-UX 5.10 scales tab: level names, editable by owners only. */
export function ScaleForm({ levels, canEdit }: { levels: Array<{ value: number; label: I18nText }>; canEdit: boolean }) {
  const t = useMT("libScales");
  const [rows, setRows] = useState(levels);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | null>(null);
  const reason = !canEdit ? t("readOnly") : rows.some((r) => !hasText(r.label)) ? t("labelRequired") : null;
  return (
    <Card className="space-y-field p-card">
      <p className="text-[13px] text-muted">{t("sub")}</p>
      {rows.map((row) => (
        <I18nPair
          key={row.value}
          label={`${t("level")} ${row.value}`}
          value={row.label}
          disabled={!canEdit}
          onChange={(label) => setRows((rs) => rs.map((r) => (r.value === row.value ? { ...r, label } : r)))}
        />
      ))}
      <p className="text-[13px] text-muted">{t("noEvidence")}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          id="scale-save"
          variant="primary"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              const res = await saveScaleAction(rows);
              setResult(res.ok ? "saved" : "error");
            })
          }
        >
          {pending ? t("saving") : t("save")}
        </Button>
        {reason ? <DisabledReason id="scale-save-why">{reason}</DisabledReason> : null}
        {result === "saved" ? <span role="status" className="text-[13px] text-muted">{t("saved")}</span> : null}
        {result === "error" ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </Card>
  );
}
