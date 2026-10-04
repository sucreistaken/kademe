import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { RouteTabs } from "@/components/manager/route-tabs";
import { managerT } from "@/i18n/manager";
import type { OpeningDetail } from "@/solutions/hiring/server/openings";
import { OpeningHeader } from "./opening-header";

/** Ruling C7 (Task 20): the team and rules tab joins the opening's tabs with its route. */
function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return [...(element.type === type ? [element] : []), ...find(element.props?.children, type)];
}

const opening = { id: "33333333-3333-4333-8333-333333333333", name: "Tasarımcı · Ekim", positionName: "Tasarımcı", status: "OPEN", deadlineAt: null } as unknown as OpeningDetail;

describe("OpeningHeader", () => {
  it("lists overview, assessment and team and rules, marking the active one", () => {
    const header = OpeningHeader({ opening, active: "settings", locale: "tr", t: managerT("tr") });
    const [tabs] = find(header, RouteTabs);
    const items = tabs.props.items as Array<{ href: string; label: string; active: boolean }>;
    const base = `/hiring/openings/${opening.id}`;
    expect(items).toEqual([
      { href: base, label: "Genel bakış", active: false },
      { href: `${base}/assessment`, label: "Değerlendirme", active: false },
      { href: `${base}/settings`, label: "Ekip ve kurallar", active: true },
    ]);
  });
});
