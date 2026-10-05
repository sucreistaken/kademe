"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { nextPath } from "@/lib/candidate-routes";
import { useT } from "@/i18n/candidate-client";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { infoProblems, infoWaitReason } from "./info-model";
import { serverMessage } from "./server-message";
import { useJourney } from "./use-journey";

const FIELD = "mt-2 h-12 w-full rounded-[10px] border bg-surface px-3.5 text-[16px] text-ink outline-none focus:border-ink/40";

/**
 * HIRING-VISUAL-FLOW 3.12: only when the invitation lacks the e-mail. Two
 * fields at 16px (no zoom, readable), the button waits with the reason the
 * server would give, a field says its own problem once it has been left, and
 * a refusal is said in the server's words or ours, never the browser's raw
 * text (Task 11 Minor 10 carry). Phone and city keep what the invitation has;
 * they are not asked here.
 */
export function InfoStep({
  token,
  initial,
  device,
  warmup,
}: {
  token: string;
  initial: { fullName: string; email: string; phone: string; location: string };
  device: boolean;
  warmup: boolean;
}) {
  const t = useT("hiringInfo");
  const router = useRouter();
  const [form, setForm] = useState({ fullName: initial.fullName, email: initial.email });
  // A field shows its problem after the candidate has left it, never while they are still typing.
  const [left, setLeft] = useState({ fullName: false, email: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const why = infoWaitReason(form);
  const problems = infoProblems(form);
  const journey = useJourney("prep", { device, warmup });
  const heading = useStepFocus<HTMLHeadingElement>("info");

  function edit(next: typeof form) {
    setForm(next);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/info", { ...form, phone: initial.phone, location: initial.location });
      router.push(nextPath(token, next));
    } catch (err) {
      setError(serverMessage(err) ?? t("failed"));
      setBusy(false);
    }
  }

  const nameShown = left.fullName && problems.name;
  const emailShown = left.email && problems.email;
  return (
    <>
      <StepScreen layout="split" title={t("title")} titleRef={heading} lead={<p>{t("body")}</p>}>
        <div className="space-y-5">
          <label className="block">
            <span className="text-[16px] font-medium text-ink">{t("fullName")}</span>
            <input
              id="info-name"
              className={`${FIELD} ${nameShown ? "border-danger" : "border-line-strong"}`}
              value={form.fullName}
              autoComplete="name"
              maxLength={120}
              aria-invalid={nameShown || undefined}
              aria-describedby={nameShown ? "info-name-error" : undefined}
              onChange={(e) => edit({ ...form, fullName: e.target.value })}
              onBlur={() => setLeft((was) => ({ ...was, fullName: true }))}
            />
            {nameShown ? (
              <p id="info-name-error" className="mt-2 text-[14px] leading-[22px] text-danger">
                {t("name")}
              </p>
            ) : null}
          </label>
          <label className="block">
            <span className="text-[16px] font-medium text-ink">{t("email")}</span>
            <input
              id="info-email"
              className={`${FIELD} ${emailShown ? "border-danger" : "border-line-strong"}`}
              type="email"
              value={form.email}
              autoComplete="email"
              maxLength={160}
              aria-invalid={emailShown || undefined}
              aria-describedby={emailShown ? "info-email-error" : undefined}
              onChange={(e) => edit({ ...form, email: e.target.value })}
              onBlur={() => setLeft((was) => ({ ...was, email: true }))}
            />
            {emailShown ? (
              <p id="info-email-error" className="mt-2 text-[14px] leading-[22px] text-danger">
                {t("emailWait")}
              </p>
            ) : null}
          </label>
        </div>
      </StepScreen>
      <StepFooter
        journey={journey}
        primary={{ kind: "button", id: "info-next", label: t("next"), busy, busyLabel: t("saving"), waitReason: why === "name" ? t("name") : why === "email" ? t("emailWait") : null, onClick: () => void submit() }}
        note={
          error ? (
            <p role="alert" className="text-right text-[14px] leading-[22px] text-ink">
              {error}
            </p>
          ) : null
        }
      />
    </>
  );
}
