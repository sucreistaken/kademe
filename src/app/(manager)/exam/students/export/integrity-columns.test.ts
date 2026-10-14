import { describe, expect, it } from "vitest";
import { resultsCsv } from "./csv";
import { integrityCells } from "./integrity-columns";

const label = (o: string) => ({ VALID: "Geçerli", RETAKE: "Tekrar sınav", INVALID: "Geçersiz" })[o]!;

describe("integrity CSV columns", () => {
  it("gives the serious count and the decision", () => {
    expect(integrityCells({ integrity: "ATTENTION", brief: { serious: 3, outcome: "RETAKE" } }, label, "Karar yok")).toEqual(["3", "Tekrar sınav"]);
  });
  it("says 'no decision' for a proctored attempt nobody ruled on, and keeps a zero", () => {
    expect(integrityCells({ integrity: "CLEAR", brief: { serious: 0, outcome: null } }, label, "Karar yok")).toEqual(["0", "Karar yok"]);
  });
  it("leaves both cells empty when there is nothing to say", () => {
    expect(integrityCells({ integrity: "NONE", brief: { serious: 0, outcome: null } }, label, "x")).toEqual(["", ""]);
    expect(integrityCells({ integrity: "PENDING", brief: undefined }, label, "x")).toEqual(["", ""]);
  });
  it("lands as two extra cells in the file", () => {
    const csv = resultsCsv(["a", "ciddi işaret", "bütünlük kararı"], [["x", ...integrityCells({ integrity: "REVIEW", brief: { serious: 2, outcome: "VALID" } }, label, "-")]], ";");
    expect(csv.split("\r\n")[1]).toBe("x;2;Geçerli");
  });
});
