import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { examBlueprints, items } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import { formatAverage } from "@/lib/exam/feedback-stats";
import { feedbackTotals } from "@/server/exam-feedback";
import type { AdvancedCard } from "@/solutions/types";

/**
 * The exam's "What you have" cards (spec 4): exams, the bank's approved and pending questions, and
 * the students' end-of-exam feedback (how many answered and the average rating). The page behind
 * the last one is a sub-page of Advanced, so the menu stays at five items.
 */
export async function examAdvancedCards(orgId: string, locale: Locale): Promise<AdvancedCard[]> {
  const t = managerT(locale);
  const [[exams], bank, feedback] = await Promise.all([
    db
      .select({ n: count() })
      .from(examBlueprints)
      .where(and(eq(examBlueprints.orgId, orgId), ne(examBlueprints.status, "ARCHIVED"))),
    db
      .select({ status: items.status, n: count() })
      .from(items)
      .where(and(eq(items.orgId, orgId), inArray(items.status, ["APPROVED", "DRAFT"])))
      .groupBy(items.status),
    feedbackTotals(orgId),
  ]);
  const of = (status: "APPROVED" | "DRAFT") => bank.find((r) => r.status === status)?.n ?? 0;
  return [
    { key: "exams", title: t("createExam.cardTitle"), lines: [t("createExam.cardCount", { count: exams?.n ?? 0 })], href: "/exam/exams" },
    {
      key: "bank",
      title: t("createQuestions.cardTitle"),
      lines: [t("createQuestions.cardApproved", { count: of("APPROVED") }), t("createQuestions.cardPending", { count: of("DRAFT") })],
      href: "/exam/bank",
    },
    {
      key: "feedback",
      title: t("examFeedback.cardTitle"),
      lines:
        feedback.count === 0
          ? [t("examFeedback.cardEmpty")]
          : [t("examFeedback.cardCount", { count: feedback.count }), t("examFeedback.cardAverage", { value: formatAverage(feedback.averageOverall, locale) })],
      href: "/exam/feedback",
      linkLabel: t("examFeedback.cardOpen"),
    },
  ];
}
