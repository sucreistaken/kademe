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
