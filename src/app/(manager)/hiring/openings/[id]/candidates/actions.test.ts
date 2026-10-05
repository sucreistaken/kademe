import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatInviteDeadline } from "@/solutions/hiring/rules/invitation";
import { zoneLabel } from "@/lib/org-timezone";

const h = vi.hoisted(() => ({
  gate: { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op" } } as Record<string, unknown>,
  /** runningOpening: the rights without the status (Task 18 fix round 1). */
  run: { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op" } } as Record<string, unknown>,
  newLink: vi.fn(),
  extend: vi.fn(),
  mark: vi.fn(async () => true),
  locale: "tr",
  redirected: "",
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirected = to;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => h.locale }));
vi.mock("../access", () => ({ editableOpening: async () => h.gate, runningOpening: async () => h.run }));
vi.mock("@/solutions/hiring/server/invitations", () => ({ newHiringLink: h.newLink, extendHiringLink: h.extend, markRequestHandled: h.mark }));

import { extendHiringLinkAction, markRequestAction, newLinkAction } from "./actions";

const OK_GATE = { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op" } };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  h.gate = { ...OK_GATE };
  h.run = { ...OK_GATE };
  h.newLink.mockReset();
  h.extend.mockReset();
  h.mark.mockReset();
  h.mark.mockResolvedValue(true);
  h.locale = "tr";
  h.redirected = "";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("newLinkAction", () => {
  it("asks the right to run the opening first and passes the session's user", async () => {
    h.run = { ok: false, code: "FORBIDDEN" };
    expect(await newLinkAction("op", "a1")).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(h.newLink).not.toHaveBeenCalled();
    h.run = { ...OK_GATE };
    h.newLink.mockResolvedValue({ ok: true, url: "https://k/a/y", expiresAt: new Date("2026-10-19T20:59:59Z"), name: "Elif Kaya", message: { subject: "s", body: "b" } });
    // The last day reads as in the ready message: the end of the day in the organisation's zone (ruling 6, Task 17 ruling 4).
    expect(await newLinkAction("op", "a1")).toEqual({
      ok: true,
      url: "https://k/a/y",
      expires: formatInviteDeadline("2026-10-19", "tr", zoneLabel("tr")),
      name: "Elif Kaya",
      message: { subject: "s", body: "b" },
    });
    expect(h.newLink).toHaveBeenCalledWith({ id: "u", orgId: "o" }, "op", "a1");
  });

  it("answers in the manager's language and passes refusals through", async () => {
    h.locale = "en";
    h.newLink.mockResolvedValue({ ok: true, url: "u", expiresAt: new Date("2026-10-19T20:59:59Z"), name: "N", message: { subject: "s", body: "b" } });
    expect(await newLinkAction("op", "a1")).toMatchObject({ expires: formatInviteDeadline("2026-10-19", "en", zoneLabel("en")) });
    h.newLink.mockResolvedValue({ ok: false, code: "COMPLETED" });
    expect(await newLinkAction("op", "a1")).toEqual({ ok: false, code: "COMPLETED" });
  });

  it("refuses a reviewer and malformed input before anything is written, and never shows a raw error", async () => {
    h.run = { ok: false, code: "FORBIDDEN" };
    expect(await newLinkAction("op", "a1")).toEqual({ ok: false, code: "FORBIDDEN" });
    h.run = { ok: false, code: "NOT_FOUND" };
    expect(await newLinkAction("op", "a1")).toEqual({ ok: false, code: "NOT_FOUND" });
    h.run = { ...OK_GATE };
    expect(await newLinkAction(42 as unknown as string, "a1")).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(h.newLink).not.toHaveBeenCalled();
    h.newLink.mockRejectedValue(new Error('relation "assessment_links" does not exist'));
    expect(await newLinkAction("op", "a1")).toEqual({ ok: false, code: "FAILED" });
  });
});

describe("newLinkAction on a closed opening (Task 7 ruling, Task 18 fix round 1)", () => {
  it("does not stop at the opening's status: newHiringLink lets a started candidate finish", async () => {
    // editableOpening would answer CLOSED; the new link goes through runningOpening instead.
    h.gate = { ok: false, code: "CLOSED" };
    h.run = { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op", status: "CLOSED" } };
    h.newLink.mockResolvedValue({ ok: true, url: "https://k/a/z", expiresAt: new Date("2026-10-12T20:59:59Z"), name: "Elif Kaya", message: { subject: "s", body: "b" } });
    expect(await newLinkAction("op", "a1")).toMatchObject({ ok: true, url: "https://k/a/z" });
    expect(h.newLink).toHaveBeenCalledWith({ id: "u", orgId: "o" }, "op", "a1");
  });

  it("passes newHiringLink's refusal for a candidate who has not started", async () => {
    h.run = { ok: true, user: { id: "u", orgId: "o" }, opening: { id: "op", status: "CLOSED" } };
    h.newLink.mockResolvedValue({ ok: false, code: "CLOSED" });
    expect(await newLinkAction("op", "a1")).toEqual({ ok: false, code: "CLOSED" });
  });

  it("still refuses an extension on a closed opening", async () => {
    h.gate = { ok: false, code: "CLOSED" };
    await expect(extendHiringLinkAction(form({ openingId: "op", assessmentId: "a1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.extend).not.toHaveBeenCalled();
    expect(h.redirected).toBe("/hiring/openings/op/candidates?extend=closed");
  });
});

describe("extendHiringLinkAction (ruling C8)", () => {
  it("extends through the opening's edit right and comes back with a notice", async () => {
    h.extend.mockResolvedValue({ ok: true, expiresAt: new Date("2026-10-19T20:59:59Z") });
    await expect(extendHiringLinkAction(form({ openingId: "op", assessmentId: "a1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.extend).toHaveBeenCalledWith({ id: "u", orgId: "o" }, "op", "a1");
    expect(h.redirected).toBe("/hiring/openings/op/candidates?extended=1");
  });

  it.each([
    ["a closed opening", { ok: false, code: "CLOSED" }, "closed"],
    ["a reviewer", { ok: false, code: "FORBIDDEN" }, "forbidden"],
    ["an unknown opening", { ok: false, code: "NOT_FOUND" }, "notfound"],
  ] as const)("refuses %s before reading the link", async (_label, gate, notice) => {
    h.gate = { ...gate };
    await expect(extendHiringLinkAction(form({ openingId: "op", assessmentId: "a1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.extend).not.toHaveBeenCalled();
    expect(h.redirected).toBe(`/hiring/openings/op/candidates?extend=${notice}`);
  });

  it("says why the link was not extended, and answers a failure calmly", async () => {
    h.extend.mockResolvedValue({ ok: false, code: "STARTED" });
    await expect(extendHiringLinkAction(form({ openingId: "op", assessmentId: "a1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.redirected).toBe("/hiring/openings/op/candidates?extend=started");
    h.extend.mockRejectedValue(new Error("boom"));
    await expect(extendHiringLinkAction(form({ openingId: "op", assessmentId: "a1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.redirected).toBe("/hiring/openings/op/candidates?extend=failed");
  });
});

describe("markRequestAction", () => {
  it("closes the request for this opening and comes back with a notice", async () => {
    await expect(markRequestAction(form({ openingId: "op", requestId: "r1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.mark).toHaveBeenCalledWith({ id: "u", orgId: "o" }, "op", "r1");
    expect(h.redirected).toBe("/hiring/openings/op/candidates?handled=1");
  });

  it("refuses without the edit right, and says so when the request is not this opening's or the write fails", async () => {
    h.gate = { ok: false, code: "FORBIDDEN" };
    await expect(markRequestAction(form({ openingId: "op", requestId: "r1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.mark).not.toHaveBeenCalled();
    expect(h.redirected).toBe("/hiring/openings/op/candidates?request=forbidden");
    h.gate = { ...OK_GATE };
    h.mark.mockResolvedValue(false);
    await expect(markRequestAction(form({ openingId: "op", requestId: "r1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.redirected).toBe("/hiring/openings/op/candidates?request=notfound");
    h.mark.mockRejectedValue(new Error("boom"));
    await expect(markRequestAction(form({ openingId: "op", requestId: "r1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.redirected).toBe("/hiring/openings/op/candidates?request=failed");
  });
});
