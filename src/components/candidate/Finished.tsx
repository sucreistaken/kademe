"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Mail, PowerOff, WifiOff } from "lucide-react";
import { ExamEndReport } from "@/components/candidate/ExamEndReport";
import { CandidateColumn } from "@/components/candidate/Shell";
import { useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { Badge } from "@/components/ui/badge";
import { Mascot } from "@/components/visual/mascot";
import { SectionTile } from "@/components/visual/section-look";
import type { StudentResult } from "@/lib/exam-flow";
import { FINISH_DRAIN_MS, finishUploadPhase } from "@/lib/proctor/recording-status";
import type { Section } from "@/lib/exam/types";
import { useT } from "@/i18n/candidate-client";

/**
 * The end. Every device is switched off first and the student is told so.
 * When the exam was recorded, its last segments are still uploading: until
 * they are, the screen asks the student to keep the tab open instead of
 * telling them to rest. The result appears only as far as the school allows
 * and only once a teacher has finalized it; there is no course recommendation
 * here or anywhere else. The next step is always concrete: who to write to,
 * and a way to report that something went wrong (collapsed until asked for).
 *
 * Soft look: finishing is worth a small celebration (the mascot pops in once
 * with a badge, motion-safe only) and the sections the student got
 * through, each in its own colour. It celebrates finishing, never a score:
 * nothing here says how any answer went. A terminated exam gets none of it.
 */
export function Finished({
  token,
  name,
  result,
  terminated,
  terminationReason,
  contactEmail,
  sections = [],
}: {
  token: string;
  name: string;
  result: StudentResult;
  terminated: boolean;
  terminationReason: string | null;
  contactEmail: string | null;
  /**
   * The exam's sections, in order; empty draws no row. A finished, not
   * terminated attempt has every section closed (handed in or timed out), so
   * each one is drawn done.
   */
  sections?: Section[];
}) {
  const t = useT("result");
  const sec = useT("section");
  const v = useT("visual");
  const m = useT("mascot");
  const rec = useT("recordingSafety");
  const { engine, snap } = useProctor();
  const [streamsOff, setStreamsOff] = useState(false);
  const [drainTimedOut, setDrainTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (engine) await engine.stop();
      if (cancelled) return;
      // Only a proctored exam had streams to turn off; an unproctored one says nothing.
      setStreamsOff(!!engine);
      // The last segments are still on their way. The wait is bounded; the
      // upload is not, and the page asks before it is left while any wait.
      if (engine && !(await engine.drainRecording(FINISH_DRAIN_MS)) && !cancelled) setDrainTimedOut(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const pending = snap?.upload?.pending ?? 0;
  const upload = finishUploadPhase({ recorded: !!snap?.upload, stopped: streamsOff, pending, timedOut: drainTimedOut });
  const uploading = upload === "sending" || upload === "slow";
  const released = result.released && result.visibility !== "NONE";
  return (
    <CandidateColumn width={560}>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 pb-7 pt-8 shadow-card sm:px-8">
        {terminated ? (
          <span aria-hidden className="mx-auto grid size-16 place-items-center rounded-full bg-subtle text-muted">
            <PowerOff className="size-7" strokeWidth={2} />
          </span>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Mascot pose="celebrate" size="spot" />
            <Badge tone="mint" size="md">
              <Check aria-hidden strokeWidth={3} />
              {m("finishedBadge")}
            </Badge>
          </div>
        )}

        <h1 className="mt-5 text-center text-[28px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">
          {terminated ? t("terminatedTitle") : v("finishedTitle")}
        </h1>
        {name ? <p className="mt-1 text-center text-[15px] font-semibold text-muted">{name}</p> : null}
        <p className="mx-auto mt-4 max-w-[44ch] text-center text-[15.5px] leading-[1.65] text-ink-2">
          {terminated
            ? `${terminationReason === "SCREEN_SHARE_GONE" || terminationReason === "FULLSCREEN_EXITS" ? t(`reason${terminationReason}`) : ""} ${t("terminatedNext")}`
            : uploading
              ? rec("bodyWhileSending")
              : v("finishedBody")}
        </p>

        {uploading ? (
          <p
            role="status"
            aria-live="polite"
            className="mx-auto mt-4 flex max-w-[44ch] items-start justify-center gap-2.5 rounded-xl bg-sun-soft px-4 py-3 text-start text-[14px] font-semibold leading-[1.5] text-ink"
          >
            {upload === "sending" ? (
              <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 text-sun motion-safe:animate-spin" strokeWidth={2.5} />
            ) : (
              <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0 text-sun" strokeWidth={2.5} />
            )}
            <span>
              {upload === "slow"
                ? rec("slow", { count: pending })
                : pending > 0
                  ? rec("sendingCount", { count: pending })
                  : rec("sending")}
            </span>
          </p>
        ) : null}

        {!terminated && sections.length ? (
          <div className="mt-6 rounded-xl bg-paper px-4 py-4">
            <ul className="flex flex-wrap justify-center gap-3">
              {sections.map((section) => (
                <li key={section} className="relative">
                  <SectionTile section={section} size="lg" />
                  <span aria-hidden className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full border-2 border-paper bg-accent text-white">
                    <Check className="size-3" strokeWidth={3.5} />
                  </span>
                  <span className="sr-only">{`${sec(section)}, ${v("sectionDone")}`}</span>
                </li>
              ))}
            </ul>
            <p className="tnum mt-3 text-center text-[13.5px] font-bold text-ink-2">
              {v("sectionsDone", { total: sections.length })}
            </p>
          </div>
        ) : null}

        {streamsOff ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-[13.5px] text-muted">
            <span aria-hidden className="grid size-4 place-items-center rounded-full bg-mint-soft text-mint">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            {t("streamsOff")}
          </p>
        ) : null}
        {upload === "done" ? (
          <p className="mt-1.5 flex items-center justify-center gap-2 text-[13.5px] text-muted">
            <span aria-hidden className="grid size-4 place-items-center rounded-full bg-mint-soft text-mint">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            {rec("sent")}
          </p>
        ) : null}

        {!terminated ? (
          <section className="mt-7 border-t border-row-line pt-6">
            <h2 className="text-[15px] font-extrabold text-ink">{v("nextTitle")}</h2>
            {released ? (
              <>
                <div className="mt-3 flex items-center gap-4 rounded-xl bg-mint-soft px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-mint">{t("overall")}</div>
                    {result.outcome ? <p className="mt-1 text-[14px] leading-[1.5] text-ink-2">{t(`outcome${result.outcome}`)}</p> : null}
                  </div>
                  <div className="tnum text-[44px] font-black leading-none text-ink">{result.overall ?? "-"}</div>
                </div>
                {result.skills?.length ? (
                  <>
                    <h3 className="mt-5 text-[13px] font-bold text-muted">{t("skills")}</h3>
                    <ul className="mt-2 flex flex-col gap-2">
                      {result.skills.map((s) => (
                        <li key={s.section} className="flex items-center gap-3 text-[14.5px]">
                          <SectionTile section={s.section} className="size-8 rounded-md [&>svg]:size-4" />
                          <span className="flex-1 font-semibold text-ink-2">{sec(s.section)}</span>
                          <Badge tone="outline" size="md" className="tnum text-ink">
                            {s.level ?? "-"}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-2">
                {result.visibility === "NONE" ? t("none") : result.awaitingTeacher ? t(result.waitingFor === "REVIEW" ? "pendingReview" : "pending") : t("notReleased")}
              </p>
            )}
          </section>
        ) : null}

        <div className="mt-5 flex justify-center">
          <ExamEndReport token={token} />
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 text-[13.5px] text-muted">
          {contactEmail ? (
            <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
              <Mail aria-hidden className="size-4" strokeWidth={2} />
              {t("contact", { email: "" })}
              <a className="font-semibold text-ink underline decoration-underline underline-offset-2" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </span>
          ) : null}
          <a className="underline decoration-underline underline-offset-2 hover:text-ink" href={`/a/${encodeURIComponent(token)}/rights`}>
            {t("rights")}
          </a>
        </div>
      </div>
    </CandidateColumn>
  );
}
