import { describe, expect, it } from "vitest";
import screensTr from "@/i18n/messages/screens.tr.json";
import screensEn from "@/i18n/messages/screens.en.json";

/**
 * The exam's wizards (exam, invite, link) speak "sen" like the hiring wizard
 * (K9: a screen a plan touches leaves "siz"), and the invite copy never
 * promises an e-mail: nothing sends one (src/server/invite.ts).
 */
const FORMAL = [/(?<!\p{L})siz(?!\p{L})/u, /\p{L}+(?:iniz|ınız|unuz|ünüz)(?!\p{L})/u, /\p{L}+(?:nizi|nızı|nuzu|nüzü)(?!\p{L})/u, /lütfen/iu, /\p{L}+(?:yiniz|yınız|abilirsiniz|ebilirsiniz)(?!\p{L})/u];

describe("exam wizard copy", () => {
  it("speaks sen", () => {
    const texts = [...Object.values(screensTr.examWizard), screensTr.invite.lead, screensTr.invite.doneBody];
    for (const text of texts) for (const pattern of FORMAL) expect(text).not.toMatch(pattern);
  });

  it("says the links are not e-mailed, in both languages", () => {
    expect(screensTr.invite.lead).toMatch(/e-postayla gönderilmez/);
    expect(screensTr.invite.doneBody).toMatch(/e-postayla gönderilmedi/);
    expect(screensEn.invite.lead).toMatch(/not e-mailed/);
    expect(screensEn.invite.doneBody).toMatch(/not e-mailed/);
    expect(screensTr.examWizard.inviteNoMail).toMatch(/e-postayla gönderilmez/);
  });

  it("labels the level shift as the user asked", () => {
    expect([screensTr.examWizard.shiftEasier, screensTr.examWizard.shiftNormal, screensTr.examWizard.shiftHarder]).toEqual(["Daha kolay (bir seviye aşağı)", "Normal", "Daha zor (bir seviye yukarı)"]);
  });
});
