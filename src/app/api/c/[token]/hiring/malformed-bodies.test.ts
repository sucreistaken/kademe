import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every hiring candidate route that reads a body maps a body that is not its
 * shape to its documented 400 before the server is asked to do anything
 * (stage/submit and survey have their own route tests).
 */
const h = vi.hoisted(() => {
  const unexpected = (name: string) => vi.fn(async () => {
    throw new Error(`${name} must not be called for a malformed body`);
  });
  return {
    hctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, locale: "tr", hiring: { versionId: "v" } },
    server: {
      setExtraTime: unexpected("setExtraTime"),
      openUpload: unexpected("openUpload"),
      saveResponse: unexpected("saveResponse"),
      commitResponse: unexpected("commitResponse"),
      startStage: unexpected("startStage"),
      loadHiringState: unexpected("loadHiringState"),
      loadHiringContext: vi.fn(),
    },
  };
});

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/solutions/hiring/server/candidate", () => h.server);
vi.mock("@/lib/candidate-api", () => ({
  // As the real readJson: an unparsable body reads as null.
  readJson: async (req: Request) => req.json().catch(() => null),
  message: (_locale: string, code: string) => code,
  fail: (_ctx: unknown, code: string, status: number) => Response.json({ error: code }, { status }),
  notFoundForSolution: () => Response.json({ error: "INVALID" }, { status: 404 }),
  withCandidate: () => {
    throw new Error("withHiringCandidate is replaced in this test");
  },
}));
vi.mock("@/solutions/hiring/server/candidate-route", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/solutions/hiring/server/candidate-route")>()),
  withHiringCandidate: (req: unknown, _p: unknown, handler: (r: unknown, c: unknown) => unknown) => handler(req, h.hctx),
}));

import { NextRequest } from "next/server";
import * as extraTime from "./extra-time/route";
import * as mediaInit from "./media/init/route";
import * as response from "./response/route";
import * as commit from "./response/commit/route";
import * as start from "./stage/start/route";

type Handler = (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => Promise<Response>;

const routes: Array<[string, Handler, "POST" | "PUT", string]> = [
  ["POST /hiring/extra-time", extraTime.POST, "POST", "EXTRA_TIME_INVALID"],
  ["POST /hiring/media/init", mediaInit.POST, "POST", "REQUEST_INVALID"],
  ["PUT /hiring/response", response.PUT, "PUT", "REQUEST_INVALID"],
  ["POST /hiring/response (beacon)", response.POST, "POST", "REQUEST_INVALID"],
  ["POST /hiring/response/commit", commit.POST, "POST", "REQUEST_INVALID"],
  ["POST /hiring/stage/start", start.POST, "POST", "REQUEST_INVALID"],
];

/** Bodies no hiring route accepts: not JSON, not an object, and objects of the wrong shape for every route. */
const malformed: Array<[string, string]> = [
  ["not JSON", "{not json"],
  ["empty", ""],
  ["null", "null"],
  ["a number", "7"],
  ["a string", JSON.stringify("1")],
  ["an array", "[]"],
  ["a position as text", JSON.stringify({ stagePosition: "1", activityId: "a1", pct: "25", kind: "recording", mime: "video/webm" })],
];

const call = (handler: Handler, method: "POST" | "PUT", body: string) =>
  handler(new NextRequest("http://localhost/x", { method, body }), { params: Promise.resolve({ token: "t".repeat(43) }) });

beforeEach(() => {
  for (const fn of Object.values(h.server)) fn.mockClear();
});

describe.each(routes)("%s", (_name, handler, method, code) => {
  it.each(malformed)(`answers a malformed body (%s) with 400 ${code}, asking the server nothing`, async (_label, body) => {
    const res = await call(handler, method, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: code });
    for (const [name, fn] of Object.entries(h.server)) if (name !== "loadHiringContext") expect(fn, name).not.toHaveBeenCalled();
  });
});
