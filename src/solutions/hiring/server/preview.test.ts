import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf, type Op } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { markPreviewed } from "./versions";

/**
 * "Önizleme yapıldı" (HIRING-UX 5.4, Task 19) on a recording fake database:
 * the stamp locks the caller's opening (organisation, CLOSED), writes only a
 * DRAFT row of that organisation (the version previewed, when given), and a
 * freeze refusal from the database comes back as a code, never a raw 23514.
 * verify:hiring-setup proves the same on a real database.
 */
const ORG = "11111111-1111-4111-8111-111111111111";
const OPENING = "33333333-3333-4333-8333-333333333333";
const DRAFT = "44444444-4444-4444-8444-444444444444";

const world =
  (over: { opening?: Record<string, unknown> | null; updated?: unknown[]; failUpdate?: unknown } = {}) =>
  (op: Op): unknown[] => {
    if (op.kind === "select" && op.table === "hiring_openings") return over.opening === null ? [] : [{ id: OPENING, status: "DRAFT", positionId: null, ...over.opening }];
    if (op.kind === "update" && op.table === "hiring_versions") {
      if (over.failUpdate) throw over.failUpdate;
      return over.updated ?? [{ id: DRAFT }];
    }
    return [];
  };

beforeEach(() => {
  fake.ops.length = 0;
  fake.respond = world();
});

const stampOf = () => writesOf(fake.ops).find((o) => o.kind === "update" && o.table === "hiring_versions");

describe("markPreviewed", () => {
  it("locks the caller's opening by id and organisation first, and an opening of another organisation writes nothing", async () => {
    fake.respond = world({ opening: null });
    await expect(markPreviewed(ORG, OPENING)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fake.ops[0]).toMatchObject({ kind: "select", table: "hiring_openings", lock: "update" });
    expect(fake.ops[0].where).toContain('"hiring_openings"."org_id" = $');
    expect(fake.ops[0].params).toEqual(expect.arrayContaining([ORG, OPENING]));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a closed opening is history: CLOSED, and nothing is stamped", async () => {
    fake.respond = world({ opening: { status: "CLOSED" } });
    await expect(markPreviewed(ORG, OPENING)).rejects.toMatchObject({ code: "CLOSED" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("a malformed id finds nothing and sends no statement", async () => {
    await expect(markPreviewed(ORG, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(markPreviewed(ORG, OPENING, "not-a-uuid")).resolves.toBe(false);
    expect(fake.ops).toEqual([]);
  });

  it("stamps only a DRAFT row of the caller's organisation and opening, never a published one", async () => {
    await expect(markPreviewed(ORG, OPENING)).resolves.toBe(true);
    const stamp = stampOf();
    expect(stamp?.values).toEqual({ previewedAt: expect.any(Date) });
    expect(stamp?.where).toContain('"hiring_versions"."org_id" = $');
    expect(stamp?.where).toContain('"hiring_versions"."opening_id" = $');
    expect(stamp?.where).toContain('"hiring_versions"."status" = $');
    expect(stamp?.params).toEqual(expect.arrayContaining([ORG, OPENING, "DRAFT"]));
    expect(stamp?.params).not.toContain("PUBLISHED");
  });

  it("with the version the preview showed, stamps that draft only; a version that is no longer the draft is not stamped", async () => {
    await expect(markPreviewed(ORG, OPENING, DRAFT)).resolves.toBe(true);
    expect(stampOf()?.where).toContain('"hiring_versions"."id" = $');
    expect(stampOf()?.params).toEqual(expect.arrayContaining([DRAFT, "DRAFT", ORG]));
    fake.ops.length = 0;
    // Published meanwhile: the WHERE matches no DRAFT row, so nothing changes.
    fake.respond = world({ updated: [] });
    await expect(markPreviewed(ORG, OPENING, DRAFT)).resolves.toBe(false);
  });

  it("a freeze refusal from the database is answered NO_DRAFT, never a raw 23514", async () => {
    fake.respond = world({ failUpdate: Object.assign(new Error("frozen"), { code: "23514", constraint_name: "hiring_version_frozen" }) });
    await expect(markPreviewed(ORG, OPENING, DRAFT)).rejects.toMatchObject({ name: "HiringConflict", code: "NO_DRAFT" });
  });
});
