import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import { isChoice, orderedActivities, orderedStages, type VersionContent } from "@/solutions/hiring/rules/content";
import type { VersionSummary } from "@/solutions/hiring/rules/versions";

type T = ReturnType<typeof managerT>;

export type ScorecardPick = { mode: "draft" | "live"; version: VersionSummary; draft: VersionSummary | null; live: VersionSummary | null };

/**
 * Which version the scorecard shows: the draft when there is one, unless
 * `?version=live` asks for the live version beside it (review Important 1:
 * a draft must not hide the card candidates are scored with); the live
 * version when there is no draft. Null when nothing exists yet.
 */
export function pickVersion(state: { draft: VersionSummary | null; live: VersionSummary | null }, param: string | undefined): ScorecardPick | null {
  const { draft, live } = state;
  if (live && (!draft || param === "live")) return { mode: "live", version: live, draft, live };
  if (draft) return { mode: "draft", version: draft, draft, live };
  return null;
}

/**
 * The questions of the version shown. `loaded` is what workingState read (the
 * draft when there is one), so the live view beside a draft loads the live
 * version's own content: its questions can differ from the draft's.
 */
export async function viewContent(
  pick: ScorecardPick,
  loaded: VersionContent,
  load: (versionId: string) => Promise<VersionContent | null>,
): Promise<VersionContent | null> {
  if (pick.mode === "live" && pick.draft) return load(pick.version.id);
  return loaded;
}

export type MatrixColumn = { id: string; label: string; prompt: string; srName: string };

/**
 * The matrix columns (HIRING-UX 5.7): the questions that measure competencies,
 * numbered by their place on screen ("1.3": stage 1, question 3; choice
 * questions keep their number but are the knowledge test, not a column). Each
 * carries its prompt for the visible legend and a full name for a screen reader.
 */
export function matrixOf(content: VersionContent, locale: Locale, t: T) {
  const all = orderedStages(content).flatMap((s, si) =>
    orderedActivities(s).map((a, ai) => {
      const prompt = pickText(a.prompt, locale).trim() || t("hiringScorecard.noPrompt");
      return { a, column: { id: a.id, label: `${si + 1}.${ai + 1}`, prompt, srName: t("hiringScorecard.colQuestionSr", { stage: si + 1, n: ai + 1, prompt }) } };
    }),
  );
  const measuring = all.filter((x) => !isChoice(x.a.type));
  return {
    columns: measuring.map((x) => x.column),
    choiceCount: all.length - measuring.length,
    measuredBy: (competencyId: string) => measuring.filter((x) => x.a.competencyIds.includes(competencyId)).map((x) => x.a.id),
  };
}
