"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import type { CreateActionResult } from "@/solutions/types";
import { Waiting } from "./waiting";

/** Spec 4.1: one textarea, three example chips, "Taslak hazırla", and what it can build. */
export function CreateBox({
  kinds,
  initialText,
  primary,
  startAction,
}: {
  kinds: string[];
  initialText: string;
  /** False while a draft is open below: that draft's button is the page's one filled button. */
  primary: boolean;
  startAction: (text: string) => Promise<CreateActionResult>;
}) {
  const t = useMT("advancedCreate");
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const examples = [t("example1"), t("example2"), t("example3")];

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setError(null);
    start(async () => {
      const result = await startAction(value);
      if (!result.ok) {
        setError(t(`error_${result.code}`));
        return;
      }
      router.push(result.href ?? `/advanced?draft=${result.draftId}`);
    });
  };

  return (
    <Card className="space-y-3 p-card">
      <label htmlFor="create-text" className="block text-[15px] font-semibold text-ink">
        {t("boxLabel")}
      </label>
      <Textarea id="create-text" rows={3} maxLength={4000} value={text} placeholder={t("boxPlaceholder")} disabled={pending} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {examples.map((example) => (
          <Button key={example} type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setText(example)}>
            {example}
          </Button>
        ))}
      </div>
      <Button variant={primary ? "primary" : "secondary"} disabled={pending || !text.trim()} onClick={submit}>
        {t("submit")}
      </Button>
      <p className="text-[13px] text-muted">{t("canBuild", { kinds: kinds.join(", ") })}</p>
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {pending ? <Waiting /> : null}
    </Card>
  );
}
