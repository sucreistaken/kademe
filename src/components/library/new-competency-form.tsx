"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { hasText } from "@/lib/library/anchors";
import { createCompetencyAction } from "@/app/(manager)/library/actions";

export function NewCompetencyForm() {
  const t = useMT("libCompetencies");
  const [name, setName] = useState<I18nText>({ tr: "", en: "" });
  const [description, setDescription] = useState<I18nText>({ tr: "", en: "" });
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const reason = hasText(name) ? null : t("nameRequired");
  return (
    <Card className="space-y-field p-card">
      <I18nPair label={t("name")} value={name} onChange={setName} />
      <I18nPair label={t("description")} multiline value={description} onChange={setDescription} />
      <div className="flex flex-wrap items-center gap-4">
        <Button
          id="competency-create"
          variant="primary"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              const result = await createCompetencyAction({ name, description });
              if (result && !result.ok) setFailed(true);
            })
          }
        >
          {pending ? t("creating") : t("create")}
        </Button>
        {reason ? <DisabledReason id="competency-create-why">{reason}</DisabledReason> : null}
        {failed ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
      </div>
    </Card>
  );
}
