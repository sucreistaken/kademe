"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX, POSITION_TEAM_MAX } from "@/lib/library/positions";
import { createPositionAction } from "@/app/(manager)/library/actions";

/** HIRING-UX 5.9 "Pozisyon ekle": a name is enough; the detail page holds the rest. */
export function NewPositionForm() {
  const t = useMT("libPositions");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const reason = name.trim() ? null : t("nameRequired");
  return (
    <Card className="space-y-field p-card">
      <div className="space-y-2">
        <Label htmlFor="new-pos-name">{t("name")}</Label>
        <Input id="new-pos-name" maxLength={POSITION_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pos-team">{t("team")}</Label>
        <Input id="new-pos-team" maxLength={POSITION_TEAM_MAX} value={team} onChange={(e) => setTeam(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pos-ad">{t("jobDescription")}</Label>
        <Textarea id="new-pos-ad" rows={8} maxLength={POSITION_JOB_AD_MAX} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
        <p className="text-[13px] text-muted">{t("jobDescriptionHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          id="position-create"
          variant="primary"
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
          onClick={() =>
            start(async () => {
              setFailed(false);
              const result = await createPositionAction({ name, team, jobDescription });
              if (result && !result.ok) setFailed(true);
            })
          }
        >
          {pending ? t("creating") : t("create")}
        </Button>
        {reason ? <DisabledReason id="position-create-why">{reason}</DisabledReason> : null}
        {failed ? (
          <span role="status" className="text-[13px] text-destructive">
            {t("saveFailed")}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
