import { languageExamModule } from "@/solutions/language-exam/module";
import type { SolutionKind, SolutionModule } from "@/solutions/types";

/** Server modules, same order as SOLUTION_MANIFESTS (a test keeps them aligned). */
const MODULES: readonly SolutionModule[] = [languageExamModule];

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
