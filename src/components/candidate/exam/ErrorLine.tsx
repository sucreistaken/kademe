"use client";

import { useT } from "@/i18n/candidate-client";

/** A failed action's message with a retry link, in the small error style. */
export function ErrorLine({ text, onRetry }: { text: string; onRetry: () => void }) {
  const t = useT("exam");
  return (
    <p role="alert" className="text-[13.5px] leading-[1.5] text-danger">
      {text}{" "}
      <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
        {t("retry")}
      </button>
    </p>
  );
}
