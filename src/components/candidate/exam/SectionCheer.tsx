"use client";

import { Check } from "lucide-react";
import { Mascot } from "@/components/visual/mascot";
import { SectionTile, type SectionKey } from "@/components/visual/section-look";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/** Which headline the progress strip carries; the mascot shows only after a finished section. */
export type CheerKind = "start" | "first" | "more" | "none";

/**
 * Nothing finished yet: a welcome on the very first section ("start"), or no
 * headline at all when an earlier section was skipped. Otherwise the cheer.
 */
export function cheerKind(done: number, position: number): CheerKind {
  if (done === 0) return position === 1 ? "start" : "none";
  return done === 1 ? "first" : "more";
}

/**
 * At the top of every section's intro. A row of the exam's section badges
 * (each in its own icon) ticks the finished ones and rings the current one, with "n of 5 sections done"
 * and one short line. Before the first section is done the line is a neutral
 * welcome and there is no mascot; once at least one is done the mascot
 * celebrates and the line encourages. It cheers finishing, never a score:
 * nothing here says how any answer went. Never rendered on a question screen.
 */
export function SectionCheer({
  sections,
  current,
  position,
}: {
  sections: Array<{ section: SectionKey; done: boolean }>;
  current: SectionKey;
  position: number;
}) {
  const t = useT("mascot");
  const sec = useT("section");
  const v = useT("visual");
  const done = sections.filter((s) => s.done).length;
  const kind = cheerKind(done, position);
  const line = kind === "start" ? t("startFirst", { section: sec(current) }) : kind === "first" ? t("cheerFirst") : kind === "more" ? t("cheerMore") : null;
  return (
    <div className="mb-3 flex items-center gap-4 rounded-2xl bg-mint-soft px-4 py-2.5">
      {done > 0 ? <Mascot pose="celebrate" size="small" className="-my-2" /> : null}
      <ul className="flex shrink-0 gap-1.5">
        {sections.map((s) => {
          const isCurrent = s.section === current && !s.done;
          return (
            <li key={s.section} className="relative" aria-current={isCurrent ? "step" : undefined}>
              <SectionTile
                section={s.section}
                className={cn(
                  "size-8 rounded-lg [&_svg]:size-4",
                  !s.done && (isCurrent ? "bg-surface text-ink ring-2 ring-accent" : "border border-line-strong bg-surface text-muted"),
                )}
              />
              {s.done ? (
                <span aria-hidden className="absolute -bottom-1 -end-1 grid size-4 place-items-center rounded-full border-2 border-mint-soft bg-accent text-white">
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
              ) : null}
              <span className="sr-only">{s.done ? `${sec(s.section)}, ${v("sectionDone")}` : sec(s.section)}</span>
            </li>
          );
        })}
      </ul>
      <div className="min-w-0 flex-1">
        {line ? <p className="text-[15px] font-bold leading-[1.4] text-ink">{line}</p> : null}
        <p className="tnum text-[13px] font-semibold leading-[1.4] text-ink-2">{t("cheerProgress", { done, total: sections.length })}</p>
      </div>
    </div>
  );
}
