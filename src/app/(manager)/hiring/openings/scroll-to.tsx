"use client";

import { useEffect } from "react";

/** H8: an old `?tab=` link lands on its group: the page scrolls there once, after it is drawn. */
export function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
