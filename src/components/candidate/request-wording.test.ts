import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { messagesFor } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";
import { linkRequestHint, rightsSentBody } from "./request-wording";

vi.mock("@/lib/client/api", () => ({ apiSend: async () => ({}) }));

import { LinkProblem } from "./LinkProblem";

/** The provider, typed for createElement with its child passed as an argument. */
const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string }) => ReactNode;

const render = (locale: Locale, props: Partial<Parameters<typeof LinkProblem>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(LinkProblem, { token: "t", locale, problem: "EXPIRED", contactEmail: "okul@ornek.test", ...props }),
    ),
  );

describe("the reply wording of a link request and a rights request", () => {
  it("keeps the exam's keys exactly (no noReply): reply hint, named hint, sent hint, rights body", () => {
    expect(linkRequestHint({ sent: false, contactName: null })).toEqual({ namespace: "linkProblem", key: "requestHint" });
    expect(linkRequestHint({ sent: false, contactName: "Okul" })).toEqual({ namespace: "linkProblem", key: "requestHintNamed", name: "Okul" });
    expect(linkRequestHint({ sent: true, contactName: "Okul" })).toEqual({ namespace: "linkProblem", key: "requestSentHint" });
    expect(rightsSentBody(undefined)).toEqual({ namespace: "rights", key: "sentBody" });
  });

  it("gives a solution without reply promise (hiring) its own keys, with the contact or without", () => {
    const email = "deniz@ornek.test";
    expect(linkRequestHint({ sent: false, contactName: "Org", noReply: { email } })).toEqual({ namespace: "hiringRequest", key: "linkHint", email });
    expect(linkRequestHint({ sent: true, contactName: "Org", noReply: { email } })).toEqual({ namespace: "hiringRequest", key: "linkSentHint", email });
    expect(linkRequestHint({ sent: false, contactName: null, noReply: { email: null } })).toEqual({ namespace: "hiringRequest", key: "linkHintPlain" });
    expect(linkRequestHint({ sent: true, contactName: null, noReply: { email: null } })).toEqual({ namespace: "hiringRequest", key: "linkSentHintPlain" });
    expect(rightsSentBody({ email })).toEqual({ namespace: "hiringRequest", key: "rightsSent", email });
    expect(rightsSentBody({ email: null })).toEqual({ namespace: "hiringRequest", key: "rightsSentPlain" });
  });

  it("renders the exam's expired card byte-identical to before (TR and EN)", () => {
    expect(render("tr")).toContain("Talebin işe alım ekibine gider, genelde aynı gün dönülür.");
    expect(render("tr", { contactName: "Örnek Okul" })).toContain("Talebin Örnek Okul adlı yöneticiye gider, genelde aynı gün dönülür.");
    expect(render("en")).toContain("Your request goes to the hiring team, who usually reply the same day.");
  });

  it("renders a hiring expired card without a reply promise, naming the contact (TR and EN)", () => {
    const tr = render("tr", { contactName: "Örnek A.Ş.", noReply: { email: "deniz@ornek.test" } });
    expect(tr).toContain('Talebin işe alım ekibine gider. Acil bir durumda <a href="mailto:deniz@ornek.test"');
    expect(tr).not.toMatch(/dönülür|dönecek|adlı yöneticiye/);
    const en = render("en", { noReply: { email: "deniz@ornek.test" } });
    expect(en).toContain('Your request goes to the hiring team. If it is urgent, write to <a href="mailto:deniz@ornek.test"');
    expect(en).not.toMatch(/reply|replies/);
  });
});
