import { Copy, FilePlus, FileText, LayoutTemplate } from "lucide-react";
import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { startChoices } from "./start-choices";

describe("the start choices (manager mockup 4, less AI)", () => {
  it("lists the ready template first, then copy, the job ad and blank; copy only when there is something to copy", () => {
    expect(startChoices({ hasCopySources: true }).map((c) => c.value)).toEqual(["TEMPLATE", "COPY", "AI", "BLANK"]);
    expect(startChoices({ hasCopySources: false }).map((c) => c.value)).toEqual(["TEMPLATE", "AI", "BLANK"]);
  });

  it("draws plain icons, never sparkles", () => {
    expect(startChoices({ hasCopySources: true }).map((c) => c.icon)).toEqual([LayoutTemplate, Copy, FileText, FilePlus]);
  });

  it("gives the 'recommended' badge to the ready template only", () => {
    expect(startChoices({ hasCopySources: true }).map((c) => c.badge ?? null)).toEqual(["recommended", null, null, null]);
  });

  it("names the job-ad start without 'AI' and without 'recommended', in both languages", () => {
    for (const locale of ["tr", "en"] as const) {
      const m = managerMessagesFor(locale).hiringNew;
      expect(m.startAi).not.toMatch(/\bAI\b|Önerilen|Recommended/);
      expect(m.startAiBody).not.toMatch(/\bAI\b|Önerilen|Recommended/);
      expect(m.summaryAi).not.toMatch(/\bAI\b/);
    }
  });

  it("says the ready-template start in both languages", () => {
    const tr = managerMessagesFor("tr").hiringNew;
    const en = managerMessagesFor("en").hiringNew;
    expect([tr.startTemplate, tr.recommended]).toEqual(["Hazır şablondan başla", "Önerilen"]);
    expect([en.startTemplate, en.recommended]).toEqual(["Start from a ready template", "Recommended"]);
  });
});
