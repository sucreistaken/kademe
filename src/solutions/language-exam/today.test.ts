import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  reports: [] as { id: string; assessmentId: string; createdAt: Date; name: string | null }[],
  since: null as Date | null,
}));

vi.mock("@/server/panel", () => ({ listStudents: async () => [] }));
vi.mock("@/server/problem-reports", () => ({
  recentProblemReports: async (_orgId: string, since: Date) => {
    h.since = since;
    return h.reports;
  },
}));

import { examToday } from "./today";

beforeEach(() => {
  h.reports = [];
  h.since = null;
});

describe("examToday problem reports", () => {
  it("adds no row when no one reported a problem in the last week", async () => {
    expect(await examToday("o1", "u1", "tr")).toEqual([]);
    expect(Date.now() - h.since!.getTime()).toBeGreaterThanOrEqual(7 * 86_400_000 - 5_000);
    expect(Date.now() - h.since!.getTime()).toBeLessThan(7 * 86_400_000 + 5_000);
  });

  it("adds one attention row with the count, linking to the newest report's student page", async () => {
    h.reports = [
      { id: "r2", assessmentId: "a2", createdAt: new Date("2026-10-17T10:00:00Z"), name: "Elif Kaya" },
      { id: "r1", assessmentId: "a1", createdAt: new Date("2026-10-15T10:00:00Z"), name: "Can Demir" },
    ];
    const [row, ...rest] = await examToday("o1", "u1", "tr");
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      solution: "language-exam",
      lane: "attention",
      attention: "problems",
      title: "Son 7 günde 2 sorun bildirimi",
      subtitle: "Elif Kaya",
      href: "/exam/students/a2#problems",
    });
    expect(row.sortAt).toEqual(new Date("2026-10-15T10:00:00Z"));
  });

  it("speaks English when asked to", async () => {
    h.reports = [{ id: "r1", assessmentId: "a1", createdAt: new Date("2026-10-15T10:00:00Z"), name: "Can Demir" }];
    const [row] = await examToday("o1", "u1", "en");
    expect(row.title).toBe("1 problem report in the last 7 days");
  });
});
