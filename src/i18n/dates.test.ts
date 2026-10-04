import { describe, expect, it } from "vitest";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { dateTime, shortDate } from "./dates";
import { shortDate as managerShortDate } from "@/lib/format";

/**
 * Dates are shown in the organisation's zone (ORG_TIMEZONE), never the server
 * process's: a deadline stored as the end of 31 October in Istanbul must not
 * read as 1 November on a server running in UTC, nor 31 October turn into
 * 30 October west of UTC.
 */
describe("zone-aware dates", () => {
  // 02:00 UTC on 1 Nov 2026 is 05:00 in Istanbul (1 Nov) and 22:00 the evening before in New York (31 Oct).
  const instant = new Date("2026-11-01T02:00:00Z");

  it("formats the day in the zone it is given, west of UTC too", () => {
    expect(shortDate(instant, "en", "America/New_York")).toBe("31 Oct");
    expect(shortDate(instant, "en", "Europe/Istanbul")).toBe("1 Nov");
    expect(dateTime(instant, "en", "America/New_York")).toBe("31 Oct, 22:00");
    expect(managerShortDate(instant, "en", "America/New_York")).toBe("31 Oct");
  });

  it("uses the organisation's zone by default, whatever zone the process runs in", () => {
    const inOrgZone = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: ORG_TIMEZONE }).format(instant);
    expect(shortDate(instant, "en")).toBe(inOrgZone);
    expect(managerShortDate(instant, "en")).toBe(inOrgZone);
  });
});
