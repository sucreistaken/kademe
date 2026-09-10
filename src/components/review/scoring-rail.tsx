"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { StarRating, type ScaleLevel } from "./star-rating";
import { ObservationChips, type Observation } from "./observation-chips";
import { averageScore } from "@/lib/scoring";
import { score as formatScore } from "@/lib/format";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";

export type RailRevision = {
  at: string;
  score: number | null;
  optionCount: number;
  hasNote: boolean;
  byName: string | null;
};

/**
 * Every piece of bilingual template content reaches this rail already resolved
 * to the reader's language: the rail renders, it does not choose a locale.
 */
export type RailCompetency = {
  id: string;
  name: string;
  description: string | null;
  levels: ScaleLevel[];
  options: Observation[];
  score: number | null;
  selectedOptionIds: string[];
  note: string | null;
  revisions: RailRevision[];
};

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * The sticky rail. Everything here writes immediately: there is no save button,
 * because hunting for one between four stages is exactly the friction that makes
 * managers stop evaluating properly.
 */
export function ScoringRail({
  stageName,
  stageNameLang,
  competencies,
  focusedIndex,
  saveState,
  savedAt,
  expectedBehaviours,
  onScore,
  onToggleOption,
  onNote,
  onFocusCompetency,
  footer,
}: {
  stageName: string;
  stageNameLang: Locale;
  competencies: RailCompetency[];
  focusedIndex: number;
  saveState: SaveState;
  savedAt: string | null;
  expectedBehaviours: Record<string, string[]>;
  onScore: (competencyId: string, score: number | null) => void;
  onToggleOption: (competencyId: string, optionId: string) => void;
  onNote: (competencyId: string, note: string) => void;
  onFocusCompetency: (index: number) => void;
  footer?: React.ReactNode;
}) {
  const t = useMT("rail");
  const shared = useMT("shared");
  const locale = useLocale() as Locale;
  const [expanded, setExpanded] = useState<string | null>(null);
  const average = averageScore(
    competencies.map((c) => ({ competencyId: c.id, score: c.score })),
  );

  return (
    <aside
      className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col rounded-[14px]
                 border border-line bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.07)]"
    >
      <div className="border-b border-line px-5 py-4">
        {/* Upper cased by CSS, and casing follows the element's language. The
            stage name is template content that may not be in the panel's
            language, so it carries its own or "Kıdemli" becomes "KIDEMLI". */}
        <p lang={stageNameLang} className="text-[11.5px] uppercase tracking-wide text-muted">
          {stageName}
        </p>
        <p className="mt-0.5 text-[17px] font-semibold tracking-tight">
          {t("heading")}
        </p>
      </div>

      <div className="flex-1 divide-y divide-line overflow-y-auto">
        {competencies.length === 0 ? (
          <div className="px-5 py-6">
            <p className="text-[13px] text-muted">{t("noCompetencies")}</p>
            <p className="mt-1.5 text-[12.5px] text-muted">{t("noCompetenciesHint")}</p>
          </div>
        ) : (
          competencies.map((competency, index) => {
            const behaviours = expectedBehaviours[competency.id] ?? [];
            const isOpen = expanded === competency.id;
            const focused = index === focusedIndex;

            return (
              <section
                key={competency.id}
                onMouseDown={() => onFocusCompetency(index)}
                className={cn(
                  "px-5 py-4 transition-colors",
                  focused && "bg-canvas/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    id={`comp-${competency.id}`}
                    className="text-[13.5px] font-semibold"
                  >
                    {competency.name}
                  </h3>
                  {behaviours.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : competency.id)}
                      aria-expanded={isOpen}
                      className="shrink-0 text-[12px] text-muted hover:text-ink"
                    >
                      {t("expectedBehaviour")} {isOpen ? "⌃" : "⌄"}
                    </button>
                  ) : null}
                </div>

                {isOpen ? (
                  <ol className="mt-2 space-y-1 rounded-[6px] bg-canvas px-3 py-2.5">
                    {behaviours.map((behaviour, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-[12.5px] leading-snug text-muted"
                      >
                        <span className="tnum">{String(i + 1).padStart(2, "0")}</span>
                        <span>{behaviour}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}

                <div className="mt-2.5">
                  <StarRating
                    value={competency.score}
                    levels={competency.levels}
                    labelledBy={`comp-${competency.id}`}
                    onChange={(score) => onScore(competency.id, score)}
                  />
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-[12px] text-muted">{t("observationTags")}</p>
                  <ObservationChips
                    options={competency.options}
                    selected={competency.selectedOptionIds}
                    onToggle={(optionId) => onToggleOption(competency.id, optionId)}
                  />
                </div>

                <textarea
                  value={competency.note ?? ""}
                  onChange={(e) => onNote(competency.id, e.target.value)}
                  placeholder={t("notePlaceholder")}
                  rows={2}
                  className="mt-3 w-full resize-y rounded-[6px] border border-line bg-surface
                             px-2.5 py-2 text-[12.5px] leading-relaxed outline-none
                             placeholder:text-muted/70 focus:border-muted"
                />
              </section>
            );
          })
        )}
      </div>

      <div className="border-t border-line px-5 py-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] text-muted">{t("stageAverage")}</span>
          <span className="text-[15px] font-semibold tnum">
            {average === null ? shared("notScored") : formatScore(average, locale)}
          </span>
        </div>
        <ChangeHistory competencies={competencies} />
        <p className="mt-1 text-[11.5px] text-muted" aria-live="polite">
          {saveState === "saving"
            ? t("saving")
            : saveState === "error"
              ? t("saveFailed")
              : savedAt
                ? t("savedAt", { time: savedAt })
                : t("autosaveHint")}
        </p>
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </aside>
  );
}

/**
 * What changed and when.
 *
 * Autosave is what makes this screen fast, and it is also what makes a score
 * able to move without anyone noticing. A hiring decision has to be defensible
 * later, so the trail is one click away rather than invisible.
 */
function ChangeHistory({ competencies }: { competencies: RailCompetency[] }) {
  const t = useMT("rail");
  const locale = useLocale();
  const entries = competencies
    .flatMap((competency) =>
      competency.revisions.map((revision) => ({
        ...revision,
        competency: competency.name,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  if (entries.length === 0) return null;

  return (
    <details className="group/history mt-1">
      <summary className="cursor-pointer list-none text-[11.5px] text-muted hover:text-ink">
        <span className="group-open/history:hidden">{t("history")} ⌄</span>
        <span className="hidden group-open/history:inline">{t("history")} ⌃</span>
      </summary>
      <ol className="mt-2 space-y-1.5 border-t border-line pt-2">
        {entries.map((entry, i) => (
          <li key={i} className="flex gap-2 text-[11.5px] leading-snug text-muted">
            <span className="shrink-0 tnum">
              {new Date(entry.at).toLocaleTimeString(
                locale === "tr" ? "tr-TR" : "en-GB",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </span>
            <span>
              {entry.competency}
              {entry.score !== null
                ? ` · ${t("scorePoints", { score: entry.score })}`
                : ` · ${t("scoreCleared")}`}
              {entry.optionCount > 0
                ? ` · ${t("tagCount", { count: entry.optionCount })}`
                : ""}
              {entry.hasNote ? ` · ${t("noteMark")}` : ""}
              {entry.byName ? ` · ${entry.byName}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
