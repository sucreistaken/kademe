import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, type Op } from "@/solutions/hiring/server/test-fake-db";
import type { OpeningListRow } from "@/solutions/hiring/server/openings";

vi.mock("@/db", async () => ({ db: (await import("@/solutions/hiring/server/test-fake-db")).fakeDb() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const D1 = "21111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const O1 = "33333333-3333-4333-8333-333333333333";
const C1 = "44444444-4444-4444-8444-444444444444";

const listed = (id: string, status: OpeningListRow["status"], over: Partial<OpeningListRow> = {}): OpeningListRow => ({
  id,
  name: id,
  status,
  deadlineAt: null,
  positionName: "P",
  ownerName: null,
  liveNumber: status === "DRAFT" ? null : 1,
  draftNumber: null,
  decisionMakerId: null,
  memberIds: [],
  ...over,
});
const lists = vi.hoisted(() => ({ byStatus: {} as Record<string, unknown[]> }));
vi.mock("@/solutions/hiring/server/openings", () => ({ listOpenings: async (_org: string, _viewer: unknown, status: string) => lists.byStatus[status] ?? [] }));
const reads = vi.hoisted(() => ({ working: vi.fn(async () => ({})), people: vi.fn(async (): Promise<unknown[]> => []) }));
vi.mock("@/solutions/hiring/server/working", () => ({ workingState: reads.working }));
vi.mock("@/server/settings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/settings")>()), loadPanelUsers: reads.people }));
vi.mock("./[id]/setup-steps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./[id]/setup-steps")>()),
  // Two steps: the assessment is done, the team is advice.
  setupRowsOf: () => [
    { key: "assessment", state: "done", href: null },
    { key: "team", state: "advisory", href: `/hiring/openings/x/settings#team-members` },
  ],
}));

import { managerT } from "@/i18n/manager";
import { loadCockpit, SETUP_BUDGET_MS } from "./cockpit";

function respond(op: Op): unknown[] {
  if (op.table === "hiring_assessments") return [{ assessmentId: "a1", openingId: O1, candidateId: "c1" }];
  if (op.table === "candidate_requests") return [{ assessmentId: "a1" }];
  if (op.table === "hiring_openings") return [{ id: O1, name: "O1", deadlineAt: null }];
  if (op.table === "hiring_versions") return [{ openingId: O1 }];
  if (op.table === "hiring_opening_members") return [{ openingId: O1, count: 1 }];
  return [];
}

const owner = { id: "u1", orgId: ORG, role: "OWNER" as const };
const reviewer = { id: "u2", orgId: ORG, role: "REVIEWER" as const };

beforeEach(() => {
  lists.byStatus = { DRAFT: [listed(D1, "DRAFT"), listed(D2, "DRAFT")], OPEN: [listed(O1, "OPEN")], CLOSED: [] };
  reads.working.mockClear();
  reads.people.mockClear();
  reads.people.mockResolvedValue([]);
  fake.ops = [];
  fake.respond = respond;
});

describe("the openings' control view (4.4, H9, D14)", () => {
  it("someone who runs openings: a draft's setup count and next step, a live opening's requests first", async () => {
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr");
    expect(cockpit.runs).toBe(true);
    expect(cockpit.drafts.map((r) => [r.setup, r.next.kind, r.next.setupKey])).toEqual([
      [{ done: 1, total: 3 }, "setup", "team"],
      [{ done: 1, total: 3 }, "setup", "team"],
    ]);
    expect(cockpit.open[0]).toMatchObject({ facts: { invited: 1, requests: { open: 1, rights: 0 } }, noTeam: false, next: { kind: "requests" } });
    expect(reads.people).toHaveBeenCalledTimes(1);
  });

  it("a reviewer: counts only, no request field, no setup, no team check, every row 'Aç' (H9, STATUS 321)", async () => {
    const cockpit = await loadCockpit(reviewer, managerT("tr"), "tr");
    const rows = [...cockpit.drafts, ...cockpit.open];
    expect(rows.map((r) => r.next.kind)).toEqual(["open", "open", "open"]);
    expect(cockpit.open[0].facts).not.toHaveProperty("requests");
    expect(rows.every((r) => r.setup === null && r.noTeam === false)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("requests");
    expect(fake.ops.some((o) => o.table === "candidate_requests" || o.table === "deletion_requests" || o.table === "hiring_openings")).toBe(false);
    expect(reads.working).not.toHaveBeenCalled();
    expect(reads.people).not.toHaveBeenCalled();
  });

  it("stops reading setup paths past the time budget; the rest say 'Kuruluma devam et' without a count (D14)", async () => {
    let now = 0;
    const clock = () => (now += SETUP_BUDGET_MS);
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr", clock);
    expect(cockpit.drafts.map((r) => [r.setup?.total ?? null, r.next.kind])).toEqual([
      [3, "setup"],
      [null, "continueSetup"],
    ]);
    expect(reads.working).toHaveBeenCalledTimes(1);
  });

  it("a live opening with no active evaluator: the team line and the team step, counted as waiting (4.4 (2), KG3)", async () => {
    fake.respond = (op) => (op.table === "candidate_requests" || op.table === "hiring_opening_members" ? [] : respond(op));
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr");
    expect(cockpit.open[0]).toMatchObject({ noTeam: true, next: { kind: "team", href: `/hiring/openings/${O1}/settings#team-members` } });
  });

  it("a live opening whose last day passed: the deadline step to the contact flow, after what waits already (B-M3)", async () => {
    const past = new Date("2020-01-10T20:59:59Z");
    fake.respond = (op) =>
      op.table === "candidate_requests" ? [] : op.table === "hiring_opening_members" ? [{ openingId: O1, count: 3 }] : op.table === "hiring_openings" ? [{ id: O1, name: "O1", deadlineAt: past }] : respond(op);
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr");
    expect(cockpit.open[0]).toMatchObject({ noTeam: false, deadlinePassed: true, next: { kind: "deadline", href: `/hiring/openings/${O1}/settings#contact-deadline` } });
    // A reviewer reads no invite form, so nothing about it (H9).
    expect((await loadCockpit(reviewer, managerT("tr"), "tr")).open[0]).toMatchObject({ deadlinePassed: false, next: { kind: "open" } });
  });

  it("a live opening with a waiting draft: 'Kuruluma devam et' to the draft's next setup step, inside the same budget (B-M10, KG3)", async () => {
    lists.byStatus = { DRAFT: [listed(D1, "DRAFT")], OPEN: [listed(O1, "OPEN", { draftNumber: 2 })], CLOSED: [] };
    fake.respond = (op) => (op.table === "candidate_requests" ? [] : op.table === "hiring_opening_members" ? [{ openingId: O1, count: 3 }] : respond(op));
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr");
    expect(cockpit.open[0]).toMatchObject({ setup: null, next: { kind: "draft", href: "/hiring/openings/x/settings#team-members" } });
    expect(reads.working).toHaveBeenCalledTimes(2);
    // Past the budget (the setup drafts first), the row keeps "Kuruluma devam et" to the overview.
    reads.working.mockClear();
    let now = 0;
    const late = await loadCockpit(owner, managerT("tr"), "tr", () => (now += SETUP_BUDGET_MS));
    expect(late.open[0].next).toEqual({ kind: "draft", href: `/hiring/openings/${O1}` });
    expect(reads.working).toHaveBeenCalledTimes(1);
  });

  it("reads no facts for closed openings and gives their row one action, 'Aç' (4.4, KG1)", async () => {
    lists.byStatus.CLOSED = [listed(C1, "CLOSED")];
    const cockpit = await loadCockpit(owner, managerT("tr"), "tr");
    expect(cockpit.closed[0]).toMatchObject({ facts: null, noTeam: false, setup: null, next: { kind: "open", href: `/hiring/openings/${C1}` } });
    const invitations = fake.ops.find((o) => o.table === "hiring_assessments")!;
    expect(invitations.params).toContain(O1);
    expect(invitations.params).not.toContain(C1);
  });

  it("counts the team as its active members, the people the team rule counts; a reviewer's count is the listed members (H9)", async () => {
    reads.people.mockResolvedValue([
      { id: "u1", role: "OWNER", disabledAt: null },
      { id: "u3", role: "REVIEWER", disabledAt: new Date("2026-10-01T00:00:00Z") },
    ]);
    lists.byStatus = { DRAFT: [], OPEN: [listed(O1, "OPEN", { memberIds: ["u1", "u3"] })], CLOSED: [] };
    expect((await loadCockpit(owner, managerT("tr"), "tr")).open[0].team).toEqual({ count: 1, onlyYou: true });
    expect((await loadCockpit(reviewer, managerT("tr"), "tr")).open[0].team).toEqual({ count: 2, onlyYou: false });
  });
});
