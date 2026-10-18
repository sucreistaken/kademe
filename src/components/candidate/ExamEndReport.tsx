"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";

type SendState = "idle" | "sending" | "sent" | "failed";

/**
 * "Did something go wrong during the exam?" on the last screen. Closed it is
 * one text button, so the page keeps its height; opened it is a short note and
 * a send button. The report goes to the same route as the check screens' and
 * reaches the teacher's panel as a problem on this student's exam. Sent, the
 * form gives way to a thank-you; a report that did not arrive says so and can
 * be sent again (it is never shown as sent).
 */
export function ExamEndReport({ token }: { token: string }) {
  const t = useT("result");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<SendState>("idle");

  async function send() {
    setState("sending");
    try {
      await apiSend(token, "/problem", { area: "EXAM_END", message: text.trim() });
      setState("sent");
    } catch {
      setState("failed");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-center text-[14px] font-semibold leading-[1.5] text-ink">
        {t("problemSent")}
      </p>
    );
  }

  const empty = !text.trim();
  const sending = state === "sending";
  return (
    <div className="w-full max-w-[44ch] text-center">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 rounded-lg px-2 text-[14px] font-semibold text-ink underline decoration-underline underline-offset-2 hover:decoration-ink"
      >
        {t("problemToggle")}
      </button>
      {open ? (
        <div id={id} className="mt-1 space-y-2 text-left">
          <label htmlFor={`${id}-text`} className="sr-only">
            {t("problemToggle")}
          </label>
          <Textarea
            id={`${id}-text`}
            rows={3}
            value={text}
            maxLength={2000}
            disabled={sending}
            onChange={(e) => {
              setText(e.target.value);
              if (state === "failed") setState("idle");
            }}
            placeholder={t("problemPlaceholder")}
            className="text-[16px] md:text-[16px]"
          />
          <div className="flex items-center justify-between gap-3">
            <p role={state === "failed" ? "alert" : undefined} className="min-w-0 text-[13.5px] leading-[1.4] text-ink-2">
              {state === "failed" ? t("problemFailed") : empty ? t("problemEmpty") : ""}
            </p>
            <Button variant="primary" className="shrink-0" disabled={empty || sending} disabledReason={empty ? t("problemEmpty") : undefined} onClick={send}>
              {sending ? t("problemSending") : state === "failed" ? t("problemRetry") : t("problemSend")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
