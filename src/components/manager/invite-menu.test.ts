import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InviteUnavailable } from "./invite-menu";

describe("Today's invite button without an invite right", () => {
  it("is disabled and names its reason through aria-describedby (id + -why)", () => {
    const html = renderToStaticMarkup(createElement(InviteUnavailable, { label: "Davet et", reason: "Davet etme yetkin yok." }));
    expect(html).toMatch(/<button[^>]*id="today-invite"[^>]*>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>/);
    expect(html).toMatch(/<button[^>]*aria-describedby="today-invite-why"[^>]*>/);
    expect(html).toMatch(/<p id="today-invite-why"[^>]*>Davet etme yetkin yok\.<\/p>/);
  });
});
