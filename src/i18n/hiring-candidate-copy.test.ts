import { describe, expect, it } from "vitest";
import tr from "@/i18n/messages/candidate.tr.json";
import en from "@/i18n/messages/candidate.en.json";
import { candidateT } from "@/i18n/candidate";

/**
 * HIRING-UX 6 and A10: the hiring candidate screens speak to the candidate as
 * "sen", calmly, and never use the words of suspicion or failure.
 */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}
const hiringOf = (dict: Record<string, unknown>) => Object.entries(dict).filter(([name]) => name.startsWith("hiring"));

describe("hiring candidate copy", () => {
  it("has hiring namespaces to check", () => {
    expect(hiringOf(tr).length).toBeGreaterThan(0);
  });

  it.each([
    ["tr", tr, [/uyarı/i, /ihlal/i, /şüpheli/i, /hile/i, /başarısız/i]],
    ["en", en, [/warning/i, /violation/i, /suspicious/i, /cheat/i, /\bfail/i]],
  ] as const)("%s never says warning, violation, suspicious, cheat or fail", (_locale, dict, banned) => {
    for (const [name, namespace] of hiringOf(dict as Record<string, unknown>)) {
      for (const text of strings(namespace)) for (const word of banned) expect(text, `${name}: ${text}`).not.toMatch(word);
    }
  });

  it("speaks to the candidate as sen, never siz", () => {
    const formal = [/(?<!\p{L})siz(?!\p{L})/u, /\p{L}+(?:iniz|ınız|unuz|ünüz)(?!\p{L})/u, /lütfen/iu];
    for (const [name, namespace] of hiringOf(tr)) {
      for (const text of strings(namespace)) for (const pattern of formal) expect(text, `${name}: ${text}`).not.toMatch(pattern);
    }
  });

  it("promises only what plan 2 keeps: no automatic rejection, people decide (Task 11 review ruling)", () => {
    expect(tr.hiringLanding.promise).toBe("Hiçbir kayıt seni otomatik olarak elemez; kararı cevaplarına bakan insanlar verir.");
    expect(en.hiringLanding.promise).toBe("Nothing here rejects you automatically; people who look at your answers make the decision.");
  });

  it("names at least n reviewers, or one", () => {
    const t = { tr: candidateT("tr"), en: candidateT("en") };
    expect(t.tr("hiringLanding.whoPeople", { count: 1 })).toBe("Cevaplarını ekipten bir kişi, aynı sorular ve aynı ölçütlerle değerlendirir.");
    expect(t.tr("hiringLanding.whoPeople", { count: 2 })).toBe("Cevaplarını ekipten en az 2 kişi, aynı sorular ve aynı ölçütlerle, birbirinden bağımsız değerlendirir.");
    expect(t.en("hiringLanding.whoPeople", { count: 1 })).toBe("One person on the team reviews your answers, with the same questions and criteria.");
    expect(t.en("hiringLanding.whoPeople", { count: 3 })).toBe("At least 3 people on the team review your answers independently, with the same questions and criteria.");
  });
});
