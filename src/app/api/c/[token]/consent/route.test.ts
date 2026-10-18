import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ctx: { assessment: { id: "a1", orgId: "o1", solution: "HIRING" }, locale: "tr" },
  consentText: vi.fn(async () => ({ id: "ct-hiring", version: 2, body: { tr: "İşe alım metni", en: "Hiring text" } })),
  loadState: vi.fn(async () => ({ step: "INFO" })),
  recordConsent: vi.fn(async () => undefined),
  hasConsented: vi.fn(async () => false),
  getConsentText: vi.fn(async () => {
    throw new Error("the core text must not be read for a solution that names its own");
  }),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/candidate-context", () => ({
  getConsentText: h.getConsentText,
  hasConsented: h.hasConsented,
  recordConsent: h.recordConsent,
}));
vi.mock("@/lib/candidate-api", () => ({
  withSolution: (req: unknown, _params: unknown, handler: (r: unknown, c: unknown, s: unknown) => unknown) =>
    handler(req, h.ctx, { candidate: { consentText: h.consentText, loadState: h.loadState } }),
  badRequest: () => new Response(JSON.stringify({ error: "CONSENT_REQUIRED" }), { status: 400 }),
  clientIp: () => "127.0.0.1",
  userAgent: () => "test",
  readJson: async (req: Request) => req.json(),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const params = Promise.resolve({ token: "t".repeat(43) });

beforeEach(() => {
  h.consentText.mockClear();
  h.recordConsent.mockClear();
});

describe("consent route", () => {
  it("shows the copy the solution names for this invitation", async () => {
    const res = await GET(new NextRequest("http://localhost/api/c/x/consent"), { params });
    expect(await res.json()).toMatchObject({ version: 2, body: "İşe alım metni" });
    expect(h.consentText).toHaveBeenCalledTimes(1);
  });

  it("says whether consent is on record as `consented`, which candidateJson never strips (`accepted` was stripped)", async () => {
    const get = async () => (await GET(new NextRequest("http://localhost/api/c/x/consent"), { params })).json();
    h.hasConsented.mockResolvedValueOnce(false);
    expect(await get()).toEqual({ version: 2, body: "İşe alım metni", consented: false });
    h.hasConsented.mockResolvedValueOnce(true);
    expect(await get()).toEqual({ version: 2, body: "İşe alım metni", consented: true });
  });

  it("records exactly that text's id", async () => {
    const res = await POST(new NextRequest("http://localhost/api/c/x/consent", { method: "POST", body: JSON.stringify({ accepted: true }) }), { params });
    expect(res.status).toBe(200);
    expect(h.recordConsent).toHaveBeenCalledWith(h.ctx, "ct-hiring", "127.0.0.1", "test", "tr");
  });

  it("records the language of the text the student was shown: English for German, Spanish and Arabic", async () => {
    for (const locale of ["de", "es", "ar"]) {
      h.recordConsent.mockClear();
      const ctx = { ...h.ctx, locale };
      h.ctx = ctx;
      await POST(new NextRequest("http://localhost/api/c/x/consent", { method: "POST", body: JSON.stringify({ accepted: true }) }), { params });
      expect(h.recordConsent).toHaveBeenCalledWith(ctx, "ct-hiring", "127.0.0.1", "test", "en");
    }
    h.ctx = { ...h.ctx, locale: "tr" };
  });

  it("records Turkish when a student in another language opened the Turkish text, and ignores that choice for English", async () => {
    h.ctx = { ...h.ctx, locale: "de" };
    await POST(new NextRequest("http://localhost/api/c/x/consent", { method: "POST", body: JSON.stringify({ accepted: true, shown: "tr" }) }), { params });
    expect(h.recordConsent).toHaveBeenLastCalledWith(h.ctx, "ct-hiring", "127.0.0.1", "test", "tr");
    h.ctx = { ...h.ctx, locale: "en" };
    await POST(new NextRequest("http://localhost/api/c/x/consent", { method: "POST", body: JSON.stringify({ accepted: true, shown: "tr" }) }), { params });
    expect(h.recordConsent).toHaveBeenLastCalledWith(h.ctx, "ct-hiring", "127.0.0.1", "test", "en");
    h.ctx = { ...h.ctx, locale: "tr" };
  });

  it("shows the English text to a German student", async () => {
    h.ctx = { ...h.ctx, locale: "de" };
    const res = await GET(new NextRequest("http://localhost/api/c/x/consent"), { params });
    expect(await res.json()).toMatchObject({ body: "Hiring text" });
    h.ctx = { ...h.ctx, locale: "tr" };
  });
});
