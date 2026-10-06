"use client";

import { useState, type MouseEvent } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import type { TemplateCard } from "@/solutions/hiring/server/templates";
import type { TemplateGroup } from "@/solutions/hiring/templates/types";
import { positionIcon } from "./position-icon";

/** A gallery card plus the template's names in both languages, so a position name can preselect it (templateForPosition). */
export type TemplateOption = TemplateCard & { names: string[] };

const GROUPS: ReadonlyArray<{ group: TemplateGroup; title: "groupGeneric" | "groupLanguageSchool" | "groupExtra" }> = [
  { group: "GENERIC", title: "groupGeneric" },
  { group: "LANGUAGE_SCHOOL", title: "groupLanguageSchool" },
  { group: "EXTRA", title: "groupExtra" },
];

/** Mockup 4b shows three competencies per card; the rest are in the template itself. */
const CHIPS = 3;

const previewId = (key: string) => `template-preview-${key}`;

/**
 * Manager mockup 4b ("Hangi şablon?"): the ready templates as one single
 * choice, under their group's heading (an empty group is left out, so any
 * number of templates works). Each card shows its role's tile, name, one line,
 * the stages, questions and minutes, up to three competencies and an outlined
 * "Önizle" that opens a Sheet with every stage's candidate prompts. Previewing
 * never chooses: the button is not the card's input.
 */
export function TemplateGallery({ templates, value, onChange }: { templates: TemplateOption[]; value: string | null; onChange(key: string): void }) {
  const t = useMT("hiringNew");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // The Sheet keeps the last card while it closes, so its content does not vanish mid-animation.
  const previewed = templates.find((x) => x.key === previewKey) ?? null;
  const meta = (x: TemplateOption) => t("templateMeta", { stages: x.stageCount, questions: x.questionCount, minutes: x.minutes });

  const openPreview = (key: string) => (event: MouseEvent<HTMLButtonElement>) => {
    // The button sits inside the card's label: opening the preview never chooses the card.
    event.preventDefault();
    event.stopPropagation();
    setPreviewKey(key);
    setOpen(true);
  };

  return (
    <div className="space-y-8">
      {GROUPS.map(({ group, title }) => {
        const list = templates.filter((x) => x.group === group);
        if (list.length === 0) return null;
        const headingId = `new-opening-template-${group.toLowerCase()}`;
        return (
          <section key={group} className="space-y-3">
            <h2 id={headingId} className="text-[14px] leading-5 font-semibold text-ink-2">
              {t(title)}
            </h2>
            <ChoiceCardGroup
              type="single"
              name="new-opening-template"
              labelledBy={headingId}
              look="panel"
              columns={2}
              value={value ? [value] : []}
              onChange={([v]) => (v ? onChange(v) : undefined)}
              items={list.map((x) => ({
                value: x.key,
                label: x.name,
                marker: positionIcon(x.name),
                description: (
                  <>
                    <span className="block">{x.summary}</span>
                    <span className="tnum mt-1 block text-[13px] leading-5 text-muted">{meta(x)}</span>
                    {x.competencies.length ? (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {x.competencies.slice(0, CHIPS).map((name) => (
                          <span key={name} data-chip="" className="rounded-full bg-canvas px-2 py-0.5 text-[12px] leading-4 text-ink-2 group-has-[:checked]/choice:bg-surface">
                            {name}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      id={previewId(x.key)}
                      onClick={openPreview(x.key)}
                      className="relative z-10 mt-3 inline-flex h-8 items-center gap-1 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {t("preview")}
                      <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
                    </button>
                  </>
                ),
              }))}
            />
          </section>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          // No SheetTrigger: the focus goes back to the card's "Önizle" by hand.
          onCloseAutoFocus={(event) => {
            if (!previewKey) return;
            event.preventDefault();
            document.getElementById(previewId(previewKey))?.focus();
          }}
          className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]"
        >
          {previewed ? (
            <>
              <SheetHeader className="px-6 pt-6 pb-4">
                <SheetTitle className="pr-8 text-[16px] leading-6 font-semibold text-ink">{previewed.name}</SheetTitle>
                <SheetDescription className="tnum text-[13px] leading-5 text-muted">{meta(previewed)}</SheetDescription>
              </SheetHeader>
              <ol className="space-y-6 px-6 pb-8">
                {previewed.stages.map((stage, i) => (
                  <li key={i} className="space-y-2">
                    <h3 className="text-[14px] leading-5 font-semibold text-ink">{stage.name}</h3>
                    <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-[22px] text-ink-2">
                      {stage.prompts.map((prompt, j) => (
                        <li key={j} className="whitespace-pre-line">{prompt}</li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
