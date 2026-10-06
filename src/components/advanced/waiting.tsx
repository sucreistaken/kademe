"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMT } from "@/i18n/manager-client";
import { waitingKey } from "@/lib/create/waiting";

/** Spec 5.5: skeleton cards and the waiting line, "Hâlâ çalışıyor" after 40 seconds. No client cap. */
export function Waiting() {
  const t = useMT("advancedCreate");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-3" aria-busy="true">
      <p role="status" className="text-[13px] text-muted">
        {t(waitingKey(seconds))}
      </p>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
