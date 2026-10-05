import { extendHiringLinkAction, markRequestAction } from "@/app/(manager)/hiring/openings/[id]/candidates/actions";
import { PendingButton } from "@/components/ui/pending-button";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { ago, shortDate } from "@/lib/format";
import type { CandidateProgress } from "@/solutions/hiring/rules/invitation";
import type { CandidateRequestRow, OpeningCandidateRow } from "@/solutions/hiring/server/invitations";
import { NewLinkButton } from "./new-link-button";

const TONE = { INVITED: "neutral", OPENED: "neutral", IN_PROGRESS: "active", COMPLETED: "done", EXPIRED: "warn" } as const;
const KNOWN_REQUESTS = new Set(["ACCOMMODATION", "NEW_LINK", "ACCESS", "COPY", "DELETE"]);
/** A link that was never used can get seven more days; a started candidate is not stopped by the link's date. */
const EXTENDABLE = new Set<CandidateProgress>(["INVITED", "OPENED", "EXPIRED"]);

type T = ReturnType<typeof managerT>;

/**
 * One open request: what it is, the candidate's words, when. "Tamam" only for
 * the candidate's own requests (Task 6 carry: data rights are not closed here).
 * A plain function, not a component, so the row's markup is one tree.
 */
function requestItem(request: CandidateRequestRow, { openingId, edit, locale, t, now }: { openingId: string; edit: boolean; locale: Locale; t: T; now: Date }) {
  return (
    <li key={`${request.source}-${request.id}`} className="rounded-lg border border-line p-2 text-[13px] leading-5">
      <p className="font-medium text-ink">{KNOWN_REQUESTS.has(request.kind) ? t(`hiringCandidates.request${request.kind as "NEW_LINK"}`) : t("hiringCandidates.requestOther")}</p>
      {request.message ? <p className="mt-0.5 break-words text-ink-2">{request.message}</p> : null}
      <p className="tnum mt-0.5 text-muted">{ago(request.createdAt, locale, now)}</p>
      {request.source === "DATA_RIGHTS" ? (
        <p className="mt-0.5 text-muted">{t("hiringCandidates.rightsNote")}</p>
      ) : edit ? (
        <form action={markRequestAction} className="mt-1.5">
          <input type="hidden" name="openingId" value={openingId} />
          <input type="hidden" name="requestId" value={request.id} />
          <PendingButton size="sm" label={t("hiringCandidates.done")} pendingLabel={t("hiringCandidates.closing")} />
        </form>
      ) : null}
    </li>
  );
}

/**
 * HIRING-UX 5.12: one row per candidate, in invitation order. Someone who runs
 * the opening acts on links and requests; a reader only reads (with blind
 * mode, "Aday 3" instead of a name; listOpeningCandidates leaves identity,
 * extra time and requests out of the query). Never the extra-time percentage
 * (A6). Dates are the organisation's (ORG_TIMEZONE, through shortDate).
 *
 * A CLOSED opening is read-only (`edit` false), with one exception for someone
 * who runs it (`runs`): a candidate who already started may get a new link to
 * finish (Task 7 ruling; newHiringLink decides), and each row says why it has
 * the button or not (Task 18 fix round 1). No extend and no "Tamam" there.
 */
export function CandidateTable({
  rows,
  openingId,
  edit,
  closed = false,
  runs = edit,
  locale,
  t,
  now,
}: {
  rows: OpeningCandidateRow[];
  openingId: string;
  edit: boolean;
  closed?: boolean;
  runs?: boolean;
  locale: Locale;
  t: T;
  now: Date;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">{t("hiringCandidates.colSeq")}</TableHead>
          <TableHead>{t("hiringCandidates.colCandidate")}</TableHead>
          <TableHead>{t("hiringCandidates.colStatus")}</TableHead>
          <TableHead>{t("hiringCandidates.colProgress")}</TableHead>
          <TableHead>{t("hiringCandidates.colLast")}</TableHead>
          <TableHead>{t("hiringCandidates.colLink")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.assessmentId} className="align-top">
            <TableCell className="tnum py-3 align-top text-muted">{row.seq}</TableCell>
            <TableCell className="min-w-[220px] py-3 align-top whitespace-normal">
              <p className="font-medium text-ink">{row.name ?? t("hiringCandidates.masked", { seq: row.seq })}</p>
              {row.email ? <p className="text-[13px] break-all text-muted">{row.email}</p> : null}
              {row.adapted ? <p className="mt-1 text-[13px] text-muted">{t("hiringCandidates.adapted")}</p> : null}
              {row.requests.length ? (
                <ul className="mt-2 max-w-[360px] space-y-2" aria-label={t("hiringCandidates.requestsTitle")}>
                  {row.requests.map((request) => requestItem(request, { openingId, edit, locale, t, now }))}
                </ul>
              ) : null}
            </TableCell>
            <TableCell className="py-3 align-top">
              <StatusDot tone={TONE[row.progress]}>{t(`hiringCandidates.progress${row.progress}`)}</StatusDot>
            </TableCell>
            <TableCell className="tnum py-3 align-top text-[13px] text-ink">{t("hiringCandidates.stages", { done: row.stagesDone, total: row.stageCount })}</TableCell>
            <TableCell className="tnum py-3 align-top text-[13px] text-muted">{row.lastActivityAt ? ago(row.lastActivityAt, locale, now) : "-"}</TableCell>
            <TableCell className="min-w-[200px] py-3 align-top whitespace-normal">
              {row.progress === "COMPLETED" ? (
                <span className="text-[13px] text-muted">{t("hiringCandidates.linkDone")}</span>
              ) : (
                <div className="space-y-2">
                  {row.link ? <p className="tnum text-[13px] text-muted">{t("hiringCandidates.linkUntil", { date: shortDate(row.link.expiresAt, locale) })}</p> : null}
                  {closed && runs ? (
                    row.progress === "IN_PROGRESS" ? (
                      <>
                        <p className="text-[13px] text-ink">{t("hiringCandidates.closedStarted")}</p>
                        <NewLinkButton openingId={openingId} assessmentId={row.assessmentId} started />
                      </>
                    ) : (
                      <p className="text-[13px] text-muted">{t("hiringCandidates.closedNotStarted")}</p>
                    )
                  ) : null}
                  {edit ? (
                    <>
                      <NewLinkButton openingId={openingId} assessmentId={row.assessmentId} started={row.progress === "IN_PROGRESS"} />
                      {row.link && EXTENDABLE.has(row.progress) ? (
                        <form action={extendHiringLinkAction}>
                          <input type="hidden" name="openingId" value={openingId} />
                          <input type="hidden" name="assessmentId" value={row.assessmentId} />
                          <PendingButton size="sm" label={t("hiringCandidates.extend")} pendingLabel={t("hiringCandidates.extending")} />
                        </form>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
