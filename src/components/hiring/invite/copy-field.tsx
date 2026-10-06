"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMT } from "@/i18n/manager-client";

/**
 * HIRING-UX 5.11: copies `value`; "Kopyalandı" for two seconds. Where the
 * clipboard is refused, the field `id` is focused and selected so the manager
 * can copy it by hand.
 */
export function useCopyValue(id: string, value: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => (timer.current ? window.clearTimeout(timer.current) : undefined), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      field?.focus();
      field?.select();
    }
  }
  return { copied, copy };
}

/**
 * A value to copy (HIRING-UX 5.11): shown read-only and selectable, with one
 * copy button that reads "Kopyalandı" for two seconds. Where the clipboard is
 * refused, the text is selected so the manager can copy it by hand.
 */
export function CopyField({
  id,
  label,
  value,
  copyLabel,
  multiline = false,
  primary = false,
}: {
  id: string;
  label: string;
  value: string;
  copyLabel: string;
  multiline?: boolean;
  primary?: boolean;
}) {
  const t = useMT("hiringInvite");
  const { copied, copy } = useCopyValue(id, value);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          readOnly
          value={value}
          rows={7}
          className="w-full resize-y rounded-lg border border-input bg-canvas px-3 py-2 text-[14px] leading-[22px] text-ink"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : (
        <input id={id} readOnly value={value} className="h-10 w-full rounded-lg border border-input bg-canvas px-3 text-[14px] text-ink" onFocus={(e) => e.currentTarget.select()} />
      )}
      <Button variant={primary ? "primary" : "secondary"} onClick={copy}>
        {copied ? t("copied") : copyLabel}
      </Button>
      <span role="status" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}
