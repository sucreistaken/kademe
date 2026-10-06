"use client";

import { useState } from "react";
import { ReviewFrame } from "@/components/advanced/review-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMT } from "@/i18n/manager-client";
import type { ReviewActions } from "@/solutions/types";
import type { ReviewItem } from "./item-preview";

type Choice = "approve" | "reject";

/**
 * QUESTION_SET review (spec 5.4): each new item with "Onayla" / "Reddet" and
 * "Hepsini onayla". The only filled button on the page stays the frame's.
 */
export function QuestionSetReview({
  draftId,
  summary,
  items,
  droppedByCheck,
  failedBatches,
  mayApprove,
  actions,
}: {
  draftId: string;
  summary: string;
  items: ReviewItem[];
  droppedByCheck: number;
  failedBatches: number;
  mayApprove: boolean;
  actions: ReviewActions;
}) {
  const t = useMT("createQuestions");
  const sec = useMT("sectionName");
  const open = items.filter((i) => i.status === "DRAFT");
  const all = (c: Choice) => Object.fromEntries(open.map((i) => [i.id, c])) as Record<string, Choice>;
  const [choice, setChoice] = useState<Record<string, Choice>>(() => all("approve"));
  const ids = (c: Choice) => open.filter((i) => choice[i.id] === c).map((i) => i.id);

  return (
    <ReviewFrame
      draftId={draftId}
      summary={summary}
      actions={actions}
      edits={() => ({ approve: ids("approve"), reject: ids("reject") })}
      applyLabel={t("save")}
      applyDisabled={open.length === 0}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[14px] text-ink">{t("itemCount", { count: open.length })}</p>
          <Button size="sm" onClick={() => setChoice(all("approve"))}>
            {t("approveAll")}
          </Button>
        </div>
        {!mayApprove ? <p className="text-[13px] text-muted">{t("noApprove")}</p> : null}
        {droppedByCheck > 0 ? <p className="text-[13px] text-muted">{t("dropped", { count: droppedByCheck })}</p> : null}
        {failedBatches > 0 ? <p className="text-[13px] text-muted">{t("failedBatches", { count: failedBatches })}</p> : null}
        {open.map((item, n) => (
          <Card key={item.id} className="space-y-2 p-card">
            <p className="text-[12.5px] text-muted">
              {n + 1}. {sec(item.section)} {item.level}
            </p>
            {item.stimulusTitle ? (
              <details className="text-[13px] text-ink-2">
                <summary className="cursor-pointer">{item.stimulusTitle}</summary>
                <p className="mt-1 whitespace-pre-line">{item.stimulusBody}</p>
              </details>
            ) : null}
            {item.section === "LISTENING" && !item.hasAudio ? <p className="text-[12.5px] text-muted">{t("audioAfterApproval")}</p> : null}
            <p className="whitespace-pre-line text-[14px] text-ink">{item.prompt}</p>
            {item.preview.lines.length ? (
              <ul className="space-y-0.5 text-[13.5px]">
                {item.preview.lines.map((line, i) => (
                  <li key={i} className={line.correct ? "font-medium text-ink" : "text-ink-2"}>
                    {line.text}
                    {line.correct ? ` (${t("correct")})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2" role="group" aria-label={t("decide")}>
              {(["approve", "reject"] as const).map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={choice[item.id] === c ? "secondary" : "ghost"}
                  aria-pressed={choice[item.id] === c}
                  className={choice[item.id] === c ? "ring-2 ring-ink/15" : undefined}
                  onClick={() => setChoice((prev) => ({ ...prev, [item.id]: c }))}
                >
                  {t(c)}
                </Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </ReviewFrame>
  );
}
