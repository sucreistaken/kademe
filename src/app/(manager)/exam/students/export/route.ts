import type { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { can } from "@/lib/authorize";
import { listStudents } from "@/server/panel";
import { currentUser } from "@/server/session";
import { resultsCsv, resultsFileName } from "./csv";
import { loadIntegrityBriefs } from "@/components/panel/integrity/serious";
import { loadStudentExtras } from "./extras";
import { integrityCells } from "./integrity-columns";
import { filterStudents, parseTab } from "./filter";
import { levelLabel } from "@/lib/exam/level-label";

export const dynamic = "force-dynamic";

/** "2026-10-14 09:58" in the school's zone: sorts as text and Excel reads it as a date. */
const stamp = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(d) : "";

/**
 * The student list as a CSV file, for the list's current filter (tab and
 * search, the same query string the page uses). Taking results out of the
 * product needs "data:export" (the owner), not just the right to see the list,
 * and the export leaves a `students.export` audit row: the filter and the row
 * count, never a student's value.
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user, "data:export")) return Response.json({ error: "forbidden" }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const tab = parseTab(params.get("tab"));
  const q = (params.get("q") ?? "").slice(0, 200);
  const locale = await managerLocale();
  const t = managerT(locale);

  const [all, extras, briefs] = await Promise.all([listStudents(user.orgId), loadStudentExtras(user.orgId), loadIntegrityBriefs(user.orgId)]);
  const rows = filterStudents(all, tab, q, locale);

  const headers = [
    "colName",
    "colEmail",
    "colExam",
    "colStatus",
    "colInvited",
    "colFinished",
    "colOverall",
    "colGrammar",
    "colReading",
    "colListening",
    "colWriting",
    "colSpeaking",
    "colRecommended",
    "colResultState",
  ]
    .map((k) => t(`studentsExport.${k}` as "studentsExport.colName"))
    .concat([t("integrityFlags.colSerious"), t("integrityFlags.colOutcome")]);

  // A0 is written with its name, "A0 (Pre-A1)", like on every other page.
  const level = (l: string | null | undefined) => levelLabel(l, t("resultLevel.A0"));
  const body = rows.map((r) => {
    const x = extras.get(r.assessmentId);
    return [
      r.name,
      r.email,
      r.examName,
      t(`status.${r.status}`),
      stamp(r.invitedAt),
      stamp(r.completedAt),
      level(r.level),
      level(x?.skills.GRAMMAR),
      level(x?.skills.READING),
      level(x?.skills.LISTENING),
      level(x?.skills.WRITING),
      level(x?.skills.SPEAKING),
      x?.recommended,
      r.level ? t(r.levelFinal ? "studentsExport.resultFinal" : "studentsExport.resultDraft") : "",
      ...integrityCells({ integrity: r.integrity, brief: briefs.get(r.assessmentId) }, (o) => t(`integrity.outcome${o}`), t("integrityFlags.outcomeNone")),
    ];
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "students.export",
    subjectType: "organization",
    subjectId: user.orgId,
    meta: { rows: rows.length, format: "csv", tab, ...(q ? { q } : {}) },
  });

  const csv = resultsCsv(headers, body, locale === "en" ? "," : ";");
  const day = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date());
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${resultsFileName(day)}"`,
      "cache-control": "no-store",
    },
  });
}
