import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { integrityVerificationCode, summarizeFlags } from "@/components/panel/integrity/groups";
import { IntegrityReportSheet, type IntegrityReportModel } from "@/components/panel/integrity/report-sheet";
import { PrintButton } from "@/components/panel/report/print-button";
import { toFlagEvents } from "@/components/panel/result/integrity-panel";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { resolveSigningSecret } from "@/lib/signing-secret";
import { loadIntegrityView, loadResultView } from "@/server/panel";
import { requireUser } from "@/server/session";
import { contentLocale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

/** How many evidence thumbnails the sheet carries at most. */
const MAX_FRAMES = 4;

/**
 * One student's printable integrity report. Same audience and org scope as the
 * result page (`loadResultView` filters by the user's org). Unlike the level
 * report it needs no final result: the teacher may print it while deciding.
 */
export default async function IntegrityReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  const view = await loadResultView(user.orgId, id);
  if (!view || !view.attempt) notFound();
  const { assessment, candidate, attempt } = view;
  const back = (
    <Link href={`/exam/students/${id}?tab=integrity`} className="text-[13px] text-muted hover:text-ink">
      {t("integrityFlags.reportBack")}
    </Link>
  );
  const preset = assessment.blueprintSnapshot.proctoring.preset;
  if (preset === "OFF") {
    return (
      <main className="mx-auto max-w-[760px] px-6 py-8">
        {back}
        <p className="mt-6 text-[14px] text-ink-2">{t("integrity.off")}</p>
      </main>
    );
  }

  const integrity = await loadIntegrityView(attempt.id);
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, user.orgId));
  const sum = summarizeFlags(toFlagEvents(integrity.events));

  // Who ruled on the events, by flag type.
  const deciderIds = [...new Set(integrity.events.map((r) => r.event.decidedBy).filter((x): x is string => !!x))];
  const people = deciderIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, deciderIds)) : [];
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const deciders: Record<string, string[]> = {};
  for (const { event } of integrity.events) {
    if (!event.decidedBy || !nameOf[event.decidedBy]) continue;
    const list = (deciders[event.type] ??= []);
    if (!list.includes(nameOf[event.decidedBy])) list.push(nameOf[event.decidedBy]);
  }

  // A few frames from the most serious open groups, webcam first.
  const frames: IntegrityReportModel["frames"] = [];
  for (const g of sum.flags.filter((x) => !x.settled)) {
    if (frames.length >= MAX_FRAMES) break;
    const own = integrity.evidence.filter((e) => e.eventId && g.eventIds.includes(e.eventId));
    const pick = own.find((e) => e.kind === "WEBCAM_FRAME") ?? own[0];
    if (pick && integrity.urls[pick.id]) frames.push({ id: pick.id, url: integrity.urls[pick.id], kind: pick.kind, type: g.type });
  }

  const headParts = [
    sum.serious > 0 ? t("integrityFlags.headSerious", { n: sum.serious }) : null,
    sum.medium > 0 ? t("integrityFlags.headMedium", { n: sum.medium }) : null,
    sum.low > 0 ? t("integrityFlags.headLow", { n: sum.low }) : null,
  ].filter((x): x is string => !!x);

  const model: IntegrityReportModel = {
    schoolName: org?.name ?? "Kademe",
    studentName: candidate.fullName ?? "-",
    examName: assessment.blueprintName,
    examDate: attempt.completedAt ?? attempt.startedAt,
    preset,
    level: attempt.integritySummary?.level ?? "CLEAR",
    outcome: attempt.integrityOutcome
      ? { value: attempt.integrityOutcome, by: attempt.integrityDecidedBy ? (view.nameOf[attempt.integrityDecidedBy] ?? null) : null, at: attempt.integrityDecidedAt }
      : null,
    headline: headParts.length ? headParts.join(", ") : t("integrityFlags.headNone"),
    flags: sum.flags,
    technical: sum.technical,
    technicalEvents: sum.technicalEvents,
    deciders,
    frames,
    generatedAt: new Date(),
    verificationCode: integrityVerificationCode(attempt.id, resolveSigningSecret(process.env)),
  };

  return (
    <main className="report-wrap bg-canvas px-6 py-8">
      <div className="report-toolbar mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between gap-4">
        <div>
          {back}
          <p className="mt-1 text-[12.5px] text-muted">{t("resultReport.printHint")}</p>
        </div>
        <PrintButton label={t("resultReport.print")} />
      </div>
      <IntegrityReportSheet model={model} t={t} locale={contentLocale(locale)} />
    </main>
  );
}
