"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FORBIDDEN_DIGEST } from "@/lib/authorize";
import { useMT } from "@/i18n/manager-client";

/**
 * The manager panel's error boundary. It exists mainly for one case: a role
 * that cannot do something reaching a page or action guarded by
 * requireUser(capability). That throws ForbiddenError, and without a boundary
 * the answer was Next's bare 500 page. Here it is a sentence in the panel's
 * language and a way back.
 *
 * It sits below the (manager) layout, so the header and the dictionary
 * provider are still around it. The error is matched on its digest (see
 * ForbiddenError): in production the message itself is redacted.
 */
export default function ManagerError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const t = useMT("errorPage");
  const forbidden =
    error.digest?.startsWith(FORBIDDEN_DIGEST) || error.name === "ForbiddenError";
  const tryAgain = retry ?? reset;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <h1 className="text-[26px] font-semibold tracking-tight">
        {forbidden ? t("forbiddenTitle") : t("genericTitle")}
      </h1>
      <Card className="mt-6 max-w-[560px] px-5 py-6">
        <p className="text-sm">{forbidden ? t("forbiddenBody") : t("genericBody")}</p>
        {!forbidden && error.digest ? (
          <p className="mt-2 text-[12.5px] text-muted tnum">
            {t("reference", { digest: error.digest })}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/dashboard">{t("toDashboard")}</Link>
          </Button>
          {/* A permission error does not go away by retrying. */}
          {!forbidden && tryAgain ? (
            <Button variant="ghost" size="sm" onClick={() => tryAgain()}>
              {t("retry")}
            </Button>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
