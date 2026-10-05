import { describe, expect, it } from "vitest";
import { parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { deadlineInputValue, inviteReason, panelShortfall, sheetLocked, type InviteOpening } from "./form-rules";

const opening: InviteOpening = { id: "o", name: "Tasarımcı · Ekim", live: true, evaluators: 2, minEvaluations: 2, deadlineDay: null };
const base = { opening, mode: "single" as const, fullName: "Elif Kaya", email: "elif@example.com", rows: [], deadline: null, today: "2026-10-05" };

describe("why the invite button waits (HIRING-UX 5.11 early validation)", () => {
  it("names the opening's problem first", () => {
    expect(inviteReason({ ...base, opening: null })).toBe("noOpening");
    expect(inviteReason({ ...base, opening: { ...opening, live: false } })).toBe("notPublished");
    expect(inviteReason({ ...base, opening: { ...opening, evaluators: 0 } })).toBe("noEvaluators");
  });

  it("then the opening's own deadline: one already behind today takes no invitation (the server refuses it too)", () => {
    expect(inviteReason({ ...base, opening: { ...opening, deadlineDay: "2026-10-04" } })).toBe("openingDeadline");
    // The deadline day itself still takes one.
    expect(inviteReason({ ...base, opening: { ...opening, deadlineDay: "2026-10-05" } })).toBeNull();
  });

  it("then the deadline, then the person", () => {
    expect(inviteReason({ ...base, deadline: "2026-10-04" })).toBe("deadline");
    expect(inviteReason({ ...base, deadline: "2026-10-05" })).toBeNull();
    expect(inviteReason({ ...base, fullName: "E" })).toBe("name");
    expect(inviteReason({ ...base, email: "elif@" })).toBe("email");
    expect(inviteReason(base)).toBeNull();
  });

  it("for a pasted list, needs rows and no marked row", () => {
    expect(inviteReason({ ...base, mode: "many" })).toBe("noRows");
    expect(inviteReason({ ...base, mode: "many", rows: parseInviteRows("Elif Kaya, elif@example.com\nAli, ali@").rows })).toBe("rows");
    expect(inviteReason({ ...base, mode: "many", rows: parseInviteRows("Elif Kaya, elif@example.com").rows })).toBeNull();
  });
});

describe("a panel smaller than the decision minimum (ledger Task 11 carry)", () => {
  it("gives the numbers when the active panel is smaller than the minimum evaluations", () => {
    expect(panelShortfall({ ...opening, evaluators: 1, minEvaluations: 2 })).toEqual({ evaluators: 1, min: 2 });
    expect(panelShortfall({ ...opening, evaluators: 2, minEvaluations: 3 })).toEqual({ evaluators: 2, min: 3 });
  });

  it("says nothing when the panel is large enough, empty (the button already waits for that) or the opening is not live", () => {
    expect(panelShortfall({ ...opening, evaluators: 2, minEvaluations: 2 })).toBeNull();
    expect(panelShortfall({ ...opening, evaluators: 3, minEvaluations: 2 })).toBeNull();
    expect(panelShortfall({ ...opening, evaluators: 0, minEvaluations: 2 })).toBeNull();
    expect(panelShortfall({ ...opening, live: false, evaluators: 1, minEvaluations: 2 })).toBeNull();
    expect(panelShortfall(null)).toBeNull();
  });
});

describe("the form uses the server's name rule (Task 17 fix round 1)", () => {
  it("waits on a name the server would refuse", () => {
    expect(inviteReason({ ...base, fullName: "Elif <b>" })).toBe("name");
    expect(inviteReason({ ...base, fullName: "elif@example.com" })).toBe("name");
    expect(inviteReason({ ...base, fullName: "x".repeat(121) })).toBe("name");
    expect(inviteReason({ ...base, fullName: "  Elif   Kaya  " })).toBeNull();
  });
});

describe("the Sheet holds while a request runs or links are shown (Task 17 fix round 1)", () => {
  it("is locked while pending or done, open to Escape and outside clicks otherwise", () => {
    expect(sheetLocked({ pending: true, done: false })).toBe(true);
    expect(sheetLocked({ pending: false, done: true })).toBe(true);
    expect(sheetLocked({ pending: false, done: false })).toBe(false);
  });
});

describe("the date field shows the day that will be used (Task 17 fix round 1)", () => {
  const withDeadline = { ...opening, deadlineDay: "2026-10-20" };
  it("shows the opening's deadline for a later chosen day, and the default when nothing is chosen", () => {
    expect(deadlineInputValue({ opening: withDeadline, deadline: "2026-10-30", today: "2026-10-05" })).toBe("2026-10-20");
    expect(deadlineInputValue({ opening: withDeadline, deadline: "2026-10-12", today: "2026-10-05" })).toBe("2026-10-12");
    expect(deadlineInputValue({ opening: withDeadline, deadline: null, today: "2026-10-05" })).toBe("2026-10-20");
    expect(deadlineInputValue({ opening, deadline: null, today: "2026-10-05" })).toBe("2026-10-19");
  });

  it("keeps a past day as typed, so its reason reads next to it", () => {
    expect(deadlineInputValue({ opening: withDeadline, deadline: "2026-10-01", today: "2026-10-05" })).toBe("2026-10-01");
    expect(deadlineInputValue({ opening: null, deadline: null, today: "2026-10-05" })).toBe("");
  });
});
