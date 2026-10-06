import Link from "next/link";
import type { ReactNode } from "react";
import { AppliedResult } from "@/components/advanced/applied-result";
import { CreateBox } from "@/components/advanced/create-box";
import { QuestionRound } from "@/components/advanced/question-round";
import { PanelHeader } from "@/components/manager/panel-header";
import { Card } from "@/components/ui/card";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { advancedAreaCards } from "@/server/create/areas";
import { loadOwnDraft, recentDrafts, type CreationDraftRow } from "@/server/create/drafts";
import { requireUser } from "@/server/session";
import { creatorByKind, creatorsFor } from "@/solutions/registry.server";
import type { AdvancedCard } from "@/solutions/types";
import { answerQuestions, applyDraft, discardDraft, reviseDraft, startCreate, startFollowUp } from "./actions";

export const dynamic = "force-dynamic";
/** The server actions on this page run the AI inline (spec 5.5); this covers them (route segment config, maxDuration.md). */
export const maxDuration = 120;

const LINK = "text-[13.5px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

function AreaCard({ card, linkLabel }: { card: AdvancedCard; linkLabel: string }) {
  return (
    <Card className="space-y-1 p-card">
      <h3 className="text-[14.5px] font-semibold text-ink">{card.title}</h3>
      {card.lines.map((line) => (
        <p key={line} className="text-[13px] text-muted">
          {line}
        </p>
      ))}
      <Link href={card.href} className={`inline-block pt-1 ${LINK}`}>
        {linkLabel}
      </Link>
    </Card>
  );
}

/**
 * Advanced (spec 2026-10-06-advanced-ai-create-design 4): the create box, the
 * open draft, "What you have" and the user's recent drafts. A user with no
 * creator capability (a reviewer) sees the area cards only.
 */
export default async function AdvancedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const creators = creatorsFor(user);
  const builder = creators.length > 0;
  const row = builder && typeof sp.draft === "string" ? await loadOwnDraft(user.orgId, user.id, sp.draft) : null;
  const [cards, recent] = await Promise.all([advancedAreaCards(user.orgId, locale), builder ? recentDrafts(user.orgId, user.id) : Promise.resolve([])]);
  const kinds = creators.map((c) => c.label[locale]);
  const kindLabel = (kind: CreationDraftRow["kind"]) => (kind ? (creatorByKind(kind)?.label[locale] ?? kind) : t("advancedCreate.kindUnknown"));

  const failureText = (d: CreationDraftRow): string => {
    switch (d.failure) {
      case "AI_UNAVAILABLE":
        return t("advancedCreate.error_AI_UNAVAILABLE");
      case "RATE_LIMITED":
        return t("advancedCreate.error_RATE_LIMITED");
      case "UNSUPPORTED":
        return t("advancedCreate.unsupported", { kinds: kinds.join(", ") });
      case "STUCK":
        return t("advancedCreate.stuck", { missing: (d.rounds.at(-1)?.questions ?? []).map((q) => q.text).join(" ") });
      default:
        return t("advancedCreate.error_FAILED");
    }
  };

  const currentDraft = async (d: CreationDraftRow): Promise<ReactNode> => {
    switch (d.status) {
      case "ASKING":
        return <QuestionRound draftId={d.id} summary={d.summary ?? ""} questions={d.rounds.at(-1)?.questions ?? []} answerAction={answerQuestions} discardAction={discardDraft} />;
      case "DRAFTED": {
        const creator = creators.find((c) => c.kind === d.kind);
        if (!creator) return null;
        return creator.renderReview({
          ctx: { orgId: user.orgId, userId: user.id, role: user.role, locale, draftId: d.id },
          draft: d.draft,
          summary: d.summary ?? "",
          actions: { apply: applyDraft, discard: discardDraft, revise: reviseDraft },
        });
      }
      case "APPLIED":
        return d.result ? <AppliedResult draftId={d.id} outcome={d.result} locale={locale} followUpAction={startFollowUp} /> : null;
      case "FAILED":
        return (
          <Card className="space-y-2 p-card">
            <p role="status" className="text-[14px] text-ink">
              {failureText(d)}
            </p>
            <p className="text-[13.5px] text-muted">{t("advancedCreate.manualHint")}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {cards.map((c) => (
                <li key={c.key}>
                  <Link href={c.href} className={LINK}>
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        );
      default:
        return null;
    }
  };

  const current = row ? await currentDraft(row) : null;
  // While a draft is open, its own button is the page's one filled button.
  const quiet = row?.status === "ASKING" || row?.status === "DRAFTED" || row?.status === "APPLIED";

  return (
    <main className="mx-auto max-w-[860px] space-y-8 px-6 py-8">
      <PanelHeader title={t("advancedCreate.title")} meta={builder ? t("advancedCreate.lead") : t("advancedCreate.leadReadOnly")} />
      {builder ? (
        <CreateBox key={row?.id ?? "new"} kinds={kinds} initialText={row?.status === "FAILED" ? row.request : ""} primary={!quiet} startAction={startCreate} />
      ) : null}
      {current ? (
        <section aria-labelledby="create-current" className="space-y-3">
          <h2 id="create-current" className="sr-only">
            {t("advancedCreate.currentTitle")}
          </h2>
          {current}
        </section>
      ) : null}
      <section aria-labelledby="create-have" className="space-y-3">
        <h2 id="create-have" className="text-[16px] font-semibold text-ink">
          {t("advancedCreate.haveTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <AreaCard key={card.key} card={card} linkLabel={t("advancedCreate.editManually")} />
          ))}
        </div>
      </section>
      {builder ? (
        <section aria-labelledby="create-recent" className="space-y-3">
          <h2 id="create-recent" className="text-[16px] font-semibold text-ink">
            {t("advancedCreate.recentTitle")}
          </h2>
          {recent.length === 0 ? (
            <p className="text-[13.5px] text-muted">{t("advancedCreate.recentEmpty")}</p>
          ) : (
            <Card className="divide-y divide-line">
              {recent.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px]">
                  <span className="w-24 shrink-0 text-muted">{kindLabel(d.kind)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{d.summary || d.request}</span>
                  <span className="text-muted">{t(`advancedCreate.status_${d.status}`)}</span>
                  {d.status === "ASKING" || d.status === "DRAFTED" ? (
                    <Link href={`/advanced?draft=${d.id}`} className={LINK}>
                      {t("advancedCreate.reopen")}
                    </Link>
                  ) : d.status === "APPLIED" && d.resultHref ? (
                    <Link href={d.resultHref} className={LINK}>
                      {t("advancedCreate.openResult")}
                    </Link>
                  ) : null}
                </div>
              ))}
            </Card>
          )}
        </section>
      ) : null}
    </main>
  );
}
