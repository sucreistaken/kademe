import { describe, expect, it } from "vitest";
import { parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { inviteReason, panelShortfall, type InviteOpening } from "./form-rules";

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
