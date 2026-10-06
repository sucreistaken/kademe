import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * HIRING-VISUAL-FLOW 4.5, D13: the overview and its publish summary are both
 * drawn on the server and the address's hash picks one. A server render reads
 * the hash through noHash; the tests set the address the page is opened on.
 */
const address = vi.hoisted(() => ({ hash: "", search: "" }));
vi.mock("@/lib/client/hash-step", async (original) => ({ ...(await original<typeof import("@/lib/client/hash-step")>()), noHash: () => address.hash }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(address.search) }));

import { OverviewOnly, PublishFooter, PublishSwitch, publishShown } from "./publish-view";

const labels = { publish: "Yayınla", publishing: "Yayınlanıyor", back: "Genel bakış" };
const at = (hash: string, node: Parameters<typeof renderToStaticMarkup>[0]) => {
  address.hash = hash;
  return renderToStaticMarkup(node);
};

describe("publishShown (D13: #publish is the setup path's last step)", () => {
  it("shows the summary only on #publish and only when the page drew one", () => {
    expect(publishShown("#publish", true)).toBe(true);
    expect(publishShown("#publish", false)).toBe(false);
    expect(publishShown("", true)).toBe(false);
    expect(publishShown("#team-members", true)).toBe(false);
  });
});

describe("PublishSwitch and OverviewOnly", () => {
  const view = (summary: boolean) =>
    createElement(PublishSwitch, { summary: summary ? createElement("p", null, "SUMMARY") : null }, createElement("p", null, "OVERVIEW"));

  it("draws the overview without the hash and the summary on #publish", () => {
    expect(at("", view(true))).toBe("<p>OVERVIEW</p>");
    expect(at("#publish", view(true))).toBe("<p>SUMMARY</p>");
  });

  it("keeps the overview on #publish when there is nothing to publish (a reviewer, a closed opening, no draft)", () => {
    expect(at("#publish", view(false))).toBe("<p>OVERVIEW</p>");
  });

  it("hides the header's filled button while the summary shows, so the screen keeps one filled button (RULES 2)", () => {
    const action = (hasSummary: boolean) => createElement(OverviewOnly, { hasSummary }, createElement("button", null, "Kuruluma devam et"));
    expect(at("", action(true))).toContain("Kuruluma devam et");
    expect(at("#publish", action(true))).toBe("");
    expect(at("#publish", action(false))).toContain("Kuruluma devam et");
  });
});

describe("PublishFooter (W6: the one filled 'Yayınla' at the end)", () => {
  it("sends the summary's form with the filled button and goes back to the overview on the left", () => {
    const out = at("#publish", createElement(PublishFooter, { formId: "publish-form", reason: null, fix: null, labels }));
    expect(out).toMatch(/<button[^>]*id="publish-opening"[^>]*>Yayınla<\/button>/);
    expect(out).not.toMatch(/id="publish-opening"[^>]*disabled=""/);
    expect(out).not.toContain("publish-opening-why");
    expect(out).toMatch(/<button[^>]*>.*Genel bakış<\/button>/);
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
  });

  it("waits with the gate's first problem next to it (aria-describedby) and a 'Düzelt' link under the bar", () => {
    const out = at(
      "#publish",
      createElement(PublishFooter, {
        formId: "publish-form",
        reason: "Aşama 1, soru 1: soru metni boş.",
        fix: { label: "Düzelt", href: "/hiring/openings/x/assessment/edit?activity=a1" },
        labels,
      }),
    );
    expect(out).toMatch(/<button[^>]*id="publish-opening"[^>]*disabled=""[^>]*aria-describedby="publish-opening-why"[^>]*>Yayınla<\/button>/);
    expect(out).toMatch(/id="publish-opening-why"[^>]*>Aşama 1, soru 1: soru metni boş\.</);
    expect(out).toMatch(/<a[^>]*href="\/hiring\/openings\/x\/assessment\/edit\?activity=a1"[^>]*>Düzelt<\/a>/);
  });
});
