import { describe, expect, it, vi } from "vitest";

/**
 * The exam window: the pure rules (what the wizard and the server action
 * accept, where a link stands), and the server's refusal: with the real link
 * check and the real exam endpoint wrapper over a faked database row, nothing
 * of an exam runs before the link's `notBefore`.
 */
const state = vi.hoisted(() => ({ link: {} as Record<string, unknown> }));
vi.mock("@/db", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "from", "innerJoin", "where"]) chain[k] = () => chain;
  chain.limit = async () => [
    {
      link: { id: "l1", tokenHash: "x", firstSeenIp: null, ...state.link },
      assessment: { id: "a1", orgId: "o1", solution: "LANGUAGE_EXAM", locale: "tr" },
      candidate: { id: "c1", fullName: "Ayşe Yılmaz", email: "a@x.com", phone: null, location: null, deletedAt: null },
      org: { name: "Okul", contactEmail: null, mediaRetentionDays: 180, evidenceRetentionDays: 90 },
    },
  ];
  return { db: chain };
});

import { NextRequest } from "next/server";
import { resolveToken } from "@/lib/candidate-context";
import { withExamCandidate } from "@/lib/exam-candidate-api";
import { orgTime, resolveWindow, windowPhase, windowProblem, zonedMoment, MIN_WINDOW_MS } from "@/lib/exam-window";

const TZ = "Europe/Istanbul"; // UTC+3 all year
const NOW = new Date("2026-10-14T09:00:00Z"); // 12:00 in Istanbul
const at = (iso: string) => new Date(iso);

describe("zonedMoment", () => {
  it("reads a typed date and time in the school's zone", () => {
    expect(zonedMoment({ date: "2026-10-15", time: "09:30" }, TZ)?.toISOString()).toBe("2026-10-15T06:30:00.000Z");
    expect(orgTime(at("2026-10-15T06:30:00Z"), TZ)).toBe("09:30");
  });
  it("refuses what is not a real date or time", () => {
    expect(zonedMoment({ date: "2026-02-30", time: "09:30" }, TZ)).toBeNull();
    expect(zonedMoment({ date: "2026-10-15", time: "24:00" }, TZ)).toBeNull();
    expect(zonedMoment({ date: "2026-10-15", time: "" }, TZ)).toBeNull();
    expect(zonedMoment({ date: "", time: "09:30" }, TZ)).toBeNull();
  });
});

describe("resolveWindow", () => {
  const opts = { now: NOW, timeZone: TZ };

  it("Hemen without an end: open now, 14 days", () => {
    const r = resolveWindow({ start: null, end: null }, opts);
    expect(r).toEqual({ ok: true, notBefore: null, expiresAt: new Date(NOW.getTime() + 14 * 86_400_000) });
  });

  it("a set start without an end: 14 days after the start", () => {
    const r = resolveWindow({ start: { date: "2026-10-20", time: "09:00" }, end: null }, opts);
    expect(r).toEqual({ ok: true, notBefore: at("2026-10-20T06:00:00Z"), expiresAt: at("2026-11-03T06:00:00Z") });
  });

  it("takes the typed end", () => {
    const r = resolveWindow({ start: { date: "2026-10-20", time: "09:00" }, end: { date: "2026-10-22", time: "18:00" } }, opts);
    expect(r).toEqual({ ok: true, notBefore: at("2026-10-20T06:00:00Z"), expiresAt: at("2026-10-22T15:00:00Z") });
  });

  it("refuses a start in the past, allows one a moment ago", () => {
    expect(resolveWindow({ start: { date: "2026-10-14", time: "11:00" }, end: null }, opts)).toEqual({ ok: false, fault: "START_PAST" });
    expect(resolveWindow({ start: { date: "2026-10-14", time: "11:59" }, end: null }, opts).ok).toBe(true);
  });

  it("refuses a start that is not a date", () => {
    expect(resolveWindow({ start: { date: "x", time: "09:00" }, end: null }, opts)).toEqual({ ok: false, fault: "START_INVALID" });
  });

  it("the end is at least an hour after the start, exactly an hour is fine", () => {
    const start = { date: "2026-10-20", time: "09:00" };
    expect(resolveWindow({ start, end: { date: "2026-10-20", time: "09:59" } }, opts)).toEqual({ ok: false, fault: "END_TOO_EARLY" });
    expect(resolveWindow({ start, end: { date: "2026-10-20", time: "10:00" } }, opts).ok).toBe(true);
    expect(MIN_WINDOW_MS).toBe(3_600_000);
  });

  it("on Hemen the end is measured from now", () => {
    expect(resolveWindow({ start: null, end: { date: "2026-10-14", time: "12:30" } }, opts)).toEqual({ ok: false, fault: "END_TOO_EARLY" });
    expect(resolveWindow({ start: null, end: { date: "2026-10-14", time: "13:00" } }, opts).ok).toBe(true);
  });

  it("refuses an end that is not a date or a year away", () => {
    expect(resolveWindow({ start: null, end: { date: "2026-13-01", time: "10:00" } }, opts)).toEqual({ ok: false, fault: "END_INVALID" });
    expect(resolveWindow({ start: null, end: { date: "2028-10-14", time: "10:00" } }, opts)).toEqual({ ok: false, fault: "END_TOO_FAR" });
  });
});

describe("window phases: before, inside, after", () => {
  const link = { notBefore: at("2026-10-20T06:00:00Z"), expiresAt: at("2026-10-27T06:00:00Z") };
  it("before the opening", () => {
    expect(windowPhase(link, at("2026-10-20T05:59:59Z"))).toBe("BEFORE");
    expect(windowProblem({ ...link, status: "NOT_STARTED" }, at("2026-10-20T05:59:59Z"))).toBe("NOT_YET");
    // a started link is not reopened early either
    expect(windowProblem({ ...link, status: "IN_PROGRESS" }, at("2026-10-19T00:00:00Z"))).toBe("NOT_YET");
  });
  it("inside, from the opening second to the last", () => {
    expect(windowPhase(link, at("2026-10-20T06:00:00Z"))).toBe("INSIDE");
    expect(windowProblem({ ...link, status: "NOT_STARTED" }, at("2026-10-20T06:00:00Z"))).toBeNull();
    expect(windowProblem({ ...link, status: "NOT_STARTED" }, at("2026-10-27T06:00:00Z"))).toBeNull();
  });
  it("after the end: a link not started lapses, a student inside keeps going", () => {
    expect(windowPhase(link, at("2026-10-27T06:00:01Z"))).toBe("AFTER");
    expect(windowProblem({ ...link, status: "NOT_STARTED" }, at("2026-10-28T00:00:00Z"))).toBe("EXPIRED");
    expect(windowProblem({ ...link, status: "IN_PROGRESS" }, at("2026-10-28T00:00:00Z"))).toBeNull();
  });
  it("a link without an opening is open from the start; the status still wins", () => {
    const open = { notBefore: null, expiresAt: at("2026-10-27T06:00:00Z") };
    expect(windowProblem({ ...open, status: "NOT_STARTED" }, at("2026-10-14T00:00:00Z"))).toBeNull();
    expect(windowProblem({ ...link, status: "COMPLETED" }, at("2026-10-01T00:00:00Z"))).toBe("COMPLETED");
    expect(windowProblem({ ...link, status: "EXPIRED" }, at("2026-10-21T00:00:00Z"))).toBe("EXPIRED");
  });
});

describe("the server refuses to start before the opening", () => {
  const token = "t".repeat(43);
  const hour = 3_600_000;
  const request = () => new NextRequest(`http://localhost/api/c/${token}/exam/section/start`, { method: "POST" });

  it("resolveToken says NOT_YET before notBefore, with the context for the waiting screen", async () => {
    state.link = { status: "NOT_STARTED", notBefore: new Date(Date.now() + hour), expiresAt: new Date(Date.now() + 24 * hour) };
    const r = await resolveToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problem).toBe("NOT_YET");
      expect(r.ctx?.link.notBefore).toEqual(state.link.notBefore);
    }
  });

  it("an exam endpoint answers 403 NOT_YET and never runs its handler", async () => {
    state.link = { status: "NOT_STARTED", notBefore: new Date(Date.now() + hour), expiresAt: new Date(Date.now() + 24 * hour) };
    const handler = vi.fn(async () => new Response("started"));
    const res = await withExamCandidate(request(), Promise.resolve({ token }), handler);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("NOT_YET");
    expect(handler).not.toHaveBeenCalled();
  });

  it("inside the window the link resolves", async () => {
    state.link = { status: "NOT_STARTED", notBefore: new Date(Date.now() - hour), expiresAt: new Date(Date.now() + 24 * hour) };
    expect((await resolveToken(token)).ok).toBe(true);
  });

  it("after the end a not-started link is EXPIRED", async () => {
    state.link = { status: "NOT_STARTED", notBefore: new Date(Date.now() - 48 * hour), expiresAt: new Date(Date.now() - hour) };
    const r = await resolveToken(token);
    expect(r.ok === false && r.problem).toBe("EXPIRED");
  });
});
