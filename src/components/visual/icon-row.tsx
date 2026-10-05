// kademe-owned
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** G5: an icon that carries meaning, in a neutral 40px box (never accent), with a title and an optional detail. */
export function IconRow({ icon: Icon, title, detail, tone = "default" }: { icon: LucideIcon; title: ReactNode; detail?: ReactNode; tone?: "default" | "negative" }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-ink">
        <Icon className={cn("size-5", tone === "negative" && "text-muted")} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 pt-2">
        <p className="text-[16px] leading-6 text-ink">{title}</p>
        {detail ? <p className="mt-0.5 text-[14px] leading-[22px] text-muted">{detail}</p> : null}
      </div>
    </div>
  );
}
