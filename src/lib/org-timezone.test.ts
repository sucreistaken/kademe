import { describe, it, expect } from "vitest";
import { ORG_TIMEZONE, resolveTimeZone, zonedDayStart } from "./org-timezone";

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
