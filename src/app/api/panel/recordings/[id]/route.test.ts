import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Segment playback for the panel: a session, a role that may watch
 * recordings, and the viewer's own organisation, on every request. The
 * organisation scoping itself is in the query (src/server/recordings.test.ts);
 * here the route has to pass the viewer's organisation and refuse the rest.
 */

const h = vi.hoisted(() => ({
  user: null as null | { id: string; orgId: string; role: "OWNER" | "MANAGER" | "REVIEWER" },
  allow: true,
  segment: null as null | { storageKey: string; mime: string; bytes: number },
  findArgs: [] as unknown[],
  openStream: vi.fn(),
}));

vi.mock("@/server/session", () => ({ currentUser: async () => h.user }));
vi.mock("@/lib/authorize", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/authorize")>();
  return { ...actual, can: (user: { role: "OWNER" }, cap: "media:view") => h.allow && actual.can(user, cap) };
});
vi.mock("@/server/recordings", () => ({
  findSegmentForViewer: async (...args: unknown[]) => {
    h.findArgs = args;
    return h.segment;
  },
}));
vi.mock("@/lib/storage", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/storage")>();
  return { RangeNotSatisfiableError: actual.RangeNotSatisfiableError, getStorage: () => ({ openStream: h.openStream }) };
});

import { NextRequest } from "next/server";
import { RangeNotSatisfiableError } from "@/lib/storage";
import { GET } from "./route";

const ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const get = (headers: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost/api/panel/recordings/${ID}`, { headers }), { params: Promise.resolve({ id: ID }) });
const body = (bytes: number) => new Blob([new Uint8Array(bytes)]).stream();

beforeEach(() => {
  h.user = { id: "u1", orgId: "org-1", role: "REVIEWER" };
  h.allow = true;
  h.segment = { storageKey: "proctor/org-1/asm/rec/att/camera-run-00001.webm", mime: "video/webm", bytes: 1000 };
  h.findArgs = [];
  h.openStream.mockReset();
  h.openStream.mockImplementation(async (_key: string, range?: { start: number; end: number }) =>
    range ? { bytes: Math.min(range.end, 999) - range.start + 1, totalBytes: 1000, stream: body(100) } : { bytes: 1000, totalBytes: 1000, stream: body(1000) },
  );
});

describe("GET /api/panel/recordings/[id]", () => {
  it("answers 401 without a session and reads nothing", async () => {
    h.user = null;
    expect((await get()).status).toBe(401);
    expect(h.openStream).not.toHaveBeenCalled();
  });

  it("answers 403 to a role that may not watch recordings", async () => {
    h.allow = false;
    expect((await get()).status).toBe(403);
    expect(h.openStream).not.toHaveBeenCalled();
  });

  it("looks the segment up in the viewer's own organisation and answers 404 for anyone else's", async () => {
    h.segment = null;
    const res = await get();
    expect(res.status).toBe(404);
    expect(h.findArgs).toEqual(["org-1", ID]);
    expect(h.openStream).not.toHaveBeenCalled();
  });

  it("streams the whole segment as a private, unsniffable video", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/webm");
    expect(res.headers.get("content-length")).toBe("1000");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toMatch(/^private/);
    expect(h.openStream).toHaveBeenCalledWith(h.segment!.storageKey, undefined);
  });

  it("answers a seek's range request with 206 and a content range", async () => {
    const res = await get({ range: "bytes=100-199" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 100-199/1000");
    expect(res.headers.get("content-length")).toBe("100");
  });

  it("answers 416 to a range past the end", async () => {
    h.openStream.mockRejectedValueOnce(new RangeNotSatisfiableError("k", 1000));
    const res = await get({ range: "bytes=5000-" });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */1000");
  });

  it("lets every panel role that holds media:view watch (owner, manager, reviewer)", async () => {
    for (const role of ["OWNER", "MANAGER", "REVIEWER"] as const) {
      h.user = { id: "u1", orgId: "org-1", role };
      expect((await get()).status).toBe(200);
    }
  });
});
