"use client";

import { useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CandidateColumn } from "@/components/candidate/Shell";
import { apiSend } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/candidate-client";
import { rightsSentBody, type NoReply } from "./request-wording";
import { sendRightsRequest, type RightsSendResult } from "./rights-send";

export type RightsKind = "ACCESS" | "COPY" | "DELETE" | "ACCOMMODATION";

const OPTIONS: Record<
  RightsKind,
  {
    titleKey: "accessTitle" | "copyTitle" | "deleteTitle" | "accommodationTitle";
    bodyKey: "accessBody" | "copyBody" | "deleteBody" | "accommodationBody";
  }
> = {
  ACCOMMODATION: { titleKey: "accommodationTitle", bodyKey: "accommodationBody" },
  ACCESS: { titleKey: "accessTitle", bodyKey: "accessBody" },
  COPY: { titleKey: "copyTitle", bodyKey: "copyBody" },
  DELETE: { titleKey: "deleteTitle", bodyKey: "deleteBody" },
};

/**
 * The candidate's own copy of the data rights flow, plus an accommodation
 * request where the solution reads them (`kinds`, listed in this order).
 * Nothing is deleted from here: the request lands in the team's queue and a
 * person answers it. The confirmation shows only when the server took the
 * request; a failure says so under the button, keeps what was written, and
 * the button tries again.
 */
export function RightsForm({
  token,
  kinds = ["ACCESS", "COPY", "DELETE"],
  initialKind = null,
  noReply,
}: {
  token: string;
  kinds?: RightsKind[];
  initialKind?: RightsKind | null;
  /**
   * A solution that promises no reply (hiring): the confirmation says the
   * request was saved and names `email` for an urgent case. Omitted: the
   * core's (the exam's) wording.
   */
  noReply?: NoReply;
}) {
  const t = useT("rights");
  const th = useT("hiringRequest");
  const [kind, setKind] = useState<RightsKind | null>(initialKind);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<RightsSendResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!kind) return;
    setBusy(true);
    setResult(await sendRightsRequest(() => apiSend(token, "/rights", { kind, message })));
    setBusy(false);
  }

  const failed = result?.status === "failed" ? result : null;

  if (result?.status === "sent") {
    return (
      <CandidateColumn width={560} padding="px-7 pt-11 pb-[52px]">
        <h1 className="text-2xl font-bold leading-[1.25] tracking-[-0.02em] text-ink">
          {t("sentTitle")}
        </h1>
        <p className="mt-2.5 text-sm leading-[1.65] text-ink/80">
          {(() => {
            const body = rightsSentBody(noReply);
            if (body.namespace === "rights") return t(body.key);
            if ("email" in body)
              return th.rich(body.key, {
                email: body.email,
                mail: (chunks) => (
                  <a href={`mailto:${body.email}`} className="text-ink underline decoration-line-strong underline-offset-2">
                    {chunks}
                  </a>
                ),
              });
            return th(body.key);
          })()}
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
        {kinds.map((kindOption) => {
          const option = OPTIONS[kindOption];
          return (
            <label
              key={kindOption}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[10px] border bg-surface px-4 py-3.5",
                kind === kindOption ? "border-ink" : "border-line hover:bg-canvas",
              )}
            >
              <input
                type="radio"
                name="rights"
                checked={kind === kindOption}
                onChange={() => setKind(kindOption)}
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
          );
        })}
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
        {busy ? t("sending") : failed ? t("retry") : t("send")}
      </Button>
      {failed && !busy ? (
        <p role="alert" className="mt-2 text-center text-sm leading-[1.6] text-ink">
          {failed.reason ?? t("failed")}
        </p>
      ) : null}
      {!kind ? (
        <div className="mt-2 text-center">
          <DisabledReason id="rights-send-why">{t("pickFirst")}</DisabledReason>
        </div>
      ) : null}
    </CandidateColumn>
  );
}
