import { describe, expect, it } from "vitest";
import { langHref } from "./lang-href";

describe("the language link keeps the step the candidate is on (Task 5 review fix 2)", () => {
  it("carries the page step's hash, so a switch on Consent stays on Consent", () => {
    expect(langHref("en", "#consent")).toBe("?lang=en#consent");
    expect(langHref("tr", "#consent")).toBe("?lang=tr#consent");
  });

  it("is the plain ?lang= link without a step, and never carries anything but a simple name", () => {
    expect(langHref("en", "")).toBe("?lang=en");
    expect(langHref("en", "#")).toBe("?lang=en");
    expect(langHref("en", "#a b")).toBe("?lang=en");
    expect(langHref("en", '#x"><script>')).toBe("?lang=en");
  });
});
