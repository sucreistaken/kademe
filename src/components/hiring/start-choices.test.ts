import { Copy, FilePlus, FileText } from "lucide-react";
import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { startChoices } from "./start-choices";

describe("the start choices (manager mockup 4, less AI)", () => {
  it("lists copy, the job ad and blank in the mockup's order; copy only when there is something to copy", () => {
    expect(startChoices({ hasCopySources: true }).map((c) => c.value)).toEqual(["COPY", "AI", "BLANK"]);
    expect(startChoices({ hasCopySources: false }).map((c) => c.value)).toEqual(["AI", "BLANK"]);
  });

  it("draws plain file icons, never sparkles", () => {
    expect(startChoices({ hasCopySources: true }).map((c) => c.icon)).toEqual([Copy, FileText, FilePlus]);
  });

  it("names the job-ad start without 'AI' and without 'recommended', in both languages", () => {
    for (const locale of ["tr", "en"] as const) {
      const m = managerMessagesFor(locale).hiringNew;
      expect(m.startAi).not.toMatch(/\bAI\b|Önerilen|Recommended/);
      expect(m.startAiBody).not.toMatch(/\bAI\b|Önerilen|Recommended/);
      expect(m.summaryAi).not.toMatch(/\bAI\b/);
    }
  });
});
