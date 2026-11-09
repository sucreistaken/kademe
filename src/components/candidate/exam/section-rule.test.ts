import { describe, expect, it } from "vitest";
import { belowRuleKey, textRuleKey } from "./section-rule";
import trMessages from "@/i18n/messages/candidate.tr.json";
import enMessages from "@/i18n/messages/candidate.en.json";
import deMessages from "@/i18n/messages/candidate.de.json";
import esMessages from "@/i18n/messages/candidate.es.json";
import arMessages from "@/i18n/messages/candidate.ar.json";

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

  it("only the rules that place the cloze words have a below-the-text wording", () => {
    expect(belowRuleKey("ruleGRAMMARCloze")).toBe("ruleGRAMMARClozeBelow");
    expect(belowRuleKey("ruleGRAMMARTexts")).toBe("ruleGRAMMARTextsBelow");
    for (const key of ["ruleGRAMMARCTest", "ruleGRAMMARWordBank", "ruleGRAMMAROpen", "ruleGRAMMARTextsMixed"] as const) {
      expect(belowRuleKey(key), key).toBeNull();
    }
  });

  it("the below-the-text wording changes only where the words appear, in every candidate language", () => {
    // Where each language puts the four words: the wide layout's words, then the ones for below lg.
    const place = {
      tr: [trMessages, "sağda dört seçenek çıkar", "metnin altında dört seçenek çıkar"],
      en: [enMessages, "four options appear on the right", "four options appear below the text"],
      de: [deMessages, "dann erscheinen rechts vier Optionen", "dann erscheinen unter dem Text vier Optionen"],
      es: [esMessages, "y a la derecha aparecen cuatro opciones", "y debajo del texto aparecen cuatro opciones"],
      ar: [arMessages, "تظهر أربعة خيارات بجانب النص", "تظهر أربعة خيارات أسفل النص"],
    } as const;
    for (const [locale, [m, wide, below]] of Object.entries(place)) {
      const pairs: Array<[string, string]> = [
        [m.examNav.ruleGRAMMARCloze, m.examNav.ruleGRAMMARClozeBelow],
        [m.examNav.ruleGRAMMARTexts, m.examNav.ruleGRAMMARTextsBelow],
      ];
      for (const [wideText, belowText] of pairs) {
        expect(wideText, locale).toContain(wide);
        expect(belowText, locale).toBe(wideText.replace(wide, below));
      }
    }
  });

  it("no candidate text asks to type the missing letters any more", () => {
    const all = JSON.stringify([trMessages, enMessages]);
    expect(all).not.toMatch(/eksik harfleri yaz|type only the missing letters|type the missing letters/i);
  });
});
