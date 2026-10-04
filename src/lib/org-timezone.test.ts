import { describe, it, expect } from "vitest";
import { ORG_TIMEZONE, orgDay, resolveTimeZone, zonedDayStart, zoneLabel } from "./org-timezone";

describe("org time zone", () => {
  it("defaults to Istanbul", () => {
    expect(resolveTimeZone(undefined)).toBe("Europe/Istanbul");
    expect(resolveTimeZone("  ")).toBe("Europe/Istanbul");
    expect(ORG_TIMEZONE).toBe(resolveTimeZone(process.env.ORG_TIMEZONE));
  });

  it("accepts a real IANA name and falls back on nonsense", () => {
    expect(resolveTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
    expect(resolveTimeZone("Mars/Olympus")).toBe("Europe/Istanbul");
  });
});

describe("day start in the org zone", () => {
  it("is Istanbul midnight, whatever zone the process runs in", () => {
    // Istanbul is +03:00 all year.
    expect(zonedDayStart("2026-09-08", "Europe/Istanbul")?.toISOString()).toBe(
      "2026-09-07T21:00:00.000Z",
    );
  });

  it("gives the exclusive end of an inclusive 'to' filter with dayOffset 1", () => {
    expect(zonedDayStart("2026-09-08", "Europe/Istanbul", 1)?.toISOString()).toBe(
      "2026-09-08T21:00:00.000Z",
    );
  });

  it("follows the zone's own offset through the year", () => {
    expect(zonedDayStart("2026-07-01", "Europe/Berlin")?.toISOString()).toBe(
      "2026-06-30T22:00:00.000Z",
    );
    expect(zonedDayStart("2026-01-15", "Europe/Berlin")?.toISOString()).toBe(
      "2026-01-14T23:00:00.000Z",
    );
  });

  it("handles the day the clocks change", () => {
    // Berlin switches to summer time on 29 March 2026 at 01:00 UTC. Midnight of
    // that day is still winter time; midnight of the next day is summer time.
    expect(zonedDayStart("2026-03-29", "Europe/Berlin")?.toISOString()).toBe(
      "2026-03-28T23:00:00.000Z",
    );
    expect(zonedDayStart("2026-03-29", "Europe/Berlin", 1)?.toISOString()).toBe(
      "2026-03-29T22:00:00.000Z",
    );
  });

  it("rejects anything that is not a real date", () => {
    expect(zonedDayStart("2026-02-30", "Europe/Istanbul")).toBe(null);
    expect(zonedDayStart("8 Eylül", "Europe/Istanbul")).toBe(null);
    expect(zonedDayStart("", "Europe/Istanbul")).toBe(null);
  });
});

describe("orgDay", () => {
  it("names the calendar day an instant falls on in the zone", () => {
    // 21:30 UTC on 3 October is already 4 October in Istanbul (+03:00).
    expect(orgDay(new Date("2026-10-03T21:30:00Z"), "Europe/Istanbul")).toBe("2026-10-04");
    expect(orgDay(new Date("2026-10-03T20:59:59Z"), "Europe/Istanbul")).toBe("2026-10-03");
    expect(orgDay(new Date("2026-10-03T21:30:00Z"), "America/New_York")).toBe("2026-10-03");
  });

  it("defaults to the organisation's zone and to now", () => {
    const at = new Date("2026-01-05T12:00:00Z");
    expect(orgDay(at)).toBe(orgDay(at, ORG_TIMEZONE));
    expect(orgDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("round-trips with zonedDayStart", () => {
    expect(orgDay(zonedDayStart("2026-03-29", "Europe/Berlin")!, "Europe/Berlin")).toBe("2026-03-29");
  });
});

describe("zoneLabel", () => {
  it("names the zone in words, in the reader's language, not by its IANA id", () => {
    expect(zoneLabel("tr", "Europe/Istanbul")).toMatch(/^Türkiye/);
    expect(zoneLabel("en", "Europe/Istanbul")).toMatch(/Time$/);
    expect(zoneLabel("en", "Europe/Berlin")).toBe("Central European Time");
    expect(zoneLabel("tr", ORG_TIMEZONE)).not.toContain("/");
  });

  it("prefers a spelled-out name over a bare GMT offset", () => {
    expect(zoneLabel("en", "UTC")).toBe("Coordinated Universal Time");
  });
});
