"use client";

import { useEffect, useState } from "react";
import { arrivalFocusController } from "@/hooks/use-step-focus";

/**
 * Moves the focus once to the element with `targetId` when it mounts (W10):
 * a page a form's redirect brings back (the close of an opening, whose button
 * is gone) would otherwise leave a keyboard user on <body>. The caller renders
 * it only on that arrival, never on a plain load.
 */
export function FocusOnArrival({ targetId }: { targetId: string }) {
  const [controller] = useState(arrivalFocusController);
  useEffect(() => {
    controller.onArrive(document.getElementById(targetId));
  }, [controller, targetId]);
  return null;
}
