"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import type { CreateActionResult, CreateQuestion } from "@/solutions/types";
import { Waiting } from "./waiting";

/** Spec 5.2: at most three short questions, choices where there are any, a free answer always. */
export function QuestionRound({
  draftId,
  summary,
  questions,
  answerAction,
  discardAction,
}: {
  draftId: string;
  summary: string;
  questions: CreateQuestion[];
  answerAction: (draftId: string, answers: Record<string, string>) => Promise<CreateActionResult>;
  discardAction: (draftId: string) => Promise<CreateActionResult>;
}) {
  const t = useMT("advancedCreate");
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }));
  const run = (call: () => Promise<CreateActionResult>) => {
    setError(null);
    start(async () => {
      const result = await call();
      if (!result.ok) {
        setError(t(`error_${result.code}`));
        return;
      }
      if (result.href) router.push(result.href);
      else router.refresh();
    });
  };

  if (pending) return <Waiting />;
  return (
    <Card className="space-y-4 p-card">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{t("questionsTitle")}</h2>
        {summary ? <p className="text-[13px] text-muted">{summary}</p> : null}
      </div>
      {questions.map((q) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="text-[14px] text-ink">{q.text}</legend>
          {q.choices.length ? (
            <div className="flex flex-wrap gap-2">
              {q.choices.map((choice) => (
                <Button
                  key={choice}
                  type="button"
                  size="sm"
                  variant={answers[q.id] === choice ? "secondary" : "ghost"}
                  aria-pressed={answers[q.id] === choice}
                  className={answers[q.id] === choice ? "ring-2 ring-ink/15" : undefined}
                  onClick={() => set(q.id, choice)}
                >
                  {choice}
                </Button>
              ))}
            </div>
          ) : null}
          {q.choices.length ? (
            <Input aria-label={t("answerFor", { question: q.text })} value={answers[q.id] ?? ""} maxLength={4000} placeholder={t("answerPlaceholder")} onChange={(e) => set(q.id, e.target.value)} />
          ) : (
            <Textarea aria-label={t("answerFor", { question: q.text })} rows={3} value={answers[q.id] ?? ""} maxLength={4000} placeholder={t("answerPlaceholder")} onChange={(e) => set(q.id, e.target.value)} />
          )}
        </fieldset>
      ))}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={questions.every((q) => !answers[q.id]?.trim())} onClick={() => run(() => answerAction(draftId, answers))}>
          {t("continue")}
        </Button>
        <Button variant="ghost" onClick={() => run(() => discardAction(draftId))}>
          {t("discard")}
        </Button>
      </div>
    </Card>
  );
}
