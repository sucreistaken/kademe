import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHead } from "@/components/panel/bits";
import { PageTitle } from "./page-title";
import { PanelHeader } from "./panel-header";

// Typed loosely, as in blocks.test.ts: createElement's overloads reject a component with required props here.
const html = (type: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(type as never, props as never));
const words = (markup: string) => markup.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);

describe("PanelHeader (P2)", () => {
  it("draws kicker, title, one meta line, the one filled action and the ⋯ menu", () => {
    const out = html(PanelHeader, {
      kicker: "Alımlar",
      title: "Ürün Tasarımcısı · Ekim",
      meta: "Yayında",
      primary: createElement("button", { id: "go" }, "Aday davet et"),
      menu: { label: "Diğer işlemler", items: [{ label: "Önizle", href: "/x" }] },
    });
    expect(out).toMatch(/<h1[^>]*>Ürün Tasarımcısı · Ekim<\/h1>/);
    expect(out).toContain("Alımlar");
    expect(out).toContain("Yayında");
    expect(out).toContain('id="go"');
    expect(out).toMatch(/<button[^>]*aria-label="Diğer işlemler"/);
    // The ⋯ trigger is never a second filled button (RULES 2): the page's primary keeps that role.
    const trigger = out.match(/<button[^>]*aria-label="Diğer işlemler"[^>]*>/)![0];
    expect(trigger).toContain('data-variant="secondary"');
  });

  it("is what the exam's PageHead and the hiring PageTitle draw, with their words unchanged", () => {
    const head = html(PageHead, { title: "Öğrenciler", sub: "12 öğrenci", action: createElement("a", { href: "/exam/students/new" }, "Öğrenci davet et") });
    expect(head).toBe(html(PanelHeader, { title: "Öğrenciler", meta: "12 öğrenci", primary: createElement("a", { href: "/exam/students/new" }, "Öğrenci davet et") }));
    const title = html(PageTitle, { eyebrow: "Tasarımcı", title: "Alım", sub: "Taslak" });
    expect(title).toBe(html(PanelHeader, { kicker: "Tasarımcı", title: "Alım", meta: "Taslak" }));
  });

  it("gives the exam pages the same words, in the same order, and the same one link, with no menu button", () => {
    const head = html(PageHead, { title: "Öğrenciler", sub: "12 öğrenci", action: createElement("a", { href: "/exam/students/new" }, "Öğrenci davet et") });
    expect(words(head)).toEqual(["Öğrenciler", "12 öğrenci", "Öğrenci davet et"]);
    expect(head.match(/<a [^>]*>/g)).toEqual(['<a href="/exam/students/new">']);
    expect(head).not.toContain("<button");
    // A page without an action (exams/new, bank) draws no empty action box.
    const bare = html(PageHead, { title: "Soru bankası" });
    expect(words(bare)).toEqual(["Soru bankası"]);
    expect(bare.match(/<div/g)).toHaveLength(2);
  });
});
