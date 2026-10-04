import { describe, expect, it } from "vitest";
import type { ScorecardCode } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/result";
import { managerT } from "@/i18n/manager";
import { refusalText, type ScorecardKey } from "./refusal-copy";

/** The namespaced translator the scorecard's client components get from useMT("hiringScorecard"). */
const ns = (locale: "tr" | "en") => {
  const t = managerT(locale);
  return (key: ScorecardKey, values?: Record<string, string | number>) => t(`hiringScorecard.${key}`, values);
};

/** Every code a scorecard write can answer, typed so a new code needs a sample here (carry 7). */
const CODES: { [C in ScorecardCode | "NETWORK"]: true } = {
  NOT_FOUND: true,
  CLOSED: true,
  FORBIDDEN: true,
  LIBRARY_FORBIDDEN: true,
  INVALID: true,
  NO_DRAFT: true,
  STALE: true,
  NO_LIVE: true,
  REASON_REQUIRED: true,
  NOT_WHOLE: true,
  NOT_100: true,
  WEIGHTS_MISSING: true,
  NO_CHANGE: true,
  ANCHORS_REQUIRED: true,
  ARCHIVED: true,
  NETWORK: true,
};

describe("scorecard refusal copy", () => {
  it.each(["tr", "en"] as const)("gives every code a sentence in %s, never a raw key, a code or a placeholder", (locale) => {
    const t = ns(locale);
    for (const code of Object.keys(CODES) as Array<ScorecardCode | "NETWORK">) {
      const text = refusalText({ code, total: 95 }, t);
      expect(text.trim(), code).not.toBe("");
      expect(text, code).not.toMatch(/hiringScorecard|[{}]|_/);
      expect(text, code).not.toContain("\u2014");
    }
  });

  it("STALE asks for a reload, and NOT_100 states the total the server counted", () => {
    const tr = ns("tr");
    const en = ns("en");
    expect(refusalText({ code: "STALE" }, tr)).toBe("Bu arada yeni bir sürüm yayına alındı; sayfayı yenile.");
    expect(refusalText({ code: "STALE" }, en)).toBe("A new version went live in the meantime; reload the page.");
    expect(refusalText({ code: "NOT_100", total: 95 }, tr)).toBe("Ağırlık toplamı %95; %100 olmalı.");
    expect(refusalText({ code: "NOT_WHOLE", total: 100 }, en)).toBe("Each weight must be a whole number from 0 to 100.");
  });
});
