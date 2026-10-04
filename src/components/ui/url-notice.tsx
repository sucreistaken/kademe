"use client";

import { useEffect } from "react";
import { withoutParams } from "@/lib/url-notice";

/**
 * Shows a notice the page read from the URL (lib/url-notice) and takes its
 * parameters out of the address once it is on screen, so a reload does not
 * show it again. `window.history.replaceState`, not `router.replace`: Next
 * integrates it with the router without asking the server again, so the notice
 * stays visible until the next navigation (a router.replace would re-render the
 * page without the parameter and drop the notice at once).
 */
export function UrlNotice({ params, children }: { params: readonly string[]; children: React.ReactNode }) {
  const key = params.join(",");
  useEffect(() => {
    const next = withoutParams(`${window.location.pathname}${window.location.search}${window.location.hash}`, key.split(","));
    if (next !== null) window.history.replaceState(null, "", next);
  }, [key]);
  return <>{children}</>;
}
