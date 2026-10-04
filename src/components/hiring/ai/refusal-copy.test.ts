import { describe, expect, it } from "vitest";
import type { AiCode } from "@/app/(manager)/hiring/openings/[id]/assessment/ai/result";
import { managerT } from "@/i18n/manager";
import { aiRefusal, type AiKey } from "./refusal-copy";

const say = (locale: "tr" | "en") => {
  const t = managerT(locale);
  return (key: AiKey, values?: Record<string, string | number>) => t(`hiringAi.${key}`, values);
};

/** Every code an AI screen action can answer, typed so a new code needs a sample here. */
const CODES: { [C in AiCode | "NETWORK"]: true } = {
  NOT_FOUND: true,
  CLOSED: true,
  FORBIDDEN: true,
  LIBRARY_FORBIDDEN: true,
  INVALID: true,
  NO_DRAFT: true,
  JOB_AD_TOO_SHORT: true,
  JOB_AD_TOO_LONG: true,
  RATE_LIMITED: true,
  UNCONFIGURED: true,
  PROVIDER_FAILED: true,
  SCHEMA_FAILED: true,
  COMPETENCY: true,
  CHOICE_COMPETENCY: true,
  TOO_MANY_COMPETENCIES: true,
  STAGE_FULL: true,
  NAME_REQUIRED: true,
  IN_USE: true,
  NOT_CREATED: true,
  NETWORK: true,
};

describe("AI screen refusal copy", () => {
  it.each(["tr", "en"] as const)("gives every code a sentence in %s, never a raw key, a code, a placeholder or an em dash", (locale) => {
    const t = say(locale);
    for (const code of Object.keys(CODES) as Array<AiCode | "NETWORK">) {
      const text = aiRefusal(code, t);
      expect(text.trim()).not.toBe("");
      expect(text).not.toMatch(/hiringAi|[{}]|[A-Z]{2,}_[A-Z]{2,}/);
      expect(text).not.toContain("\u2014");
    }
  });

  it("says why generating failed, in the sentence HIRING-UX 5.6 gives", () => {
    expect(aiRefusal("PROVIDER_FAILED", say("tr"))).toBe("Öneri üretilemedi: AI servisine şu an ulaşılamadı. İlan metnin duruyor; tekrar deneyebilir ya da boş başlayabilirsin.");
    expect(aiRefusal("RATE_LIMITED", say("en"))).toBe("Too many suggestions were requested in a short time. Try again in a few minutes.");
  });
});
