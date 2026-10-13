import { afterEach, describe, expect, it, vi } from "vitest";
import tr from "@/i18n/messages/candidate.tr.json";
import en from "@/i18n/messages/candidate.en.json";
import { apiGet, apiSend, isNetworkFailure, pageLocale } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A document whose candidate frame says `lang`; node has no DOM of its own. */
function stubDocument(lang: string | null) {
  vi.stubGlobal("document", {
    querySelector: (selector: string) => (selector === "body [lang]" && lang ? { getAttribute: () => lang } : null),
    documentElement: { lang: "tr" },
  });
}

describe("network failures never show the browser's own words", () => {
  it.each([
    ["Chrome and Edge", "Failed to fetch"],
    ["Safari", "Load failed"],
    ["Firefox", "NetworkError when attempting to fetch resource."],
  ])("%s: %s becomes the Turkish sentence with a NETWORK code", async (_browser, text) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError(text)));
    const err = await apiGet("t".repeat(24), "/state").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(tr.visual.networkError);
    expect((err as Error).message).not.toContain(text);
    expect((err as { code: string }).code).toBe("NETWORK");
    expect((err as { status: number }).status).toBe(0);
  });

  it("speaks the candidate's language when the frame is in English", async () => {
    stubDocument("en");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await apiSend("t".repeat(24), "/consent", { accepted: true }).catch((e: unknown) => e);
    expect((err as Error).message).toBe(en.visual.networkError);
  });

  it("lets every other rejection through unchanged (an abort is the caller's own doing)", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(apiGet("t".repeat(24), "/state")).rejects.toBe(abort);
    expect(isNetworkFailure(new TypeError("x is not a function"))).toBe(false);
    expect(isNetworkFailure(new Error("Failed to fetch"))).toBe(false);
  });

  it("keeps the server's own message for an answered error, and a localized fallback when it has none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "EXPIRED", message: "Bu linkin süresi dolmuş." }), { status: 410 })));
    const answered = await apiGet("t".repeat(24), "/state").catch((e: unknown) => e);
    expect((answered as Error).message).toBe("Bu linkin süresi dolmuş.");
    expect((answered as { code: string }).code).toBe("EXPIRED");

    stubDocument("en");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })));
    const bare = await apiGet("t".repeat(24), "/state").catch((e: unknown) => e);
    expect((bare as Error).message).toBe(en.common.somethingWrong);
    expect((bare as { code: string }).code).toBe("UNKNOWN");
  });
});

describe("pageLocale", () => {
  it("reads the candidate frame, falls back to Turkish without a DOM or for a language the product does not ship", () => {
    expect(pageLocale()).toBe("tr");
    stubDocument("en");
    expect(pageLocale()).toBe("en");
    stubDocument("de");
    expect(pageLocale()).toBe("tr");
  });
});
