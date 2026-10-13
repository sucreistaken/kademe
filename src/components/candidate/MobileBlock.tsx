"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { Illustration } from "@/components/visual/illustrations";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * A phone or a tablet. Phones cannot share a screen from a browser at all
 * (no getDisplayMedia); the rest of the check reads the device class.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile) return true;
  const noDisplayMedia = !navigator.mediaDevices || !("getDisplayMedia" in navigator.mediaDevices);
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return noDisplayMedia && (coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
}

/** What this exam asks of the device; each true flag adds its own reason or step, nothing else is claimed. */
export type MobileNeeds = { camera?: boolean; screenShare?: boolean; writing?: boolean };

/**
 * The exam is desktop only (user decision 2026-10-14). Not a dead end: the
 * student learns the real reasons for this exam (its screens are made for a
 * computer, plus typing and screen sharing when the exam has them), that
 * nothing has started, and what to do next, with the link on the clipboard.
 */
export function MobileBlock({ token, need = {} }: { token: string; need?: MobileNeeds }) {
  const t = useT("check");
  const v = useT("visual");
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${window.location.origin}/a/${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  const reasons = [v("mobileWhyScreens"), ...(need.writing ? [v("mobileWhyWriting")] : []), ...(need.screenShare ? [v("mobileWhyShare")] : [])];
  const steps = [v("mobileStepOpen"), v("mobileStepBrowser"), ...(need.camera ? [v("mobileStepCamera")] : []), v("mobileStepQuiet")];
  return (
    <CandidateColumn width={520} padding="px-5 pt-8 pb-12">
      <Illustration name="desktopOnly" size="phone" className="mx-auto" />
      <h1 className="mt-6 text-[26px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">{v("mobileTitle")}</h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-ink-2">{v("mobileLead")}</p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[15px] font-bold text-ink">{v("mobileWhyTitle")}</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-2.5 text-[14px] leading-[1.55] text-ink-2">
              <span aria-hidden className="mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-full bg-sky-soft text-sky">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <h2 className="mt-7 text-[15px] font-bold text-ink">{v("mobileStepsTitle")}</h2>
      <ol className="mt-3 flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-[14px] leading-[1.55] text-ink-2">
            <span aria-hidden className="tnum grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12.5px] font-extrabold text-accent">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <button type="button" onClick={copy} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-7 w-full text-[16px]")}>
        {copied ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : <Copy className="size-4" strokeWidth={2.25} aria-hidden />}
        {copied ? t("copied") : t("copyLink")}
      </button>
      <p className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </p>
    </CandidateColumn>
  );
}
