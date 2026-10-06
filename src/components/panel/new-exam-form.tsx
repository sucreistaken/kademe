"use client";

import { ClipboardCheck, FilePlus, Gauge, LayoutTemplate, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { createBlueprint } from "@/app/(manager)/exam/exams/actions";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import type { ExamTemplateKey } from "@/lib/exam/templates";

/** One ready template, already in the manager's language. */
export type TemplateCard = { key: ExamTemplateKey; name: string; summary: string; meta: string };

const ICONS: Record<ExamTemplateKey, LucideIcon> = {
  "quick-screen": Gauge,
  placement: LayoutTemplate,
  "level-check": ClipboardCheck,
};

/** The blank start's value in the `template` field: empty means no template. */
const BLANK = "";

/**
 * New exam: the ready templates first (the first one recommended), then the
 * blank start, which alone asks for the mode. The hiring start's panel cards.
 */
export function NewExamForm({ templates }: { templates: TemplateCard[] }) {
  const t = useMT("exams");
  const m = useMT("mode");
  const [start, setStart] = useState<string>(templates[0]?.key ?? BLANK);
  const [mode, setMode] = useState<"PLACEMENT" | "LEVEL_VERIFICATION">("PLACEMENT");
  const chosen = templates.find((x) => x.key === start);

  return (
    <form action={createBlueprint} className="mt-8 flex flex-col gap-6">
      <label className="text-[13.5px] font-medium text-ink">
        {t("nameLabel")}
        <input
          name="name"
          maxLength={120}
          placeholder={chosen ? chosen.name : undefined}
          className="mt-1.5 h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[14.5px]"
        />
      </label>
      <div className="flex flex-col gap-3">
        <span id="new-exam-start-label" className="text-[13.5px] font-medium text-ink">
          {t("startLabel")}
        </span>
        <ChoiceCardGroup
          type="single"
          name="template"
          labelledBy="new-exam-start-label"
          look="panel-lg"
          value={[start]}
          onChange={([v]) => setStart(v ?? BLANK)}
          items={[
            ...templates.map((c, i) => ({
              value: c.key,
              marker: ICONS[c.key],
              // No badge slot on the shared card: the pill rides in the label, as on the hiring start.
              label:
                i === 0 ? (
                  <>
                    {c.name}{" "}
                    <span className="ml-1 inline-block rounded-full bg-accent-soft px-2 align-[2px] text-[12px] leading-5 font-semibold text-accent group-has-[:checked]/choice:bg-surface">
                      {t("recommended")}
                    </span>
                  </>
                ) : (
                  c.name
                ),
              description: (
                <>
                  {c.summary}
                  <span className="mt-1 block text-[13px] text-muted">{c.meta}</span>
                </>
              ),
            })),
            { value: BLANK, marker: FilePlus, label: t("blankTitle"), description: t("blankBody") },
          ]}
        />
      </div>
      {start === BLANK ? (
        <div className="flex flex-col gap-3">
          <span id="new-exam-mode-label" className="text-[13.5px] font-medium text-ink">
            {t("blankModeLabel")}
          </span>
          <ChoiceCardGroup
            type="single"
            name="mode"
            labelledBy="new-exam-mode-label"
            look="panel"
            columns={2}
            value={[mode]}
            onChange={([v]) => setMode(v === "LEVEL_VERIFICATION" ? "LEVEL_VERIFICATION" : "PLACEMENT")}
            items={(["PLACEMENT", "LEVEL_VERIFICATION"] as const).map((x) => ({
              value: x,
              label: m(x),
              description: x === "PLACEMENT" ? t("placementDesc") : t("verificationDesc"),
            }))}
          />
        </div>
      ) : null}
      <button type="submit" className="h-12 rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover">
        {t("create")}
      </button>
    </form>
  );
}
