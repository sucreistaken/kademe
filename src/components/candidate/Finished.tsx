"use client";

import { useEffect, useState } from "react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { useProctor } from "@/components/candidate/proctor/ProctorProvider";
import type { StudentResult } from "@/lib/exam-flow";
import { useT } from "@/i18n/candidate-client";

/**
 * The end. Every device is switched off first and the student is told so. The
 * result appears only as far as the school allows and only once a teacher has
 * finalized it; there is no course recommendation here or anywhere else.
 * The next step is always concrete: who to write to.
 */
export function Finished({
  token,
  name,
  result,
  terminated,
  terminationReason,
  contactEmail,
}: {
  token: string;
  name: string;
  result: StudentResult;
  terminated: boolean;
  terminationReason: string | null;
  contactEmail: string | null;
}) {
  const t = useT("result");
  const sec = useT("section");
  const { engine } = useProctor();
  const [streamsOff, setStreamsOff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (engine) await engine.stop();
      if (!cancelled) setStreamsOff(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const released = result.released && result.visibility !== "NONE";
  return (
    <CandidateColumn width={520}>
      <div className="rounded-[14px] border border-line bg-surface px-7 py-8">
        <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
          {terminated ? t("terminatedTitle") : t("title")}
        </h1>
        {name ? <p className="mt-1 text-[14px] text-muted">{name}</p> : null}
        <p className="mt-4 text-[15px] leading-[1.65] text-ink-2">
          {terminated
            ? `${terminationReason === "SCREEN_SHARE_GONE" || terminationReason === "FULLSCREEN_EXITS" ? t(`reason${terminationReason}`) : ""} ${t("terminatedNext")}`
            : t("body")}
        </p>
        {streamsOff ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
            {t("streamsOff")}
          </p>
        ) : null}

        {!terminated ? (
          <div className="mt-6 border-t border-line pt-5">
            {released ? (
              <>
                <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{t("overall")}</div>
                <div className="tnum mt-1 text-[44px] font-bold leading-none text-ink">{result.overall ?? "-"}</div>
                {result.outcome ? (
                  <p className="mt-3 text-[14px] text-ink-2">{t(`outcome${result.outcome}`)}</p>
                ) : null}
                {result.skills?.length ? (
                  <>
                    <div className="mt-5 text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{t("skills")}</div>
                    <ul className="mt-2 divide-y divide-line">
                      {result.skills.map((s) => (
                        <li key={s.section} className="flex justify-between py-2 text-[14px]">
                          <span className="text-ink-2">{sec(s.section)}</span>
                          <span className="tnum font-semibold text-ink">{s.level ?? "-"}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-[14px] leading-[1.6] text-ink-2">
                {result.visibility === "NONE" ? t("none") : result.awaitingTeacher ? t("pending") : t("notReleased")}
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-1.5 text-[13px] text-muted">
          {contactEmail ? (
            <span>
              {t("contact", { email: "" })}
              <a className="text-ink underline decoration-line-strong underline-offset-2" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </span>
          ) : null}
          <a className="underline decoration-line-strong underline-offset-2" href={`/a/${encodeURIComponent(token)}/rights`}>
            {t("rights")}
          </a>
        </div>
      </div>
    </CandidateColumn>
  );
}
