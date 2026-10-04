import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import managerEn from "@/i18n/messages/manager.en.json";
import managerTr from "@/i18n/messages/manager.tr.json";

/**
 * The copied shadcn sidebar names its controls in English ("Toggle Sidebar",
 * "Sidebar", "Displays the mobile sidebar."). The panel shell passes its own
 * labels so screen readers hear the panel's language (RULES.md: user-facing
 * text is Turkish, or English when the user picked it).
 */
describe("panel shell accessible labels", () => {
  it("has the menu labels in both languages", () => {
    expect([managerTr.nav.openMenu, managerTr.nav.menuTitle, managerTr.nav.menuDescription]).toEqual([
      "Menüyü aç",
      "Menü",
      "Panel menüsü",
    ]);
    expect([managerEn.nav.openMenu, managerEn.nav.menuTitle, managerEn.nav.menuDescription]).toEqual([
      "Open menu",
      "Menu",
      "Panel menu",
    ]);
  });

  it("lets the trigger's aria-label replace the English default", () => {
    const html = renderToStaticMarkup(
      createElement(SidebarProvider, null, createElement(SidebarTrigger, { "aria-label": "Menüyü aç" })),
    );
    expect(html).toContain('aria-label="Menüyü aç"');
  });

  it("wires the labels in the layout and the nav", () => {
    const layout = readFileSync(path.resolve(process.cwd(), "src/app/(manager)/layout.tsx"), "utf8");
    expect(layout).toContain('<SidebarTrigger aria-label={t("nav.openMenu")} />');
    expect(layout).toContain('mobileTitle={t("nav.menuTitle")}');
    expect(layout).toContain('mobileDescription={t("nav.menuDescription")}');
    const nav = readFileSync(path.resolve(process.cwd(), "src/components/manager/nav.tsx"), "utf8");
    expect(nav).toContain("<Sidebar mobileTitle={mobileTitle} mobileDescription={mobileDescription}>");
  });
});
