import { describe, expect, it } from "vitest";
import { ORG_TIMEZONE, zonedDayStart } from "@/lib/org-timezone";
import { deadlineToDate, openingRulesProblems, type OpeningRulesInput } from "./opening-rules";

const users = [
  { id: "owner", role: "OWNER" as const, disabled: false },
  { id: "manager", role: "MANAGER" as const, disabled: false },
  { id: "reviewer", role: "REVIEWER" as const, disabled: false },
  { id: "gone", role: "MANAGER" as const, disabled: true },
];
const ok: OpeningRulesInput = {
  name: "Tasarımcı · Ekim",
  memberIds: ["reviewer", "manager"],
  decisionMakerId: "owner",
  backupDecisionMakerId: "manager",
  minEvaluations: 2,
  blindMode: false,
  deadline: "2026-10-31",
  feedbackDays: 7,
  candidateContactEmail: "ik@example.com",
};

describe("opening rules (HIRING-UX 5.18, 4.6)", () => {
  it("accepts a complete set of rules", () => {
    expect(openingRulesProblems(ok, users, "2026-10-04")).toEqual([]);
  });

  it("needs a decision maker who is an active owner or manager, and a different backup", () => {
    expect(openingRulesProblems({ ...ok, decisionMakerId: null }, users, "2026-10-04")).toContain("DECISION_MAKER_REQUIRED");
    expect(openingRulesProblems({ ...ok, decisionMakerId: "reviewer" }, users, "2026-10-04")).toContain("DECISION_MAKER_ROLE");
    expect(openingRulesProblems({ ...ok, decisionMakerId: "gone" }, users, "2026-10-04")).toContain("DECISION_MAKER_ROLE");
    expect(openingRulesProblems({ ...ok, backupDecisionMakerId: "owner" }, users, "2026-10-04")).toContain("BACKUP_SAME");
    expect(openingRulesProblems({ ...ok, backupDecisionMakerId: "reviewer" }, users, "2026-10-04")).toContain("BACKUP_ROLE");
  });

  it("lets anyone active be an evaluator", () => {
    expect(openingRulesProblems({ ...ok, memberIds: ["gone"] }, users, "2026-10-04")).toContain("MEMBER_UNKNOWN");
    expect(openingRulesProblems({ ...ok, memberIds: ["nobody"] }, users, "2026-10-04")).toContain("MEMBER_UNKNOWN");
  });

  it("keeps the numbers, the date and the address in range", () => {
    const problems = openingRulesProblems(
      { ...ok, name: " ", minEvaluations: 6, feedbackDays: 0, deadline: "2026-10-03", candidateContactEmail: "not-an-address" },
      users,
      "2026-10-04",
    );
    expect(problems).toEqual(["NAME_REQUIRED", "MIN_EVALUATIONS", "FEEDBACK_DAYS", "DEADLINE_PAST", "EMAIL"]);
    expect(openingRulesProblems({ ...ok, deadline: null, candidateContactEmail: "" }, users, "2026-10-04")).toEqual([]);
  });

  it("turns a deadline day into the end of that day in Istanbul", () => {
    expect(deadlineToDate("2026-10-31", "Europe/Istanbul").toISOString()).toBe("2026-10-31T20:59:59.000Z");
  });

  // Carry 1 (ruling C6): the organisation's zone, never a hard-coded offset.
  it("uses the organisation's zone by default: one second before the next day starts there", () => {
    expect(deadlineToDate("2026-10-31").getTime()).toBe(zonedDayStart("2026-11-01", ORG_TIMEZONE)!.getTime() - 1000);
  });

  it("follows a zone with daylight saving through the switch", () => {
    // New York leaves daylight saving on 2026-11-01, so that day ends at 23:59:59 EST (-05:00).
    expect(deadlineToDate("2026-11-01", "America/New_York").toISOString()).toBe("2026-11-02T04:59:59.000Z");
    expect(deadlineToDate("2026-07-01", "America/New_York").toISOString()).toBe("2026-07-02T03:59:59.000Z");
  });

  it("refuses a day that is not on the calendar, in the rules and in the conversion", () => {
    expect(openingRulesProblems({ ...ok, deadline: "2026-02-30" }, users, "2026-01-04")).toEqual(["DEADLINE_INVALID"]);
    expect(openingRulesProblems({ ...ok, deadline: "31.10.2026" }, users, "2026-10-04")).toEqual(["DEADLINE_INVALID"]);
    expect(() => deadlineToDate("2026-02-30")).toThrow(RangeError);
  });

  it("accepts today as the deadline", () => {
    expect(openingRulesProblems({ ...ok, deadline: "2026-10-04" }, users, "2026-10-04")).toEqual([]);
  });

  // Carry 5: an id from another organisation is simply not among `users` (the server loads the org's own).
  it("refuses a member, decision maker or backup who is not a user of this organisation", () => {
    expect(openingRulesProblems({ ...ok, memberIds: ["other-org-user"] }, users, "2026-10-04")).toEqual(["MEMBER_UNKNOWN"]);
    expect(openingRulesProblems({ ...ok, decisionMakerId: "other-org-user" }, users, "2026-10-04")).toEqual(["DECISION_MAKER_ROLE"]);
    expect(openingRulesProblems({ ...ok, backupDecisionMakerId: "other-org-user" }, users, "2026-10-04")).toEqual(["BACKUP_ROLE"]);
    expect(openingRulesProblems({ ...ok, backupDecisionMakerId: "gone" }, users, "2026-10-04")).toEqual(["BACKUP_ROLE"]);
  });

  it("lets the decision maker also be an evaluator, and a reviewer be only an evaluator", () => {
    expect(openingRulesProblems({ ...ok, memberIds: ["owner", "reviewer"] }, users, "2026-10-04")).toEqual([]);
  });
});
