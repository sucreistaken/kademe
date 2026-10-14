"use client";

import { CandidateColumn } from "@/components/candidate/Shell";
import { Mascot } from "@/components/visual/mascot";
import { useT } from "@/i18n/candidate-client";

/**
 * The screen a student sees when they open their link before the exam opens
 * (the link's `notBefore`). Nothing can be started from here: the server
 * refuses every student request until then (NOT_YET), this only says so
 * kindly. `when` and `zone` are written on the server in the school's zone
 * (src/lib/invite-message openingMoment, zoneLabel).
 */
export function ExamNotYetOpen({ when, zone, contactEmail }: { when: string; zone: string; contactEmail: string | null }) {
  const t = useT("examWindow");
  return (
    <CandidateColumn width={560} padding="px-[34px] pt-11 pb-[46px]">
      <div className="flex flex-col items-center text-center">
        <Mascot pose="rest" size="spot" />
        <h1 className="mt-6 text-2xl font-bold leading-[1.25] tracking-[-0.02em] text-ink">{t("notYetTitle", { when })}</h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-ink-2">{t("notYetBody")}</p>
        <p className="mt-2 text-[13px] leading-[1.6] text-muted">{t("notYetZone", { zone })}</p>
        <p className="mt-5 text-[13px] leading-[1.6] text-muted">
          {t("notYetContact")}
          {contactEmail ? (
            <>
              {" "}
              <a href={`mailto:${contactEmail}`} className="text-ink-2 underline decoration-line-strong underline-offset-2">
                {contactEmail}
              </a>
            </>
          ) : null}
        </p>
      </div>
    </CandidateColumn>
  );
}
