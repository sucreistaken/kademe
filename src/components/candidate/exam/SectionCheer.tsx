"use client";

import { Check } from "lucide-react";
import { Mascot } from "@/components/visual/mascot";
import { SectionTile, type SectionKey } from "@/components/visual/section-look";
import { useT } from "@/i18n/candidate-client";

/**
 * Between sections: at the top of the next section's intro, once at least one
 * section is done. The mascot celebrates, a row of the exam's section badges
 * ticks the finished ones (each in its own colour and icon), and one short
 * encouraging line follows. It cheers finishing, never a score: nothing here
 * says how any answer went. Never rendered on a question screen.
 */
export function SectionCheer({ sections }: { sections: Array<{ section: SectionKey; done: boolean }> }) {
  const t = useT("mascot");
  const sec = useT("section");
  const v = useT("visual");
  const done = sections.filter((s) => s.done).length;
  if (done === 0) return null;
  return (
    <div className="mb-8 flex items-center gap-5 rounded-2xl bg-mint-soft px-5 py-4">
      <Mascot pose="celebrate" size="small" className="-my-2" />
      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] font-bold leading-[1.5] text-ink">{done === 1 ? t("cheerFirst") : t("cheerMore")}</p>
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {sections.map((s) => (
            <li key={s.section} className="relative">
              <SectionTile section={s.section} className={s.done ? undefined : "opacity-40"} />
              {s.done ? (
                <span aria-hidden className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border-2 border-mint-soft bg-accent text-white">
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
              ) : null}
              <span className="sr-only">{s.done ? `${sec(s.section)}, ${v("sectionDone")}` : sec(s.section)}</span>
            </li>
          ))}
        </ul>
        <p className="tnum mt-2 text-[13px] font-semibold text-ink-2">{t("cheerProgress", { done, total: sections.length })}</p>
      </div>
    </div>
  );
}
