import { describe, expect, it } from "vitest";
import { textRuleKey } from "./section-rule";
import trMessages from "@/i18n/messages/candidate.tr.json";
import enMessages from "@/i18n/messages/candidate.en.json";

describe("section rule for a text-only grammar section", () => {
  it("names the rule by the kinds of text", () => {
    expect(textRuleKey(["CLOZE"])).toBe("ruleGRAMMARCloze");
    expect(textRuleKey(["WORDBANK"])).toBe("ruleGRAMMARWordBank");
    expect(textRuleKey(["CLOZE", "WORDBANK"])).toBe("ruleGRAMMARTexts");
    expect(textRuleKey(["OPEN"])).toBe("ruleGRAMMAROpen");
    expect(textRuleKey(["CLOZE", "OPEN"])).toBe("ruleGRAMMARTextsMixed");
    expect(textRuleKey(["WORDBANK", "OPEN"])).toBe("ruleGRAMMARTextsMixed");
    expect(textRuleKey(["CTEST"])).toBe("ruleGRAMMARCTest");
    expect(textRuleKey([])).toBe("ruleGRAMMARCTest");
  });

  it("has copy in both languages for every rule, with the same placeholders", () => {
    for (const kinds of [["CLOZE"], ["WORDBANK"], ["CLOZE", "WORDBANK"], ["CTEST"], ["OPEN"], ["CLOZE", "OPEN"]] as const) {
      const key = textRuleKey(kinds);
      const tr = (trMessages.examNav as Record<string, string>)[key];
      const en = (enMessages.examNav as Record<string, string>)[key];
      expect(tr, key).toBeTruthy();
      expect(en, key).toBeTruthy();
      expect(tr).toContain("{n}");
      expect(tr).toContain("{minutes}");
      expect(en).toContain("{n}");
      expect(en).toContain("{minutes}");
    }
  });

  it("tells the student what to do, in the words the owner chose", () => {
    expect(trMessages.examNav.ruleGRAMMARCloze).toContain("Metinlerdeki boşluklara uygun kelimeyi seçin. Bir boşluğa tıklayın, sağda dört seçenek çıkar.");
    expect(trMessages.examNav.ruleGRAMMARWordBank).toContain("Kelimeleri sürükleyerek ya da tıklayarak boşluklara yerleştirin. Bazı kelimeler artar.");
  });

  it("no candidate text asks to type the missing letters any more", () => {
    const all = JSON.stringify([trMessages, enMessages]);
    expect(all).not.toMatch(/eksik harfleri yaz|type only the missing letters|type the missing letters/i);
  });
});
