import { describe, expect, it } from "vitest";
import managerTr from "@/i18n/messages/manager.tr.json";
import screensTr from "@/i18n/messages/screens.tr.json";

/** K9: the panel's shared screens speak "sen"; exam-only screens keep "siz" until a plan touches them. */
const FORMAL = [/(?<!\p{L})siz(?!\p{L})/u, /\p{L}+(?:iniz|ınız|unuz|ünüz)(?!\p{L})/u, /\p{L}+(?:nizi|nızı|nuzu|nüzü)(?!\p{L})/u, /lütfen/iu, /\p{L}+(?:yiniz|yınız|abilirsiniz|ebilirsiniz)(?!\p{L})/u];
const strings = (value: unknown): string[] => (typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : []);

describe("shared panel copy (K9)", () => {
  it.each([["errorPage", managerTr.errorPage], ["nav", managerTr.nav], ["flow", managerTr.flow], ["today", screensTr.today]] as const)("%s speaks sen", (_name, namespace) => {
    for (const text of strings(namespace)) for (const pattern of FORMAL) expect(text).not.toMatch(pattern);
  });

  it("catches the formal words the error page used before (positive control)", () => {
    const before = ["Rolünüz bunu yapamaz", "Bu ekran ya da işlem için yetkiniz yok.", "Yeniden deneyebilir ya da panele dönebilirsiniz."];
    for (const text of before) expect(FORMAL.some((pattern) => pattern.test(text))).toBe(true);
  });
});
