"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMT } from "@/i18n/manager-client";
import { clockTime } from "@/lib/format";
import { hasText } from "@/lib/library/anchors";
import { currentFindings, mergeFindings, protectedTraitFindings, type CheckedActivity, type Finding } from "@/solutions/hiring/ai/question-check";
import { checkQuestionsAction } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/check-actions";
import type { CheckCode } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/check-result";
import { checkRefusal } from "./check-copy";
import { useBuilderCheck } from "./check-context";

type AiRun = { findings: Finding[]; checked: CheckedActivity[]; at: string };

/**
 * "Soru kontrolü: 1 öneri" (HIRING-UX 3.9, 5.5 bar). The word rule runs on the
 * questions as the editor shows them, with no network call; the AI part runs
 * on request, on the saved questions: what was typed is saved first, and the
 * check says it read the saved text. An AI finding whose words are no longer
 * in its question is dropped, and the bar says the questions changed. Every
 * finding is a suggestion with "Soruya git", which opens the question; nothing
 * here edits it. Text from the model is rendered as text only.
 */
export function QuestionCheck({ openingId, canRun }: { openingId: string; canRun: boolean }) {
  const t = useMT("hiringCheck");
  const g = useMT("hiringGate");
  const builder = useBuilderCheck();
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState<AiRun | null>(null);
  const [problem, setProblem] = useState<CheckCode | "NETWORK" | "UNSAVED" | null>(null);
  const [pending, start] = useTransition();
  /** "Soruya git" moves focus into the editor; the popover must not pull it back to its trigger. */
  const leaving = useRef(false);
  if (!builder) return null;

  const activities = builder.stages.flatMap((s) => s.activities.filter((a) => hasText(a.prompt)).map((a) => ({ id: a.id, prompt: a.prompt })));
  const labels = new Map(builder.stages.flatMap((s, si) => s.activities.map((a, ai) => [a.id, g("activityLabel", { stage: si + 1, n: ai + 1 })] as const)));
  const ai = run ? currentFindings(run.findings, run.checked, activities) : { findings: [], changed: false };
  const findings = mergeFindings(protectedTraitFindings(activities), ai.findings);

  const check = () =>
    start(async () => {
      setProblem(null);
      // Never check stale text silently: the AI reads the saved questions, so what was typed goes first.
      if (!(await builder.saveFirst())) {
        setProblem("UNSAVED");
        return;
      }
      try {
        const result = await checkQuestionsAction(openingId);
        if (result.ok) setRun({ findings: result.findings, checked: result.checked, at: result.at });
        else setProblem(result.code);
      } catch {
        setProblem("NETWORK");
      }
    });

  const goTo = (activityId: string) => {
    leaving.current = true;
    setOpen(false);
    builder.focusActivity(activityId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="tnum">
          {t("count", { count: findings.length })}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        aria-label={t("title")}
        className="max-h-[min(70vh,560px)] w-[min(420px,calc(100vw-32px))] gap-3 overflow-y-auto p-4"
        onCloseAutoFocus={(event) => {
          if (leaving.current) {
            event.preventDefault();
            leaving.current = false;
          }
        }}
      >
        <p className="text-[12px] text-muted">{t("label")}</p>
        {findings.length === 0 ? (
          <p className="text-[13px] text-ink">{t("none")}</p>
        ) : (
          <ul className="space-y-3">
            {findings.map((f, i) => {
              const label = labels.get(f.activityId) ?? "";
              return (
                // Two findings of one kind on one question can come back (C20): the index keeps keys apart.
                <li key={`${f.activityId}:${f.kind}:${i}`} className="space-y-1 border-t border-line pt-3 first:border-t-0 first:pt-0">
                  <p className="text-[13px] font-medium text-ink">
                    {label} · {t(`kind${f.kind}`)} · <span className="font-normal text-muted">{t(`source${f.source}`)}</span>
                  </p>
                  <p className="text-[13px] break-words text-muted">&ldquo;{f.excerpt}&rdquo;</p>
                  {f.note ? <p className="text-[13px] break-words text-ink-2">{f.note}</p> : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 font-medium text-ink underline decoration-line-strong underline-offset-4"
                    aria-label={t("goToLabel", { question: label })}
                    onClick={() => goTo(f.activityId)}
                  >
                    {t("goTo")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="space-y-2 border-t border-line pt-3">
          {canRun ? (
            <Button variant="secondary" size="sm" disabled={pending} aria-busy={pending || undefined} onClick={check}>
              {pending ? t("running") : t("runAi")}
            </Button>
          ) : (
            <p className="text-[13px] text-muted">{t("aiReadOnly")}</p>
          )}
          <div role="status" aria-live="polite" className="space-y-1 text-[13px]">
            {problem ? (
              <p className="font-medium text-ink">{checkRefusal(problem, t)}</p>
            ) : run ? (
              <>
                <p className="tnum text-muted">{t("checkedSaved", { time: clockTime(new Date(run.at)).slice(0, 5) })}</p>
                {ai.changed ? <p className="text-ink">{t("changedSince")}</p> : null}
              </>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
