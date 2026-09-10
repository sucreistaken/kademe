"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createPosition, type PositionResult } from "@/app/(manager)/positions/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMT } from "@/i18n/manager-client";

// The job ad is asked for on the next screen, not here. It has exactly one
// consumer, the AI builder, so collecting it before the manager has chosen
// whether to use the AI is asking for work that may be discarded, and the same
// textarea on two consecutive screens reads as a bug.
const field =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] " +
  "outline-none focus:border-muted placeholder:text-muted/70";

export default function NewPositionPage() {
  const t = useMT("positionNew");
  const shared = useMT("shared");
  const common = useMT("common");
  const errors = useMT("positionErrors");
  const [state, action, pending] = useActionState<PositionResult, FormData>(
    createPosition,
    { status: "idle" },
  );

  return (
    <main className="mx-auto max-w-[720px] px-6 py-8">
      <p className="text-[12.5px] text-muted">
        <Link href="/positions" className="hover:text-ink">
          {shared("positionsBreadcrumb")}
        </Link>{" "}
        / {t("breadcrumb")}
      </p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">{t("title")}</h1>

      <form action={action}>
        <Card className="mt-6 space-y-5 p-6">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">{t("name")}</span>
            <input
              name="name"
              required
              autoFocus
              placeholder={t("namePlaceholder")}
              className={`${field} h-10`}
            />
            <span className="mt-1 block text-[12px] text-muted">{t("nameHint")}</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">
              {t("shortDescription")}
            </span>
            <input
              name="shortDescription"
              placeholder={t("shortDescriptionPlaceholder")}
              className={`${field} h-10`}
            />
          </label>

          {state.status === "error" ? (
            <p role="alert" className="text-[13px] text-danger">
              {errors(state.code)}
            </p>
          ) : null}
        </Card>

        <div className="mt-4 flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending}
            disabledReason={pending ? t("submittingReason") : undefined}
          >
            {pending ? t("submitting") : t("submit")}
          </Button>
          <Link href="/positions" className="text-[13px] text-muted hover:text-ink">
            {common("cancel")}
          </Link>
        </div>
      </form>
    </main>
  );
}
