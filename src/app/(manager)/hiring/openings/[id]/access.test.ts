import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * editableOpening is openingFor for the builder's client-called actions: the
 * same organisation-scoped load and the same rights, answered as a code
 * instead of a thrown 404 or ForbiddenError, so the builder can say why.
 */
const OPENING = "33333333-3333-4333-8333-333333333333";
let user = { id: "u1", orgId: "o1", role: "OWNER" as "OWNER" | "MANAGER" | "REVIEWER" };
let opening: { id: string; status: "DRAFT" | "OPEN" | "CLOSED"; decisionMakerId: string | null; backupDecisionMakerId: string | null; memberIds: string[] } | null;
const loadOpening = vi.fn(async (orgId: string, id: string) => (orgId === "o1" && id === OPENING ? opening : null));

vi.mock("@/server/session", () => ({ requireUser: async () => user }));
vi.mock("@/solutions/hiring/server/openings", () => ({ loadOpening: (orgId: string, id: string) => loadOpening(orgId, id) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

import { editableOpening, runningOpening } from "./access";

beforeEach(() => {
  user = { id: "u1", orgId: "o1", role: "OWNER" };
  opening = { id: OPENING, status: "DRAFT", decisionMakerId: null, backupDecisionMakerId: null, memberIds: [] };
  loadOpening.mockClear();
});

describe("editableOpening", () => {
  it("loads the opening scoped to the session's organisation and lets an owner edit", async () => {
    const result = await editableOpening(OPENING);
    expect(result).toMatchObject({ ok: true, user: { orgId: "o1" }, opening: { id: OPENING } });
    expect(loadOpening).toHaveBeenCalledWith("o1", OPENING);
  });

  it("answers NOT_FOUND for another organisation's opening or an unknown id", async () => {
    user = { ...user, orgId: "o2" };
    expect(await editableOpening(OPENING)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await editableOpening("not-an-id")).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("answers NOT_FOUND to a reviewer outside the team, FORBIDDEN to one inside it", async () => {
    user = { ...user, role: "REVIEWER" };
    expect(await editableOpening(OPENING)).toEqual({ ok: false, code: "NOT_FOUND" });
    opening = { ...opening!, memberIds: ["u1"] };
    expect(await editableOpening(OPENING)).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("answers CLOSED for a closed opening, whoever asks", async () => {
    opening = { ...opening!, status: "CLOSED" };
    expect(await editableOpening(OPENING)).toEqual({ ok: false, code: "CLOSED" });
  });
});

/**
 * Task 18 fix round 1: "Yeni link üret" on a CLOSED opening stays possible for
 * a candidate who already started (Task 7 ruling); the status is left to
 * newHiringLink, the rights are not.
 */
describe("runningOpening", () => {
  it("lets an owner or manager act on a closed opening of their organisation", async () => {
    opening = { ...opening!, status: "CLOSED" };
    expect(await runningOpening(OPENING)).toMatchObject({ ok: true, user: { orgId: "o1" }, opening: { id: OPENING, status: "CLOSED" } });
    user = { ...user, role: "MANAGER" };
    expect(await runningOpening(OPENING)).toMatchObject({ ok: true });
    expect(loadOpening).toHaveBeenCalledWith("o1", OPENING);
  });

  it("keeps a reviewer out (FORBIDDEN in the team, NOT_FOUND outside it), closed or not", async () => {
    user = { ...user, role: "REVIEWER" };
    opening = { ...opening!, status: "CLOSED" };
    expect(await runningOpening(OPENING)).toEqual({ ok: false, code: "NOT_FOUND" });
    opening = { ...opening!, memberIds: ["u1"] };
    expect(await runningOpening(OPENING)).toEqual({ ok: false, code: "FORBIDDEN" });
    opening = { ...opening!, status: "OPEN" };
    expect(await runningOpening(OPENING)).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("answers NOT_FOUND for another organisation's opening", async () => {
    user = { ...user, orgId: "o2" };
    expect(await runningOpening(OPENING)).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});
