"use client";

import { Mic, UserRound, type LucideIcon } from "lucide-react";
import { useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { useT } from "@/i18n/candidate-client";

/** Which glyph each "act" reason gets: a voice or background sound, or a face that left the picture. */
const ICON: Record<"VOICE" | "NO_FACE", LucideIcon> = { VOICE: Mic, NO_FACE: UserRound };

/**
 * The proctor's two "do something" notices (voice or background sound, no
 * face) as a large card that floats under the top bar: yellow-soft with ink
 * text and a stronger border, never red, and it never takes a click (the
 * answer area under it stays usable). It lasts as long as the engine's banner
 * does (a few seconds for a voice, until the face is back for NO_FACE) and
 * never ends the exam; a teacher reviews what was recorded.
 *
 * The live region around it is always in the page and only its text changes,
 * so a screen reader says each notice once when it appears and stays quiet
 * while the engine re-sends the same banner. Rendered before the bar's row so
 * the clock's own time callout paints over it if both are open at once.
 */
export function ProctorNotice() {
  const p = useT("proctor");
  const { snap } = useProctor();
  const b = snap?.banner;
  const reason = b?.kind === "act" ? b.reason : null;
  const Icon = reason ? ICON[reason] : null;
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none absolute inset-x-0 top-full flex justify-center px-7">
      {reason && Icon ? (
        <div
          data-proctor-notice={reason}
          className="mt-3 flex w-full max-w-[640px] origin-top items-center gap-4 rounded-[22px] border-2 border-yellow-lip bg-yellow-soft px-5 py-4 text-start shadow-overlay motion-safe:animate-[pop-in_380ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-yellow text-ink">
            <Icon className="size-6" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-[19px] font-semibold leading-[26px] text-ink">{p(reason)}</p>
            <p className="mt-0.5 text-[15px] leading-[22px] text-ink-2">{p(`${reason}Hint`)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The quieter notices (a moment was recorded, a second screen): the old thin line under the bar. */
export function ProctorInfoLine() {
  const p = useT("proctor");
  const { snap } = useProctor();
  const b = snap?.banner;
  if (!b || b.kind !== "info") return null;
  return (
    <div role="status" className="border-t border-hairline bg-canvas">
      <p className="mx-auto max-w-[1000px] px-7 py-2 text-[13px] text-ink-2">{p(b.reason)}</p>
    </div>
  );
}
