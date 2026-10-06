import { customerSupport } from "./roles/customer-support";
import type { HiringTemplate } from "./types";

/** Gallery order: generic roles, then language-school roles, then the extra roles. */
export const TEMPLATES: HiringTemplate[] = [customerSupport];

export const templateByKey = (key: string): HiringTemplate | null => TEMPLATES.find((x) => x.key === key) ?? null;

const norm = (s: string) => s.trim().toLocaleLowerCase("tr");
/** A position whose name is a template's name (TR or EN) preselects that template. */
export function matchTemplate(positionName: string): HiringTemplate | null {
  const wanted = norm(positionName);
  if (!wanted) return null;
  return TEMPLATES.find((x) => norm(x.name.tr) === wanted || norm(x.name.en) === wanted) ?? null;
}
