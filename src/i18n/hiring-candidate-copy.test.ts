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

  it("lets an unheard microphone through to the trial, in the ruled words (Task 12 review)", () => {
    expect(tr.hiringDevice.trialQuiet).toBe("Sesini duyamadık. Deneme kaydını dinle; kendi sesini duyuyorsan devam edebilirsin.");
    expect(en.hiringDevice.trialQuiet).toMatch(/^We could not hear you\./);
  });

  it("adds the operating system's privacy settings to every desktop fix (Task 12 review)", () => {
    for (const dict of [tr, en]) {
      for (const key of ["fixchrome", "fixfirefox"] as const) {
        expect(dict.hiringDevice[key]).toMatch(/macOS/);
        expect(dict.hiringDevice[key]).toMatch(/Windows/);
      }
      expect(dict.hiringDevice.fixsafariMac).toMatch(/macOS/);
    }
    expect(tr.hiringDevice.fixchrome).toMatch(/Gizlilik ve Güvenlik > Kamera/);
    expect(en.hiringDevice.fixchrome).toMatch(/Privacy & Security > Camera/);
  });

  it("tells the truth about who sees the survey (Task 16 review I1): no name, the average and unnamed comments", () => {
    expect(tr.hiringDone.surveyNote).toBe("Cevabın değerlendirmeni etkilemez. Ekip adını görmez; yalnızca ortalamayı ve isimsiz yorumları görür.");
    expect(en.hiringDone.surveyNote).toBe("Your answer does not affect your assessment. The team never sees your name, only the average and unnamed comments.");
    // The old claim was false (the team sees comments, not only an overall result).
    for (const text of [...strings(tr.hiringDone), ...strings(en.hiringDone)]) expect(text).not.toMatch(/toplu sonuc|toplu sonuç|overall result/i);
  });

  it("says a stage is complete, never that every answer was saved, and the finish names at least n reviewers (Task 16 review M1)", () => {
    const t = { tr: candidateT("tr"), en: candidateT("en") };
    expect(t.tr("hiringDone.saved", { count: 1 })).toBe("Aşaman tamamlandı ve ekibe iletildi.");
    expect(t.tr("hiringDone.saved", { count: 3 })).toBe("3 aşamanın hepsi tamamlandı ve ekibe iletildi.");
    expect(t.en("hiringDone.saved", { count: 3 })).toBe("All 3 stages are complete and sent to the team.");
    expect(t.tr("hiringDone.next", { count: 2 })).toBe("Cevaplarını ekipten en az 2 kişi, birbirinden bağımsız değerlendirecek.");
    expect(t.en("hiringDone.title", { name: "Elif Kaya" })).toBe("Done, thank you, Elif Kaya.");
  });

  it("confirms a problem report without promising a reply, and names the person to write to (final review I1)", () => {
    const t = { tr: candidateT("tr"), en: candidateT("en") };
    for (const ns of ["hiringFrame", "hiringDevice"] as const) {
      expect(t.tr(`${ns}.reportSent`)).toBe("Bildirimin kaydedildi.");
      expect(t.en(`${ns}.reportSent`)).toBe("Your report was saved.");
      expect(tr[ns].reportSentContact).toBe("Bildirimin kaydedildi. Acil bir durumda <mail>{email}</mail> adresine yaz.");
      expect(en[ns].reportSentContact).toBe("Your report was saved. If it is urgent, write to <mail>{email}</mail>.");
    }
    for (const [, namespace] of [...hiringOf(tr), ...hiringOf(en)]) for (const text of strings(namespace)) expect(text).not.toMatch(/aynı gün dönülür|replies the same day/i);
  });
});
