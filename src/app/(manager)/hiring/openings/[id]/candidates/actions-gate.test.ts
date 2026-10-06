import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * U2 (B-I1) through the real gate: "Tamam" on a request of a CLOSED opening
 * goes through runningOpening, so the organisation-scoped load and the role
 * check are the real ones (actions.test.ts mocks the gate itself). Nothing but
 * the session, the opening's load and the request's write is a stand-in.
 */
const OPENING = "33333333-3333-4333-8333-333333333333";
const REQUEST = "44444444-4444-4444-8444-444444444444";
const h = vi.hoisted(() => ({
  user: { id: "u1", orgId: "o1", role: "OWNER" as "OWNER" | "MANAGER" | "REVIEWER" },
  opening: null as null | { id: string; status: "DRAFT" | "OPEN" | "CLOSED"; decisionMakerId: string | null; backupDecisionMakerId: string | null; memberIds: string[] },
  mark: vi.fn(async () => true),
  redirected: "",
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirected = to;
    throw new Error("NEXT_REDIRECT");
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("@/server/session", () => ({ requireUser: async () => h.user }));
vi.mock("@/solutions/hiring/server/openings", () => ({ loadOpening: async (orgId: string, id: string) => (orgId === "o1" && id === OPENING ? h.opening : null) }));
vi.mock("@/solutions/hiring/server/invitations", () => ({ markRequestHandled: h.mark, newHiringLink: vi.fn(), extendHiringLink: vi.fn() }));

import { markRequestAction } from "./actions";

function form() {
  const data = new FormData();
  data.set("openingId", OPENING);
  data.set("requestId", REQUEST);
  return data;
}

beforeEach(() => {
  h.user = { id: "u1", orgId: "o1", role: "OWNER" };
  h.opening = { id: OPENING, status: "CLOSED", decisionMakerId: null, backupDecisionMakerId: null, memberIds: ["r1"] };
  h.mark.mockClear();
  h.redirected = "";
});

describe("'Tamam' on a closed opening through the real gate (U2, B-I1)", () => {
  it("lets an owner or a manager of the organisation close the request", async () => {
    await expect(markRequestAction(form())).rejects.toThrow("NEXT_REDIRECT");
    expect(h.mark).toHaveBeenCalledWith({ id: "u1", orgId: "o1" }, OPENING, REQUEST);
    expect(h.redirected).toBe(`/hiring/openings/${OPENING}/candidates?handled=1`);
    h.user = { ...h.user, role: "MANAGER" };
    await expect(markRequestAction(form())).rejects.toThrow("NEXT_REDIRECT");
    expect(h.mark).toHaveBeenCalledTimes(2);
  });

  it("refuses a reviewer on the opening's team and writes nothing", async () => {
    h.user = { id: "r1", orgId: "o1", role: "REVIEWER" };
    await expect(markRequestAction(form())).rejects.toThrow("NEXT_REDIRECT");
    expect(h.mark).not.toHaveBeenCalled();
    expect(h.redirected).toBe(`/hiring/openings/${OPENING}/candidates?request=forbidden`);
  });

  it("refuses an owner of another organisation without revealing the opening", async () => {
    h.user = { id: "u9", orgId: "o2", role: "OWNER" };
    await expect(markRequestAction(form())).rejects.toThrow("NEXT_REDIRECT");
    expect(h.mark).not.toHaveBeenCalled();
    expect(h.redirected).toBe(`/hiring/openings/${OPENING}/candidates?request=notfound`);
  });
});
