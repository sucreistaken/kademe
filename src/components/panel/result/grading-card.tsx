import { confirmGrading, overrideGrading } from "@/app/(manager)/exam/students/[id]/actions";
import type { GradingProposal } from "@/lib/exam/grading";
import { CEFR_LEVELS } from "@/lib/exam/types";
import type { managerT } from "@/i18n/manager";

type T = ReturnType<typeof managerT>;
type Grading = {
  id: string;
  status: "PENDING" | "AI_PROPOSED" | "AI_FAILED" | "CONFIRMED" | "OVERRIDDEN";
  aiProposal: GradingProposal | null;
  aiLevel: string | null;
  aiError: string | null;
  finalLevel: string | null;
  reason: string | null;
  decidedBy: string | null;
};

/**
 * The AI's proposal next to the answer, criterion by criterion, with the quotes
 * it rests on. Confirming and changing are both outline buttons: the proposal
 * is a suggestion, not the screen's main action. A change needs a reason.
 */
export function GradingCard({
  grading,
  t,
  tab,
  canGrade,
  nameOf,
}: {
  grading: Grading;
  t: T;
  tab: string;
  canGrade: boolean;
  nameOf: Record<string, string>;
}) {
  const p = grading.aiProposal;
  const decided = grading.status === "CONFIRMED" || grading.status === "OVERRIDDEN";
  const who = grading.decidedBy ? (nameOf[grading.decidedBy] ?? "") : "";
  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
          {decided ? t("source.TEACHER") : t("source.AI")}
        </div>
        <div className="tnum text-[22px] font-bold text-ink">{grading.finalLevel ?? grading.aiLevel ?? "-"}</div>
      </div>
      {decided ? (
        <p className="mt-1 text-[12.5px] text-muted">
          {grading.status === "CONFIRMED" ? t("source.aiConfirmed", { name: who }) : `${t("source.overridden", { name: who })}: ${grading.reason ?? ""}`}
        </p>
      ) : null}

      {grading.status === "PENDING" ? <p className="mt-3 text-[13.5px] text-muted">{t("result.pending")}</p> : null}
      {grading.status === "AI_FAILED" ? (
        <p className="mt-3 text-[13.5px] text-ink-2">{t("result.aiFailed", { reason: grading.aiError ?? "-" })}</p>
      ) : null}

      {p ? (
        <>
          <ul className="mt-4 divide-y divide-line">
            {p.criteria.map((c) => (
              <li key={c.criterion} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-medium text-ink">{t(`result.crit${c.criterion}` as "result.critRANGE")}</span>
                  <span className="tnum text-[13.5px] font-semibold text-ink">{c.assessable ? c.level : "-"}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-[1.55] text-muted">{c.assessable ? c.rationale : t("result.notAssessable")}</p>
                {c.evidence.length ? (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {c.evidence.map((e, i) => (
                      <li key={i} lang="de" className="border-l-2 border-line-strong pl-2 text-[12.5px] italic text-ink-2">
                        {e}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] leading-[1.55] text-ink-2">{p.summary}</p>
          {p.flags.length ? (
            <p className="mt-2 text-[12.5px] text-muted">{p.flags.map((f) => t(`result.flag${f}` as "result.flagEMPTY")).join(" · ")}</p>
          ) : null}
        </>
      ) : null}

      {canGrade && grading.status !== "PENDING" ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          {grading.status === "AI_PROPOSED" ? (
            <form action={confirmGrading}>
              <input type="hidden" name="gradingId" value={grading.id} />
              <input type="hidden" name="tab" value={tab} />
              <button type="submit" className="h-9 w-full rounded-[8px] border border-line-strong bg-surface text-[13.5px] font-medium text-ink hover:bg-canvas">
                {t("result.confirm")} ({grading.aiLevel})
              </button>
            </form>
          ) : null}
          <details>
            <summary className="cursor-pointer text-[13px] font-medium text-ink underline underline-offset-2">{t("result.change")}</summary>
            <form action={overrideGrading} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="gradingId" value={grading.id} />
              <input type="hidden" name="tab" value={tab} />
              <select name="level" required defaultValue="" className="h-9 rounded-[8px] border border-line bg-surface px-2 text-[13.5px]">
                <option value="" disabled>
                  {t("result.pickLevel")}
                </option>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <label className="text-[12.5px] text-muted">
                {t("result.reasonLabel")}
                <textarea name="reason" required minLength={3} rows={2} placeholder={t("result.reasonPlaceholder")} className="mt-1 w-full rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13.5px] text-ink" />
              </label>
              <button type="submit" className="h-9 rounded-[8px] border border-line-strong bg-surface text-[13.5px] font-medium text-ink hover:bg-canvas">
                {t("result.saveLevel")}
              </button>
            </form>
          </details>
        </div>
      ) : null}
    </div>
  );
}
