import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, type Op } from "@/solutions/hiring/server/test-fake-db";
import type { OpeningListRow } from "@/solutions/hiring/server/openings";

vi.mock("@/db", async () => ({ db: (await import("@/solutions/hiring/server/test-fake-db")).fakeDb() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const D1 = "21111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const O1 = "33333333-3333-4333-8333-333333333333";

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
const reads = vi.hoisted(() => ({ working: vi.fn(async () => ({})), people: vi.fn(async () => []) }));
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
  if (op.table === "hiring_openings") return [{ id: O1, name: "O1", deadlineAt: null, minEvaluations: 3 }];
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
    expect(cockpit.open[0]).toMatchObject({ facts: { invited: 1, requests: { open: 1, rights: 0 } }, shortfall: { evaluators: 1, min: 3 }, next: { kind: "requests" } });
    expect(reads.people).toHaveBeenCalledTimes(1);
  });

  it("a reviewer: counts only, no request field, no setup, no team rule, every row 'Aç' (H9, STATUS 321)", async () => {
    const cockpit = await loadCockpit(reviewer, managerT("tr"), "tr");
    const rows = [...cockpit.drafts, ...cockpit.open];
    expect(rows.map((r) => r.next.kind)).toEqual(["open", "open", "open"]);
    expect(cockpit.open[0].facts).not.toHaveProperty("requests");
    expect(rows.every((r) => r.setup === null && r.shortfall === null)).toBe(true);
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
});
