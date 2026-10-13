"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { studentLinkAction, type StudentLinkResult } from "@/app/(manager)/exam/students/link-action";
import { useMT } from "@/i18n/manager-client";

/**
 * "Linki kopyala" on a student's row. The link is asked for on the click
 * (the list's markup never carries links), copied, and "Kopyalandı" shows for
 * two seconds. Where the clipboard is refused, the link is shown selected so
 * it can be copied by hand; a link that cannot be shown says why.
 */
export function StudentLinkButton({ assessmentId, name }: { assessmentId: string; name: string }) {
  const t = useMT("examWizard");
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ kind: "copied" } | { kind: "shown"; url: string } | { kind: "refused"; code: Extract<StudentLinkResult, { ok: false }>["code"] } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => (timer.current ? window.clearTimeout(timer.current) : undefined), []);
  useEffect(() => {
    if (state?.kind === "shown") field.current?.select();
  }, [state]);

  function copy() {
    start(async () => {
      let r: StudentLinkResult;
      try {
        r = await studentLinkAction(assessmentId);
      } catch {
        r = { ok: false, code: "FAILED" };
      }
      if (!r.ok) {
        setState({ kind: "refused", code: r.code });
        return;
      }
      try {
        await navigator.clipboard.writeText(r.url);
        setState({ kind: "copied" });
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState(null), 2000);
      } catch {
        setState({ kind: "shown", url: r.url });
      }
    });
  }

  return (
    <div className="mt-1 space-y-1">
      <button
        type="button"
        onClick={copy}
        disabled={pending}
        aria-label={`${t("linkCopy")}: ${name}`}
        className="inline-flex min-h-8 items-center gap-1 text-[12.5px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink disabled:text-muted"
      >
        <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
        {pending ? t("linkFetching") : state?.kind === "copied" ? t("copied") : t("linkCopy")}
      </button>
      {state?.kind === "shown" ? (
        <input
          ref={field}
          readOnly
          value={state.url}
          aria-label={t("linkFor", { name })}
          onFocus={(e) => e.currentTarget.select()}
          className="block h-8 w-[260px] rounded-[8px] border border-line bg-paper px-2 font-mono text-[11.5px] text-ink"
        />
      ) : null}
      {state?.kind === "refused" ? <p className="max-w-[240px] text-[12px] leading-4 text-muted">{t(`link${state.code}`)}</p> : null}
      <span role="status" className="sr-only">
        {state?.kind === "copied" ? t("copied") : ""}
      </span>
    </div>
  );
}
