import { describe, expect, it, vi } from "vitest";

/**
 * Who runs openings comes from the capability table (`opening:write` in
 * lib/authorize), not from a second role list here, so the two cannot drift:
 * take the capability away from managers and they no longer edit or decide.
 */
vi.mock("@/lib/authorize", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authorize")>();
  return {
    ...actual,
    can: (user: { role: string }, capability: string) => capability === "opening:write" && user.role === "OWNER",
  };
});

import { canDecide, openingAccess } from "./access";

const people = { decisionMakerId: null, backupDecisionMakerId: null, memberIds: ["m1"] };

describe("opening access follows the opening:write capability", () => {
  it("a role without opening:write neither edits nor decides; one with it does", () => {
    expect(openingAccess({ id: "x", role: "MANAGER" }, people)).toEqual({ view: false, edit: false });
    expect(canDecide("MANAGER")).toBe(false);
    expect(openingAccess({ id: "x", role: "OWNER" }, people)).toEqual({ view: true, edit: true });
    expect(canDecide("OWNER")).toBe(true);
    // Being on the team still shows the opening, read-only.
    expect(openingAccess({ id: "m1", role: "MANAGER" }, people)).toEqual({ view: true, edit: false });
  });
});
