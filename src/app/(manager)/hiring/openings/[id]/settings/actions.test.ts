import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Openings from "@/solutions/hiring/server/openings";
import { ForbiddenError } from "@/lib/authorize";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";

/**
 * The team and rules actions (Task 20, carry 5). Every action asks for the
 * opening again with the session's organisation (openingFor / editableOpening:
 * org-scoped load, role, CLOSED) and writes with the session's org and user,
 * never with anything from the browser. "Kaydet" answers every refusal as a
 * code; reopening is for owners and managers only, since a closed opening is
 * not editable by anyone.
 */
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/db", () => ({ db: {} }));

const OPENING = "33333333-3333-4333-8333-333333333333";
const OWNER = "55555555-5555-4555-8555-555555555555";
const MEMBER = "66666666-6666-4666-8666-666666666666";

type Role = "OWNER" | "MANAGER" | "REVIEWER";
let viewer: { role: Role; view: boolean; edit: boolean; status: "DRAFT" | "OPEN" | "CLOSED" };
const session = () => ({ id: "u1", orgId: "o1", email: "", name: "", role: viewer.role });
const openingFor = vi.fn(async (id: string, need: "view" | "edit") => {
  if (!viewer.view) throw new Error("notFound");
  if (need === "edit" && !viewer.edit) throw new ForbiddenError("opening:write");
  return { user: session(), opening: { id, status: viewer.status }, access: { view: viewer.view, edit: viewer.edit } };
});
const editableOpening = vi.fn(async (id: string) => {
  if (!viewer.view) return { ok: false as const, code: "NOT_FOUND" as const };
  if (viewer.status === "CLOSED") return { ok: false as const, code: "CLOSED" as const };
  if (!viewer.edit) return { ok: false as const, code: "FORBIDDEN" as const };
  return { ok: true as const, user: session(), opening: { id, status: viewer.status } };
});
vi.mock("../access", () => ({
  openingFor: (id: string, need: "view" | "edit") => openingFor(id, need),
  editableOpening: (id: string) => editableOpening(id),
}));

const saveOpeningRules = vi.hoisted(() => vi.fn<typeof Openings.saveOpeningRules>());
const setOpeningClosed = vi.hoisted(() => vi.fn<typeof Openings.setOpeningClosed>());
vi.mock("@/solutions/hiring/server/openings", () => ({
  saveOpeningRules: (...a: Parameters<typeof Openings.saveOpeningRules>) => saveOpeningRules(...a),
  setOpeningClosed: (...a: Parameters<typeof Openings.setOpeningClosed>) => setOpeningClosed(...a),
}));

import { closeOpeningAction, reopenOpeningAction, saveOpeningRulesAction } from "./actions";

const rules = {
  name: "Tasarımcı · Ekim",
  memberIds: [MEMBER],
  decisionMakerId: OWNER,
  backupDecisionMakerId: null,
  minEvaluations: 2,
  blindMode: false,
  deadline: "2099-10-31",
  feedbackDays: 7,
  candidateContactEmail: "ik@example.com",
};
const form = (id = OPENING) => {
  const f = new FormData();
  f.set("openingId", id);
  return f;
};

beforeEach(() => {
  viewer = { role: "OWNER", view: true, edit: true, status: "DRAFT" };
  revalidatePath.mockClear();
  openingFor.mockClear();
  editableOpening.mockClear();
  saveOpeningRules.mockReset();
  saveOpeningRules.mockResolvedValue({ ok: true, name: rules.name });
  setOpeningClosed.mockReset();
  setOpeningClosed.mockResolvedValue(undefined);
});

describe("saveOpeningRulesAction", () => {
  it("re-checks the opening and saves with the session's organisation and user", async () => {
    await expect(saveOpeningRulesAction(OPENING, rules)).resolves.toEqual({ ok: true, name: rules.name });
    expect(editableOpening).toHaveBeenCalledWith(OPENING);
    expect(saveOpeningRules).toHaveBeenCalledWith("o1", "u1", OPENING, rules);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("passes the finish survey switch through", async () => {
    await saveOpeningRulesAction(OPENING, { ...rules, finishSurveyEnabled: false });
    expect(saveOpeningRules).toHaveBeenCalledWith("o1", "u1", OPENING, { ...rules, finishSurveyEnabled: false });
  });

  it("refuses a finish survey switch that is not a boolean", async () => {
    await expect(saveOpeningRulesAction(OPENING, { ...rules, finishSurveyEnabled: "no" })).resolves.toEqual({ ok: false, code: "INVALID" });
    expect(saveOpeningRules).not.toHaveBeenCalled();
  });

  it("a manager may save too", async () => {
    viewer = { role: "MANAGER", view: true, edit: true, status: "OPEN" };
    await expect(saveOpeningRulesAction(OPENING, rules)).resolves.toEqual({ ok: true, name: rules.name });
  });

  it("passes the server's refusal through and refreshes nothing", async () => {
    saveOpeningRules.mockResolvedValue({ ok: false, problems: ["BACKUP_SAME"] });
    await expect(saveOpeningRulesAction(OPENING, rules)).resolves.toEqual({ ok: false, problems: ["BACKUP_SAME"] });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["a reviewer member (read-only)", { role: "REVIEWER" as Role, view: true, edit: false, status: "OPEN" as const }, "FORBIDDEN"],
    ["a reviewer outside the team", { role: "REVIEWER" as Role, view: false, edit: false, status: "OPEN" as const }, "NOT_FOUND"],
    ["a closed opening", { role: "OWNER" as Role, view: true, edit: false, status: "CLOSED" as const }, "CLOSED"],
  ])("refuses %s with a code and writes nothing", async (_name, who, code) => {
    viewer = who;
    await expect(saveOpeningRulesAction(OPENING, rules)).resolves.toEqual({ ok: false, code });
    expect(saveOpeningRules).not.toHaveBeenCalled();
  });

  it.each([
    ["a member id that is not a uuid", { ...rules, memberIds: ["x"] }],
    ["a missing field", { ...rules, blindMode: undefined }],
    ["a deadline that is not a day", { ...rules, deadline: "31.10.2026" }],
    ["too many members", { ...rules, memberIds: Array.from({ length: 51 }, () => MEMBER) }],
    ["not an object", "rules"],
  ])("answers INVALID for %s before touching the database", async (_name, body) => {
    await expect(saveOpeningRulesAction(OPENING, body)).resolves.toEqual({ ok: false, code: "INVALID" });
    expect(saveOpeningRules).not.toHaveBeenCalled();
  });

  it("answers a close or a delete that happened meanwhile as a code", async () => {
    saveOpeningRules.mockRejectedValue(new HiringConflict("CLOSED"));
    await expect(saveOpeningRulesAction(OPENING, rules)).resolves.toEqual({ ok: false, code: "CLOSED" });
    saveOpeningRules.mockRejectedValue(new HiringNotFound("opening"));
    await expect(saveOpeningRulesAction(OPENING, rules)).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("lets an unexpected error reach the error boundary", async () => {
    saveOpeningRules.mockRejectedValue(new Error("boom"));
    await expect(saveOpeningRulesAction(OPENING, rules)).rejects.toThrow("boom");
  });
});

describe("closeOpeningAction", () => {
  it("closes with the session's organisation and returns with the undo", async () => {
    await expect(closeOpeningAction(form())).rejects.toThrow(`redirect:/hiring/openings/${OPENING}/settings?closed=1`);
    expect(openingFor).toHaveBeenCalledWith(OPENING, "view");
    expect(setOpeningClosed).toHaveBeenCalledWith("o1", "u1", OPENING, true);
  });

  it("refuses a reviewer, and hides the opening from one who cannot see it", async () => {
    viewer = { role: "REVIEWER", view: true, edit: false, status: "OPEN" };
    await expect(closeOpeningAction(form())).rejects.toBeInstanceOf(ForbiddenError);
    viewer = { role: "REVIEWER", view: false, edit: false, status: "OPEN" };
    await expect(closeOpeningAction(form())).rejects.toThrow("notFound");
    expect(setOpeningClosed).not.toHaveBeenCalled();
  });

  // Fix round 1, Important 2: a second "Alımı kapat" queued behind the first lands on a closed opening.
  it("answers a repeated close of an already closed opening with the same harmless redirect", async () => {
    viewer = { role: "MANAGER", view: true, edit: false, status: "CLOSED" };
    await expect(closeOpeningAction(form())).rejects.toThrow(`redirect:/hiring/openings/${OPENING}/settings?closed=1`);
    expect(setOpeningClosed).toHaveBeenCalledWith("o1", "u1", OPENING, true);
  });
});

describe("reopenOpeningAction", () => {
  it("lets an owner or a manager reopen a closed opening", async () => {
    for (const role of ["OWNER", "MANAGER"] as const) {
      viewer = { role, view: true, edit: false, status: "CLOSED" };
      await expect(reopenOpeningAction(form())).rejects.toThrow(`redirect:/hiring/openings/${OPENING}/settings`);
    }
    expect(openingFor).toHaveBeenCalledWith(OPENING, "view");
    expect(setOpeningClosed).toHaveBeenCalledTimes(2);
    expect(setOpeningClosed).toHaveBeenCalledWith("o1", "u1", OPENING, false);
  });

  it("refuses a reviewer who can see the opening, and hides it from one who cannot", async () => {
    viewer = { role: "REVIEWER", view: true, edit: false, status: "CLOSED" };
    await expect(reopenOpeningAction(form())).rejects.toBeInstanceOf(ForbiddenError);
    viewer = { role: "REVIEWER", view: false, edit: false, status: "CLOSED" };
    await expect(reopenOpeningAction(form())).rejects.toThrow("notFound");
    expect(setOpeningClosed).not.toHaveBeenCalled();
  });
});
