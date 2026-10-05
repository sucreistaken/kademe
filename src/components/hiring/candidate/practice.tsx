"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useStepFocus } from "@/hooks/use-step-focus";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import { localSink } from "./local-sink";
import { RecordedActivity, type RecordedPhase } from "./recorded-activity";

/**
 * HIRING-UX 6.4: the same recorder with a neutral question, 15 s to think, 30 s
 * to answer, as many takes as wanted, nothing sent (A4). After one take the
 * review's filled button leads to the assessment (beside "Tekrar çek", one
 * bar); before it, "Isınmayı atla". While a take records, the recorder's own
 * button is the only filled one.
 */
export function Practice({ token, camera, locale }: { token: string; camera: boolean; locale: Locale }) {
  const t = useT("hiringPractice");
  const sink = useMemo(() => localSink(), []);
  useEffect(() => () => sink.release(), [sink]);
  const heading = useStepFocus<HTMLHeadingElement>("practice");
  const [hasTake, setHasTake] = useState(false);
  const [phase, setPhase] = useState<RecordedPhase>("think");
  const prompt = t("prompt");
  const next = `/a/${encodeURIComponent(token)}/stage/1`;
  const busy = phase === "record" || phase === "saving";
  return (
    <div className="mx-auto max-w-[960px] pt-8 pb-6">
      <p className="inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[14px] text-ink">{t("badge")}</p>
      <p className="mt-3 mb-6 text-[16px] leading-[26px] text-ink-2">{t("why")}</p>
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
        onTake={() => setHasTake(true)}
        onPhase={setPhase}
        timeUp={false}
        disabled={false}
        reviewPrimary={
          <Button asChild variant="primary" size="lg" className="w-full text-[16px] sm:w-auto">
            <Link href={next}>{t("ready")}</Link>
          </Button>
        }
      />
      {busy || phase === "review" ? null : (
        <p className="mt-8">
          <Link href={next} className="inline-flex min-h-11 items-center text-[16px] text-ink underline decoration-underline underline-offset-4">
            {hasTake ? t("ready") : t("skip")}
          </Link>
        </p>
      )}
    </div>
  );
}
