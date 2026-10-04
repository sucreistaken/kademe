import { describe, expect, it, vi } from "vitest";

// Any database access in these cases is a bug: a hiring invitation must be
// turned away before the exam tables are read.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

import { notFoundForSolution } from "@/lib/candidate-api";
import type { CandidateContext } from "@/lib/candidate-context";
import { loadExamContext } from "@/lib/exam-flow";

function ctx(solution: CandidateContext["assessment"]["solution"]): CandidateContext {
  return {
    link: { id: "l", status: "NOT_STARTED", expiresAt: new Date(), notBefore: null, firstSeenIp: null },
    assessment: { id: "a", orgId: "o", solution },
    candidate: { id: "c", fullName: null, email: null, phone: null, location: null },
    orgName: "Org",
    locale: "tr",
    contactEmail: null,
    contactName: null,
    mediaRetentionDays: 180,
    evidenceRetentionDays: 90,
  };
}

describe("exam endpoints and other solutions", () => {
  it("do not read a hiring invitation as an exam", async () => {
    expect(await loadExamContext(ctx("HIRING"))).toBeNull();
  });

  it("answer a solution mismatch exactly like an unknown token", async () => {
    const res = notFoundForSolution(ctx("HIRING"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(["error", "message"]);
    expect(body.error).toBe("INVALID");
  });
});
