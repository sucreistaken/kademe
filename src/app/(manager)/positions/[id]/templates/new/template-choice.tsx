"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createTemplate,
  startTemplateWithAd,
  type PositionResult,
} from "@/app/(manager)/positions/actions";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JOB_AD_MIN_CHARS, isJobAdThin } from "@/lib/template-draft";
import { useMT } from "@/i18n/manager-client";

/**
 * Two ways to build a template, and they are not presented as equals.
 *
 * The AI path owns the card, the heading and the screen's single filled button,
 * with the three things it will do listed in order. It was written before as a
 * bare textarea between two buttons, and a manager reading that could not tell
 * what pressing it would produce or whether it would overwrite anything.
 *
 * Building by hand is a text link under the card. It costs one extra click, and
 * it is deliberately still visible: hiding it would trap the manager who never
 * wants the AI.
 */
export function TemplateChoice({
  positionId,
  jobDescription: initialJobDescription,
  defaultTemplateName,
  aiConfigured,
}: {
  positionId: string;
  jobDescription: string;
  defaultTemplateName: string;
  aiConfigured: boolean;
}) {
  const t = useMT("templateChoice");
  const errors = useMT("positionErrors");
  const router = useRouter();

  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [state, formAction, generating] = useActionState<PositionResult, FormData>(
    startTemplateWithAd,
    { status: "idle" },
  );
  const [blankPending, startBlank] = useTransition();
  const [blankError, setBlankError] = useState<string | null>(null);

  const tooShort = jobDescription.trim().length < JOB_AD_MIN_CHARS;
  // Short but usable. Says so and lets the manager decide, rather than blocking.
  const thin = isJobAdThin(jobDescription);
  const aiDisabled = !aiConfigured || tooShort || generating;

  return (
    <>
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[15px] font-semibold">{t("aiTitle")}</h2>
          {/* Three steps, in order, so the manager knows what the button will
              produce before pressing it. The third one is the promise that
              matters: nothing is written without them. */}
          <ol className="mt-3 space-y-1 text-[13px] text-muted">
            <li>1. {t("step1")}</li>
            <li>2. {t("step2")}</li>
            <li>3. {t("step3")}</li>
          </ol>
        </div>

        <form action={formAction} className="px-6 py-5">
          <input type="hidden" name="positionId" value={positionId} />
          {/* The default template name is content the manager will see and can
              rename, so it travels in the language the panel is running in. */}
          <input type="hidden" name="templateName" value={defaultTemplateName} />

          <label htmlFor="jobDescription" className="text-[13.5px] font-medium">
            {t("jobAdLabel")}
          </label>
          <textarea
            id="jobDescription"
            name="jobDescription"
            rows={9}
            autoFocus
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            className="mt-2 w-full rounded-[10px] border border-line bg-surface p-3.5
                       text-[13.5px] leading-relaxed outline-none focus:border-muted"
          />
          <p className="mt-1.5 text-[13px] text-muted">
            {thin ? t("thinAd") : t("jobAdHint")}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              id="start-with-ad"
              type="submit"
              variant="primary"
              size="md"
              disabled={aiDisabled}
              disabledReason={
                !aiConfigured
                  ? t("aiUnavailable")
                  : tooShort
                    ? t("tooShort", { min: JOB_AD_MIN_CHARS })
                    : generating
                      ? t("startingReason")
                      : undefined
              }
            >
              {generating ? t("starting") : t("startWithAd")}
            </Button>

            {!aiConfigured ? (
              <DisabledReason id="start-with-ad-why">
                {t("aiUnavailableLong")}
              </DisabledReason>
            ) : tooShort ? (
              <DisabledReason id="start-with-ad-why">
                {t("tooShortLong")}
              </DisabledReason>
            ) : null}
          </div>

          {state.status === "error" ? (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {errors(state.code)}
            </p>
          ) : null}
        </form>
      </Card>

      {/* The manual path. A line, not a card: it is the same one click it was
          before, just no longer competing with the AI for attention. */}
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
        <span>{t("manualLead")}</span>
        <button
          type="button"
          disabled={blankPending || generating}
          onClick={() =>
            startBlank(async () => {
              const result = await createTemplate(positionId, defaultTemplateName);
              if (!result.ok) return setBlankError(errors(result.code));
              router.push(
                `/positions/${positionId}/templates/${result.templateId}/versions/${result.versionId}/builder`,
              );
            })
          }
          className="font-medium text-ink underline decoration-line
                     underline-offset-[3px] hover:decoration-ink
                     disabled:text-muted disabled:no-underline"
        >
          {blankPending ? t("startingBlank") : t("startBlank")}
        </button>
        <span aria-hidden>·</span>
        <Link href={`/positions/${positionId}`} className="hover:text-ink">
          {t("skip")}
        </Link>
      </p>
      {blankError ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {blankError}
        </p>
      ) : null}
    </>
  );
}
