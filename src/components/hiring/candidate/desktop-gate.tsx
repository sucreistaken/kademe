"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { AppWindow } from "lucide-react";
import { useT } from "@/i18n/candidate-client";
import { classifyDevice, windowNotice, type DeviceSignals } from "./device-class";

/**
 * Everything the browser can say about itself (3.0). Read only in the browser.
 * All four client fields are always supplied, so classifyDevice decides with
 * the browser's whole answer (a field left out would fail open there).
 */
export function clientSignals(): DeviceSignals {
  const matches = (query: string) => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: unknown } }).userAgentData;
  return {
    ua: navigator.userAgent,
    chMobile: typeof uaData?.mobile === "boolean" ? uaData.mobile : null,
    coarse: matches("(pointer: coarse)"),
    anyFine: matches("(any-pointer: fine)"),
    hasDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === "function",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

/** For a store that never changes after the first read (the device, a mount-time value). Shared with the stage runner. */
export const noSubscribe = () => () => undefined;

const subscribeResize = (notify: () => void) => {
  window.addEventListener("resize", notify);
  return () => window.removeEventListener("resize", notify);
};

/** The window's width, live. The server and the first paint assume a wide window: nothing waits before the browser says so. */
export function useWindowWidth(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1280);
}

/** 3.0: a narrow desktop window is never blocked; it is told, calmly, and the strip goes when the window grows. */
export function NarrowWindowStrip() {
  const t = useT("hiringGate");
  const width = useWindowWidth();
  if (windowNotice(width) === "none") return null;
  return (
    <p role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[26px] text-ink">
      <AppWindow className="mt-[3px] size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      {t("narrow")}
    </p>
  );
}

/**
 * The browser's half of the gate. The server already answered a phone with the
 * desktop-only screen; here the browser looks again with every signal (an iPad
 * asking for the desktop site says "Macintosh" to the server). Its verdict is
 * the one that counts, and it lands at hydration, before consent or any
 * recording can start. A tablet UA the server could not decide renders nothing
 * until the browser has decided.
 */
export function DesktopGate({ serverClass, desktopOnly, children }: { serverClass: "desktop" | "unknown"; desktopOnly: ReactNode; children: ReactNode }) {
  const device = useSyncExternalStore(noSubscribe, () => classifyDevice(clientSignals()), () => serverClass);
  if (device === "phone" || device === "tablet") return <>{desktopOnly}</>;
  if (device === "unknown") return null;
  return (
    <>
      <NarrowWindowStrip />
      {children}
    </>
  );
}
