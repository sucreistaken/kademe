"use client";

import { useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CandidateColumn } from "@/components/candidate/Shell";
import { apiSend } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";

type Kind = "ACCESS" | "COPY" | "DELETE";

const OPTIONS: Array<{
  kind: Kind;
  titleKey: "accessTitle" | "copyTitle" | "deleteTitle";
  bodyKey: "accessBody" | "copyBody" | "deleteBody";
}> = [
  { kind: "ACCESS", titleKey: "accessTitle", bodyKey: "accessBody" },
  { kind: "COPY", titleKey: "copyTitle", bodyKey: "copyBody" },
  { kind: "DELETE", titleKey: "deleteTitle", bodyKey: "deleteBody" },
];

/**
 * The candidate's own copy of the data rights flow. Nothing is deleted from
 * here: the request lands in the manager's queue and a person answers it.
 */
export function RightsForm({ token }: { token: string }) {
  const t = useT("rights");
  const [kind, setKind] = useState<Kind | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!kind) return;
    setBusy(true);
    await apiSend(token, "/rights", { kind, message }).catch(() => undefined);
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <CandidateColumn width={560} padding="px-7 pt-11 pb-[52px]">
        <h1 className="text-2xl font-bold leading-[1.25] tracking-[-0.02em] text-ink">
          {t("sentTitle")}
        </h1>
        <p className="mt-2.5 text-sm leading-[1.65] text-ink/80">
          {t("sentBody")}
        </p>
      </CandidateColumn>
    );
  }

  return (
    <CandidateColumn width={560} padding="px-7 pt-11 pb-[52px]">
      <h1 className="text-2xl font-bold leading-[1.25] tracking-[-0.02em] text-ink">
        {t("title")}
      </h1>
      <p className="mt-2.5 text-sm leading-[1.65] text-ink/80">{t("body")}</p>

      <div className="mt-6 flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option.kind}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[10px] border bg-surface px-4 py-3.5",
              kind === option.kind ? "border-ink" : "border-line hover:bg-canvas",
            )}
          >
            <input
              type="radio"
              name="rights"
              checked={kind === option.kind}
              onChange={() => setKind(option.kind)}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                {t(option.titleKey)}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {t(option.bodyKey)}
              </span>
            </span>
          </label>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          rows={4}
          placeholder={t("placeholder")}
          className="w-full resize-y bg-surface px-4 py-3.5 text-sm leading-[1.6] text-ink outline-none"
        />
      </Card>

      <Button
        id="rights-send"
        variant="primary"
        size="lg"
        className="mt-5 w-full"
        disabled={!kind || busy}
        disabledReason={t("pickFirst")}
        onClick={send}
      >
        {busy ? t("sending") : t("send")}
      </Button>
      {!kind ? (
        <div className="mt-2 text-center">
          <DisabledReason id="rights-send-why">{t("pickFirst")}</DisabledReason>
        </div>
      ) : null}
    </CandidateColumn>
  );
}
