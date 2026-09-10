import Link from "next/link";
import { Card } from "@/components/ui/card";
import { InlineLink } from "@/components/ui/inline-link";
import { FilterForm } from "@/components/manager/filter-form";
import { Button } from "@/components/ui/button";
import { auditStamp } from "@/components/settings/stamp";
import { managerMessagesFor, managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";
import { can } from "@/lib/authorize";
import { requireUser } from "@/server/session";
import {
  AUDIT_EXPORT_LIMIT,
  EMPTY_AUDIT_FILTERS,
  countAuditRows,
  hasSystemAuditRows,
  loadAuditActions,
  loadAuditPage,
  loadPanelUsers,
  summarizeMeta,
  type AuditFilters,
  type AuditRow,
} from "@/server/settings";

/**
 * The audit log, made readable.
 *
 * It exists to answer one question months after the fact: who watched this
 * candidate's recording, and when. So the subject id in every row is itself a
 * filter link, the date range is inclusive on both ends, and nothing here ever
 * deletes or edits a row.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);

  // Not requireUser("audit:read"): a thrown ForbiddenError is a 500 page, and
  // a recruiter who follows a link here deserves a sentence and a way back.
  if (!can(user, "audit:read")) {
    return (
      <main className="mx-auto max-w-[1360px] px-6 py-8">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("audit.title")}</h1>
        <Card className="mt-6 max-w-[560px] px-5 py-6">
          <p className="text-sm font-medium">{t("audit.noAccess.title")}</p>
          <p className="mt-1.5 text-[13px] text-muted">{t("audit.noAccess.hint")}</p>
          <InlineLink href="/settings" className="mt-3 inline-block text-[13px]">
            {t("audit.noAccess.back")}
          </InlineLink>
        </Card>
      </main>
    );
  }

  const params = await searchParams;
  const filters: AuditFilters = {
    actor: single(params.actor),
    action: single(params.action),
    subject: single(params.subject),
    from: single(params.from),
    to: single(params.to),
  };
  const page = Math.max(1, Number(single(params.page)) || 1);

  const [result, totalRows, actions, actors, hasSystem] = await Promise.all([
    loadAuditPage(user.orgId, filters, page),
    countAuditRows(user.orgId),
    loadAuditActions(user.orgId),
    loadPanelUsers(user.orgId),
    hasSystemAuditRows(user.orgId),
  ]);

  const dictionary = managerMessagesFor(locale);
  // One cast, at the edge: an action code is free text in the database, so the
  // lookup has to accept a key the dictionary may not know and fall back to the
  // raw code. A log that hides an event it cannot name is worse than a log that
  // prints "widget.frobnicated".
  const actionLabels = dictionary.audit.actions as Record<string, string>;
  const subjectLabels = dictionary.audit.subjects as Record<string, string>;
  const label = (map: Record<string, string>, code: string) =>
    map[code.replaceAll(".", "_")] ?? code;

  const actorName = (id: string) =>
    id === "system"
      ? t("audit.systemActor")
      : (actors.find((a) => a.id === id)?.name ?? id);

  const active = activeFilters(filters).map((entry) => ({
    ...entry,
    text:
      entry.key === "actor"
        ? `${t("audit.filters.actor")}: ${actorName(filters.actor)}`
        : entry.key === "action"
          ? label(actionLabels, filters.action)
          : entry.key === "subject"
            ? t("audit.filters.subject", { id: shortId(filters.subject) })
            : entry.key === "from"
              ? `${t("audit.filters.from")}: ${filters.from}`
              : `${t("audit.filters.to")}: ${filters.to}`,
  }));

  const sortedActions = [...actions].sort((a, b) =>
    label(actionLabels, a).localeCompare(label(actionLabels, b), locale),
  );

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <InlineLink href="/settings" className="text-[13px]">
        {t("audit.back")}
      </InlineLink>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{t("audit.title")}</h1>
          <p className="mt-1 max-w-[640px] text-sm text-muted">{t("audit.subtitle")}</p>
        </div>
        <div className="text-right text-[13px] text-muted">
          <p className="tnum">
            {active.length > 0
              ? t("audit.countFiltered", { count: result.total, total: totalRows })
              : t("audit.count", { count: totalRows })}
          </p>
          {/* The download carries the filters that are on screen, so a URL that
              answers a question and the file that answers it are the same
              query. With nothing to carry it says so rather than handing over
              an empty file. */}
          {result.total === 0 ? (
            <p className="mt-1 text-ink-3">{t("audit.export.none")}</p>
          ) : (
            <p className="mt-1">
              {/* A plain anchor rather than next/link: the target is a file,
                  and a client side navigation to it downloads nothing. */}
              <a
                href={exportHref(filters)}
                className="font-medium text-ink underline decoration-underline
                           underline-offset-[3px] hover:decoration-ink"
              >
                {t("audit.export.link")}
              </a>
              {result.total > AUDIT_EXPORT_LIMIT && (
                <span className="ml-2 text-ink-3">
                  {t("audit.export.capped", { count: AUDIT_EXPORT_LIMIT })}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-line bg-paper px-6 py-3.5">
          <FilterForm
            action="/settings/audit"
            className="flex flex-wrap items-end gap-x-2.5 gap-y-2"
          >
            {filters.subject && (
              <input type="hidden" name="subject" value={filters.subject} />
            )}
            <Select
              name="actor"
              value={filters.actor}
              label={t("audit.filters.actor")}
            >
              <option value="">{t("audit.filters.allActors")}</option>
              {actors.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
              {hasSystem && <option value="system">{t("audit.filters.system")}</option>}
            </Select>

            <Select
              name="action"
              value={filters.action}
              label={t("audit.filters.action")}
            >
              <option value="">{t("audit.filters.allActions")}</option>
              {sortedActions.map((code) => (
                <option key={code} value={code}>
                  {label(actionLabels, code)}
                </option>
              ))}
            </Select>

            <DateField
              name="from"
              value={filters.from}
              label={t("audit.filters.from")}
            />
            <DateField name="to" value={filters.to} label={t("audit.filters.to")} />

            <Button type="submit" variant="secondary" size="sm">
              {t("audit.filters.apply")}
            </Button>

            {actions.includes("media.view") && filters.action !== "media.view" && (
              <Link
                href={href(filters, { action: "media.view" })}
                className="ml-auto rounded-full border border-line-strong bg-surface px-3.5 py-1.5
                           text-[12.5px] font-medium text-ink-2 hover:border-ink-3"
              >
                {t("audit.filters.mediaViews")}
              </Link>
            )}
          </FilterForm>
        </div>

        {/* An active filter has to be visible while it is still returning rows,
            not only in the zero-result state. A subject filter arrives from a
            link in another row and would otherwise be invisible. */}
        {active.length > 0 && result.rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-2.5">
            {active.map((entry) => (
              <Link
                key={entry.key}
                href={href(filters, { [entry.key]: "" })}
                title={t("audit.filters.remove", { label: entry.text })}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-strong
                           bg-surface px-3 py-1 text-[12.5px] text-ink-2 hover:border-ink-3"
              >
                {entry.text}
                <span aria-hidden>&times;</span>
                <span className="sr-only">
                  {t("audit.filters.remove", { label: entry.text })}
                </span>
              </Link>
            ))}
            {active.length > 1 && (
              <Link
                href="/settings/audit"
                className="text-[12.5px] text-muted underline decoration-underline
                           underline-offset-[3px] hover:text-ink"
              >
                {t("audit.filters.clearAll")}
              </Link>
            )}
          </div>
        )}

        {result.rows.length === 0 ? (
          totalRows === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[15px] font-medium">{t("audit.empty.title")}</p>
              <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] text-muted">
                {t("audit.empty.hint")}
              </p>
              <InlineLink href="/candidates" className="mt-4 inline-block text-[13px]">
                {t("audit.empty.next")}
              </InlineLink>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-[15px] font-medium">{t("audit.zero.title")}</p>
              <p className="mt-1.5 text-[13px] text-muted">
                {t("audit.zero.hint", { count: active.length })}
              </p>
              <div className="mx-auto mt-5 flex max-w-md flex-col items-stretch gap-2">
                {active.map((entry) => (
                  <Link
                    key={entry.key}
                    href={href(filters, { [entry.key]: "" })}
                    className="rounded-[10px] border border-line px-4 py-2.5 text-left text-[13px]
                               hover:bg-canvas"
                  >
                    {t("audit.filters.remove", { label: entry.text })}
                  </Link>
                ))}
                {active.length > 1 && (
                  <Link
                    href="/settings/audit"
                    className="rounded-[10px] border border-line px-4 py-2.5 text-left text-[13px]
                               hover:bg-canvas"
                  >
                    {t("audit.filters.clearAll")}
                  </Link>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className="px-5 py-3 font-medium">{t("audit.columns.time")}</th>
                  <th className="px-5 py-3 font-medium">{t("audit.columns.actor")}</th>
                  <th className="px-5 py-3 font-medium">{t("audit.columns.action")}</th>
                  <th className="px-5 py-3 font-medium">{t("audit.columns.subject")}</th>
                  <th className="px-5 py-3 font-medium">{t("audit.columns.detail")}</th>
                  <th className="px-5 py-3 font-medium">{t("audit.columns.ip")}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    locale={locale}
                    filters={filters}
                    actionLabel={label(actionLabels, row.action)}
                    subjectLabel={label(subjectLabels, row.subjectType)}
                    subjectTitle={t("audit.subjectFilter")}
                    deletedActor={t("audit.deletedActor")}
                    systemActor={t("audit.systemActor")}
                    noIp={t("audit.noIp")}
                    noDetail={t("audit.noDetail")}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
            <PageLink
              href={href(filters, { page: String(result.page - 1) })}
              enabled={result.page > 1}
            >
              {t("audit.prev")}
            </PageLink>
            <span className="tnum text-[13px] text-muted">
              {t("audit.page", { page: result.page, pages: result.pageCount })}
            </span>
            <PageLink
              href={href(filters, { page: String(result.page + 1) })}
              enabled={result.page < result.pageCount}
            >
              {t("audit.next")}
            </PageLink>
          </div>
        )}
      </Card>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Row({
  row,
  locale,
  filters,
  actionLabel,
  subjectLabel,
  subjectTitle,
  deletedActor,
  systemActor,
  noIp,
  noDetail,
}: {
  row: AuditRow;
  locale: Locale;
  filters: AuditFilters;
  actionLabel: string;
  subjectLabel: string;
  subjectTitle: string;
  deletedActor: string;
  systemActor: string;
  noIp: string;
  noDetail: string;
}) {
  const detail = summarizeMeta(row.meta);

  return (
    <tr className="border-b border-line align-top last:border-b-0 hover:bg-canvas/60">
      <td className="tnum px-5 py-3 text-[13px] whitespace-nowrap text-muted">
        {auditStamp(row.at, locale)}
      </td>
      <td className="px-5 py-3 text-[13px]">
        {row.actorName ?? (
          <span className="text-muted">{row.actorId ? deletedActor : systemActor}</span>
        )}
      </td>
      <td className="px-5 py-3 text-[13px]">
        {actionLabel}
        {/* The raw code stays visible: it is what a support request quotes and
            what a new action shows before anyone writes a label for it. */}
        <span className="mt-0.5 block text-[12px] text-ink-3">{row.action}</span>
      </td>
      <td className="px-5 py-3 text-[13px]">
        <span className="block">{subjectLabel}</span>
        {row.subjectId && (
          <Link
            href={href(filters, { subject: row.subjectId, page: "" })}
            title={subjectTitle}
            className="tnum mt-0.5 block text-[12px] text-ink-3 underline decoration-underline
                       underline-offset-[3px] hover:text-ink"
          >
            {shortId(row.subjectId)}
          </Link>
        )}
      </td>
      <td className="max-w-[320px] px-5 py-3 text-[13px] text-muted">
        {detail || <span className="text-ink-3">{noDetail}</span>}
      </td>
      <td className="tnum px-5 py-3 text-[13px] text-muted">
        {row.ip ?? <span className="text-ink-3">{noIp}</span>}
      </td>
    </tr>
  );
}

function PageLink({
  href: target,
  enabled,
  children,
}: {
  href: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  // Nothing to explain on a first or last page, so this is quiet text rather
  // than a disabled control that owes the reader a reason.
  if (!enabled) {
    return <span className="text-[13px] text-ink-3">{children}</span>;
  }
  return (
    <Link
      href={target}
      className="rounded-[8px] border border-line px-3 py-1.5 text-[13px] hover:bg-canvas"
    >
      {children}
    </Link>
  );
}

function Select({
  name,
  value,
  label,
  children,
}: {
  name: string;
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-muted">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="h-9 max-w-[240px] rounded-[10px] border border-line bg-surface px-2.5
                   text-[13px] text-ink"
      >
        {children}
      </select>
    </label>
  );
}

function DateField({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-muted">{label}</span>
      <input
        type="date"
        name={name}
        defaultValue={value}
        className="tnum h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */

const FILTER_KEYS = ["actor", "action", "subject", "from", "to"] as const;

function activeFilters(filters: AuditFilters) {
  return FILTER_KEYS.filter((key) => filters[key] !== "").map((key) => ({ key }));
}

/**
 * Every link on this screen carries the whole filter set, so a URL is a
 * shareable answer rather than a starting point. Changing a filter drops the
 * page number: page 4 of a different result set is somebody else's data.
 */
function href(
  filters: AuditFilters,
  patch: Partial<Record<keyof AuditFilters | "page", string>>,
): string {
  const merged: Record<string, string> = {
    ...EMPTY_AUDIT_FILTERS,
    ...filters,
    page: "",
    ...patch,
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) query.set(key, value);
  }
  const search = query.toString();
  return search ? `/settings/audit?${search}` : "/settings/audit";
}

/**
 * The export URL for exactly the filters on screen. The page number is left
 * out on purpose: a download of page 3 is not what the reader asked for.
 */
function exportHref(filters: AuditFilters): string {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (filters[key]) query.set(key, filters[key]);
  }
  const search = query.toString();
  return search
    ? `/api/settings/audit/export?${search}`
    : "/api/settings/audit/export";
}

/** First segment of a uuid. Enough to recognise a row, short enough to scan. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
