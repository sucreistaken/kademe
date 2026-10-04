import { describe, expect, it, vi } from "vitest";

// src/server/settings.ts opens the database client at import; these checks never query it.
vi.mock("@/db", () => ({ db: {} }));

import { can } from "./authorize";
import { isRole, ROLE_ORDER } from "@/server/settings";
import type { SessionUser } from "./auth";

const user = (role: SessionUser["role"]): SessionUser => ({ id: "u", orgId: "o", email: "u@x", name: "U", role });

describe("roles", () => {
  it("lists MANAGER between OWNER and REVIEWER", () => {
    expect(ROLE_ORDER).toEqual(["OWNER", "MANAGER", "REVIEWER"]);
    expect(isRole("TEACHER")).toBe(false);
  });

  it("gives MANAGER what TEACHER had", () => {
    for (const capability of ["blueprint:write", "bank:write", "bank:approve", "student:invite", "result:grade", "result:finalize", "integrity:decide", "media:view"] as const) {
      expect(can(user("MANAGER"), capability), capability).toBe(true);
    }
    expect(can(user("MANAGER"), "settings:write")).toBe(false);
    expect(can(user("MANAGER"), "audit:read")).toBe(false);
  });
});

describe("library and hiring capabilities", () => {
  it("lets owners and managers write the library and openings, and only owners rename scale levels", () => {
    for (const capability of ["library:write", "opening:write"] as const) {
      expect(can(user("OWNER"), capability)).toBe(true);
      expect(can(user("MANAGER"), capability)).toBe(true);
      expect(can(user("REVIEWER"), capability)).toBe(false);
    }
    expect(can(user("OWNER"), "library:scale")).toBe(true);
    expect(can(user("MANAGER"), "library:scale")).toBe(false);
  });
});
