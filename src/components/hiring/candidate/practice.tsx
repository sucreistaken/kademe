"use client";

import { useEffect, useMemo, useState } from "react";
import { useArrivalFocus } from "@/hooks/use-step-focus";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import { localSink } from "./local-sink";
import { RecordedActivity, type RecordedPhase } from "./recorded-activity";
import { useJourney } from "./use-journey";

/**
 * HIRING-UX 6.4: the same recorder with a neutral question, 15 s to think, 30 s
 * to answer, as many takes as wanted, nothing sent (A4). The question and its
 * ring sit on the left, the candidate's picture on the right; the footer holds
 * the journey, "Isınmayı atla" on the left and the one filled button: the
 * recorder's own while it works, and after one take the review's "Hazırım,
 * değerlendirmeye başla" (a link) beside "Tekrar çek".
 */
export function Practice({ token, camera, locale }: { token: string; camera: boolean; locale: Locale }) {
  const t = useT("hiringPractice");
  const sink = useMemo(() => localSink(), []);
  useEffect(() => () => sink.release(), [sink]);
  const heading = useArrivalFocus<HTMLHeadingElement>();
  const [phase, setPhase] = useState<RecordedPhase>("think");
  const journey = useJourney("warmup", { device: true, warmup: true });
  const prompt = t("prompt");
  const next = `/a/${encodeURIComponent(token)}/stage/1`;
  const busy = phase === "record" || phase === "saving";
  return (
    <div className="pt-8">
      <p className="text-[16px] leading-[26px] text-ink-2">{t("why")}</p>
      <RecordedActivity
        mode="practice"
        activity={{
          id: "practice",
          type: camera ? "VIDEO" : "AUDIO",
          prompt: { tr: prompt, en: prompt },
          note: { tr: "", en: "" },
          thinkSeconds: 15,
          flexibleThink: true,
          answerSeconds: 30,
          maxTakes: Number.POSITIVE_INFINITY,
          textAlternativeEnabled: false,
        }}
        locale={locale}
        headingRef={heading}
        sink={sink}
        takesUsed={0}
        existingRef={null}
        playbackSrc={async (result) => result.localUrl ?? null}
        onPhase={setPhase}
        timeUp={false}
        disabled={false}
        journey={journey}
        // "Isınmayı atla" waits while a take records (the take must stop first: leaving drops it) and on the review (its filled button leads on).
        footerBack={busy || phase === "review" ? null : { label: t("skip"), href: next }}
        reviewPrimary={{ kind: "link", id: "practice-ready", label: t("ready"), href: next }}
        kicker={t("badge")}
      />
    </div>
  );
}
