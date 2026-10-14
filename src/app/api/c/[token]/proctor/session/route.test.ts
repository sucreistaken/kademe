import { beforeEach, describe, expect, it, vi } from "vitest";
import { policyFromPreset, type ProctoringPolicy } from "@/lib/proctor/policy";

/**
 * The session answer tells the tab whether to record the exam: the policy has
 * to record something and the consent the candidate accepted has to announce
 * it. The candidate plumbing is mocked the way the other candidate route
 * tests do.
 */

const h = vi.hoisted(() => ({
  ctx: { assessment: { id: "asm-1", orgId: "org-1", solution: "LANGUAGE_EXAM" }, locale: "tr" },
  policy: null as ProctoringPolicy | null,
  consent: true as boolean | null,
  consentAsked: 0,
}));

vi.mock("@/lib/candidate-api", () => {
  const fail = (_ctx: unknown, code: string, status: number) => Response.json({ error: code }, { status });
  return {
    withSolution: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown, s: unknown) => unknown) =>
      handler(req, h.ctx, { proctorPolicy: async () => h.policy }),
    conflict: (ctx: unknown, code: string) => fail(ctx, code, 409),
    clientIp: () => null,
    readJson: async (req: Request) => req.json(),
  };
});
vi.mock("@/lib/candidate-context", () => ({ currentAttempt: async () => ({ attempt: { id: "att-1" }, finished: false }) }));
vi.mock("@/server/proctoring", () => ({ registerSession: async () => ({ id: "sess-1" }) }));
vi.mock("@/server/recordings", () => ({
  recordingConsent: async () => {
    h.consentAsked++;
    return h.consent;
  },
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

async function open() {
  const res = await POST(
    new NextRequest("http://localhost/api/c/tok/proctor/session", {
      method: "POST",
      body: JSON.stringify({ clientSessionId: "client-session-1", env: {} }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ token: "t".repeat(43) }) },
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { recording: boolean; policy: ProctoringPolicy };
}

beforeEach(() => {
  h.policy = policyFromPreset("STANDARD");
  h.consent = true;
  h.consentAsked = 0;
});

describe("POST /proctor/session", () => {
  it("tells the tab to record when the policy records and the accepted text announces it", async () => {
    expect(await open()).toMatchObject({ recording: true, policy: { preset: "STANDARD" } });
  });

  it("tells the tab not to record an invitation accepted under the old consent text", async () => {
    h.consent = false;
    expect((await open()).recording).toBe(false);
    h.consent = null;
    expect((await open()).recording).toBe(false);
  });

  it("records nothing without proctoring, and does not even look at the consent", async () => {
    h.policy = null;
    expect(await open()).toMatchObject({ recording: false, policy: { preset: "OFF" } });
    expect(h.consentAsked).toBe(0);
  });
});
