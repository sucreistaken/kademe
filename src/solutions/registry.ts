import type { Locale } from "@/i18n/locale";
import type { Capability } from "@/lib/authorize";
import { hiringManifest } from "@/solutions/hiring/manifest";
import { languageExamManifest } from "@/solutions/language-exam/manifest";
import type { I18nLabel, NavIcon, SolutionKey, SolutionKind, SolutionManifest } from "@/solutions/types";

/**
 * Every registered solution, in menu order (hiring first, HIRING-UX 4.1). Client-safe. Adding a solution: one folder, one line here,
 * one line in registry.server.ts, one enum value.
 */
export const SOLUTION_MANIFESTS: readonly SolutionManifest[] = [hiringManifest, languageExamManifest];

export function manifestByKind(kind: SolutionKind): SolutionManifest | null {
  return SOLUTION_MANIFESTS.find((m) => m.dbKind === kind) ?? null;
}

export type NavGroupView = {
  key: string;
  /** Null renders the items without a header. */
  label: string | null;
  items: Array<{ href: string; label: string; icon: NavIcon; activeFor?: string[] }>;
};

export type SharedNavLabels = { today: string; settings: string; advanced: string };

/** Advanced stays lit on the pages it leads to: the library and the exam's own editors. */
export const ADVANCED_ACTIVE_FOR = ["/library", "/exam/exams", "/exam/bank"];

/**
 * The panel menu (spec 2026-10-06-advanced-ai-create-design 3): Today, one
 * group per solution, one core "Advanced" item, Settings. Group headers appear
 * only when more than one solution is registered ("nobody sees the menu of
 * something they do not use").
 */
export function buildNav(locale: Locale, shared: SharedNavLabels, manifests: readonly SolutionManifest[] = SOLUTION_MANIFESTS): NavGroupView[] {
  const several = manifests.length > 1;
  return [
    { key: "today", label: null, items: [{ href: "/dashboard", label: shared.today, icon: "sun" }] },
    ...manifests.map((m) => ({
      key: m.key,
      label: several ? m.label[locale] : null,
      items: m.nav.map((n) => ({ href: n.href, label: n.label[locale], icon: n.icon, ...(n.activeFor ? { activeFor: n.activeFor } : {}) })),
    })),
    { key: "advanced", label: null, items: [{ href: "/advanced", label: shared.advanced, icon: "library", activeFor: ADVANCED_ACTIVE_FOR }] },
    { key: "settings", label: null, items: [{ href: "/settings", label: shared.settings, icon: "settings" }] },
  ];
}

export type InviteTarget = { key: SolutionKey; href: string; label: I18nLabel; capability: Capability };

/**
 * Solutions Today can invite for, in menu order, with their own label and the
 * capability that invite needs. Today shows only the ones the user may use.
 */
export function inviteTargets(manifests: readonly SolutionManifest[] = SOLUTION_MANIFESTS): InviteTarget[] {
  return manifests.flatMap((m) => (m.inviteHref ? [{ key: m.key, href: m.inviteHref, label: m.inviteLabel, capability: m.inviteCapability }] : []));
}

/** The language hint for transcribing a solution's recordings; null lets the provider detect it. */
export function transcriptionHintFor(kind: SolutionKind | null, manifests: readonly SolutionManifest[] = SOLUTION_MANIFESTS): string | null {
  if (!kind) return null;
  return manifests.find((m) => m.dbKind === kind)?.transcriptionHint ?? null;
}
