"use client";

import { useState } from "react";
import { ReviewFrame } from "@/components/advanced/review-frame";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMT } from "@/i18n/manager-client";
import type { ReviewActions } from "@/solutions/types";
import { editedTotal, initialSectionEdits, type SectionEdit } from "./exam-config";
import type { ExamDraft } from "./exam";

/** EXAM review cards (spec 5.4): name, mode, each section's minutes and on/off, total, coverage. */
export function ExamReview({ draftId, summary, draft, actions }: { draftId: string; summary: string; draft: ExamDraft; actions: ReviewActions }) {
  const t = useMT("createExam");
  const sec = useMT("sectionName");
  const mode = useMT("mode");
  const [name, setName] = useState(draft.name);
  const [sections, setSections] = useState<SectionEdit[]>(() => initialSectionEdits(draft.config));
  const update = (i: number, patch: Partial<SectionEdit>) => setSections((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const adaptive = (s: SectionEdit["section"]) => draft.config.sections.find((x) => x.section === s)?.adaptive ?? false;

  return (
    <ReviewFrame
      draftId={draftId}
      summary={summary}
      actions={actions}
      edits={() => ({ name: name.trim(), sections })}
      applyDisabled={!name.trim() || !sections.some((s) => s.enabled)}
    >
      <Card className="space-y-4 p-card">
        <div className="space-y-1">
          <label htmlFor="exam-name" className="text-[13px] text-muted">
            {t("name")}
          </label>
          <Input id="exam-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="text-[14px] text-ink">
          {mode(draft.mode)}
          {draft.claimedLevel ? `, ${mode("claimed", { level: draft.claimedLevel })}` : ""}
        </p>
        <ul className="divide-y divide-line">
          {sections.map((s, i) => (
            <li key={s.section} className="flex items-center gap-3 py-2">
              <input id={`exam-sec-${s.section}`} type="checkbox" checked={s.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
              <label htmlFor={`exam-sec-${s.section}`} className="flex-1 text-[14px] text-ink">
                {sec(s.section)} <span className="text-[12.5px] text-muted">{adaptive(s.section) ? t("adaptive") : t("fixed")}</span>
              </label>
              <Input
                aria-label={t("minutesFor", { section: sec(s.section) })}
                type="number"
                min={1}
                max={180}
                className="w-20"
                value={s.durationMinutes}
                disabled={!s.enabled}
                onChange={(e) => update(i, { durationMinutes: Math.max(1, Math.min(180, Math.round(Number(e.target.value)) || 1)) })}
              />
              <span className="text-[13px] text-muted">{t("min")}</span>
            </li>
          ))}
        </ul>
        <p className="text-[14px] font-medium text-ink">{t("total", { minutes: editedTotal(sections) })}</p>
        {draft.coverageOk ? (
          <p className="text-[13px] text-muted">{t("coverageOk")}</p>
        ) : (
          <div className="text-[13px] text-ink">
            <p>{t("coverageGaps")}</p>
            <ul className="mt-1 list-disc pl-5">
              {draft.gaps.map((g) => (
                <li key={`${g.section}-${g.level}-${g.cTest}`}>
                  {g.cTest ? t("gapCTest", { level: g.level }) : t("gap", { level: g.level, section: sec(g.section), missing: g.missing })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[12.5px] text-muted">{t("coverageRecheck")}</p>
      </Card>
    </ReviewFrame>
  );
}
