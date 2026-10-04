import { describe, expect, it } from "vitest";
import type { CheckCode } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/check-result";
import { managerT } from "@/i18n/manager";
import { PROTECTED_CATEGORIES } from "@/solutions/hiring/ai/protected-terms";
import { checkRefusal, type CheckKey } from "./check-copy";

const say = (locale: "tr" | "en") => {
  const t = managerT(locale);
  return (key: CheckKey, values?: Record<string, string | number>) => t(`hiringCheck.${key}`, values);
};

/** Every code the question check can answer, typed so a new code needs a sample here. */
const CODES: { [C in CheckCode | "NETWORK" | "UNSAVED"]: true } = {
  NOT_FOUND: true,
  CLOSED: true,
  FORBIDDEN: true,
  INVALID: true,
  NO_DRAFT: true,
  RATE_LIMITED: true,
  UNCONFIGURED: true,
  PROVIDER_FAILED: true,
  SCHEMA_FAILED: true,
  NETWORK: true,
  UNSAVED: true,
};

describe("question check refusal copy", () => {
  it.each(["tr", "en"] as const)("gives every code a sentence in %s, never a raw key, a code, a placeholder or an em dash", (locale) => {
    const t = say(locale);
    for (const code of Object.keys(CODES) as Array<keyof typeof CODES>) {
      const text = checkRefusal(code, t);
      expect(text.trim()).not.toBe("");
      expect(text).not.toMatch(/hiringCheck|[{}]|[A-Z]{2,}_[A-Z]{2,}/);
      expect(text).not.toContain("\u2014");
    }
  });

  it("says the rule check still stands when the AI cannot run", () => {
    expect(checkRefusal("UNCONFIGURED", say("tr"))).toBe("AI bağlı değil; yalnızca kural kontrolü çalışıyor.");
    expect(checkRefusal("RATE_LIMITED", say("tr"))).toMatch(/kural kontrolü geçerli/);
    expect(checkRefusal("PROVIDER_FAILED", say("en"))).toBe("The AI check could not run; the rule check stands.");
    expect(checkRefusal("SCHEMA_FAILED", say("en"))).toBe("The AI check could not run; the rule check stands.");
  });

  it.each(["tr", "en"] as const)("names every protected ground and gives it a calm note in %s", (locale) => {
    const t = say(locale);
    for (const category of PROTECTED_CATEGORIES) {
      for (const key of [`cat${category}`, `note${category}`] as const) {
        const text = t(key);
        expect(text.trim()).not.toBe("");
        expect(text).not.toMatch(/hiringCheck|[{}]|!/);
        expect(text).not.toContain("\u2014");
      }
    }
    expect(t("kindPROTECTEDCategory", { category: t("catAGE") })).toBe(locale === "tr" ? "Korunan bir özelliğe dokunuyor olabilir: yaş" : "May touch a protected characteristic: age");
  });

  it("says a closed opening and a read-only role apart", () => {
    expect(say("tr")("aiReadOnly")).toBe("AI kontrolünü yalnızca değerlendirmeyi düzenleyebilenler çalıştırabilir.");
    expect(checkRefusal("CLOSED", say("tr"))).toBe("Bu alım kapalı; soruları değişmez.");
  });
});
