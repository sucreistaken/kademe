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

import {
  OverviewOnly,
  PUBLISHED_NOTICE_ID,
  PublishFooter,
  PublishLink,
  PublishSwitch,
  SETUP_HEADING_ID,
  hashOnThisPage,
  noticeClosesSummary,
  overviewFocusTarget,
  publishShown,
  summaryClosed,
} from "./publish-view";

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

describe("fix round 1: the summary's history entry (M3) and a refusal closing it (M2)", () => {
  it("opens a #publish link on this page with pushHash, and leaves links elsewhere to the browser", () => {
    const here = { pathname: "/hiring/openings/x" };
    expect(hashOnThisPage("/hiring/openings/x#publish", here)).toBe("#publish");
    expect(hashOnThisPage("#publish", here)).toBe("#publish");
    expect(hashOnThisPage("/hiring/openings/x?skip=team#publish", here)).toBe("#publish");
    expect(hashOnThisPage("/hiring/openings/y#publish", here)).toBeNull();
    expect(hashOnThisPage("/hiring/openings/x", here)).toBeNull();
  });

  it("draws PublishLink as a plain anchor (no JavaScript still opens the summary)", () => {
    const out = at("", createElement(PublishLink, { href: "/hiring/openings/x#publish", className: "c" }, "Yayın özetine bak"));
    expect(out).toBe('<a class="c" href="/hiring/openings/x#publish">Yayın özetine bak</a>');
  });

  it("closes the shown summary when the action's refusal notice arrives", () => {
    expect(noticeClosesSummary("refused", true)).toBe(true);
    expect(noticeClosesSummary(null, true)).toBe(false);
    expect(noticeClosesSummary("refused", false)).toBe(false);
  });
});

describe("B-M2: the focus after a successful 'Yayınla'", () => {
  const el = (id: string) => ({ id, focus: () => undefined });
  it("lands on the setup heading while there is one, else on the published notice (the setup card is gone once live)", () => {
    const page = (ids: string[]) => (id: string) => (ids.includes(id) ? el(id) : null);
    expect(overviewFocusTarget(page([SETUP_HEADING_ID, PUBLISHED_NOTICE_ID]))?.id).toBe(SETUP_HEADING_ID);
    expect(overviewFocusTarget(page([PUBLISHED_NOTICE_ID]))?.id).toBe(PUBLISHED_NOTICE_ID);
    expect(overviewFocusTarget(page([]))).toBeNull();
  });

  it("treats the summary going away as a step back, also when no hash change was heard (a page opened on #publish)", () => {
    expect(summaryClosed(true, false)).toBe(true);
    expect(summaryClosed(false, true)).toBe(false);
    expect(summaryClosed(false, false)).toBe(false);
    expect(summaryClosed(true, true)).toBe(false);
  });
});
