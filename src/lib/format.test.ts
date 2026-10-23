import { describe, expect, it } from "vitest";
import { ago, charCount, intlTag, remaining, score, shortDate, span, waiting } from "@/lib/format";

const NOW = new Date("2026-10-23T12:00:00Z");
const HOURS = 3_600_000;

describe("panel formatting in German", () => {
  it("uses the de-DE tag", () => {
    expect(intlTag("de")).toBe("de-DE");
    expect(intlTag("en")).toBe("en-GB");
    expect(intlTag("tr")).toBe("tr-TR");
    expect(intlTag("xx")).toBe("tr-TR");
  });

  it("writes dates the German way", () => {
    expect(shortDate(new Date("2026-03-04T10:00:00Z"), "de")).toBe("4. März");
  });

  it("speaks German relative time", () => {
    expect(ago(new Date(NOW.getTime() - 5_000), "de", NOW)).toBe("gerade eben");
    expect(ago(new Date(NOW.getTime() - 4 * HOURS), "de", NOW)).toBe("vor 4 Stunden");
    expect(ago(new Date(NOW.getTime() - HOURS), "de", NOW)).toBe("vor 1 Stunde");
    expect(waiting(new Date(NOW.getTime() - 48 * HOURS), "de", NOW)).toBe("wartet seit 2 Tagen");
    expect(remaining(new Date(NOW.getTime() - 1), "de", NOW)).toBe("abgelaufen");
    expect(span(5_000, "de")).toBe("wenige Sekunden");
  });

  it("keeps Turkish and English unchanged", () => {
    expect(ago(new Date(NOW.getTime() - 5_000), "tr", NOW)).toBe("az önce");
    expect(ago(new Date(NOW.getTime() - 4 * HOURS), "en", NOW)).toBe("4 hours ago");
  });

  it("uses a decimal comma in German and a point in English", () => {
    expect(score(3.5, "de")).toBe("3,5");
    expect(score(3.5, "tr")).toBe("3,5");
    expect(score(3.5, "en")).toBe("3.5");
    expect(charCount("abc", "de")).toBe("3 Zeichen");
  });
});
