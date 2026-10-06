import type { CandidateContext } from "@/lib/candidate-context";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { hiringModule } from "@/solutions/hiring/module";
import { languageExamModule } from "@/solutions/language-exam/module";
import type { Creator, CreatorKind, SolutionKind, SolutionModule } from "@/solutions/types";

/** Server modules, same order as SOLUTION_MANIFESTS (a test keeps them aligned). */
const MODULES: readonly SolutionModule[] = [hiringModule, languageExamModule];

export function solutionModules(): readonly SolutionModule[] {
  return MODULES;
}

export function solutionModule(kind: SolutionKind): SolutionModule | null {
  return MODULES.find((m) => m.dbKind === kind) ?? null;
}

/**
 * The module that answers this solution's candidates, or null. A registered
 * solution whose candidate flow is not live yet is treated exactly like an
 * unregistered one by every core candidate route and page (spec 6: no leak).
 * `modules` exists for tests; production code passes nothing.
 */
export function candidateSolution(
  kind: SolutionKind,
  modules: readonly SolutionModule[] = MODULES,
): SolutionModule | null {
  const found = modules.find((m) => m.dbKind === kind) ?? null;
  return found && found.candidateFlowLive ? found : null;
}

/**
 * The live module that serves this invitation, or null. Null for an unknown
 * or not-live solution and for an invitation the module does not serve (no row
 * of its own). Every core candidate route and page answers null exactly like an
 * unknown token (spec 6). `modules` exists for tests.
 */
export async function servingSolution(
  ctx: CandidateContext,
  modules: readonly SolutionModule[] = MODULES,
): Promise<SolutionModule | null> {
  const found = candidateSolution(ctx.assessment.solution, modules);
  if (!found) return null;
  if (found.candidate.serves && !(await found.candidate.serves(ctx))) return null;
  return found;
}

/** The creators this person may use, in registry order. None: the Advanced page shows no box (spec 4). */
export function creatorsFor(user: Pick<SessionUser, "role">, modules: readonly SolutionModule[] = MODULES): Creator[] {
  return modules.flatMap((m) => m.creators ?? []).filter((c) => can(user, c.capability));
}

/** The creator of a kind, whoever asks; the caller authorises its capability. */
export function creatorByKind(kind: CreatorKind, modules: readonly SolutionModule[] = MODULES): Creator | null {
  return modules.flatMap((m) => m.creators ?? []).find((c) => c.kind === kind) ?? null;
}
