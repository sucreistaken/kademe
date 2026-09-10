import type { NextRequest } from "next/server";
import { managerMessagesFor, managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { CSV_BOM, CSV_EOL, csvFilename, csvRow } from "@/lib/csv";
import { can } from "@/lib/authorize";
import { currentUser } from "@/server/session";
import {
  AUDIT_EXPORT_LIMIT,
  loadAuditExport,
  writeSettingsAudit,
  type AuditFilters,
  type AuditRow,
} from "@/server/settings";

export const dynamic = "force-dynamic";

/** The filter keys the audit screen puts in its query string, in that order. */
const FILTER_KEYS = ["actor", "action", "subject", "from", "to"] as const;

/** How much text is buffered before a chunk is pushed to the client. */
const CHUNK_BYTES = 64 * 1024;

/**
 * The audit log as a CSV file.
 *
 * It answers the request that a paginated screen cannot: "give me every time
 * this candidate's recording was watched". The filters are the screen's own
 * filters, read from the same query string and run through the same loader, so
 * what downloads is what was on screen rather than a second query that agrees
 * with it today and disagrees after the next change.
 *
 * Taking the log out of the product is itself something the log should carry,
 * so the export writes an `audit.export` row of its own: the filters used and
 * how many rows left, never a single exported value.
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    // A route handler answers rather than redirecting: the caller is a download
    // link or a script, and an HTML login page saved as .csv helps nobody.
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Two capabilities, and both are checked even though one role holds both
  // today. "May this person read the log" and "may this person take data out
  // of the product" are different questions, and roles may answer them
  // differently later.
  if (!can(user, "audit:read") || !can(user, "data:export")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filters = readFilters(url.searchParams);

  const locale = await managerLocale();
  const t = managerT(locale);
  const dictionary = managerMessagesFor(locale);
  // Same cast and same fallback as the screen: an action code is free text in
  // the database, so a row whose label nobody has written yet still exports
  // under its raw code rather than under a blank.
  const actionLabels = dictionary.audit.actions as Record<string, string>;
  const subjectLabels = dictionary.audit.subjects as Record<string, string>;
  const label = (map: Record<string, string>, code: string) =>
    map[code.replaceAll(".", "_")] ?? code;

  const { rows, total, truncated } = await loadAuditExport(user.orgId, filters);

  await writeSettingsAudit(
    user,
    "audit.export",
    "organization",
    user.orgId,
    exportMeta(filters, rows.length, truncated),
  );

  const header = [
    t("audit.columns.time"),
    t("audit.columns.actor"),
    t("audit.columns.action"),
    t("audit.export.columns.actionCode"),
    t("audit.columns.subject"),
    t("audit.export.columns.subjectId"),
    t("audit.columns.detail"),
    t("audit.columns.ip"),
  ];

  const cells = (row: AuditRow) => [
    // ISO 8601 in UTC. The screen renders the operator's zone, but a file that
    // outlives the screen has to carry an offset rather than imply one.
    row.at.toISOString(),
    row.actorName ??
      (row.actorId ? t("audit.deletedActor") : t("audit.systemActor")),
    label(actionLabels, row.action),
    row.action,
    label(subjectLabels, row.subjectType),
    row.subjectId ?? "",
    // The whole meta blob, not the screen's one-line summary: the summary keeps
    // three keys and truncates, and a compliance answer needs the rest.
    row.meta ? JSON.stringify(row.meta) : "",
    row.ip ?? "",
  ];

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let buffer = CSV_BOM + csvRow(header) + CSV_EOL;
      for (const row of rows) {
        buffer += csvRow(cells(row)) + CSV_EOL;
        if (buffer.length >= CHUNK_BYTES) {
          controller.enqueue(encoder.encode(buffer));
          buffer = "";
        }
      }
      if (buffer) controller.enqueue(encoder.encode(buffer));
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${csvFilename("kademe-audit", new Date())}"`,
      // The cap is stated in the response rather than left to be inferred from
      // a row count somebody would have to compare by hand.
      "x-audit-rows": String(rows.length),
      "x-audit-total": String(total),
      "x-audit-truncated": truncated ? "1" : "0",
      "x-audit-limit": String(AUDIT_EXPORT_LIMIT),
      "cache-control": "no-store",
    },
  });
}

/* ------------------------------------------------------------------ */

function readFilters(params: URLSearchParams): AuditFilters {
  return {
    actor: params.get("actor") ?? "",
    action: params.get("action") ?? "",
    subject: params.get("subject") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

/**
 * What the audit row records about an export: which filters were asked for and
 * how much left. Never a value out of an exported row, because that would copy
 * the data being exported back into the log that is being exported.
 */
function exportMeta(
  filters: AuditFilters,
  rowCount: number,
  truncated: boolean,
): Record<string, unknown> {
  // Row count first, so the screen's one-line detail column leads with it.
  const meta: Record<string, unknown> = { rows: rowCount, format: "csv" };
  if (truncated) meta.truncated = true;
  for (const key of FILTER_KEYS) {
    if (filters[key]) meta[key] = filters[key];
  }
  return meta;
}
