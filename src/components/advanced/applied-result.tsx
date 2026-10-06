"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CreationOutcome } from "@/db/schema/create";
import type { Locale } from "@/i18n/locale";
import { useMT } from "@/i18n/manager-client";
import type { CreateActionResult } from "@/solutions/types";
import { Waiting } from "./waiting";

/** What apply produced: notes, the links (the first one filled), and one button per follow-up draft. */
export function AppliedResult({
  draftId,
  outcome,
  locale,
  followUpAction,
}: {
  draftId: string;
  outcome: CreationOutcome;
  locale: Locale;
  followUpAction: (draftId: string, index: number) => Promise<CreateActionResult>;
}) {
  const t = useMT("advancedCreate");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [first, ...rest] = outcome.links;
  const follow = (index: number) => {
    setError(null);
    start(async () => {
      const result = await followUpAction(draftId, index);
      if (!result.ok) {
        setError(t(`error_${result.code}`));
        return;
      }
      router.push(result.href ?? `/advanced?draft=${result.draftId}`);
    });
  };

  if (pending) return <Waiting />;
  return (
    <Card className="space-y-3 p-card">
      <h2 className="text-[15px] font-semibold text-ink">{t("appliedTitle")}</h2>
      {outcome.notes.map((note) => (
        <p key={note.tr} className="text-[13.5px] text-ink-2">
          {note[locale]}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {first ? (
          <Button asChild variant="primary">
            <Link href={first.href}>{first.label[locale]}</Link>
          </Button>
        ) : null}
        {rest.map((link) => (
          <Link key={link.href} href={link.href} className="text-[14px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            {link.label[locale]}
          </Link>
        ))}
      </div>
      {outcome.followUps.length ? (
        <div className="space-y-2">
          <p className="text-[13.5px] text-ink">{t("followUps")}</p>
          <div className="flex flex-wrap gap-2">
            {outcome.followUps.map((f, i) => (
              <Button key={f.label.tr} size="sm" onClick={() => follow(i)}>
                {f.label[locale]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
