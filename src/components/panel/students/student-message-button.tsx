"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessageSquareText } from "lucide-react";
import { studentLinkAction, type StudentLinkResult } from "@/app/(manager)/exam/students/link-action";
import { useMT } from "@/i18n/manager-client";
import { fillMessage } from "./message";

/**
 * "Hatırlatma mesajı" / "Davet mesajını kopyala" on a not-started row: the
 * ready Turkish text with the live link in it. Like "Linki kopyala", the link
 * is asked for on the click and never sits in the list's markup; an invitation
 * that cannot show its link says why, in the same words as the link button.
 */
export function StudentMessageButton({
  assessmentId,
  name,
  school,
  deadline,
  minutes,
  fresh,
}: {
  assessmentId: string;
  name: string;
  school: string;
  deadline: string;
  minutes: number;
  fresh: boolean;
}) {
  const t = useMT("studentsExport");
  const tl = useMT("examWizard");
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ kind: "copied" } | { kind: "shown"; text: string } | { kind: "refused"; code: Extract<StudentLinkResult, { ok: false }>["code"] } | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
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
      const text = fillMessage({ name, school, link: r.url, deadline, minutes });
      try {
        await navigator.clipboard.writeText(text);
        setState({ kind: "copied" });
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState(null), 2000);
      } catch {
        setState({ kind: "shown", text });
      }
    });
  }

  const label = fresh ? t("inviteMsg") : t("remind");
  return (
    <div className="mt-1 space-y-1">
      <button
        type="button"
        onClick={copy}
        disabled={pending}
        aria-label={`${label}: ${name}`}
        className="inline-flex min-h-8 items-center gap-1 text-[12.5px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink disabled:text-muted"
      >
        <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden />
        {pending ? t("fetching") : state?.kind === "copied" ? t("copied") : label}
      </button>
      {state?.kind === "shown" ? (
        <textarea
          ref={field}
          readOnly
          rows={5}
          value={state.text}
          aria-label={t("messageFor", { name })}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-[280px] rounded-[8px] border border-line bg-paper px-2 py-1 text-[12px] text-ink"
        />
      ) : null}
      {state?.kind === "refused" ? <p className="max-w-[240px] text-[12px] leading-4 text-muted">{tl(`link${state.code}`)}</p> : null}
      <span role="status" className="sr-only">
        {state?.kind === "copied" ? t("copied") : ""}
      </span>
    </div>
  );
}
