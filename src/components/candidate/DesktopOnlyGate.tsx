"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { MobileBlock, isMobileDevice, type MobileNeeds } from "@/components/candidate/MobileBlock";
import { examPageView, type MobileMoment } from "./device";

/** The device never changes after the first read. */
const noSubscribe = () => () => undefined;

/**
 * The exam page's half of "desktop only" (2026-10-14), for every proctoring
 * level. The consent screen and the system check block a phone too, but a
 * student who consented on a computer can open the same link on a phone
 * later; here that phone gets the MobileBlock and nothing else.
 *
 * The exam (children) is never rendered on the server or during hydration
 * unless the device is known: the server's hint is a phone or nothing, and
 * the browser decides with isMobileDevice as soon as it hydrates. So the
 * runner's effects (a draft resend, the proctoring engine) never run on a
 * phone, no section starts or advances, and the student continues on a
 * computer where they left off.
 */
export function DesktopOnlyGate({
  token,
  serverHint,
  need,
  moment,
  children,
}: {
  token: string;
  serverHint: "mobile" | "unknown";
  need: MobileNeeds;
  moment: MobileMoment;
  children?: ReactNode;
}) {
  const device = useSyncExternalStore(noSubscribe, () => (isMobileDevice() ? "mobile" : "desktop"), () => serverHint);
  const view = examPageView(device);
  if (view === "block") return <MobileBlock token={token} need={need} moment={moment} />;
  if (view === "wait") return null;
  return <>{children}</>;
}
