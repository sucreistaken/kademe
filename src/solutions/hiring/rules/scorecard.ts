import type { ScorecardSnapshot } from "@/db/schema";
import type { I18nText } from "@/db/schema/types";
import { hasText } from "@/lib/library/anchors";
import { usedCompetencyIds, type CompetencyFacts, type VersionContent } from "./content";
import { defaultWeights, missingWeights } from "./weights";

/**
 * The scorecard copied into a version at publish (hiring solution design 2.3).
 * Scoring screens read anchors and tags from here, never from the library, so
 * a later library edit cannot change what a score meant. A deep copy.
 */
export function buildScorecard(input: {
  content: VersionContent;
  facts: ReadonlyMap<string, CompetencyFacts>;
  scale: ScorecardSnapshot["scale"];
  profile: Array<{ competencyId: string; weight: number }>;
}): ScorecardSnapshot {
  const used = usedCompetencyIds(input.content);
  // Defaults are stored even when weighting is off, so switching it on later starts from the profile.
  const weights = input.content.weightsEnabled ? (input.content.draftWeights ?? {}) : defaultWeights(used, input.profile);
  // The publish gate refuses this first; never write a competency into the snapshot at an invented 0%.
  const unweighted = missingWeights(weights, used);
  if (unweighted.length > 0) throw new Error(`competency ${unweighted.join(", ")} has no weight`);
  const snapshot: ScorecardSnapshot = {
    scale: input.scale,
    competencies: used.map((id) => {
      const f = input.facts.get(id);
      if (!f) throw new Error(`competency ${id} has no library facts`);
      const anchors: Record<number, I18nText> = {};
      for (const [level, body] of Object.entries(f.anchors)) {
        if (body && hasText(body)) anchors[Number(level)] = { tr: body.tr.trim(), en: body.en.trim() };
      }
      return {
        id,
        name: f.name,
        anchors,
        tags: f.tags
          .filter((t) => !t.archived)
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((t) => ({ id: t.id, polarity: t.polarity, label: t.label })),
        weight: weights[id],
      };
    }),
    weightsEnabled: input.content.weightsEnabled,
  };
  return structuredClone(snapshot);
}
