import { describe, expect, it } from "vitest";
import Link from "next/link";
import { Inbox } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlRow } from "./control-row";

function find(node: ReactNode, match: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, match));
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  const inner = typeof element.type === "function" && element.type !== Link ? (element.type as (p: unknown) => ReactNode)(element.props) : element.props?.children;
  return [...(match(element) ? [element] : []), ...find(inner, match)];
}

describe("ControlRow (KG1)", () => {
  it("draws a link whose target carries a hash as a plain <a>, so the flow there hears the hash; other links stay Next links", () => {
    const row = ControlRow({ title: "Alım", href: "/hiring/openings/o1", status: "Taslak", next: { label: "Sıradaki: Ekibi ata", href: "/hiring/openings/o1/settings#team-members" } });
    const plain = find(row, (el) => el.type === "a").map((el) => el.props.href);
    const next = find(row, (el) => el.type === Link).map((el) => el.props.href);
    expect(plain).toEqual(["/hiring/openings/o1/settings#team-members"]);
    expect(next).toEqual(["/hiring/openings/o1"]);
  });

  it("has no button at all, and lists attention only when there is some", () => {
    const quiet = renderToStaticMarkup(ControlRow({ title: "Alım", href: "/x", status: "Yayında", next: { label: "Aç", href: "/x" } }));
    expect(quiet).not.toMatch(/<button|data-variant/);
    expect(quiet.match(/<ul/g)).toBeNull();
    const busy = renderToStaticMarkup(ControlRow({ title: "Alım", href: "/x", status: "Yayında", attention: [{ key: "r", icon: Inbox, text: "2 açık talep", note: "Not" }], next: { label: "Taleplere bak", href: "/x/candidates" } }));
    expect(busy).toContain("2 açık talep");
    expect(busy.match(/<ul/g)).toHaveLength(1);
  });
});
