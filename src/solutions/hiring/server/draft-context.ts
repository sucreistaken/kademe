import { activeCompetencyOptions } from "@/server/library";
import { positionProfile } from "./content";

/**
 * The library as the AI sees it: the caller's organisation's active
 * competencies only (never another organisation's), the position's profile
 * first. Names only; nothing else of the library goes into the prompt.
 */
export async function draftLibrary(orgId: string, positionId: string): Promise<Array<{ id: string; name: string; inProfile: boolean }>> {
  const [options, profile] = await Promise.all([activeCompetencyOptions(orgId), positionProfile(orgId, positionId)]);
  const inProfile = new Set(profile.map((p) => p.competencyId));
  const ordered = [...options.filter((o) => inProfile.has(o.id)), ...options.filter((o) => !inProfile.has(o.id))];
  return ordered.map((o) => ({ id: o.id, name: o.name.tr || o.name.en, inProfile: inProfile.has(o.id) }));
}
