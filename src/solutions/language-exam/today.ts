import { INTEGRITY_TONE, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import type { Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import { listStudents } from "@/server/panel";
import type { TodayItem } from "@/solutions/types";

/** The exam's rows for the shared Today screen: the same facts the old dashboard showed. */
export async function examToday(orgId: string, _userId: string, locale: Locale): Promise<TodayItem[]> {
  const t = managerT(locale);
  const rows = await listStudents(orgId);
  const review: TodayItem[] = rows
    .filter((r) => r.status === "AWAITING_REVIEW" || r.status === "AWAITING_GRADING")
    .map((r) => ({
      id: r.assessmentId,
      solution: "language-exam",
      lane: "review",
      waitingOn: r.status === "AWAITING_GRADING" ? "ai" : "you",
      title: r.name,
      subtitle: shortDateTime(r.completedAt, locale),
      href: `/exam/students/${r.assessmentId}`,
      sortAt: r.completedAt,
      cells: [
        { kind: "text", text: `${t(`mode.${r.mode}`)}${r.claimed ? ` · ${t("mode.claimed", { level: r.claimed })}` : ""}` },
        { kind: "level", text: r.level, final: r.levelFinal },
        {
          kind: "dot",
          tone: r.status === "AWAITING_GRADING" ? "neutral" : "warn",
          text:
            r.status === "AWAITING_GRADING"
              ? t("today.aiRunning")
              : r.aiProposals > 0
                ? t("today.aiPending", { n: r.aiProposals })
                : t("today.readyToFinalize"),
        },
        { kind: "dot", tone: INTEGRITY_TONE[r.integrity], text: t(`integrityLevel.${r.integrity}`) },
      ],
    }));
  const running: TodayItem[] = rows
    .filter((r) => r.status === "IN_EXAM")
    .map((r) => ({
      id: r.assessmentId,
      solution: "language-exam",
      lane: "running",
      title: r.name,
      subtitle: null,
      href: `/exam/students/${r.assessmentId}`,
      sortAt: null,
      cells: [
        {
          kind: "dot",
          tone: STATUS_TONE.IN_EXAM,
          text: r.currentSection ? t("today.sectionNow", { section: t(`sectionName.${r.currentSection}`) }) : t("status.IN_EXAM"),
        },
      ],
    }));
  return [...review, ...running];
}
