import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { PanelHeader } from "@/components/manager/panel-header";
import { RouteTabs } from "@/components/manager/route-tabs";
import { managerT } from "@/i18n/manager";
import type { OpeningDetail } from "@/solutions/hiring/server/openings";
import { OpeningHeader } from "./opening-header";

/** Ruling C7: a tab joins the opening's tabs with its route (team and rules in plan 1 Task 20, candidates in plan 2 Task 18). */
function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return [...(element.type === type ? [element] : []), ...find(element.props?.children, type)];
}

const opening = { id: "33333333-3333-4333-8333-333333333333", name: "Tasarımcı · Ekim", positionName: "Tasarımcı", status: "OPEN", deadlineAt: null } as unknown as OpeningDetail;

const text = (node: ReactNode): string =>
  !node || typeof node === "boolean"
    ? ""
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : Array.isArray(node)
        ? node.map(text).join("")
        : text((node as ReactElement<{ children?: ReactNode }>).props?.children);

describe("OpeningHeader", () => {
  it("lists overview, candidates, assessment and team and rules, marking the active one", () => {
    const header = OpeningHeader({ opening, active: "settings", locale: "tr", t: managerT("tr") });
    const [tabs] = find(header, RouteTabs);
    const items = tabs.props.items as Array<{ href: string; label: string; active: boolean }>;
    const base = `/hiring/openings/${opening.id}`;
    expect(items).toEqual([
      { href: base, label: "Genel bakış", active: false },
      { href: `${base}/candidates`, label: "Adaylar", active: false },
      { href: `${base}/assessment`, label: "Değerlendirme", active: false },
      { href: `${base}/settings`, label: "Ekip ve kurallar", active: true },
    ]);
  });

  it("hands the header its ⋯ menu under 'Diğer işlemler' (nav.more), and none when the menu is empty", () => {
    const items = [{ label: "Ekip ve kurallar", href: "/x/settings" }];
    const [head] = find(OpeningHeader({ opening, active: "overview", locale: "tr", t: managerT("tr"), menu: items }), PanelHeader);
    expect(head.props.menu).toEqual({ label: "Diğer işlemler", items });
    const [en] = find(OpeningHeader({ opening, active: "overview", locale: "en", t: managerT("en"), menu: items }), PanelHeader);
    expect((en.props.menu as { label: string }).label).toBe("More actions");
    const [none] = find(OpeningHeader({ opening, active: "overview", locale: "tr", t: managerT("tr"), menu: [] }), PanelHeader);
    expect(none.props.menu).toBeUndefined();
  });

  it("draws the setup line under the tabs only when given (4.5), a step with a hash as a plain anchor (W3)", () => {
    const base = `/hiring/openings/${opening.id}`;
    const plain = OpeningHeader({ opening, active: "assessment", locale: "tr", t: managerT("tr") });
    expect(text(plain)).not.toContain("Kurulum");
    const team = OpeningHeader({ opening, active: "assessment", locale: "tr", t: managerT("tr"), setup: { done: 2, total: 5, next: { key: "team", href: `${base}/settings#team-members` } } });
    expect(text(team)).toContain("Kurulum 2 / 5");
    expect(text(team)).toContain("Sıradaki: Ekibi ata");
    const anchors = find(team, "a");
    expect(anchors.map((a) => a.props.href)).toContain(`${base}/settings#team-members`);
    const builder = OpeningHeader({ opening, active: "assessment", locale: "tr", t: managerT("tr"), setup: { done: 0, total: 5, next: { key: "assessment", href: `${base}/assessment/edit` } } });
    expect(find(builder, Link).map((l) => l.props.href)).toContain(`${base}/assessment/edit`);
    expect(text(builder)).toContain("Sıradaki: Değerlendirmeyi kur");
  });
});

