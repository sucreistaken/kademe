import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  key: null as string | null,
  open: vi.fn(),
  lookup: vi.fn(),
  options: undefined as unknown,
}));

vi.mock("@/lib/exam-candidate-api", () => ({
  withExamCandidate: (req: Request, _params: unknown, handler: (r: Request, ctx: unknown) => Promise<Response>, options?: unknown) => {
    h.options = options;
    return handler(req, { assessment: { id: "a1" } });
  },
}));
vi.mock("@/lib/exam/served-image", () => ({
  servedImageKey: async (...args: unknown[]) => {
    h.lookup(...args);
    return h.key;
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ openStream: h.open }) }));

import { NextRequest } from "next/server";
import { GET } from "./route";

const call = (sequence: string, slot: string, position = "2") =>
  GET(new NextRequest(`http://localhost/api/c/t/exam/image/${position}/${sequence}/${slot}`), { params: Promise.resolve({ token: "t".repeat(43), position, sequence, slot }) });

beforeEach(() => {
  h.key = null;
  h.open.mockReset();
  h.lookup.mockReset();
  h.open.mockResolvedValue({ bytes: 3, totalBytes: 3, stream: new Response(new Uint8Array([1, 2, 3])).body });
});

describe("GET /exam/image/[sequence]/[slot]", () => {
  it("streams the picture as webp, privately cached, without leaking the key", async () => {
    h.key = "bank/images/0123456789abcdef.webp";
    const res = await call("4", "o0a1b2");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect([...res.headers.entries()].join(" ")).not.toContain("bank/images");
    expect(res.headers.get("location")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(h.lookup).toHaveBeenCalledWith({ assessment: { id: "a1" } }, 2, 4, "o0a1b2");
    expect(h.open).toHaveBeenCalledWith("bank/images/0123456789abcdef.webp");
  });

  it("uses one fixed rate limit bucket, not one per URL", async () => {
    await call("1", "p0");
    expect(h.options).toEqual({ rateKey: "exam-image" });
  });

  it("answers 404 for a sequence or slot that does not resolve (not served yet, not a picture)", async () => {
    const res = await call("9", "p0");
    expect(res.status).toBe(404);
    expect(h.open).not.toHaveBeenCalled();
  });

  it.each([
    ["abc", "p0"],
    ["-1", "p0"],
    ["1", "../x"],
    ["1", "P0"],
    ["1", ""],
  ])("answers 404 for malformed input %s / %s without a lookup", async (sequence, slot) => {
    h.key = "bank/images/0123456789abcdef.webp";
    const res = await call(sequence, slot);
    expect(res.status).toBe(404);
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it("answers 404 for a malformed section position without a lookup", async () => {
    h.key = "bank/images/0123456789abcdef.webp";
    expect((await call("1", "p0", "x")).status).toBe(404);
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it("answers 404 when the object is missing in storage", async () => {
    h.key = "bank/images/0123456789abcdef.webp";
    h.open.mockRejectedValue(new Error("ENOENT"));
    expect((await call("1", "p0")).status).toBe(404);
  });
});
