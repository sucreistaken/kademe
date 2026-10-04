import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Dot, PageHead } from "@/components/panel/bits";
import { GenerateForm } from "@/components/panel/generate-form";
import { db } from "@/db";
import { items, stimuli } from "@/db/schema";
import { can } from "@/lib/authorize";
import { CEFR_LEVELS, SECTIONS, type Section } from "@/lib/exam/types";
import { bankCounts } from "@/server/panel";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const TABS = { pending: "DRAFT", approved: "APPROVED", rejected: "REJECTED" } as const;
const PAGE = 60;

/**
 * The question bank. It opens on what needs a decision (drafts), with the
 * coverage table on top so a gap is visible before an exam trips over it.
 */
export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const t = managerT(await managerLocale());
  const sp = await searchParams;
  const tab = (sp.tab && sp.tab in TABS ? sp.tab : "pending") as keyof typeof TABS;
  const section = SECTIONS.includes(sp.section as Section) ? (sp.section as Section) : null;
  const level = CEFR_LEVELS.includes(sp.level as never) ? (sp.level as (typeof CEFR_LEVELS)[number]) : null;
  const counts = await bankCounts(user.orgId);
  const where = and(
    eq(items.orgId, user.orgId),
    eq(items.status, TABS[tab]),
    section ? eq(items.section, section) : undefined,
    level ? eq(items.level, level) : undefined,
  );
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(items).where(where);
  const rows = await db
    .select({ item: items, title: stimuli.title })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(where)
    .orderBy(desc(items.createdAt), items.orderInStimulus)
    .limit(Number(sp.limit) || PAGE);
  const tabCounts = await db
    .select({ status: items.status, n: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.orgId, user.orgId))
    .groupBy(items.status);
  const q = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { tab, section, level, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/exam/bank?${p}`;
  };

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PageHead title={t("bank.title")} />

      <Card className="mt-6 overflow-x-auto p-5">
        <div className="text-[13px] font-semibold text-ink">{t("bank.coverage")}</div>
        <table className="tnum mt-3 w-full min-w-[640px] text-center text-[13px]">
          <thead>
            <tr className="text-muted">
              <th className="py-1 text-left font-medium" />
              {CEFR_LEVELS.map((l) => (
                <th key={l} className="py-1 font-medium">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((s) => (
              <tr key={s} className="border-t border-line">
                <td className="py-1.5 text-left text-ink-2">{t(`sectionName.${s}`)}</td>
                {CEFR_LEVELS.map((l) => {
                  const c = counts.find((x) => x.section === s && x.level === l);
                  return (
                    <td key={l} className="py-1.5">
                      <Link href={q({ tab: "approved", section: s, level: l })} className={cn("inline-block min-w-8 rounded px-1", c?.items ? "text-ink" : "font-semibold text-danger")}>
                        {c?.items ?? 0}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {can(user, "bank:write") ? (
        <div className="mt-6">
          <GenerateForm />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <nav className="flex gap-1">
          {(Object.keys(TABS) as Array<keyof typeof TABS>).map((k) => (
            <Link
              key={k}
              href={q({ tab: k })}
              className={cn("rounded-[8px] px-3 py-1.5 text-[13.5px]", k === tab ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-canvas hover:text-ink")}
            >
              {t(k === "pending" ? "bank.tabPending" : k === "approved" ? "bank.tabApproved" : "bank.tabRejected")}{" "}
              <span className="tnum">{tabCounts.find((c) => c.status === TABS[k])?.n ?? 0}</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/exam/bank">
          <input type="hidden" name="tab" value={tab} />
          <select name="section" defaultValue={section ?? ""} className="h-9 rounded-[8px] border border-line bg-surface px-2 text-[13px]">
            <option value="">{t("bank.allSections")}</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`sectionName.${s}`)}
              </option>
            ))}
          </select>
          <select name="level" defaultValue={level ?? ""} className="h-9 rounded-[8px] border border-line bg-surface px-2 text-[13px]">
            <option value="">{t("bank.allLevels")}</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-[8px] border border-line px-3 text-[13px] text-ink hover:bg-canvas">
            {t("shared.show")}
          </button>
        </form>
        <span className="tnum ml-auto text-[12.5px] text-muted">{t("bank.rowsOf", { shown: rows.length, total })}</span>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-4 px-6 py-10 text-center">
          <p className="text-[15px] font-medium text-ink">{section || level ? t("bank.emptyFilter") : tab === "pending" ? t("bank.emptyPending") : t("bank.emptyFilter")}</p>
          {tab === "pending" ? <p className="mt-1 text-[13.5px] text-muted">{t("bank.emptyHint")}</p> : null}
        </Card>
      ) : (
        <Card className="mt-4 divide-y divide-line">
          {rows.map(({ item, title }) => (
            <Link key={item.id} href={`/exam/bank/${item.id}`} className="grid grid-cols-1 items-center gap-2 px-5 py-3 hover:bg-canvas md:grid-cols-[3fr_0.8fr_0.5fr_1.2fr_0.9fr]">
              <span lang="de" className="text-[13.5px] text-ink">
                {title ? <span className="block text-[11.5px] text-muted">{title}</span> : null}
                {item.prompt.replace(/\{\{[^}]+\}\}/g, "___").slice(0, 140)}
              </span>
              <span className="text-[13px] text-ink-2">{t(`sectionName.${item.section}`)}</span>
              <span className="tnum text-[13px] font-semibold text-ink">{item.level}</span>
              <span className="text-[12.5px] text-muted">{t(`bank.type${item.type}`)}</span>
              <Dot tone={item.origin === "AI" ? "neutral" : "done"}>{t(`bank.origin${item.origin}`)}</Dot>
            </Link>
          ))}
          {rows.length < total ? (
            <Link href={`${q({})}&limit=${rows.length + PAGE}`} className="block px-5 py-3 text-center text-[13px] text-ink underline underline-offset-2">
              {t("bank.more")}
            </Link>
          ) : null}
        </Card>
      )}
    </main>
  );
}
