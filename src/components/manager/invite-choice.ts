import type { Locale } from "@/i18n/locale";
import type { Capability } from "@/lib/authorize";
import type { InviteTarget } from "@/solutions/registry";

export type InviteChoice = { kind: "none" } | { kind: "one"; href: string; label: string } | { kind: "many"; items: Array<{ key: string; href: string; label: string }> };

/** One allowed solution: its own button. More: a menu, "Davet et". None: the disabled button with its reason. */
export function inviteChoice(targets: InviteTarget[], allowed: (capability: Capability) => boolean, locale: Locale): InviteChoice {
  const items = targets.filter((t) => allowed(t.capability)).map((t) => ({ key: t.key, href: t.href, label: t.label[locale] }));
  if (items.length === 0) return { kind: "none" };
  if (items.length === 1) return { kind: "one", href: items[0].href, label: items[0].label };
  return { kind: "many", items };
}
