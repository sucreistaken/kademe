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

  it("lists the technical records the flow keeps and promises no retake (C24 ruling)", () => {
    expect(tr.hiringLanding.signalTECHNICAL).toBe(
      "Teknik kayıtlar tutulur: linki ilk açtığında ve onay verdiğinde IP adresin ve tarayıcı bilgin, aşamaları başlattığın ve bitirdiğin zamanlar, sürenin dolup dolmadığı, bağlantı ve yükleme sorunları.",
    );
    expect(en.hiringLanding.signalTECHNICAL).toBe(
      "Technical records are kept: your IP address and browser information when you first open the link and when you consent, when you start and finish each stage, whether time ran out, and connection and upload problems.",
    );
    for (const [, namespace] of [...hiringOf(tr), ...hiringOf(en)]) for (const text of strings(namespace)) expect(text).not.toMatch(/yeniden hak|another go/i);
  });

  it("words a hiring link or rights request without a reply promise, naming the contact (final wave ruling)", () => {
    const t = { tr: candidateT("tr"), en: candidateT("en") };
    expect(tr.hiringRequest.linkSentHint).toBe(
      "Talebin kaydedildi. Ekip yeni bir link gönderirse o linkle kaldığın yerden devam edersin; acil bir durumda <mail>{email}</mail> adresine yaz.",
    );
    expect(en.hiringRequest.linkSentHint).toBe(
      "Your request was saved. If the team sends a new link, you continue from where you left off with it; if it is urgent, write to <mail>{email}</mail>.",
    );
    expect(tr.hiringRequest.rightsSent).toBe("Talebin kaydedildi. Acil bir durumda <mail>{email}</mail> adresine yaz.");
    expect(en.hiringRequest.rightsSent).toBe("Your request was saved. If it is urgent, write to <mail>{email}</mail>.");
    expect(t.tr("hiringRequest.rightsSentPlain")).toBe("Talebin kaydedildi.");
    // Every hiring string, these included: no promise of a reply.
    for (const [name, namespace] of hiringOf(tr)) for (const text of strings(namespace)) expect(text, name).not.toMatch(/aynı gün dönülür|e-posta ile dönecek|dönecek/);
    for (const [name, namespace] of hiringOf(en)) for (const text of strings(namespace)) expect(text, name).not.toMatch(/reply the same day|replies the same day|will reply/i);
  });

  it("says why the flow needs a computer without claiming any monitoring, and offers no e-mail button yet (3.0, K11)", () => {
    expect(tr.hiringGate.title).toBe("Bu değerlendirme bilgisayardan yapılır");
    expect(en.hiringGate.title).toBe("This assessment is done on a computer");
    expect(tr.hiringGate.why).toBe("İşe alım ekibi, değerlendirmenin bilgisayardan yapılmasını istiyor.");
    expect(en.hiringGate.why).toBe("The hiring team asks for this assessment to be done on a computer.");
    for (const text of [...strings(tr.hiringGate), ...strings(en.hiringGate)]) {
      expect(text).not.toMatch(/izlen|tam ekran|sekme|gözetim|monitor|full ?screen|\btabs?\b|proctor/i);
      expect(text).not.toMatch(/e-postama gönder|e-mail me/i);
    }
  });

  it("words the gate's failed report like the frame's, as a statement in English (fix round M5)", () => {
    expect(en.hiringGate.wrongFailed).toBe(en.hiringFrame.reportFailed);
    expect(en.hiringGate.wrongFailed).toMatch(/\.$/);
    expect(tr.hiringGate.wrongFailed).toBe(tr.hiringFrame.reportFailed);
  });

  it("no longer says the assessment can be done on a phone (K2)", () => {
    expect(tr.hiringFrame.faqPhoneA).toBe("Hayır, bu değerlendirme bilgisayardan yapılır. Linki bilgisayarında aç.");
    expect(en.hiringFrame.faqPhoneA).toBe("No, this assessment is done on a computer. Open the link on your computer.");
    expect(tr.hiringLanding.needDevice).toBe("Bilgisayar");
    expect(en.hiringLanding.needDevice).toBe("A computer");
    for (const [, namespace] of [...hiringOf(tr), ...hiringOf(en)]) {
      for (const text of strings(namespace)) expect(text).not.toMatch(/Telefonu dik tut|Hold the phone upright|Telefon ya da bilgisayar|A phone or a computer|örneğin telefonunla|such as your phone/);
    }
  });
});
