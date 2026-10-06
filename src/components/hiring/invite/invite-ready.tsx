"use client";

import { Calendar, Copy, Languages, UserPlus } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/visual/disclosure";
import { Illustration } from "@/components/visual/illustrations";
import { StepScreen } from "@/components/visual/step-screen";
import { useMT } from "@/i18n/manager-client";
import { CopyField, useCopyValue } from "./copy-field";

const TEXT_ACTION = "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";

/**
 * 4.9 in the look of the manager mockup (screen 7): one of the panel's two
 * success moments. The drawing, "<name> için link hazır", the once-only note
 * (full text, it matters), the link once in a monospace box, its language and
 * last day, the ready message behind its disclosure, and one row: "Başka aday
 * davet et" and the caller's links as text, the one filled "Linki kopyala" at
 * the right. Copying works as CopyField's (useCopyValue).
 */
export function InviteReady({
  container,
  headingRef,
  name,
  url,
  expires,
  language,
  message,
  onAnother,
  links,
}: {
  container: "page" | "sheet";
  headingRef: Ref<HTMLHeadingElement>;
  name: string;
  url: string;
  expires: string;
  language: string;
  message: string;
  onAnother(): void;
  links?: ReactNode;
}) {
  const t = useMT("hiringInvite");
  const common = useMT("hiringCommon");
  const { copied, copy } = useCopyValue("invite-link", url);
  const body = (
    <div className="space-y-4">
      <div>
        <label htmlFor="invite-link" className="sr-only">
          {t("linkLabel")}
        </label>
        <input
          id="invite-link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-12 w-full rounded-[10px] border border-line bg-paper px-3.5 font-mono text-[13px] text-ink"
        />
      </div>
      <p className="tnum flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <Languages className="size-[15px]" strokeWidth={1.75} aria-hidden />
          {language}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-[15px]" strokeWidth={1.75} aria-hidden />
          {common("deadline", { date: expires })}
        </span>
      </p>
      <Disclosure label={t("showMessage")}>
        <CopyField id="invite-message" label={t("messageLabel")} value={message} multiline copyLabel={t("copyMessage")} />
      </Disclosure>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-hairline pt-4">
        <button type="button" onClick={onAnother} className={TEXT_ACTION}>
          <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
          {t("another")}
        </button>
        {links}
        <Button variant="primary" className="ml-auto" onClick={copy}>
          <Copy className="size-4" strokeWidth={1.75} aria-hidden />
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
  if (container === "page") {
    return (
      <StepScreen layout="single" width={640} illustration="inviteReady" illustrationSize="spot" title={t("readyFor", { name })} titleRef={headingRef} lead={<p>{t("onceNote")}</p>}>
        {body}
      </StepScreen>
    );
  }
  return (
    <div className="space-y-4 pt-2 pb-8">
      <Illustration name="inviteReady" size="small" className="[@media(max-height:700px)]:hidden" />
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-[24px] leading-8 font-semibold text-ink outline-none">
          {t("readyFor", { name })}
        </h2>
        <p className="mt-1.5 text-[14.5px] leading-[22px] text-ink-2">{t("onceNote")}</p>
      </div>
      {body}
    </div>
  );
}
