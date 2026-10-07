import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AiLimit from "@/lib/ai-limit";
import type * as RoleBriefJob from "@/solutions/hiring/ai/role-brief-job";
import type * as Openings from "@/solutions/hiring/server/openings";

/**
 * "Rolü anlat" (HIRING-UX 5.20, step 1): the same right as opening an opening,
 * its own AI limit, nothing asked of the model for a malformed request, and
 * the refusals as codes.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/db", () => ({ db: {} }));

let role: "OWNER" | "MANAGER" | "REVIEWER" = "OWNER";
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u1", orgId: "o1", email: "", name: "", role }) }));
const m = vi.hoisted(() => ({
  aiLimitReached: vi.fn<typeof AiLimit.aiLimitReached>(),
  generateRoleBrief: vi.fn<typeof RoleBriefJob.generateRoleBrief>(),
  createOpening: vi.fn<typeof Openings.createOpening>(),
}));
vi.mock("@/lib/ai-limit", () => ({ aiLimitReached: (...a: Parameters<typeof AiLimit.aiLimitReached>) => m.aiLimitReached(...a) }));
vi.mock("@/solutions/hiring/ai/role-brief-job", () => ({ generateRoleBrief: (...a: Parameters<typeof RoleBriefJob.generateRoleBrief>) => m.generateRoleBrief(...a) }));
vi.mock("@/solutions/hiring/server/openings", () => ({ createOpening: (...a: Parameters<typeof Openings.createOpening>) => m.createOpening(...a) }));

import { clarifyRoleAction, createOpeningAction } from "./actions";

const input = { positionName: "Sürüş eğitmeni", text: "sürüş eğitmeni birini arıyorum", rounds: [] };
const brief = { kind: "brief" as const, summary: ["B sınıfı ehliyet"], jobAd: "İlan" };

beforeEach(() => {
  role = "OWNER";
  for (const fn of Object.values(m)) fn.mockReset();
  m.aiLimitReached.mockResolvedValue(false);
  m.generateRoleBrief.mockResolvedValue({ status: "OK", result: brief });
  m.createOpening.mockResolvedValue({ ok: true, openingId: "op1", next: "/hiring/openings/op1/setup#questions" });
});

describe("clarifyRoleAction", () => {
  it("asks the model as the session's organisation and user, under HIRING_ROLE_BRIEF", async () => {
    expect(await clarifyRoleAction(input)).toEqual({ ok: true, result: brief });
    expect(m.aiLimitReached).toHaveBeenCalledWith("o1", "u1", "HIRING_ROLE_BRIEF");
    expect(m.generateRoleBrief).toHaveBeenCalledWith({ ...input, orgId: "o1", userId: "u1" });
  });

  it("refuses a reviewer, a malformed request and one over the limit without asking the model", async () => {
    role = "REVIEWER";
    expect(await clarifyRoleAction(input)).toEqual({ ok: false, code: "FORBIDDEN" });
    role = "MANAGER";
    expect(await clarifyRoleAction({ ...input, positionName: " " })).toEqual({ ok: false, code: "INVALID" });
    expect(await clarifyRoleAction({ ...input, rounds: "x" as never })).toEqual({ ok: false, code: "INVALID" });
    m.aiLimitReached.mockResolvedValue(true);
    expect(await clarifyRoleAction(input)).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(m.generateRoleBrief).not.toHaveBeenCalled();
  });

  it("answers UNCONFIGURED and FAILED as codes", async () => {
    m.generateRoleBrief.mockResolvedValueOnce({ status: "UNCONFIGURED" });
    expect(await clarifyRoleAction(input)).toEqual({ ok: false, code: "UNCONFIGURED" });
    m.generateRoleBrief.mockResolvedValueOnce({ status: "FAILED", code: "PROVIDER_FAILED" });
    expect(await clarifyRoleAction(input)).toEqual({ ok: false, code: "FAILED" });
  });
});

describe("createOpeningAction", () => {
  it("passes the AI-written ad on to createOpening", async () => {
    await createOpeningAction({ position: { kind: "existing", id: "11111111-1111-4111-8111-111111111111" }, start: "AI", copyFrom: null, jobAd: "İlan metni" });
    expect(m.createOpening.mock.calls[0][1]).toMatchObject({ start: "AI", jobAd: "İlan metni" });
  });
});
