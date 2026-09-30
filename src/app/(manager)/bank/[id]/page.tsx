import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { makeAudio, savePrompt, setItemStatus } from "@/app/(manager)/bank/actions";
import { Card } from "@/components/ui/card";
import { Dot } from "@/components/panel/bits";
import { keyText } from "@/components/panel/result/format";
import { db } from "@/db";
import { items, stimuli } from "@/db/schema";
import { can } from "@/lib/authorize";
import { validateItem } from "@/lib/exam/validate";
import type { ItemSnapshot } from "@/lib/exam/types";
import { getStorage } from "@/lib/storage";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

/**
 * One bank item: the student's view on the left, the teacher-only facts on
 * the right (key, explanation, difficulty, rubric, the listening script). The
 * one filled button is Approve, and it says why when it cannot be pressed.
 */
export default async function BankItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const t = managerT(await managerLocale());
  const { id } = await params;
  const sp = await searchParams;
  const [row] = await db
    .select({ item: items, stimulus: stimuli })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.id, id), eq(items.orgId, user.orgId)));
  if (!row) notFound();
  const { item, stimulus } = row;
  const problems = validateItem({ type: item.type, prompt: item.prompt, content: item.content, key: item.answerKey, rubric: item.rubric });
  const needsAudio = item.section === "LISTENING" && !stimulus?.audioKey;
  const audioUrl = stimulus?.audioKey ? await getStorage().getSignedUrl(stimulus.audioKey, 3600) : null;
  const snap = { ...item, key: item.answerKey, stimulus: null } as unknown as ItemSnapshot;
  const c = item.content;
  const canApprove = can(user, "bank:approve");
  const canWrite = can(user, "bank:write");
  const blocked = problems.length > 0 ? t("bank.invalid", { errors: problems.join("; ") }) : needsAudio ? t("bank.needsAudio") : null;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <Link href="/bank" className="text-[13px] text-muted hover:text-ink">
        {t("bank.backToBank")}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="text-[22px] font-bold text-ink">
          {t(`sectionName.${item.section}`)} · {item.level} · {t(`bank.type${item.type}`)}
        </h1>
        <Dot tone={item.status === "APPROVED" ? "done" : "neutral"}>{t(`bank.status${item.status}`)}</Dot>
        <span className="text-[12.5px] text-muted">{item.origin === "SEED" ? t("bank.seedLabel") : t(`bank.origin${item.origin}`)}</span>
      </div>
      {sp.error === "tts" ? <p className="mt-2 text-[13px] text-danger">{t("bank.audioFailed", { reason: sp.reason ?? "" })}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="flex flex-col gap-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted">{t("bank.preview")}</div>
          {stimulus ? (
            <Card className="p-5">
              <div className="text-[12px] uppercase tracking-[0.04em] text-muted">{stimulus.title}</div>
              {item.section === "READING" ? (
                <p lang="de" className="mt-2 whitespace-pre-line text-[15px] leading-[1.7] text-ink">
                  {stimulus.body}
                </p>
              ) : audioUrl ? (
                <audio controls src={audioUrl} className="mt-3 w-full" />
              ) : (
                <p className="mt-2 text-[13.5px] text-muted">{t("bank.needsAudio")}</p>
              )}
            </Card>
          ) : null}
          <Card className="p-5">
            <p lang="de" className="whitespace-pre-line text-[16px] font-medium leading-[1.6] text-ink">
              {item.prompt.replace(/\{\{([^}]+)\}\}/g, "[$1]")}
            </p>
            {c.kind === "CHOICE" ? (
              <ol className="mt-3 flex flex-col gap-1.5">
                {c.options.map((o, i) => (
                  <li key={o.id} lang="de" className="rounded-[8px] border border-line px-3 py-2 text-[14px] text-ink-2">
                    {String.fromCharCode(65 + i)}. {o.text}
                  </li>
                ))}
              </ol>
            ) : null}
            {c.kind === "TFNG" ? (
              <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[14px] text-ink-2">
                {c.statements.map((s) => (
                  <li key={s.id} lang="de">
                    {s.text}
                  </li>
                ))}
              </ol>
            ) : null}
            {c.kind === "MATCHING" ? (
              <div className="mt-3 grid grid-cols-2 gap-4 text-[14px] text-ink-2">
                <ol className="list-decimal pl-5">
                  {c.left.map((l) => (
                    <li key={l.id} lang="de">
                      {l.text}
                    </li>
                  ))}
                </ol>
                <ul className="list-disc pl-5">
                  {c.right.map((r) => (
                    <li key={r.id} lang="de">
                      {r.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {c.kind === "GAP" ? (
              <p className="mt-3 text-[13px] text-muted">{c.gaps.map((g) => `[${g.id}] ${g.choices ? g.choices.join(" / ") : "…"}`).join("   ")}</p>
            ) : null}
            {c.kind === "WRITING" ? <p className="mt-3 text-[13px] text-muted">{c.minWords}-{c.maxWords}</p> : null}
            {c.kind === "SPEAKING" ? (
              <p className="tnum mt-3 text-[13px] text-muted">
                {c.thinkSeconds}s / {c.answerSeconds}s · {c.maxTakes}×
              </p>
            ) : null}
          </Card>
          {canWrite ? (
            <details>
              <summary className="cursor-pointer text-[13px] text-ink underline underline-offset-2">{t("bank.editPrompt")}</summary>
              <form action={savePrompt} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="id" value={item.id} />
                <textarea name="prompt" defaultValue={item.prompt} rows={4} lang="de" className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[14px]" />
                <button type="submit" className="h-9 w-fit rounded-[8px] border border-line-strong px-4 text-[13px] font-medium text-ink hover:bg-canvas">
                  {t("bank.savePrompt")}
                </button>
              </form>
            </details>
          ) : null}
        </section>

        <aside className="flex flex-col gap-4 rounded-[14px] bg-vault p-5 text-vault-text">
          <div>
            <div className="text-[11.5px] text-vault-label">{t("bank.key")}</div>
            <p lang="de" className="mt-1 text-[14px]">
              {keyText(snap) || "-"}
            </p>
          </div>
          {item.explanation ? (
            <div>
              <div className="text-[11.5px] text-vault-label">{t("bank.explanation")}</div>
              <p className="mt-1 text-[13.5px]">{item.explanation}</p>
            </div>
          ) : null}
          {item.rubric ? (
            <div>
              <div className="text-[11.5px] text-vault-label">{t("bank.rubric")}</div>
              <ul className="mt-1 list-disc pl-5 text-[13.5px]">
                {item.rubric.contentPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              {item.rubric.register ? <p className="mt-1 text-[12.5px] text-vault-label">{item.rubric.register}</p> : null}
            </div>
          ) : null}
          <div className="tnum grid grid-cols-2 gap-2 text-[12.5px]">
            <div>
              <div className="text-vault-label">{t("bank.difficulty")}</div>
              {item.difficulty.toFixed(2)}
            </div>
            <div>
              <div className="text-vault-label">{t("bank.skill")}</div>
              {item.skillTag}
            </div>
            <div className="col-span-2 text-vault-label">{t("bank.exposure", { n: item.exposureCount })}</div>
          </div>
          {item.section === "LISTENING" && stimulus ? (
            <div>
              <div className="text-[11.5px] text-vault-label">{t("bank.transcript")}</div>
              <p lang="de" className="mt-1 whitespace-pre-line text-[13px] leading-[1.6]">
                {stimulus.body}
              </p>
              {canWrite ? (
                <form action={makeAudio} className="mt-2">
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="h-8 rounded-[6px] border border-vault-line px-3 text-[12.5px] hover:bg-vault-box">
                    {stimulus.audioKey ? t("bank.audioReady") : t("bank.makeAudio")}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex flex-col gap-2 border-t border-vault-line pt-4">
            {item.status !== "APPROVED" && canApprove ? (
              <form action={setItemStatus}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value="APPROVED" />
                <button type="submit" disabled={!!blocked} className="h-10 w-full rounded-[10px] bg-accent text-[14px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-vault-box disabled:text-vault-label">
                  {t("bank.approve")}
                </button>
                {blocked ? <p className="mt-1.5 text-[12px] text-vault-label">{blocked}</p> : null}
              </form>
            ) : null}
            {canWrite ? (
              <div className="flex gap-2">
                {item.status !== "REJECTED" ? (
                  <form action={setItemStatus}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="status" value={item.status === "APPROVED" ? "RETIRED" : "REJECTED"} />
                    <button type="submit" className="h-8 rounded-[6px] border border-vault-line px-3 text-[12.5px] hover:bg-vault-box">
                      {item.status === "APPROVED" ? t("bank.retire") : t("bank.reject")}
                    </button>
                  </form>
                ) : null}
                {item.status !== "DRAFT" ? (
                  <form action={setItemStatus}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="status" value="DRAFT" />
                    <button type="submit" className="h-8 rounded-[6px] border border-vault-line px-3 text-[12.5px] hover:bg-vault-box">
                      {t("bank.restore")}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
