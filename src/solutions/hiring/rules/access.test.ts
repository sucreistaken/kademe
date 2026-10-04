import { describe, expect, it } from "vitest";
import { canDecide, openingAccess } from "./access";

const people = { decisionMakerId: "dm", backupDecisionMakerId: "bk", memberIds: ["m1"] };

describe("opening access", () => {
  it("lets owners and managers see and edit every opening", () => {
    expect(openingAccess({ id: "x", role: "OWNER" }, people)).toEqual({ view: true, edit: true });
    expect(openingAccess({ id: "x", role: "MANAGER" }, people)).toEqual({ view: true, edit: true });
  });

  it("lets a reviewer see an opening only as a member, decision maker or backup, never edit it", () => {
    for (const id of ["m1", "dm", "bk"]) expect(openingAccess({ id, role: "REVIEWER" }, people)).toEqual({ view: true, edit: false });
    expect(openingAccess({ id: "stranger", role: "REVIEWER" }, people)).toEqual({ view: false, edit: false });
  });

  it("does not match a reviewer against an unset decision maker or backup", () => {
    const none = { decisionMakerId: null, backupDecisionMakerId: null, memberIds: [] };
    expect(openingAccess({ id: "r", role: "REVIEWER" }, none)).toEqual({ view: false, edit: false });
  });

  it("lets only owners and managers decide (HIRING-UX 4.6)", () => {
    expect(canDecide("OWNER")).toBe(true);
    expect(canDecide("MANAGER")).toBe(true);
    expect(canDecide("REVIEWER")).toBe(false);
  });
});
