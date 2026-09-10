import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/session";
import { loadReview, resolveAssessmentId, loadReviewQueue } from "@/server/review";
import { can } from "@/lib/authorize";
import { getStorage } from "@/lib/storage";
import { ReviewScreen, type ReviewStageView } from "@/components/review/review-screen";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";
import type { I18nText, ResponsePayload } from "@/db/schema/types";

const MEDIA_URL_TTL_SECONDS = 300;

/**
 * Bilingual template content is resolved here, once, so every client component
 * below receives plain strings and none of them has to pick a language.
 */
function pick(
  value: I18nText | null | undefined,
  locale: Locale,
  fallback = "",
): string {
  if (!value) return fallback;
  const wanted = value[locale];
  if (wanted && wanted.trim()) return wanted;
  return (locale === "tr" ? value.en : value.tr) || fallback;
}

/**
 * Which language the picked string is actually in. A template authored only in
 * Turkish still renders on an English panel, and the stage name is CSS upper
 * cased in the scoring rail: without this, "Kıdemli" comes out "KIDEMLI".
 */
function pickLang(value: I18nText | null | undefined, locale: Locale): Locale {
  const wanted = value?.[locale];
  if (wanted && wanted.trim()) return locale;
  const other: Locale = locale === "tr" ? "en" : "tr";
  // Nothing to fall back to means the caller's own fallback string is shown,
  // and that one is written in the panel's language.
  return value?.[other]?.trim() ? other : locale;
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string; assessment?: string }>;
}) {
  const user = await requireUser("media:view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  const { attempt, assessment } = await searchParams;

  // `id` is the candidate id: that is what every link in the product carries.
  const assessmentId = await resolveAssessmentId(id, user, assessment);
  if (!assessmentId) notFound();

  const data = await loadReview(assessmentId, user, attempt);
  if (!data) notFound();

  // Invited but never started. A dead end here would be the manager's own
  // dashboard sending them to a 404, so say what is actually going on.
  if (!data.activeAttempt || !data.evaluation) {
    return (
      <main className="mx-auto max-w-[760px] px-6 py-10">
        <h1 className="text-[19px] font-semibold tracking-tight">
          {data.head.candidateName ?? t("shared.candidate")}
        </h1>
        <p className="mt-1 text-[13px] text-muted">{data.head.positionName}</p>
        <Card className="mt-6 p-6">
          <p className="text-[13.5px]">{t("review.notStartedTitle")}</p>
          <p className="mt-1.5 text-[13px] text-muted">{t("review.notStartedBody")}</p>
          <div className="mt-4">
            <Button variant="secondary" size="md" asChild>
              <Link href={`/candidates/${id}`}>{t("review.goToCandidate")}</Link>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const storage = getStorage();

  const stages: ReviewStageView[] = await Promise.all(
    data.stages.map(async (stage) => ({
      id: stage.id,
      name: pick(stage.name, locale, t("review.stageFallback")),
      nameLang: pickLang(stage.name, locale),
      completion: stage.run?.completion ?? "PENDING",
      isCarried: stage.isCarried,
      internalPurpose: stage.internalPurpose,
      eventCount: stage.events.length,
      activities: await Promise.all(
        stage.activities.map(async (activity) => {
          const payload = (activity.response?.payload ?? {}) as ResponsePayload;
          // Playback URLs are minted per request and expire in five minutes.
          // The bucket is never public and the key never reaches the client.
          const mediaUrl =
            activity.media && activity.media.status !== "FAILED"
              ? await storage.getSignedUrl(
                  activity.media.storageKey,
                  MEDIA_URL_TTL_SECONDS,
                )
              : null;
          return {
            id: activity.id,
            type: activity.type,
            candidatePrompt: pick(activity.candidatePrompt, locale),
            candidateNote: pick(activity.candidateNote, locale) || null,
            internalObjective: activity.internalObjective,
            expectedBehaviours: activity.expectedBehaviours ?? [],
            redFlags: activity.redFlags ?? [],
            mediaUrl,
            mediaStatus: activity.media?.status ?? null,
            transcriptText: activity.transcript?.text ?? "",
            transcriptWords: activity.transcript?.words ?? [],
            answerText: payload.text ?? null,
          };
        }),
      ),
      competencies: stage.competencies.map((c) => ({
        id: c.id,
        name: pick(c.name, locale),
        description: pick(c.description, locale) || null,
        levels: c.levels.map((l) => ({
          value: l.value,
          label: pick(l.label, locale),
          anchor: pick(l.anchor, locale) || null,
        })),
        options: c.options.map((o) => ({
          id: o.id,
          polarity: o.polarity,
          label: pick(o.label, locale),
          archived: o.archivedAt !== null,
        })),
        score: c.score,
        selectedOptionIds: c.selectedOptionIds ?? [],
        note: c.note,
        revisions: c.revisions.map((r) => ({
          at: r.at.toISOString(),
          score: r.score,
          optionCount: r.optionCount,
          hasNote: r.hasNote,
          byName: r.byName,
        })),
      })),
    })),
  );

  const queue = await loadReviewQueue(assessmentId, user.orgId);

  const attemptLabel = data.activeAttempt.isPrimary
    ? t("review.attemptLabel", { number: data.activeAttempt.attemptNumber })
    : t("review.attemptNotPrimary", { number: data.activeAttempt.attemptNumber });

  return (
    <ReviewScreen
      evaluationId={data.evaluation.id}
      candidateName={data.head.candidateName ?? t("shared.candidate")}
      positionName={data.head.positionName}
      attemptLabel={attemptLabel}
      stages={stages}
      canScore={can(user, "evaluation:write")}
      queue={queue}
    />
  );
}
