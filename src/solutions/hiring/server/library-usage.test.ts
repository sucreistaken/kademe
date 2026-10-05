import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { hiringLibraryUsage, usageFromRows } from "./library-usage";

const ORG = "11111111-1111-4111-8111-111111111111";
const POSITION = "22222222-2222-4222-8222-222222222222";
const COMP = "33333333-3333-4333-8333-333333333333";
const O1 = "44444444-4444-4444-8444-444444444444";
const O2 = "55555555-5555-4555-8555-555555555555";
const O3 = "66666666-6666-4666-8666-666666666666";
const REVIEWER = { id: "77777777-7777-4777-8777-777777777777", role: "REVIEWER" as const };
const MANAGER = { id: "88888888-8888-4888-8888-888888888888", role: "MANAGER" as const };

const opening = (id: string, name: string, status: "DRAFT" | "OPEN" | "CLOSED", over: Record<string, unknown> = {}) => ({
  openingId: id,
  name,
  decisionMakerId: null,
  backupDecisionMakerId: null,
  ...over,
  status,
});

/** O1 open (reviewer is a member), O2 open (reviewer is the backup decision maker), O3 draft (reviewer not on it). */
function world(op: Op): unknown[] {
  if (op.table === "hiring_openings") {
    return [
      { ref: POSITION, ...opening(O1, "Tasarımcı · Ekim", "OPEN") },
      { ref: POSITION, ...opening(O2, "Destek · Kasım", "OPEN", { backupDecisionMakerId: REVIEWER.id }) },
      { ref: POSITION, ...opening(O3, "Gizli · Aralık", "DRAFT") },
    ];
  }
  if (op.table === "hiring_activity_competencies") {
    const row = (o: ReturnType<typeof opening>, versionStatus: "DRAFT" | "PUBLISHED") => ({
      ref: COMP,
      openingId: o.openingId,
      name: o.name,
      decisionMakerId: o.decisionMakerId,
      backupDecisionMakerId: o.backupDecisionMakerId,
      openingStatus: o.status,
      versionStatus,
    });
    return [
      row(opening(O1, "Tasarımcı · Ekim", "OPEN"), "PUBLISHED"),
      row(opening(O2, "Destek · Kasım", "OPEN", { backupDecisionMakerId: REVIEWER.id }), "DRAFT"),
      row(opening(O3, "Gizli · Aralık", "CLOSED"), "PUBLISHED"),
    ];
  }
  if (op.table === "hiring_opening_members") return [{ openingId: O1 }];
  return [];
}

beforeEach(() => {
  fake.ops.length = 0;
  fake.respond = world;
});

describe("hiring library usage", () => {
  it("counts each opening once per library row and marks it live when a published version of an open opening uses it", () => {
    const usage = usageFromRows([
      { ref: "c1", openingId: "o1", name: "Tasarımcı · Ekim", live: false, visible: true },
      { ref: "c1", openingId: "o1", name: "Tasarımcı · Ekim", live: true, visible: true },
      { ref: "c1", openingId: "o2", name: "Destek · Kasım", live: false, visible: true },
      { ref: "c2", openingId: "o2", name: "Destek · Kasım", live: false, visible: true },
    ]);
    expect(usage.c1).toEqual({
      total: 2,
      live: 1,
      items: [
        { label: "Tasarımcı · Ekim", href: "/hiring/openings/o1" },
        { label: "Destek · Kasım", href: "/hiring/openings/o2" },
      ],
    });
    expect(usage.c2.total).toBe(1);
    expect(usage.c2.live).toBe(0);
  });

  it("counts an opening the viewer may not see, but never names or links it", () => {
    const usage = usageFromRows([
      { ref: "c1", openingId: "o1", name: "Görünür", live: true, visible: true },
      { ref: "c1", openingId: "o2", name: "Gizli", live: true, visible: false },
    ]);
    expect(usage.c1).toEqual({ total: 2, live: 2, items: [{ label: "Görünür", href: "/hiring/openings/o1" }] });
  });

  it("reads openings and competency mappings scoped to the organisation, with the asked ids", async () => {
    await hiringLibraryUsage(ORG, { positionIds: [POSITION], competencyIds: [COMP] }, MANAGER);
    const positionsRead = fake.ops.find((o) => o.table === "hiring_openings")!;
    expect(positionsRead.where).toContain('"hiring_openings"."org_id" = $');
    expect(positionsRead.params).toEqual(expect.arrayContaining([ORG, POSITION]));
    const competencyRead = fake.ops.find((o) => o.table === "hiring_activity_competencies")!;
    expect(competencyRead.distinct).toBe(true);
    expect(competencyRead.where).toContain('"hiring_openings"."org_id" = $');
    expect(competencyRead.params).toEqual(expect.arrayContaining([ORG, COMP]));
    expect(competencyRead.joins.map((j) => j.split(" ")[0])).toEqual(["hiring_activities", "hiring_stages", "hiring_versions", "hiring_openings"]);
    expect(fake.ops.every((o) => o.kind === "select")).toBe(true);
  });

  it("maps live: a position counts its OPEN openings; a competency only a PUBLISHED version of an OPEN opening", async () => {
    const usage = await hiringLibraryUsage(ORG, { positionIds: [POSITION], competencyIds: [COMP] }, MANAGER);
    expect(usage.positions[POSITION]).toMatchObject({ total: 3, live: 2 });
    // O1 open + published: live. O2 open + draft: not. O3 closed + published: not.
    expect(usage.competencies[COMP]).toMatchObject({ total: 3, live: 1 });
    expect(usage.competencies[COMP].items.map((i) => i.label)).toEqual(["Tasarımcı · Ekim", "Destek · Kasım", "Gizli · Aralık"]);
  });

  it("lists for a reviewer only the openings they work on; the rest are counted, not named", async () => {
    const usage = await hiringLibraryUsage(ORG, { positionIds: [POSITION], competencyIds: [COMP] }, REVIEWER);
    expect(usage.positions[POSITION].total).toBe(3);
    expect(usage.positions[POSITION].items.map((i) => i.href)).toEqual([`/hiring/openings/${O1}`, `/hiring/openings/${O2}`]);
    expect(usage.competencies[COMP].items.map((i) => i.label)).toEqual(["Tasarımcı · Ekim", "Destek · Kasım"]);
    const members = fake.ops.find((o) => o.table === "hiring_opening_members")!;
    expect(members.where).toContain('"hiring_opening_members"."user_id" = $');
    expect(members.params).toContain(REVIEWER.id);
  });

  it("names nothing when no viewer is given (counts only)", async () => {
    const usage = await hiringLibraryUsage(ORG, { positionIds: [POSITION], competencyIds: [COMP] }, null);
    expect(usage.positions[POSITION]).toEqual({ total: 3, live: 2, items: [] });
    expect(usage.competencies[COMP].items).toEqual([]);
  });
});

describe("hiringLibraryUsage inside a caller's transaction (fix round 2)", () => {
  it("reads through the executor it is given, never the global db", async () => {
    const { db } = await import("@/db");
    const { fakeDb } = await import("./test-fake-db");
    const tx = fakeDb();
    const onTx = vi.spyOn(tx, "selectDistinct");
    const onTxSelect = vi.spyOn(tx, "select");
    const global = [vi.spyOn(db, "select"), vi.spyOn(db, "selectDistinct")];
    fake.respond = world;
    await hiringLibraryUsage(ORG, { positionIds: [POSITION], competencyIds: [COMP] }, REVIEWER, tx as never);
    expect(onTx).toHaveBeenCalled();
    expect(onTxSelect).toHaveBeenCalled();
    for (const spy of global) expect(spy).not.toHaveBeenCalled();
    for (const spy of [onTx, onTxSelect, ...global]) spy.mockRestore();
  });
});
