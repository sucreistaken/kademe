import { describe, expect, it } from "vitest";
import { groupCounts, levelDistribution } from "./group-report";
import { fillMessage, firstName, formatDeadline, isFreshInvite } from "./message";

describe("group counts", () => {
  const rows = [
    { status: "NOT_STARTED", level: null },
    { status: "EXPIRED", level: null },
    { status: "IN_EXAM", level: null },
    { status: "AWAITING_GRADING", level: null },
    { status: "AWAITING_REVIEW", level: "B1" },
    { status: "FINAL", level: "B1" },
    { status: "RELEASED", level: "C2" },
  ] as const;

  it("counts invited, started, finished and not started", () => {
    expect(groupCounts(rows)).toEqual({ invited: 7, started: 5, finished: 4, notStarted: 2, seriousFinished: 0 });
    expect(groupCounts([])).toEqual({ invited: 0, started: 0, finished: 0, notStarted: 0, seriousFinished: 0 });
  });

  it("counts finished students with serious flags, not running ones", () => {
    const withFlags = [
      { status: "IN_EXAM", level: null, seriousFlags: 2 },
      { status: "AWAITING_REVIEW", level: null, seriousFlags: 1 },
      { status: "FINAL", level: "B1", seriousFlags: 0 },
      { status: "RELEASED", level: "B2", seriousFlags: 4 },
    ] as const;
    expect(groupCounts(withFlags).seriousFinished).toBe(2);
  });

  it("spreads finished students over A1..C2, every level present", () => {
    expect(levelDistribution(rows)).toEqual({ A1: 0, A2: 0, B1: 2, B2: 0, C1: 0, C2: 1 });
  });

  it("ignores a level on a student who has not finished", () => {
    expect(levelDistribution([{ status: "IN_EXAM", level: "A2" }]).A2).toBe(0);
  });
});

describe("reminder message", () => {
  const parts = { name: "Ayşe Nur Yılmaz", school: "Dil Okulu", link: "https://x.test/e/abc", deadline: "20 Ekim 2026", minutes: 45 };

  it("fills the agreed template exactly", () => {
    expect(fillMessage(parts)).toBe(
      "Merhaba Ayşe, Dil Okulu için Almanca seviye sınavınız hazır. Sınava bu linkten girebilirsiniz: https://x.test/e/abc . Son giriş tarihi: 20 Ekim 2026. Sınavı bilgisayardan (Chrome veya Edge) yapmanız gerekiyor, yaklaşık 45 dakika sürer. Sorunuz olursa bu mesaja yanıt verebilirsiniz.",
    );
  });

  it("greets the first name, or the whole single name", () => {
    expect(firstName("  Ayşe   Nur ")).toBe("Ayşe");
    expect(firstName("Madonna")).toBe("Madonna");
  });

  it("writes the deadline as a Turkish date in the school's day", () => {
    expect(formatDeadline(new Date("2026-10-20T21:30:00Z"))).toBe("21 Ekim 2026");
  });

  it("calls an invitation under a day old fresh", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(isFreshInvite(new Date("2026-10-14T01:00:00Z"), now)).toBe(true);
    expect(isFreshInvite(new Date("2026-10-12T12:00:00Z"), now)).toBe(false);
  });
});
