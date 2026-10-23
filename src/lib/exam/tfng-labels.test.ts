import { describe, expect, it } from "vitest";
import { tfngChoices, tfngLabels } from "./tfng-labels";

describe("tfngLabels", () => {
  it("defaults to Richtig / Falsch / Nicht im Text", () => {
    expect(tfngLabels()).toEqual({ R: "Richtig", F: "Falsch", NG: "Nicht im Text" });
  });
  it("uses Ja / Nein / Text sagt dazu nichts for JA_NEIN", () => {
    expect(tfngLabels("JA_NEIN")).toEqual({ R: "Ja", F: "Nein", NG: "Text sagt dazu nichts" });
  });
  it("keeps the stored values and drops NG for two-way items", () => {
    expect(tfngChoices({ wording: "JA_NEIN" }).map(([v]) => v)).toEqual(["R", "F", "NG"]);
    expect(tfngChoices({ twoWay: true, wording: "JA_NEIN" })).toEqual([["R", "Ja"], ["F", "Nein"]]);
    expect(tfngChoices({ twoWay: true })).toEqual([["R", "Richtig"], ["F", "Falsch"]]);
  });
});
