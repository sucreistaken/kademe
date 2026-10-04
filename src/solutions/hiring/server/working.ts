import { usedCompetencyIds, type CompetencyFacts, type VersionContent } from "../rules/content";
import { publishProblems, type PublishProblem } from "../rules/gate";
import { workingVersions, type VersionSummary } from "../rules/versions";
import { loadCompetencyFacts, loadVersionContent } from "./content";
import { versionsOf } from "./versions";

export type WorkingState = {
  list: VersionSummary[];
  draft: VersionSummary | null;
  live: VersionSummary | null;
  /** The draft when there is one, otherwise the newest published version. */
  content: VersionContent | null;
  facts: Map<string, CompetencyFacts>;
  /** The publish gate on the draft; empty when there is no draft. publishDraft runs it again on the server. */
  problems: PublishProblem[];
};

/** What an opening page shows: its versions, the version being worked on, and the gate on the draft. */
export async function workingState(orgId: string, openingId: string): Promise<WorkingState> {
  const list = await versionsOf(orgId, openingId);
  const { draft, live } = workingVersions(list);
  const shown = draft ?? live;
  const content = shown ? await loadVersionContent(orgId, shown.id) : null;
  const facts = await loadCompetencyFacts(orgId, content ? usedCompetencyIds(content) : []);
  return { list, draft, live, content, facts, problems: draft && content ? publishProblems(content, facts) : [] };
}
