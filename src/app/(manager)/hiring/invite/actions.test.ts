import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatInviteDeadline } from "@/solutions/hiring/rules/invitation";
import { zoneLabel } from "@/lib/org-timezone";
import type { InviteInput, InviteOutcome } from "@/solutions/hiring/server/invitations";

const h = vi.hoisted(() => ({
  user: { id: "u", orgId: "o", email: "", name: "", role: "MANAGER" as "OWNER" | "MANAGER" | "REVIEWER" },
  opening: { id: "11111111-1111-4111-8111-111111111111", status: "OPEN", deadlineAt: null, decisionMakerId: null, backupDecisionMakerId: null, memberIds: [] as string[] } as Record<string, unknown> | null,
  locale: "tr" as "tr" | "en",
}));
const create = vi.hoisted(() => vi.fn<(user: { id: string; orgId: string }, input: InviteInput) => Promise<InviteOutcome>>());
const load = vi.hoisted(() => vi.fn(async (orgId: string, id: string) => (h.opening && orgId === "o" && id === h.opening.id ? h.opening : null)));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/server/session", () => ({ requireUser: async () => h.user }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => h.locale }));
vi.mock("@/solutions/hiring/server/openings", () => ({ loadOpening: load }));
vi.mock("@/solutions/hiring/server/invitations", () => ({ createHiringInvitation: create }));

import { inviteCandidateAction, inviteManyAction } from "./actions";

const OPENING = "11111111-1111-4111-8111-111111111111";
const input = { openingId: OPENING, fullName: "Elif Kaya", email: "elif@example.com", locale: "tr", deadline: null };
const okOutcome: InviteOutcome = { ok: true, assessmentId: "a", candidateId: "c", url: "https://k/a/x", expiresAt: new Date("2026-10-19T20:59:59Z"), message: { subject: "s", body: "b" } };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T09:00:00Z"));
  h.user.role = "MANAGER";
  h.locale = "tr";
  h.opening = { id: OPENING, status: "OPEN", deadlineAt: null, decisionMakerId: null, backupDecisionMakerId: null, memberIds: [] };
  create.mockReset();
  create.mockResolvedValue(okOutcome);
  load.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("inviteCandidateAction", () => {
  it("refuses a reviewer before anything is read or written", async () => {
    h.user.role = "REVIEWER";
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(load).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("reads the opening in the session's organisation only", async () => {
    await inviteCandidateAction(input);
    expect(load).toHaveBeenCalledWith("o", OPENING);
  });

  it("refuses a closed opening and an opening of another organisation", async () => {
    h.opening = { ...h.opening!, status: "CLOSED" };
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "CLOSED" });
    h.opening = null;
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses an opening whose own deadline is behind today (in the organisation's zone), and takes one ending today", async () => {
    h.opening = { ...h.opening!, deadlineAt: new Date("2026-10-04T20:59:59Z") };
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "OPENING_DEADLINE_PASSED" });
    expect(create).not.toHaveBeenCalled();
    h.opening = { ...h.opening!, deadlineAt: new Date("2026-10-05T20:59:59Z") };
    expect((await inviteCandidateAction(input)).ok).toBe(true);
  });

  it("refuses a chosen last day before today, and takes today", async () => {
    expect(await inviteCandidateAction({ ...input, deadline: "2026-10-04" })).toEqual({ ok: false, code: "DEADLINE_PAST" });
    expect(create).not.toHaveBeenCalled();
    expect((await inviteCandidateAction({ ...input, deadline: "2026-10-05" })).ok).toBe(true);
  });

  it("invites with the session's organisation and user, and gives the link once with its last day as the message states it", async () => {
    const result = await inviteCandidateAction(input);
    expect(create).toHaveBeenCalledWith({ id: "u", orgId: "o" }, { openingId: OPENING, fullName: "Elif Kaya", email: "elif@example.com", locale: "tr", deadline: null, allowDuplicate: false });
    expect(result).toEqual({ ok: true, url: "https://k/a/x", name: "Elif Kaya", expires: formatInviteDeadline("2026-10-19", "tr", zoneLabel("tr")), message: { subject: "s", body: "b" } });
    expect(result.ok && result.expires.startsWith("19 Eki 23:59 (")).toBe(true);
  });

  it("states the last day in the manager's language", async () => {
    h.locale = "en";
    const result = await inviteCandidateAction(input);
    expect(result.ok && result.expires).toBe(formatInviteDeadline("2026-10-19", "en", zoneLabel("en")));
  });

  it("names a repeated e-mail with the day of the first invitation, and passes the manager's 'invite anyway'", async () => {
    create.mockResolvedValueOnce({ ok: false, code: "DUPLICATE", existing: { assessmentId: "x", invitedAt: new Date("2026-10-01T10:00:00Z") } });
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "DUPLICATE", existing: { invitedAt: "1 Eki" } });
    await inviteCandidateAction({ ...input, allowDuplicate: true });
    expect(create.mock.calls[1][1].allowDuplicate).toBe(true);
  });

  it("answers FAILED, never the raw error, when the write throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    create.mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await inviteCandidateAction(input)).toEqual({ ok: false, code: "FAILED" });
    spy.mockRestore();
  });

  it("refuses malformed input", async () => {
    expect(await inviteCandidateAction({ ...input, locale: "de" })).toEqual({ ok: false, code: "FAILED" });
    expect(await inviteCandidateAction({ ...input, openingId: "nope" })).toEqual({ ok: false, code: "FAILED" });
    expect(await inviteCandidateAction({ ...input, deadline: "5 Ekim" })).toEqual({ ok: false, code: "FAILED" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("inviteManyAction", () => {
  const many = { openingId: OPENING, locale: "en", deadline: null };

  it("invites each valid row on its own and reports each result, a repeated e-mail with its first day", async () => {
    create.mockResolvedValueOnce({ ok: false, code: "DUPLICATE", existing: { assessmentId: "x", invitedAt: new Date("2026-10-01T10:00:00Z") } });
    const { results } = await inviteManyAction({ ...many, text: "Elif Kaya, elif@example.com\nCan Demir, can@example.com\nBozuk, bozuk@" });
    expect(results.map((r) => [r.line, r.result.ok])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(results[0].result).toEqual({ ok: false, code: "DUPLICATE", existing: { invitedAt: "1 Eki" } });
    expect(create).toHaveBeenCalledTimes(2);
    // A pasted list never opens a second invitation of an e-mail already invited.
    expect(create.mock.calls.every(([, row]) => row.allowDuplicate === false && row.locale === "en")).toBe(true);
  });

  it("goes on after a row whose write throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    create.mockRejectedValueOnce(new Error("boom"));
    const { results } = await inviteManyAction({ ...many, text: "Elif Kaya, elif@example.com\nCan Demir, can@example.com" });
    expect(results.map((r) => r.result)).toEqual([{ ok: false, code: "FAILED" }, expect.objectContaining({ ok: true, name: "Can Demir" })]);
    spy.mockRestore();
  });

  it("reads at most MAX_INVITE_ROWS rows", async () => {
    const text = Array.from({ length: 60 }, (_, i) => `Aday ${i + 1}, aday${i + 1}@example.com`).join("\n");
    const { results } = await inviteManyAction({ ...many, text });
    expect(results).toHaveLength(50);
    expect(create).toHaveBeenCalledTimes(50);
  });

  it("takes a 700-line spreadsheet paste: the first MAX_INVITE_ROWS rows are invited, not a FAILED list (fix round 1)", async () => {
    const text = Array.from({ length: 700 }, (_, i) => `Aday Numara ${i + 1}\taday${i + 1}@example.com\tİstanbul\t+90 555 000 00 00\tNot: ${"x".repeat(20)}`).join("\r\n");
    expect(text.length).toBeGreaterThan(40_000);
    const { results } = await inviteManyAction({ ...many, text });
    expect(results).toHaveLength(50);
    expect(results.every((r) => r.result.ok)).toBe(true);
    expect(results.at(-1)!.line).toBe(50);
    expect(create).toHaveBeenCalledTimes(50);
  });

  it("still refuses a cut list longer than 50 rows can be (FAILED, line 0)", async () => {
    const text = Array.from({ length: 3 }, () => "x".repeat(30_000)).join("\n");
    expect(await inviteManyAction({ ...many, text })).toEqual({ results: [{ line: 0, fullName: "", email: "", result: { ok: false, code: "FAILED" } }] });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses the whole list once (line 0) for a reviewer, a closed opening, a passed deadline or a past chosen day", async () => {
    h.user.role = "REVIEWER";
    expect(await inviteManyAction({ ...many, text: "Elif Kaya, elif@example.com" })).toEqual({ results: [{ line: 0, fullName: "", email: "", result: { ok: false, code: "FORBIDDEN" } }] });
    h.user.role = "OWNER";
    h.opening = { ...h.opening!, status: "CLOSED" };
    expect((await inviteManyAction({ ...many, text: "Elif Kaya, elif@example.com" })).results[0].result).toEqual({ ok: false, code: "CLOSED" });
    h.opening = { ...h.opening!, status: "OPEN", deadlineAt: new Date("2026-10-01T20:59:59Z") };
    expect((await inviteManyAction({ ...many, text: "Elif Kaya, elif@example.com" })).results[0].result).toEqual({ ok: false, code: "OPENING_DEADLINE_PASSED" });
    h.opening = { ...h.opening!, deadlineAt: null };
    expect((await inviteManyAction({ ...many, deadline: "2026-10-01", text: "Elif Kaya, elif@example.com" })).results[0].result).toEqual({ ok: false, code: "DEADLINE_PAST" });
    expect(create).not.toHaveBeenCalled();
  });

  it("answers malformed input with FAILED (line 0), not with an empty list", async () => {
    expect(await inviteManyAction({ ...many, locale: "de", text: "Elif Kaya, elif@example.com" })).toEqual({ results: [{ line: 0, fullName: "", email: "", result: { ok: false, code: "FAILED" } }] });
  });
});
