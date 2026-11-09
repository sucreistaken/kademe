import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/public/placement: the secret, the body and the answers. The
 * placement itself (reuse, daily cap) is the exam solution's
 * (solutions/language-exam/public-placement.test.ts); here the registry hands
 * the route a stand-in module, so every test can say what it was asked.
 */
const h = vi.hoisted(() => ({ place: vi.fn(), offered: true }));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/solutions/registry.server", () => ({
  servingSolution: async () => null,
  // The hiring module offers no public placement; the exam's does unless a test says otherwise.
  solutionModules: () => [{ key: "hiring" }, h.offered ? { key: "language-exam", publicPlacement: (...args: unknown[]) => h.place(...args) } : { key: "language-exam" }],
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const SECRET = "s".repeat(40);
const EXPIRES = new Date("2026-11-12T10:00:00.000Z");
let minute = 0;
let emailNo = 0;

/** A fresh e-mail per call, so the per-e-mail limit only bites where a test means it to. */
const freshEmail = () => `visitor${++emailNo}@example.com`;
const validBody = (over: Record<string, unknown> = {}) => ({ name: "Ada Lovelace", email: freshEmail(), locale: "en", consent: true, ...over });

const call = (body: unknown, auth: string | null = `Bearer ${SECRET}`) =>
  POST(
    new NextRequest("http://localhost/api/public/placement", {
      method: "POST",
      headers: { "content-type": "application/json", ...(auth === null ? {} : { authorization: auth }) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  // Each test in its own minute, so the in-process limiter starts fresh.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 10, 9, 10, 0) + ++minute * 120_000));
  vi.stubEnv("KADEME_PUBLIC_SECRET", SECRET);
  h.offered = true;
  h.place.mockReset();
  h.place.mockResolvedValue({ ok: true, url: "https://kademe.example/a/tok", expiresAt: EXPIRES, reused: false });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the secret", () => {
  it("missing on the server: 503, never open, nothing invited", async () => {
    vi.stubEnv("KADEME_PUBLIC_SECRET", "");
    const res = await call(validBody());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "KADEME_PUBLIC_SECRET is not set" });
    // Not even with an empty bearer, which an unset secret would otherwise equal.
    expect((await call(validBody(), "Bearer ")).status).toBe(503);
    expect(h.place).not.toHaveBeenCalled();
  });

  it("a placeholder shorter than 32 characters counts as missing", async () => {
    vi.stubEnv("KADEME_PUBLIC_SECRET", "changeme");
    expect((await call(validBody(), "Bearer changeme")).status).toBe(503);
    expect(h.place).not.toHaveBeenCalled();
  });

  it("wrong or absent: 403, nothing invited", async () => {
    for (const auth of [null, "", "Bearer wrong", `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(1)}`, SECRET.toUpperCase(), `Basic ${SECRET}`]) {
      const res = await call(validBody(), auth);
      expect(res.status, String(auth)).toBe(403);
      expect(await res.json()).toEqual({ error: "forbidden" });
    }
    expect(h.place).not.toHaveBeenCalled();
  });

  it("right: the request goes through (the scheme's case does not matter)", async () => {
    expect((await call(validBody())).status).toBe(201);
    expect((await call(validBody(), `bearer ${SECRET}`)).status).toBe(201);
    expect(h.place).toHaveBeenCalledTimes(2);
  });
});

describe("the body", () => {
  it("consent must be true", async () => {
    for (const consent of [false, undefined, "yes"]) {
      const res = await call(validBody({ consent }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "CONSENT_REQUIRED" });
    }
    expect(h.place).not.toHaveBeenCalled();
  });

  it("names a wrong field, and refuses what is not JSON", async () => {
    const res = await call(validBody({ email: "nope" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_FIELD", field: "email" });
    expect(await (await call(validBody({ locale: "fr" }))).json()).toEqual({ error: "INVALID_FIELD", field: "locale" });
    const notJson = await call("{name:");
    expect(notJson.status).toBe(400);
    expect(await notJson.json()).toEqual({ error: "INVALID_BODY" });
    expect(h.place).not.toHaveBeenCalled();
  });

  it("refuses a body over 8 KB before reading it", async () => {
    const res = await call(validBody({ crmLeadId: "x".repeat(9000) }));
    expect(res.status).toBe(413);
    expect(h.place).not.toHaveBeenCalled();
  });

  it("passes the checked request on", async () => {
    await call({ name: " Ada  Lovelace ", email: "Ada@Example.com", phone: "+49 30 1", locale: "de", consent: true, crmLeadId: "L-1", utm: { source: "ig" } });
    expect(h.place).toHaveBeenCalledWith({ fullName: "Ada Lovelace", email: "Ada@Example.com", phone: "+49 30 1", locale: "de", crmLeadId: "L-1", utm: { source: "ig" } });
  });
});

describe("the answer", () => {
  it("a new invitation: 201 with exactly { url, expiresAt }, never cached", async () => {
    const res = await call(validBody());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ url: "https://kademe.example/a/tok", expiresAt: EXPIRES.toISOString() });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("the visitor's open link from the last 24 hours: 200 with the same shape", async () => {
    h.place.mockResolvedValue({ ok: true, url: "https://kademe.example/a/open", expiresAt: EXPIRES, reused: true });
    const res = await call(validBody());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://kademe.example/a/open", expiresAt: EXPIRES.toISOString() });
  });

  it("the daily cap per e-mail: 429 DAILY_LIMIT", async () => {
    h.place.mockResolvedValue({ ok: false, code: "DAILY_LIMIT" });
    const res = await call(validBody());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "DAILY_LIMIT" });
  });

  it("no solution offers a public placement: 503 NOT_SET_UP", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    h.offered = false;
    const res = await call(validBody());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "NOT_SET_UP" });
  });

  it("a server that cannot invite says so: 503 for setup and bank, 500 for a refusal or a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [code, status] of [["NOT_SET_UP", 503], ["TEMPLATE_COVERAGE", 503], ["INVITE_FAILED", 500]] as const) {
      h.place.mockResolvedValueOnce({ ok: false, code });
      const res = await call(validBody());
      expect(res.status, code).toBe(status);
      expect(await res.json()).toEqual({ error: code });
    }
    h.place.mockRejectedValueOnce(new Error("db down"));
    const crashed = await call(validBody());
    expect(crashed.status).toBe(500);
    expect(await crashed.json()).toEqual({ error: "FAILED" });
  });
});

describe("the in-process limit", () => {
  it("one e-mail: the sixth request in a minute is refused before the database", async () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) expect((await call(validBody({ email }))).status).toBe(201);
    const res = await call(validBody({ email: email.toUpperCase() }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMITED" });
    expect(res.headers.get("retry-after")).toBe("60");
    expect(h.place).toHaveBeenCalledTimes(5);
    // Another e-mail is not held up.
    expect((await call(validBody())).status).toBe(201);
  });

  it("all callers: at most 30 requests a minute", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 31; i++) codes.push((await call(validBody())).status);
    expect(codes.slice(0, 30).every((c) => c === 201)).toBe(true);
    expect(codes[30]).toBe(429);
    // A wrong secret never uses up the budget.
    vi.setSystemTime(new Date(Date.now() + 120_000));
    for (let i = 0; i < 40; i++) await call(validBody(), "Bearer wrong");
    expect((await call(validBody())).status).toBe(201);
  });
});
