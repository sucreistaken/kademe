"use client";

import { useEffect } from "react";
import { scheduleNoticeCleanup } from "@/lib/url-notice";

/**
 * Shows a notice the page read from the URL (lib/url-notice) and takes its
 * parameters out of the address once it is on screen, so a reload does not
 * show it again. `window.history.replaceState`, not `router.replace`: Next
 * integrates it with the router without asking the server again, so the notice
 * stays visible until the next navigation (a router.replace would re-render the
 * page without the parameter and drop the notice at once). Deferred one tick
 * (scheduleNoticeCleanup) so a full page load cannot resurrect it.
 */
export function UrlNotice({ params, children }: { params: readonly string[]; children: React.ReactNode }) {
  const key = params.join(",");
  useEffect(() => scheduleNoticeCleanup(window, key.split(",")), [key]);
  return <>{children}</>;
}
