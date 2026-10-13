import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; orgId: string; role: "OWNER" | "MANAGER" | "REVIEWER" },
  audit: vi.fn<(user: unknown, attemptId: string) => Promise<boolean>>(),
}));

vi.mock("@/server/session", () => ({ currentUser: async () => h.user }));
vi.mock("@/server/recordings", () => ({ auditRecordingView: h.audit }));

import { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/panel/recordings/viewed", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  h.user = { id: "u1", orgId: "org-1", role: "MANAGER" };
  h.audit.mockReset();
  h.audit.mockResolvedValue(true);
});

describe("POST /api/panel/recordings/viewed", () => {
  it("writes the view for the signed-in user", async () => {
    expect((await post({ attemptId: "att-1" })).status).toBe(200);
    expect(h.audit).toHaveBeenCalledWith(h.user, "att-1");
  });

  it("answers 401 without a session", async () => {
    h.user = null;
    expect((await post({ attemptId: "att-1" })).status).toBe(401);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("answers 404 for another organisation's attempt or a malformed body", async () => {
    h.audit.mockResolvedValueOnce(false);
    expect((await post({ attemptId: "att-other" })).status).toBe(404);
    expect((await post("not json")).status).toBe(404);
    expect((await post({ attemptId: 42 })).status).toBe(404);
  });
});
