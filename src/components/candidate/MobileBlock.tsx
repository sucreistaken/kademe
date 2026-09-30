"use client";

import { useState } from "react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { useT } from "@/i18n/candidate-client";

/** Phones and tablets cannot share a screen from a browser. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile) return true;
  const noDisplayMedia = !navigator.mediaDevices || !("getDisplayMedia" in navigator.mediaDevices);
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return noDisplayMedia && (coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
}

/**
 * Not a dead end: the student leaves with the link on the clipboard and one
 * sentence on what to do with it.
 */
export function MobileBlock({ token }: { token: string }) {
  const t = useT("check");
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
  return (
    <CandidateColumn width={520}>
      <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{t("mobileTitle")}</h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-ink-2">{t("mobileBody")}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-6 h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover"
      >
        {copied ? t("copied") : t("copyLink")}
      </button>
      <p className="mt-3 text-center text-[13px] text-muted">{t("mobileHint")}</p>
    </CandidateColumn>
  );
}
