import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import tr from "@/i18n/messages/candidate.tr.json";
import { MobileBlock, type MobileNeeds } from "./MobileBlock";

const html = (need?: MobileNeeds) =>
  renderToStaticMarkup(
    // The provider's props type requires children; they come as the third argument.
    createElement(
      NextIntlClientProvider,
      { locale: "tr", messages: tr, timeZone: "Europe/Istanbul" } as never,
      createElement(MobileBlock, { token: "t".repeat(24), need }),
    ),
  );
const v = tr.visual;

describe("the phone screen states this exam's real reasons (desktop only, 2026-10-14)", () => {
  it("a camera-only exam never claims the screen must be shared", () => {
    const out = html({ camera: true, screenShare: false, writing: true });
    expect(out).toContain(v.mobileWhyScreens);
    expect(out).toContain(v.mobileWhyWriting);
    expect(out).not.toContain(v.mobileWhyShare);
    expect(out).not.toContain("ekran paylaşımını desteklemediği");
    // The camera is a step to prepare, not a reason a phone cannot do it.
    expect(out).toContain(v.mobileStepCamera);
  });

  it("names screen sharing only when the exam shares the screen", () => {
    expect(html({ screenShare: true })).toContain(v.mobileWhyShare);
  });

  it("an exam without proctoring or writing still gets one true reason and the way on", () => {
    const out = html();
    expect(out).toContain(v.mobileTitle);
    expect(out).toContain(v.mobileWhyScreens);
    expect(out).not.toContain(v.mobileWhyWriting);
    expect(out).not.toContain(v.mobileWhyShare);
    expect(out).not.toContain(v.mobileStepCamera);
    expect(out).toContain(v.mobileStepOpen);
    expect(out).toContain(tr.check.copyLink);
  });

  it("says nothing has started, so the student is not worried about the clock", () => {
    expect(html()).toContain(v.mobileLead);
    expect(v.mobileLead).toMatch(/süreniz işlemiyor/);
  });
});
