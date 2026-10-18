import { describe, expect, it } from "vitest";
import { managerT } from "@/i18n/manager";
import { bankTypeKey } from "./bank-type";

describe("bankTypeKey", () => {
  it("names a cloze and a word bank by their own kind, everything else by its type", () => {
    expect(bankTypeKey({ type: "GAP_FILL", skillTag: "grammar.cloze" })).toBe("bank.textKindCLOZE");
    expect(bankTypeKey({ type: "GAP_FILL", skillTag: "grammar.wordbank" })).toBe("bank.textKindWORDBANK");
    expect(bankTypeKey({ type: "GAP_FILL", skillTag: "grammar.ctest" })).toBe("bank.typeGAP_FILL");
    expect(bankTypeKey({ type: "SINGLE_CHOICE", skillTag: "reading.detail" })).toBe("bank.typeSINGLE_CHOICE");
  });

  it("reads Seçmeli boşluk and Kelime havuzu in the Turkish panel", () => {
    const t = managerT("tr");
    expect(t(bankTypeKey({ type: "GAP_FILL", skillTag: "grammar.cloze" }))).toBe("Seçmeli boşluk");
    expect(t(bankTypeKey({ type: "GAP_FILL", skillTag: "grammar.wordbank" }))).toBe("Kelime havuzu");
  });
});
