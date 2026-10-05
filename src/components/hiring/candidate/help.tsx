"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { mailTo } from "./closed";

type SendState = "idle" | "sending" | "sent" | "failed";

/**
 * HIRING-UX 6: "Yardım" in the top bar: four answers (3.6: that typing is kept lives here now) and a way to reach a
 * person. Opening it moves focus into the panel. It closes on Escape pressed
 * anywhere (focus goes back to the button when it was inside), on a click
 * outside it, and when focus moves out of it; `aria-controls` names the panel
 * only while it exists. When the report is sent the form gives way to the
 * confirmation, which takes focus so a keyboard user is not left on <body>.
 * A report that did not reach the team says so (it is never shown as sent).
 * The confirmation promises no reply; it names the person to write to when
 * something is urgent (the opening's contact, else the organisation's).
 */
export function Help({ token, contactEmail }: { token: string; contactEmail: string | null }) {
  const t = useT("hiringFrame");
  const panel = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<SendState>("idle");
  const sentNote = useStepFocus<HTMLParagraphElement>(state === "sent" ? "sent" : "form");

  useEffect(() => {
    if (!open) return;
    title.current?.focus();
    const inside = (node: EventTarget | null) => node instanceof Node && !!root.current?.contains(node);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const hadFocus = inside(document.activeElement);
      setOpen(false);
      if (hadFocus) toggle.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function send() {
    setState("sending");
    try {
      await apiSend(token, "/problem", { area: "HELP", message: text.trim() });
      setState("sent");
    } catch {
      setState("failed");
    }
  }

  const empty = !text.trim();
  const sending = state === "sending";

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        // Focus moving to something outside (Tab past the panel) closes it; a window losing focus does not.
        const next = event.relatedTarget;
        if (open && next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center rounded-lg px-2 text-[14px] text-ink underline decoration-underline underline-offset-4 hover:decoration-ink"
      >
        {open ? t("closeHelp") : t("help")}
      </button>
      {open ? (
        <div
          id={panel}
          role="region"
          aria-labelledby={`${panel}-title`}
          className="absolute right-0 z-30 mt-2 max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-2rem))] space-y-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-overlay"
        >
          <h2 ref={title} id={`${panel}-title`} tabIndex={-1} className="text-[16px] leading-6 font-semibold text-ink">
            {t("helpTitle")}
          </h2>
          <dl className="space-y-3 text-[14px] leading-[22px]">
            {(["Drop", "Keep", "Camera", "Phone"] as const).map((k) => (
              <div key={k}>
                <dt className="font-medium text-ink">{t(`faq${k}Q`)}</dt>
                <dd className="mt-0.5 text-ink-2">{t(`faq${k}A`)}</dd>
              </div>
            ))}
          </dl>
          {state === "sent" ? (
            <p ref={sentNote} tabIndex={-1} role="status" className="border-t border-line pt-4 text-[14px] leading-[22px] text-ink">
              {contactEmail ? t.rich("reportSentContact", { email: contactEmail, mail: mailTo(contactEmail) }) : t("reportSent")}
            </p>
          ) : (
            <div className="space-y-2 border-t border-line pt-4">
              <label htmlFor={`${panel}-text`} className="block text-[14px] font-medium text-ink">
                {t("report")}
              </label>
              <Textarea
                id={`${panel}-text`}
                rows={3}
                value={text}
                maxLength={2000}
                onChange={(e) => {
                  setText(e.target.value);
                  if (state === "failed") setState("idle");
                }}
                placeholder={t("reportPlaceholder")}
                className="text-[16px] md:text-[16px]"
              />
              <Button
                id="help-send"
                className="min-h-11"
                disabled={empty || sending}
                disabledReason={empty ? t("reportEmpty") : undefined}
                onClick={send}
              >
                {sending ? t("reportSending") : t("reportSend")}
              </Button>
              {empty ? <DisabledReason id="help-send-why">{t("reportEmpty")}</DisabledReason> : null}
              {state === "failed" ? (
                <p role="alert" className="text-[14px] leading-[22px] text-ink">
                  {t("reportFailed")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
