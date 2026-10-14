import { describe, expect, it } from "vitest";
import { givenName, inviteMessage, inviteMessages, openingMoment, turkishTimeSuffix, type InviteMessageInput } from "@/lib/invite-message";

const base: InviteMessageInput = {
  fullName: "Ayşe Yılmaz",
  school: "Dilevi Kursu",
  url: "http://localhost:3100/a/abc",
  expiresAt: new Date("2026-10-28T20:59:00Z"), // 23:59 in Istanbul
  minutes: 45,
  locale: "tr",
  timeZone: "Europe/Istanbul",
};

describe("inviteMessage", () => {
  it("fills the agreed template, word for word", () => {
    expect(inviteMessage(base)).toBe(
      "Merhaba Ayşe, Dilevi Kursu için Almanca seviye sınavınız hazır. Sınava bu linkten girebilirsiniz: http://localhost:3100/a/abc . Son giriş tarihi: 28 Ekim 2026 23:59. Sınavı bilgisayardan (Chrome veya Edge) yapmanız gerekiyor, yaklaşık 45 dakika sürer. Sorunuz olursa bu mesaja yanıt verebilirsiniz.",
    );
  });

  it("with an opening time, says so before the last entry", () => {
    const text = inviteMessage({ ...base, notBefore: new Date("2026-10-20T06:30:00Z") });
    expect(text).toContain("http://localhost:3100/a/abc . Sınav 20 Ekim 2026 09:30'da açılacak. Son giriş tarihi: 28 Ekim 2026 23:59.");
  });

  it("shows the school's time, not the server's", () => {
    const utc = inviteMessage({ ...base, timeZone: "UTC" });
    expect(utc).toContain("Son giriş tarihi: 28 Ekim 2026 20:59.");
  });

  it("has no dash that is a long one", () => {
    expect(inviteMessage({ ...base, notBefore: new Date("2026-10-20T06:30:00Z") })).not.toContain(String.fromCharCode(0x2014));
  });

  it("in English follows the same shape", () => {
    const text = inviteMessage({ ...base, locale: "en", notBefore: new Date("2026-10-20T06:30:00Z") });
    expect(text).toContain("Hello Ayşe, your German level exam for Dilevi Kursu is ready.");
    expect(text).toContain("this link: http://localhost:3100/a/abc . The exam opens on 20 October 2026 09:30. Last entry: 28 October 2026 23:59.");
    expect(text).toContain("about 45 minutes");
  });

  it("greets without a name when there is none", () => {
    expect(inviteMessage({ ...base, fullName: "  " }).startsWith("Merhaba, Dilevi Kursu için")).toBe(true);
  });

  it("joins many with a rule between", () => {
    const all = inviteMessages([base, { ...base, fullName: "Can Demir", url: "http://localhost:3100/a/def" }]);
    expect(all.split("\n\n----------\n\n")).toHaveLength(2);
    expect(all).toContain("Merhaba Can,");
  });
});

describe("givenName", () => {
  it("drops the family name, keeps a compound given name", () => {
    expect(givenName("Ayşe Yılmaz")).toBe("Ayşe");
    expect(givenName("Ayşe Nur  Yılmaz")).toBe("Ayşe Nur");
    expect(givenName("Madonna")).toBe("Madonna");
    expect(givenName("")).toBe("");
  });
});

describe("the Turkish suffix after a clock time", () => {
  it.each([
    [0, "da"], // sıfır
    [5, "te"], // beş
    [10, "da"], // on
    [15, "te"], // on beş
    [20, "de"], // yirmi
    [30, "da"], // otuz
    [40, "ta"], // kırk
    [45, "te"], // kırk beş
    [50, "de"], // elli
    [26, "da"], // yirmi altı
    [59, "da"], // elli dokuz
    [53, "te"], // elli üç
  ])("minutes %i -> %s", (m, suffix) => expect(turkishTimeSuffix(m)).toBe(suffix));

  it("openingMoment adds it in Turkish only", () => {
    const at = new Date("2026-10-20T06:45:00Z");
    expect(openingMoment(at, "tr", "Europe/Istanbul")).toBe("20 Ekim 2026 09:45'te");
    expect(openingMoment(at, "en", "Europe/Istanbul")).toBe("20 October 2026 09:45");
  });
});
