import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionModule } from "@/solutions/types";

type CloseExpired = NonNullable<SolutionModule["attempts"]["closeExpired"]>;

const h = vi.hoisted(() => ({
  modules: [] as Array<{ key: string; attempts: { closeExpired?: (now: Date, limit: number) => Promise<unknown> } }>,
}));

vi.mock("@/lib/auth", () => ({ safeEqual: (a: string, b: string) => a === b }));
vi.mock("@/lib/close-expired", () => ({
  salvageAbandonedUploads: async () => ({ scanned: 1, salvaged: 1, failed: 0, skipped: 0, errors: 0, details: [] }),
  closeExpiredRuns: async () => ({ scanned: 2, closed: 2 }),
  expireLinks: async () => ({ expired: 3 }),
}));
vi.mock("@/solutions/registry.server", () => ({ solutionModules: () => h.modules }));

import { NextRequest } from "next/server";
import { POST } from "./route";

const NOW = new Date("2026-10-05T09:00:00.000Z");
const call = () => POST(new NextRequest("http://localhost/api/cron/close-expired", { method: "POST", headers: { authorization: "Bearer s3cret" } }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("CRON_SECRET", "s3cret");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("POST /api/cron/close-expired, per solution", () => {
  it("asks every module with its own sweep once with (now, 50); a failing module yields { error } and nothing else stops", async () => {
    const hiring = vi.fn<CloseExpired>(async () => ({ scanned: 1, closed: 1 }));
    const broken = vi.fn<CloseExpired>(async () => {
      throw new Error("boom");
    });
    h.modules = [{ key: "language-exam", attempts: {} }, { key: "hiring", attempts: { closeExpired: hiring } }, { key: "broken", attempts: { closeExpired: broken } }];

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(hiring).toHaveBeenCalledTimes(1);
    expect(hiring.mock.calls[0][0]).toEqual(NOW);
    expect(hiring.mock.calls[0][1]).toBe(50);
    expect(broken).toHaveBeenCalledTimes(1);
    expect(body.solutions).toEqual({ hiring: { scanned: 1, closed: 1 }, broken: { error: "boom" } });
    // The exam's keys are exactly as before, filled even though a module threw.
    expect(Object.keys(body)).toEqual(["at", "runs", "links", "uploads", "solutions"]);
    expect(body.at).toBe(NOW.toISOString());
    expect(body.runs).toEqual({ scanned: 2, closed: 2 });
    expect(body.links).toEqual({ expired: 3 });
    expect(body.uploads).toEqual({ scanned: 1, salvaged: 1, failed: 0, skipped: 0, errors: 0, details: [] });
  });

  it("refuses without the shared secret before any sweep runs", async () => {
    const hiring = vi.fn<CloseExpired>(async () => ({ scanned: 0, closed: 0 }));
    h.modules = [{ key: "hiring", attempts: { closeExpired: hiring } }];
    const res = await POST(new NextRequest("http://localhost/api/cron/close-expired", { method: "POST", headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(403);
    expect(hiring).not.toHaveBeenCalled();
  });
});
