import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { alternativeStarts } from "./start-choices";

describe("the other ways in (HIRING-UX 5.20)", () => {
  it("lists the ready template, copying and writing your own; copying only when there is something to copy", () => {
    expect(alternativeStarts({ hasCopySources: true }).map((c) => c.value)).toEqual(["TEMPLATE", "COPY", "BLANK"]);
    expect(alternativeStarts({ hasCopySources: false }).map((c) => c.value)).toEqual(["TEMPLATE", "BLANK"]);
  });

  it("names each link by what it does, in both languages, and none is 'recommended'", () => {
    const tr = managerMessagesFor("tr").hiringWizard;
    const en = managerMessagesFor("en").hiringWizard;
    expect(alternativeStarts({ hasCopySources: true }).map((c) => tr[c.label])).toEqual([
      "Hazır bir rol şablonundan başla",
      "Önceki bir alımın sorularını kopyala",
      "Soruları kendim yazacağım",
    ]);
    expect(alternativeStarts({ hasCopySources: true }).map((c) => en[c.label])).toEqual([
      "Start from a ready role template",
      "Copy the questions of an earlier hiring",
      "I'll write the questions myself",
    ]);
    for (const m of [tr, en]) expect(Object.values(m).join(" ")).not.toMatch(/Önerilen|Recommended|Bu rol için hazır/);
  });
});
