import type { Locale } from "@/i18n/locale";
import { languageExamManifest } from "@/solutions/language-exam/manifest";
import type { SolutionKind, SolutionManifest } from "@/solutions/types";

/**
 * Every registered solution, in menu order (HIRING-UX 4.1: hiring will come
 * before the exam). Client-safe. Adding a solution: one folder, one line here,
 * one line in registry.server.ts, one enum value.
 */
export const SOLUTION_MANIFESTS: readonly SolutionManifest[] = [languageExamManifest];

export function manifestByKind(kind: SolutionKind): SolutionManifest | null {
  return SOLUTION_MANIFESTS.find((m) => m.dbKind === kind) ?? null;
}

export type NavGroupView = {
  key: string;
  /** Null renders the items without a header. */
  label: string | null;
  items: Array<{ href: string; label: string }>;
};

/**
 * The panel menu (HIRING-UX 4.1): Today, one group per solution, Settings.
 * Group headers appear only when more than one solution is registered ("nobody
 * sees the menu of something they do not use"). The Library group joins when
 * its routes exist (sub-project 3).
 */
export function buildNav(locale: Locale, shared: { today: string; settings: string }): NavGroupView[] {
  const several = SOLUTION_MANIFESTS.length > 1;
  return [
    { key: "today", label: null, items: [{ href: "/dashboard", label: shared.today }] },
    ...SOLUTION_MANIFESTS.map((m) => ({
      key: m.key,
      label: several ? m.label[locale] : null,
      items: m.nav.map((n) => ({ href: n.href, label: n.label[locale] })),
    })),
    { key: "settings", label: null, items: [{ href: "/settings", label: shared.settings }] },
  ];
}
