"use client";

import { CirclePlay } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { TutorialScript } from "./script-types";
import { formatPlayTime } from "./timeline";
import { useTutorial } from "./use-tutorial";

/** "Watch how it works (0:40)": a quiet button on a section introduction; the length is the tutorial's own. */
export function TutorialButton({ script, onOpen }: { script: TutorialScript; onOpen: () => void }) {
  const tt = useTranslations("tutorial");
  const { timeline } = useTutorial(script);
  return (
    <button type="button" onClick={onOpen} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-11 gap-2 px-5")}>
      <CirclePlay aria-hidden className="size-5" strokeWidth={2} />
      {tt("watch", { time: formatPlayTime(Math.round(timeline.total / 1000) * 1000) })}
    </button>
  );
}
