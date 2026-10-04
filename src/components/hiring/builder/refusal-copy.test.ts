import { describe, expect, it } from "vitest";
import type { ActionCode } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/result";
import { managerT } from "@/i18n/manager";
import { refusalKey } from "./refusal-copy";

/** Every code a builder write can answer, typed so a new code needs a sample here. */
const CODES: { [C in ActionCode | "NETWORK"]: true } = {
  NO_DRAFT: true,
  CLOSED: true,
  STAGE_FULL: true,
  COMPETENCY: true,
  CHOICE_COMPETENCY: true,
  TOO_MANY_COMPETENCIES: true,
  NOT_FOUND: true,
  INVALID: true,
  FORBIDDEN: true,
  UNDO_EXPIRED: true,
  NETWORK: true,
};

const FIELDS = ["answerSeconds", "thinkSeconds", "maxTakes", "durationSeconds", "config.maxChars", "config.minChars", "config.maxFileBytes", "config.choices", "config.choices.2.label.tr", "prompt.tr", "name.en", "redFlags.0", "answerExamples.3", "somethingElse"];

describe("builder refusal copy", () => {
  it.each(["tr", "en"] as const)("gives every code and field a sentence in %s, never a raw key, a code or a placeholder", (locale) => {
    const t = managerT(locale);
    const texts = [
      ...Object.keys(CODES).flatMap((code) => [refusalKey(code as ActionCode, [], "edit"), refusalKey(code as ActionCode, [], "undo")]),
      ...FIELDS.map((field) => refusalKey("INVALID", [field])),
    ].map((key) => t(`hiringBuilder.${key}`));
    for (const text of texts) {
      expect(text.trim()).not.toBe("");
      expect(text).not.toMatch(/hiringBuilder|[{}]|NO_DRAFT|STAGE_FULL|INVALID|23514/);
      expect(text).not.toContain("\u2014");
    }
  });

  it("names the field the server refused", () => {
    const t = managerT("tr");
    expect(t(`hiringBuilder.${refusalKey("INVALID", ["answerSeconds"])}`)).toBe("Cevap süresi 30 ile 1800 saniye arasında olmalı.");
    expect(t(`hiringBuilder.${refusalKey("INVALID", ["prompt.tr"])}`)).toBe("Bu metin çok uzun; kısaltınca kaydedilir.");
    expect(t(`hiringBuilder.${refusalKey("INVALID", [])}`)).toBe("Bu değer kabul edilmedi; aralığı kontrol et.");
  });

  it("says a full stage on undo in its own words", () => {
    expect(refusalKey("STAGE_FULL", [], "undo")).toBe("errStageFullUndo");
    expect(refusalKey("STAGE_FULL", [], "edit")).toBe("errStageFull");
  });
});
